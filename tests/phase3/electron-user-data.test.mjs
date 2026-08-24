import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mainSource = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
const { createUserDataRuntime } = require(path.join(root, "electron", "runtime", "user-data.cjs"));

test("Electron user-data recovery is owned outside main", () => {
  assert.match(mainSource, /runtime\/user-data\.cjs/);
  assert.equal(mainSource.includes("function restoreDatabaseFromOldUserDataIfNeeded()"), false);
  assert.equal(mainSource.includes("function getCandidateDatabaseInfo("), false);
});

test("Electron bootstrap reads user-data policy from the runtime owner", () => {
  assert.equal(/\bLEGACY_APP_DATA_NAME\b/.test(mainSource), false);
  assert.equal(/\bSQLITE_FILE_NAME\b/.test(mainSource), false);
  assert.match(mainSource, /userDataRuntime\.dataFolderName/);
  assert.match(mainSource, /userDataRuntime\.sqliteFileName/);
});

test("user-data runtime configures the legacy stable directory and dedupes recovery candidates", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-user-data-"));
  const paths = {
    appData: path.join(tempRoot, "app-data"),
    userData: path.join(tempRoot, "initial-user-data")
  };
  fs.mkdirSync(paths.appData, { recursive: true });
  fs.mkdirSync(paths.userData, { recursive: true });

  const fakeApp = {
    getPath(name) {
      return paths[name];
    },
    setPath(name, value) {
      paths[name] = value;
    }
  };

  const runtime = createUserDataRuntime({ app: fakeApp });
  assert.equal(runtime.dataFolderName, "localitfy");
  assert.equal(runtime.sqliteFileName, "localitfy.sqlite");

  const stable = runtime.configureStableUserDataPath();
  assert.equal(stable, path.join(paths.appData, "localitfy"));
  assert.equal(paths.userData, stable);
  assert.equal(fs.existsSync(stable), true);

  const candidates = runtime.getUserDataRecoveryCandidates();
  assert.equal(candidates.length, new Set(candidates.map((item) => path.normalize(item).toLowerCase())).size);
  assert.ok(candidates.includes(path.join(paths.appData, "localtify")));
  assert.ok(candidates.includes(path.join(paths.appData, "localitfy")));
  assert.ok(candidates.includes(path.join(paths.appData, "Electron")));

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
