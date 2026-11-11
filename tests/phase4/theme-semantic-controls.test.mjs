import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");

test("Settings controls retain theme-driven borders and hover surfaces", () => {
  const css = read("src/features/settings/settings.css");
  assert.match(css, /\.sidebarTabsButton:hover:not\(:disabled\)[\s\S]*?background: var\(--settings-elevated\);/);
  assert.doesNotMatch(css, /rgba\(255,\s*255,\s*255,\s*\.(?:16|18)\)/);
  assert.doesNotMatch(css, /background: rgba\(255,\s*255,\s*255,\s*\.07\)/);
});

test("playlist and album hints use semantic tokens, not fixed dark-theme paints", () => {
  const playlists = read("src/features/playlists/playlists.css");
  const albums = read("src/features/albums/albums.css");
  assert.match(playlists, /\.playlistTrackRow \.iconAction:hover \{ color: var\(--lt-danger\)/);
  assert.match(albums, /\.albumFolderPreviewCopyV309 ul \{[^}]*color: var\(--albums-muted\)/);
  assert.doesNotMatch(playlists + albums, /#eba4ad|#d0b8a3/);
});

test("download errors, progress and warnings follow Localtify tokens", () => {
  const css = read("src/features/downloads/downloads.css");
  assert.match(css, /border: 1px solid color-mix\(in srgb, var\(--lt-danger\) 28%, transparent\)/);
  assert.match(css, /background: color-mix\(in srgb, var\(--lt-danger\) 8%, var\(--downloads-surface\)\)/);
  assert.match(css, /background: var\(--downloads-accent\)/);
  assert.doesNotMatch(css, /#efb5b7|#e7b2a3|#79a7c4/);
});
