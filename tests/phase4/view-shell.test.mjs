import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const pageRoots = [
  ".libraryPanelV025",
  ".albumsPageV318",
  ".playlistsPage",
  ".coverStudioLayout",
  ".downloadsLayoutV031",
  ".analyticsStudioV339",
  ".settingsPageV027"
];

test("all pages share one responsive workspace and sidebar", () => {
  const main = read("src/main.tsx");
  const css = read("src/styles/view-shell.css");

  assert.equal(main.includes('import "./styles/view-shell.css";'), true, "shared workspace is not loaded");
  assert.ok(main.indexOf('import "./styles/view-shell.css";') < main.indexOf('import "./features/shell/performance.css";'), "workspace must load before performance policy");

  for (const marker of [
    ".appShell",
    ".sidebar",
    ".navItem",
    "--workspace-max: 1560px",
    "grid-template-columns: clamp(218px",
    ".pageTransition:not(.pageTransition-home)"
  ]) {
    assert.equal(css.includes(marker), true, `shared workspace lost ${marker}`);
  }

  for (const pageRoot of pageRoots) {
    assert.equal(css.includes(pageRoot), true, `${pageRoot} is not normalized by the shared workspace`);
  }
});

test("Home keeps its content ownership while the workspace owns cross-page chrome", () => {
  const home = read("src/features/home/home.css");
  const css = read("src/styles/view-shell.css");

  assert.equal(home.includes(".sidebar"), false, "Home must not create a second sidebar design");
  assert.equal(home.includes("--sidebar-width:"), false, "Home must not force a different sidebar width");
  assert.equal(css.includes(".pageTransition-home .homeJumpBack"), false, "workspace must not own Home feature internals");
  assert.ok(Buffer.byteLength(css) < 36 * 1024, "shared workspace exceeded its 36 KiB ownership budget");
});
