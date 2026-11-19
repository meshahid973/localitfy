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

module.exports = { finalizeDownloadImport };
