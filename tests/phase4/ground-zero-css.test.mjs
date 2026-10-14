import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const megaFiles = ["src/App.css", "src/features/shell/app-core.css", "src/styles/themes.css", "src/features/shell/effects.css"];
const forbiddenPageTokens = [".libraryPage", ".libraryPanel", ".libraryQuick", ".libraryMissing", ".artistsPage", ".artistCard", ".genresPage", ".genreCard", ".albumsPage", ".albumsHero", ".albumCard", ".playlistsPage", ".playlistHero", ".coverStudio", ".downloadsLayout", ".downloadPanel", ".spotifyTrack", ".analytics", ".settingsPage", ".settingsHero"];

test("all finished pages are outside temporary reset mode", () => {
  const finished = [
    ["src/features/library/LibraryView.tsx", "library"],
    ["src/features/artists/ArtistsView.tsx", "artists"],
    ["src/features/genres/GenresView.tsx", "genres"],
    ["src/features/albums/AlbumsView.tsx", "albums"],
    ["src/features/playlists/PlaylistsView.tsx", "playlists"],
    ["src/features/covers/CoverStudio.tsx", "covers"],
    ["src/features/downloads/DownloadsView.tsx", "downloads"],
    ["src/features/analytics/AnalyticsView.tsx", "analytics"],
    ["src/features/settings/SettingsView.tsx", "settings"]
  ];
  for (const [file, section] of finished) {
    const source = read(file);
    assert.ok(source.includes('data-page-section="' + section + '"'), file);
    assert.equal(source.includes('data-page-state="reset"'), false, file);
  }
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

test("retired reset stylesheet stays deleted and unimported", () => {
  assert.equal(fs.existsSync(path.join(root, "src/styles/page-foundation.css")), false);
  assert.equal(read("src/main.tsx").includes("page-foundation.css"), false);
});

test("legacy root shim and sidebar geometry debt stay removed", () => {
  assert.equal(fs.existsSync(path.join(root, "src/useProximityMotion.ts")), false);
  assert.ok(read("src/App.tsx").includes('from "./features/shell/useProximityMotion"'));
  const appCss = read("src/App.css");
  for (const token of ["var(--sidebar-width-release)", "var(--sidebar-width-used)", "var(--sidebar-width, 249px)", "88px 218px", '[data-sidebar-behavior="hover"]', '[data-sidebar-behavior="slim"]']) assert.equal(appCss.includes(token), false, token);
});
test("redesigned pages use their own styles without reset mode", () => {
  for (const [path, section] of [
    ["src/features/settings/SettingsView.tsx", "settings"],
    ["src/features/playlists/PlaylistsView.tsx", "playlists"],
    ["src/features/downloads/DownloadsView.tsx", "downloads"],
    ["src/features/analytics/AnalyticsView.tsx", "analytics"]
  ]) {
    const source = read(path);
    assert.ok(source.includes('data-page-section="' + section + '"'), path);
    assert.ok(!source.includes('data-page-state="reset"'), path);
    assert.ok(source.includes('import "./' + section + '.css";'), path);
  }
});
