import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const updater = require(path.join(root, "electron", "runtime", "updater.cjs"));
const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");

test("updater behavior is owned outside Electron main", () => {
  assert.match(main, /createUpdaterRuntime/);
  assert.doesNotMatch(main, /function setupAutoUpdater|function safeUpdateInfo|sendLinuxManualUpdateOnlyEvent/);
  assert.equal(typeof updater.createUpdaterRuntime, "function");
});

test("updater version comparison is deterministic", () => {
  assert.equal(updater.normalizeUpdateVersion("v0.4.1"), "0.4.1");
  assert.equal(updater.compareUpdateVersions("0.4.2", "0.4.1"), 1);
  assert.equal(updater.compareUpdateVersions("0.4.1", "0.4.1"), 0);
  assert.equal(updater.compareUpdateVersions("0.4.0", "0.4.1"), -1);
});

test("Linux manual update path uses the canonical event helper", () => {
  const source = fs.readFileSync(path.join(root, "electron", "runtime", "updater.cjs"), "utf8");
  assert.match(source, /sendLinuxManualUpdateEvent/);
  assert.doesNotMatch(source, /sendLinuxManualUpdateOnlyEvent/);
  assert.match(source, /linux-manual-only-update-available/);
});
