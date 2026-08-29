import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const retiredPageStyles = [
  "src/features/library/library.css",
  "src/features/albums/albums.css",
  "src/features/playlists/playlists.css",
  "src/features/covers/covers.css",
  "src/features/downloads/downloads.css",
  "src/features/analytics/analytics.css"
];

const resetPageRoots = [
  ".libraryPanelV025",
  ".albumsPageV318",
  ".playlistsPage",
  ".coverStudioLayout",
  ".downloadsLayoutV031",
  ".analyticsStudioV339"
];

test("retired page design files stay deleted until their rebuild", () => {
  const main = read("src/main.tsx");

  for (const relativePath of retiredPageStyles) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} returned before its redesign`);
    assert.equal(main.includes(relativePath.replace(/^src\//, "./")), false, `${relativePath} returned to the renderer manifest`);
  }
});

test("global visual owners cannot reclaim reset page roots", () => {
  for (const relativePath of [
    "src/App.css",
    "src/features/shell/app-core.css",
    "src/features/shell/effects.css",
    "src/features/settings/themes.css"
  ]) {
    const source = read(relativePath);
    for (const selector of resetPageRoots) {
      assert.equal(source.includes(selector), false, `${relativePath} illegally owns ${selector}`);
    }
  }
});

test("temporary page foundation stays structural and small", () => {
  const relativePath = "src/styles/page-foundation.css";
  const source = read(relativePath);

  for (const selector of resetPageRoots) {
    assert.equal(source.includes(selector), true, `structural foundation lost ${selector}`);
  }

  for (const visualToken of ["linear-gradient(", "radial-gradient("]) {
    assert.equal(source.includes(visualToken), false, `structural foundation gained visual styling: ${visualToken}`);
  }

  assert.ok(Buffer.byteLength(source) < 8 * 1024, "page foundation exceeded its 8 KiB structural budget");
});
