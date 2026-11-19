import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { publishDownloadedFile, isPendingPublication } = require("../../electron/download-publication.cjs");
const { createDownloadJobStore } = require("../../electron/download-jobs.cjs");
const { filePathKey } = require("../../electron/runtime/path-identity.cjs");

test("publication never replaces existing audio and checkpoints the exact published identity", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-publish-"));
  try {
    const source = path.join(directory, "download.part");
    const existing = path.join(directory, "日本語.mp3");
    fs.writeFileSync(source, "complete audio");
    fs.writeFileSync(existing, "user audio");
    let checkpoint;
    const output = await publishDownloadedFile(source, directory, "日本語.mp3", identity => { checkpoint = identity; });
    assert.equal(path.basename(output), "日本語 (1).mp3");
    assert.equal(fs.readFileSync(existing, "utf8"), "user audio");
    assert.equal(fs.readFileSync(output, "utf8"), "complete audio");
    assert.equal(checkpoint.filePath, output);
    assert.equal(checkpoint.sizeBytes, fs.statSync(output).size);
    assert.equal(checkpoint.mtimeMs, fs.statSync(output).mtimeMs);
    assert.equal(fs.readdirSync(directory).some(name => name.startsWith(".localtify-publish-")), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("checkpoint failure publishes nothing and retains resumable source audio", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-publish-"));
  try {
    const source = path.join(directory, "complete.part");
    fs.writeFileSync(source, "audio");
    await assert.rejects(publishDownloadedFile(source, directory, "track.mp3", () => { throw new Error("storage unavailable"); }), /storage unavailable/);
    assert.deepEqual(fs.readdirSync(directory), ["complete.part"]);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("restart between publication and completion reuses audio with its Spotify identity", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-publish-"));
  try {
    const request = { source: "spotify", url: "https://open.spotify.com/track/abc123", folder: directory,
      track: { id: "abc123", title: "夜", artist: "artist" }, options: { autoAdd: false } };
    const store = createDownloadJobStore(directory);
    const job = store.prepare(request);
    const source = path.join(directory, "complete.part");
    fs.writeFileSync(source, "complete audio");
    const output = await publishDownloadedFile(source, directory, "夜.mp3", identity => {
      store.update(job.id, { ...identity, status: "importing", result: { ok: true, filePath: identity.filePath, spotifyTrackId: "abc123" } });
    });
    const recovered = createDownloadJobStore(directory).prepare(request);
    assert.equal(recovered.status, "done");
    assert.equal(recovered.result.filePath, output);
    assert.equal(recovered.result.spotifyTrackId, "abc123");
    assert.equal(recovered.request.options.autoAdd, false);
    assert.equal(fs.readdirSync(directory).filter(name => name.endsWith(".mp3")).length, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("path identities preserve distinct Linux files and fold Windows paths", () => {
  assert.notEqual(filePathKey("/music/Track.mp3", "linux"), filePathKey("/music/track.mp3", "linux"));
  assert.equal(filePathKey("C:\\Music\\Track.mp3", "win32"), filePathKey("c:\\music\\track.mp3", "win32"));
  assert.equal(filePathKey("", "linux"), "");
});

test("filesystems without hard links reserve exclusively and recover completed output by checksum", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-publish-"));
  const link = fs.promises.link;
  fs.promises.link = async () => { throw Object.assign(new Error("not supported"), { code: "ENOTSUP" }); };
  try {
    const store = createDownloadJobStore(directory);
    const request = { source: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk", folder: directory };
    const job = store.prepare(request);
    const source = path.join(directory, "complete.part");
    fs.writeFileSync(source, "complete audio");
    fs.writeFileSync(path.join(directory, "track.mp3"), "user audio");
    const output = await publishDownloadedFile(source, directory, "track.mp3", identity => {
      if (identity.pendingOutput) assert.equal(isPendingPublication(identity.filePath), true, "watchers must not import a portable file while it is copied");
      store.update(job.id, { ...identity, status: "importing", result: { ok: true, filePath: identity.filePath } });
    });
    assert.equal(isPendingPublication(output), false);
    assert.equal(path.basename(output), "track (1).mp3");
    assert.equal(fs.readFileSync(path.join(directory, "track.mp3"), "utf8"), "user audio");
    const recorded = store.get(job.id);
    assert.equal(recorded.pendingOutput, null);
    assert.match(recorded.sha256, /^[a-f0-9]{64}$/);
    // Simulate the crash window after copying but before the final mtime checkpoint.
    store.update(job.id, { mtimeMs: -1 });
    assert.equal(createDownloadJobStore(directory).prepare(request).status, "done");
  } finally { fs.promises.link = link; fs.rmSync(directory, { recursive: true, force: true }); }
});

test("partial recovery does not remove a replacement file with different ownership", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-publish-"));
  try {
    const store = createDownloadJobStore(directory);
    const request = { source: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk", folder: directory };
    const job = store.prepare(request);
    const filePath = path.join(directory, "track.mp3");
    fs.writeFileSync(filePath, "partial");
    const owned = fs.statSync(filePath);
    store.update(job.id, { status: "importing", result: { ok: true, filePath }, sizeBytes: 100, mtimeMs: -1,
      pendingOutput: { filePath, ino: owned.ino, dev: owned.dev, birthtimeMs: owned.birthtimeMs } });
    fs.renameSync(filePath, path.join(directory, "old-partial"));
    fs.writeFileSync(filePath, "user's replacement");
    const recovered = createDownloadJobStore(directory);
    recovered.remove(job.id);
    assert.equal(fs.readFileSync(filePath, "utf8"), "user's replacement");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("recovery removes only its verified incomplete portable output, preserving unrelated files", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-publish-"));
  try {
    const store = createDownloadJobStore(directory);
    const request = { source: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk", folder: directory };
    const job = store.prepare(request);
    const filePath = path.join(directory, "track.mp3");
    fs.writeFileSync(filePath, "partial");
    const owned = fs.statSync(filePath);
    store.update(job.id, { status: "importing", result: { ok: true, filePath }, sizeBytes: 100, mtimeMs: -1,
      pendingOutput: { ino: owned.ino, dev: owned.dev, birthtimeMs: owned.birthtimeMs } });
    const userFile = path.join(directory, "user.mp3");
    fs.writeFileSync(userFile, "keep");
    assert.equal(createDownloadJobStore(directory).prepare(request).status, "queued");
    assert.equal(fs.existsSync(filePath), false);
    assert.equal(fs.readFileSync(userFile, "utf8"), "keep");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
