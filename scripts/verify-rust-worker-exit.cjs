"use strict";
// Run in a child Node process. A live, ref'd native scanner worker would
// prevent this process from exiting; the parent kills it at a strict deadline.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { listAudioFiles } = require("../electron/library-watch.cjs");
const { markStandardAudioFilter } = require("../electron/native/scanner.cjs");

const isAudioFile = markStandardAudioFilter((file) => /\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|aif)$/i.test(file));
async function main() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-rust-worker-exit-"));
  try {
    fs.writeFileSync(path.join(folder, "one.mp3"), "test");
    const found = await listAudioFiles(folder, isAudioFile);
    assert.equal(found.length, 1);
    assert.ok(found[0].endsWith("one.mp3"));
    console.log("[rust-worker-exit] Native scanner answered; Node must now exit without explicit dispose");
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
