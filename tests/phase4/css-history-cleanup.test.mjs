import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("legacy release-era footer markers no longer clutter active stylesheets", () => {
  for (const file of [
    "src/App.css",
    "src/features/shell/app-core.css",
    "src/features/shell/effects.css",
    "src/features/player/player.css",
    "src/styles/themes.css"
  ]) {
    const css = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(css, /\/\*\s*end localtify v\d+/i, file);
    assert.doesNotMatch(css, /\/\*\s*localtify 0\.[0-4]\.\d+/i, file);
  }
});
