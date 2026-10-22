import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { recordingKey, copyOf, findDuplicates, validateMerges } = require("../../electron/library-duplicates.cjs");

let n = 0;
const song = (filePath, title, extra = {}) => ({ id: extra.id || `s${n++}`, filePath, title, artist: "Artist", album: "Album", duration: 200, ...extra });
const vector = (values) => { const v = new Float64Array(4); values.forEach((x, i) => { v[i] = x; }); const norm = Math.hypot(...v); return v.map((x) => x / norm); };

test("recordings match on cleaned title and full credits; versions and featured artists stay distinct", () => {
  assert.equal(recordingKey({ title: "Levitating (feat. DaBaby)", artist: "Dua Lipa" }), recordingKey({ title: "Levitating", artist: "Dua Lipa feat. DaBaby" }));
  assert.notEqual(recordingKey({ title: "Levitating", artist: "Dua Lipa" }), recordingKey({ title: "Levitating", artist: "Dua Lipa feat. DaBaby" }));
  assert.equal(recordingKey({ title: "Song - Remastered 2011", artist: "A" }), recordingKey({ title: "Song (Remastered)", artist: "A" }));
  for (const version of ["Song (remix)", "Song (live)", "Song (Vixi solo version)", "Song (reprise)"]) {
    assert.notEqual(recordingKey({ title: version, artist: "A" }), recordingKey({ title: "Song", artist: "A" }), version);
  }
  assert.equal(recordingKey({ title: "Café", artist: "Beyoncé & JAY-Z" }), recordingKey({ title: "cafe", artist: "JAY-Z, Beyonce" }));
  assert.deepEqual(copyOf({ filePath: "/m/U/08 Bodyfeeling (1).mp3", album: "U" }), { key: "/m/U|u|.mp3|copy1", folder: "/m/U", album: "u", extension: "mp3", duplicateName: true, track: 8 });
  assert.equal(copyOf({ filePath: "/m/U/08 Bodyfeeling.m4a", album: "U" }).key, "/m/U|u|.m4a|");
});

test("several copies of an album in one folder are kept as one whole copy", () => {
  const titles = ["One", "Two", "Three"];
  const songs = titles.flatMap((title, i) => [
    song(`/m/U/0${i + 1} ${title}.m4a`, title, { id: `m4a-${i}` }),
    song(`/m/U/0${i + 1} ${title}.mp3`, title, { id: `mp3-${i}` }),
    song(`/m/U/0${i + 1} ${title} (1).mp3`, title, { id: `copy-${i}` })]);
  // The m4a copy has the best bitrate on two tracks only: the decision is still made once for the whole copy.
  const fileSizes = new Map(songs.map((s) => [s.id, s.id.startsWith("m4a") && s.id !== "m4a-2" ? 9e6 : 8e6]));
  const sets = findDuplicates(songs, { fileSizes });
  assert.equal(sets.length, 1); assert.equal(sets[0].kind, "album"); assert.equal(sets[0].groups.length, 3);
  const keptCopies = new Set(sets[0].groups.map((group) => group.songs.find((s) => s.id === group.keepId).copyKey));
  assert.equal(keptCopies.size, 1, "never half of one copy and half of another");
  assert.equal(sets[0].recommendedCopy, "/m/U|album|.m4a|");
  assert.ok(sets[0].copies.at(-1).duplicateName, "a Finder-style (1) copy ranks last at equal size");
});

test("a single loses to the album that contains it; versions, other tracks and other recordings are not duplicates", () => {
  const songs = [
    song("/m/Halo/01 Intro.mp3", "Intro", { album: "HALO" }), song("/m/Halo/11 American Girl.mp3", "American Girl", { id: "album", album: "HALO" }),
    song("/m/Halo/12 Pretty.mp3", "Pretty", { id: "album-2", album: "HALO" }),
    song("/m/American Girl/01 American Girl.mp3", "American Girl", { id: "single", album: "AMERICAN GIRL" }),
    song("/m/American Girl/02 Pretty.mp3", "Pretty", { id: "single-2", album: "AMERICAN GIRL" }),
    song("/m/FN/05 Levitating.mp3", "Levitating", { album: "FN" }), song("/m/FN/12 Levitating.mp3", "Levitating", { album: "FN", duration: 201 }),
    song("/m/X/01 Remix.mp3", "Tune", { album: "X" }), song("/m/Y/01 Tune.mp3", "Tune", { album: "Y", duration: 240 }),
    song("/m/P/01 Other.mp3", "Other", { id: "a1", album: "P" }), song("/m/Q/01 Other.mp3", "Other", { id: "a2", album: "Q" }),
    song("/m/R/01 NoLength.mp3", "NoLength", { id: "z1", duration: 0 }), song("/m/S/01 NoLength.mp3", "NoLength", { id: "z2", duration: 0 })
  ];
  const vectors = new Map([["a1", vector([1, 0])], ["a2", vector([.5, .87])], ["z1", vector([1, 0])], ["z2", vector([1, 0])]]);
  const sets = findDuplicates(songs, { vectors });
  const halo = sets.find((set) => set.groups.some((group) => group.songs.some((s) => s.id === "single")));
  assert.equal(halo.kind, "album"); assert.deepEqual(halo.groups.map((group) => group.keepId).sort(), ["album", "album-2"]);
  const ids = sets.flatMap((set) => set.groups.flatMap((group) => group.songs.map((s) => s.id)));
  assert.ok(!ids.includes("a1"), "audio below 0.9 is a different recording");
  assert.ok(ids.includes("z1") && ids.includes("z2"), "unknown lengths still match on identical audio");
  assert.equal(ids.filter((id) => songs.find((s) => s.id === id)?.title === "Levitating").length, 0, "different track numbers on one album");
  assert.equal(ids.filter((id) => songs.find((s) => s.id === id)?.title === "Tune").length, 0, "40 seconds apart");
});

test("merges are only accepted for songs a fresh scan still groups together", () => {
  const songs = [song("/m/A/01 X.mp3", "X", { id: "x1" }), song("/m/B/01 X.mp3", "X", { id: "x2" }),
    song("/m/A/02 Y.mp3", "Y", { id: "y1" }), song("/m/B/02 Y.mp3", "Y", { id: "y2" })];
  const sets = findDuplicates(songs);
  assert.deepEqual(validateMerges([{ keepId: "x1", removeIds: ["x2", "x2"] }], sets), [{ keepId: "x1", removeIds: ["x2"] }]);
  assert.throws(() => validateMerges([{ keepId: "x1", removeIds: ["y2"] }], sets), /no longer duplicates/);
  assert.throws(() => validateMerges([{ keepId: "x1", removeIds: ["x1"] }], sets));
  assert.throws(() => validateMerges([{ keepId: "x1", removeIds: ["x2"] }, { keepId: "x2", removeIds: ["x1"] }], sets));
  for (const bad of [null, [], [{ keepId: "x1", removeIds: [] }], [{ keepId: 1, removeIds: ["x2"] }]]) assert.throws(() => validateMerges(bad, sets));
});

test("review choices keep a whole copy and fall back only for tracks the copy lacks", async () => {
  const source = fs.readFileSync(new URL("../../src/features/library/duplicates/duplicatePlan.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { buildMerges, defaultChoices, remapSongIds, keptForRemoved } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  const sets = [{ id: "s", kind: "album", recommendedCopy: "A", copies: [], groups: [
    { id: "g1", keepId: "a1", songs: [{ id: "a1", copyKey: "A" }, { id: "b1", copyKey: "B" }] },
    { id: "g2", keepId: "a2", songs: [{ id: "a2", copyKey: "A" }, { id: "c2", copyKey: "C" }, { id: "b2", copyKey: "B" }] },
    { id: "g3", keepId: "c3", songs: [{ id: "c3", copyKey: "C" }, { id: "a3", copyKey: "A" }] }] },
    { id: "t", kind: "track", recommendedCopy: "D", copies: [], groups: [{ id: "g4", keepId: "d1", songs: [{ id: "d1", copyKey: "D" }, { id: "e1", copyKey: "E" }] }] }];
  const choices = defaultChoices(sets); choices.set("s", "B"); choices.set("t", "e1");
  assert.deepEqual(buildMerges(sets, choices), [
    { keepId: "b1", removeIds: ["a1"] }, { keepId: "b2", removeIds: ["a2", "c2"] }, { keepId: "c3", removeIds: ["a3"] }, { keepId: "e1", removeIds: ["d1"] }]);
  choices.delete("t");
  assert.equal(buildMerges(sets, choices).length, 3, "skipped sets are left alone");
  assert.deepEqual(remapSongIds(["a1", "b1", "x"], keptForRemoved([{ keepId: "b1", removeIds: ["a1"] }])), ["b1", "x"]);
});

test("merging folds likes, plays, playlists, history and lyrics into the kept song with real SQLite", () => {
  const result = spawnSync(process.execPath, ["scripts/run-electron-node.cjs", "scripts/test-duplicate-merge.cjs"], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /duplicate-merge.*passed/);
});

test("multiple duplicate track groups without album metadata are shown as one reviewable set", () => {
  const songs = ["Alpha", "Beta"].flatMap((title, i) => [
    song(`/music/0${i + 1} ${title}.mp3`, title, { id: `mp3-${i}`, album: "Local files" }),
    song(`/music/0${i + 1} ${title}.m4a`, title, { id: `m4a-${i}`, album: "Local files" })
  ]);
  const sets = findDuplicates(songs);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].groups.length, 2);
  assert.equal(sets[0].kind, "album", "all affected tracks are shown instead of only the first group");
});
