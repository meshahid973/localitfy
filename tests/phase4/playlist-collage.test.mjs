import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("playlist covers share one component across all three places", () => {
  const app = read("src/App.tsx");
  const view = read("src/features/playlists/PlaylistsView.tsx");
  const picker = read("src/features/playlists/components/PlaylistPickerModal.tsx");
  const collage = read("src/features/playlists/components/PlaylistCoverCollage.tsx");
  assert.doesNotMatch(app, /renderPlaylistCollage/);
  assert.doesNotMatch(view, /renderPlaylistCollage/);
  assert.doesNotMatch(picker, /renderPlaylistCollage/);
  assert.match(view, /<PlaylistCoverCollage songs=\{detailSongs\}/);
  assert.match(view, /<PlaylistCoverCollage songs=\{previewSongs\}/);
  assert.match(picker, /<PlaylistCoverCollage songs=\{previewSongs\}/);
  assert.match(collage, /Array\.from\(\{ length: 4 \}/);
  assert.match(collage, /playlistCoverTile/);
});
