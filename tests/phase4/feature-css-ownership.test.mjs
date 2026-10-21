import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("global legacy CSS does not own Home/Cover page roots", () => {
  const app = read("src/App.css");
  for (const selector of [".homePage", ".coversPage", ".coversView"]) {
    assert.ok(!app.includes(selector), selector + " must be owned by its feature");
  }
  assert.match(read("src/features/home/home.css"), /\.homePage::before,/);
  assert.match(read("src/features/covers/covers.css"), /\.coversPage::before,/);
});

test("Home/cover backdrops and Home visibility keep original policies", () => {
  const home = read("src/features/home/home.css");
  const covers = read("src/features/covers/covers.css");
  assert.match(home, /\.homePage\s*\{[^}]*background-image: none !important/s);
  assert.match(home, /\.homeSection\s*\{[^}]*content-visibility: auto/s);
  assert.match(home, /contain-intrinsic-size: 1px 280px/);
  assert.match(covers, /\.coversPage\s*\{[^}]*background-image: none !important/s);
});
