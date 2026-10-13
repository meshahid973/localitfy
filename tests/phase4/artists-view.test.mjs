import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const source = fs.readFileSync("src/features/artists/ArtistsView.tsx", "utf8");
const creditsSource = fs.readFileSync("src/features/artists/artistCredits.ts", "utf8");
const navigation = fs.readFileSync("src/features/shell/navigation.constants.ts", "utf8");
const shell = fs.readFileSync("src/features/shell/AppShell.tsx", "utf8");

test("Artists is a lazy, feature-owned library destination", () => {
  assert.match(navigation, /id:\s*"artists"/);
  assert.match(shell, /lazy\(\(\) => import\("\.\.\/artists\/ArtistsView"\)\)/);
  assert.match(source, /data-page-section="artists"/);
  assert.match(source, /import "\.\/artists\.css"/);
});

test("artist credits split on semicolons and feat variants, then deduplicate case-insensitively", () => {
  assert.match(creditsSource, /ARTIST_CREDIT_SEPARATOR\s*=\s*\/;\|\\s\+feat\\\.\?\\s\+\/gi/);
  assert.match(creditsSource, /\.split\(ARTIST_CREDIT_SEPARATOR\)/);
  assert.match(creditsSource, /if \(!uniqueNames\.has\(key\)\) uniqueNames\.set\(key, name\)/);
  assert.match(source, /for \(const name of splitArtistCredits\(song\.artist\)\)/);
});

test("artist search prefers an exact normalized name before partial matches", () => {
  assert.match(source, /artist\.name\.toLocaleLowerCase\(\) === needle/);
  assert.match(source, /if \(exactMatches\.length\) return exactMatches/);
  assert.match(source, /artist\.name\.toLocaleLowerCase\(\)\.includes\(needle\)/);
});

test("artist details expose songs, albums, and playback actions", () => {
  assert.match(source, /artistDetailView === "songs"/);
  assert.match(source, /artistDetailView === "albums"/);
  assert.match(source, /playArtistSongs\?\./);
  assert.match(source, /shuffleArtistSongs\?\./);
  assert.match(source, /queueArtistSongs\?\./);
});

// Exercise the real parser; source-pattern checks alone miss metadata bugs.
test("artist credits ignore empty separators and keep the first spelling", () => {
  const compiled = ts.transpileModule(creditsSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports });
  const split = exports.splitArtistCredits;
  assert.deepEqual(Array.from(split("Aimer;")), ["Aimer"]);
  assert.deepEqual(Array.from(split("Aimer;;YOASOBI")), ["Aimer", "YOASOBI"]);
  assert.deepEqual(Array.from(split("Aimer; aimer")), ["Aimer"]);
  assert.deepEqual(Array.from(split("Aimer feat. YOASOBI")), ["Aimer", "YOASOBI"]);
  assert.deepEqual(Array.from(split("")), ["unknown artist"]);
});

test("artist drawer closes before the playlist picker opens", () => {
  assert.match(source, /closeArtist\(false\);\s+openPlaylistPicker\(song\)/);
  assert.match(source, /handleDialogKeys/);
  assert.match(source, /artistTriggerRef/);
});
