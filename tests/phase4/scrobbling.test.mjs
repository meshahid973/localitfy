import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createScrobbler, playFor, thresholdMs } = require("../../electron/scrobble/scrobbler.cjs");
const KEY = "0123456789abcdef0123456789abcdef";
const SECRET = "fedcba9876543210fedcba9876543210";
const NOW = Date.parse("2026-10-22T12:00:00Z");
const songs = new Map([
  ["long", { id: "long", title: "Long Song", artist: "Lead; Guest", album: "Album", durationMs: 600_000 }],
  ["short", { id: "short", title: "Jingle", artist: "Someone", durationMs: 20_000 }],
  ["anon", { id: "anon", title: "Mystery", artist: "unknown artist", durationMs: 200_000 }],
  ["song", { id: "song", title: "Normal", artist: "Band", album: "local files", durationMs: 200_000 }]
]);

test("a song counts after half of it or 4 minutes, and never under 30 seconds or without an artist", () => {
  assert.equal(playFor({ id: "e" }, songs.get("short")), null);
  assert.equal(playFor({ id: "e" }, songs.get("anon")), null);
  const play = playFor({ id: "e", startedAt: NOW }, songs.get("long"));
  assert.deepEqual(play, { id: "e", artist: "Lead", title: "Long Song", album: "Album", durationSec: 600, startedAt: NOW });
  assert.equal(thresholdMs(play), 240_000);
  assert.equal(thresholdMs(playFor({ id: "e" }, songs.get("song"))), 100_000);
  assert.equal(playFor({ id: "e" }, songs.get("song")).album, "", "the placeholder album isn't sent");
});

function harness({ answer, plays = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-scrobble-"));
  const file = path.join(dir, "scrobbles.json");
  const calls = []; const timers = []; const opened = [];
  let online = true;
  const fetch = async (url, init = {}) => {
    if (!online) throw new Error("offline");
    const body = typeof init.body === "string" ? JSON.parse(init.body) : Object.fromEntries(init.body || []);
    const call = { url: String(url), body, headers: init.headers || {} };
    calls.push(call);
    const reply = answer?.(call) ?? (String(url).includes("listenbrainz") ? { status: "ok", valid: true, user_name: "lb-user" } : { token: "tok", session: { key: "sk-1", name: "fm-user" } });
    return { ok: true, status: reply.httpStatus || 200, json: async () => reply };
  };
  const listPlays = ({ before, since }) => plays.filter((play) => play.updatedAt < before && play.startedAt >= since);
  const scrobbler = createScrobbler({ file, fetch, getSong: (id) => songs.get(id), listPlays, now: () => NOW,
    encrypt: (text) => `enc:${Buffer.from(text).toString("base64")}`, decrypt: (text) => Buffer.from(text.slice(4), "base64").toString(),
    openUrl: async (url) => { opened.push(url); }, setTimer: (fn, ms) => { timers.push({ fn, ms }); if (ms === 3000) fn(); return { unref() {} }; }, clearTimer: () => {}, log: () => {} });
  return { scrobbler, file, calls, timers, opened, setOnline: (value) => { online = value; }, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
const event = (id, songId, msListened, outcome = "active", startedAt = NOW - 300_000) => ({ id, songId, msListened, outcome, startedAt });

test("connecting Last.fm opens the approval page, waits for approval, and stores the sign-in encrypted", async () => {
  let approved = false;
  const h = harness({ answer: (call) => {
    if (call.body.method === "auth.getSession" && !approved) { approved = true; return { error: 14, message: "not yet" }; }
    return undefined;
  } });
  try {
    await assert.rejects(h.scrobbler.connectLastfm({ apiKey: "", sharedSecret: SECRET }), /API key is 32/);
    await assert.rejects(h.scrobbler.connectLastfm({ apiKey: KEY, sharedSecret: "short" }), /32 letters/);
    await assert.rejects(h.scrobbler.connectLastfm({ apiKey: KEY, sharedSecret: KEY.toUpperCase() }), /That's the API key/);
    const status = await h.scrobbler.connectLastfm({ apiKey: KEY, sharedSecret: SECRET });
    assert.equal(status.lastfm.connected, true); assert.equal(status.lastfm.username, "fm-user");
    assert.match(h.opened[0], /^https:\/\/www\.last\.fm\/api\/auth\/\?api_key=0123456789abcdef0123456789abcdef&token=tok$/);
    // Signed per the Last.fm auth spec.
    const call = h.calls.find((item) => item.body.method === "auth.getToken");
    // Fixed signature vector for auth.getToken with the test API key/secret (Last.fm mandates MD5).
    // Using a known answer keeps the fixture independent of the production hash implementation.
    assert.equal(call.body.api_sig, "122db8efff0100fb11599a7629ab9106");
    assert.equal(h.calls.filter((call) => call.body.method === "auth.getSession").length, 2, "must poll until approval");
    const saved = fs.readFileSync(h.file, "utf8");
    assert.ok(!saved.includes(SECRET) && !saved.includes("sk-1"), "secrets are never stored in the clear");
    assert.ok(!JSON.stringify(h.scrobbler.status()).includes("sk-1"), "or returned to the renderer");
  } finally { h.cleanup(); }
});

test("a shared secret from another API account gets a clear error", async () => {
  const h = harness({ answer: () => ({ error: 13, message: "Invalid method signature supplied" }) });
  try {
    await assert.rejects(h.scrobbler.connectLastfm({ apiKey: KEY, sharedSecret: SECRET }), /didn't accept the shared secret/);
    assert.equal(h.scrobbler.status().lastfm.connected, false);
  } finally { h.cleanup(); }
});

test("plays are sent once to every connected service, with now playing first", async () => {
  const h = harness();
  try {
    // The launch-time flush runs before anything is connected; later sends must still go out.
    await h.scrobbler.flush();
    await h.scrobbler.connectLastfm({ apiKey: KEY, sharedSecret: SECRET });
    await h.scrobbler.connectListenbrainz({ token: "lb-token" });
    h.calls.length = 0;
    h.scrobbler.observe(event("p1", "song", 0));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(h.calls.map((call) => call.body.method || call.body.listen_type), ["track.updateNowPlaying", "playing_now"]);
    h.scrobbler.observe(event("p1", "song", 50_000));
    h.scrobbler.observe(event("p1", "song", 100_000));
    await h.scrobbler.flush();
    h.scrobbler.observe(event("p1", "song", 150_000, "ended"));
    await h.scrobbler.flush();
    const sent = h.calls.filter((call) => call.body.method === "track.scrobble" || call.body.listen_type === "single");
    assert.equal(sent.length, 2, "one scrobble per service, however many updates arrive");
    const fm = sent.find((call) => call.body.method);
    assert.equal(fm.body["artist[0]"], "Band"); assert.equal(fm.body["timestamp[0]"], String(Math.floor((NOW - 300_000) / 1000)));
    assert.equal(fm.body.sk, "sk-1");
    const lb = sent.find((call) => call.body.listen_type);
    assert.equal(lb.headers.Authorization, "Token lb-token");
    assert.equal(lb.body.payload[0].track_metadata.additional_info.submission_client, "localtify");
    assert.equal(h.scrobbler.status().sent, 2); assert.equal(h.scrobbler.status().lastfm.waiting, 0);
    h.scrobbler.observe(event("p2", "short", 60_000, "ended"));
    await h.scrobbler.flush();
    assert.equal(h.scrobbler.status().sent, 2, "short songs don't count");
  } finally { h.cleanup(); }
});

test("offline plays wait in the queue file and go out on a later try", async () => {
  const h = harness();
  try {
    await h.scrobbler.connectListenbrainz({ token: "lb-token" });
    h.setOnline(false);
    h.scrobbler.observe(event("p1", "song", 120_000, "ended"));
    await h.scrobbler.flush();
    assert.equal(h.scrobbler.status().listenbrainz.waiting, 1);
    assert.match(h.scrobbler.status().lastError, /Couldn't reach ListenBrainz/);
    const retry = h.timers.find((timer) => timer.ms === 60_000);
    assert.ok(retry, "a retry is scheduled");
    assert.equal(JSON.parse(fs.readFileSync(h.file, "utf8")).queue.length, 1, "the queue survives a restart");
    h.setOnline(true);
    retry.fn();
    await h.scrobbler.flush();
    assert.equal(h.scrobbler.status().listenbrainz.waiting, 0);
    assert.equal(h.scrobbler.status().lastError, "");
  } finally { h.cleanup(); }
});

test("a revoked sign-in disconnects that service and drops only its waiting plays", async () => {
  const h = harness({ answer: (call) => call.body.method === "track.scrobble" ? { error: 9, message: "Invalid session key" }
    : call.url.includes("submit-listens") ? { httpStatus: 503 } : undefined });
  try {
    await h.scrobbler.connectLastfm({ apiKey: KEY, sharedSecret: SECRET });
    await h.scrobbler.connectListenbrainz({ token: "lb-token" });
    h.scrobbler.observe(event("p1", "song", 120_000, "ended"));
    await h.scrobbler.flush();
    const status = h.scrobbler.status();
    assert.equal(status.lastfm.connected, false);
    assert.match(status.lastError, /signed this app out|busy/);
    assert.equal(status.listenbrainz.waiting, 1, "ListenBrainz keeps its copy to retry");
  } finally { h.cleanup(); }
});

test("earlier plays can be sent once per service; Last.fm only gets the last 14 days", async () => {
  const DAY = 24 * 60 * 60 * 1000;
  const past = (id, songId, msListened, ago) => ({ id, songId, msListened, startedAt: NOW - ago, updatedAt: NOW - ago + msListened });
  const h = harness({ plays: [past("old", "song", 200_000, 30 * DAY), past("recent", "song", 200_000, 2 * DAY), past("skipped", "song", 20_000, DAY),
    past("short", "short", 20_000, DAY), past("later", "song", 200_000, -DAY)] });
  try {
    await h.scrobbler.connectLastfm({ apiKey: KEY, sharedSecret: SECRET });
    await h.scrobbler.connectListenbrainz({ token: "lb-token" });
    assert.equal(h.scrobbler.status().lastfm.history, 1, "only counted plays from the last 14 days, before connecting");
    assert.equal(h.scrobbler.status().listenbrainz.history, 2, "ListenBrainz takes plays of any age");
    h.calls.length = 0;
    const status = await h.scrobbler.sendHistory("lastfm");
    assert.equal(status.lastfm.history, 0, "the button goes away once sent");
    assert.equal(status.listenbrainz.history, 2, "each service is sent separately");
    const fm = h.calls.filter((call) => call.body.method === "track.scrobble");
    assert.equal(fm.length, 1); assert.equal(fm[0].body["timestamp[0]"], String(Math.floor((NOW - 2 * DAY) / 1000)));
    assert.equal(h.calls.some((call) => call.url.includes("listenbrainz")), false);
    await h.scrobbler.sendHistory("lastfm");
    assert.equal(h.calls.filter((call) => call.body.method === "track.scrobble").length, 1, "never sent twice");
    await h.scrobbler.sendHistory("listenbrainz");
    const lb = h.calls.filter((call) => call.url.includes("submit-listens"));
    assert.equal(lb.length, 1); assert.equal(lb[0].body.listen_type, "import"); assert.equal(lb[0].body.payload.length, 2);
  } finally { h.cleanup(); }
});

test("invalid scrobbling service name cannot alter Object.prototype", async () => {
  const h = harness();
  try {
    const before = Object.prototype.historySent;
    await assert.rejects(h.scrobbler.sendHistory("__proto__"), /Unknown scrobbling service/);
    assert.equal(Object.prototype.historySent, before);
    await assert.rejects(h.scrobbler.sendHistory("constructor"), /Unknown scrobbling service/);
  } finally { h.cleanup(); }
});

test("scrobble queue writes are atomic and plaintext credentials are never allowed in native IPC", () => {
  const service = fs.readFileSync("electron/scrobble/scrobbler.cjs", "utf8");
  const ipc = fs.readFileSync("electron/ipc/scrobble.cjs", "utf8");
  const view = fs.readFileSync("src/features/scrobbling/ScrobbleSettings.tsx", "utf8");
  assert.match(service, /fs\.renameSync\(temporary, file\)/);
  assert.match(service, /fs\.writeFileSync\(temporary, JSON\.stringify\(load\(\)\)/);
  assert.match(ipc, /Secure credential storage is unavailable/);
  assert.match(ipc, /if \(!secure\) throw new Error/);
  assert.match(view, /if \(ok\) setToken\(""\)/);
});
