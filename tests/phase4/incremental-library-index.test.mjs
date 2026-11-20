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
  const downloads = fs.readFileSync(path.join(root, "src/features/downloads/useDownloadsRuntime.ts"), "utf8");
  const snapshot = downloads.slice(downloads.indexOf("async function resolveLibrarySnapshot"), downloads.indexOf("async function clearFailedDownloads"));
  assert.ok(snapshot.indexOf("if (Array.isArray(snapshot)) return") < snapshot.indexOf("await window.localitfy.bootstrap()"));
  assert.match(snapshot, /if \(changed && window\.localitfy\?\.bootstrap\)/);
  assert.match(snapshot, /return songsRef\.current;/);
  assert.equal((downloads.match(/await resolveLibrarySnapshot\(result\.songs,/g)||[]).length,2);
  assert.match(app, /useLibraryDerivedState\(/);
  const controller = fs.readFileSync(path.join(root, "src/features/library/useLibraryController.ts"), "utf8");
  assert.match(controller, /reconcileLibraryIndex\(songs, libraryIndexRef\.current/);
});


test("incremental edits, reorderings and deletions match a fresh library rebuild", () => {
  const { buildSongSearchEntry } = loadTypescript(path.join(root, "src/features/search/search.utils.ts"));
  let songs = Array.from({ length: 150 }, (_, i) => song(String(i), `Artist ${i % 9} feat. Guest ${i % 3}`, `Album ${i % 11}`));
  let current = reconcileLibraryIndex(songs);
  const first = current;
  const originalCounts = [...first.artistOccurrences];
  const sorted = map => [...map].sort(([a], [b]) => a.localeCompare(b));
  for (let round = 0; round < 30; round++) {
    songs = songs.slice(1).reverse();
    songs[round % songs.length] = { ...songs[round % songs.length], playCount: round + 1, liked: round % 2 === 0 };
    songs[(round + 7) % songs.length] = { ...songs[(round + 7) % songs.length], title: `Renamed ${round}`, artist: `New ${round % 4}`, album: round % 2 ? "" : "Changed" };
    songs.push(song(`added-${round}`, "Guest 1; New 2", "Added"));
    const next = reconcileLibraryIndex(songs, current);
    const fresh = reconcileLibraryIndex(songs);
    assert.deepEqual(sorted(next.artistOccurrences), sorted(fresh.artistOccurrences));
    assert.deepEqual(sorted(next.albumOccurrences), sorted(fresh.albumOccurrences));
    assert.deepEqual([...next.songIndexById], [...fresh.songIndexById]);
    assert.deepEqual(next.searchEntries, songs.map(buildSongSearchEntry));
    assert.deepEqual([...first.artistOccurrences], originalCounts, "older snapshots remain unchanged");
    current = next;
  }
});

test("playback-only edits share facet snapshots, while metadata edits copy only affected maps", () => {
  const a=song("a"), b=song("b","Artist B","Album B");
  const first=reconcileLibraryIndex([a,b]);
  const second=reconcileLibraryIndex([{...a,playCount:2},b],first);
  assert.equal(second.artistOccurrences,first.artistOccurrences);
  assert.equal(second.albumOccurrences,first.albumOccurrences);
  const third=reconcileLibraryIndex([second.songsById.get("a"),{...b,artist:"Artist A"}],second);
  assert.notEqual(third.artistOccurrences,second.artistOccurrences);
  assert.equal(third.albumOccurrences,second.albumOccurrences);
  assert.equal(first.artistCount,2);
  assert.equal(third.artistCount,1);
});

test("no-op patches and identical IPC snapshots preserve library identity", () => {
  const a = song("a"), b = song("b"), list = [a, b];
  assert.equal(patchLibrarySong(list, "a", { liked: false, playCount: 0 }), list);
  assert.equal(replaceLibrarySong(list, { ...a }), list);
  assert.notEqual(replaceLibrarySong(list, { ...a, url: undefined }), list);
  assert.notEqual(patchLibrarySong(list, "a", { playCount: 1 }), list);
});


test("same-order playback updates share positions and preserve old snapshots", () => {
  const a=song("a"), b=song("b","Artist B","Album B");
  const first=reconcileLibraryIndex([a,b]);
  assert.equal(reconcileLibraryIndex([a,b],first),first);
  const edited={...b,playCount:4};
  const next=reconcileLibraryIndex([a,edited],first);
  assert.equal(next.songIndexById,first.songIndexById);
  assert.notEqual(next.songsById,first.songsById);
  assert.equal(first.songsById.get("b"),b);
  assert.equal(next.songsById.get("b"),edited);
  assert.equal(next.searchEntries[0],first.searchEntries[0]);
  assert.equal(next.searchEntries[1].haystack,first.searchEntries[1].haystack);
  const shuffled=reconcileLibraryIndex([edited,a],next);
  assert.notEqual(shuffled.songIndexById,next.songIndexById);
  assert.equal(shuffled.songIndexById.get("b"),0);
  assert.equal(next.songIndexById.get("b"),1);
});

test("one-song updates preserve snapshots and avoid rescanning the unchanged library", () => {
  const firstSongs = Array.from({ length: 5000 }, (_, i) => song("track-" + i));
  const first = reconcileLibraryIndex(firstSongs);
  const changed = patchLibrarySong(firstSongs, "track-4999", {playCount:4}, 4999);
  const optimized = reconcileLibraryIndex(changed,first);
  assert.equal(optimized.songsById.get("track-4999"),changed[4999]);
  assert.equal(optimized.searchEntries[0],first.searchEntries[0]);
  assert.equal(optimized.albumOccurrences,first.albumOccurrences);
  assert.equal(optimized.artistOccurrences,first.artistOccurrences);
  assert.equal(optimized.sourceSongs, changed);
  assert.equal(first.songsById.get("track-4999").playCount,0);
});

test("single-track hint never survives a reorder or an intervening patch", () => {
  const songs = [song("a"),song("b"),song("c")];
  const first = reconcileLibraryIndex(songs);
  const next = patchLibrarySong(songs,"b",{playCount:3},1);
  const reorder = [next[2],next[0],next[1]];
  const nextIndex = reconcileLibraryIndex(reorder,first);
  assert.deepEqual([...nextIndex.songIndexById.keys()],["c","a","b"]);
  assert.equal(nextIndex.searchEntries[2].song.playCount,3);
  assert.equal(first.searchEntries[1].song.playCount,0);
});
