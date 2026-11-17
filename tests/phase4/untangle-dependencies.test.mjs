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
  return { ...theme, accentTextColor: utilities.accentTextColor };
}

test("theme preset builder stays separate from localStorage and the public settings barrel preserves exports", () => {
  const style = read("src/features/settings/themePresetStyle.ts");
  const migration = read("src/features/settings/customThemePersistence.ts");
  const barrel = read("src/features/settings/index.ts");
  assert.doesNotMatch(style, /localStorage|useState|useEffect|readLocalJson|writeLocalJson/);
  assert.doesNotMatch(migration, /makeThemePresetStyle|THEME_PRESET_COLORS/);
  assert.match(migration, /nextSettings.customThemeEnabled = false/);
  assert.match(barrel, /export \* from "\.\/themePresetStyle"/);
  assert.doesNotMatch(barrel, /export \* from "\.\/(?:customTheme|theme\.visuals)"/);
});

test("the two palettes share semantic tokens and migrate retired IDs", () => {
  const theme = loadThemePresetStyle();
  const plain = id => JSON.parse(JSON.stringify(theme.makeThemePresetStyle(id)));
  assert.deepEqual(Object.keys(theme.THEME_PRESET_COLORS).sort(), ["dark", "light"]);
  const dark = plain("dark"), light = plain("light");
  assert.equal(dark["--bg"], "#000000");
  assert.equal(dark["--accent"], "#7696ff");
  assert.equal(light["--bg"], "#f5f5f7");
  assert.equal(light["--accent"], "#3659c5");
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(light).sort());
  for (const id of ["mint", "stars", "berry", "oled", "custom", "invalid-theme", undefined]) assert.deepEqual(plain(id), dark);
  assert.deepEqual(plain("mono"), light);
  for (const id of ["dark", "light"]) {
    const palette = theme.THEME_PRESET_COLORS[id], tokens = plain(id);
    assert.equal(tokens["--accent"], palette.accent);
    assert.equal(tokens["--progress"], palette.progress ?? palette.accent);
    assert.equal(tokens["--theme-highlight"], palette.highlight);
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

test("accent labels meet WCAG AA for presets and a custom RGB color grid", () => {
  const theme = loadThemePresetStyle();
  const luminance = (hex) => {
    const channels = hex.match(/[a-f0-9]{2}/gi).map(v => parseInt(v, 16) / 255);
    const rgb = channels.map(c => c < .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return rgb.reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  };
  const assertContrast = (background, foreground) => {
    const values = [luminance(background), luminance(foreground)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${background} / ${foreground}`);
  };
  for (const id of Object.keys(theme.THEME_PRESET_COLORS)) {
    const tokens = theme.makeThemePresetStyle(id);
    assertContrast(tokens["--accent"], tokens["--button-text-on-accent"]);
  }
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const color = "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");
    assertContrast(color, theme.accentTextColor(color));
  }
  assert.equal(theme.accentTextColor("#000"), "#ffffff");
  assert.equal(theme.accentTextColor("#fff"), "#000000");
  assert.equal(theme.accentTextColor("invalid"), theme.accentTextColor("#8dffce"));
});
