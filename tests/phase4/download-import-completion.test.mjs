import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
require("../../electron/runtime/yt-dlp.cjs").ensureYtDlpBinary = async () => assert.fail("import recovery must not access the network");
const downloader = require("../../electron/downloader.cjs");
const { createDownloadJobStore } = require("../../electron/download-jobs.cjs");
const { finalizeDownloadImport, matchSpotifyTrackForFile } = require("../../electron/runtime/download-imports.cjs");

test("import failure retains saved audio and a later committed import clears its recovery state", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-import-completion-"));
  try {
    const url = "https://www.youtube.com/watch?v=abcdefghijk";
    const store = createDownloadJobStore(directory);
    const job = store.prepare({ source: "youtube", url, folder: directory });
    const filePath = path.join(directory, "track.mp3");
    fs.writeFileSync(filePath, "saved audio");
    const stat = fs.statSync(filePath);
    store.update(job.id, { status: "importing", result: { ok: true, url, filePath, filename: "track.mp3" }, sizeBytes: stat.size, mtimeMs: stat.mtimeMs });
    downloader.initDownloader({ userDataPath: directory });
    const saved = await downloader.downloadAudioUrls([url], directory, () => {});
    const events = [];
    const event = { sender: { isDestroyed: () => false, send: (channel, payload) => events.push({ channel, payload }) } };
    const failure = finalizeDownloadImport(event, saved.downloads, [], "database locked");
    assert.equal(failure[0].ok, false);
    assert.equal(failure[0].status, "interrupted");
    assert.equal(failure[0].recoveryId, job.id);
    assert.equal(events.at(-1).payload.status, "interrupted");
    assert.equal(fs.readFileSync(filePath, "utf8"), "saved audio");
    const resumed = await downloader.downloadAudioUrls([url], directory, () => {});
    const song = { id: "existing-song", filePath, title: "User's title" };
    finalizeDownloadImport(event, resumed.downloads, [song]);
    const committed = createDownloadJobStore(directory).get(job.id);
    assert.equal(committed.status, "done");
    assert.equal(committed.importPending, false);
    assert.equal(committed.result.librarySongId, song.id);
    assert.equal(events.at(-1).payload.importedToLibrary, true);
    assert.equal(events.at(-1).payload.filePath, filePath);
    assert.equal(song.title, "User's title");
    assert.equal(fs.readdirSync(directory).filter(name => name.endsWith(".mp3")).length, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("completion notification failure does not change a successful result", () => {
  const item = { ok: true, url: "https://www.youtube.com/watch?v=abcdefghijk", filePath: "/music/track.mp3" };
  const results = [item];
  assert.equal(finalizeDownloadImport({ sender: { isDestroyed: () => false, send: () => { throw new Error("window closed"); } } }, results, []), results);
  assert.equal(item.ok, true);
});

test("filename metadata fallback needs a full title and refuses ambiguous recordings", () => {
  const kickBack = { id: "kick-back", title: "KICK BACK", artist: "Kenshi Yonezu" };
  const lemonade = { id: "lemonade", title: "Lemonade", artist: "Kenshi Yonezu" };
  const other = { id: "intro-other", title: "Intro", artist: "Someone Else" };
  const intro = { id: "intro", title: "Intro", artist: "Kenshi Yonezu" };
  assert.equal(matchSpotifyTrackForFile("/music/Kenshi Yonezu - KICK BACK.mp3", [lemonade, kickBack]), kickBack);
  assert.equal(matchSpotifyTrackForFile("/music/KICK BACK.mp3", [kickBack]), kickBack);
  assert.equal(matchSpotifyTrackForFile("/music/Kenshi Yonezu unreleased mix.mp3", [kickBack, lemonade]), null,
    "an artist match alone must not overwrite a local file's metadata");
  assert.equal(matchSpotifyTrackForFile("/music/Intro.mp3", [intro, other]), null,
    "an ambiguous title cannot select an arbitrary artist");
  assert.equal(matchSpotifyTrackForFile("/music/Kenshi Yonezu - Intro.mp3", [intro, other]), intro);
  assert.equal(matchSpotifyTrackForFile("/music/Backtrack demo.mp3", [{ title: "Back", artist: "demo" }]), null,
    "substring-only title matches are not recording identities");
});
