import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const sortSource = fs.readFileSync("src/features/library/librarySort.ts", "utf8");
const view = fs.readFileSync("src/features/library/LibraryView.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

function loadSortLibrarySongs() {
  const compiled = ts.transpileModule(sortSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, Intl });
  return exports.sortLibrarySongs;
}

test("artist sort orders by artist, then album, then title without mutating library order", () => {
  const sortLibrarySongs = loadSortLibrarySongs();
  const songs = [
    { id: "1", artist: "Charli xcx", album: "Pop 2", title: "Track 10" },
    { id: "2", artist: "aimer", album: "Daydream", title: "Ref:rain" },
    { id: "3", artist: "Charli XCX", album: "Pop 2", title: "Track 2" },
    { id: "4", artist: "", album: "", title: "Untagged" },
    { id: "5", artist: "Charli xcx", album: "Brat", title: "360" }
  ];
  const before = songs.map((song) => song.id);

  const sorted = sortLibrarySongs(songs, "artist");

  assert.deepEqual(Array.from(sorted, (song) => song.id), ["2", "5", "3", "1", "4"]);
  assert.deepEqual(songs.map((song) => song.id), before);
  assert.equal(sortLibrarySongs(songs, "library"), songs);
});

test("library view exposes the sort and blocks reordering while sorted", () => {
  assert.match(view, /className="librarySort"/);
  assert.match(view, /<ArcDropdownMenu/);
  assert.match(view, /value: "artist", label: "artist A–Z"/);
  assert.match(view, /onValueChange=\{setLibrarySortMode\}/);
  assert.match(app, /sortLibrarySongs\(unsortedVisibleSongs, librarySortMode\)/);
  assert.match(app, /const libraryOrderLocked = librarySortMode !== "library" && \(view === "library" \|\| view === "liked"\)/);
  for (const handler of ["handleLibraryDragOver", "handleLibraryDrop", "handleLibraryAreaDragOver", "handleLibraryAreaDrop"]) {
    assert.match(app, new RegExp(`function ${handler}\\([^)]*\\) \\{\\s+if \\(libraryOrderLocked\\) return;`));
  }
  assert.match(app, /if \(event\.button !== 0 \|\| !songId \|\| libraryOrderLocked\) return;/);
});

test("top played songs match full stable sorting without changing the library", () => {
  const compiled = ts.transpileModule(sortSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, Intl });
  const songs = Array.from({ length: 500 }, (_, index) => ({ id: String(index), artist: "a", album: "b", title: "c", playCount: index % 17 }));
  const expected = [...songs].sort((a, b) => b.playCount - a.playCount).slice(0, 6).map((song) => song.id);
  assert.deepEqual(Array.from(exports.topPlayedSongs(songs, 6), (song) => song.id), expected);
  assert.deepEqual(songs.map((song) => song.id), Array.from({ length: 500 }, (_, index) => String(index)));
  assert.deepEqual(Array.from(exports.topPlayedSongs(songs, 0)), []);
  assert.deepEqual(Array.from(exports.topPlayedSongs(songs.slice(0, 3), 6), (song) => song.id), ["2", "1", "0"]);
});
