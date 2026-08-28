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

test("Home uses scoped atmospheric styles with a small final polish owner", () => {
  const css = read("src/features/home/home.css");
  const polish = read("src/features/home/home-polish.css");
  const main = read("src/main.tsx");

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

  for (const marker of [
    '.app[data-view="home"] .searchEasterWrap',
    ".homePage::before",
    ".homeHeroArtwork",
    "repeat(auto-fit, minmax(220px, 1fr))"
  ]) {
    assert.equal(polish.includes(marker), true, `Home polish lost ${marker}`);
  }

  assert.equal(main.includes('import "./features/home/home-polish.css";'), true, "Home polish is not wired into the renderer");
  assert.ok(Buffer.byteLength(css) < 24 * 1024, "Home CSS exceeded its 24 KiB ownership budget");
  assert.ok(Buffer.byteLength(polish) < 10 * 1024, "Home polish exceeded its 10 KiB ownership budget");
});
