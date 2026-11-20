import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createResourceCache } = require("../../electron/runtime/resource-cache.cjs");
test("resource cache persists validated entries, expires and evicts least recently used", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-resources-"));
  try {
    let clock = 100;
    const opts = { file: path.join(dir, "lookup.json"), maxEntries: 2, now: () => clock, validate: value => typeof value === "string" };
    const cache = createResourceCache(opts);
    cache.set("artist", "portrait", 100);
    cache.set("recording", "cover", 100);
    assert.equal(cache.get("artist"), "portrait");
    cache.set("album", "album cover", 200);
    assert.equal(cache.get("recording"), undefined);
    cache.flush();
    const restarted = createResourceCache(opts);
    assert.equal(restarted.get("artist"), "portrait");
    assert.equal(restarted.get("album"), "album cover");
    clock = 200;
    assert.equal(restarted.get("artist"), undefined);
    assert.equal(restarted.get("album"), "album cover");
    fs.writeFileSync(opts.file, "{truncated");
    assert.equal(createResourceCache(opts).size, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("resource cache bounds persisted bytes and rejects invalid values", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-budget-"));
  try {
    const file = path.join(dir, "lookup.json");
    const cache = createResourceCache({ file, maxBytes: 256, validate: value => typeof value === "string" });
    cache.set("invalid", {}, 10000);
    for (let i = 0; i < 10; i++) cache.set(String(i), "x".repeat(60), 10000);
    cache.flush();
    assert.equal(cache.get("invalid"), undefined);
    assert.ok(fs.statSync(file).size <= 256);
    assert.equal(cache.get("9"), "x".repeat(60));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("hydrated caches trim to the byte budget before writing and retain the newest valid entry", async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"localtify-resource-hydrate-"));
  try {
    const file=path.join(dir,"cache.json");
    const opts={file,maxBytes:256,maxEntries:10,validate:value=>typeof value==="string"};
    const cache=createResourceCache(opts);
    for(let i=0;i<20;i++)cache.set(String(i),"x".repeat(50),10000);
    assert.ok(cache.size<10);
    cache.flush();
    const reopened=createResourceCache(opts);
    await Promise.all([reopened.hydrate(),reopened.hydrate()]);
    assert.equal(reopened.get("19"),"x".repeat(50));
    assert.ok(fs.statSync(file).size<=256);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test("oversized replacements invalidate older cached metadata in memory and after restart", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-resource-replacement-"));
  try {
    const opts = { file: path.join(dir, "lookup.json"), maxBytes: 128 };
    const cache = createResourceCache(opts);
    cache.set("track", "old", 10000);
    cache.flush();
    cache.set("track", "x".repeat(256), 10000);
    assert.equal(cache.get("track"), undefined);
    cache.flush();
    assert.equal(createResourceCache(opts).get("track"), undefined);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
