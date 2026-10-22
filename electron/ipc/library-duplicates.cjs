"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { findDuplicates, validateMerges } = require("../library-duplicates.cjs");
const { readNormalizedVector } = require("../analysis/similarity.cjs");
const { MODEL, ANALYZER_VERSION } = require("../analysis/model.cjs");

/** Never trash a file that a kept song still references, or delete the same path twice. */
function removableFiles(songs, removedIds) {
  const removed = new Set(removedIds);
  const key = (file) => process.platform === "win32" ? path.resolve(file).toLowerCase() : path.resolve(file);
  const retained = new Set(songs.filter((song) => !removed.has(song.id) && song.filePath).map((song) => key(song.filePath)));
  const seen = new Set();
  const files = [];
  let skippedShared = 0;
  for (const song of songs) {
    if (!removed.has(song.id) || !song.filePath) continue;
    const fileKey = key(song.filePath);
    if (retained.has(fileKey) || seen.has(fileKey)) { skippedShared++; continue; }
    seen.add(fileKey);
    files.push(song.filePath);
  }
  return { files, skippedShared };
}

/** Duplicate review: scanning is read-only; merging re-checks the plan against a fresh scan and backs up first. */
function registerDuplicateIpc(router, deps) {
  const { shell, getSongs, getAudioProfiles, mergeDuplicates, backupDatabase, clearFileInfoCache, listSongsShaped } = deps;

  async function scan() {
    const songs = getSongs();
    const fileSizes = new Map();
    // Bound filesystem requests: a large library should not create thousands of pending stats at once.
    for (let index = 0; index < songs.length; index += 32) {
      await Promise.all(songs.slice(index, index + 32).map(async (song) => {
        try { const stat = await fs.promises.stat(song.filePath); if (stat.isFile()) fileSizes.set(song.id, stat.size); } catch { /* missing files are skipped */ }
      }));
    }
    const vectors = new Map();
    for (const row of getAudioProfiles(MODEL.id, ANALYZER_VERSION)) {
      const vector = readNormalizedVector(row.vector);
      if (vector) vectors.set(row.songId, vector);
    }
    const present = songs.filter((song) => fileSizes.has(song.id));
    return { songs, sets: findDuplicates(present, { vectors, fileSizes }), scanned: present.length, analyzed: vectors.size };
  }

  router.handle("library:find-duplicates", async () => {
    try {
      const { sets, scanned, analyzed } = await scan();
      return { ok: true, sets, scanned, analyzed };
    } catch (error) {
      console.log("[localitfy duplicate scan error]", error?.message || error);
      return { ok: false, message: "Could not scan for duplicates. Please retry." };
    }
  });

  router.handle("library:merge-duplicates", async (_event, payload = {}) => {
    try {
      const { songs, sets } = await scan();
      const merges = validateMerges(payload?.merges, sets);
      const { files: trashCandidates, skippedShared } = removableFiles(songs, merges.flatMap((item) => item.removeIds));
      // Fail closed: no backup, no merge.
      backupDatabase("before-duplicate-merge");
      const removed = mergeDuplicates(merges);
      clearFileInfoCache();
      let trashed = 0; let trashFailed = 0;
      if (payload?.moveToTrash === true) {
        for (const file of trashCandidates) {
          try { await shell.trashItem(file); trashed += 1; } catch { trashFailed += 1; }
        }
      }
      return { ok: true, removedCount: removed.length, trashed, trashFailed,
        skippedShared: payload?.moveToTrash === true ? skippedShared : 0, merges, songs: listSongsShaped() };
    } catch (error) {
      console.log("[localitfy duplicate merge error]", error?.message || error);
      return { ok: false, message: error?.message || "Could not merge duplicates. Nothing was changed." };
    }
  });
}

module.exports = { registerDuplicateIpc, removableFiles };
