import assert from "node:assert/strict";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadTs(file, dependencies = {}) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, Intl, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error("Unexpected benchmark import: " + name);
  } });
  return exports;
}

const sort = loadTs("src/features/library/librarySort.ts");
const pixelArt = {
  DEFAULT_RUNTIME_PIXEL_ART_ASSETS: [{ file: "default.png", label: "default" }],
  cleanStringList(items) { return [...new Set(items.filter(Boolean))]; },
  getCachedRuntimePixelArtAssets() { return []; },
  getPixelArtAssetKey(asset) { return String(asset.path || asset.url || asset.file || "").trim(); }
};
const cover = loadTs("src/features/covers/cover.runtime.ts", {
  "./pixelArt": pixelArt, "../settings/settings.constants": { coverMoodOptions: [] }
});
const songs = Array.from({ length: 10000 }, (_, index) => ({
  id: String(index), title: "Track " + index, artist: "Artist " + index % 53,
  album: "Album " + index % 180, filePath: "/music/" + index,
  playCount: index % 94, coverPath: "/covers/" + index % 81
}));
const assets = Array.from({ length: 128 }, (_, index) => ({
  file: "cover-" + index + ".png", label: "cover " + index, path: "/covers/" + index
}));
const usage = new Map(assets.map((asset, index) => [asset.path, index % 11]));

function oldTop() {
  return [...songs].sort((a, b) => b.playCount - a.playCount).slice(0, 6);
}
function newTop() {
  return sort.topPlayedSongs(songs, 6);
}
function oldPick(song, salt) {
  const keys = new Set([song.coverPath, song.coverUrl].filter(Boolean));
  const rank = assets.map((asset, index) => ({
    asset,
    isCurrent: keys.has(asset.path || "") || keys.has(asset.url || "") || keys.has(asset.file || ""),
    usage: usage.get(pixelArt.getPixelArtAssetKey(asset)) || 0,
    score: cover.stableHash(cover.songSignature(song) + "::" + salt + "::" + index + "::" + asset.file)
  })).filter((entry) => assets.length <= 1 || !entry.isCurrent)
    .sort((a, b) => a.usage - b.usage || a.score - b.score);
  return rank[0]?.asset || assets[0] || null;
}
function newPick(song, salt) {
  return cover.selectBalancedPixelAsset(assets, song, usage, salt);
}

for (const [index, song] of songs.slice(0, 200).entries()) {
  const salt = "benchmark-" + index;
  assert.equal(newPick(song, salt)?.file, oldPick(song, salt)?.file);
}
assert.deepEqual(Array.from(newTop(), (song) => song.id), oldTop().map((song) => song.id));

function bench(fn, runs = 5) {
  const values = [];
  fn();
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    fn();
    values.push(performance.now() - start);
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}
const oldTopMs = bench(oldTop);
const newTopMs = bench(newTop);
const oldCoversMs = bench(() => songs.slice(0, 1000).map((song, index) => oldPick(song, "fixed-" + index)), 3);
const newCoversMs = bench(() => songs.slice(0, 1000).map((song, index) => newPick(song, "fixed-" + index)), 3);
console.log("[hotpaths] 10k-song top-6 old/new:", oldTopMs.toFixed(2), "/", newTopMs.toFixed(2), "ms");
console.log("[hotpaths] 1k cover selections / 128 assets old/new:", oldCoversMs.toFixed(2), "/", newCoversMs.toFixed(2), "ms");
const originalIndex = Array.from({ length: 10000 }, (_, i) => ({
  ...songs[i], url: songs[i].filePath, liked: i % 13 === 0
}));
const search = loadTs("src/features/search/search.utils.ts", {
  "../../shared/storage/localStorage": { makeLocalId: () => "id" },
  "../../shared/utils/format": {
    collapseSpaces: (x) => String(x || "").replace(/\\s+/g, " ").trim(),
    lower: (x) => String(x || "").toLowerCase(),
    normalizeUiText: (x) => String(x || ""),
    safeNumber: (x) => Number(x) || 0
  }
});
originalIndex.map((song) => search.buildSongSearchEntryCached(song));
const coldSearchMs = bench(() => originalIndex.map((song) => search.buildSongSearchEntry(song)), 3);
const warmSearchMs = bench(() => originalIndex.map((song) => search.buildSongSearchEntryCached(song)), 3);
console.log("[hotpaths] 10k unchanged search entries old/new:", coldSearchMs.toFixed(2), "/", warmSearchMs.toFixed(2), "ms");
const credits = loadTs("src/features/artists/artistCredits.ts");
const libraryIndex = loadTs("src/features/search/incrementalLibraryIndex.ts", {
  "../artists/artistCredits": credits, "./search.utils": search
});
const recommendations = loadTs("src/features/playlists/playlistRecommendations.ts", {
  "../artists/artistCredits": credits
});
const largeLibrary = Array.from({ length: 50000 }, (_, index) => ({
  ...originalIndex[index % originalIndex.length], id: String(index),
  genre: ["ambient; electronic", "dance-pop", "jazz / blues", "classical", "rock"][index % 5]
}));
const initialIndex = libraryIndex.reconcileLibraryIndex(largeLibrary);
const oneUpdate = largeLibrary.slice();
oneUpdate[25000] = { ...oneUpdate[25000], playCount: 60 };
const nextIndex = libraryIndex.reconcileLibraryIndex(oneUpdate, initialIndex);
assert.equal(nextIndex.searchEntries[25000].song, oneUpdate[25000]);
assert.equal(nextIndex.searchEntries[25000].tokens, initialIndex.searchEntries[25000].tokens);
const updateMs = bench(() => libraryIndex.reconcileLibraryIndex(oneUpdate, initialIndex));
const seeds = largeLibrary.slice(0, 500);
const recommendationMs = bench(() => recommendations.relatedSongScores(seeds, largeLibrary), 3);
console.log("[hotpaths] 50k-library single playback update:", updateMs.toFixed(2), "ms");
console.log("[hotpaths] 50k-song recommendations / 500 seeds:", recommendationMs.toFixed(2), "ms");
console.log("[hotpaths] old/new outputs match; timings are machine-dependent, not UI latency measurements");
