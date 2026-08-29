import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const resetPageSelectors = [".albumsPageV318", ".playlistsPage", ".coverStudioLayout", ".downloadsLayoutV031", ".analyticsStudioV339", ".settingsPageV027"];

test("shared shell owns viewport and responsive sidebar behavior only", () => {
  const main = read("src/main.tsx");
  const shell = read("src/features/shell/AppShell.tsx");
  const css = read("src/styles/view-shell.css");

  assert.equal(shell.includes('import "../../styles/view-shell.css";'), true, "AppShell does not own shared shell CSS");
  assert.equal(main.includes('import "./styles/view-shell.css";'), false, "view-shell CSS should not be centrally owned by main");
  assert.equal(main.includes('import "./styles/page-foundation.css";'), true, "page foundation is not loaded globally");
  assert.equal(main.includes('import "./features/shell/performance.css";'), true, "performance policy is not loaded globally");
  assert.equal(css.includes(".pageTransition-home"), true, "shared shell lost its Home exclusion boundary");

  for (const marker of [
    "--workspace-sidebar-expanded",
    "--workspace-sidebar-current",
    "--workspace-sidebar-rail: 68px",
    "grid-template-columns: var(--workspace-sidebar-current)",
    '[data-sidebar-behavior="slim"]',
    '[data-sidebar-behavior="hover"]',
    ":focus-within",
    'content: "LOCALTIFY"'
  ]) {
    assert.equal(css.includes(marker), true, "sidebar behavior guard is missing " + marker);
  }

  assert.equal(css.includes("--workspace-max"), false, "retired centered workspace cap returned");
});

test("shared shell no longer owns feature page designs", () => {
  const css = read("src/styles/view-shell.css");
  for (const selector of resetPageSelectors) assert.equal(css.includes(selector), false, "shared shell still styles reset page selector " + selector);
  assert.equal(css.includes(".libraryPage"), false, "Library design leaked into the shell owner");
  assert.ok(Buffer.byteLength(css.replace(/\r\n/g, "\n")) < 20 * 1024, "shared shell exceeded its 20 KiB budget");
});
