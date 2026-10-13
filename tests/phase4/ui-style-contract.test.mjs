import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const rebuiltStyles = [
  "src/features/albums/albums.css",
  "src/features/covers/covers.css"
];

test("album and cover styles remain lazy-loaded in their features", () => {
  const main = read("src/main.tsx");
  for (const file of rebuiltStyles) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file + " should exist");
    assert.equal(main.includes(file.replace(/^src\//, "./")), false, file + " should not be a global import");
  }
  assert.equal(fs.existsSync(path.join(root, "src/features/library/library.css")), true, "Library should now have a co-located design owner");
  assert.equal(fs.existsSync(path.join(root, "src/features/artists/artists.css")), true, "Artists should have a co-located design owner");
  assert.equal(fs.existsSync(path.join(root, "src/styles/page-foundation.css")), true, "structural page foundation is missing");
  assert.equal(main.includes('import "./styles/page-foundation.css";'), true, "renderer is not loading the structural page foundation");
});

test("permanent visual owners remain explicit and co-located", () => {
  const app = read("src/App.tsx");
  const main = read("src/main.tsx");
  const home = read("src/features/home/HomeView.tsx");
  const library = read("src/features/library/LibraryView.tsx");
  const artists = read("src/features/artists/ArtistsView.tsx");
  const player = read("src/features/player/components/PlayerBar.tsx");
  const settingsView = read("src/features/settings/SettingsView.tsx");
  const albumsView = read("src/features/albums/AlbumsView.tsx");
  const coversView = read("src/features/covers/CoversView.tsx");
  const playlists = read("src/features/playlists/PlaylistsView.tsx");
  const downloads = read("src/features/downloads/DownloadsView.tsx");
  const analytics = read("src/features/analytics/AnalyticsView.tsx");
  const settingsRail = read("src/features/settings/SettingsRail.tsx");
  const shell = read("src/features/shell/AppShell.tsx");

  const appCss = [...app.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
  assert.deepEqual(appCss, ["./App.css"], "App must not be a feature stylesheet manifest");
  assert.equal(home.includes('import "./home.css";'), true, "HomeView must own Home CSS");
  assert.equal(library.includes('import "./library.css";'), true, "LibraryView must own Library CSS");
  assert.equal(artists.includes('import "./artists.css";'), true, "ArtistsView must own Artists CSS");
  assert.equal(player.includes('import "../player.css";'), true, "PlayerBar must own player CSS");
  assert.equal(settingsView.includes('import "./settings.css";'), true, "SettingsView must own settings CSS");
  assert.ok(albumsView.includes('import "./albums.css";'), "Albums must own its stylesheet");
  assert.ok(coversView.includes('import "./covers.css";'), "Covers must own its stylesheet");
  for (const [source, name] of [[playlists, "playlists"], [downloads, "downloads"], [analytics, "analytics"]]) {
    assert.ok(source.includes('import "./' + name + '.css";'), name + " needs a local stylesheet");
    assert.ok(fs.existsSync(path.join(root, "src/features/" + name + "/" + name + ".css")));
  }
  assert.equal(settingsRail.includes('aria-label="Settings sections"'), true, "Settings navigation should have its own accessible component");
  for (const specifier of ["./app-core.css", "./motion.css", "./effects.css", "../../styles/view-shell.css"]) {
    assert.equal(shell.includes('import "' + specifier + '";'), true, specifier + " is missing from AppShell ownership");
  }

  for (const specifier of ["./styles/tokens.css", "./styles/themes.css", "./shared/ui/view-ui.css", "./styles/page-foundation.css", "./features/shell/performance.css"]) {
    assert.equal(main.includes('import "' + specifier + '";'), true, specifier + " is missing from the global renderer manifest");
  }

  const settingsCss = read("src/features/settings/settings.css");
  assert.equal(settingsCss.includes(".settingsCategoryRail nav"), true, "Settings layout should style its own navigation");
  assert.equal(settingsCss.includes(".modalWrap"), false, "Settings styles must not affect unrelated modals");
});
