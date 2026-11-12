import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) => fs.readFileSync(relative, "utf8");

test("virtual playlist rows are positioned by their own transform", () => {
  assert.match(read("src/features/playlists/components/VirtualPlaylistTrackList.tsx"), /"--playlist-row-y": `\$\{virtualRow\.start - scrollMargin\}px`/);
  assert.match(read("src/features/playlists/playlists.css"), /\.playlistTrackRow\.virtualPlaylistTrackRow \{[^}]*position: absolute;[^}]*transform: translateY\(var\(--playlist-row-y,0px\)\);/);
});

test("the always-on performance transform reset leaves virtual playlist rows alone", () => {
  // body.localtifyPerf is always set, so a `transform: none !important` that matches these rows stacks them all at the top.
  const css = read("src/features/shell/performance.css");
  for (const block of css.split("}")) {
    if (!/transform:\s*none/.test(block) || !/\.playlistTrackRow/.test(block)) continue;
    assert.match(block, /:not\(\.virtualPlaylistTrackRow\)/);
  }
});
