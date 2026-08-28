import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const contracts = [
  ["Home", "src/features/home/home.css", [".homePage", ".homeJumpBack", ".homeListenGrid", ".homeArtistRail", ".homeReleaseRail"]],
  ["Library/Liked", "src/features/library/library.css", [".libraryPanelV025", ".libraryPanelHeadV025", ".libraryListHeaderV025", ".libraryFullListV025", ".likedLibraryPanelV025"]],
  ["Albums", "src/features/albums/albums.css", [".albumsPageV318", ".albumsHeroPanelV318", ".albumFolderImportPanelV309", ".albumsGridV318", ".albumDetailPanelV318", ".albumBuilderPanelV318"]],
  ["Playlists", "src/features/playlists/playlists.css", [".playlistsPage", ".playlistHeroPanel", ".playlistCreatePanel", ".playlistShelfGrid", ".playlistTracksPanel", ".playlistTrackRow"]],
  ["Covers", "src/features/covers/covers.css", [".coverStudioLayout", ".coverStudioHero", ".coverStudioBody", ".coverVirtualGalleryViewport", ".coverGalleryCardCleanOnly"]],
  ["Downloads", "src/features/downloads/downloads.css", [".downloadsLayoutV031", ".downloadPanelV031", ".downloadTabStrip", ".spotifyTrackItemV326", ".downloadQueuePanel", ".converterBoxV031"]],
  ["Analytics", "src/features/analytics/analytics.css", [".analyticsStudioV339", ".analyticsHeroV339", ".analyticsRecapGridV339", ".analyticsRecapCardV339", ".analyticsMiniGridV339"]],
  ["Settings", "src/features/settings/settings.css", [".settingsPageV027", ".settingsHeroV027", ".settingsPageLayoutV027", ".settingsCategoryContentV027", ".settingsCategoryMotion"]],
  ["Player", "src/features/player/player.css", [".playerBar", ".playerLeft", ".playerCenter", ".controlRow", ".progressRow", ".playerRight", ".volumeWrap"]]
];

test("every renderer page keeps its critical CSS contract", () => {
  for (const [label, file, selectors] of contracts) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${label} stylesheet is missing`);
    const css = read(file);
    for (const selector of selectors) {
      assert.equal(css.includes(selector), true, `${label} lost required selector ${selector}`);
    }
  }
});

test("feature CSS ownership remains explicitly wired", () => {
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
    "./features/library/library.css",
    "./features/albums/albums.css",
    "./features/playlists/playlists.css",
    "./features/covers/covers.css",
    "./features/downloads/downloads.css",
    "./features/analytics/analytics.css",
    "./styles/view-shell.css"
  ]) {
    assert.equal(main.includes(`import \"${specifier}\";`), true, `${specifier} is missing from renderer manifest`);
  }
});
