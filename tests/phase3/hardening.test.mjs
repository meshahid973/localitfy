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
    "./features/shell/motion.css",
    "./features/onboarding/onboarding.css",
    "./features/player/player.css",
    "./features/shell/effects.css"
  ]) assert.ok(app.includes(owned), `missing owned style import: ${owned}`);
  for (const obsolete of [
    "src/player.css",
    "src/settings.css",
    "src/motion.css",
    "src/onboarding-first-run.css"
  ]) assert.equal(fs.existsSync(path.join(root, obsolete)), false, `obsolete style path still exists: ${obsolete}`);
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

test("hardening stays enforced locally and in CI", () => {
  assert.ok(fs.existsSync(path.join(root, "scripts/check-performance-budgets.mjs")));
  assert.ok(fs.existsSync(path.join(root, "scripts/test-database-recovery.cjs")));
  assert.ok(fs.existsSync(path.join(root, "scripts/css-hygiene.mjs")));

  const workflowPath = path.join(root, ".github", "workflows", "quality.yml");
  assert.equal(fs.existsSync(workflowPath), true, "quality workflow must stay present");
  const workflow = fs.readFileSync(workflowPath, "utf8");
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /npm run release:check/);
  assert.match(workflow, /electron-ready/);
});
