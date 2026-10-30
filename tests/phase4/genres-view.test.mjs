import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const source = fs.readFileSync("src/features/genres/GenresView.tsx", "utf8");
const creditsSource = fs.readFileSync("src/features/genres/genreCredits.ts", "utf8");
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

test("genre search prefers exact names and cards open the genre page", () => {
  assert.match(source, /genre\.name\.toLocaleLowerCase\(\) === needle/);
  assert.match(source, /if \(exactMatches\.length\) return exactMatches/);
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
