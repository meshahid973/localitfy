import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("cover and library scans remain functional without floating mascot notifications", () => {
  const shell = read("src/features/shell/AppShell.tsx");
  const contract = read("src/features/shell/appShell.contract.ts");
  const app = read("src/App.tsx");
  const css = read("src/App.css");

  for (const source of [shell, contract, css]) {
    assert.doesNotMatch(source, /tinyScanner|pixel art is being refreshed/);
  }
  assert.doesNotMatch(shell, /className="scannerOrb"/, "remove only the floating status orb");
  assert.doesNotMatch(css, /^\s*\.scannerOrb(?:\s*\{|::)/m, "remove orphaned scanner orb styles");
  assert.doesNotMatch(shell, /libraryScanBusy|pixelArtBusy|libraryScanMessage/);
  assert.doesNotMatch(contract, /libraryScanBusy|pixelArtBusy|libraryScanMessage/);
  assert.match(shell, /appToast \? <div className="appToast error"/, "preserve actionable error messages");
  assert.match(shell, /importAnimation\.active/, "preserve the local import progress overlay");
  assert.match(app, /libraryScanBusy, setLibraryScanBusy/, "keep library scan tracking");
  assert.match(app, /pixelArtBusy/, "keep cover-processing state");
  assert.match(app, /libraryScanMessage/, "keep Settings status feedback");
});
