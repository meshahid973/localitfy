import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("rare library/playlist modal modules are requested only when open", () => {
  const shell = read("src/features/shell/AppShell.tsx");
  for (const [component, prop, folder] of [
    ["SongEditorModal", "songEditor", "library"],
    ["DeleteSongModal", "deleteSong", "library"],
    ["PlaylistPickerModal", "playlistPicker", "playlists"]
  ]) {
    const componentPath = folder === "library" ? "library/components/" + component : "playlists/components/" + component;
    assert.ok(shell.includes('const ' + component + ' = lazy(() => import("../' + componentPath + '"))'), component + " lazy");
    assert.ok(shell.includes("modals." + prop + ".song ? <Suspense fallback={null}><" + component), component + " open guard");
    assert.doesNotMatch(shell, new RegExp("import " + component + " from"));
  }
  assert.ok(shell.includes('const TagSearchDialog = lazy(() => import("../tagging/TagSearchDialog"))'), "TagSearchDialog lazy");
  assert.ok(shell.includes("tagSearchSong ? <Suspense fallback={null}><TagSearchDialog"), "TagSearchDialog open guard");
  assert.ok(shell.includes('const AlbumTagSearchDialog = lazy(() => import("../tagging/AlbumTagSearchDialog"))'), "AlbumTagSearchDialog lazy");
  assert.ok(shell.includes("tagSearchAlbum ? <Suspense fallback={null}><AlbumTagSearchDialog"), "AlbumTagSearchDialog open guard");
  assert.ok(shell.includes('const AlbumTracksDialog = lazy(() => import("../tagging/AlbumTracksDialog"))'), "AlbumTracksDialog lazy");
  assert.ok(shell.includes("albumTracksRequest ? <Suspense fallback={null}><AlbumTracksDialog"), "AlbumTracksDialog open guard");
  assert.ok(shell.includes('const DownloadTagDialog = lazy(() => import("../tagging/DownloadTagDialog"))'), "DownloadTagDialog lazy");
  assert.ok(shell.includes("downloadTagPrompt.songIds.length ? <Suspense fallback={null}><DownloadTagDialog"), "DownloadTagDialog open guard");
});

test("high-frequency context menu remains eagerly loaded and shell modal props stay typed", () => {
  const shell = read("src/features/shell/AppShell.tsx");
  const contract = read("src/features/shell/appShell.contract.ts");
  assert.match(shell, /import SongContextMenu from/);
  assert.match(shell, /<SongContextMenu \{\.\.\.modals\.songContextMenu\}[^>]*\/>/);
  for (const name of ["SongEditorModalProps", "DeleteSongModalProps", "PlaylistPickerModalProps"]) {
    assert.ok(contract.includes(name));
  }
});
