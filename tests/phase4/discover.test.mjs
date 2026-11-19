import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createLastfmClient, bioText } = require("../../electron/discover/lastfm.cjs");
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

test("artist biographies become plain text without Last.fm's link and license footer", async () => {
  assert.equal(bioText("Worked with A,    B."), "Worked with A, B.", "runs of spaces left by removed links collapse");
  assert.equal(bioText("Tom &amp; Jerry&#39;s band &#8212; formed in 1999.<br><br>Second <b>part</b>. <a href=\"https://www.last.fm/music/X\">Read more on Last.fm</a>. User-contributed text is available under the Creative Commons By-SA License; additional terms may apply."),
    "Tom & Jerry's band — formed in 1999.\n\nSecond part.");
  const { fetch, calls } = fakeFetch((params) => params.get("artist") === "Nobody" ? { artist: { name: "Nobody", bio: { summary: " <a href=\"x\">Read more on Last.fm</a>", content: "" } } }
    : { artist: { name: "Real Name", url: "https://www.last.fm/music/Real+Name", bio: { summary: "Short.", content: "Short.\n\nLonger story." } } });
  const client = createLastfmClient({ apiKey: KEY, cacheFile: "", fetch, wait: async () => {} });
  assert.deepEqual(await client.artistInfo("real name"), { name: "Real Name", url: "https://www.last.fm/music/Real+Name", summary: "Short.", content: "Short.\n\nLonger story." });
  assert.equal(bioText("&lt;script&gt;alert(1)&lt;/script&gt;"), "alert(1)", "encoded markup must never produce active tags");
  assert.equal(bioText("Collab <a title=\"1 > 0\" href=\"x\">Artist</a>"), "Collab Artist", "quoted angle brackets in attributes do not leak");
  assert.equal(bioText("2 < 3"), "2 < 3", "ordinary comparison text remains readable");
  assert.equal(calls[0].method, "artist.getinfo");
  assert.equal(await client.artistInfo("Nobody"), null, "an empty biography is no biography");
});

test("artist biographies follow the Discover opt-in, are saved on disk and still show when Last.fm can't be reached", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-bio-"));
  const bioFile = path.join(dir, "artist-bios.json");
  const handlers = new Map();
  const router = { handle: (channel, handler) => handlers.set(channel, handler) };
  const settings = { discoverEnabled: false, lastfmApiKey: KEY };
  let requests = 0;
  let online = true;
  const fetch = async () => {
    requests += 1;
    if (!online) throw new Error("offline");
    return { ok: true, status: 200, json: async () => ({ artist: { name: "Loved Band", url: "u", bio: { summary: "Hi.", content: "Hi. More." } } }) };
  };
  let clock = NOW;
  try {
    registerDiscoverIpc(router, { getSongs: () => songs, getSettings: () => settings, cacheFile: "", bioFile, fetch, now: () => clock });
    const bio = (artist) => handlers.get("discover:artist-bio")({}, { artist });
    assert.equal((await bio("Loved Band")).status, "off");
    assert.equal(requests, 0, "nothing is sent before Discover is turned on");
    settings.discoverEnabled = true;
    assert.deepEqual(await bio("Loved Band"), { status: "ready", name: "Loved Band", url: "u", summary: "Hi.", content: "Hi. More." });
    await Promise.all([bio("loved band"), bio("LOVED BAND")]);
    assert.equal(requests, 1, "a saved biography is reused");
    assert.ok(JSON.parse(fs.readFileSync(bioFile, "utf8"))["loved band"]);

    online = false;
    clock += 31 * day;
    const fresh = new Map();
    registerDiscoverIpc({ handle: (channel, handler) => fresh.set(channel, handler) }, { getSongs: () => songs, getSettings: () => settings, cacheFile: "", bioFile, fetch, now: () => clock });
    assert.equal((await fresh.get("discover:artist-bio")({}, { artist: "Loved Band" })).status, "ready", "an old biography beats none while offline");
    assert.equal((await fresh.get("discover:artist-bio")({}, { artist: "Second Act" })).status, "error");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});


test("artist biography cache rejects malformed entries and keeps valid old data across failed atomic writes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-bio-validation-"));
  const bioFile = path.join(dir, "artist-bios.json");
  const legacyBio = { name: "Legacy", url: "u", summary: "Old.", content: "Old biography." };
  const initial = Object.fromEntries([
    ["legacy", { at: "bad timestamp", bio: legacyBio }],
    ["null entry", null], ["array entry", []], ["primitive entry", "bad"],
    ["malformed bio", { at: NOW, bio: { content: 22 } }],
    ["__proto__", { at: NOW, bio: { name: "__proto__", url: "u", summary: "Safe.", content: "Safe." } }]
  ]);
  fs.writeFileSync(bioFile, JSON.stringify(initial));
  const originalFile = fs.readFileSync(bioFile, "utf8");
  const settings = { discoverEnabled: true, lastfmApiKey: KEY };
  const handlers = new Map();
  let online = false;
  const fetch = async (url) => {
    if (!online) throw new Error("offline");
    const artist = new URL(url).searchParams.get("artist");
    return { ok: true, status: 200, json: async () => ({
      artist: { name: artist, url: "u", bio: { summary: "New.", content: "New biography." } }
    }) };
  };
  try {
    registerDiscoverIpc({ handle: (channel, handler) => handlers.set(channel, handler) },
      { getSongs: () => songs, getSettings: () => settings, cacheFile: "", bioFile, fetch, now: () => NOW });
    const bio = (artist) => handlers.get("discover:artist-bio")({}, { artist });
    assert.deepEqual(await bio("legacy"), { status: "ready", ...legacyBio },
      "invalid timestamps must still permit offline fallback");
    assert.equal((await bio("null entry")).status, "error", "null cache entries must not break the handler");
    assert.equal((await bio("__proto__")).status, "ready", "unusual artist names must not poison object prototypes");
    online = true;
    const originalRename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (to === bioFile) throw new Error("simulated cache rename failure");
      return originalRename(from, to);
    };
    try {
      assert.equal((await bio("First new artist")).status, "ready");
    } finally {
      fs.renameSync = originalRename;
    }
    assert.equal(fs.readFileSync(bioFile, "utf8"), originalFile,
      "failed rename must preserve the original complete cache");
    assert.deepEqual(fs.readdirSync(dir), ["artist-bios.json"], "failed writes must clean up temporary files");

    assert.equal((await bio("Second new artist")).status, "ready");
    const saved = JSON.parse(fs.readFileSync(bioFile, "utf8"));
    assert.equal(saved.legacy.bio.summary, legacyBio.summary);
    assert.equal(saved["first new artist"].bio.summary, "New.");
    assert.equal(saved["second new artist"].bio.summary, "New.");
    assert.ok(Object.hasOwn(saved, "__proto__"), "unusual artist names must persist as ordinary data");
    for (const bad of ["null entry", "array entry", "primitive entry", "malformed bio"]) {
      assert.equal(Object.hasOwn(saved, bad), false, bad + " must not be persisted");
    }
    assert.deepEqual(fs.readdirSync(dir), ["artist-bios.json"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("artist biography requests remain isolated when the API key or Discover setting changes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-bio-key-"));
  const bioFile = path.join(dir, "artist-bios.json");
  const nextKey = "ffffffffffffffffffffffffffffffff";
  const settings = { discoverEnabled: true, lastfmApiKey: KEY };
  const handlers = new Map();
  const responders = new Map();
  const fetch = (url) => new Promise((resolve) => {
    responders.set(new URL(url).searchParams.get("api_key"), resolve);
  });
  try {
    registerDiscoverIpc({ handle: (channel, handler) => handlers.set(channel, handler) },
      { getSongs: () => songs, getSettings: () => settings, cacheFile: "", bioFile, fetch, now: () => NOW });
    const bio = (artist) => handlers.get("discover:artist-bio")({}, { artist });
    const oldRequest = bio("Switched Artist");
    settings.lastfmApiKey = nextKey;
    const newRequest = bio("Switched Artist");
    assert.equal(responders.size, 2, "a new API key must not reuse the old key's pending request");
    const respond = (apiKey, summary) => responders.get(apiKey)({
      ok: true, status: 200, json: async () => ({
        artist: { name: "Switched Artist", url: "u", bio: { summary, content: summary } }
      })
    });
    respond(nextKey, "New key biography");
    assert.equal((await newRequest).summary, "New key biography");
    respond(KEY, "Obsolete biography");
    assert.equal((await oldRequest).status, "needs-key");
    assert.equal(JSON.parse(fs.readFileSync(bioFile, "utf8"))["switched artist"].bio.summary, "New key biography");
    settings.discoverEnabled = false;
    assert.equal((await bio("Switched Artist")).status, "off");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("public catalog search requires opt-in but never a Last.fm key", async () => {
  const handlers = new Map();
  const settings = { discoverEnabled: false, lastfmApiKey: "" };
  const id = "12345678-1234-1234-1234-123456789abc";
  const calls = [];
  const client = { searchCatalog: async (kind, term) => {
    calls.push([kind, term]);
    return [{ id, title: "Track", name: "Artist", "artist-credit": [{ name: "Artist" }], url: "javascript:bad" }, { id, title: "Duplicate" }, { id: "invalid", title: "Unsafe" }];
  } };
  registerDiscoverIpc({ handle: (channel, handler) => handlers.set(channel, handler) }, { getSongs: () => songs, getSettings: () => settings, musicBrainzClient: client });
  const search = (kind, term) => handlers.get("discover:get")({}, { catalog: { kind, term } });
  assert.equal((await search("recording", "Track")).status, "off");
  assert.equal(calls.length, 0);
  settings.discoverEnabled = true;
  assert.equal((await search("invalid", "Track")).status, "error");
  assert.equal((await search("album", "Track")).status, "error");
  assert.equal((await search("artist", "x".repeat(161))).status, "error");
  for (const [kind, endpoint] of [["recording", "recording"], ["artist", "artist"]]) {
    const result = await search(kind, " Track ");
    assert.equal(result.status, "catalog");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].url, "https://musicbrainz.org/" + endpoint + "/" + id);
  }
  assert.deepEqual(calls, [["recording", "Track"], ["artist", "Track"]]);
});
test("catalog searches share an in-flight request and drop responses after opt-out", async () => {
  const handlers = new Map();
  const settings = { discoverEnabled: true };
  let release;
  let calls = 0;
  const musicBrainzClient = { searchCatalog: () => { calls++; return new Promise(resolve => { release = resolve; }); } };
  registerDiscoverIpc({ handle: (channel, handler) => handlers.set(channel, handler) }, { getSongs: () => [], getSettings: () => settings, musicBrainzClient });
  const search = term => handlers.get("discover:get")({}, { catalog: { kind: "recording", term } });
  const first = search("Track");
  const second = search("track");
  assert.equal((await search("Other")).status, "error");
  assert.equal(calls, 1);
  settings.discoverEnabled = false;
  release([]);
  assert.equal((await first).status, "off");
  assert.equal((await second).status, "off");
});

test("Discover permits opt-in with a blank key and sends explicit catalog searches", () => {
  const view = fs.readFileSync("src/features/discover/DiscoverView.tsx", "utf8");
  const android = fs.readFileSync("src/platform/android/bridge.ts", "utf8");
  assert.match(view, /disabled=\{Boolean\(keyDraft.trim\(\)\) && !API_KEY.test/);
  assert.match(view, /getDiscoveries\(\{ catalog: \{ kind: catalogKind, term \} \}\)/);
  assert.match(view, /catalogRequestRef.current/);
  assert.match(android, /payload\?\.catalog \|\| payload\?\.artwork\) \? fromMac<DiscoverResult>/);
});

test("artwork uses validated releases and rejects ambiguous tracks", async () => {
  const { catalogArtwork, matchRecordingArtwork, createArtworkLookup } = require("../../electron/discover/artwork.cjs");
  const id = "12345678-1234-1234-1234-123456789abc";
  const item = { title:"Track",length:123000,"artist-credit":[{name:"Artist"}],releases:[{id,status:"Official"}] };
  assert.equal(catalogArtwork("recording",item).coverUrl,"https://coverartarchive.org/release/"+id+"/front-250");
  assert.equal(catalogArtwork("album",{id}).coverUrl,"https://coverartarchive.org/release-group/"+id+"/front-250");
  assert.deepEqual(matchRecordingArtwork([item],"Other","Artist"),{});
  assert.deepEqual(matchRecordingArtwork([item,item],"Track","Artist"),{});
  assert.equal(catalogArtwork("recording",{releases:[{id:"bad"}]}).coverUrl,undefined);
  let calls=0;
  const lookup=createArtworkLookup({searchRecordings:async()=>{calls++;return [item];}});
  const [a,b]=await Promise.all([lookup("Track","Artist"),lookup("track","artist")]);
  assert.deepEqual(a,b); assert.equal(a.durationMs,123000);
  await lookup("Track","Artist"); assert.equal(calls,1);
});
test("artwork lookup respects opt-in", async () => {
  const handlers=new Map(), settings={discoverEnabled:false};
  let calls=0,finish;
  registerDiscoverIpc({handle:(channel,handler)=>handlers.set(channel,handler)},{getSongs:()=>[],getSettings:()=>settings,musicBrainzClient:{searchRecordings:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}}});
  const request=()=>handlers.get("discover:get")({}, {artwork:{title:"Track",artist:"Artist"}});
  assert.equal((await request()).status,"off"); assert.equal(calls,0);
  settings.discoverEnabled=true; const pending=request(); for (let attempts=0; !finish && attempts<20; attempts++) await Promise.resolve(); assert.equal(typeof finish,"function");
  settings.discoverEnabled=false; finish([]);
  assert.equal((await pending).status,"off");
});

test("Discover lazy renderer modules parse as TSX", () => {
  const ts = require("typescript");
  for (const file of ["src/features/discover/DiscoverView.tsx", "src/features/discover/DiscoverArtwork.tsx"]) {
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      fileName: file, reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 }
    });
    const errors = (output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, " ")), [], file);
  }
});
test("external telemetry SDK stays removed and scripts remain restricted", () => {
  assert.equal(fs.existsSync("src/analytics.ts"), false);
  const entry = fs.readFileSync("src/main.tsx", "utf8");
  assert.doesNotMatch(entry, /posthog|["']\.\/analytics["']/i);
  const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  assert.ok(!manifest.dependencies?.["posthog-js"] && !manifest.devDependencies?.["posthog-js"]);
  assert.ok(!Object.keys(lock.packages).some(name => /(?:^|\/)posthog-js$|@posthog\//.test(name)));
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /script-src 'self';/);
});

test("Discover uses verified Last.fm track art and tries multiple valid releases", async () => {
  const { lastfmArtwork, catalogArtwork, createArtworkLookup } = require("../../electron/discover/artwork.cjs");
  const image="https://lastfm.freetls.fastly.net/i/u/300x300/123456789abcdef0123456789abcdef0.png";
  const track={name:"Song",artist:{name:"Artist"},album:{image:[{"#text":image}]}};
  assert.equal(lastfmArtwork(track,"song","artist").coverUrl,image);
  assert.deepEqual(lastfmArtwork(track,"wrong","artist"),{});
  assert.deepEqual(lastfmArtwork({...track,album:{image:[{"#text":image.replace("123456789abcdef0123456789abcdef0","2a96cbd8b46e442fc41c2b86b821562f")} ]}},"song","artist"),{});
  const lookup=createArtworkLookup({searchRecordings:async()=>{throw Error("unneeded");}},Date.now,async()=>track);
  assert.equal((await lookup("song","artist")).coverUrl,image);
  const art=catalogArtwork("recording",{releases:[{id:"12345678-1234-1234-1234-123456789abc"},{id:"22345678-1234-1234-1234-123456789abc"}]});
  assert.equal(art.coverAlternatives.length,2);
});


test("direct music catalog is explicit, preferred, and falls back after provider failure", async () => {
  const handlers = new Map(), settings = { discoverEnabled: false };
  const directItem = { id: "ytmusic:abcdefghijk", title: "Track", artist: "Artist", url: "https://www.youtube.com/watch?v=abcdefghijk" };
  const calls=[];
  let fail=false;
  registerDiscoverIpc({handle:(channel,handler)=>handlers.set(channel,handler)}, {
    getSongs:()=>[],getSettings:()=>settings,
    musicBrainzClient:{searchCatalog:async(kind,term)=>{calls.push(["fallback",kind,term]);return [{id:"12345678-1234-1234-1234-123456789abc",title:"Track","artist-credit":[{name:"Artist"}]}];}},
    searchYouTubeMusic:async(kind,term)=>{calls.push(["direct",kind,term]);if(fail)throw Error("offline");return [directItem];}
  });
  const get=payload=>handlers.get("discover:get")({},payload);
  assert.equal((await get({catalog:{kind:"recording",term:"Track"}})).status,"off");
  assert.equal(calls.length,0);
  settings.discoverEnabled=true;
  assert.equal((await get({})).status,"needs-key");
  assert.equal(calls.length,0,"opening discovery does not send local seeds to YouTube");
  assert.deepEqual((await get({catalog:{kind:"recording",term:"Track"}})).items,[directItem]);
  assert.deepEqual(calls,[["direct","recording","Track"]]);
  fail=true;
  assert.equal((await get({catalog:{kind:"recording",term:"Track"}})).items[0].title,"Track");
  assert.deepEqual(calls.slice(1),[["direct","recording","Track"],["fallback","recording","Track"]]);
});


test("related music uses an explicit validated seed and observes discovery opt-out",async()=>{
 const handlers=new Map(),settings={discoverEnabled:false};let calls=0;
 registerDiscoverIpc({handle:(channel,handler)=>handlers.set(channel,handler)},{getSongs:()=>[],getSettings:()=>settings,musicBrainzClient:{},searchYouTubeMusicRadio:async seed=>{calls++;assert.equal(seed,"abcdefghijk");return [];}});
 const get=seed=>handlers.get("discover:get")({},{catalog:{kind:"recording",term:"seed",radioSeed:seed}});
 assert.equal((await get("abcdefghijk")).status,"off");assert.equal(calls,0);
 settings.discoverEnabled=true;assert.equal((await get("bad")).status,"error");assert.equal(calls,0);
 assert.equal((await get("abcdefghijk")).status,"catalog");assert.equal(calls,1);
});


test("recommendation artwork uses verified catalog metadata before slower providers",async()=>{
 const {createArtworkLookup,matchMusicArtwork}=require("../../electron/discover/artwork.cjs");
 const candidate={title:"Song",artist:"Artist",coverUrl:"https://lh3.googleusercontent.com/abc=w256-h256-l90-rj",durationMs:123000};
 let calls=0;
 const lookup=createArtworkLookup({searchRecordings:async()=>{throw Error("unneeded");}},Date.now,async()=>{throw Error("unneeded");},undefined,async()=>{calls++;return [candidate];});
 const results=await Promise.all([lookup("Song","Artist - Topic"),lookup("Song","Artist - Topic")]);
 assert.deepEqual(results[0],{coverUrl:candidate.coverUrl,durationMs:123000});assert.deepEqual(results[0],results[1]);assert.equal(calls,1);
 assert.deepEqual(matchMusicArtwork([candidate],"Wrong","Artist"),{});
 assert.deepEqual(matchMusicArtwork([candidate,{...candidate,coverUrl:"https://lh3.googleusercontent.com/other=w256-h256-l90-rj"}],"Song","Artist"),{});
 assert.deepEqual(matchMusicArtwork([{...candidate,coverUrl:"https://evil.test/cover.jpg"}],"Song","Artist"),{});
});
