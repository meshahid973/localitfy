import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/features/covers/Cover.tsx", "utf8");

test("cover readiness follows the URL that actually loaded", () => {
  assert.match(source, /const \[loadedSrc, setLoadedSrc\] = useState\(""\)/);
  assert.match(source, /const imageReady = hasCover && loadedSrc === coverSrc;/);
  assert.match(source, /onLoad=\{\(\) => setLoadedSrc\(coverSrc\)\}/);
});

test("song updates cannot hide an image that already loaded", () => {
  // Resetting readiness in an effect hid the art whenever the playing song object was refreshed with
  // the same cover URL: the mounted <img> never fires load again, leaving only the letter placeholder.
  assert.doesNotMatch(source, /setImageReady/);
  const resetEffect = source.slice(source.indexOf("useEffect(() => {"), source.indexOf("return ("));
  assert.doesNotMatch(resetEffect, /setLoadedSrc\(\s*["']{2}\s*\)/);
});
