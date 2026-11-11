"use strict";

// Watched folders: new audio files in the folders you choose are added to the library while the app runs, and a
// full check on launch picks up anything added while it was closed. Files already in the library are skipped by
// path, and files that disappear stay in the library flagged as missing, exactly as they do today.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { registerLibraryWatchIpc } = require("./ipc/library-watch.cjs");

const SETTLE_MS = 2500;
const MAX_FOLDERS = 20;
const MAX_DEPTH = 12;
const MAX_FILES = 50_000;
const PARTIAL_FILE = /\.(part|tmp|download|crdownload)$/i;
const SKIPPED_FOLDERS = new Set(["localitfy-bin", "spotify-covers"]);
// Same path identity as importNewAudioFiles in main.cjs.
const pathKey = (file) => path.normalize(String(file || "")).toLowerCase();

function cleanWatchedFolders(value) {
  const folders = new Map();
  for (const item of Array.isArray(value) ? value : []) {
    if (typeof item !== "string" || !path.isAbsolute(item) || folders.size >= MAX_FOLDERS) continue;
    const folder = path.normalize(item).replace(/[\\/]+$/, "") || path.parse(item).root;
    if (!folders.has(pathKey(folder))) folders.set(pathKey(folder), folder);
  }
  return [...folders.values()];
}

/** Audio files under `root`, skipping hidden folders, partial downloads and the app's own download internals. */
async function listAudioFiles(root, isAudioFile, limit = MAX_FILES) {
  const files = [];
  const walk = async (dir, depth) => {
    if (files.length >= limit || depth > MAX_DEPTH) return;
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= limit) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !SKIPPED_FOLDERS.has(entry.name)) await walk(full, depth + 1);
      } else if (entry.isFile() && !entry.name.startsWith(".") && !PARTIAL_FILE.test(entry.name) && isAudioFile(full)) files.push(full);
    }
  };
  await walk(root, 0);
  return files;
}

/**
 * `importFiles(paths)` adds files that are not in the library yet and resolves to `{ importedCount }`.
 * `onChange({ importedCount, libraryChanged })` runs when the library window should reload its songs.
 */
function createLibraryWatcher({ isAudioFile, getLibraryPaths, importFiles, onChange, log = console.log,
  watch = fs.watch, settleMs = SETTLE_MS, now = Date.now }) {
  const entries = new Map();
  const pending = new Set();
  let timer = null;
  let queue = Promise.resolve();
  let scanning = false;
  let disposed = false;
  let lastImport = null;

  // One pass at a time, so a launch scan and a burst of file events never import the same file twice.
  const run = (task) => (queue = queue.then(task).catch((error) => log("[localtify watched folders error]", error?.message || error)));

  function schedule(file) {
    if (disposed) return;
    pending.add(file);
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void run(flush); }, settleMs);
  }

  function open(entry) {
    try {
      entry.watcher = watch(entry.folder, { recursive: true, persistent: false }, (_event, name) => {
        schedule(name ? path.join(entry.folder, String(name)) : entry.folder);
      });
      entry.watcher.on("error", (error) => { entry.error = error?.message || "stopped watching"; entry.watcher?.close(); entry.watcher = null; });
      entry.error = "";
    } catch (error) {
      entry.watcher = null;
      entry.error = error?.code === "ENOENT" ? "folder not found" : error?.message || "could not watch folder";
    }
  }

  async function add(files) {
    const fresh = [...new Set(files)];
    if (!fresh.length) return 0;
    const { importedCount = 0 } = await importFiles(fresh) || {};
    if (importedCount) {
      lastImport = { count: importedCount, at: now() };
      log("[localtify watched folders] imported", { importedCount });
    }
    return importedCount;
  }

  async function flush() {
    const changed = [...pending];
    pending.clear();
    const library = new Set(getLibraryPaths().map(pathKey));
    const candidates = [];
    let libraryChanged = false;
    for (const file of changed) {
      let stat;
      try { stat = await fsp.stat(file); } catch {
        // Deleted or moved away: the library shows it as missing on reload.
        const key = pathKey(file);
        if (library.has(key) || [...library].some((known) => known.startsWith(key + path.sep))) libraryChanged = true;
        continue;
      }
      if (stat.isDirectory()) {
        for (const found of await listAudioFiles(file, isAudioFile)) if (!library.has(pathKey(found))) candidates.push(found);
      } else if (stat.isFile() && !PARTIAL_FILE.test(file) && !path.basename(file).startsWith(".") && isAudioFile(file)) {
        // A known file changed or came back after going missing.
        if (library.has(pathKey(file))) { libraryChanged = true; continue; }
        // Still being copied or downloaded: look again once it has been quiet for a moment.
        if (now() - stat.mtimeMs < settleMs) schedule(file);
        else candidates.push(file);
      }
    }
    const importedCount = await add(candidates);
    if (importedCount || libraryChanged) onChange({ importedCount, libraryChanged });
  }

  async function scan(folders) {
    scanning = true;
    try {
      let importedCount = 0;
      for (const entry of folders) {
        if (disposed) break;
        const library = new Set(getLibraryPaths().map(pathKey));
        const files = (await listAudioFiles(entry.folder, isAudioFile)).filter((file) => !library.has(pathKey(file)));
        importedCount += await add(files);
        entry.checkedAt = now();
      }
      if (importedCount) onChange({ importedCount, libraryChanged: false });
      return importedCount;
    } finally { scanning = false; }
  }

  return {
    /** Start watching exactly these folders. New folders get a full check; unchanged ones are left alone. */
    setFolders(value) {
      if (disposed) return;
      const folders = cleanWatchedFolders(value);
      const keys = new Set(folders.map(pathKey));
      for (const [key, entry] of entries) if (!keys.has(key)) { entry.watcher?.close(); entries.delete(key); }
      const added = [];
      for (const folder of folders) {
        if (entries.has(pathKey(folder))) continue;
        const entry = { folder, watcher: null, error: "", checkedAt: 0 };
        entries.set(pathKey(folder), entry); open(entry); added.push(entry);
      }
      if (added.length) void run(() => scan(added));
    },
    /** Check every folder now, and retry folders that could not be watched. */
    checkNow() {
      for (const entry of entries.values()) if (!entry.watcher) open(entry);
      return run(() => scan([...entries.values()])).then((count) => count || 0);
    },
    status() {
      return { scanning, lastImport, folders: [...entries.values()].map(({ folder, watcher, error, checkedAt }) => ({ folder, watching: Boolean(watcher), error, checkedAt })) };
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      for (const entry of entries.values()) entry.watcher?.close();
      entries.clear();
    }
  };
}

/** Creates the watcher, its IPC and its startup check (after launch work settles). Returns it for disposal. */
function startLibraryWatch(router, { dialog, getWindow, isAudioFile, getSongs, getSettings, importFiles, listSongsShaped, startDelayMs = 5000 }) {
  const watcher = createLibraryWatcher({ isAudioFile, importFiles, getLibraryPaths: () => getSongs().map((song) => song.filePath),
    onChange: (change) => getWindow()?.webContents.send("library:watched-change", { ...change, songs: listSongsShaped() }) });
  registerLibraryWatchIpc(router, watcher, { dialog, getWindow });
  setTimeout(() => watcher.setFolders(getSettings().watchedFolders), startDelayMs).unref?.();
  return watcher;
}

module.exports = { createLibraryWatcher, startLibraryWatch, cleanWatchedFolders, listAudioFiles };
