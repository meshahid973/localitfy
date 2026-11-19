import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const { createDownloadJobStore } = createRequire(import.meta.url)("../../electron/download-jobs.cjs");
const request = folder => ({ source: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk", folder, options: { format: "mp3" } });

test("unfinished download jobs survive a process restart with stable identity and options", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-download-jobs-"));
  try {
    const first = createDownloadJobStore(dir);
    const job = first.prepare(request(dir));
    first.update(job.id, { status: "downloading", progress: 37 });
    const second = createDownloadJobStore(dir);
    assert.equal(second.get(job.id).status, "interrupted");
    assert.equal(second.get(job.id).progress, 37);
    assert.equal(second.get(job.id).request.options.format, "mp3");
    const resumed = second.prepare(request(dir));
    assert.equal(resumed.id, job.id);
    assert.equal(resumed.attempts, 2);
    assert.equal(second.list().length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("completed output is reused only while its verified file identity remains unchanged", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-download-jobs-"));
  try {
    const store = createDownloadJobStore(dir);
    const job = store.prepare(request(dir));
    const filePath = path.join(dir, "track.mp3");
    fs.writeFileSync(filePath, "fixture audio");
    const stat = fs.statSync(filePath);
    store.update(job.id, { status: "done", result: { ok: true, filePath }, sizeBytes: stat.size, mtimeMs: stat.mtimeMs });
    assert.equal(store.prepare(request(dir)).status, "done");
    fs.writeFileSync(filePath, "user changed this audio");
    assert.equal(store.prepare(request(dir)).status, "queued");
    assert.equal(fs.readFileSync(filePath, "utf8"), "user changed this audio");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("cancelled jobs are not resumed and journal inputs cannot escape the owned work directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-download-jobs-"));
  try {
    const store = createDownloadJobStore(dir);
    const job = store.prepare(request(dir));
    store.update(job.id, { status: "cancelled" });
    assert.notEqual(store.prepare(request(dir)).id, job.id);
    assert.throws(() => store.workDirectory("../../outside"));
    assert.throws(() => store.prepare({ ...request(dir), url: "https://attacker.example/video" }));
    assert.throws(() => store.prepare({ ...request(dir), folder: "../relative" }));
    assert.deepEqual(fs.readdirSync(path.join(dir, "download-jobs")).filter(name => name.endsWith(".tmp")), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
