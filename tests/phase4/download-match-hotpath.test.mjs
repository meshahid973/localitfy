import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const read = (file) => fs.readFileSync(file, "utf8");
const { outputText } = ts.transpileModule(read("src/features/downloads/useDownloadsRuntime.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
const exports = {};
runInNewContext(outputText, {
  exports, require(name) {
    if (name === "react") return {};
    throw new Error("Unexpected dependency: " + name);
  }
});

function referenceMatch(result, librarySongs) {
  const filePath = String(result.filePath || "").trim().toLowerCase();
  const filename = String(result.filename || "").trim().toLowerCase();
  const spotifyTrackId = String(result.spotifyTrackId || "").trim();
  if (spotifyTrackId) {
    const match = librarySongs.find((song) =>
      String(song.sourceTrackId || "").trim() === spotifyTrackId);
    if (match) return match;
  }
  if (filePath) {
    const match = librarySongs.find((song) =>
      String(song.filePath || "").trim().toLowerCase() === filePath);
    if (match) return match;
  }
  if (filename) return librarySongs.find((song) =>
    String(song.filePath || "").trim().toLowerCase().endsWith(filename)) || null;
  return null;
}

function song(id, patch = {}) {
  return { id: String(id), title: "track-" + id, filePath: "/music/" + id + ".flac",
    sourceTrackId: "spotify-" + id, ...patch };
}

test("batch download lookup preserves Spotify > path > suffix precedence", () => {
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
    const expected = result.ok ? referenceMatch(result, songs) : null;
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
  assert.match(queue, /import \{ useEffect, useMemo, useRef, useState \} from "react"/);
  assert.match(queue, /\(\) => open \? buildQueueEntries\(queue, songsById\) : \[\]/);
  assert.match(queue, /\[open, queue, songsById\]/);
});
