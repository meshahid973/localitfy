import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const owners = [
  ["./shared/ui/view-ui.css", "src/shared/ui/view-ui.css", ".localtifyStateCardV373", "LocaltifyStateCard"],
  ["./features/library/library.css", "src/features/library/library.css", ".libraryPanelV025", "Library/Liked"],
  ["./features/albums/albums.css", "src/features/albums/albums.css", ".albumsPageV318", "Albums"],
  ["./features/playlists/playlists.css", "src/features/playlists/playlists.css", ".playlistsPage", "Playlists"],
  ["./features/covers/covers.css", "src/features/covers/covers.css", ".coverStudioLayout", "Covers"],
  ["./features/downloads/downloads.css", "src/features/downloads/downloads.css", ".downloadsLayoutV031", "Downloads"],
  ["./features/analytics/analytics.css", "src/features/analytics/analytics.css", ".analyticsStudioV339", "Analytics"]
];

test("renderer explicitly imports every feature-owned stylesheet", () => {
  const main = read("src/main.tsx");

  for (const [specifier, , , label] of owners) {
    assert.match(main, new RegExp(`import\\s+["']${specifier.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}["']`), `${label} stylesheet is missing from the renderer style manifest`);
  }

  const cssImports = [...main.matchAll(/^\s*import\s+["']([^"']+\.css)["'];?\s*$/gm)].map((match) => match[1]);
  assert.equal(cssImports.at(-1), "./features/shell/performance.css", "performance.css must remain the final renderer stylesheet");
});

test("critical view selectors cannot be deleted by CSS cleanup", () => {
  for (const [, file, selector, label] of owners) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${label} stylesheet was deleted`);
    const css = read(file);
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")), `${label} lost its root selector ${selector}`);
    assert.ok(Buffer.byteLength(css) > 400, `${label} stylesheet is suspiciously empty`);
  }
});

test("repaired views keep feature CSS out of the Home owner", () => {
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
    assert.equal(home.includes(selector), false, `${selector} must not drift back into home.css`);
  }
});
