import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const shellSource = fs.readFileSync("src/features/shell/AppShell.tsx", "utf8");
const contractSource = fs.readFileSync("src/features/shell/appShell.contract.ts", "utf8");
const appSource = fs.readFileSync("src/App.tsx", "utf8");

test("AppShell uses grouped feature contracts instead of an any prop bus", () => {
  assert.doesNotMatch(shellSource, /Record<string,\s*any>/);
  assert.match(shellSource, /props:\s*AppShellProps/);
  for (const group of ["frame", "navigation", "home", "library", "albums", "playlists", "covers", "analytics", "settingsView", "downloads", "playerBar", "modals", "playbackAudio"]) {
    assert.match(contractSource, new RegExp(`\\b${group}:`), `missing ${group} shell contract`);
  }
});

test("App builds grouped shell models instead of one flat cross-feature object", () => {
  assert.match(appSource, /const localtifyAppViewProps:\s*AppShellProps\s*=\s*\{/);
  assert.match(appSource, /frame:\s*\{/);
  assert.match(appSource, /downloads:\s*\{/);
  assert.match(appSource, /playbackAudio:\s*\{/);
  assert.doesNotMatch(appSource, /<AppShell\s+\{\.\.\.\{[^}]*songs[^}]*downloadsTab/s);
});
