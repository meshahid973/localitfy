import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createGenreMetadataBackfill } = require("../../electron/runtime/genre-backfill.cjs");

test("genre backfill tags only eligible local songs and records completion", async () => {
  let settings = {};
  const patches = [];
  const metadataReads = [];
  const runtime = createGenreMetadataBackfill({
    getSettings: () => settings,
    saveSettings: (patch) => { settings = { ...settings, ...patch }; },
    getSongs: () => [
      { id: "missing-genre", filePath: "/music/a.mp3", genre: "" },
      { id: "already-tagged", filePath: "/music/b.mp3", genre: "Pop" },
      { id: "missing-file", filePath: "/music/missing.mp3", genre: "" }
    ],
    patchSong: (id, patch) => patches.push({ id, patch }),
    fileExists: (filePath) => !filePath.includes("missing"),
    isAudioFile: (filePath) => filePath.endsWith(".mp3"),
    readLocalAudioMetadata: async (filePath, options) => {
      metadataReads.push({ filePath, options });
      return { ok: true, genre: "Synthpop; Dance" };
    },
    yieldToMainLoop: async () => {},
    logger: { log() {} }
  });

  assert.deepEqual(await runtime.run(), { scannedCount: 1, changedCount: 1 });
  assert.deepEqual(metadataReads, [{ filePath: "/music/a.mp3", options: { readCover: false, readDuration: false } }]);
  assert.deepEqual(patches, [{ id: "missing-genre", patch: { genre: "Synthpop; Dance" } }]);
  assert.equal(settings.genreMetadataBackfillVersion, 1);
});

test("genre backfill skips work after its migration marker is stored", async () => {
  const runtime = createGenreMetadataBackfill({
    getSettings: () => ({ genreMetadataBackfillVersion: 1 }),
    saveSettings: () => assert.fail("settings should not be written"),
    getSongs: () => assert.fail("songs should not be scanned"),
    patchSong: () => assert.fail("songs should not be patched"),
    fileExists: () => true,
    isAudioFile: () => true,
    readLocalAudioMetadata: async () => ({}),
    yieldToMainLoop: async () => {},
    logger: { log() {} }
  });

  assert.deepEqual(await runtime.run(), { scannedCount: 0, changedCount: 0 });
});

test("genres backfill runs on demand instead of blocking normal startup", () => {
  const fs = require("node:fs");
  const main = fs.readFileSync("electron/main.cjs", "utf8");
  const genres = fs.readFileSync("src/features/genres/useGenreTaggedSongs.ts", "utf8");
  const bootstrap = fs.readFileSync("electron/runtime/bootstrap.cjs", "utf8");
  assert.match(main, /backfillGenres: \(\) => genreMetadataBackfill\.run\(\)/);
  assert.match(bootstrap, /options\?\.includeGenres === true\) await backfillGenres\(\)/);
  assert.match(genres, /bootstrap\(\{ includeGenres: true \}\)/);
});


test("genre backfill never overwrites edits made while metadata is being read", async () => {
  let song = { id:"a", filePath:"/music/a.mp3", genre:"" };
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const runtime = createGenreMetadataBackfill({
    getSettings:()=>({}), saveSettings:()=>{}, getSongs:()=>[song], getSong:()=>song,
    patchSong:()=>assert.fail("manual edit must win"), fileExists:()=>true,isAudioFile:()=>true,
    readLocalAudioMetadata:()=>pending, yieldToMainLoop:async()=>{}, logger:{log(){}}
  });
  const work = runtime.run();
  song = {...song,genre:"Manual genre"};
  release({ok:true,genre:"Automatic genre"});
  assert.deepEqual(await work,{scannedCount:1,changedCount:0});
});


test("transient tag failures retry without marking the migration complete", async () => {
  let settings={}, attempts=0, patched;
  const runtime=createGenreMetadataBackfill({
    getSettings:()=>settings,saveSettings:patch=>Object.assign(settings,patch),
    getSongs:()=>[{id:"retry",filePath:"/music/retry.flac",genre:""}],
    patchSong:(_id,patch)=>{patched=patch;},fileExists:()=>true,isAudioFile:()=>true,
    readLocalAudioMetadata:async()=>++attempts===1?{ok:false,error:"temporary"}:{ok:true,genre:"Ambient"},
    yieldToMainLoop:async()=>{},logger:{log(){}}
  });
  await runtime.run();assert.equal(settings.genreMetadataBackfillVersion,undefined);
  await runtime.run();assert.deepEqual(patched,{genre:"Ambient"});assert.equal(settings.genreMetadataBackfillVersion,1);
});
