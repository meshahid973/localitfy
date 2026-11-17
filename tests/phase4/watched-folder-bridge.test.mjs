import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const output = ts.transpileModule(fs.readFileSync("src/features/library/watchedFolderBridge.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const exports = {};
runInNewContext(output, { exports });
const { supportsWatchedFolders, subscribeWatchedFoldersChange } = exports;

test("an old preload cannot crash the watched folder subscription", () => {
  for (const bridge of [undefined, {}, { onWatchedFoldersChange: null }, { onWatchedFoldersChange: true }]) {
    assert.equal(supportsWatchedFolders(bridge), false);
    assert.equal(subscribeWatchedFoldersChange(bridge, () => assert.fail("unexpected event")), undefined);
  }
});

test("current and Android event bridges retain listener delivery and cleanup", () => {
  let listener;
  let stopped = 0;
  const bridge = {
    onWatchedFoldersChange(callback) {
      assert.equal(this, bridge);
      listener = callback;
      return () => { stopped++; };
    },
    getWatchedFolderStatus() {},
    checkWatchedFolders() {},
    chooseWatchedFolder() {}
  };
  assert.equal(supportsWatchedFolders(bridge), true);
  for (const key of Object.keys(bridge)) assert.equal(supportsWatchedFolders({ ...bridge, [key]: undefined }), false);
  const payload = { importedCount: 1, libraryChanged: true, songs: [] };
  const stop = subscribeWatchedFoldersChange(bridge, (change) => assert.equal(change, payload));
  listener(payload);
  stop();
  assert.equal(stopped, 1);
  assert.equal(typeof subscribeWatchedFoldersChange({ onWatchedFoldersChange: () => () => {} }, () => {}), "function");
});

test("both renderer entry points use the compatibility guard", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8");
  const settings = fs.readFileSync("src/features/library/WatchedFoldersSettings.tsx", "utf8");
  assert.match(app, /subscribeWatchedFoldersChange\(window\.localitfy,/);
  assert.match(settings, /if \(!supported\) return;/);
  assert.match(settings, /if \(!supported\) return </);
  assert.doesNotMatch(app + settings, /window\.localitfy\.onWatchedFoldersChange\(/);
});
