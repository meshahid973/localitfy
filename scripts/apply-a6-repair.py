from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8-sig")


def write(relative, content):
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(source, old, new, label):
    if old not in source:
        raise RuntimeError(f"missing expected source for {label}")
    return source.replace(old, new, 1)


def sub_once(source, pattern, replacement, label):
    compiled = re.compile(pattern, re.S)
    if not compiled.search(source):
        raise RuntimeError(f"missing expected source for {label}")
    return compiled.sub(lambda _m: replacement, source, count=1)


main = read("electron/main.cjs")
main = replace_once(
    main,
    'const { createIconRuntime } = require("./runtime/icons.cjs");\n',
    'const { createIconRuntime } = require("./runtime/icons.cjs");\nconst { createUpdaterRuntime } = require("./runtime/updater.cjs");\n',
    "updater runtime import",
)

main = replace_once(
    main,
    '''let updaterReady = false;
let updaterChecking = false;
let updaterSilent = true;
let updateDownloaded = false;
let lastUpdateInfo = null;

let tray = null;''',
    '''const updaterRuntime = createUpdaterRuntime({
  app,
  autoUpdater,
  shell,
  https,
  isDev,
  appName: APP_NAME,
  getMainWindow: () => mainWindow
});
const checkForUpdates = updaterRuntime.checkForUpdates;
const downloadUpdate = updaterRuntime.downloadUpdate;
const installUpdate = updaterRuntime.installUpdate;

let tray = null;''',
    "updater state ownership",
)

main = sub_once(
    main,
    r'''function safeUpdateInfo\(info\) \{.*?\n\}\n\nfunction appendChromiumSwitchOnce\(name, value\) \{''',
    '''function appendChromiumSwitchOnce(name, value) {''',
    "legacy updater implementation block",
)

if "sendLinuxManualUpdateOnlyEvent" in main:
    raise RuntimeError("stale Linux updater typo remains in main")
if "function setupAutoUpdater" in main or "function safeUpdateInfo" in main:
    raise RuntimeError("updater implementation residue remains in main")
write("electron/main.cjs", main)

perf = read("scripts/check-performance-budgets.mjs")
perf = replace_once(perf, '["electron/main.cjs", 204 * KiB]', '["electron/main.cjs", 192 * KiB]', "Electron main size budget")
write("scripts/check-performance-budgets.mjs", perf)

write("tests/phase3/updater-runtime.test.mjs", r'''import assert from "node:assert/strict";
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
''')

print("A6 updater extraction applied")
