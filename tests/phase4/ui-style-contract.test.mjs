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
  assert.equal(genres.includes('import "./genres.css";'), true, "GenresView must own Genres CSS");
  assert.ok(fs.existsSync(path.join(root, "src/features/genres/genres.css")));
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
  assert.match(app, /background-color: var\(--lt-surface\) !important/);
  assert.equal(app.includes("--sidebar-line-soft"), false);
  assert.match(themes, /\.app\[data-theme="mono"\][\s\S]*?color-scheme: light/);
  assert.match(read("src/features/settings/settings.css"), /\.settingsPage select \{ cursor: pointer; color-scheme: inherit/);
  assert.match(read("src/features/albums/AlbumsView.tsx"), /<ArcDropdownMenu className="albumsSortV318"/);
  assert.match(read("src/features/albums/albums.css"), /\.albumsPageV318 \.albumsSortV318 \{/);
  assert.match(read("src/features/library/library.css"), /padding: clamp\(24px, 2\.5vw, 40px\) 0 105px/);
  assert.match(read("src/features/settings/settings.css"), /padding: 26px 0 100px/);
  assert.match(read("src/features/settings/settings-premium.css"), /padding: 24px 0 90px/);
});

test("sidebar navigation retains keyboard focus and theme contrast", () => {
  const nav = read("src/features/shell/SidebarNav.tsx");
  const effects = read("src/features/shell/effects.css");
  assert.ok(nav.includes('aria-current={view === item.id ? "page" : undefined}'));
  assert.match(effects, /\.navItemAnimatedV468:focus-visible \.navIcon\s*\{\s*outline: 2px solid var\(--lt-accent\) !important/);
  assert.match(effects, /\.navItemAnimatedV468\.active \.navText strong\s*\{\s*color: var\(--lt-text\) !important/);
});



test("Mono theme has one palette owner and preserves final semantic colors", () => {
  const themes = read("src/styles/themes.css");
  const monoBlocks = [...themes.matchAll(/\.app\[data-theme="mono"\]\s*\{([^{}]*)\}/g)];
  assert.equal(monoBlocks.length, 1, "Mono must have a single palette and color-scheme owner");
  assert.doesNotMatch(themes, /\.app\[data-theme="stars"\]\s*,\s*\.app\[data-theme="midnight"\]\s*,\s*\.app\[data-theme="mono"\]/);
  const palette = monoBlocks.at(-1)[1];
  for (const rule of [
    "--bg: #f4f6fb;", "--surface: #ffffff;", "--text: #343a55;",
    "--lt-bg: var(--bg);", "--lt-surface: var(--surface);",
    "--lt-accent: var(--accent);", "color-scheme: light;"
  ]) assert.ok(palette.includes(rule), "Missing final Mono token: " + rule);
  const declarations = [...palette.matchAll(/(?:^|;)\s*(--[\w-]+|color-scheme)\s*:/g)].map((item) => item[1]);
  assert.equal(new Set(declarations).size, declarations.length, "Mono must define each token once");
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
  assert.match(css, /:is\(\.app\[data-card-background="solid"\], \.app\[data-card-background="glassy"\], \.app\[data-card-background="oledFlat"\]\) :where\(\.homeAlbumCard, \.songRow\)/);
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
  assert.match(context, /\.songContextMenu\{[\s\S]*?background: linear-gradient\(var\(--lt-surface\), var\(--lt-surface\)\), var\(--lt-bg\)/);
  assert.match(context, /\.app \.songContextMenuLayer \.songContextMenu button:focus-visible\s*\{\s*outline: 2px solid var\(--lt-accent\) !important/);
  assert.match(context, /color: var\(--accent-contrast, #06100b\)/);
  assert.match(queue, /\.queuePanel\{[\s\S]*?background: linear-gradient\(var\(--lt-surface\), var\(--lt-surface\)\), var\(--lt-bg\)/);
  assert.match(queue, /\.app \.queuePanel button\.queuePanelRowMain:focus-visible\s*\{\s*outline: 2px solid var\(--lt-accent\) !important/);
  assert.doesNotMatch(context, /background: linear-gradient\(180deg, rgba\(20, 20, 20/);
  assert.doesNotMatch(queue, /background: linear-gradient\(180deg, rgba\(20, 20, 24/);
});

test("Discover, similar tracks and tagging respect the active accent and UI border tokens", () => {
  const discover = read("src/features/discover/discover.css");
  const similar = read("src/features/analysis/similar-songs.css");
  const tagging = read("src/features/tagging/tagging.css");

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
  assert.match(context, /\.songContextMenuHead\{[^}]*background: color-mix\(in srgb, var\(--lt-text\) 7%, transparent\)/);
  assert.match(context, /\.songContextMenu button\.dangerMenuItem\{\s*color: var\(--lt-danger\)/);
  assert.match(queue, /\.queuePanelRow:hover\{\s*background: color-mix\(in srgb, var\(--lt-text\) 7%, transparent\)/);
});

test("component focus rules override the app and Linux !important outlines", () => {
  const globals = read("src/features/shell/app-core.css");
  const linux = read("src/features/shell/effects.css");
  const discover = read("src/features/discover/discover.css");
  const queue = read("src/features/player/components/queue-panel.css");
  const dropdown = read("src/shared/ui/ArcDropdownMenu.css");

  assert.match(globals, /button:focus-visible\s*\{\s*outline: 0 !important/);
  assert.match(globals, /\.app :is\(button, a, \[role="button"\]\):focus-visible\s*\{\s*outline:[^}]*!important/);
  assert.match(linux, /\.app\[data-platform="linux"\] :is\(button, input, textarea, select, \[role="button"\]\):focus-visible\s*\{\s*outline:[^}]*!important/);
  assert.match(discover, /\.app \.discoverPage [^{]*:focus-visible\s*\{\s*outline:[^}]*!important/);
  assert.match(queue, /\.app \.queuePanel button\.queuePanelRowMain:focus-visible\s*\{\s*outline:[^}]*!important/);
  assert.match(dropdown, /\.arcDropdownOption:focus-visible\s*\{\s*outline:[^}]*!important/);
});
