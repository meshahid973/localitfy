import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");

function numericConstant(name) {
  const match = main.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)`));
  return match ? Number(match[1]) : NaN;
}

test("bulk album scanning stays bounded and yields to Electron", () => {
  const depth = numericConstant("ALBUM_FOLDER_LIBRARY_SCAN_MAX_DEPTH");
  const scanYield = numericConstant("ALBUM_FOLDER_SCAN_YIELD_EVERY_TRACKS");
  const importYield = numericConstant("ALBUM_FOLDER_IMPORT_YIELD_EVERY_TRACKS");

  assert.ok(Number.isFinite(depth) && depth > 0 && depth <= 6, "album library recursion must stay bounded");
  assert.ok(Number.isFinite(scanYield) && scanYield > 0 && scanYield <= 16, "album scan must periodically yield to the event loop");
  assert.ok(Number.isFinite(importYield) && importYield > 0 && importYield <= 24, "album import must periodically yield to the event loop");
  assert.match(main, /await\s+yieldToMainLoop\(\)/, "album folder work no longer yields to Electron");
});

test("nested album scans prefer each album folder's own cover", () => {
  assert.match(main, /folderCoverPath\s*\|\|\s*albumEmbeddedCoverPath/, "folder cover is no longer preferred over embedded fallback");
  assert.match(main, /preferFolderCover:\s*Boolean\(folderCoverPath\)/, "folder-cover preference is not carried into metadata repair");
  assert.match(main, /sourcePath:\s*folderPath/, "album preview must retain the exact child folder source path");
});
