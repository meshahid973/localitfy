import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const read = (file) => fs.readFileSync(file, "utf8");
const transpile = (file) => ts.transpileModule(read(file), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function loadThemePresetStyle() {
  const utilities = {};
  runInNewContext(transpile("src/features/settings/theme.utils.ts"), {
    exports: utilities,
    require(specifier) {
      if (specifier === "./settings.constants") return { coverColorSyncOptions: [] };
      if (specifier === "./theme.constants") return { RETIRED_ANIMATED_THEME_IDS: new Set(), THEME_ID_SET: new Set() };
      throw new Error("Unexpected utility import: " + specifier);
    }
  });
  const theme = {};
  runInNewContext(transpile("src/features/settings/themePresetStyle.ts"), {
    exports: theme,
    require(specifier) {
      if (specifier === "./theme.utils") return utilities;
      throw new Error("Pure preset code must not import persistence or runtime modules: " + specifier);
    }
  });
  return theme;
}

test("theme preset builder stays separate from localStorage and the public settings barrel preserves exports", () => {
  const style = read("src/features/settings/themePresetStyle.ts");
  const storage = read("src/features/settings/customTheme.ts");
  const barrel = read("src/features/settings/index.ts");
  assert.doesNotMatch(style, /localStorage|useState|useEffect|readLocalJson|writeLocalJson/);
  assert.doesNotMatch(storage, /makeThemePresetStyle|THEME_PRESET_COLORS/);
  assert.match(storage, /readSavedCustomThemePresets/);
  assert.match(barrel, /export \* from "\.\/themePresetStyle"/);
  assert.match(barrel, /export \* from "\.\/customTheme"/);
});

test("all 38 existing preset palettes emit stable CSS token values", () => {
  const theme = loadThemePresetStyle();
  const palettes = JSON.parse(JSON.stringify(theme.THEME_PRESET_COLORS));
  assert.equal(Object.keys(palettes).length, 38);
  const mint = JSON.parse(JSON.stringify(theme.makeThemePresetStyle("mint")));
  const mono = JSON.parse(JSON.stringify(theme.makeThemePresetStyle("mono")));
  const stars = JSON.parse(JSON.stringify(theme.makeThemePresetStyle("stars")));
  assert.equal(Object.keys(mint).length, 37);
  assert.equal(mint["--bg"], "#020706");
  assert.equal(mint["--accent"], "#8dffce");
  assert.equal(mint["--accent-rgb"], "141, 255, 206");
  assert.equal(mint["--accent-soft"], "rgba(141, 255, 206, 0.14)");
  assert.equal(mint["--theme-card-glass"], "rgba(141, 255, 206, 0.045)");
  assert.equal(mono["--bg"], "#030303");
  assert.equal(mono["--accent"], "#f4f4f5");
  assert.equal(stars["--bg"], "#050610");
  assert.equal(stars["--accent"], "#d7d5ff");
  assert.deepEqual(JSON.parse(JSON.stringify(theme.makeThemePresetStyle("invalid-theme"))), mint);
  for (const id of Object.keys(palettes)) {
    const tokens = JSON.parse(JSON.stringify(theme.makeThemePresetStyle(id)));
    assert.equal(Object.keys(tokens).length, 37, id);
    assert.equal(tokens["--accent"], palettes[id].accent, id);
    assert.equal(tokens["--progress"], palettes[id].progress ?? palettes[id].accent, id);
    assert.equal(tokens["--theme-highlight"], palettes[id].highlight, id);
  }
});

test("download processing stays React-independent while keeping all established entrypoints", () => {
  const helper = read("src/features/downloads/downloadProcessing.ts");
  const runtime = read("src/features/downloads/useDownloadsRuntime.ts");
  const app = read("src/App.tsx");
  const benchmark = read("scripts/benchmark-download-matches.mjs");
  const tests = read("tests/phase4/download-match-hotpath.test.mjs");
  assert.doesNotMatch(helper, /from ["']react["']|useEffect\(|useState\(/);
  for (const symbol of [
    "parseDownloadUrls", "makeQueuedDownloads", "friendlyDownloadError",
    "buildDownloadSongLookup", "findDownloadedSongMatch",
    "enrichDownloadResultsWithLibraryMatches", "formatSpotifyPrivatePlaylistMessage"
  ]) {
    assert.ok(helper.includes("export function " + symbol), symbol);
    assert.ok(!runtime.includes("export function " + symbol), symbol + " is still owned by the hook");
  }
  assert.match(runtime, /from "\.\/downloadProcessing"/);
  assert.match(app, /from "\.\/features\/downloads\/downloadProcessing"/);
  assert.match(benchmark, /downloadProcessing\.ts/);
  assert.match(tests, /downloadProcessing\.ts/);
  assert.doesNotMatch(benchmark, /if \(name === "react"\)/);
  assert.doesNotMatch(tests, /if \(name === "react"\)/);
});
