import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const read = (path) => fs.readFileSync(path, "utf8");
const playable = (song) => !!song && Boolean(song.filePath || song.url) && song.fileExists !== false;
const prettyTitle = (value) => String(value || "").toLowerCase().trim();
const exports = {};
const { outputText } = ts.transpileModule(read("src/features/albums/album.runtime.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
const dependencies = {
  "../library/library.utils": { isPlayableSong: playable },
  "../../shared/storage/localStorage": { makeLocalId: () => "test" },
  "../search/search.utils": { prettyTitle, prettyMeta: (s) => s },
  "../covers/Cover": { getCardCoverUrl: () => "" },
  "../covers/cover.ambient": { getRendererSafeImageUrl: (s) => s || "" }
};
runInNewContext(outputText, {
  exports,
  require(name) {
    if (!Object.hasOwn(dependencies, name)) throw new Error("Unexpected dependency: " + name);
    return dependencies[name];
  }
});

const song = (id, patch = {}) => ({
  id: String(id), title: "Track " + id, artist: "Artist " + (id % 23),
  album: "Album " + (id % 37), filePath: "/music/" + id + ".flac",
  dateAdded: "2026-10-01T00:00:00.000Z", duration: 90 + id % 130,
  playCount: 0, fileExists: true, ...patch
});
const ids = (items) => Array.from(items, (s) => s.id);

function reference(items, query, selectedIds, limit) {
  const selected = new Set(selectedIds);
  return items.filter(playable)
    .filter((entry) => exports.albumSongSearchMatches(entry, query))
    .sort((a, b) => (selected.has(a.id) ? 0 : 1) - (selected.has(b.id) ? 0 : 1)
      || prettyTitle(a.title).localeCompare(prettyTitle(b.title)))
    .slice(0, limit);
}

test("album editor bounded selection preserves title order, selected priority, and stable ties", () => {
  const songs = Array.from({ length: 12000 }, (_, id) =>
    song(id, { title: "Track " + id % 43, fileExists: id % 53 !== 0 })
  );
  const selected = ["77", "90", "13", "111", "11999"];
  for (const query of ["", "track", "artist 1", "album 9", "absent"]) {
    for (const limit of [0, 1, 10, 80, 140]) {
      assert.deepEqual(
        ids(exports.pickAlbumDraftSearchResults(songs, query, selected, limit)),
        ids(reference(songs, query, selected, limit)),
        "query " + query + " limit " + limit
      );
    }
  }
  assert.deepEqual(ids(exports.pickAlbumDraftSearchResults(songs, "track", selected, 80)),
    ids(exports.pickAlbumDraftSearchResults(songs, "track", selected, 80)));
});

test("manual album totals stay accurate without spread argument limits", () => {
  const songs = Array.from({ length: 140000 }, (_, id) => song(id, {
    dateAdded: id === 139999 ? "2026-10-17T00:00:00.000Z" : "2026-10-01T00:00:00.000Z"
  }));
  const byId = new Map(songs.map((entry) => [entry.id, entry]));
  const manual = [{
    id: "long-album", title: "Many tracks", artist: "Artist", year: null,
    songIds: songs.map((entry) => entry.id), createdAt: 0, updatedAt: 1,
    coverUrl: "", sourceType: "manual"
  }];
  const list = exports.buildManualAlbumEntries(manual, byId);
  assert.equal(list.length, 1);
  assert.equal(list[0].trackCount, songs.length);
  assert.equal(list[0].latestAdded, Date.parse("2026-10-17T00:00:00.000Z"));
  assert.equal(list[0].totalDuration, songs.reduce((sum, entry) => sum + entry.duration, 0));
  assert.equal(list[0].songs[0].id, "0");
});

test("album editor does not search and sort songs while closed", () => {
  const controller = read("src/features/albums/useAlbumsController.ts");
  assert.match(controller, /albumBuilderOpen \? pickAlbumDraftSearchResults\(songs, albumDraftSearch, albumDraftSongIds\) : \[\]/);
  assert.match(controller, /\[albumBuilderOpen, songs, albumDraftSearch, albumDraftSongIds\]/);
});

test("Home most-listened work is memoized, bounded, and hidden when unused", () => {
  const home = read("src/features/home/HomeView.tsx");
  assert.match(home, /const mostListenedArtists = useMemo\(\(\) => \{/);
  assert.match(home, /if \(!showMostListened\) return \[\];/);
  assert.match(home, /if \(picked\.size === 10\) break;/);
  assert.match(home, /\[homeListenNowSongs, homeFreshShelfSongs, showMostListened, songs\]/);
  const css = read("src/features/home/home.css");
  assert.match(css, /\.homeSection > h3 \{ margin-bottom: 14px; \}/);
  assert.doesNotMatch(css, /\.homeSectionHead > h3 \{ margin:0; \}/);
});
