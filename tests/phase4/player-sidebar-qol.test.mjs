import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const read = (relative) => fs.readFileSync(relative, "utf8");

function loadCommonJs(relative, requireShim) {
  const { outputText } = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  const module = { exports: {} };
  runInNewContext(outputText, { module, exports: module.exports, require: requireShim });
  return module.exports;
}

const navigation = loadCommonJs("src/features/shell/navigation.constants.ts", (specifier) => {
  if (specifier === "lucide-react") return new Proxy({}, { get: (_, name) => String(name) });
  throw new Error(`unexpected import ${specifier}`);
});
const layout = loadCommonJs("src/features/shell/sidebarLayout.ts", (specifier) => {
  if (specifier === "./navigation.constants") return navigation;
  throw new Error(`unexpected import ${specifier}`);
});
const plain = (value) => JSON.parse(JSON.stringify(value));
const group = (groups, id) => plain(groups.find((item) => item.id === id));

test("sidebar defaults match the navigation constants", () => {
  const groups = layout.resolveSidebarGroups(undefined, undefined);
  for (const defaults of navigation.sidebarNavGroups) {
    assert.deepEqual(group(groups, defaults.id).visibleItems, plain(defaults.itemIds));
  }
});

test("saved order wins, unknown ids are dropped and new tabs are appended", () => {
  const groups = layout.resolveSidebarGroups({ tools: ["analytics", "bogus", "downloads", "analytics"] }, []);
  assert.deepEqual(group(groups, "tools").orderedItems, ["analytics", "downloads", "covers"]);
});

test("hidden tabs leave the visible list but keep their slot; settings cannot be hidden", () => {
  const hidden = layout.normalizeSidebarHidden(["genres", "settings", "nope", "genres"]);
  assert.deepEqual(plain(hidden), ["genres"]);
  const library = group(layout.resolveSidebarGroups(undefined, hidden), "library");
  assert.ok(library.orderedItems.includes("genres"));
  assert.ok(!library.visibleItems.includes("genres"));
  assert.deepEqual(group(layout.resolveSidebarGroups(undefined, ["settings"]), "app").visibleItems, ["settings"]);
});

test("moving swaps with the next visible neighbour and stops at the edges", () => {
  // Default library order: home, library, liked, artists, genres, albums, playlists, discover.
  const order = layout.moveSidebarItem(undefined, ["genres"], "artists", 1);
  assert.deepEqual(plain(order.library), ["home", "library", "liked", "albums", "genres", "artists", "playlists", "discover"]);
  assert.equal(layout.canMoveSidebarItem(undefined, [], "home", -1), false);
  assert.equal(layout.canMoveSidebarItem(undefined, [], "analytics", 1), false);
  assert.equal(layout.canMoveSidebarItem(undefined, [], "settings", 1), false);
  assert.deepEqual(plain(layout.moveSidebarItem(undefined, [], "home", -1)), {});
});

test("toggling visibility adds and removes the tab", () => {
  const hidden = layout.toggleSidebarItemHidden([], "covers");
  assert.deepEqual(plain(hidden), ["covers"]);
  assert.deepEqual(plain(layout.toggleSidebarItemHidden(hidden, "covers")), []);
});

test("sidebar renders resolved groups and exposes a customization menu", () => {
  const shell = read("src/features/shell/AppShell.tsx");
  const nav = read("src/features/shell/SidebarNav.tsx");
  assert.match(shell, /<SidebarNav/);
  assert.match(nav, /resolveSidebarGroups\(sidebarNavOrder, sidebarHiddenNav\)/);
  assert.match(nav, /onContextMenu=\{\(event\) => openMenu\(event, item\.id\)\}/);
  assert.match(read("src/features/settings/categories/AppearanceSettings.tsx"), /<SidebarTabsSettings/);
});

test("player bar links the song, artist, like state, context menu and queue", () => {
  const bar = read("src/features/player/components/PlayerBar.tsx");
  assert.match(bar, /onClick=\{revealNowPlaying\}/);
  assert.match(bar, /splitArtistCredits\(currentSong\.artist\)\.map/);
  assert.match(bar, /onClick=\{\(\) => openArtistPage\(artistName\)\}/);
  assert.match(bar, /onClick=\{\(\) => toggleLike\(currentSong\.id\)\}/);
  assert.match(bar, /openSongContextMenu\(event, currentSong\)/);
  assert.match(bar, /className=\{`playerQueueButton/);
  assert.match(read("src/features/shell/AppShell.tsx"), /<QueuePanel \{\.\.\.modals\.queuePanel\} \/>/);
});

test("now-playing context prefers the playlist, then the started source, then the song's album", () => {
  const source = read("src/features/player/playbackSource.ts");
  const resolver = source.slice(source.indexOf("export function resolveNowPlayingContext"), source.indexOf("export function getRepeatPreview"));
  const playlistAt = resolver.indexOf("activePlaylist?.songIds.includes(song.id)");
  const sourceAt = resolver.indexOf("source?.songIds.includes(song.id)");
  const albumAt = resolver.indexOf("albumIdBySongId.get(song.id)");
  assert.ok(playlistAt > 0 && playlistAt < sourceAt && sourceAt < albumAt);
});

test("repeat-all loops the album/artist/genre a queue was started from", () => {
  const helpers = read("src/features/player/playbackSource.ts");
  const loop = helpers.slice(helpers.indexOf("export function getSourceLoopRestart"), helpers.indexOf("export function getSourcePreviousStep"));
  assert.match(loop, /repeatMode !== "all" \|\| !source \|\| inPlaylist/);
  assert.match(loop, /rest: ids\.slice\(1\)/);
  const app = read("src/App.tsx");
  const playNext = app.slice(app.indexOf("function playNext("), app.indexOf("function playPrevious("));
  // Queued songs play first; the loop only restarts once the queue is empty.
  assert.ok(playNext.indexOf("playQueue.findIndex") < playNext.indexOf("sourceLoopRestart()"));
  assert.match(app, /kind: "source-loop" as const, rest: sourceLoop\.rest/);
  assert.match(app, /target\.kind === "source-loop"\) \{\s*setPlayQueue\(target\.rest\);/);
  const shell = read("src/features/shell/useCollectionActions.ts");
  assert.match(shell, /target\.kind === "artist" \|\| target\.kind === "genre" \? playbackSourceRef\(target\.kind, target\.title\)/);
  assert.match(app, /collections: \{ playSongs: playAlbumSongs,/);
  // Leaving the context through a normal song pick stops the loop.
  assert.match(app, /else if \(!playbackContext\?\.keepSource && !playbackContext\?\.keepPlaylistContext\) \{\s*setPlaybackSource\(null\);/);
});

test("queue panel shows repeat state", () => {
  const panel = read("src/features/player/components/QueuePanel.tsx");
  assert.match(panel, /repeatMode === "one"/);
  assert.match(panel, /repeatMode === "all" && repeatPreview/);
  assert.match(read("src/App.tsx"), /repeatPreview: queuePanelOpen\s*\? getRepeatPreview\(/);
});

test("the player bar and song menus open album, artist and genre pages", () => {
  const nav = read("src/features/shell/useNavigationHistory.ts");
  assert.match(nav, /openAlbumPage: \(albumId: string\) => open\(\{ kind: "album", id: albumId \}\)/);
  assert.match(nav, /openArtistPage: \(artistName: string\) => open\(\{ kind: "artist", id: artistDetailId\(artistName\) \}\)/);
  assert.match(nav, /else open\(\{ kind: context\.kind, id:/);
  const app = read("src/App.tsx");
  assert.match(app, /goToArtist: nav\.openArtistPage/);
  assert.match(app, /openArtistPage: nav\.openArtistPage/);
});

test("song context menu is styled and offers queue and navigation actions", () => {
  const menu = read("src/features/library/components/SongContextMenu.tsx");
  assert.match(menu, /import "\.\/song-context-menu\.css";/);
  assert.match(menu, /queueSong\(song\.id, false\)/);
  assert.match(menu, /goToArtist\(artistName\)/);
  assert.match(menu, /goToAlbum\(song\)/);
  assert.match(read("src/features/library/components/song-context-menu.css"), /\.songContextMenuLayer\{\s*position: fixed;/);
});

test("view action buttons pair an icon with their text", () => {
  for (const file of [
    "src/features/library/LibraryView.tsx"
  ]) {
    const source = read(file);
    assert.match(source, /<ActionLabel icon=\{Shuffle\}>shuffle<\/ActionLabel>/, file);
    assert.doesNotMatch(source, />\s*(?:play|shuffle|queue)\s*<\/button>/, file);
  }
});
