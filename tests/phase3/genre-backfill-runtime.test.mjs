import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createGenreMetadataBackfill } = require("../../electron/runtime/genre-backfill.cjs");

test("genre backfill tags only eligible local songs and records completion", async () => {
  let settings = {};
  const patches = [];
  const metadataReads = [];
  const runtime = createGenreMetadataBackfill({
    getSettings: () => settings,
    saveSettings: (patch) => { settings = { ...settings, ...patch }; },
    getSongs: () => [
      { id: "missing-genre", filePath: "/music/a.mp3", genre: "" },
      { id: "already-tagged", filePath: "/music/b.mp3", genre: "Pop" },
      { id: "missing-file", filePath: "/music/missing.mp3", genre: "" }
    ],
    patchSong: (id, patch) => patches.push({ id, patch }),
    fileExists: (filePath) => !filePath.includes("missing"),
    isAudioFile: (filePath) => filePath.endsWith(".mp3"),
    readLocalAudioMetadata: async (filePath, options) => {
      metadataReads.push({ filePath, options });
      return { genre: "Synthpop; Dance" };
    },
    yieldToMainLoop: async () => {},
    logger: { log() {} }
  });

  assert.deepEqual(await runtime.run(), { scannedCount: 1, changedCount: 1 });
  assert.deepEqual(metadataReads, [{ filePath: "/music/a.mp3", options: { readCover: false, readDuration: false } }]);
  assert.deepEqual(patches, [{ id: "missing-genre", patch: { genre: "Synthpop; Dance" } }]);
  assert.equal(settings.genreMetadataBackfillVersion, 1);
});

test("genre backfill skips work after its migration marker is stored", async () => {
  const runtime = createGenreMetadataBackfill({
    getSettings: () => ({ genreMetadataBackfillVersion: 1 }),
    saveSettings: () => assert.fail("settings should not be written"),
    getSongs: () => assert.fail("songs should not be scanned"),
    patchSong: () => assert.fail("songs should not be patched"),
    fileExists: () => true,
    isAudioFile: () => true,
    readLocalAudioMetadata: async () => ({}),
    yieldToMainLoop: async () => {},
    logger: { log() {} }
  });

  assert.deepEqual(await runtime.run(), { scannedCount: 0, changedCount: 0 });
});

test("genres backfill runs on demand instead of blocking normal startup", () => {
  const fs = require("node:fs");
  const main = fs.readFileSync("electron/main.cjs", "utf8");
  const genres = fs.readFileSync("src/features/genres/useGenreTaggedSongs.ts", "utf8");
  assert.match(main, /options\?\.includeGenres === true\) await genreMetadataBackfill\.run\(\)/);
  assert.match(genres, /bootstrap\(\{ includeGenres: true \}\)/);
});
