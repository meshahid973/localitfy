import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const retiredPageStyles = [
  "src/features/library/library.css",
  "src/features/albums/albums.css",
  "src/features/playlists/playlists.css",
  "src/features/covers/covers.css",
  "src/features/downloads/downloads.css",
  "src/features/analytics/analytics.css"
];

test("retired page design styles stay removed", () => {
  const main = read("src/main.tsx");

  for (const file of retiredPageStyles) {
    assert.equal(fs.existsSync(path.join(root, file)), false, `${file} should stay removed until its page is redesigned`);
    assert.equal(main.includes(file.replace(/^src\//, "./")), false, `${file} is still imported by the renderer`);
  }

  assert.equal(fs.existsSync(path.join(root, "src/styles/page-foundation.css")), true, "structural page foundation is missing");
  assert.equal(main.includes('import "./styles/page-foundation.css";'), true, "renderer is not loading the structural page foundation");
});

test("permanent visual owners remain explicit", () => {
  const app = read("src/App.tsx");
  const main = read("src/main.tsx");

  for (const specifier of [
    "./features/home/home.css",
    "./features/settings/settings.css",
    "./features/player/player.css"
  ]) {
    assert.equal(app.includes(`import \"${specifier}\";`), true, `${specifier} is missing from App ownership`);
  }

  for (const specifier of [
    "./shared/ui/view-ui.css",
    "./styles/page-foundation.css",
    "./styles/view-shell.css",
    "./features/shell/performance.css"
  ]) {
    assert.equal(main.includes(`import \"${specifier}\";`), true, `${specifier} is missing from renderer manifest`);
  }

  const settingsCss = read("src/features/settings/settings.css");
  assert.equal(settingsCss.includes("Visual redesign intentionally removed"), true, "Settings should remain structure-only during redesign");
});
