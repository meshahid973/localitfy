import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-30T12:00:00Z");

function compile(file, modules = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(output, { exports, require: (name) => modules[Object.keys(modules).find((key) => name.endsWith(key))] });
  return exports;
}
const credits = compile("src/features/artists/artistCredits.ts");
const recommendations = compile("src/features/playlists/playlistRecommendations.ts", { artistCredits: credits });
const prompts = compile("src/features/playlists/promptPlaylist.ts", { artistCredits: credits, playlistRecommendations: recommendations });

const iso = (daysAgo) => daysAgo === null ? null : new Date(NOW - daysAgo * DAY).toISOString();
const song = (id, artist, genre = "", { liked = false, plays = 0, played = null, added = 100, duration = 180, exists = true, album = "Album" } = {}) =>
  ({ id, title: id, artist, album, genre, liked, playCount: plays, lastPlayed: iso(played), dateAdded: iso(added), duration, fileExists: exists });

const library = [
  song("beths-1", "The Beths", "Indie Rock", { liked: true, plays: 3, played: 2, album: "Jump Rope Gazers" }),
  song("beths-2", "The Beths", "Indie Rock", { album: "Jump Rope Gazers" }),
  song("beths-3", "The Beths", "Indie Rock", { liked: true, plays: 9, played: 90 }),
  song("phoebe-1", "Phoebe Bridgers", "Indie Rock; Folk", { plays: 1, played: 60 }),
  song("phoebe-2", "Phoebe Bridgers feat. The Beths", "Indie Rock"),
  song("punk", "Green Day", "Punk Rock", { liked: true, plays: 20, played: 1 }),
  song("kendrick-1", "Kendrick Lamar", "Hip Hop", { plays: 12, played: 3 }),
  song("kendrick-2", "Kendrick Lamar & SZA", "Hip Hop; R&B", { liked: true, plays: 2, played: 120 }),
  song("kanye", "Kanye West", "Hip Hop"),
  song("emo-rap", "brakence", "Emo Rap; Hyperpop", { added: 1 }),
  song("pop-rap", "bbno$", "Pop Rap", { added: 2 }),
  song("love", "Love", "Psychedelic Rock"),
  song("missing", "The Beths", "Indie Rock", { exists: false }),
  ...Array.from({ length: 6 }, (_, index) => song(`pop-${index}`, `Pop Star ${index}`, "Dance-Pop; Synth-Pop", { liked: index < 2 }))
];
const vocabulary = prompts.promptVocabulary(library);
const parse = (text) => prompts.parsePrompt(text, vocabulary);
const build = (text, options = {}) => [...prompts.buildPromptPlaylist(parse(text), library, { now: NOW, ...options })];

test("prompts are read into names, genres, listening phrases, sizes and a sound description", () => {
  let plan = parse("make me a playlist of chill songs I haven't played in a while");
  assert.equal(plan.order, "forgotten");
  assert.equal(plan.sound, "chill songs", "request wording and history phrases are not sent to the sound model");
  assert.equal(plan.name, "Chill songs I haven't played in a while");

  plan = parse("songs like Kendrick but no Kanye, 40 songs");
  assert.deepEqual([...plan.similarTo], ["Kendrick Lamar"], "a distinctive first name finds the artist, even with joint credits");
  assert.deepEqual([...plan.excludeArtists], ["Kanye West"]);
  assert.equal(plan.count, 40);
  assert.equal(plan.sound, "", "nothing left to describe");

  plan = parse("30 songs by The Beths and Phoebe Bridgers");
  assert.deepEqual([...plan.artists].sort(), ["Phoebe Bridgers", "The Beths"]);
  assert.equal(plan.name, "Songs by The Beths and Phoebe Bridgers");

  plan = parse("aggressive rap with heavy bass, half an hour");
  assert.deepEqual([...plan.genreNames], ["rap"]);
  assert.ok(plan.genres.includes("hip hop"), "rap also matches hip hop tags");
  assert.equal(plan.sound, "aggressive rap with heavy bass", "genre words stay in the sound description");
  assert.equal(plan.minutes, 30);
  assert.ok(!plan.genres.includes("bass"), "sound words are not treated as genres");

  plan = parse("indie rock, no hip hop");
  assert.deepEqual([...plan.genreNames], ["indie rock"], "multi-word tags win over their words");
  assert.ok(plan.excludeGenres.includes("hip hop"));
  assert.equal(plan.sound, "");

  plan = parse("love songs");
  assert.deepEqual([...plan.artists], [], "a common word is not read as an artist without by/like");
  assert.equal(plan.sound, "love songs");
  assert.deepEqual([...parse("songs by love").artists], ["Love"]);

  plan = parse("my old favorites, most played first");
  assert.equal(plan.liked, true);
  assert.equal(plan.order, "forgotten", "the first listening phrase decides the order");
  assert.deepEqual([...prompts.describePrompt(parse("liked hip hop, no Kanye, 1 hour"), false)],
    ["hip hop", "no Kanye West", "liked songs", "about 1 h"]);
});

test("names and history phrases filter, genres filter when there are enough, and sound ranks", () => {
  assert.deepEqual(build("songs by Phoebe Bridgers").sort(), ["phoebe-1", "phoebe-2"]);
  assert.ok(!build("indie rock").includes("missing"), "missing files are never picked");
  const likedIndie = build("liked indie rock");
  assert.deepEqual(likedIndie.slice(0, 2).sort(), ["beths-1", "beths-3"]);
  assert.deepEqual(likedIndie.slice(2), ["punk"], "a liked rock song fills in after exact matches; nothing unrelated");
  assert.deepEqual(build("hip hop without kanye").sort(), ["kendrick-1", "kendrick-2"].sort());
  assert.ok(build("rap").includes("emo-rap") && build("rap").includes("kanye"), "rap matches rap and hip hop tags");
  assert.deepEqual(build("indie rock I haven't played in a while").sort(), ["beths-3", "phoebe-1"]);
  assert.deepEqual(build("never played indie rock").slice(0, 2).sort(), ["beths-2", "phoebe-2"]);
  assert.deepEqual(build("most played", { seed: 3 }).slice(0, 3), ["punk", "kendrick-1", "beths-3"]);
  assert.deepEqual(build("5 recently added songs").slice(0, 2), ["emo-rap", "pop-rap"]);
  assert.deepEqual(build("songs I haven't heard", { hidden: (item) => item.artist === "Kanye West" }).includes("kanye"), false,
    "not-for-me songs are left out");

  // A genre with only one song can't fill a playlist; its genre family fills in after it.
  const psychedelic = build("psychedelic songs");
  assert.equal(psychedelic[0], "love");
  assert.ok(psychedelic.length > 1 && psychedelic.every((id) => /beths|phoebe|punk|love/.test(id)));
  assert.deepEqual(build("liked songs by Kanye"), [], "nothing matches rather than unrelated songs");

  const sound = new Map(library.map((item, index) => [item.id, item.id.startsWith("pop-") ? 1 + index / 100 : -index / 100]));
  const upbeat = build("upbeat party songs, 5 songs", { sound });
  assert.equal(upbeat.length, 5);
  assert.ok(upbeat.every((id) => id.startsWith("pop-")), "sound decides when nothing else is asked");
  assert.deepEqual(build("upbeat party songs, 5 songs", { sound }), upbeat, "the same seed gives the same playlist");

  const hour = build("indie rock, 10 minutes");
  assert.equal(hour.length, 4, "duration fills to the requested length");
  assert.ok(build("pop", { seed: 1 }).length <= 25);
  const capped = build("indie, 5 songs", { seed: 2 });
  assert.deepEqual(capped.slice(0, 4).filter((id) => id.startsWith("phoebe")).length, 2, "other artists come before an artist's third song");
  assert.equal(capped.length, 5, "when only a few artists match, the cap fills in rather than cutting the playlist short");
});

test("without audio analysis, recommendations come from artists, genres, albums and shared playlists", () => {
  const seeds = library.filter((item) => ["beths-1", "beths-2"].includes(item.id));
  const playlists = [{ id: "road", name: "road trip", songIds: ["beths-1", "punk", "kanye"] }, { id: "smart", name: "smart", songIds: ["beths-1", "pop-0"], rules: {} }];
  const scores = recommendations.relatedSongScores(seeds, library, playlists);
  const ranked = [...recommendations.rankScores(scores)];
  assert.equal(ranked[0], "beths-3", "same artist first");
  assert.ok(ranked.indexOf("phoebe-2") < ranked.indexOf("phoebe-1"), "a featured credit counts as the artist");
  assert.ok(scores.has("punk") && scores.has("kanye"), "songs that share a playlist are related");
  assert.ok(!scores.has("pop-0"), "smart playlists say nothing about taste");
  assert.ok(!scores.has("beths-1") && !scores.has("missing"), "seeds and missing files are left out");

  const songsById = new Map(library.map((item) => [item.id, item]));
  const pool = ["beths-3", "missing", "pop-0", "pop-1", "pop-2", "pop-3", "pop-4"];
  assert.deepEqual([...recommendations.pickRecommendations(pool, songsById, new Set(["pop-0"]), 3)], ["beths-3", "pop-1", "pop-2"]);
  const solo = new Map(["a", "b", "c", "d"].map((id) => [id, song(id, "Solo")]).concat([["other", song("other", "Other")]]));
  assert.deepEqual([...recommendations.pickRecommendations(["a", "b", "c", "d", "other"], solo, new Set(), 4)], ["a", "b", "c", "other"],
    "at most three songs per artist while other artists are available");
  assert.deepEqual([...recommendations.pickRecommendations(["a", "b", "c", "d"], solo, new Set(), 4)], ["a", "b", "c", "d"], "a page isn't cut short");
});

test("playlists show recommendations with add buttons and offer a prompt dialog", () => {
  const view = fs.readFileSync("src/features/playlists/PlaylistsView.tsx", "utf8");
  const panel = fs.readFileSync("src/features/playlists/components/PlaylistRecommendations.tsx", "utf8");
  const dialog = fs.readFileSync("src/features/playlists/components/PromptPlaylistDialog.tsx", "utf8");
  assert.match(view, /!detailPlaylist\.rules && detailSongs\.length > 0 \? \(\s*<PlaylistRecommendations/, "smart and empty playlist detail pages have no suggestions");
  assert.match(view, /lazy\(\(\) => import\("\.\/components\/PromptPlaylistDialog"\)\)/);
  assert.match(panel, /RECOMMENDATION_PAGE/);
  assert.match(panel, /addSongToPlaylist\(playlist\.id, id\)/);
  assert.match(panel, /findSimilarSongs\(\{ songIds:/, "uses audio similarity when songs are analyzed");
  assert.match(dialog, /type="checkbox"/, "songs can be picked before saving");
  assert.match(dialog, /savePlaylist\(name \|\| result\.plan\.name, picked\)/);
  assert.match(dialog, /sound \|\| planHasLibraryTerms\(plan\) \?/, "a description alone without the prompt model gives no random songs");
});

test("similarity suggestions sample large playlist seed sets without exceeding the native limit", () => {
  const many = Array.from({ length: 6001 }, (_, index) => song(String(index), "Artist"));
  const ids = [...recommendations.audioRecommendationSeeds(many)];
  assert.equal(ids.length, recommendations.MAX_AUDIO_RECOMMENDATION_SEEDS);
  assert.equal(ids[0], "0");
  assert.ok(Number(ids.at(-1)) > 5990, "the whole playlist is sampled");
  assert.equal(new Set(ids).size, 2000, "each seed is distinct");
  assert.deepEqual([...recommendations.audioRecommendationSeeds(many.slice(0, 3))], ["0", "1", "2"]);
});

test("playlist prompt audio actions are passed from the player, not DailyMixesShelf", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8");
  const view = fs.readFileSync("src/features/playlists/PlaylistsView.tsx", "utf8");
  assert.match(view, /playSongs=\{props\.playSongs\}/);
  assert.match(view, /selectSong=\{props\.selectSong\}/);
  assert.doesNotMatch(view, /props\.dailyMixes\.(?:playSongs|selectSong)/);
  assert.match(app, /playSongs: \(ids: string\[\], label: string\) => playAlbumSongs\(ids, label\)/);
});
