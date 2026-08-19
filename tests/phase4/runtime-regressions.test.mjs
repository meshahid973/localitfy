import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("MainModeApp render guards happen after hook calls", () => {
  const source = read("src/App.tsx");
  const start = source.indexOf("function MainModeApp()");
  const end = source.indexOf("export default function App()", start);
  assert.ok(start >= 0 && end > start, "MainModeApp bounds were not found");

  const body = source.slice(start, end);
  const bootReturn = body.lastIndexOf("if (!ready)");
  const onboardingReturn = body.lastIndexOf("if (onboardingOpen || onboardingDevPreview)");
  assert.ok(bootReturn >= 0, "boot render guard was not found");
  assert.ok(onboardingReturn >= 0, "onboarding render guard was not found");

  const hookCall = /\buse[A-Z][A-Za-z0-9_]*\s*\(/g;
  let lastHook = -1;
  for (const match of body.matchAll(hookCall)) lastHook = match.index ?? lastHook;

  assert.ok(lastHook >= 0, "no hook calls found in MainModeApp");
  assert.ok(
    bootReturn > lastHook,
    "boot rendering returned before all hooks, which violates React hook ordering"
  );
  assert.ok(
    onboardingReturn > lastHook,
    "onboarding returned before all hooks, which violates React hook ordering"
  );
});

test("database recovery uses Electron's native-module ABI", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.match(packageJson.scripts["db:recovery-test"], /run-electron-node\.cjs/);
  const launcher = read("scripts/run-electron-node.cjs");
  assert.match(launcher, /ELECTRON_RUN_AS_NODE/);
  assert.match(launcher, /require\("electron"\)/);
});

test("Vite config is explicitly ESM", () => {
  assert.equal(fs.existsSync(path.join(root, "vite.config.ts")), false);
  assert.equal(fs.existsSync(path.join(root, "vite.config.mts")), true);
});
