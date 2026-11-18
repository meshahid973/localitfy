import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const read = (relative) => fs.readFileSync(relative, "utf8");

function loadCommonJs(relative) {
  const { outputText } = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  const module = { exports: {} };
  runInNewContext(outputText, { module, exports: module.exports });
  return module.exports;
}

const layout = loadCommonJs("src/features/home/homeLayout.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const defaults = ["jumpBack", "listenNow", "dailyMixes", "recentlyPlayed", "mostListened", "newReleases", "likedSongs", "rediscover", "notPlayedYet"];
const defaultHidden = ["likedSongs", "rediscover", "notPlayedYet"];
const defaultVisible = defaults.filter((id) => !defaultHidden.includes(id));

test("Home shows the default sections in order until customized", () => {
  assert.deepEqual(plain(layout.defaultHiddenHomeSections), defaultHidden);
  assert.deepEqual(plain(layout.visibleHomeSections([], defaultHidden)), defaultVisible);
  assert.deepEqual(plain(layout.visibleHomeSections(undefined, [])), defaults);
  assert.equal(layout.isHomeLayoutCustomized([], defaultHidden), false);
  assert.equal(layout.isHomeLayoutCustomized(defaults, [...defaultHidden].reverse()), false);
  assert.equal(layout.isHomeLayoutCustomized([], []), true);
});

test("saved order wins, unknown ids are dropped and new sections are appended", () => {
  assert.deepEqual(plain(layout.resolveHomeSectionOrder(["newReleases", "newAlbums", "bogus", "listenNow", "newReleases"])), ["newReleases", "listenNow", "jumpBack", "dailyMixes", "recentlyPlayed", "mostListened", "likedSongs", "rediscover", "notPlayedYet"]);
  assert.deepEqual(plain(layout.normalizeHomeHidden("listenNow")), []);
  assert.deepEqual(plain(layout.normalizeHomeHidden(["listenNow", "bogus", "listenNow"])), ["listenNow"]);
});

test("sections move one step and stop at the ends", () => {
  assert.deepEqual(plain(layout.moveHomeSection([], "listenNow", -1)).slice(0, 3), ["listenNow", "jumpBack", "dailyMixes"]);
  assert.deepEqual(plain(layout.moveHomeSection([], "jumpBack", -1)), defaults);
  assert.equal(layout.canMoveHomeSection([], "jumpBack", -1), false);
  assert.equal(layout.canMoveHomeSection([], "notPlayedYet", 1), false);
  assert.equal(layout.canMoveHomeSection([], "listenNow", 1), true);
  assert.equal(layout.isHomeLayoutCustomized(layout.moveHomeSection([], "listenNow", -1), defaultHidden), true);
});

test("hiding a section removes it from Home and keeps its place for later", () => {
  const hidden = layout.toggleHomeSectionHidden([], "mostListened");
  assert.deepEqual(plain(hidden), ["mostListened"]);
  assert.deepEqual(plain(layout.visibleHomeSections([], hidden)), defaults.filter((id) => id !== "mostListened"));
  assert.equal(layout.isHomeLayoutCustomized([], hidden), true);
  assert.deepEqual(plain(layout.toggleHomeSectionHidden(hidden, "mostListened")), []);
});

test("Customize Home edits the layout instead of opening Covers", () => {
  const home = read("src/features/home/HomeView.tsx");
  assert.match(home, /<HomeCustomizePanel/);
  assert.doesNotMatch(home, /className="homeCustomizeButton" type="button" onClick=\{openCoversViewWithCurrentSong\}/);
  const app = read("src/App.tsx");
  assert.match(app, /updateHomeLayout: homeUpdateLayout/);
  assert.match(app, /homeUpdateLayout = useStableCallback\([^\n]*updateSettingsPatch\(patch\)/);
  assert.match(read("src/features/settings/settings.constants.ts"), /homeSectionOrder:\[\],homeHiddenSections:\["likedSongs","rediscover","notPlayedYet"\]/);
  assert.match(read("src/features/home/HomeCustomizePanel.tsx"), /homeHiddenSections: \[\.\.\.defaultHiddenHomeSections\]/);
});

const picks = loadCommonJs("src/features/home/homeShelfPicks.ts");
const now = new Date("2026-10-19T12:00:00");
const daysAgo = (days) => new Date(now.getTime() - days * 86400000).toISOString();
const song = (id, extra = {}) => ({ id, title: id, artist: "a", filePath: `/m/${id}.mp3`, playCount: 0, liked: false, dateAdded: daysAgo(100), ...extra });
const ids = (list) => Array.from(list, (entry) => entry.id);

test("Recently played lists played songs newest first and skips missing files", () => {
  const songs = [song("old", { lastPlayed: daysAgo(5) }), song("never"), song("new", { lastPlayed: daysAgo(1) }), song("gone", { lastPlayed: daysAgo(0), fileExists: false })];
  assert.deepEqual(ids(picks.pickRecentlyPlayed(songs)), ["new", "old"]);
});


test("Liked, Rediscover and Not played yet pick the right songs", () => {
  const songs = [
    song("liked-few", { liked: true, playCount: 1 }), song("liked-many", { liked: true, playCount: 9 }),
    song("forgotten", { playCount: 12, lastPlayed: daysAgo(60) }), song("recent-fave", { playCount: 20, lastPlayed: daysAgo(2) }),
    song("barely", { playCount: 1, lastPlayed: daysAgo(90) }), song("fresh-a"), song("fresh-b")
  ];
  assert.deepEqual(ids(picks.pickLikedSongs(songs)), ["liked-many", "liked-few"]);
  assert.deepEqual(ids(picks.pickRediscover(songs, now)), ["forgotten"]);
  const unplayed = ids(picks.pickNotPlayedYet(songs, now));
  assert.deepEqual([...unplayed].sort(), ["fresh-a", "fresh-b"]);
  assert.deepEqual(ids(picks.pickNotPlayedYet(songs, now)), unplayed, "the shuffle holds for the whole day");
});


test("Home selection preserves full-sort order across large libraries and ties", () => {
  const source = Array.from({ length: 12000 }, (_, index) => song(String(index), {
    liked: index % 7 === 0,
    playCount: (index * 13) % 31,
    lastPlayed: index % 11 === 0 ? undefined : daysAgo(index % 65)
  }));
  const playable = (entry) => !!(entry.filePath || entry.url) && entry.fileExists !== false;
  const parsed = (entry) => Number.isFinite(Date.parse(String(entry.lastPlayed || "")))
    ? Date.parse(String(entry.lastPlayed || "")) : 0;
  const reference = {
    recent: source.filter((entry) => playable(entry) && parsed(entry) > 0)
      .sort((a,b) => parsed(b) - parsed(a)).slice(0, 10),
    liked: source.filter((entry) => entry.liked && playable(entry))
      .sort((a,b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 10),
    rediscover: source.filter((entry) => playable(entry) && (entry.playCount || 0) >= 3 &&
      parsed(entry) > 0 && parsed(entry) < now.getTime() - 30 * 86400000)
      .sort((a,b) => (b.playCount || 0) - (a.playCount || 0) || parsed(a) - parsed(b)).slice(0, 10)
  };
  assert.deepEqual(ids(picks.pickRecentlyPlayed(source)), ids(reference.recent));
  assert.deepEqual(ids(picks.pickLikedSongs(source)), ids(reference.liked));
  assert.deepEqual(ids(picks.pickRediscover(source, now)), ids(reference.rediscover));
  assert.deepEqual(ids(picks.pickLikedSongs(source, 1)), ids(reference.liked.slice(0, 1)));
  assert.deepEqual(ids(picks.pickRecentlyPlayed(source, 0)), []);
});

test("Home shelf order remains stable for equal timestamps and hashes", () => {
  const tied = [song("a", {liked: true,playCount: 5,lastPlayed: daysAgo(2)}),
    song("b", {liked: true,playCount: 5,lastPlayed: daysAgo(2)}),
    song("c", {liked: true,playCount: 5,lastPlayed: daysAgo(2)})];
  assert.deepEqual(ids(picks.pickRecentlyPlayed(tied, 2)), ["a","b"]);
  assert.deepEqual(ids(picks.pickLikedSongs(tied, 2)), ["a","b"]);
});

test("Customize Home restores focus and moves away from disabled arrows", () => {
  const panel = read("src/features/home/HomeCustomizePanel.tsx");
  const home = read("src/features/home/HomeView.tsx");
  const css = read("src/features/home/home.css");
  assert.match(panel, /document\.querySelector<HTMLElement>\("\.homeCustomizeButton"\)\?\.focus\(\)/);
  assert.match(panel, /event\.currentTarget\.nextElementSibling/);
  assert.match(panel, /event\.currentTarget\.previousElementSibling/);
  assert.match(home, /lazy\(\(\) => import\("\.\/HomeCustomizePanel"\)\)/);
  assert.match(css, /max-height: min\(520px, calc\(100dvh - 120px\)\)/);
});


test("Daily mix artwork is distinct, ordered, and limited to four covers", () => {
  const tracks = [
    song("first", { coverThumbUrl: "/shared.webp" }),
    song("second", { coverThumbUrl: "/shared.webp" }),
    song("fallback"),
    song("third", { coverUrl: "/third.png" }),
    song("fourth", { coverPath: "/fourth.png" }),
    song("fifth", { coverUrl: "/fifth.png" })
  ];
  assert.deepEqual(ids(picks.pickHomeMixArtwork(tracks)), ["first", "third", "fourth", "fifth"]);
  assert.deepEqual(ids(picks.pickHomeMixArtwork([])), []);
  assert.deepEqual(ids(picks.pickHomeMixArtwork([tracks[0], tracks[1]])), ["first"]);
  assert.deepEqual(ids(picks.pickHomeMixArtwork(tracks.slice(0, 3))), ["first", "fallback"]);
  assert.equal(tracks.length, 6);
});


test("Most played shelves rank real listening history and exclude unplayed or missing tracks", () => {
  const source = [song("new"), song("two", { playCount: 2 }), song("old", { playCount: 10, lastPlayed: daysAgo(30) }), song("recent", { playCount: 10, lastPlayed: daysAgo(1) }), song("missing", { playCount: 100, fileExists: false })];
  assert.deepEqual(ids(picks.pickMostPlayedSongs(source)), ["recent", "old", "two"]);
  assert.deepEqual(ids(picks.pickMostPlayedSongs(source, 1)), ["recent"]);
  assert.deepEqual(ids(picks.pickMostPlayedSongs(source, 0)), []);
});

test("recently added uses bounded stable newest-first selection", () => {
  const tracks = [song("old", {dateAdded: "2024-01-01"}), song("new", {dateAdded: "2026-01-01"}), song("tie", {dateAdded: "2026-01-01"}), song("invalid", {dateAdded: ""})];
  assert.deepEqual(ids(picks.pickRecentlyAdded(tracks, 2)), ["new", "tie"]);
  assert.deepEqual(ids(picks.pickRecentlyAdded(tracks, 4)), ["new", "tie", "old", "invalid"]);
  assert.deepEqual(ids(picks.pickRecentlyAdded(tracks, 0)), []);
});

test("Listen Now prioritizes real history, filters missing files and diversifies known artists", () => {
  const tracks = [song("gone",{fileExists:false,playCount:1000}),song("current",{artist:"other"}),song("favorite",{liked:true,playCount:20,lastPlayed:daysAgo(1)}),song("second",{playCount:19,lastPlayed:daysAgo(2)}),song("third",{playCount:18}),song("other",{artist:"b",playCount:2}),song("favorite",{playCount:100})];
  const result = ids(picks.pickListenNow(tracks,"current",now,4));
  assert.equal(result[0],"current");
  assert.ok(result.includes("favorite") && result.includes("other"));
  assert.equal(new Set(result).size,result.length);
  assert.ok(!result.includes("gone"));
  assert.deepEqual(ids(picks.pickListenNow(tracks,null,now,0)),[]);
});
test("recommendations avoid repeated IDs when possible and refill sparse shelves", () => {
  const a=song("a"), b=song("b"), c=song("c"), missing=song("missing",{fileExists:false});
  assert.deepEqual(ids(picks.diversifyHomeRecommendations([a,a,b,c,missing],[a],3)),["b","c","a"]);
  assert.deepEqual(ids(picks.pickRecentlyAdded([missing,a],2)),["a"]);
});
