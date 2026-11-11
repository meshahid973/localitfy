import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");

test("shared empty/error cards use theme surfaces rather than hard-coded dark paint", () => {
  const css = read("src/shared/ui/view-ui.css");
  assert.match(css, /background:\s*linear-gradient\([\s\S]*?\),\s*var\(--lt-surface\)/);
  assert.match(css, /--state-rgb: 255, 88, 116/);
  assert.match(css, /--state-rgb: 67, 234, 139/);
  assert.doesNotMatch(css, /rgba\(8,\s*8,\s*13/);
  assert.doesNotMatch(css, /backdrop-filter/);
});

test("media play overlay remains visible on touch and focusable on keyboard", () => {
  const css = read("src/shared/ui/media-card.css");
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\)/);
  assert.match(css, /\.mediaCardPlay:focus-visible/);
  assert.match(css, /color: var\(--accent-contrast, var\(--lt-bg\)\)/);
});

test("page search, settings controls and sidebar use the shared token and icon system", () => {
  const page = read("src/shared/ui/page-header.css");
  const settings = read("src/features/settings/settings-premium.css");
  const sidebar = read("src/features/shell/SidebarNav.tsx");
  assert.match(page, /\.pageHeaderSearch:focus-visible/);
  assert.match(page, /outline: 2px solid var\(--lt-accent\)/);
  assert.doesNotMatch(settings.slice(settings.indexOf(".settingsPage.settingsPageV027 {"),settings.indexOf("}",settings.indexOf(".settingsPage.settingsPageV027 {"))), /--settings-text:/);
  assert.match(sidebar, /className="navLucideIcon" size=\{20\} strokeWidth=\{2\}/);
});
