const path = require("node:path");
const { createLyricsService } = require("../lyrics/service.cjs");

function registerLyricsIpc(router, app, repositories) {
  const service = createLyricsService({
    cacheDir: path.join(app.getPath("userData"), "lyrics-cache"),
    userAgent: `localtify/${app.getVersion()} (https://github.com/meshahid973/localitfy)`
  });
  function getEnabledSong(payload) {
    const settings = repositories.settings.get() || {};
    if (settings.lyricsEnabled !== true) return { settings, song: null };
    // Resolve song IDs natively: renderer inputs never select arbitrary local files.
    const song = repositories.songs.get(String(payload?.id || ""));
    return { settings, song };
  }
  const requests = new Map();
  router.handle("lyrics:get", async (_event, payload) => {
    const token = typeof payload?.requestId === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(payload.requestId) ? payload.requestId : null;
    if (payload?.cancel === true) {
      if (token) requests.get(token)?.abort();
      return { status: "offline", source: "none", lines: [] };
    }
    const { settings, song } = getEnabledSong(payload);
    if (settings.lyricsEnabled !== true) return { status: "disabled", source: "none", lines: [] };
    if (!song) return { status: "missing", source: "none", lines: [] };
    const chosen = repositories.lyrics.get(song.id);
    if (chosen.lrclibId && chosen.result) return { ...chosen.result, manual: true, offsetMs: chosen.offsetMs };
    const controller = new AbortController();
    if (token) {
      requests.get(token)?.abort();
      if (requests.size >= 128) requests.values().next().value?.abort();
      requests.set(token, controller);
    }
    try {
      const result = await service.get(song, { online: settings.lyricsOnlineLookup !== false, refresh: payload?.refresh === true, signal: controller.signal });
      return { ...result, offsetMs: repositories.lyrics.get(song.id).offsetMs };
    } catch (error) {
      if (controller.signal.aborted) return { status: "offline", source: "none", lines: [] };
      throw error;
    } finally { if (token && requests.get(token) === controller) requests.delete(token); }
  });
  router.handle("lyrics:search", async (_event, payload) => {
    const { settings, song } = getEnabledSong(payload);
    if (!song || settings.lyricsOnlineLookup === false) return [];
    return service.searchManual(payload?.query);
  });
  router.handle("lyrics:select-match", async (_event, payload) => {
    const { settings, song } = getEnabledSong(payload);
    if (!song || settings.lyricsOnlineLookup === false) throw new Error("Enable online lyrics to select a match");
    const id = Number(payload?.lrclibId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError("Invalid LRCLIB record ID");
    const result = await service.getManual(id);
    const chosen = repositories.lyrics.save(song.id, id, result);
    return { ...result, manual: true, offsetMs: chosen.offsetMs };
  });
  router.handle("lyrics:set-offset", async (_event, payload) => {
    const { song } = getEnabledSong(payload);
    if (!song) throw new Error("Song unavailable or lyrics disabled");
    const offsetMs = Number(payload?.offsetMs);
    return { offsetMs: repositories.lyrics.setOffset(song.id, offsetMs).offsetMs };
  });
  router.handle("lyrics:clear-selection", async (_event, payload) => {
    const { settings, song } = getEnabledSong(payload);
    if (!song) throw new Error("Song unavailable or lyrics disabled");
    const preference = repositories.lyrics.clear(song.id);
    const fallback = await service.get(song, { online: settings.lyricsOnlineLookup !== false });
    return { ...fallback, offsetMs: preference.offsetMs };
  });
  router.handle("lyrics:clear-cache", () => service.clearCache());
}

module.exports = { registerLyricsIpc };
