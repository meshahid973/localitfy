import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const source = fs.readFileSync("src/features/search/search.utils.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const exports = {};
runInNewContext(compiled, {
  exports,
  require(name) {
    if (name === "../../shared/storage/localStorage") return { makeLocalId: () => "id" };
    if (name === "../../shared/utils/format") return {
      collapseSpaces: (value) => String(value || "").replace(/\s+/g, " ").trim(),
      lower: (value) => String(value || "").toLowerCase(),
      normalizeUiText: (value) => String(value || ""),
      safeNumber: (value) => Number(value) || 0
    };
    throw new Error("Unexpected import: " + name);
  }
});

test("search index caches unchanged Song objects, not different copies", () => {
  const song = {
    id: "one", title: "Miku - Midnight", artist: "Artist",
    album: "Album", filePath: "/audio/miku.flac", liked: false, playCount: 1
  };
  const first = exports.buildSongSearchEntryCached(song);
  assert.equal(exports.buildSongSearchEntryCached(song), first);
  assert.equal(first.song, song);
  const edited = { ...song, liked: true };
  const next = exports.buildSongSearchEntryCached(edited);
  assert.notEqual(next, first);
  assert.equal(next.song, edited);
  assert.ok(next.haystack.includes("liked"));
  assert.equal(exports.buildSongSearchEntryCached(edited), next);
});

test("search ranking filters misses without changing stable order", () => {
  const entries = [
    { id: "1", title: "miku mix", artist: "a", album: "x", filePath: "/miku.mp3", playCount: 1 },
    { id: "2", title: "unrelated", artist: "b", album: "y", filePath: "/other.mp3", playCount: 0 },
    { id: "3", title: "miku mix", artist: "a", album: "x", filePath: "/miku-2.mp3", playCount: 1 }
  ].map((song) => exports.buildSongSearchEntryCached(song));
  assert.deepEqual(Array.from(exports.rankSongsForSearch(entries, "miku"), (song) => song.id), ["1", "3"]);
});

test("search token substring fallback retains partial-word matches", () => {
  const entries = [
    { id: "first", title: "Morning", artist: "Miku", album: "Songs", filePath: "/music/morning.mp3", playCount: 0 },
    { id: "second", title: "Evening", artist: "Rin", album: "Songs", filePath: "/music/evening.mp3", playCount: 0 }
  ].map(song => exports.buildSongSearchEntryCached(song));
  assert.deepEqual(Array.from(exports.rankSongsForSearch(entries, "orn"), song => song.id), ["first"]);
});

