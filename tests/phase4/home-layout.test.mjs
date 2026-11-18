import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Home keeps the reference music hierarchy without renderer hacks", () => {
  // The shelf rails live next to HomeView in HomeShelves.tsx.
  const source = read("src/features/home/HomeView.tsx") + read("src/features/home/HomeShelves.tsx");

  for (const marker of [
    "Listen now",
    "Most listened",
    "Recently added",
    "homeListenGrid",
    "homeReleaseRail",
    "Customize Home"
  ]) {
    assert.equal(source.includes(marker), true, `Home lost ${marker}`);
  }

  assert.equal(source.includes("Top Artists"), false, "retired Top Artists label returned");
  assert.equal(source.includes("Continue listening"), false, "old Continue listening shelf returned");
  assert.equal(source.includes("homeRotationRail"), false, "retired circular Recent rotation layout returned");
  assert.equal(source.includes("homeSectionMeta"), false, "Home count metadata clutter returned");
  assert.equal(source.includes('style={{ transform: "none" }}'), false, "layout fixes must live in Home CSS, not inline style hacks");
});

test("Home fills the content pane while the shell owns sidebar geometry", () => {
  const css = read("src/features/home/home.css");
  const workspace = read("src/styles/view-shell.css");
  const main = read("src/main.tsx");

  for (const marker of [
    ".app:has(.pageTransition-home) .content",
    ".homeJumpBack",
    ".homeListenGrid",
    ".homeReleaseRail",
    "width: 100%",
    "--workspace-sidebar-current"
  ]) {
    assert.equal(css.includes(marker) || workspace.includes(marker), true, `full-width Home architecture lost ${marker}`);
  }

  assert.equal(css.includes("width: min(1560px"), false, "desktop Home max-width returned");
  assert.equal(css.includes("width: min(1640px"), false, "wide-screen Home max-width returned");
  assert.equal(css.includes(".app:has(.pageTransition-home) .sidebar"), false, "Home must not own a second sidebar layout");
  assert.equal(css.includes("--sidebar-width:"), false, "Home must not redefine the persisted sidebar setting");

  for (const marker of [
    "--workspace-sidebar-expanded",
    "--workspace-sidebar-current",
    ".appShell",
    ".sidebar",
    '[data-sidebar-behavior="slim"]',
    '[data-sidebar-behavior="hover"]',
    ".pageTransition:not(.pageTransition-home)"
  ]) {
    assert.equal(workspace.includes(marker), true, `shared shell lost ${marker}`);
  }

  assert.equal(workspace.includes("--workspace-max"), false, "retired workspace max-width returned");
  assert.equal(fs.existsSync(path.join(root, "src/features/home/home-polish.css")), false, "Home polish override layer returned");
  assert.equal(main.includes("home-polish.css"), false, "renderer still imports the removed Home polish layer");
  assert.ok(Buffer.byteLength(css) < 20 * 1024, "Home CSS exceeded its 20 KiB ownership budget");
  assert.ok(Buffer.byteLength(workspace) < 20 * 1024, "shared shell CSS exceeded its 20 KiB ownership budget");
});

test("Home uses sharp cover art with optional ambient rendering", () => {
  const source = read("src/features/home/HomeView.tsx");
  const css = read("src/features/home/home.css");
  const shell = read("src/features/shell/AppShell.tsx");
  assert.doesNotMatch(source, /homeAtmosphere|<ArtworkBackdrop/);
  assert.match(source, /className="homeFeatureCover" priority="high" preferThumbnail=/);
  assert.match(shell, /usePagePalette\(route, sources, artworkEnabled/);
  assert.match(read("src/features/home/HomeShelves.tsx"), /usePageAtmosphere\(atmosphereSources\)/);
  assert.doesNotMatch(css, /\.homePage > \.homeAtmosphere/);
  assert.doesNotMatch(css, /min-height: clamp\(230px|repeat\(10,minmax/);
});
test("Home shelves size against available content width and deduplicate mix artwork", () => {
  const source = read("src/features/home/HomeView.tsx") + read("src/features/home/HomeShelves.tsx");
  const css = read("src/features/home/home.css");
  assert.match(source, /data-count=\{listenNowSongs.length\}/);
  assert.match(css, /\.homeListenGrid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@container \(max-width: 460px\)/);
  assert.match(css, /\.homeMixRail \{ grid-auto-columns:/);
  assert.match(source, /<HomeMixArtwork id=\{mix.id\}/);
  assert.match(read("src/features/covers/MixCoverArtwork.tsx"), /pickHomeMixArtwork\(songs\)/);
  assert.doesNotMatch(css, /homeMixCollage/);
  assert.match(source, /className="homeReleaseCover" preferThumbnail/);
});

test("wide Home aligns adjacent sections without rearranging persisted order", () => {
  const css = read("src/features/home/home.css");
  assert.match(css, /\.homeJumpBack:has\(\+ \.homeListenSection\)/);
  assert.match(css, /\.homeJumpBack \+ \.homeListenSection/);
  assert.match(css, /\.homeMixRail \.homeReleaseCard/);
});

test("shared artwork palette follows the existing ambient preference and background state", () => {
  const shell = read("src/features/shell/AppShell.tsx");
  const backdrop = read("src/features/covers/ArtworkBackdrop.tsx");
  const workspace = read("src/styles/view-shell.css");
  const player = read("src/features/player/player.css");
  assert.match(shell, /<ArtworkAmbientContext.Provider value=\{effectiveAmbient && effectiveCoverColorSyncMode !== "off" && !isAppBackgrounded\}>/);
  assert.match(backdrop, /enabled && source \? <CrossfadeArtwork/);
  assert.match(workspace, /--workspace-cover-color/);
  assert.match(player, /\.playerBar\[data-ambient\] \{\s*background: transparent !important/);
  assert.match(workspace, /--workspace-sidebar: var\(--lt-fill-subtle\)/);
  assert.match(player, /\.playerBar\[data-ambient\]:hover::before \{\s*display: none !important/);
  for (const file of ["SongGroupPage", "MixPage"]) assert.match(read("src/features/pages/" + file + ".tsx"), /<PageAtmosphere songs=/);
});

test("collection browsing prioritizes artwork and retains contextual drag targets", () => {
  const shelf = read("src/features/playlists/PlaylistsView.tsx");
  const css = read("src/features/playlists/playlists.css");
  const collage = read("src/features/playlists/components/PlaylistCoverCollage.tsx");
  assert.match(css, /\.playlistShelfCard \.playlistCoverCollage \{ width: 100%; aspect-ratio: 1;/);
  assert.match(shelf, /playlistDragOverPlaylistId === playlist.id \? <span className="playlistShelfDropHint">Drop to add/);
  assert.match(shelf, /onDrop=\{\(event\) => handlePlaylistShelfDrop/);
  assert.match(collage, /data-count=\{tiles.length\}/);
  assert.match(collage, /preferThumbnail/);
});

test("artwork rails retain geometry and scrolling without visible scrollbars", () => {
  const css = read("src/features/home/home.css");
  assert.match(css, /scrollbar-width: none/);
  assert.match(css, /\.homeReleaseRail::-webkit-scrollbar \{ display: none/);
  assert.doesNotMatch(css, /\.homePage > \.homeAtmosphere/);
  assert.match(read("src/features/home/HomeShelves.tsx"), /className="homeReleaseRail" tabIndex=\{0\}/);
});
test("ambience transitions are bounded and respect reduced motion", () => {
  const backdrop = read("src/features/covers/ArtworkBackdrop.tsx");
  const css = read("src/features/covers/artwork-backdrop.css");
  assert.match(backdrop, /\[frame.previous, frame.current\]\.filter\(Boolean\)/);
  assert.match(backdrop, /decodeArtwork\(source, controller.signal\)/);
  assert.match(backdrop, /if \(controller.signal.aborted\) return/);
  assert.match(backdrop, /window.clearTimeout\(timer\)/);
  assert.match(css, /transition: opacity 360ms/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(read("src/styles/view-shell.css"), /@property --workspace-cover-color/);
});


test("Home most-listened work is memoized, bounded, and hidden when unused", () => {
  const home = read("src/features/home/HomeView.tsx");
  assert.match(home, /const mostPlayedSongs = useMemo/);
  assert.match(home, /showMostListened \? pickMostPlayedSongs\(songs\) : \[\]/);
  assert.match(home, /title="Most listened of all time"/);
  const css = read("src/features/home/home.css");
  assert.match(css, /\.homeSection > h3 \{ margin-bottom: 14px; \}/);
  assert.doesNotMatch(css, /\.homeSectionHead > h3 \{ margin:0; \}/);
});

test("Home 3.1 keeps Listen Now on the workspace atmosphere and real mix covers in the shared card rail", () => {
  const css = read("src/features/home/home.css");
  const artwork = read("src/features/covers/CollectionArtwork.tsx");
  assert.match(css, /\.homeListenGrid \{[^}]*background: transparent/);
  assert.match(artwork, /new PaletteCache<ArtworkPalette>\(96\)/);
  assert.match(artwork, /IntersectionObserver/);
  assert.match(artwork, /controller.abort\(\)/);
  assert.match(read("src/features/covers/MixCoverArtwork.tsx"), /<PlaylistCoverCollage/);
});

test("workspace artwork follows the page instead of playback", () => {
  const shell = read("src/features/shell/AppShell.tsx");
  assert.match(shell, /const artworkEnabled = effectiveAmbient && effectiveCoverColorSyncMode !== "off" && !isAppBackgrounded/);
  assert.match(shell, /pageArtwork\?\.route === route/);
  assert.doesNotMatch(shell, /useWorkspacePalette\(home.ambientStyle/);
  assert.doesNotMatch(shell, /const artworkEnabled = view === "home"/);
});
