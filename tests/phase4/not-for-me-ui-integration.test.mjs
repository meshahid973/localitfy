import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("analysis toggle updates persisted renderer state after native success", () => {
  const settings = fs.readFileSync("src/features/settings/categories/ExperimentalSettings.tsx", "utf8");
  assert.match(settings, /await window\.localitfy\.setAnalysisEnabled\(value\)/);
  assert.match(settings, /await updateSetting\("experimentalMusicAnalysis", value\)/);
});

test("expanded song menu has enough room for recommendation controls", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8");
  const menu = fs.readFileSync("src/features/library/components/song-context-menu.css", "utf8");
  assert.match(app, /const menuHeight = 600;/);
  assert.match(menu, /max-height: calc\(100dvh - 24px - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)\)/);
  assert.match(menu, /overflow-y: auto/);
});

test("radio off/on invalidates old searches rather than applying stale results", () => {
  const radio = fs.readFileSync("src/features/player/useSongRadio.ts", "utf8");
  assert.match(radio, /const requestVersionRef = useRef\(0\)/);
  assert.match(radio, /requestVersionRef\.current \+= 1/);
  assert.match(radio, /requestVersionRef\.current !== requestVersion/);
  assert.match(radio, /requestedRef\.current = ""/);
});
