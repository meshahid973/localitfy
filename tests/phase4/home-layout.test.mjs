import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Home keeps the reference music hierarchy without renderer hacks", () => {
  const source = read("src/features/home/HomeView.tsx");

  for (const marker of [
    "JUMP BACK IN",
    "Listen now",
    "Most listened",
    "New Releases",
    "homeListenGrid",
    "homeArtistRail",
    "homeReleaseRail",
    "Customize Home"
  ]) {
    assert.equal(source.includes(marker), true, `Home lost ${marker}`);
  }

  assert.equal(source.includes("Top Artists"), false, "retired Top Artists label returned");
  assert.equal(source.includes("Continue listening"), false, "old Continue listening shelf returned");
  assert.equal(source.includes("homeRotationRail"), false, "retired circular Recent rotation layout returned");
  assert.equal(source.includes("homeSectionMeta"), false, "Home count metadata clutter returned");
  assert.equal(source.includes('style={{ transform: "none" }}'), false, "layout fixes must live in Home CSS, not inline style hacks");
});

test("Home fills the content pane while the shell owns sidebar geometry", () => {
  const css = read("src/features/home/home.css");
  const workspace = read("src/styles/view-shell.css");
  const main = read("src/main.tsx");

  for (const marker of [
    ".app:has(.pageTransition-home) .content",
    ".homeJumpBack",
    ".homeListenGrid",
    ".homeArtistRail",
    ".homeReleaseRail",
    "width: 100%",
    "--workspace-sidebar-current"
  ]) {
    assert.equal(css.includes(marker) || workspace.includes(marker), true, `full-width Home architecture lost ${marker}`);
  }

  assert.equal(css.includes("width: min(1560px"), false, "desktop Home max-width returned");
  assert.equal(css.includes("width: min(1640px"), false, "wide-screen Home max-width returned");
  assert.equal(css.includes(".app:has(.pageTransition-home) .sidebar"), false, "Home must not own a second sidebar layout");
  assert.equal(css.includes("--sidebar-width:"), false, "Home must not redefine the persisted sidebar setting");

  for (const marker of [
    "--workspace-sidebar-expanded",
    "--workspace-sidebar-current",
    ".appShell",
    ".sidebar",
    '[data-sidebar-behavior="slim"]',
    '[data-sidebar-behavior="hover"]',
    ".pageTransition:not(.pageTransition-home)"
  ]) {
    assert.equal(workspace.includes(marker), true, `shared shell lost ${marker}`);
  }

  assert.equal(workspace.includes("--workspace-max"), false, "retired workspace max-width returned");
  assert.equal(fs.existsSync(path.join(root, "src/features/home/home-polish.css")), false, "Home polish override layer returned");
  assert.equal(main.includes("home-polish.css"), false, "renderer still imports the removed Home polish layer");
  assert.ok(Buffer.byteLength(css) < 20 * 1024, "Home CSS exceeded its 20 KiB ownership budget");
  assert.ok(Buffer.byteLength(workspace) < 20 * 1024, "shared shell CSS exceeded its 20 KiB ownership budget");
});
