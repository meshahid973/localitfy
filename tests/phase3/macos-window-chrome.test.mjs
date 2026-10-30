import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const mainSource = read("electron/main.cjs");
const shellSource = read("src/features/shell/AppShell.tsx");
const titleBarSource = read("src/features/shell/TitleBar.tsx");
const shellCss = read("src/features/shell/app-core.css");

test("macOS uses native inset window chrome while other platforms keep custom chrome", () => {
  assert.match(
    mainSource,
    /const windowChromeOptions = process\.platform === "darwin"\s*\? \{ titleBarStyle: "hiddenInset" \}\s*:\s*\{ frame: false, titleBarStyle: "hidden" \};/
  );
  assert.match(mainSource, /\.\.\.windowChromeOptions/);
});

test("macOS does not duplicate the native traffic lights in the renderer", () => {
  assert.match(shellSource, /<TitleBar showWindowButtons=\{platformId !== "mac"\} history=/);
  assert.match(titleBarSource, /showWindowButtons = true/);
  assert.match(titleBarSource, /\{showWindowButtons \? <div className="windowButtons">/);
  assert.match(shellCss, /\.app\[data-platform="mac"\] \.titleDrag\s*\{[^}]*padding-left: 78px;/s);
  assert.match(shellCss, /\.app\[data-platform="mac"\] \.appShell\s*\{[^}]*height: calc\(100vh - 38px\);/s);
});

test("macOS leaves media keys to Chromium Media Session", () => {
  const mediaKeyRegistration = mainSource.match(
    /function registerNativeMediaKeys\(\) \{[\s\S]*?\n\}/
  )?.[0] || "";
  assert.match(mediaKeyRegistration, /nativeShortcutsRegistered = true;/);
  assert.match(mediaKeyRegistration, /if \(process\.platform === "darwin"\) return;/);
  assert.match(mediaKeyRegistration, /globalShortcut\.register/);
  assert.ok(
    mediaKeyRegistration.indexOf('process.platform === "darwin"') < mediaKeyRegistration.indexOf("globalShortcut.register"),
    "the macOS guard must run before global shortcut registration"
  );
});
