import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const output = ts.transpileModule(fs.readFileSync("src/features/player/playbackUrlCache.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const exports = {};
const TTL = 20 * 60 * 1000;
runInNewContext(output, { exports, require: (id) => {
  assert.equal(id, "../library/library.constants");
  return { PLAYBACK_URL_CACHE_TTL_MS: TTL };
} });
const { PlaybackUrlCache, resolveCachedPlaybackUrl } = exports;
const entry = (checkedAt) => ({ url: "local://track", checkedAt, fileExists: true });

test("playback URL cache bounds retention and refreshes LRU order", () => {
  const cache = new PlaybackUrlCache(2, () => 0);
  cache.set("a", entry(0));
  cache.set("b", entry(0));
  assert.ok(cache.get("a"));
  cache.set("c", entry(0));
  assert.equal(cache.size, 2);
  assert.equal(cache.get("b"), undefined);
  assert.ok(cache.get("a"));
  assert.ok(cache.get("c"));
});
test("playback URL cache expires on access and supports invalidation", () => {
  let now = 0;
  const cache = new PlaybackUrlCache(2, () => now);
  cache.set("a", entry(0));
  now = TTL;
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.size, 0);
  cache.set("b", entry(now));
  assert.equal(cache.delete("b"), true);
  cache.set("c", entry(now));
  cache.clear();
  assert.equal(cache.size, 0);
});

test("short-lived playback URLs expire at the provider TTL and distinct case-sensitive sources do not collide", () => {
  let now = 0;
  const cache = new PlaybackUrlCache(2, () => now);
  cache.set("/music/Track.mp3", { ...entry(0), ttlMs: 50 });
  cache.set("/music/track.mp3", { ...entry(0), url: "local://different" });
  now = 50;
  assert.equal(cache.get("/music/Track.mp3"), undefined);
  assert.equal(cache.get("/music/track.mp3").url, "local://different");
});

test("forced resolution supersedes normal IPC and invalidated replies never mark songs missing", async () => {
  const cache = new PlaybackUrlCache(), pending = new Map(), replies = [], missing = [];
  const song = { id: "track", filePath: "/music/Track.mp3" };
  const resolve = force => resolveCachedPlaybackUrl(song, {
    sourceKey: song.filePath, force, cache, pending,
    resolver: payload => new Promise(done => replies.push({ payload, done })),
    onMissing: (...args) => missing.push(args)
  });
  const normal = resolve(false), duplicate = resolve(false);
  await Promise.resolve();
  assert.equal(replies.length, 1);
  const force = resolve(true);
  await Promise.resolve();
  assert.equal(replies.length, 2);
  replies[0].done({ ok: false, fileExists: false });
  assert.equal((await normal).error, "playback source changed");
  assert.equal((await duplicate).error, "playback source changed");
  replies[1].done({ ok: true, url: "local://fresh", cacheTtlMs: 1000 });
  assert.equal((await force).url, "local://fresh");
  assert.equal(cache.get(song.filePath).url, "local://fresh");
  assert.equal(missing.length, 0);
  const invalidated = resolve(true);
  await Promise.resolve();
  pending.clear();
  replies[2].done({ ok: false, fileExists: false });
  assert.equal((await invalidated).error, "playback source changed");
  assert.equal(missing.length, 0);
});
