import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createLibraryWatcher, cleanWatchedFolders, listAudioFiles } = require("../../electron/library-watch.cjs");
const isAudioFile = (file) => /\.(mp3|flac)$/i.test(file);

function tempLibrary() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "localtify-watch-")));
  const write = (relative, { old = true } = {}) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "audio");
    // Old files count as finished copying straight away.
    if (old) fs.utimesSync(file, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
    return file;
  };
  return { root, write, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

async function waitFor(check, message, timeout = 5000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) assert.fail(message);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function fakeLibrary(initial = []) {
  const paths = new Set(initial);
  const imports = []; const changes = [];
  return {
    paths, imports, changes,
    options: {
      isAudioFile, settleMs: 150, log: () => undefined,
      getLibraryPaths: () => [...paths],
      importFiles: async (files) => { const fresh = files.filter((file) => !paths.has(file)); fresh.forEach((file) => paths.add(file)); imports.push(fresh); return { importedCount: fresh.length }; },
      onChange: (change) => changes.push(change)
    }
  };
}

test("watched folder lists are absolute, unique and capped", () => {
  const base = path.join(os.tmpdir(), "Music");
  assert.deepEqual(cleanWatchedFolders([base, `${base}${path.sep}`, base.toUpperCase(), "relative/music", 4, null]), [base]);
  assert.equal(cleanWatchedFolders(Array.from({ length: 30 }, (_, i) => path.join(base, String(i)))).length, 20);
  assert.deepEqual(cleanWatchedFolders("nope"), []);
});

test("folder listing skips hidden files, partial downloads and the app's own folders", async () => {
  const lib = tempLibrary();
  try {
    const keep = [lib.write("a.mp3"), lib.write("Artist/Album/CD 1/b.flac")];
    for (const skip of [".hidden.mp3", ".cache/c.mp3", "d.mp3.part", "e.crdownload", "localitfy-bin/f.mp3", "notes.txt"]) lib.write(skip);
    assert.deepEqual((await listAudioFiles(lib.root, isAudioFile)).sort(), keep.sort());
    assert.equal((await listAudioFiles(lib.root, isAudioFile, 1)).length, 1);
  } finally { lib.cleanup(); }
});

test("new files are imported once, songs already in the library are skipped, and removals reload the library", async () => {
  const lib = tempLibrary();
  const known = lib.write("Known/known.mp3");
  const library = fakeLibrary([known]);
  const watcher = createLibraryWatcher(library.options);
  try {
    const waiting = lib.write("Added while closed/song.mp3");
    watcher.setFolders([lib.root]);
    await waitFor(() => library.imports.length === 1, "launch check");
    assert.deepEqual(library.imports[0], [waiting], "the launch check only imports what is new");
    assert.equal(watcher.status().folders[0].watching, true);
    assert.ok(watcher.status().folders[0].checkedAt > 0);

    // A whole album copied in, plus a download still in progress.
    lib.write("New Album/01.mp3"); lib.write("New Album/02.flac"); lib.write("New Album/03.mp3.part");
    await waitFor(() => library.paths.has(path.join(lib.root, "New Album/02.flac")), "new album");
    await new Promise((resolve) => setTimeout(resolve, 400));
    const imported = library.imports.flat();
    assert.equal(new Set(imported).size, imported.length, "no file is imported twice");
    assert.ok(!imported.some((file) => file.endsWith(".part")));

    // A file still being written waits until it has been quiet.
    const fresh = lib.write("fresh.mp3", { old: false });
    await waitFor(() => library.paths.has(fresh), "fresh file after settling");

    const before = library.changes.length;
    fs.rmSync(known);
    await waitFor(() => library.changes.slice(before).some((change) => change.libraryChanged), "missing file reload");

    assert.equal(await watcher.checkNow(), 0, "check now finds nothing new");
  } finally { watcher.dispose(); lib.cleanup(); }
});

test("removed folders stop being watched and broken folders report why", async () => {
  const lib = tempLibrary();
  const library = fakeLibrary();
  const watcher = createLibraryWatcher(library.options);
  try {
    const missing = path.join(lib.root, "gone");
    watcher.setFolders([lib.root, missing]);
    await waitFor(() => watcher.status().folders.every((entry) => entry.checkedAt), "both checked");
    assert.equal(watcher.status().folders.find((entry) => entry.folder === missing).error, "folder not found");
    watcher.setFolders([missing]);
    assert.deepEqual(watcher.status().folders.map((entry) => entry.folder), [missing]);
    lib.write("after-removal.mp3", { old: true });
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(library.imports.flat().length, 0);
    // The folder appears later: "check now" starts watching it.
    fs.mkdirSync(missing); lib.write("gone/later.mp3");
    assert.equal(await watcher.checkNow(), 1);
    assert.equal(watcher.status().folders[0].watching, true);
  } finally { watcher.dispose(); lib.cleanup(); }
});
