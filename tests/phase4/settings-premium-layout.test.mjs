import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");
const view = read("src/features/settings/SettingsView.tsx");
const rail = read("src/features/settings/SettingsRail.tsx");
const skin = read("src/features/settings/settings-premium.css");
const sections = read("src/features/settings/SettingsCategoryContent.tsx");

test("Settings keeps the existing category rendering and reduced-motion support", () => {
  assert.match(view, /data-page-section="settings"/);
  assert.match(view, /<SettingsRail \{\.\.\.settingsRail\} \/>/);
  assert.match(view, /renderSettingsCategoryContent\(\)/);
  assert.match(view, /settings\.reducedMotion/);
  assert.match(view, /import "\.\/settings\.css";/);
  assert.match(view, /import "\.\/settings-premium\.css";/);
  for (const section of ["appearance", "playback", "discord", "library", "covers", "downloads", "updates", "about", "experimental", "advanced"]) {
    assert.ok(sections.includes('case "' + section + '":'), "Missing Settings category: " + section);
  }
});

test("Compact navigation keeps search, category controls, and keyboard semantics", () => {
  assert.match(rail, /aria-label="Settings navigation"/);
  assert.match(rail, /aria-label="Settings sections"/);
  assert.match(rail, /onSearchChange\(event\.currentTarget\.value\)/);
  assert.match(rail, /onSearchChange\(""\)/);
  assert.match(rail, /onCategoryChange\(tab\.id\)/);
  assert.match(rail, /aria-current=\{selected \? "page" : undefined\}/);
  assert.match(rail, /No matching section/);
});

test("Compact styles cover inputs, focus indicators, and narrower viewports without hiding functionality", () => {
  assert.match(skin, /\.settingsPage\.settingsPageV027 \.settingsLayout/);
  assert.match(skin, /\.toggleRow input\[type="checkbox"\]:checked/);
  assert.match(skin, /\.rangeRow input\[type="range"\]/);
  assert.match(skin, /:focus-visible/);
  assert.match(skin, /@media \(max-width: 900px\)/);
  assert.match(skin, /@media \(max-width: 480px\)/);
  assert.match(skin, /settingsAppearanceTopGrid/);
  assert.match(skin, /settingsDisclosure/);
  assert.match(skin, /prefers-reduced-motion: reduce/);
  assert.equal((skin.match(/!important/g) || []).length, 2, "Only the two scoped shell overrides may use !important");
});

test("Appearance keeps presets, local color editing and sidebar tools behind compact sections", () => {
  const appearance = read("src/features/settings/categories/AppearanceSettings.tsx");
  assert.match(appearance, /settingsAppearanceTopGrid/);
  assert.match(appearance, /settingsPaletteEditor/);
  assert.match(appearance, /customThemeTokens\.map\(/);
  assert.match(appearance, /<SidebarTabsSettings /);
  assert.match(appearance, /settingsSidebarDisclosure/);
});

test("Home, Library/Liked and shell use active theme tokens", () => {
  const home = read("src/features/home/home.css");
  const library = read("src/features/library/library.css");
  const shell = read("src/styles/view-shell.css");
  for (const source of [home, library, shell]) {
    assert.match(source, /var\(--lt-bg\)/);
    assert.match(source, /var\(--lt-accent\)/);
    assert.doesNotMatch(source, /#06131a|#79a7c4/);
  }
});

test("User feedback remains available manually without automatic nag prompts", () => {
  const app = read("src/App.tsx");
  const toast = read("src/features/shell/useAppToast.ts");
  assert.doesNotMatch(app, /FEEDBACK_PROMPT_DELAY_MS|feedbackPromptBlockersRef/);
  assert.match(app, /localtify:open-feedback/);
  assert.match(toast, /kind !== "error"/);
});
