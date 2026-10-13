import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("cover maintenance actions are connected to the existing controller", () => {
  const app = read("src/App.tsx");
  const cover = read("src/features/covers/CoversView.tsx");
  const studio = read("src/features/covers/CoverStudio.tsx");
  assert.match(app, /randomizeMissingCovers: randomizeMissingCoversAction/);
  assert.match(app, /cleanupCoverCache: cleanupCoverCacheAction/);
  assert.match(cover, /missingCoverSongs=\{missingCoverSongs\}/);
  assert.match(cover, /randomizeMissingCovers=\{randomizeMissingCovers\}/);
  assert.match(cover, /cleanupCoverCache=\{cleanupCoverCache\}/);
  assert.match(studio, /randomizeMissingCovers\?\.\(\)/);
  assert.match(studio, /cleanupCoverCache\?\.\(\)/);
});

test("unused props are no longer passed through view contracts", () => {
  const downloads = read("src/features/downloads/DownloadsView.tsx");
  const albums = read("src/features/albums/AlbumsView.tsx");
  const analytics = read("src/features/analytics/AnalyticsView.tsx");
  const covers = read("src/features/covers/CoversView.tsx");
  const playlist = read("src/features/playlists/PlaylistsView.tsx");
  for (const field of ["downloadResults", "playlists", "progress", "ready"]) {
    assert.doesNotMatch(downloads.split("export default function")[0], new RegExp("^  " + field + ": any;", "m"));
  }
  assert.doesNotMatch(albums.split("export default function")[0], /^  ready: any;/m);
  assert.doesNotMatch(analytics.split("export default function")[0], /^  ready: boolean;/m);
  assert.doesNotMatch(covers, /now: unknown|togglePixelCoverFavorite/);
  assert.doesNotMatch(playlist.split("export default function")[0], /^  (?:selectedPlaylistId|playlists): any;/m);
});
