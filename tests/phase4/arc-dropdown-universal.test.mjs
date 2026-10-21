import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("all user-facing selects use the Arc menu", () => {
  for (const file of ["src/features/library/LibraryView.tsx", "src/features/albums/AlbumsView.tsx",
    "src/features/settings/categories/AppearanceSettings.tsx", "src/features/settings/categories/PlaybackSettings.tsx"]) {
    const src = read(file);
    assert.match(src, /<ArcDropdownMenu\b/, file);
    assert.doesNotMatch(src, /<select\b/i, file);
    assert.doesNotMatch(src, /<option\b/i, file);
  }
  assert.match(read("src/features/albums/AlbumsView.tsx"), /onValueChange=\{setAlbumSortMode\}/);
  assert.match(read("src/features/settings/categories/AppearanceSettings.tsx"), /disabled=\{settings\.customThemeEnabled\}/);
  assert.match(read("src/features/settings/categories/PlaybackSettings.tsx"), /updateSetting\("audioEffectMode", effect\)/);
});

test("Arc dropdown respects disabled settings and long option lists", () => {
  const ui = read("src/shared/ui/ArcDropdownMenu.tsx");
  const css = read("src/shared/ui/ArcDropdownMenu.css");
  assert.match(ui, /disabled\?: boolean/);
  assert.match(ui, /disabled=\{disabled\}/);
  assert.match(ui, /if \(disabled \|\| firstEnabled < 0\)/);
  assert.match(ui, /Math\.min\(items\.length \* ITEM_HEIGHT/);
  assert.match(css, /max-height: calc\(100vh - 24px\)/);
  assert.match(css, /\.settingsPage \.settingsSelectField \.arcDropdownTrigger/);
  assert.match(ui, /"ArrowDown"/);
  assert.match(ui, /"Escape"/);
});
