import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("library and player depend on shared heart, never each other's view module", () => {
  const player = read("src/features/player/components/PlayerBar.tsx");
  const songs = read("src/features/library/components/SongRows.tsx");
  const shared = read("src/shared/ui/LikeHeartAnimation.tsx");
  assert.match(player, /shared\/ui\/LikeHeartAnimation/);
  assert.doesNotMatch(player, /library\/components\/SongRows/);
  assert.match(songs, /shared\/ui\/LikeHeartAnimation/);
  assert.doesNotMatch(songs, /export function LikeHeartAnimationV443/);
  assert.match(shared, /export function LikeHeartAnimationV443/);
  assert.doesNotMatch(shared, /features\/(?:library|player)/);
});

test("the heart animation owns its stylesheet and asset references", () => {
  const css = read("src/shared/ui/LikeHeartAnimation.css");
  const appCss = read("src/App.css");
  assert.match(css, /localtifyLikeHeartPopupV443/);
  assert.match(css, /localtifyLikeRingV443/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.\.\/\.\.\/assets\/heart-s\.svg/);
  assert.match(css, /\.\.\/\.\.\/assets\/heart-f\.svg/);
  assert.doesNotMatch(appCss, /@keyframes localtifyLikeHeartPopupV443/);
  for (const file of ["src/assets/heart-s.svg", "src/assets/heart-f.svg"]) assert.ok(fs.existsSync(path.join(root, file)));
});
