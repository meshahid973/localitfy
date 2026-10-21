const path = require("node:path");
const { createLyricsService } = require("../lyrics/service.cjs");

function registerLyricsIpc(router, app, repositories) {
  const service = createLyricsService({
    cacheDir: path.join(app.getPath("userData"), "lyrics-cache"),
    userAgent: `localtify/${app.getVersion()} (https://github.com/meshahid973/localitfy)`,
    overrides: repositories.lyrics
  });
  router.handle("lyrics:get", async (_event, payload) => {
    const settings = repositories.settings.get() || {};
    if (settings.lyricsEnabled !== true) return { status: "disabled", source: "none", lines: [] };
    // Look the song up natively so the renderer cannot point us at arbitrary files.
    const song = repositories.songs.get(String(payload?.id || ""));
    return service.get(song, { online: settings.lyricsOnlineLookup !== false, refresh: payload?.refresh === true });
  });
  const resolveSong = (payload) => repositories.songs.get(String(payload?.id || ""));
  const requireOnline = () => {
    const settings = repositories.settings.get() || {};
    if (settings.lyricsEnabled !== true || settings.lyricsOnlineLookup === false) {
      throw new Error("Enable online lyrics in Settings to search LRCLIB.");
    }
  };
  router.handle("lyrics:manual-search", async (_event, payload = {}) => {
    requireOnline();
    if (!resolveSong(payload)) throw new Error("No local song found.");
    return service.searchManual(payload.query);
  });
  router.handle("lyrics:manual-select", async (_event, payload = {}) => {
    requireOnline();
    return service.selectManual(resolveSong(payload), payload.recordId);
  });
  router.handle("lyrics:set-offset", async (_event, payload = {}) => {
    if (repositories.settings.get()?.lyricsEnabled !== true) throw new Error("Lyrics are disabled.");
    return service.setManualOffset(resolveSong(payload), payload.offsetSeconds);
  });
  router.handle("lyrics:manual-clear", async (_event, payload = {}) => {
    if (repositories.settings.get()?.lyricsEnabled !== true) throw new Error("Lyrics are disabled.");
    return service.clearManualSelection(resolveSong(payload));
  });
  router.handle("lyrics:clear-cache", () => service.clearCache());
}

module.exports = { registerLyricsIpc };
