import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("all reduced-motion app preferences have one policy owner", () => {
  const motion = read("src/features/shell/motion.css");
  const perf = read("src/features/shell/performance.css");
  assert.doesNotMatch(motion, /\.app\.reducedMotion \*/);
  assert.doesNotMatch(motion, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(perf, /\.app\.reducedMotion \*/);
  assert.match(perf, /\.app\[data-motion-level="reduced"\] \*::after/);
  assert.match(perf, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(motion, /@keyframes localtifyFadeIn/);
});

test("Home owns scroll containment and contradictory intrinsic sizing is removed", () => {
  const effects = read("src/features/shell/effects.css");
  const home = read("src/features/home/home.css");
  assert.doesNotMatch(effects, /contain-intrinsic-size: 92px 132px/);
  assert.doesNotMatch(effects, /\.app \.homeListenGrid\s*\{/);
  assert.match(home, /\.app \.homeListenGrid\s*\{[^}]*content-visibility: auto/s);
  assert.match(home, /\.app \.homeAlbumCard\s*\{[^}]*contain-intrinsic-size: 120px 150px/s);
  assert.match(effects, /\.app \.songRow,\s*\.app \.playlistSongRow/);
});
