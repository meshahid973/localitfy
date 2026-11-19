import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const downloaderPath = path.resolve("electron/downloader.cjs");
const localRequire = createRequire(downloaderPath);
const { createDownloadJobStore } = localRequire("./download-jobs.cjs");
const url = "https://www.youtube.com/watch?v=abcdefghijk";

function downloader(directory, execute) {
  const module = { exports: {} };
  runInNewContext(fs.readFileSync(downloaderPath, "utf8"), {
    module, exports: module.exports, process, Buffer, console, URL, structuredClone,
    setTimeout, clearTimeout,
    require(name) {
      if (name === "./runtime/yt-dlp.cjs") return {
        ensureYtDlpBinary: async () => ({ path: downloaderPath }),
        spawnYtDlp(_binary, args) {
          const child = new EventEmitter();
          child.stdout = new EventEmitter();
          child.stderr = new EventEmitter();
          child.kill = () => { queueMicrotask(() => child.emit("close", null)); return true; };
          queueMicrotask(() => execute(child, args));
          return child;
        }
      };
      return localRequire(name);
    }
  });
  module.exports.initDownloader({ userDataPath: directory });
  return module.exports;
}

test("the real batch runner reuses restarted completed jobs without spawning yt-dlp", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-download-workflow-"));
  try {
    let spawns = 0;
    const first = downloader(directory, (child, args) => {
      spawns++;
      assert.ok(args.includes("--part"));
      assert.ok(args.includes("--continue"));
      const output = args[args.indexOf("--output") + 1].replace("%(title)s", "夜の音楽").replace("%(ext)s", "mp3");
      fs.writeFileSync(output, "fixture complete audio");
      child.emit("close", 0);
    });
    const result = await first.downloadAudioUrls([url, url], directory, () => {}, { autoAdd: false });
    assert.equal(result.downloads.length, 1);
    assert.equal(result.downloads[0].ok, true);
    const id = result.downloads[0].recoveryId;
    assert.equal(first.getDownloadRecoveryRequest(id).options.autoAdd, false);
    const restarted = downloader(directory, () => assert.fail("completed output must not be downloaded again"));
    const again = await restarted.downloadAudioUrls([url], directory, () => {}, { autoAdd: false });
    assert.equal(again.downloads[0].filePath, result.downloads[0].filePath);
    assert.equal(spawns, 1);
    restarted.clearDownloadJobs([id]);
    assert.equal(restarted.listDownloadJobs().jobs.length, 0);
    assert.equal(fs.readFileSync(result.downloads[0].filePath, "utf8"), "fixture complete audio");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("restart retains the original partial-file location and cancellation cleans only its owned work", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-download-workflow-"));
  try {
    const store = createDownloadJobStore(directory);
    const job = store.prepare({ source: "youtube", url, folder: directory });
    const work = store.workDirectory(job.id);
    fs.mkdirSync(work);
    const partial = path.join(work, `ytdl_${job.id}_track.mp3.part`);
    fs.writeFileSync(partial, "downloaded bytes");
    store.update(job.id, { status: "downloading", progress: 40 });
    const untouched = path.join(directory, "user.mp3.part");
    fs.writeFileSync(untouched, "user file");
    let runtime;
    runtime = downloader(directory, (_child, args) => {
      assert.equal(path.dirname(args[args.indexOf("--output") + 1]), work);
      assert.equal(fs.readFileSync(partial, "utf8"), "downloaded bytes");
      assert.equal(runtime.cancelActiveDownloads(), true);
    });
    assert.equal(runtime.listDownloadJobs().jobs[0].status, "interrupted");
    const result = await runtime.downloadAudioUrls([url], directory, () => {});
    assert.equal(result.downloads[0].ok, false);
    assert.equal(runtime.listDownloadJobs().jobs[0].status, "cancelled");
    assert.equal(fs.existsSync(work), false);
    assert.equal(fs.readFileSync(untouched, "utf8"), "user file");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
