import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mainSource = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
const { createIpcRouter } = require(path.join(root, "electron", "ipc", "router.cjs"));
const { normalizeWindowTranslucencySettings } = require(path.join(root, "electron", "runtime", "windows.cjs"));
const { createDatabaseRepositories } = require(path.join(root, "electron", "db", "repositories.cjs"));

test("Electron main routes IPC through the duplicate-safe trusted router", () => {
  const registered = [];
  const router = createIpcRouter({ handle: (channel) => registered.push(channel) });
  router.handle("phase3:test", async () => true);
  assert.deepEqual(registered, ["phase3:test"]);
  assert.throws(() => router.handle("phase3:test", async () => true), /duplicate IPC handler/);
  assert.equal(mainSource.includes("ipcMain.handle("), false);
  assert.match(mainSource, /createIpcRouter\(ipcMain,\s*\{/);
  assert.match(mainSource, /isTrustedEvent:\s*\(event\)\s*=>\s*isTrustedMainFrameIpcEvent\(event, mainWindow\)/);
});

test("window normalization is owned outside main", () => {
  const normalized = normalizeWindowTranslucencySettings({ windowTransparency: 500, windowBlur: -50 });
  assert.equal(normalized.windowTransparency, 88);
  assert.equal(normalized.windowBlur, 0);
  assert.match(mainSource, /runtime\/windows\.cjs/);
});

test("database repositories preserve the existing database API", () => {
  const names = ["getSongs", "insertSongs", "patchSong", "deleteSong", "clearLibrary", "getSettings", "saveSettings", "getPlaylists", "savePlaylists", "initDatabase", "backupDatabase", "repairDatabaseNow", "getDatabaseStatus"];
  const fake = Object.fromEntries(names.map((name) => [name, () => name]));
  const repositories = createDatabaseRepositories(fake);
  assert.equal(repositories.songs.list(), "getSongs");
  assert.equal(repositories.settings.save(), "saveSettings");
  assert.equal(repositories.database.backup(), "backupDatabase");
  assert.match(mainSource, /db\/repositories\.cjs/);
});
