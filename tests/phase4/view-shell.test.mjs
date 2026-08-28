import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const nonHomeViews = ["library", "liked", "albums", "playlists", "covers", "analytics", "downloads", "settings"];

test("non-Home pages share one viewport/header policy", () => {
  const main = read("src/main.tsx");
  const css = read("src/styles/view-shell.css");

  assert.equal(main.includes('import "./styles/view-shell.css";'), true, "shared view shell is not loaded");
  assert.ok(main.indexOf('import "./styles/view-shell.css";') < main.indexOf('import "./features/shell/performance.css";'), "view shell must load before performance policy");
  assert.equal(css.includes(".pageTransition-home"), false, "shared non-Home shell must not style Home");

  for (const view of nonHomeViews) {
    assert.equal(css.includes(`.pageTransition-${view}`), true, `${view} is missing from shared page shell`);
  }
});

test("shared page shell does not steal feature component ownership", () => {
  const css = read("src/styles/view-shell.css");
  const forbiddenFeatureSelectors = [
    ".libraryPanelV025",
    ".albumsPageV318",
    ".albumCardV318",
    ".playlistsPage",
    ".playlistTrackRow",
    ".coverStudioLayout",
    ".coverGalleryCardCleanOnly",
    ".downloadsLayoutV031",
    ".spotifyTrackItemV326",
    ".analyticsStudioV339",
    ".analyticsRecapCardV339",
    ".settingsPageV027"
  ];

  for (const selector of forbiddenFeatureSelectors) {
    assert.equal(css.includes(selector), false, `shared view shell must not own ${selector}`);
  }

  assert.ok(Buffer.byteLength(css) < 16 * 1024, "shared page shell exceeded its 16 KiB budget");
});
