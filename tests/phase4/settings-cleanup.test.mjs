import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const app = fs.readFileSync("src/App.tsx", "utf8");
const shell = fs.readFileSync("src/features/shell/AppShell.tsx", "utf8");
const styles = fs.readFileSync("src/features/settings/settings.css", "utf8");
const rail = fs.readFileSync("src/features/settings/SettingsRail.tsx", "utf8");
const appearance = fs.readFileSync("src/features/settings/categories/AppearanceSettings.tsx", "utf8");

test("remove dead modal state without global modal CSS", () => {
  assert.doesNotMatch(app, /\bsettingsOpen\b|\bsetSettingsOpen\b/);
  assert.doesNotMatch(shell, /SettingsModal/);
  assert.doesNotMatch(styles, /\.modalWrap|\.modalHead|\.closeModalButton/);
});
test("settings nav uses accessible React inputs", () => {
  assert.match(rail, /<nav aria-label="Settings sections">/);
  assert.match(rail, /aria-current=\{selected \? "page" : undefined\}/);
  assert.match(rail, /value=\{search\}/);
  assert.doesNotMatch(appearance, /swatch\.style\.background/);
});
test("search finds the requested settings section", () => {
  const src = fs.readFileSync("src/features/settings/settings.search.ts", "utf8");
  const compiled = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const tabs = [
    { id:"appearance", label:"Appearance", description:"Theme", keywords:"colors accent" },
    { id:"playback", label:"Playback", description:"Audio", keywords:"volume crossfade" },
    { id:"discord", label:"Discord", description:"Presence", keywords:"privacy artwork" },
    { id:"covers", label:"Covers", description:"Cover art", keywords:"cover images" },
    { id:"advanced", label:"Advanced", description:"Maintenance", keywords:"diagnostics repair" }
  ];
  const exports = {};
  runInNewContext(compiled, { exports, require: () => ({ settingsCategoryTabs: tabs }) });
  assert.equal(exports.resolveSettingsCategoryFromSearch("cover"), "covers");
  assert.equal(exports.resolveSettingsCategoryFromSearch(" THEME "), "appearance");
  assert.equal(exports.resolveSettingsCategoryFromSearch("volume"), "playback");
  assert.equal(exports.resolveSettingsCategoryFromSearch("diagnostics"), "advanced");
  assert.equal(exports.resolveSettingsCategoryFromSearch("nonsense"), null);
});
