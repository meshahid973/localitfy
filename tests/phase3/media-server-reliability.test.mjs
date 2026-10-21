import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createMediaServerRuntime, MEDIA_TOKEN_MAX_ENTRIES, MEDIA_TOKEN_TTL_MS, parseMediaByteRange } =
  require(path.join(root, "electron", "runtime", "media-server.cjs"));

function makeRuntime(options = {}) {
  const handled = new Map();
  const fetched = [];
  const protocol = { handle(scheme, handler) { handled.set(scheme, handler); } };
  const runtime = createMediaServerRuntime({
    protocol,
    net: {
      async fetch(url) {
        fetched.push(url);
        return new Response("ok");
      }
    },
    getFileInfoCached(filePath) {
      try {
        const stat = fs.statSync(filePath);
        return { exists: true, isFile: stat.isFile(), size: stat.size, mtimeMs: stat.mtimeMs };
      } catch {
        return { exists: false, isFile: false, size: 0, mtimeMs: 0 };
      }
    },
    fileExists: fs.existsSync,
    ...options
  });
  return { runtime, handled, fetched };
}

test("single-range parser handles suffix, open-ended, and unsatisfiable ranges", () => {
  assert.deepEqual(parseMediaByteRange("bytes=-4", 10), { start: 6, end: 9 });
  assert.deepEqual(parseMediaByteRange("bytes=-99", 10), { start: 0, end: 9 });
  assert.deepEqual(parseMediaByteRange("bytes=3-", 10), { start: 3, end: 9 });
  assert.deepEqual(parseMediaByteRange("bytes=3-99", 10), { start: 3, end: 9 });
  assert.deepEqual(parseMediaByteRange("bytes=2-4", 10), { start: 2, end: 4 });
  for (const invalid of ["bytes=-0", "bytes=-", "bytes=10-", "bytes=8-7", "bytes=0-1,3-4", "bytes=0-1junk", "items=0-1", "bytes=999999999999999999999-"]) {
    assert.equal(parseMediaByteRange(invalid, 10), null, invalid);
  }
  assert.equal(parseMediaByteRange("bytes=-2", 0), null);
});

test("fallback media protocol grants access only to registered audio or artwork tokens", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-protocol-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const music = path.join(dir, "song.mp3");
  const secret = path.join(dir, "secrets.txt");
  fs.writeFileSync(music, "example");
  fs.writeFileSync(secret, "private");
  const { runtime, handled, fetched } = makeRuntime();
  runtime.registerProtocol();
  const handler = handled.get("localtify-media");
  assert.equal(typeof handler, "function");

  const goodUrl = runtime.safeMediaUrl(music);
  assert.match(goodUrl, /^localtify-media:\/\/file\/[A-Za-z0-9_-]{24}$/);
  assert.equal((await handler({ url: goodUrl })).status, 200);
  assert.deepEqual(fetched, [pathToFileURL(music).toString()]);

  // Old Base64 path URLs and unregistered tokens must not be usable.
  assert.equal((await handler({ url: "localtify-media://file/" + Buffer.from(secret).toString("base64url") })).status, 404);
  assert.equal((await handler({ url: "localtify-media://file/" + "x".repeat(24) })).status, 404);
  assert.equal((await handler({ url: goodUrl + "?path=" + encodeURIComponent(secret) })).status, 404);
  assert.equal((await handler({ url: goodUrl.replace("://file/", "://evil/") })).status, 404);
  assert.equal(runtime.safeMediaUrl(secret), "", "non-media extensions cannot receive tokens");
  assert.equal(fetched.length, 1, "invalid requests must never reach net.fetch");

  runtime.clearTokens();
  assert.equal((await handler({ url: goodUrl })).status, 404);
});

test("media tokens refresh on use, expire when idle, and evict oldest entries at capacity", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-tokens-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const music = path.join(dir, "track.mp3");
  fs.writeFileSync(music, "abc");
  let clock = 1000;
  const { runtime, handled } = makeRuntime({ now: () => clock });
  runtime.registerProtocol();
  const handler = handled.get("localtify-media");

  const original = runtime.safeMediaUrl(music);
  assert.equal(runtime.safeMediaUrl(music), original, "normal reuse keeps a stable URL");
  clock += MEDIA_TOKEN_TTL_MS - 10;
  assert.equal(runtime.safeMediaUrl(music), original, "recently used tokens extend their lifetime");
  clock += 20;
  assert.equal((await handler({ url: original })).status, 200, "refreshed token remains valid");
  clock += MEDIA_TOKEN_TTL_MS + 1;
  assert.equal((await handler({ url: original })).status, 404, "idle token becomes invalid");
  const replacement = runtime.safeMediaUrl(music);
  assert.notEqual(replacement, original);

  // Distinct registered media files must not produce an unbounded token table.
  const first = runtime.safeMediaUrl(path.join(dir, "0.mp3"));
  const generated = [];
  const quick = makeRuntime({
    now: () => clock,
    fileExists: () => true,
    getFileInfoCached: () => ({ exists: true, isFile: true, size: 3, mtimeMs: 1000 })
  });
  quick.runtime.registerProtocol();
  for (let i = 0; i < MEDIA_TOKEN_MAX_ENTRIES + 5; i += 1) {
    generated.push(quick.runtime.safeMediaUrl(path.join(dir, "virtual-" + i + ".mp3")));
  }
  assert.equal((await quick.handled.get("localtify-media")({ url: generated[0] })).status, 404);
  assert.equal((await quick.handled.get("localtify-media")({ url: generated.at(-1) })).status, 200);
});

test("HTTP server serves correct GET and HEAD byte ranges", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-ranges-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const music = path.join(dir, "track.mp3");
  fs.writeFileSync(music, "0123456789");
  const { runtime } = makeRuntime();
  t.after(() => runtime.stop());
  assert.equal(await runtime.start(), true);
  const url = runtime.safeMediaUrl(music);

  const suffix = await fetch(url, { headers: { Range: "bytes=-4" } });
  assert.equal(suffix.status, 206);
  assert.equal(suffix.headers.get("content-range"), "bytes 6-9/10");
  assert.equal(await suffix.text(), "6789");

  const open = await fetch(url, { headers: { Range: "bytes=3-" } });
  assert.equal(open.status, 206);
  assert.equal(await open.text(), "3456789");

  const head = await fetch(url, { method: "HEAD", headers: { Range: "bytes=2-4" } });
  assert.equal(head.status, 206);
  assert.equal(head.headers.get("content-range"), "bytes 2-4/10");
  assert.equal(head.headers.get("content-length"), "3");
  assert.equal(await head.text(), "");

  for (const bad of ["bytes=11-", "bytes=-0", "bytes=0-2,4-5", "bytes=9-8", "bytes=0-1oops"]) {
    const response = await fetch(url, { headers: { Range: bad } });
    assert.equal(response.status, 416, bad);
    assert.equal(response.headers.get("content-range"), "bytes */10");
    await response.arrayBuffer();
  }
  const full = await fetch(url);
  assert.equal(full.status, 200);
  assert.equal(await full.text(), "0123456789");
  const forbiddenMethod = await fetch(url, { method: "POST" });
  assert.equal(forbiddenMethod.status, 405);
});

test("thumbnail cache refreshes media URLs and downloads shape the library once", () => {
  const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
  const protocols = fs.readFileSync(path.join(root, "electron", "runtime", "protocols.cjs"), "utf8");
  assert.match(main, /const freshUrl = safeMediaUrl\(cached\.thumbnailPath\)/);
  assert.doesNotMatch(protocols, /bypassCSP\s*:\s*true/);

  const download = main.slice(main.indexOf('ipcRouter.handle("download:audio"'), main.indexOf('ipcRouter.handle("download:cancel"'));
  assert.equal((download.match(/listSongsShaped\(\)/g) || []).length, 2, "one success snapshot and one error fallback");
  assert.match(download, /importNewAudioFilesFromDirectory\(downloadFolder, \[\], \{ includeSongs: false \}\)/);

  const spotify = main.slice(main.indexOf('const runSpotifyDownloadBatch ='), main.indexOf('ipcRouter.handle("spotify-download-batch"'));
  assert.equal((spotify.match(/listSongsShaped\(\)/g) || []).length, 2, "one success snapshot and one error fallback");
});


test("all loopback media responses advertise CORS, including range and missing tokens", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-cors-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const music = path.join(dir, "test.mp3");
  fs.writeFileSync(music, "0123456789");
  const { runtime } = makeRuntime();
  t.after(() => runtime.stop());
  assert.equal(await runtime.start(), true);
  const url = runtime.safeMediaUrl(music);
  const missing = url.replace(/\/media\/[^?]+/, "/media/" + "z".repeat(24));
  for (const [target, options, status] of [
    [url, {}, 200],
    [url, { headers: { Range: "bytes=4-5" } }, 206],
    [url, { headers: { Range: "bytes=99-100" } }, 416],
    [missing, {}, 404],
    [url, { method: "OPTIONS" }, 204]
  ]) {
    const result = await fetch(target, options);
    assert.equal(result.status, status);
    assert.equal(result.headers.get("access-control-allow-origin"), "*");
    assert.equal(result.headers.get("cross-origin-resource-policy"), "cross-origin");
    await result.arrayBuffer();
  }
});

test("all audio creation paths configure anonymous CORS before setting src", () => {
  const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
  const engine = fs.readFileSync(path.join(root, "src", "features", "player", "engine", "htmlAudioEngine.ts"), "utf8");
  const preloader = app.slice(app.indexOf("function preloadNextAudio"), app.indexOf("function getAutoCrossfadeSeconds"));
  assert.match(preloader, /nextAudioRef\.current = new Audio\(\);\s*nextAudioRef\.current\.crossOrigin = "anonymous";\s*nextAudioRef\.current\.preload/);
  assert.match(app, /nextAudio\.crossOrigin = "anonymous";/);
  assert.match(engine, /this\.element\.crossOrigin = "anonymous";/);
});
