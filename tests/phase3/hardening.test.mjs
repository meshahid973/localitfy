import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("feature styles have canonical ownership", () => {
  const app = read("src/App.tsx");
  for (const owned of [
    "./features/shell/app-core.css",
    "./features/settings/themes.css",
    "./features/settings/settings.css",
    "./features/home/home.css",
    "./features/player/player.css",
    "./features/shell/effects.css"
  ]) assert.ok(app.includes(owned), `missing owned style import: ${owned}`);
  assert.equal(fs.existsSync(path.join(root, "src/player.css")), false);
  assert.equal(fs.existsSync(path.join(root, "src/settings.css")), false);
});

test("sandbox state is explicit and documented", () => {
  const main = read("electron/main.cjs");
  const doc = read("docs/architecture/electron-sandbox.md");
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /sandbox:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(doc, /compatibility checkpoint/i);
  assert.match(doc, /sandbox-enabled canary build/i);
});

test("hardening scripts and Windows smoke workflow are present", () => {
  assert.ok(fs.existsSync(path.join(root, "scripts/check-performance-budgets.mjs")));
  assert.ok(fs.existsSync(path.join(root, "scripts/test-database-recovery.cjs")));
  assert.ok(fs.existsSync(path.join(root, ".github/workflows/windows-smoke.yml")));
});
