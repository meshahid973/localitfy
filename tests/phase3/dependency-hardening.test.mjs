import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("deprecated media wrappers stay removed", () => {
  const pkg = JSON.parse(read("package.json"));
  const downloader = read("electron/downloader.cjs");
  for (const name of ["fluent-ffmpeg", "yt-dlp-wrap", "fs-extra", "ytdl-core"]) {
    assert.equal(Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]), false, `${name} must stay removed`);
  }
  assert.doesNotMatch(downloader, /fluent-ffmpeg|yt-dlp-wrap|YTDlpWrap/);
});

test("yt-dlp runtime pins official binaries and verifies SHA-256", () => {
  const runtimeSource = read("electron/runtime/yt-dlp.cjs");
  const runtime = require(path.join(root, "electron", "runtime", "yt-dlp.cjs"));
  assert.equal(runtime.YTDLP_VERSION, "2026.08.19");
  assert.equal(runtime.getPinnedYtDlpAsset("win32", "x64")?.sha256, "66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a");
  assert.equal(runtime.getPinnedYtDlpAsset("linux", "x64")?.sha256, "58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a");
  assert.match(runtimeSource, /SHA-256 verification failed/);
  assert.match(runtimeSource, /https:\/\/github\.com\/yt-dlp\/yt-dlp\/releases\/download/);
});
