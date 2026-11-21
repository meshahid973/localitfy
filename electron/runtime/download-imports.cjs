"use strict";

const { completeDownloadImports } = require("../downloader.cjs");
const { filePathKey } = require("./path-identity.cjs");

/** Commit import checkpoints before publishing completion to the renderer. */
function finalizeDownloadImport(event, results, songs, error = "") {
  try { completeDownloadImports(results, songs, error); }
  catch (checkpointError) {
    if (!error) throw checkpointError;
    console.error("[localtify download import checkpoint]", checkpointError.message);
  }
  if (event.sender && !event.sender.isDestroyed()) {
    const byPath = new Map(songs.map(song => [filePathKey(song.filePath), song]));
    for (const item of results || []) {
      if (!item.ok) continue;
      const song = byPath.get(filePathKey(item.filePath));
      try {
        const payload = {
        ...item, type: "download", id: item.recoveryId || item.url,
        status: error ? "interrupted" : "done", progress: 100, error: error || undefined,
        importedToLibrary: Boolean(song), librarySongId: song?.id || "",
        message: error ? "Audio saved. Resume to finish adding it to the library." : song ? "Added to library" : "Downloaded"
        };
        event.sender.send("download:progress", payload);
        if (item.source === "spotify" && !error) event.sender.send("spotdl-track-done", payload);
      } catch (sendError) { console.warn("[localtify download completion listener]", sendError.message); }
    }
  }
  return error
    ? results?.map(item => item.ok ? { ...item, ok: false, status: "interrupted", error: `Audio saved; library import failed: ${error}` } : item) || [{ ok: false, error }]
    : results;
}

/** Filename matching is a fallback, never proof of Spotify recording identity.
 * Require the complete normalized song title; artist-only matches corrupt metadata.
 * Ambiguous names remain unmatched until the source supplies a recording identity.
 */
function normalizeForLooseMatch(value = "") {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}
function hasWholePhrase(text, phrase) {
  return Boolean(text && phrase && (` ${text} `).includes(` ${phrase} `));
}
function matchSpotifyTrackForFile(filePath, tracks = []) {
  const fileName = normalizeForLooseMatch(require("node:path").parse(String(filePath || "")).name);
  if (!fileName || !Array.isArray(tracks)) return null;
  const matches = [];
  for (const track of tracks) {
    const title = normalizeForLooseMatch(track?.title || track?.name || "");
    if (!title || !hasWholePhrase(fileName, title)) continue;
    const artist = normalizeForLooseMatch(track?.artist || track?.artists || "");
    matches.push({ track, title, artistConfirmed: hasWholePhrase(fileName, artist) });
  }
  // A known artist disambiguates shared song titles; never select an arbitrary tie.
  const identified = matches.filter(item => item.artistConfirmed);
  if (identified.length === 1) return identified[0].track;
  if (identified.length > 1 || matches.length !== 1) return null;
  // Very short titles inside longer unrelated filenames are unsafe as lone evidence.
  const only = matches[0];
  return only.title.length >= 6 || fileName === only.title ? only.track : null;
}

module.exports = { finalizeDownloadImport, normalizeForLooseMatch, matchSpotifyTrackForFile };
