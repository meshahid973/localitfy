"use strict";

// Opt-in end-to-end acceptance against media the operator has permission to
// download. Never opens, writes or scans the user's existing music library.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { initDownloader, downloadAudioUrls, downloadSpotifyBatch, listDownloadJobs } =
  require("../electron/downloader.cjs");

const args = process.argv.slice(2);
const youtubeIndex = args.indexOf("--youtube");
const spotifyIndex = args.indexOf("--spotify-json");
const keep = args.includes("--keep");
if ((youtubeIndex < 0) === (spotifyIndex < 0) ||
    (youtubeIndex >= 0 && !args[youtubeIndex + 1]) ||
    (spotifyIndex >= 0 && !args[spotifyIndex + 1])) {
  console.error("Usage: node scripts/live-download-acceptance.cjs --youtube HTTPS_VIDEO_URL [--keep]");
  console.error("   or: node scripts/live-download-acceptance.cjs --spotify-json OWNED_TRACK_METADATA.json [--keep]");
  process.exit(2);
}

const source = youtubeIndex >= 0 ? "youtube" : "spotify";
const input = youtubeIndex >= 0 ? args[youtubeIndex + 1] : JSON.parse(fs.readFileSync(args[spotifyIndex + 1], "utf8"));

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-live-download-"));
const downloads = path.join(temp, "downloads");
const profile = path.join(temp, "profile");
fs.mkdirSync(downloads, { recursive: true });
fs.mkdirSync(profile, { recursive: true });
const sentinelPath = path.join(downloads, "existing-library-file.mp3");
const sentinel = crypto.randomBytes(256);
fs.writeFileSync(sentinelPath, sentinel);

async function hashFile(file) {
  const hash = crypto.createHash("sha256");
  for await (const bytes of fs.createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}
function assertUnchanged() {
  assert.deepEqual(fs.readFileSync(sentinelPath), sentinel, "pre-existing file modified");
}
function assertOutputSafe(file) {
  const resolved = fs.realpathSync(file);
  assert.equal(path.dirname(resolved), fs.realpathSync(downloads), "published outside isolated destination");
  assert.notEqual(resolved, fs.realpathSync(sentinelPath), "overwrote an existing file");
  assert.ok(fs.statSync(resolved).size > 10000, "downloaded media unexpectedly small");
}
const options = { format: "mp3", quality: "192", autoAdd: false };
async function download() {
  if (source === "youtube") return downloadAudioUrls(input, downloads, () => {}, options);
  return downloadSpotifyBatch([input], downloads, () => {}, options);
}
async function main() {
  initDownloader({ userDataPath: profile });
  const first = await download();
  assert.equal(first.downloads.length, 1, "expected one real media result");
  const saved = first.downloads[0];
  assert.equal(saved.ok, true, "live source download failed: " + String(saved.error || "unknown reason"));
  if (source === "spotify") assert.equal(saved.matchOk, true, "Spotify matching was not positively verified");
  assertOutputSafe(saved.filePath);
  assertUnchanged();
  const firstHash = await hashFile(saved.filePath);
  const firstFiles = fs.readdirSync(downloads).sort();
  const jobsBefore = listDownloadJobs();
  assert.equal(jobsBefore.error, "", "recovery journal must be readable");
  assert.ok(jobsBefore.jobs.some(job => job.status === "done" && job.filePath === saved.filePath),
    "completed file not recorded in journal");

  // Recreate the downloader with exactly the same scratch profile: simulates
  // process restart while preserving only durable on-disk checkpoints.
  initDownloader({ userDataPath: profile });
  const recovered = listDownloadJobs();
  assert.equal(recovered.error, "", "journal unreadable on restart");
  assert.ok(recovered.jobs.some(job => job.status === "done" && job.filePath === saved.filePath),
    "completed job did not recover after restart");
  const replay = await download();
  assert.equal(replay.downloads[0]?.ok, true, "idempotent retry failed");
  assert.equal(replay.downloads[0]?.filePath, saved.filePath, "retry republished duplicate audio");
  assert.deepEqual(fs.readdirSync(downloads).sort(), firstFiles, "retry added unwanted output");
  assert.equal(await hashFile(saved.filePath), firstHash, "retry changed the published bytes");
  assertOutputSafe(saved.filePath);
  assertUnchanged();
  const report = {
    source, result: "passed", realSource: true, matched: source !== "spotify" || saved.matchOk,
    bytes: fs.statSync(saved.filePath).size, sha256: firstHash,
    restartRecovery: true, noDuplicateOnRetry: true, originalFileUntouched: true,
    scratchRetained: keep
  };
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => {
  console.error("LIVE DOWNLOAD ACCEPTANCE FAILED:", error.message);
  process.exitCode = 1;
}).finally(() => {
  if (keep) console.log("Scratch output retained:", temp);
  else fs.rmSync(temp, { recursive: true, force: true });
});
