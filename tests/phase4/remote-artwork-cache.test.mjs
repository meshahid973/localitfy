import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createRemoteArtworkCache } = require("../../electron/runtime/remote-artwork-cache.cjs");
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/zGQAAAAASUVORK5CYII=", "base64");
const a = "https://lh3.googleusercontent.com/exampleA=w256-h256-l90-rj";
const b = "https://lh3.googleusercontent.com/exampleB=w256-h256-l90-rj";
test("remote image bytes persist across restart, coalesce, deduplicate and repair corruption", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "localtify-art-"));
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response(bytes, { headers: {"content-type":"image/png","cache-control":"public,max-age=3600"} }); };
  try {
    const cache = createRemoteArtworkCache({ dir, fetchImpl });
    const [one,two] = await Promise.all([cache.resolve(a), cache.resolve(a)]);
    assert.ok(one); assert.equal(one,two); assert.equal(calls,1);
    assert.equal(await cache.resolve(b),one); assert.equal(calls,2);
    assert.equal((await fs.readdir(dir)).filter(name => name.endsWith(".png")).length,1);
    const restarted = createRemoteArtworkCache({ dir, fetchImpl });
    assert.equal(await restarted.resolve(a),one); assert.equal(calls,2);
    await fs.writeFile(one, Buffer.alloc(bytes.length));
    assert.equal(await restarted.resolve(a),one); assert.equal(calls,3);
    assert.deepEqual(await fs.readFile(one),bytes);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test("remote cache respects cache headers, provider exclusions and entry budget", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "localtify-art-"));
  let calls = 0;
  try {
    const cache = createRemoteArtworkCache({dir,maxEntries:1,fetchImpl:async () => {
      calls++; return new Response(bytes,{headers:{"content-type":"image/png","cache-control":"public,max-age=3600"}});
    }});
    assert.equal(await cache.resolve("https://evil.test/image.png"),""); assert.equal(calls,0);
    assert.equal(await cache.resolve("https://e-cdns-images.dzcdn.net/images/cover/123456789abcdef0123456789abcdef0/250x250-000000-80-0-0.jpg"),"");
    assert.ok(await cache.resolve(a)); assert.ok(await cache.resolve(b));
    assert.ok(await cache.resolve(a)); assert.equal(calls,3);
    const noStore = createRemoteArtworkCache({dir:path.join(dir,"no-store"),fetchImpl:async () => new Response(bytes,{headers:{"content-type":"image/png","cache-control":"no-store,max-age=3600"}})});
    assert.equal(await noStore.resolve(a),"");
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});

test("stale artwork is served only during an explicit revalidation window and validators avoid downloading bytes again", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),"localtify-art-"));
  let clock=1000, calls=0, finish, observed;
  const fetchImpl = async (_url,options) => {
    calls++;
    if (calls === 1) return new Response(bytes,{headers:{"content-type":"image/png","cache-control":"public,max-age=1,stale-while-revalidate=4","etag":'"cover"'}});
    observed=options.headers["If-None-Match"];
    return new Promise(resolve=>{finish=resolve});
  };
  try {
    const cache=createRemoteArtworkCache({dir,fetchImpl,now:()=>clock});
    const original=await cache.resolve(a);
    assert.equal(cache.remainingTtl(a),1000,"renderer freshness excludes the stale window");
    clock=2100;
    assert.equal(cache.remainingTtl(a),1000,"stale image gets only a short recheck lease");
    clock=5900;
    assert.equal(cache.remainingTtl(a),100,"renderer must not cache past the provider stale deadline");
    clock=2100;
    assert.equal(await cache.resolve(a),original);
    assert.equal(observed,'"cover"');
    finish(new Response(null,{status:304,headers:{"cache-control":"public,max-age=10,stale-while-revalidate=4"}}));
    while(cache.pendingCount) await new Promise(resolve=>setImmediate(resolve));
    clock=7000;
    assert.equal(await cache.resolve(a),original);
    assert.equal(calls,2);
    cache.close();
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
