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
const { PlaybackUrlCache } = exports;
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
