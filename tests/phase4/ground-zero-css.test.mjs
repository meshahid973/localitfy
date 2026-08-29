import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const megaFiles = ["src/App.css", "src/features/shell/app-core.css", "src/styles/themes.css", "src/features/shell/effects.css"];
const forbiddenPageTokens = [".libraryPage", ".libraryPanel", ".libraryQuick", ".libraryMissing", ".albumsPage", ".albumsHero", ".albumCard", ".playlistsPage", ".playlistHero", ".coverStudio", ".downloadsLayout", ".downloadPanel", ".spotifyTrack", ".analytics", ".settingsPage", ".settingsHero"];
const resetPages = [
  ["src/features/albums/AlbumsView.tsx", "albums"], ["src/features/playlists/PlaylistsView.tsx", "playlists"],
  ["src/features/downloads/DownloadsView.tsx", "downloads"], ["src/features/analytics/AnalyticsView.tsx", "analytics"],
  ["src/features/covers/CoverStudio.tsx", "covers"], ["src/features/settings/SettingsView.tsx", "settings"]
];

test("pages awaiting redesign explicitly opt into temporary reset mode", () => {
  for (const [relative, section] of resetPages) assert.ok(read(relative).includes('data-page-section="' + section + '" data-page-state="reset"'), relative + " is not reset-state gated");
});

test("Library is no longer a ground-zero page", () => {
  const source = read("src/features/library/LibraryView.tsx");
  assert.ok(source.includes('data-page-section="library"'));
  assert.equal(source.includes('data-page-state="reset"'), false);
  assert.ok(source.includes('import "./library.css";'));
});

test("historical global CSS cannot own feature page class families", () => {
  for (const relative of megaFiles) {
    const source = read(relative).replace(/\/\*[\s\S]*?\*\//g, " ");
    const leaked = forbiddenPageTokens.filter((token) => source.includes(token));
    assert.deepEqual(leaked, [], relative + " still owns feature page families: " + leaked.join(", "));
  }
});

test("ground-zero foundation only applies while reset state is present", () => {
  const source = read("src/styles/page-foundation.css");
  assert.ok(source.includes('[data-page-section][data-page-state="reset"]'));
  assert.doesNotMatch(source, /\[data-page-section\](?!\[data-page-state="reset"\])/);
  assert.ok(Buffer.byteLength(source.replace(/\r\n/g, "\n")) < 8 * 1024);
  for (const token of ["linear-gradient(", "radial-gradient("]) assert.equal(source.includes(token), false);
  for (const token of [".libraryPanel", ".libraryQuick", ".libraryMissing", ".libraryFullList", ".libraryCoverCards"]) assert.equal(source.includes(token), false);
});

test("legacy root shim and sidebar geometry debt stay removed", () => {
  assert.equal(fs.existsSync(path.join(root, "src/useProximityMotion.ts")), false);
  assert.ok(read("src/App.tsx").includes('from "./features/shell/useProximityMotion"'));
  const appCss = read("src/App.css");
  for (const token of ["var(--sidebar-width-release)", "var(--sidebar-width-used)", "var(--sidebar-width, 249px)", "88px 218px", '[data-sidebar-behavior="hover"]', '[data-sidebar-behavior="slim"]']) assert.equal(appCss.includes(token), false, token);
});
