import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const retiredPageStyles = [
  "src/features/library/library.css",
  "src/features/albums/albums.css",
  "src/features/playlists/playlists.css",
  "src/features/covers/covers.css",
  "src/features/downloads/downloads.css",
  "src/features/analytics/analytics.css"
];

test("renderer style manifest is intentionally small during page rebuild", () => {
  const main = read("src/main.tsx");
  const cssImports = [...main.matchAll(/^\s*import\s+["']([^"']+\.css)["'];?\s*$/gm)].map((match) => match[1]);

  for (const specifier of [
    "./shared/ui/view-ui.css",
    "./styles/page-foundation.css",
    "./styles/view-shell.css",
    "./features/shell/performance.css"
  ]) {
    assert.equal(cssImports.includes(specifier), true, `${specifier} is missing from the renderer manifest`);
  }

  assert.equal(cssImports.at(-1), "./features/shell/performance.css", "performance.css must remain the final renderer stylesheet");
});

test("retired page designs cannot silently return", () => {
  const main = read("src/main.tsx");

  for (const file of retiredPageStyles) {
    assert.equal(fs.existsSync(path.join(root, file)), false, `${file} returned before its redesign`);
    assert.equal(main.includes(file.replace(/^src\//, "./")), false, `${file} returned to the renderer manifest`);
  }
});

test("Home remains isolated from future page redesigns", () => {
  const home = read("src/features/home/home.css");
  const forbidden = [
    ".libraryPanelV025",
    ".albumsPageV318",
    ".playlistsPage",
    ".coverStudioLayout",
    ".downloadsLayoutV031",
    ".analyticsStudioV339",
    ".localtifyStateCardV373"
  ];

  for (const selector of forbidden) {
    assert.equal(home.includes(selector), false, `${selector} must not drift into home.css`);
  }
});
