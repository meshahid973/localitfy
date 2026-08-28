import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mainSource = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
const { createMediaServerRuntime, MEDIA_TOKEN_TTL_MS } = require(path.join(root, "electron", "runtime", "media-server.cjs"));

test("media serving is owned outside Electron main", () => {
  assert.match(mainSource, /createMediaServerRuntime/);
  assert.doesNotMatch(mainSource, /function\s+startLocaltifyMediaServer\b/);
  assert.doesNotMatch(mainSource, /function\s+stopLocaltifyMediaServer\b/);
  assert.doesNotMatch(mainSource, /function\s+createMediaToken\b/);
  assert.doesNotMatch(mainSource, /function\s+resolveMediaToken\b/);
});

test("media runtime keeps protocol fallback and token ownership", () => {
  const handled = [];
  const protocol = {
    __localtifyMediaProtocolReady: false,
    handle: (scheme, handler) => handled.push([scheme, handler])
  };
  const net = { fetch: async () => new Response("ok") };
  const runtime = createMediaServerRuntime({
    protocol,
    net,
    getFileInfoCached: () => ({ exists: true, isFile: true, size: 4, mtimeMs: 1234 }),
    fileExists: () => true
  });

  runtime.registerProtocol();
  runtime.registerProtocol();
  assert.equal(handled.length, 1, "media protocol registration must be idempotent");
  assert.equal(handled[0][0], "localtify-media");
  assert.equal(runtime.getPort(), 0);
  assert.equal(runtime.tokenTtlMs, MEDIA_TOKEN_TTL_MS);

  const fakePath = path.join(os.tmpdir(), "localtify-media-test.mp3");
  const url = runtime.safeMediaUrl(fakePath);
  assert.match(url, /^localtify-media:\/\/file\//);
  assert.equal(runtime.getMediaFileVersion(fakePath).version, "1234-4");
  assert.doesNotThrow(() => runtime.clearTokens());
  assert.doesNotThrow(() => runtime.stop());
});
