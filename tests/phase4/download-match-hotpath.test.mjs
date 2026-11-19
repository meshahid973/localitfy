import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const read = (file) => fs.readFileSync(file, "utf8");
const { outputText } = ts.transpileModule(read("src/features/downloads/downloadProcessing.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
const exports = {};
runInNewContext(outputText, {
  exports, URL, require(name) {
    throw new Error("Unexpected dependency: " + name);
  }
});

function referenceMatch(result, librarySongs) {
  const filePath = String(result.filePath || "").trim();
  const filename = String(result.filename || "").trim();
  const spotifyTrackId = String(result.spotifyTrackId || "").trim();
  if (spotifyTrackId) {
    const match = librarySongs.find((song) =>
      String(song.sourceTrackId || "").trim() === spotifyTrackId);
    if (match) return match;
  }
  if (filePath) {
    const match = librarySongs.find((song) =>
      String(song.filePath || "").trim() === filePath);
    if (match) return match;
  }
  if (filename && !filePath) {
    const matches = librarySongs.filter(song => String(song.filePath || "").trim().split(/[\\/]/).pop() === filename);
    return matches.length === 1 ? matches[0] : null;
  }
  return null;
}

function song(id, patch = {}) {
  return { id: String(id), title: "track-" + id, filePath: "/music/" + id + ".flac",
    sourceTrackId: "spotify-" + id, ...patch };
}

test("batch download lookup preserves Spotify > path > unique basename precedence", () => {
  const songs = [
    song("a", { sourceTrackId: "double", filePath: "/music/MYSong.mp3" }),
    song("b", { sourceTrackId: "double", filePath: "/music/song.mp3" }),
    song("c", { sourceTrackId: "", filePath: "/music/song.mp3" }),
    song("d", { sourceTrackId: " d ", filePath: " /Music/Upper.FLAC " })
  ];
  const results = [
    { ok: true, spotifyTrackId: "double", filePath: "/music/song.mp3", filename: "song.mp3" },
    { ok: true, spotifyTrackId: "unknown", filePath: " /MUSIC/SONG.MP3 ", filename: "upper.flac" },
    { ok: true, filename: "song.mp3" },
    { ok: true, spotifyTrackId: "d", filePath: "/missing" },
    { ok: true, filename: "no-match.flac" },
    { ok: false, spotifyTrackId: "double", error: "Network failed" }
  ];
  const lookup = exports.buildDownloadSongLookup(songs);
  for (const result of results) {
    const expected = referenceMatch(result, songs);
    assert.equal(exports.findDownloadedSongMatch(result, songs, lookup)?.id || "", expected?.id || "");
    assert.equal(exports.findDownloadedSongMatch(result, songs)?.id || "", expected?.id || "");
  }
  const enriched = Array.from(exports.enrichDownloadResultsWithLibraryMatches(results, songs));
  for (let i = 0; i < results.length; i += 1) {
    const expected = results[i].ok ? referenceMatch(results[i], songs) : null;
    assert.equal(enriched[i].librarySongId, expected?.id || "");
    assert.equal(enriched[i].importedToLibrary, !!expected);
    assert.equal(enriched[i].statusLabel,
      results[i].ok ? expected ? "Added to library" : "Downloaded, not imported" : "Failed — retry available");
  }
});

test("first-match semantics hold with duplicate file paths and IDs", () => {
  const songs = Array.from({ length: 5000 }, (_, index) => song(index, {
    sourceTrackId: "track-" + (index % 79),
    filePath: "/music/folder-" + (index % 71) + "/song-" + (index % 103) + ".flac"
  }));
  const inputs = [];
  for (let i = 0; i < 400; i += 1) {
    inputs.push({ ok: true,
      spotifyTrackId: i % 2 === 0 ? "track-" + (i % 79) : "missing",
      filePath: "/MUSIC/FOLDER-" + (i % 71) + "/SONG-" + (i % 103) + ".FLAC",
      filename: "song-" + (i % 103) + ".flac" });
  }
  for (let i = 0; i < 80; i += 1) inputs.push({ ok: true, filename: "song-" + i + ".flac" });
  for (let i = 0; i < 10; i += 1) inputs.push({ ok: false, error: "failed" });
  const enriched = Array.from(exports.enrichDownloadResultsWithLibraryMatches(inputs, songs));
  inputs.forEach((result, index) => {
    const expected = result.ok ? referenceMatch(result, songs) : null;
    assert.equal(enriched[index].librarySongId || "", expected?.id || "", "result index " + index);
  });
});

test("queue view only rebuilds derived entries when its inputs change", () => {
  const queue = read("src/features/player/components/QueuePanel.tsx");
  assert.match(queue, /const entries = useMemo\(/);
  assert.match(queue, /\(\) => open \? buildQueueEntries\(queue, songsById\) : \[\]/);
  assert.match(queue, /\[open, queue, songsById\]/);
});

test("canonical duplicates disappear but unsupported links stay available for error reporting", () => {
  assert.deepEqual(Array.from(exports.parseDownloadUrls("https://youtu.be/dQw4w9WgXcQ?t=2,https://www.youtube.com/watch?v=dQw4w9WgXcQ\ninvalid")),["https://www.youtube.com/watch?v=dQw4w9WgXcQ","invalid"]);
  assert.equal(exports.parseDownloadUrls("https://youtube.com/not-watch?v=dQw4w9WgXcQ")[0],"https://youtube.com/not-watch?v=dQw4w9WgXcQ");
});
test("ambiguous basenames and mismatched explicit files do not claim an import",()=> {
  const songs=[song("a",{filePath:"/music/a/song.mp3"}),song("b",{filePath:"/music/b/song.mp3"}),song("c",{filePath:"/music/other.mp3"})];
  const lookup=exports.buildDownloadSongLookup(songs);
  assert.equal(exports.findDownloadedSongMatch({filename:"song.mp3"},songs,lookup),null);
  assert.equal(exports.findDownloadedSongMatch({filename:"other.mp3",filePath:"/missing/other.mp3"},songs,lookup),null);
  assert.equal(exports.findDownloadedSongMatch({filename:"other.mp3"},songs,lookup).id,"c");
});


test("Linux paths differing only by case cannot claim each other's imported metadata", () => {
  const library = [song("upper", { filePath: "/music/Track.flac", sourceTrackId: "" }), song("lower", { filePath: "/music/track.flac", sourceTrackId: "" })];
  const results = exports.enrichDownloadResultsWithLibraryMatches([
    { ok: true, filePath: "/music/Track.flac" }, { ok: true, filePath: "/music/track.flac" }, { ok: true, filePath: "/music/TRACK.flac" }
  ], library);
  assert.deepEqual(Array.from(results, item => item.librarySongId), ["upper", "lower", ""]);
  assert.equal(exports.findDownloadedSongMatch({ ok: true, filePath: "c:\\music\\TRACK.flac" }, [song("windows", { filePath: "C:\\Music\\Track.flac", sourceTrackId: "" })]).id, "windows");
});

test("progress follows persistent identity rather than an older job with the same URL", () => {
  const url = "https://www.youtube.com/watch?v=abcdefghijk";
  const old = { id: "old", recoveryId: "old", url, title: "Old format", status: "done", progress: 100, message: "Downloaded" };
  const placeholder = { id: "queued", url, title: "New format", status: "queued", progress: 0, message: "Waiting" };
  const first = exports.mergeDownloadProgress([old, placeholder], { id: "new", recoveryId: "new", url, status: "downloading", progress: 25 });
  assert.equal(first.length, 2);
  assert.equal(first[0], old);
  assert.equal(first[1].recoveryId, "new");
  const same = exports.mergeDownloadProgress(first, { id: "new", recoveryId: "new", url, status: "downloading", progress: 25.25 });
  assert.equal(same, first, "small identical progress updates avoid rerendering the queue");
  const done = exports.mergeDownloadProgress(first, { id: "new", recoveryId: "new", url, status: "done", progress: 100, filePath: "/music/new.flac", importedToLibrary: true, librarySongId: "song-new" });
  assert.equal(done[0], old);
  assert.equal(done[1].librarySongId, "song-new");
  assert.equal(done[1].filePath, "/music/new.flac");
});

test("cached-job progress removes only its pending placeholder and keeps Spotify request URLs", () => {
  const url = "https://open.spotify.com/track/abc123";
  const job = { id: "saved", recoveryId: "saved", url, source: "spotify", spotifyTrackId: "abc123", title: "Saved", status: "failed", progress: 50, message: "Failed", error: "old error" };
  const pending = { ...job, id: "queued", recoveryId: undefined, status: "queued" };
  const next = exports.mergeDownloadProgress([job, pending], { id: "saved", recoveryId: "saved", url: "https://www.youtube.com/watch?v=abcdefghijk", spotifyTrackId: "abc123", status: "downloading", progress: 10 });
  assert.equal(next.length, 1);
  assert.equal(next[0].url, url);
  assert.equal(next[0].error, undefined);
  assert.equal(exports.mergeDownloadProgress(next, { id: "saved", recoveryId: "saved", progress: NaN })[0].progress, 10);
});

test("retry deduplication retains distinct saved formats and combines queue/result duplicates", () => {
  const url = "https://www.youtube.com/watch?v=abcdefghijk";
  const entries = [{ recoveryId: "mp3", url }, { recoveryId: "flac", url }, { recoveryId: "mp3", url }, { url }, { url: "https://youtu.be/abcdefghijk" }];
  assert.deepEqual(Array.from(exports.deduplicateDownloadRetries(entries), item => item.recoveryId), ["mp3", "flac"]);
});

test("retries run one at a time and cancellation prevents the remaining jobs", async () => {
  const controller = new AbortController();
  const calls = [];
  let active = 0, maximum = 0;
  await exports.retryDownloadsInOrder([
    { recoveryId: "one", url: "https://youtu.be/abcdefghijk" },
    { recoveryId: "two", url: "https://youtu.be/abcdefghijk" },
    { recoveryId: "three", url: "https://youtu.be/abcdefghijk" }
  ], async item => {
    active++;
    maximum = Math.max(maximum, active);
    calls.push(item.recoveryId);
    await Promise.resolve();
    active--;
    if (item.recoveryId === "two") controller.abort();
  }, controller.signal);
  assert.deepEqual(calls, ["one", "two"]);
  assert.equal(maximum, 1);
});
