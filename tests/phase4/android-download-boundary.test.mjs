import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

test("unsupported desktop download actions reject without replacing the phone library", async () => {
  const songs = [{ id: "phone-song", filePath: "/phone/files/song.mp3", title: "Kept offline" }];
  const phoneLibrary = { songs: () => songs, load: async () => {}, effectiveSettings: () => ({}), playlists: [] };
  const dependencies = {
    "../../app/platform": { computerName: () => "PC" },
    "./library": { phoneLibrary },
    "./macFeatures": {}, "./native": {}, "./store": {},
    "./sync": { setLibraryChangedHandler: () => {} }, "./live": {},
    "../../features/analytics/listeningSummary": {}
  };
  const exports = {};
  const { outputText } = ts.transpileModule(fs.readFileSync("src/platform/android/bridge.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  runInNewContext(outputText, { exports, window: { addEventListener: () => {} }, require: name => {
    assert.ok(name in dependencies, `unexpected bridge dependency ${name}`);
    return dependencies[name];
  } });
  const bridge = exports.createAndroidBridge();
  for (const action of ["downloadAudioUrls", "resumeDownloadJob", "spotifyDownloadBatch", "spotdlDownloadBatch", "pickAndConvertMedia"]) {
    await assert.rejects(bridge[action]({}), /Not available in the Android app/);
    assert.equal((await bridge.bootstrap()).songs, songs);
    assert.equal(songs[0].title, "Kept offline");
  }
});
