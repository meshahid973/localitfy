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
    "New Releases",
    "homeListenGrid",
    "homeArtistRail",
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
    ".homeArtistRail",
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
  assert.match(source, /showAtmosphere \? <div className="homeAtmosphere"[^>]*><ArtworkBackdrop song=\{currentSong\}/);
  assert.match(source, /className="homeFeatureCover" priority="high" preferThumbnail=/);
  assert.match(shell, /artworkAmbient=\{effectiveAmbient && !isAppBackgrounded\}/);
  assert.match(css, /\.homePage > \.homeAtmosphere/);
  assert.doesNotMatch(css, /min-height: clamp\(230px|repeat\(10,minmax/);
});
test("Home shelves size against available content width and deduplicate mix artwork", () => {
  const source = read("src/features/home/HomeView.tsx") + read("src/features/home/HomeShelves.tsx");
  const css = read("src/features/home/home.css");
  assert.match(source, /data-count=\{listenNowSongs.length\}/);
  assert.match(css, /@container \(max-width: 850px\)/);
  assert.match(css, /\.homeMixRail \{ grid-auto-columns:/);
  assert.match(source, /pickHomeMixArtwork\(mix.songs\)/);
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
  assert.match(shell, /<ArtworkAmbientContext.Provider value=\{effectiveAmbient && !isAppBackgrounded\}>/);
  assert.match(backdrop, /if \(!song \|\| !enabled\) return null/);
  assert.match(workspace, /--workspace-cover-color/);
  assert.match(player, /\.playerBar\[data-ambient\] \{\s*background: var\(--workspace-sidebar/);
  assert.match(player, /\.playerBar\[data-ambient="true"\]:hover::before/);
  for (const file of ["AlbumPage", "SongGroupPage", "MixPage"]) assert.match(read("src/features/pages/" + file + ".tsx"), /<ArtworkBackdrop song=/);
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
  assert.match(css, /\.homeArtistCard \.mediaCardCover \{[^}]*width: min\(100%, 116px\); aspect-ratio: 1/);
  assert.match(css, /scrollbar-width: none/);
  assert.match(css, /\.homeReleaseRail::-webkit-scrollbar \{ display: none/);
  assert.match(css, /\.homePage > \.homeAtmosphere \{[^}]*grid-column: auto/);
  assert.match(read("src/features/home/HomeShelves.tsx"), /className="homeReleaseRail" tabIndex=\{0\}/);
});
test("ambience transitions are bounded and respect reduced motion", () => {
  const backdrop = read("src/features/covers/ArtworkBackdrop.tsx");
  const css = read("src/features/covers/artwork-backdrop.css");
  assert.match(backdrop, /pending \? \[displayed, \{ key, song \}\] : \[outgoing, displayed\]/);
  assert.match(backdrop, /onLoadCapture/);
  assert.match(backdrop, /window.clearTimeout\(timer\)/);
  assert.match(css, /transition: opacity 360ms/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(read("src/styles/view-shell.css"), /@property --workspace-cover-color/);
});
