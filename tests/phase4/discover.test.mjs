import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createLastfmClient } = require("../../electron/discover/lastfm.cjs");
const { discover, withoutOwned, titleKey } = require("../../electron/discover/recommend.cjs");
const { registerDiscoverIpc } = require("../../electron/ipc/discover.cjs");
const KEY = "0123456789abcdef0123456789abcdef";

function fakeFetch(answers) {
  const calls = [];
  const fetch = async (url) => {
    const params = new URL(url).searchParams;
    calls.push(Object.fromEntries(params));
    const answer = answers(params);
    return { ok: true, status: 200, json: async () => answer };
  };
  return { fetch, calls };
}

test("the Last.fm client sends names only, caches answers on disk and spaces its requests", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-lastfm-"));
  const cacheFile = path.join(dir, "cache.json");
  const waits = [];
  const { fetch, calls } = fakeFetch((params) => params.get("artist") === "Nobody" ? { error: 6, message: "not found" }
    : { similarartists: { artist: [{ name: "Similar One", match: "0.9", url: "https://last.fm/a" }, { name: "", match: "1" }] } });
  try {
    const client = createLastfmClient({ apiKey: KEY, cacheFile, fetch, wait: async (ms) => { waits.push(ms); } });
    assert.deepEqual(await client.similarArtists("Seed Artist"), [{ name: "Similar One", match: .9, url: "https://last.fm/a" }]);
    assert.deepEqual(await client.similarArtists("Nobody"), [], "unknown artists are a normal, empty answer");
    assert.deepEqual(Object.keys(calls[0]).sort(), ["api_key", "artist", "autocorrect", "format", "limit", "method"]);
    assert.equal(calls[0].method, "artist.getsimilar");
    assert.ok(waits.length >= 1 && waits.every((ms) => ms <= 220), "requests are spaced");
    client.flush();
    const again = createLastfmClient({ apiKey: "ffffffffffffffffffffffffffffffff", cacheFile, fetch });
    await again.similarArtists("Seed Artist");
    assert.equal(calls.length, 2, "a cached answer is reused, even after the key changes");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a rejected key and rate limiting become readable errors", async () => {
  for (const [code, expected] of [[10, "bad-key"], [29, "rate-limited"]]) {
    const { fetch } = fakeFetch(() => ({ error: code, message: "nope" }));
    const client = createLastfmClient({ apiKey: KEY, cacheFile: "", fetch, wait: async () => {} });
    await assert.rejects(client.topTracks("Anyone"), (error) => error.code === expected);
  }
  const offline = createLastfmClient({ apiKey: KEY, cacheFile: "", fetch: async () => { throw new Error("offline"); }, wait: async () => {} });
  await assert.rejects(offline.topTracks("Anyone"), /Couldn't reach Last.fm/);
});

const day = 86_400_000;
const NOW = Date.parse("2026-10-22T12:00:00Z");
const songs = [
  { title: "Big Hit", artist: "Loved Band", playCount: 40, liked: true, lastPlayed: new Date(NOW - day).toISOString() },
  { title: "Deep Cut", artist: "Loved Band feat. Guest", playCount: 10 },
  { title: "Other Song", artist: "Second Act", playCount: 3 },
  { title: "Owned Track", artist: "Owned Artist" }
];
const fakeClient = (overrides = {}) => ({
  similarArtists: async (name) => ({
    "Loved Band": [{ name: "New Star", match: .9, url: "u1" }, { name: "Owned Artist", match: 1 }, { name: "Hated Act", match: .95 }, { name: "Shared Pick", match: .4 }],
    "Second Act": [{ name: "Shared Pick", match: .8 }],
    Guest: [{ name: "Guest Friend", match: .5 }]
  }[name] || []),
  topTracks: async (name, limit = 3) => (name === "Loved Band"
    ? [{ title: "Big Hit (2011 Remaster)", artist: name, url: "t" }, { title: "Missing Single", artist: name, url: "m" }]
    : [{ title: `${name} hit`, artist: name, url: "t" }]).slice(0, limit),
  ...overrides
});

test("suggestions skip artists and songs you own or marked, and say why", async () => {
  const result = await discover({ songs, hiddenArtists: ["hated act"], client: fakeClient(), now: NOW });
  assert.equal(result.status, "ready");
  assert.deepEqual(result.seeds.slice(0, 2), ["Loved Band", "Second Act"]);
  assert.deepEqual(result.artists.map((artist) => artist.name), ["New Star", "Shared Pick", "Guest Friend"]);
  assert.deepEqual(result.artists[1].because, ["Loved Band", "Second Act"], "reasons are ordered by how much they count: your most-played artist first");
  assert.equal(result.artists[1].seedCount, 2);
  assert.deepEqual(result.artists[0].topTracks, [{ title: "New Star hit", artist: "New Star", url: "t" }]);
  assert.deepEqual(result.tracks.map((track) => [track.artist, track.title]),
    [["Loved Band", "Missing Single"], ["Second Act", "Second Act hit"], ["Guest", "Guest hit"], ["Owned Artist", "Owned Artist hit"]],
    "popular songs by artists you play that you don't have, even counting remasters as owned");
  assert.equal(titleKey("Song (feat. X) - 2011 Remaster"), "song");
});

test("one unknown artist doesn't sink the rest, but a bad key does, and an empty library asks for listening first", async () => {
  const flaky = fakeClient({ similarArtists: async (name) => { if (name === "Guest") throw new Error("boom"); return fakeClient().similarArtists(name); } });
  assert.equal((await discover({ songs, client: flaky, now: NOW })).status, "ready");
  const badKey = fakeClient({ similarArtists: async () => { throw Object.assign(new Error("bad key"), { code: "bad-key" }); } });
  await assert.rejects(discover({ songs, client: badKey, now: NOW }), /bad key/);
  assert.equal((await discover({ songs: [], client: fakeClient(), now: NOW })).status, "no-taste");
});

test("one favourite artist can't fill the page", async () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ name: `Brakence-like ${i}`, match: .95 - i * .01 }));
  const client = fakeClient({ similarArtists: async (name) => name === "Loved Band" ? many : name === "Second Act" ? [{ name: "Other Lead", match: .9 }] : [] });
  const names = (await discover({ songs, client, now: NOW })).artists.map((artist) => artist.name);
  assert.ok(names.indexOf("Other Lead") < 4, names.join(", "));
});

test("a saved result drops what you've added or marked since", async () => {
  const result = await discover({ songs, client: fakeClient(), now: NOW });
  const later = withoutOwned(result, { songs: [...songs, { title: "Missing Single", artist: "Loved Band" }], hiddenArtists: ["Shared Pick", "Guest"] });
  assert.deepEqual(later.artists.map((artist) => artist.name), ["Hated Act", "New Star", "Guest Friend"]);
  assert.deepEqual(later.tracks.map((track) => track.title), ["Second Act hit", "Owned Artist hit"]);
});

test("Discover stays off until turned on, needs a valid key, and reuses today's result", async () => {
  const handlers = new Map();
  const router = { handle: (channel, handler) => handlers.set(channel, handler) };
  const settings = { discoverEnabled: false, lastfmApiKey: "" };
  let requests = 0;
  const fetch = async () => { requests += 1; return { ok: true, status: 200, json: async () => ({}) }; };
  let clock = NOW;
  registerDiscoverIpc(router, { getSongs: () => songs, getSettings: () => settings, cacheFile: "", fetch, now: () => clock });
  const get = (payload) => handlers.get("discover:get")({}, payload);
  assert.equal((await get()).status, "off");
  settings.discoverEnabled = true;
  assert.equal((await get()).status, "needs-key");
  settings.lastfmApiKey = "not a key";
  assert.equal((await get()).status, "needs-key");
  settings.lastfmApiKey = KEY;
  assert.equal((await get()).status, "ready");
  const used = requests;
  assert.equal((await get()).status, "ready");
  assert.equal(requests, used, "the saved result is reused");
  clock += 13 * 60 * 60 * 1000;
  await get();
  assert.ok(requests > used, "and refreshed after half a day");
});

test("top tracks whose credited artist is hidden are never suggested", async () => {
  const client = fakeClient({ topTracks: async (name) => [
    { title: "Blocked song", artist: "Hidden Guest", url: "b" },
    { title: "Allowed song", artist: name, url: "a" }
  ] });
  const result = await discover({ songs, hiddenArtists: ["Hidden Guest"], client, now: NOW });
  assert.equal(result.status, "ready");
  assert.ok(result.artists.every((artist) => artist.topTracks.every((track) => track.artist !== "Hidden Guest")));
  assert.ok(result.tracks.every((track) => track.artist !== "Hidden Guest"));
  const cached = withoutOwned(
    { ...result, tracks: [...result.tracks, { title: "Cached hidden", artist: "Hidden Guest" }],
      artists: result.artists.map((artist) => ({ ...artist, topTracks: [...artist.topTracks, { title: "Cached hidden", artist: "Hidden Guest" }] })) },
    { songs, hiddenArtists: ["Hidden Guest"] }
  );
  assert.ok(cached.artists.every((artist) => artist.topTracks.every((track) => track.artist !== "Hidden Guest")));
  assert.ok(cached.tracks.every((track) => track.artist !== "Hidden Guest"));
});

test("Discover UI guards late responses and synchronizes dismissals", () => {
  const view = fs.readFileSync("src/features/discover/DiscoverView.tsx", "utf8");
  const ipc = fs.readFileSync("electron/ipc/discover.cjs", "utf8");
  assert.match(view, /requestVersionRef\.current/);
  assert.match(view, /const dismissArtist = /);
  assert.match(view, /setPicked\(\(current\) => new Map/);
  assert.match(ipc, /running\?\.apiKey === apiKey/);
  assert.match(ipc, /running\?\.promise === promise/);
});
