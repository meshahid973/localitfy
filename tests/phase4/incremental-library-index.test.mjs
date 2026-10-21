import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const localRequire = createRequire(import.meta.url);
const cache = new Map();
function loadTypescript(file) {
  const filePath = path.resolve(file);
  if (cache.has(filePath)) return cache.get(filePath).exports;
  const module = { exports: {} };
  cache.set(filePath, module);
  const compiled = ts.transpileModule(fs.readFileSync(filePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const requireFromSource = (name) =>
    name.startsWith(".") ? loadTypescript(path.resolve(path.dirname(filePath), name) + ".ts") : localRequire(name);
  new Function("module", "exports", "require", compiled)(module, module.exports, requireFromSource);
  return module.exports;
}
const { reconcileLibraryIndex, patchLibrarySong, replaceLibrarySong } =
  loadTypescript(path.join(root, "src/features/search/incrementalLibraryIndex.ts"));
const song = (id, artist = "Artist A", album = "Album A") => ({
  id, title: "Song " + id, artist, album, filePath: "/music/" + id + ".mp3", playCount: 0, liked: false
});

test("search entries and artist/album facets update only when a song changes", () => {
  const a = song("a");
  const b = song("b", "Artist B", "Album B");
  const first = reconcileLibraryIndex([a, b]);
  assert.equal(first.artistCount, 2);
  assert.equal(first.albumCount, 2);
  const b2 = { ...b, title: "Renamed", artist: "Artist A", album: "Album A" };
  const second = reconcileLibraryIndex([a, b2], first);
  assert.equal(second.searchEntries[0], first.searchEntries[0], "unaffected search entry reused");
  assert.notEqual(second.searchEntries[1], first.searchEntries[1], "edited metadata reindexed");
  assert.equal(second.artistCount, 1);
  assert.equal(second.albumCount, 1);
  assert.equal(second.songsById.get("b"), b2);
  const third = reconcileLibraryIndex([b2], second);
  assert.equal(third.artistCount, 1);
  assert.equal(third.albumCount, 1);
  assert.equal(third.songIndexById.get("b"), 0);
  assert.equal(third.songIndexById.has("a"), false);
  assert.equal(third.searchEntries[0], second.searchEntries[1]);
});

test("single-song edits preserve untouched references and handle out-of-date index hints", () => {
  const a = song("a"), b = song("b");
  const patch = patchLibrarySong([a, b], "b", { artist: "Other" }, 0);
  assert.equal(patch[0], a);
  assert.equal(patch[1].artist, "Other");
  const same = replaceLibrarySong(patch, { ...a, title: "Changed" }, 1);
  assert.equal(same[1], patch[1]);
  assert.equal(same[0].title, "Changed");
  assert.equal(replaceLibrarySong(same, song("unknown")), same);
});

test("download and Spotify refresh use final result snapshots before bootstrap fallback", () => {
  const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  assert.match(app, /if \(!Array\.isArray\(result\.songs\) && \(successCount > 0 \|\| Number\(result\.changedCount \|\| 0\) > 0\) && window\.localitfy\?\.bootstrap\)/);
  assert.match(app, /if \(!Array\.isArray\(result\.songs\) && \(successCount > 0 \|\| Number\(result\.changedCount \|\| 0\) > 0\) && bridge\?\.bootstrap\)/);
  assert.match(app, /reconcileLibraryIndex\(songs, libraryIndexRef\.current/);
});
