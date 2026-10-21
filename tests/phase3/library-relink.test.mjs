import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { findMovedSongCandidates } = require(path.join(root, "electron", "library-relink.cjs"));
const isAudioFile = file => path.extname(file).toLowerCase() === ".mp3";
const fileExists = file => fs.existsSync(file);

test("relink candidate requires one exact filename match and compatible metadata", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-relink-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const nextPath = path.join(dir, "Artist - Song.mp3");
  fs.writeFileSync(nextPath, "fixture");
  const songs = [{
    id: "stable-song-id", filePath: path.join(dir, "old", "Artist - Song.mp3"),
    title: "Song", artist: "Artist", duration: 181, liked: true
  }];
  const result = await findMovedSongCandidates(dir, songs, {
    isAudioFile, fileExists, readMetadata: async () => ({ title: "Song", artist: "Artist", duration: 181 })
  });
  assert.equal(result.truncated, false);
  assert.deepEqual(result.matches, [{
    id: "stable-song-id", oldPath: songs[0].filePath, newPath: nextPath, title: "Song"
  }]);
});

test("ambiguous filenames and incompatible metadata must not be automatically relinked", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-relink-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const folder of ["a", "b"]) {
    fs.mkdirSync(path.join(dir, folder));
    fs.writeFileSync(path.join(dir, folder, "same.mp3"), "fixture");
  }
  const songs = [{ id: "one", filePath: path.join(dir, "old", "same.mp3"), title: "same", artist: "A" }];
  const ambiguous = await findMovedSongCandidates(dir, songs, {
    isAudioFile, fileExists, readMetadata: async () => ({ title: "same", artist: "A" })
  });
  assert.equal(ambiguous.matches.length, 0);
  assert.ok(ambiguous.ambiguous > 0);

  fs.rmSync(path.join(dir, "b", "same.mp3"));
  const incompatible = await findMovedSongCandidates(dir, songs, {
    isAudioFile, fileExists, readMetadata: async () => ({ title: "Different", artist: "A" })
  });
  assert.equal(incompatible.matches.length, 0);
});

test("truncated scans fail closed instead of offering partial matches", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-relink-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "same.mp3"), "fixture");
  fs.writeFileSync(path.join(dir, "another.mp3"), "fixture");
  const result = await findMovedSongCandidates(dir, [{
    id: "one", filePath: path.join(dir, "old", "same.mp3"), title: "same"
  }], { isAudioFile, fileExists, maxFiles: 1 });
  assert.equal(result.truncated, true);
  assert.deepEqual(result.matches, []);
});
