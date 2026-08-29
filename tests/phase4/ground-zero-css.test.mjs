import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const megaFiles = ["src/App.css", "src/features/shell/app-core.css", "src/features/settings/themes.css", "src/features/shell/effects.css"];
const forbiddenPageTokens = [
  ".libraryPanel", ".libraryQuick", ".libraryMissing", ".libraryCoverCard", ".shuffleLibraryButton",
  ".albumsPage", ".albumsHero", ".albumsShelf", ".albumFolder", ".albumCard", ".albumDetail", ".albumBuilder",
  ".playlistsPage", ".playlistHero", ".playlistCreate", ".playlistShelf", ".playlistTracks",
  ".coverStudio", ".coverMood", ".coverSelected", ".coverGallery", ".coverQuick", ".coverRecent",
  ".downloadsLayout", ".downloadPanel", ".downloadQueue", ".downloadTextarea", ".spotifyTrack", ".spotifyAuth", ".converter",
  ".analytics", ".settingsPage", ".settingsHero"
];

test("rebuildable pages expose a neutral ownership root", () => {
  const expected = [
    ["src/features/library/LibraryView.tsx", 'data-page-section="library"'],
    ["src/features/albums/AlbumsView.tsx", 'data-page-section="albums"'],
    ["src/features/playlists/PlaylistsView.tsx", 'data-page-section="playlists"'],
    ["src/features/downloads/DownloadsView.tsx", 'data-page-section="downloads"'],
    ["src/features/analytics/AnalyticsView.tsx", 'data-page-section="analytics"'],
    ["src/features/covers/CoverStudio.tsx", 'data-page-section="covers"'],
    ["src/features/settings/SettingsView.tsx", 'data-page-section="settings"']
  ];
  for (const [relative, marker] of expected) assert.equal(read(relative).includes(marker), true, relative + " is missing " + marker);
});

test("historical mega CSS cannot own reset page class families", () => {
  for (const relative of megaFiles) {
    const source = read(relative).replace(/\/\*[\s\S]*?\*\//g, " ");
    const leaked = forbiddenPageTokens.filter((token) => source.includes(token));
    assert.deepEqual(leaked, [], relative + " still owns reset page families: " + leaked.join(", "));
  }
});

test("legacy root shim and sidebar geometry debt stay removed", () => {
  assert.equal(fs.existsSync(path.join(root, "src/useProximityMotion.ts")), false, "root proximity hook shim returned");
  assert.equal(read("src/App.tsx").includes('from "./features/shell/useProximityMotion"'), true, "App is not using the canonical shell hook");
  const appCss = read("src/App.css");
  for (const token of ["var(--sidebar-width-release)", "var(--sidebar-width-used)", "var(--sidebar-width, 249px)", "88px 218px", '[data-sidebar-behavior="hover"]', '[data-sidebar-behavior="slim"]']) {
    assert.equal(appCss.includes(token), false, "App.css still contains legacy shell geometry: " + token);
  }
});

test("ground-zero foundation is structural, scoped, and small", () => {
  const source = read("src/styles/page-foundation.css");
  assert.equal(source.includes("[data-page-section]"), true);
  assert.equal(source.includes(".pageTransition:not(.pageTransition-home)"), true);
  assert.ok(Buffer.byteLength(source) < 8 * 1024, "page foundation exceeded 8 KiB");
  for (const token of ["linear-gradient(", "radial-gradient("]) assert.equal(source.includes(token), false, "visual skin leaked into page foundation");
});
