import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const read = (file) => fs.readFileSync(file, "utf8");
const transpile = (file) => ts.transpileModule(read(file), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function loadThemeUtilities() {
  const exports = {};
  runInNewContext(transpile("src/features/settings/theme.utils.ts"), {
    exports,
    require(specifier) {
      if (specifier === "./settings.constants") return { coverColorSyncOptions: [] };
      throw new Error("Unexpected utility import: " + specifier);
    }
  });
  return exports;
}

function palette(id) {
  const css = read("src/styles/themes.css");
  const block = css.split('.app[data-theme="' + id + '"] {')[1].split("}")[0];
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
}

test("fixed palettes share semantic tokens and retired IDs normalize safely", () => {
  const dark = palette("dark"), light = palette("light");
  assert.equal(dark["--bg"], "#000000");
  assert.equal(dark["--accent"], "#ffffff");
  assert.equal(light["--bg"], "#f5f5f7");
  assert.equal(light["--accent"], "#18181b");
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(light).sort());
  const {normalizeThemeId} = loadThemeUtilities();
  for (const id of ["mint", "stars", "berry", "oled", "custom", "invalid-theme", undefined]) assert.equal(normalizeThemeId(id), "dark");
  assert.equal(normalizeThemeId("mono"), "light");
  assert.match(read("src/styles/themes.css"), /--progress: var\(--accent\)/);
  assert.match(read("src/styles/themes.css"), /--theme-highlight: var\(--highlight\)/);
  assert.doesNotMatch(read("src/features/settings/index.ts"), /themePresetStyle|customThemePersistence/);
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
  assert.match(app, /from "\.\/features\/downloads\/useDownloadsRuntime"/);
  assert.doesNotMatch(app, /from "\.\/features\/downloads\/downloadProcessing"/);
  assert.match(benchmark, /downloadProcessing\.ts/);
  assert.match(tests, /downloadProcessing\.ts/);
  assert.doesNotMatch(benchmark, /if \(name === "react"\)/);
  assert.doesNotMatch(tests, /if \(name === "react"\)/);
});

test("accent labels meet WCAG AA for presets and a custom RGB color grid", () => {
  const theme = loadThemeUtilities();
  const luminance = (hex) => {
    const channels = hex.match(/[a-f0-9]{2}/gi).map(v => parseInt(v, 16) / 255);
    const rgb = channels.map(c => c < .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return rgb.reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  };
  const assertContrast = (background, foreground) => {
    const values = [luminance(background), luminance(foreground)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${background} / ${foreground}`);
  };
  for (const id of ["dark", "light"]) {
    const tokens = palette(id);
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
