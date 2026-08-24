import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mainSource = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
const {
  PUBLIC_SPOTIFY_CLIENT_ID,
  getLocaltifyEnvPaths,
  loadLocaltifyEnv
} = require(path.join(root, "electron", "runtime", "environment.cjs"));

test("Electron environment loading is owned outside main", () => {
  assert.match(mainSource, /runtime\/environment\.cjs/);
  assert.equal(mainSource.includes("function loadLocaltifyEnv()"), false);
});

test("environment runtime resolves stable candidate paths without duplicates", () => {
  const fakeApp = {
    getAppPath: () => path.join(path.sep, "app", "localtify"),
    getPath: (name) => name === "userData" ? path.join(path.sep, "user", "data") : ""
  };
  const fakeProcess = {
    resourcesPath: path.join(path.sep, "resources"),
    execPath: path.join(path.sep, "bin", "localtify"),
    cwd: () => path.join(path.sep, "cwd"),
    env: {}
  };

  const candidates = getLocaltifyEnvPaths(fakeApp, fakeProcess);
  assert.equal(candidates.length, new Set(candidates.map((item) => path.normalize(item).toLowerCase())).size);
  assert.ok(candidates.some((item) => item.endsWith(path.join("cwd", ".env"))));
  assert.ok(candidates.some((item) => item.endsWith(path.join("user", "data", ".env.production"))));
});

test("environment runtime preserves explicit Spotify IDs and supplies the public fallback", () => {
  const fakeApp = { getAppPath: () => "", getPath: () => "" };
  const fallbackProcess = { resourcesPath: "", execPath: "", cwd: () => "", env: {} };
  loadLocaltifyEnv(fakeApp, fallbackProcess);
  assert.equal(fallbackProcess.env.SPOTIFY_CLIENT_ID, PUBLIC_SPOTIFY_CLIENT_ID);
  assert.equal(fallbackProcess.env.VITE_PUBLIC_SPOTIFY_CLIENT_ID, PUBLIC_SPOTIFY_CLIENT_ID);

  const explicitProcess = {
    resourcesPath: "",
    execPath: "",
    cwd: () => "",
    env: { SPOTIFY_CLIENT_ID: "explicit-client" }
  };
  loadLocaltifyEnv(fakeApp, explicitProcess);
  assert.equal(explicitProcess.env.SPOTIFY_CLIENT_ID, "explicit-client");
  assert.equal(explicitProcess.env.VITE_PUBLIC_SPOTIFY_CLIENT_ID, "explicit-client");
});
