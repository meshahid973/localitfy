import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { parseLrc, cleanTitle, primaryArtist } = require(path.join(root, "electron", "lyrics", "lrc.cjs"));
const { createLyricsService, chooseLyricsResult } = require(path.join(root, "electron", "lyrics", "service.cjs"));

const SYNCED = "[ar:Nobody]\n[00:01.50]first line\n[00:04.25][00:20.00]repeated line\n[00:08.00]\n[00:09.123]<00:09.20>word <00:09.80>sync";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "localtify-lyrics-"));
}

function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const endpoint = new URL(url).pathname.split("/").pop();
    const body = routes[endpoint];
    if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchImpl, calls };
}

const song = { id: "s1", title: "Made Up Song (Official Video)", artist: "Nobody feat. Someone", album: "Demo", duration: 200.4, filePath: "" };

test("parseLrc sorts timestamps, repeats lines, strips word tags and applies offset", () => {
  const lines = parseLrc(SYNCED);
  assert.deepEqual(lines.map((line) => line.text), ["first line", "repeated line", "", "word sync", "repeated line"]);
  assert.equal(lines[0].time, 1.5);
  assert.equal(lines[3].time, 9.123);
  assert.equal(parseLrc("[offset:+500]\n[00:02.00]shifted")[0].time, 1.5);
  assert.deepEqual(parseLrc("no timestamps here"), []);
});

test("lookup text drops video noise and featured artists", () => {
  assert.equal(cleanTitle("Made Up Song (Official Video) [HD]"), "Made Up Song");
  assert.equal(cleanTitle("Made Up Song (feat. Someone)"), "Made Up Song");
  assert.equal(primaryArtist("Nobody, Someone & Other"), "Nobody");
  assert.equal(primaryArtist("Nobody - Topic"), "Nobody");
});

test("service prefers a sidecar .lrc file and never goes online for it", async () => {
  const dir = tempDir();
  const filePath = path.join(dir, "track.mp3");
  fs.writeFileSync(path.join(dir, "track.lrc"), SYNCED);
  const { fetchImpl, calls } = fakeFetch({});
  const service = createLyricsService({ cacheDir: path.join(dir, "cache"), userAgent: "test", fetchImpl });
  const result = await service.get({ ...song, filePath }, { online: true });
  assert.equal(result.status, "synced");
  assert.equal(result.source, "file");
  assert.equal(calls.length, 0);
});

test("service queries LRCLIB with cleaned text, caches hits, and respects offline mode", async () => {
  const dir = tempDir();
  const { fetchImpl, calls } = fakeFetch({ get: { duration: 200, syncedLyrics: SYNCED, plainLyrics: "first line" } });
  const service = createLyricsService({ cacheDir: dir, userAgent: "test", fetchImpl });
  const result = await service.get(song);
  assert.equal(result.status, "synced");
  assert.equal(result.source, "lrclib");
  const params = new URL(calls[0]).searchParams;
  assert.equal(params.get("track_name"), "Made Up Song");
  assert.equal(params.get("artist_name"), "Nobody");
  assert.equal(params.get("duration"), "200");

  await service.get(song);
  assert.equal(calls.length, 1, "second lookup is served from the cache");
  assert.equal((await service.get(song, { refresh: true })).status, "synced");
  assert.equal(calls.length, 2);

  assert.equal((await service.get({ ...song, id: "s2", title: "Other" }, { online: false })).status, "offline");
  assert.equal(calls.length, 2);
});

test("service falls back to search, picks synced results near the song length, and reports misses", async () => {
  const { fetchImpl } = fakeFetch({ search: [
    { duration: 260, syncedLyrics: SYNCED },
    { duration: 201, plainLyrics: "plain only" },
    { duration: 199, syncedLyrics: "[00:00.50]closest synced" }
  ] });
  const service = createLyricsService({ cacheDir: tempDir(), userAgent: "test", fetchImpl });
  const result = await service.get(song);
  assert.equal(result.status, "synced");
  assert.equal(result.lines[0].text, "closest synced");

  const empty = createLyricsService({ cacheDir: tempDir(), userAgent: "test", fetchImpl: fakeFetch({ search: [] }).fetchImpl });
  assert.equal((await empty.get(song)).status, "missing");
});

test("service turns network failures into an error result without caching them", async () => {
  let attempts = 0;
  const fetchImpl = async () => { attempts += 1; throw new Error("offline"); };
  const service = createLyricsService({ cacheDir: tempDir(), userAgent: "test", fetchImpl });
  const result = await service.get(song);
  assert.equal(result.status, "error");
  await service.get(song);
  assert.equal(attempts, 2);
});

test("service retries a single LRCLIB server error", async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    return attempts === 1
      ? { ok: false, status: 503, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ syncedLyrics: SYNCED }) };
  };
  const service = createLyricsService({ cacheDir: tempDir(), userAgent: "test", fetchImpl, retryDelayMs: 0 });
  assert.equal((await service.get(song)).status, "synced");
  assert.equal(attempts, 2);
});

test("lyrics IPC is gated by settings and resolves songs natively", () => {
  const source = fs.readFileSync(path.join(root, "electron", "ipc", "lyrics.cjs"), "utf8");
  assert.match(source, /lyricsEnabled !== true/);
  assert.match(source, /repositories\.songs\.get\(/);
  assert.match(fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8"), /registerLyricsIpc\(ipcRouter/);
});


test("metadata-poor songs use a broader LRCLIB title search after structured search misses", async () => {
  const calls = [];
  const fetchImpl = async url => {
    const parsed = new URL(url);
    calls.push(parsed);
    const rows = parsed.searchParams.has("q")
      ? [{ trackName: "Perfect Face", artistName: "Actual Artist", duration: 180,
           syncedLyrics: "[00:03.00]Correct lyrics" }]
      : [];
    return { ok: true, status: 200, json: async () => rows };
  };
  const service = createLyricsService({
    cacheDir: tempDir(), userAgent: "test", fetchImpl, requestSpacingMs: 0
  });
  const result = await service.get({ ...song, title: "Perfect Face (Slowed + Reverb)",
    artist: "unknown artist", duration: 180 });
  assert.equal(result.status, "synced");
  assert.equal(result.lines[0].text, "Correct lyrics");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get("track_name"), "Perfect Face");
  assert.equal(calls[1].searchParams.get("q"), "Perfect Face");
});

test("unrelated search hits are rejected even when durations happen to match", async () => {
  const fetchImpl = async url => ({
    ok: true, status: 200,
    json: async () => [{ trackName: "Other Music", artistName: "Real Artist", duration: 200,
      syncedLyrics: "[00:02.00]These are not the right lyrics" }]
  });
  const service = createLyricsService({ cacheDir: tempDir(), userAgent: "test", fetchImpl, requestSpacingMs: 0 });
  const result = await service.get({ ...song, artist: "unknown artist" });
  assert.equal(result.status, "missing");
});

test("a wrong local artist may be recovered only with an exact distinctive title and close duration", async () => {
  const records = [{ trackName: "Mayonaka No Door Stay With Me", artistName: "Miki Matsubara",
    duration: 300, syncedLyrics: "[00:03.00]Japanese lyrics" }];
  const match = chooseLyricsResult(records, {
    track: "Mayonaka No Door Stay With Me", artist: "tell sato", duration: 301
  });
  assert.equal(match.status, "synced");
  assert.equal(chooseLyricsResult(records, {
    track: "Mayonaka No Door Stay With Me", artist: "tell sato", duration: 260
  }), null);
});

test("slowed editions can show matching lyrics without seeking to wrong timestamps", () => {
  const result = chooseLyricsResult([{
    trackName: "Perfect Face", artistName: "Artist", duration: 170,
    syncedLyrics: "[00:02.00]First line\n[00:09.50]Second line"
  }], { track: "Perfect Face", artist: "Artist", duration: 200 });
  assert.equal(result.status, "plain");
  assert.deepEqual(result.lines.map(line => line.text), ["First line", "Second line"]);
});

test("503 respects Retry-After and does not turn a busy server into a cached miss", async () => {
  let attempts = 0;
  const waits = [];
  const fetchImpl = async () => {
    attempts++;
    if (attempts === 1) return {
      status: 503, ok: false, headers: { get: name => name === "retry-after" ? "1" : null }
    };
    return { ok: true, status: 200, json: async () => ({ syncedLyrics: SYNCED }) };
  };
  const service = createLyricsService({ cacheDir: tempDir(), userAgent: "test", fetchImpl,
    requestSpacingMs: 0, retryDelayMs: 0, sleep: async ms => { waits.push(ms); } });
  const result = await service.get(song);
  assert.equal(result.status, "synced");
  assert.equal(attempts, 2);
  assert.ok(waits.includes(1000), "honor Retry-After: 1 before retry");
});

test("429 obeys Retry-After before retrying and returns an error rather than a false miss", async () => {
  let calls = 0;
  const waits = [];
  const fetchImpl = async () => {
    calls++;
    return { status: 429, ok: false, headers: { get: () => "2" } };
  };
  const service = createLyricsService({ cacheDir: tempDir(), userAgent: "test", fetchImpl,
    requestSpacingMs: 0, sleep: async ms => { waits.push(ms); } });
  const result = await service.get(song);
  assert.equal(result.status, "error");
  assert.match(result.error, /429/);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [2000, 2000]);
});

test("cache misses expire sooner, and the renderer never pins them for the whole session", async () => {
  let timestamp = 10_000;
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: false, status: 404 };
  };
  const service = createLyricsService({ cacheDir: tempDir(), userAgent: "test", fetchImpl,
    now: () => timestamp, requestSpacingMs: 0 });
  assert.equal((await service.get(song)).status, "missing");
  const baseline = calls;
  assert.equal((await service.get(song)).status, "missing");
  assert.equal(calls, baseline, "cache the miss briefly");
  timestamp += 2 * 60 * 60 * 1000 + 1;
  assert.equal((await service.get(song)).status, "missing");
  assert.ok(calls > baseline, "recheck after miss TTL");
  const view = fs.readFileSync(path.join(root, "src/features/lyrics/LyricsView.tsx"), "utf8");
  assert.match(view, /next.status === "synced" \|\| next.status === "plain" \|\| next.status === "instrumental"/);
});

test("skip invalid durations in exact metadata queries", async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(new URL(url));
    return { status: 404, ok: false };
  };
  const service = createLyricsService({ cacheDir: tempDir(), userAgent: "test",
    fetchImpl, requestSpacingMs: 0 });
  await service.get({ ...song, duration: 5000 });
  assert.equal(calls[0].pathname, "/api/get");
  assert.equal(calls[0].searchParams.has("duration"), false);
});

test("title cleaner drops common edit noise without mangling the underlying title", () => {
  assert.equal(cleanTitle("Perfect Face (Slowed + Reverb)"), "Perfect Face");
  assert.equal(cleanTitle("Miss Papaya - slowed / reverb"), "Miss Papaya");
  assert.equal(cleanTitle("Hunter Eyes [Nightcore]"), "Hunter Eyes");
});
