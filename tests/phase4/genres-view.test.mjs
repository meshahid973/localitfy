import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const source = fs.readFileSync("src/features/genres/GenresView.tsx", "utf8");
const creditsSource = fs.readFileSync("src/features/genres/genreCredits.ts", "utf8");
const sortSource = fs.readFileSync("src/features/genres/genreSort.ts", "utf8");
const navigation = fs.readFileSync("src/features/shell/navigation.constants.ts", "utf8");
const shell = fs.readFileSync("src/features/shell/AppShell.tsx", "utf8");
const database = fs.readFileSync("electron/db.cjs", "utf8");
const metadata = fs.readFileSync("electron/metadata-service.cjs", "utf8");
const main = fs.readFileSync("electron/main.cjs", "utf8");
const backfill = fs.readFileSync("electron/runtime/genre-backfill.cjs", "utf8");

test("Genres is a lazy, feature-owned library destination", () => {
  assert.match(navigation, /id:\s*"genres"/);
  assert.match(shell, /lazy\(\(\) => import\("\.\.\/genres\/GenresView"\)\)/);
  assert.match(source, /data-page-section="genres"/);
  assert.match(source, /import "\.\/genres\.css"/);
});

test("genre credits split semicolon tags, ignore blanks, and preserve first spelling", () => {
  const compiled = ts.transpileModule(creditsSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports });
  const split = exports.splitGenreCredits;
  assert.deepEqual(Array.from(split("Pop; Dance; pop")), ["Pop", "Dance"]);
  assert.deepEqual(Array.from(split("Ambient;; Electronic;")), ["Ambient", "Electronic"]);
  assert.deepEqual(Array.from(split("")), []);
});

function loadGenreSort() {
  const compile = (code) => ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const modules = {
    "./genreCredits": creditsSource,
    "../artists/artistCredits": fs.readFileSync("src/features/artists/artistCredits.ts", "utf8")
  };
  const require = (id) => {
    const exports = {};
    runInNewContext(compile(modules[id]), { exports, require });
    return exports;
  };
  const exports = {};
  runInNewContext(compile(sortSource), { exports, require, Intl, Date });
  return exports;
}

const song = (id, genre, extra = {}) => ({ id, title: id, artist: `artist ${id}`, album: "", genre, playCount: 0, dateAdded: "2026-01-01T00:00:00Z", ...extra });

test("genres sort by tracks, artists, plays, recency and name with name tie-breaks", () => {
  const { buildGenres, filterAndSortGenres } = loadGenreSort();
  const genres = buildGenres([
    song("1", "Pop; Rock", { playCount: 2 }),
    song("2", "Pop", { artist: "artist 1", playCount: 1 }),
    song("3", "pop; Jazz", { playCount: 9, dateAdded: "2026-05-01T00:00:00Z" }),
    song("4", "Ambient", { dateAdded: "not a date" }),
    song("5", "Rock; Ambient", { artist: "A; B" })
  ]);
  const names = (list) => Array.from(list, (genre) => genre.name);
  assert.deepEqual(names(genres), ["Ambient", "Jazz", "Pop", "Rock"]);
  assert.deepEqual(names(filterAndSortGenres(genres, "", "tracks", "1")), ["Pop", "Ambient", "Rock", "Jazz"]);
  assert.deepEqual(names(filterAndSortGenres(genres, "", "artists", "1")), ["Ambient", "Rock", "Pop", "Jazz"]);
  assert.deepEqual(names(filterAndSortGenres(genres, "", "plays", "1")), ["Pop", "Jazz", "Rock", "Ambient"]);
  assert.deepEqual(names(filterAndSortGenres(genres, "", "recent", "1")), ["Pop", "Jazz", "Ambient", "Rock"]);
  assert.deepEqual(names(filterAndSortGenres(genres, "", "name", "1")), ["Ambient", "Jazz", "Pop", "Rock"]);
  assert.deepEqual(names(genres), ["Ambient", "Jazz", "Pop", "Rock"], "sorting does not mutate");
});

test("minimum track filter hides small genres and applies to search", () => {
  const { buildGenres, filterAndSortGenres, countGenresByMinTracks } = loadGenreSort();
  const genres = buildGenres([song("1", "Pop; Rock"), song("2", "Pop"), song("3", "Pop; Pop Punk"), song("4", "Rock")]);
  const names = (list) => Array.from(list, (genre) => genre.name);
  assert.deepEqual(names(filterAndSortGenres(genres, "", "name", "2")), ["Pop", "Rock"]);
  assert.deepEqual(names(filterAndSortGenres(genres, "", "name", "3")), ["Pop"]);
  assert.deepEqual(names(filterAndSortGenres(genres, "pop", "name", "1")), ["Pop"], "exact name wins");
  assert.deepEqual(names(filterAndSortGenres(genres, "pop p", "name", "1")), ["Pop Punk"]);
  assert.deepEqual(names(filterAndSortGenres(genres, "pop p", "name", "2")), []);
  assert.deepEqual({ ...countGenresByMinTracks(genres) }, { 1: 3, 2: 2, 3: 1, 5: 0, 10: 0, 25: 0 });
});

test("genres view exposes persisted sort and size filters, and cards open the genre page", () => {
  assert.match(source, /ariaLabel="Sort genres"/);
  assert.match(source, /ariaLabel="Minimum tracks per genre"/);
  assert.match(source, /writeLocalJson\(SORT_STORAGE_KEY, sortMode\)/);
  assert.match(source, /writeLocalJson\(MIN_TRACKS_STORAGE_KEY, minTracks\)/);
  assert.match(source, /show all genres/);
  assert.match(source, /actions\.openCollection\(target\)/);
  assert.match(source, /actions\.playCollection\(target\)/);
  assert.doesNotMatch(source, /createPortal/, "no more side drawer");
  const page = fs.readFileSync("src/features/pages/SongGroupPage.tsx", "utf8");
  assert.match(page, /export function GenrePage/);
  assert.match(page, /useGenreTaggedSongs\(props\.songs\)/);
});

test("genre metadata is persisted, imported, and backfilled for existing libraries", () => {
  assert.match(database, /genre:\s*"TEXT NOT NULL DEFAULT ''"/);
  assert.match(database, /idx_songs_genre/);
  assert.match(metadata, /common\.genre/);
  assert.match(metadata, /\.join\("; "\)/);
  assert.match(main, /genreMetadataBackfill\.run\(\)/);
  assert.match(backfill, /readCover:\s*false, readDuration:\s*false/);
  assert.match(backfill, /genreMetadataBackfillVersion:\s*1/);
});
