import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { _test } = require(path.join(root, "electron", "downloader.cjs"));
const { getBaseArgs, buildStrategies, AUDIO_FORMAT_SELECTOR, ORIGINAL_AUDIO_FORMAT_SELECTOR } = _test;
const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const argValue = (args, flag) => args[args.indexOf(flag) + 1];

test("prefers Opus audio and never falls back to the muxed video format", () => {
  const args = getBaseArgs(url, "/tmp/out.%(ext)s", {});
  assert.equal(argValue(args, "--format"), AUDIO_FORMAT_SELECTOR);
  assert.match(AUDIO_FORMAT_SELECTOR, /^bestaudio\[acodec=opus\]/);
  assert.ok(AUDIO_FORMAT_SELECTOR.split("/").every((part) => part.startsWith("bestaudio")));
});

test("converts to the chosen format by default", () => {
  const args = getBaseArgs(url, "/tmp/out.%(ext)s", { format: "flac", quality: "320" });
  assert.equal(argValue(args, "--audio-format"), "flac");
  assert.equal(argValue(args, "--audio-quality"), "320K");
});

test("keep original remuxes without re-encoding and ignores format and quality", () => {
  const args = getBaseArgs(url, "/tmp/out.%(ext)s", { keepOriginal: true, format: "mp3", quality: "192" });
  assert.equal(argValue(args, "--audio-format"), "best");
  assert.equal(argValue(args, "--format"), ORIGINAL_AUDIO_FORMAT_SELECTOR, "only preservable Opus or M4A formats are allowed");
  assert.ok(!ORIGINAL_AUDIO_FORMAT_SELECTOR.endsWith("/bestaudio"), "no unsupported codec fallback");
  assert.ok(!args.includes("--audio-quality"));
});

test("tries yt-dlp's default clients before the format-limited mobile clients", async () => {
  const strategies = await buildStrategies(url, "/tmp/out.%(ext)s", {});
  assert.equal(strategies[0].label, "default clients");
  assert.ok(!strategies[0].args.includes("--extractor-args"));
  assert.equal(strategies.at(-1).label.includes("cookies") ? strategies.at(-2).label : strategies.at(-1).label, "mobile clients");
});

test("URL downloads forward audio options and the setting defaults off", () => {
  const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
  assert.match(main, /quality, format, cleanTitle, keepOriginal: keepOriginal === true/);
  const selectors = fs.readFileSync(path.join(root, "src", "features", "downloads", "download.selectors.ts"), "utf8");
  assert.match(selectors, /keepOriginal: settings\.downloadKeepOriginal/);
  const constants = fs.readFileSync(path.join(root, "src", "features", "settings", "settings.constants.ts"), "utf8");
  assert.match(constants, /downloadKeepOriginal:false/);
});

test("keep-original Opus downloads import and play; nested download settings reach the main process", () => {
  const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
  const match = main.match(/function isAudioFile\(filePath\) \{([^}]+)\}/);
  assert.ok(match, "main process audio recognition is present");
  const isAudioFile = new Function("filePath", match[1]);
  for (const file of ["song.opus", "song.m4a", "song.aiff", "song.MP3"]) assert.equal(isAudioFile(file), true, file);
  assert.equal(isAudioFile("archive.zip"), false);
  assert.match(main, /options\.autoAdd !== false/, "auto-add preference is forwarded");
  assert.match(main, /payload\?\.folder \?\? options\.downloadFolder/, "download folder preference is forwarded");
  const downloader = fs.readFileSync(path.join(root, "electron", "downloader.cjs"), "utf8");
  assert.match(downloader, /"\.opus"/, "the converter recognizes Opus imports");
});
