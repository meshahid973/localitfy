"use strict";

/** The interactive renderer needs only library state; keep the full legacy reply available for diagnostics. */
function createBootstrapHandler({yieldToMainLoop, backfillGenres, scheduleCoverWarmup, listSongs, getSettings, getPlaylists, getDiagnostics}) {
  return async (_event, options = {}) => {
    await yieldToMainLoop();
    if (options?.includeGenres === true) await backfillGenres();
    const result = { songs: listSongs(), settings: getSettings(), playlists: getPlaylists() };
    scheduleCoverWarmup();
    if (options?.includeDiagnostics === false) return result;
    return { ...result, ...getDiagnostics() };
  };
}

module.exports = { createBootstrapHandler };
