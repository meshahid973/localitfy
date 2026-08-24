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

test("main renderer sandbox is enabled and documented", () => {
  const main = read("electron/main.cjs");
  const doc = read("docs/architecture/electron-sandbox.md");
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /sandbox:\s*true/);
  assert.doesNotMatch(main, /sandbox:\s*false/);
  assert.match(main, /webviewTag:\s*false/);
  assert.match(main, /allowRunningInsecureContent:\s*false/);
  assert.match(main, /navigateOnDragDrop:\s*false/);
  assert.match(main, /isTrustedMainFrameIpcEvent/);
  assert.match(main, /rendererFileRoot/);
  assert.match(main, /installRendererSecurityGuards/);
  assert.match(main, /createIconRuntime/);
  assert.match(main, /createWindowTranslucencyRuntime/);
  assert.match(doc, /sandbox enabled/i);
  assert.match(doc, /trusted sender/i);
  assert.match(doc, /main frame/i);
});

test("hardening is owned by local scripts and workflows stay removed", () => {
  assert.ok(fs.existsSync(path.join(root, "scripts/check-performance-budgets.mjs")));
  assert.ok(fs.existsSync(path.join(root, "scripts/test-database-recovery.cjs")));
  assert.equal(fs.existsSync(path.join(root, ".github/workflows")), false);
});
