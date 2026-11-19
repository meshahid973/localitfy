import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");
const { createMediaConverter } = require("../../electron/media-converter.cjs");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-converter-"));
  const workRoot = path.join(root, "jobs"), output = path.join(root, "output");
  fs.mkdirSync(output);
  const input = path.join(root, "夜の音楽.wav");
  const samples = 48000, audio = Buffer.alloc(44 + samples * 2);
  audio.write("RIFF"); audio.writeUInt32LE(audio.length - 8, 4); audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(48000, 24); audio.writeUInt32LE(96000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write("data", 36); audio.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) audio.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 48000) * 1000), 44 + i * 2);
  fs.writeFileSync(input, audio);
  let cancelled = false;
  const processes = new Set();
  const converter = createMediaConverter({ workRoot, getFfmpegPath: () => ffmpeg, processes, isCancelled: () => cancelled,
    reportProgress: (callback, payload) => callback?.(payload) });
  return { root, workRoot, output, input, audio, processes, converter, cancel: () => { cancelled = true; for (const child of processes) child.kill(); }, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("real FFmpeg conversion publishes decodable audio without changing source or existing destination", { timeout: 20000 }, async () => {
  const f = fixture();
  try {
    const existing = path.join(f.output, "夜の音楽.mp3");
    fs.writeFileSync(existing, "user audio");
    const result = await f.converter.convert(f.input, f.output);
    assert.equal(result.ok, true, result.error);
    assert.equal(result.filename, "夜の音楽 (1).mp3");
    assert.deepEqual(fs.readFileSync(f.input), f.audio);
    assert.equal(fs.readFileSync(existing, "utf8"), "user audio");
    execFileSync(ffmpeg, ["-v", "error", "-i", result.filePath, "-f", "null", "-"], { windowsHide: true });
    assert.deepEqual(fs.readdirSync(f.workRoot), []);
    assert.equal(f.processes.size, 0);
    assert.equal(fs.readdirSync(f.output).some(name => name.startsWith(".localtify-")), false);
  } finally { f.cleanup(); }
});

test("invalid media and output-directory errors settle and clean owned staging", { timeout: 20000 }, async () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.input, "invalid media");
    const invalid = await f.converter.convert(f.input, f.output);
    assert.equal(invalid.ok, false);
    assert.match(invalid.error, /FFmpeg/);
    assert.equal(fs.readFileSync(f.input, "utf8"), "invalid media");
    assert.deepEqual(fs.readdirSync(f.workRoot), []);
    const blocked = path.join(f.root, "not-a-directory");
    fs.writeFileSync(blocked, "keep");
    const failed = await f.converter.convert(f.input, blocked);
    assert.equal(failed.ok, false);
    assert.equal(fs.readFileSync(blocked, "utf8"), "keep");
  } finally { f.cleanup(); }
});

for (const stage of ["probe", "encode"]) test(`cancellation during ${stage} terminates owned processes without publishing audio`, { timeout: 20000 }, async () => {
  const f = fixture();
  let count = 0;
  const add = f.processes.add.bind(f.processes);
  f.processes.add = child => { add(child); if (++count === (stage === "probe" ? 1 : 2)) queueMicrotask(f.cancel); return f.processes; };
  try {
    const result = await f.converter.convert(f.input, f.output);
    assert.equal(result.ok, false);
    assert.match(result.error, /cancelled/);
    assert.deepEqual(fs.readFileSync(f.input), f.audio);
    assert.deepEqual(fs.readdirSync(f.workRoot), []);
    assert.deepEqual(fs.readdirSync(f.output), []);
    assert.equal(f.processes.size, 0);
  } finally { f.cleanup(); }
});

test("a source changed during encoding is preserved and never published as a completed conversion", { timeout: 20000 }, async () => {
  const f = fixture();
  let count = 0;
  const add = f.processes.add.bind(f.processes);
  f.processes.add = child => { add(child); if (++count === 2) fs.appendFileSync(f.input, "changed"); return f.processes; };
  try {
    const result = await f.converter.convert(f.input, f.output);
    assert.equal(result.ok, false);
    assert.match(result.error, /Source file changed/);
    assert.equal(fs.statSync(f.input).size, f.audio.length + 7);
    assert.deepEqual(fs.readdirSync(f.output), []);
  } finally { f.cleanup(); }
});

test("startup cleans known interrupted conversion artifacts and preserves unrelated audio", () => {
  const f = fixture();
  try {
    const id = crypto.randomUUID(), directory = path.join(f.workRoot, `conversion-${id}`);
    fs.mkdirSync(directory);
    const filePath = path.join(f.output, "partial.mp3");
    fs.writeFileSync(filePath, "partial");
    const owned = fs.statSync(filePath);
    fs.writeFileSync(path.join(directory, "intent.json"), JSON.stringify({ version: 1, id, directory: f.output, sizeBytes: 100,
      pendingOutput: { filePath, ino: owned.ino, dev: owned.dev, birthtimeMs: owned.birthtimeMs }, result: { filePath } }));
    fs.writeFileSync(path.join(f.output, `.localtify-publish-${id}.tmp`), "staged");
    fs.writeFileSync(path.join(f.output, "user.mp3"), "keep");
    createMediaConverter({ workRoot: f.workRoot, getFfmpegPath: () => ffmpeg, processes: new Set(), isCancelled: () => false, reportProgress: () => {} });
    assert.deepEqual(fs.readdirSync(f.workRoot), []);
    assert.deepEqual(fs.readdirSync(f.output), ["user.mp3"]);
    assert.deepEqual(fs.readFileSync(f.input), f.audio);
  } finally { f.cleanup(); }
});
