import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Home keeps the simplified music-first hierarchy", () => {
  const source = read("src/features/home/HomeView.tsx");

  for (const marker of [
    "featured local track",
    "Continue listening",
    "Listen now",
    "Top artists",
    "homeContinueRail",
    "homeListenGrid",
    "homeArtistRail"
  ]) {
    assert.equal(source.includes(marker), true, `Home lost ${marker}`);
  }

  assert.equal(source.includes("homeRotationRail"), false, "retired circular Recent rotation layout returned");
  assert.equal(source.includes("homeSectionMeta"), false, "Home count metadata clutter returned");
});

test("Home uses one scoped atmospheric stylesheet", () => {
  const css = read("src/features/home/home.css");

  for (const marker of [
    '.app[data-view="home"] .content',
    '.app[data-view="home"] .headerText',
    "background-image: var(--cover-url, none)",
    ".homeHeroMedia",
    ".homeContinueRail",
    ".homeListenGrid",
    ".homeArtistRail"
  ]) {
    assert.equal(css.includes(marker), true, `Home CSS lost ${marker}`);
  }

  assert.ok(Buffer.byteLength(css) < 24 * 1024, "Home CSS exceeded its 24 KiB ownership budget");
});
