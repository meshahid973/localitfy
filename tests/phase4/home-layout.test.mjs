import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Home keeps the compact reference music hierarchy", () => {
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
  assert.equal(source.includes('style={{ transform: "none" }}'), true, "Home hover clipping guard is missing");
});

test("Home owns content while the shared workspace owns sidebar behavior", () => {
  const css = read("src/features/home/home.css");
  const workspace = read("src/styles/view-shell.css");
  const main = read("src/main.tsx");

  for (const marker of [
    ".app:has(.pageTransition-home) .content",
    ".homeJumpBack",
    ".homeListenGrid",
    ".homeArtistRail",
    ".homeReleaseRail",
    "width: min(1560px"
  ]) {
    assert.equal(css.includes(marker), true, `Home CSS lost ${marker}`);
  }

  assert.equal(css.includes(".app:has(.pageTransition-home) .sidebar"), false, "Home must not own a second sidebar layout");
  assert.equal(css.includes("--sidebar-width:"), false, "Home must not override the shared sidebar width");

  for (const marker of [
    ".appShell",
    ".sidebar",
    '[data-sidebar-behavior="slim"]',
    '[data-sidebar-behavior="hover"]',
    ".pageTransition:not(.pageTransition-home)"
  ]) {
    assert.equal(workspace.includes(marker), true, `shared workspace lost ${marker}`);
  }

  assert.equal(fs.existsSync(path.join(root, "src/features/home/home-polish.css")), false, "Home polish override layer returned");
  assert.equal(main.includes("home-polish.css"), false, "renderer still imports the removed Home polish layer");
  assert.ok(Buffer.byteLength(css) < 24 * 1024, "Home CSS exceeded its 24 KiB ownership budget");
  assert.ok(Buffer.byteLength(workspace) < 24 * 1024, "shared shell CSS exceeded its 24 KiB ownership budget");
});
