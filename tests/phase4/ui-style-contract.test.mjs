import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const rebuiltStyles = [
  "src/features/covers/covers.css"
];

test("cover styles remain lazy-loaded in their features", () => {
  const main = read("src/main.tsx");
  for (const file of rebuiltStyles) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file + " should exist");
    assert.equal(main.includes(file.replace(/^src\//, "./")), false, file + " should not be a global import");
  }
  assert.equal(fs.existsSync(path.join(root, "src/features/library/library.css")), true, "Library should now have a co-located design owner");
  assert.equal(fs.existsSync(path.join(root, "src/features/artists/artists.css")), true, "Artists should have a co-located design owner");

});

test("permanent visual owners remain explicit and co-located", () => {
  const app = read("src/App.tsx");
  const main = read("src/main.tsx");
  const home = read("src/features/home/HomeView.tsx");
  const library = read("src/features/library/LibraryView.tsx");
  const artists = read("src/features/artists/ArtistsView.tsx");
  const genres = read("src/features/genres/GenresView.tsx");
  const player = read("src/features/player/components/PlayerBar.tsx");
  const settingsView = read("src/features/settings/SettingsView.tsx");
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
  assert.equal(genres.includes('import "./genres.css";'), true, "GenresView must own Genres CSS");
  assert.ok(fs.existsSync(path.join(root, "src/features/genres/genres.css")));
  assert.equal(player.includes('import "../player.css";'), true, "PlayerBar must own player CSS");
  assert.equal(settingsView.includes('import "./settings.css";'), true, "SettingsView must own settings CSS");
  assert.ok(coversView.includes('import "./covers.css";'), "Covers must own its stylesheet");
  for (const [source, name] of [[playlists, "playlists"], [downloads, "downloads"], [analytics, "analytics"]]) {
    assert.ok(source.includes('import "./' + name + '.css";'), name + " needs a local stylesheet");
    assert.ok(fs.existsSync(path.join(root, "src/features/" + name + "/" + name + ".css")));
  }
  assert.equal(settingsRail.includes('aria-label="Settings sections"'), true, "Settings navigation should have its own accessible component");
  for (const specifier of ["./app-core.css", "./motion.css", "./effects.css", "../../styles/view-shell.css"]) {
    assert.equal(shell.includes('import "' + specifier + '";'), true, specifier + " is missing from AppShell ownership");
  }

  for (const specifier of ["./styles/tokens.css", "./styles/themes.css", "./shared/ui/view-ui.css", "./features/shell/performance.css"]) {
    assert.equal(main.includes('import "' + specifier + '";'), true, specifier + " is missing from the global renderer manifest");
  }

  const settingsCss = read("src/features/settings/settings.css");
  assert.equal(settingsCss.includes(".settingsCategoryRail nav"), true, "Settings layout should style its own navigation");
  assert.equal(settingsCss.includes(".modalWrap"), false, "Settings styles must not affect unrelated modals");
});


test("removed global header selectors stay out of active CSS owners", () => {
  for (const file of ["src/App.css", "src/features/shell/app-core.css", "src/styles/view-shell.css"]) {
    const css = read(file);
    for (const obsolete of [".headerBar", ".headerText", ".headerTools", ".compactHeaderTools", ".searchEasterWrap"]) {
      assert.equal(css.includes(obsolete), false, file + " still owns removed header style " + obsolete);
    }
  }
});

test("theme controls and library layout follow their owners", () => {
  const app = read("src/App.css");
  const themes = read("src/styles/themes.css");
  assert.match(read("src/shared/ui/controls.css"), /background-color: var\(--lt-surface-soft\) !important/);
  assert.equal(app.includes("--sidebar-line-soft"), false);
  assert.match(themes, /\.app\[data-theme="light"\][\s\S]*?color-scheme: light/);
  assert.match(read("src/features/settings/settings.css"), /\.settingsPage select \{ cursor: pointer; color-scheme: inherit/);
  assert.match(read("src/features/library/library.css"), /padding: 0 0 var\(--lt-space-5\)/);
  assert.match(read("src/features/settings/settings.css"), /padding: 0 0 var\(--lt-space-5\)/);
  assert.match(read("src/features/settings/settings-premium.css"), /padding: 0 0 var\(--lt-space-5\)/);
});

test("sidebar navigation retains keyboard focus and theme contrast", () => {
  const nav = read("src/features/shell/SidebarNav.tsx");
  const effects = read("src/features/shell/effects.css");
  assert.ok(nav.includes('aria-current={view === item.id ? "page" : undefined}'));
  assert.match(read("src/styles/view-shell.css"), /\.navItem:focus-visible \.navIcon\s*\{\s*outline: 2px solid var\(--lt-accent\) !important/);
  assert.match(read("src/styles/view-shell.css"), /\.navItem\.active \{[^}]*color: var\(--lt-text\) !important/);
});



test("appearance has only light and dark mode and shared semantic aliases", () => {
  const css = read("src/styles/themes.css");
  const app = read("src/App.css");
  assert.match(css, /color-scheme: dark/);
  assert.match(css, /color-scheme: light/);
  assert.doesNotMatch(css + app, /data-theme="(?:mono|mint|stars|berry|oled)"/);
  for (const token of ["--lt-bg", "--lt-surface", "--lt-text", "--lt-accent"]) assert.ok(css.includes(token));
});

test("Card mode owner respects theme surfaces without stripping effects", () => {
  const css = read("src/features/shell/effects.css");
  for (const mode of ["solid", "glassy", "oledFlat"]) {
    const selector = '.app[data-card-background="' + mode + '"]';
    const start = css.indexOf(selector + "{");
    assert.notEqual(start, -1);
    const body = css.slice(start, css.indexOf("}", start));
    assert.match(body, /--v321-card-bg: (?:color-mix|var)\(/);
    assert.match(body, /--v321-card-border: var\(--lt-border\)/);
  }
  assert.match(css, /:is\(\.app\[data-card-background="solid"\], \.app\[data-card-background="glassy"\], \.app\[data-card-background="oledFlat"\]\) :where\(\.songRow\)/);
  assert.match(css, /box-shadow: var\(--v321-list-card-shadow\) !important/);
  assert.match(css, /--v321-list-card-shadow: inset 0 1px 0 rgba\(255, 255, 255, 0\.045\)/);
  assert.match(css, /backdrop-filter: blur\(16px\)/);
});


test("soft-corner preference outranks late shell defaults", () => {
  const shell = read("src/features/shell/app-core.css");
  assert.match(shell, /\.app\[data-corners="soft"\]\s*\{[^{}]*--radius:\s*16px;[^{}]*--small-radius:\s*12px;/);
  assert.doesNotMatch(shell, /(?:^|\n)\[data-corners="soft"\]\s*\{/);
});


test("overlay menus use Localtify theme surfaces and expose keyboard focus", () => {
  const dropdown = read("src/shared/ui/ArcDropdownMenu.css");
  const context = read("src/features/library/components/song-context-menu.css");
  const queue = read("src/features/player/components/queue-panel.css");

  assert.match(dropdown, /\.arcDropdownOption:focus-visible\s*\{\s*outline: 2px solid var\(--lt-accent\) !important; outline-offset: -2px !important/);
  assert.match(read("src/shared/ui/surface.css"), /\.ltOverlaySurface\s*\{[^}]*background: var\(--lt-glass-background\)/);
  assert.match(context, /\.app \.songContextMenuLayer \.songContextMenu button:focus-visible\s*\{\s*outline: 2px solid var\(--lt-accent\) !important/);
  assert.match(context, /\.songContextMenu \.songContextMenuIcon\{[^}]*color: var\(--lt-muted\)/);
  assert.match(read("src/features/player/components/QueuePanel.tsx"), /className="queuePanel ltOverlaySurface"/);
  assert.match(queue, /\.app \.queuePanel button\.queuePanelRowMain:focus-visible\s*\{\s*outline: 2px solid var\(--lt-accent\) !important/);
  assert.doesNotMatch(context, /background: linear-gradient\(180deg, rgba\(20, 20, 20/);
  assert.doesNotMatch(queue, /background: linear-gradient\(180deg, rgba\(20, 20, 24/);
});

test("Discover, similar tracks and tagging respect the active accent and UI border tokens", () => {
  const discover = read("src/features/discover/discover.css");
  const similar = read("src/features/analysis/similar-songs.css");
  const tagging = read("src/features/tagging/tagging.css");
  const context = read("src/features/library/components/song-context-menu.css");
  const queue = read("src/features/player/components/queue-panel.css");

  assert.match(discover, /\.discoverPick\.active\s*\{[^}]*color: var\(--accent-contrast, #06100b\)/);
  assert.match(discover, /\.app \.discoverPage :is\(\.discoverKey input, \.discoverLink, \.discoverName, \.discoverPick\):focus-visible\s*\{\s*outline: 2px solid var\(--lt-accent\) !important/);
  assert.match(similar, /\.similarSongsRow\[data-current="true"\]\s*\{\s*background: rgba\(var\(--lt-accent-rgb\), \.08\)/);
  assert.match(similar, /\.similarSongsHeader h2\s*\{[^}]*overflow-wrap: anywhere/);
  assert.match(similar, /\.similarSongsPrimary\s*\{[^}]*color: var\(--accent-contrast, #06100b\)/);
  assert.match(tagging, /\.tagSearchButton\.primary\s*\{[^}]*color: var\(--accent-contrast, #06100b\)/);
  assert.match(tagging, /\.tagSearchForm input\s*\{[^}]*border: 1px solid var\(--lt-border\)/);
  assert.doesNotMatch(similar, /rgba\(141, 255, 206|rgba\(163, 193, 198/);
  assert.doesNotMatch(tagging, /rgba\(163, 193, 198/);
  assert.doesNotMatch(similar, /var\(--lt-surface-soft\)/);
  assert.doesNotMatch(tagging, /var\(--lt-surface-soft\)/);
  assert.match(context, /\.songContextMenuHead\{[^}]*background: var\(--lt-fill\)/);
  assert.match(context, /\.songContextMenu button\.dangerMenuItem\{\s*color: var\(--lt-danger\)/);
  assert.match(queue, /\.queuePanelRow:hover\{\s*background: color-mix\(in srgb, var\(--lt-text\) 7%, transparent\)/);
});

test("shared focus remains visible and component insets override the app and Linux outlines", () => {
  const globals = read("src/features/shell/app-core.css");
  const linux = read("src/features/shell/effects.css");
  const discover = read("src/features/discover/discover.css");
  const queue = read("src/features/player/components/queue-panel.css");
  const dropdown = read("src/shared/ui/ArcDropdownMenu.css");

  assert.doesNotMatch(globals, /button:focus-visible\s*\{\s*outline: 0 !important/);
  assert.match(read("src/shared/ui/controls.css"), /\.app :is\(button, a, input, textarea, select, \[role="button"\]\):not\(\[data-embedded-field\]\):focus-visible\s*\{\s*outline: 2px solid var\(--lt-accent\) !important/);
  assert.match(linux, /\.app\[data-platform="linux"\] :is\(button, input, textarea, select, \[role="button"\]\):not\(\[data-embedded-field\]\):focus-visible\s*\{\s*outline:[^}]*!important/);
  assert.match(discover, /\.app \.discoverPage [^{]*:focus-visible\s*\{\s*outline:[^}]*!important/);
  assert.match(queue, /\.app \.queuePanel button\.queuePanelRowMain:focus-visible\s*\{\s*outline:[^}]*!important/);
  assert.match(dropdown, /\.arcDropdownOption:focus-visible\s*\{\s*outline:[^}]*!important/);
});


test("Cover virtual rows keep fixed positions when hovered and gallery items fit their slots", () => {
  const css = read("src/features/covers/covers.css");
  const songs = read("src/features/covers/components/VirtualCoverSongList.tsx");
  const gallery = read("src/features/covers/components/VirtualCoverGalleryGrid.tsx");
  assert.match(songs, /style=\{\{ top: \`\$\{virtualRow\.start - scrollMargin\}px\` \}\}/);
  assert.match(gallery, /style=\{\{ top: \`\$\{virtualRow\.start - scrollMargin\}px\`/);
  assert.doesNotMatch(songs + gallery, /translate3d\(0, var\(--cover-/);
  assert.match(css, /height: 228px/);
  assert.match(gallery, /estimateSize: \(\) => 228/);
  assert.match(css, /coverSongPickVirtual[\s\S]*?transform: none !important/);
  assert.match(gallery, /Math\.max\(1, Math\.floor/);
  assert.match(gallery, /if \(!entries\.length\) return <div ref=\{parentRef\}/);
  assert.match(songs, /if \(!songs\.length\) return <div ref=\{parentRef\}/);
  assert.match(songs, /aria-pressed=\{selected\}/);
});


test("Artists and Genres share collection primitives but own their variants", () => {
  const artist = read("src/features/artists/ArtistsView.tsx");
  const genre = read("src/features/genres/GenresView.tsx");
  const shared = read("src/shared/ui/collection-layout.css");
  const artistCss = read("src/features/artists/artists.css");
  const genreCss = read("src/features/genres/genres.css");
  for (const view of [artist, genre]) {
    assert.match(view, /import "\.\.\/\.\.\/shared\/ui\/collection-layout\.css";/);
    assert.match(view, /className="collectionBrowsePage/);
    assert.match(view, /className="collectionBrowseGrid/);
    assert.match(view, /className="collectionBrowseCard/);
  }
  assert.doesNotMatch(genre, /import "\.\.\/artists\/artists\.css"/);
  assert.match(artist, /import "\.\/artists\.css";/);
  assert.match(genre, /import "\.\/genres\.css";/);
  assert.match(shared, /background: transparent/);
  assert.match(shared, /color: var\(--lt-text\)/);
  assert.match(shared, /@media \(max-width: 520px\)/);
  assert.match(artistCss, /\.artistCardCover/);
  assert.match(genreCss, /\.genreCardCover/);
  assert.doesNotMatch(artistCss, /\.artistsGrid/);
  assert.doesNotMatch(genreCss, /\.artistsPage/);
});


const resetPageSelectors = [".albumsPageV318", ".playlistsPage", ".coverStudioLayout", ".downloadsLayoutV031", ".analyticsStudioV339", ".settingsPageV027"];

test("shared shell owns viewport and responsive sidebar behavior only", () => {
  const main = read("src/main.tsx");
  const shell = read("src/features/shell/AppShell.tsx");
  const css = read("src/styles/view-shell.css");

  assert.equal(shell.includes('import "../../styles/view-shell.css";'), true, "AppShell does not own shared shell CSS");
  assert.equal(main.includes('import "./styles/view-shell.css";'), false, "view-shell CSS should not be centrally owned by main");
  assert.equal(main.includes('import "./styles/page-foundation.css";'), false, "retired reset stylesheet returned");
  assert.equal(main.includes('import "./features/shell/performance.css";'), true, "performance policy is not loaded globally");
  assert.equal(css.includes(".pageTransition-home"), true, "shared shell lost its Home exclusion boundary");

  for (const marker of [
    "--workspace-sidebar-expanded",
    "--workspace-sidebar-current",
    "--workspace-sidebar-rail: var(--lt-sidebar-closed)",
    "--lt-sidebar-closed: 72px",
    "grid-template-columns: var(--workspace-sidebar-current)",
    '[data-sidebar-behavior="slim"]',
    '[data-sidebar-behavior="hover"]',
    ":focus-within",
    '--rail-label: none'
  ]) {
    assert.equal(css.includes(marker), true, "sidebar behavior guard is missing " + marker);
  }

  assert.equal(css.includes("--workspace-max"), false, "retired centered workspace cap returned");
});

test("shared shell no longer owns feature page designs", () => {
  const css = read("src/styles/view-shell.css");
  for (const selector of resetPageSelectors) assert.equal(css.includes(selector), false, "shared shell still styles reset page selector " + selector);
  assert.equal(css.includes(".libraryPage"), false, "Library design leaked into the shell owner");
  assert.ok(Buffer.byteLength(css.replace(/\r\n/g, "\n")) < 20 * 1024, "shared shell exceeded its 20 KiB budget");
});


test("shared empty/error cards use theme surfaces rather than hard-coded dark paint", () => {
  const css = read("src/shared/ui/view-ui.css");
  assert.match(css, /background:\s*linear-gradient\([\s\S]*?\),\s*var\(--lt-surface\)/);
  assert.match(css, /--state-rgb: 255, 88, 116/);
  assert.match(css, /--state-rgb: 67, 234, 139/);
  assert.doesNotMatch(css, /rgba\(8,\s*8,\s*13/);
  assert.doesNotMatch(css, /backdrop-filter/);
});

test("media play overlay remains visible on touch and focusable on keyboard", () => {
  const css = read("src/shared/ui/media-card.css");
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\)/);
  assert.match(css, /\.mediaCardPlay:focus-visible/);
  assert.match(css, /color: var\(--accent-contrast, var\(--lt-bg\)\)/);
});

test("page search, settings controls and sidebar use the shared token and icon system", () => {
  const page = read("src/shared/ui/page-header.css");
  const settings = read("src/features/settings/settings-premium.css");
  const sidebar = read("src/features/shell/SidebarNav.tsx");
  assert.match(page, /\.pageHeaderSearch:focus-visible/);
  assert.match(page, /outline: 2px solid var\(--lt-accent\)/);
  assert.doesNotMatch(settings.slice(settings.indexOf(".settingsPage.settingsPageV027 {"),settings.indexOf("}",settings.indexOf(".settingsPage.settingsPageV027 {"))), /--settings-text:/);
  assert.match(sidebar, /className="navLucideIcon" size=\{20\} strokeWidth=\{2\}/);
});


test("Settings controls retain theme-driven borders and hover surfaces", () => {
  const css = read("src/features/settings/settings.css");
  assert.match(css, /\.sidebarTabsButton:hover:not\(:disabled\)[\s\S]*?background: var\(--settings-elevated\);/);
  assert.doesNotMatch(css, /rgba\(255,\s*255,\s*255,\s*\.(?:16|18)\)/);
  assert.doesNotMatch(css, /background: rgba\(255,\s*255,\s*255,\s*\.07\)/);
});

test("playlist hints use semantic tokens, not fixed dark-theme paints", () => {
  const playlists = read("src/features/playlists/playlists.css");
  assert.match(playlists, /\.playlistTrackRow \.iconAction:hover \{ color: var\(--lt-danger\)/);
  assert.doesNotMatch(playlists, /#eba4ad|#d0b8a3/);
});

test("Downloads Experience preserves theme tokens and error semantics", () => {
  const css = read("src/features/downloads/downloads.css");
  assert.match(css, /\.downloadsExperience\s*\{/);
  assert.ok(css.includes("--accent: var(--lt-accent)"));
  assert.ok(css.includes("color: var(--lt-danger)"));
  assert.ok(css.includes("border: 1px solid var(--lt-border)"));
  assert.doesNotMatch(css, /#efb5b7|#e7b2a3|#79a7c4/);
});


test("lyrics and portal menus use theme-aware foreground and surfaces", () => {
  const lyrics = read("src/features/lyrics/lyrics.css");
  assert.match(lyrics, /\.lyricsView\{[^}]*color: var\(--lt-text\);[^}]*background: var\(--lt-bg-elevated\)/);
  assert.doesNotMatch(lyrics, /color: #fff;/);
  assert.match(read("src/shared/ui/ArcDropdownMenu.tsx"), /"--lt-bg-elevated"/);
});


test("retired local album feature is absent; album metadata and liked songs stay accessible", () => {
  assert.equal(fs.existsSync(path.join(root, "src/features/albums/AlbumsView.tsx")), false);
  assert.equal(fs.existsSync(path.join(root, "src/features/albums/useAlbumsController.ts")), false);
  const nav = read("src/features/shell/navigation.constants.ts");
  assert.doesNotMatch(nav, /id:"(?:albums|liked)"/);
  assert.match(read("src/features/library/LibraryView.tsx"), /title: "Liked"/);
  assert.doesNotMatch(read("src/features/home/homeLayout.ts"), /newAlbums/);
});
