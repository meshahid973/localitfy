"use strict";
const path = require("node:path");
function registerCoverIpc(ipcRouter, {
  getPixelArtFiles, safeMediaUrl, listPixelCoversDetailed, getCoverStats, clearPixelArtCache, clearFileInfoCache, yieldToMainLoop,
  buildRandomizeMissingSongCovers, listSongsShaped, getSongs, createLeastUsedCoverAllocator, patchSong, pickLeastUsedCover,
  getCoverThumbnailStatus, warmCoverThumbnails, thumbnailRuntime, cleanupCoverThumbnailCache, shapeSong, getSong,
  fileExists, isImageFile, getWindow, dialog
}) {
  const pixelListHandler = async () => getPixelArtFiles().map((filePath) => ({ name: path.parse(filePath).name, key: path.parse(filePath).name, path: filePath, url: safeMediaUrl(filePath) }));
  ipcRouter.handle("pixel:list", pixelListHandler);
  ipcRouter.handle("art:list-pixel", pixelListHandler);
  ipcRouter.handle("covers:list-pixelart", async () => { try { return listPixelCoversDetailed(); } catch (e) { console.log("[localitfy list covers error]", e?.message); return []; } });
  ipcRouter.handle("covers:stats", async () => { try { return getCoverStats(); } catch (e) { console.log("[localitfy covers stats error]", e?.message); return {}; } });
  ipcRouter.handle("covers:rescan", async () => { clearPixelArtCache(); clearFileInfoCache(); await yieldToMainLoop(); return buildRandomizeMissingSongCovers(); });
  ipcRouter.handle("covers:randomize-all", async () => {
    await yieldToMainLoop();
    const covers = getPixelArtFiles();
    if (!covers.length) return listSongsShaped();
    const songs = getSongs();
    const allocator = createLeastUsedCoverAllocator(covers, songs);
    for (const song of songs) {
      const chosen = allocator.choose(song.coverPath);
      if (!chosen) continue;
      const updated = patchSong(song.id, { coverPath: chosen });
      if (updated?.coverPath === chosen) allocator.record(song.coverPath, chosen);
    }
    return listSongsShaped();
  });
  ipcRouter.handle("covers:randomize-missing", async () => { await yieldToMainLoop(); return buildRandomizeMissingSongCovers(); });
  ipcRouter.handle("covers:randomize-selected", async (_event, ids) => {
    await yieldToMainLoop();
    if (!Array.isArray(ids) || !ids.length) return listSongsShaped();
    const covers = getPixelArtFiles();
    if (!covers.length) return listSongsShaped();
    const songs = getSongs();
    const allocator = createLeastUsedCoverAllocator(covers, songs);
    const songsById = new Map(songs.map(song => [song.id, song]));
    for (const id of new Set(ids)) {
      const song = songsById.get(id);
      if (!song) continue;
      const chosen = allocator.choose(song.coverPath);
      if (!chosen) continue;
      const updated = patchSong(id, { coverPath: chosen });
      if (updated?.coverPath === chosen) allocator.record(song.coverPath, chosen);
    }
    return listSongsShaped();
  });
  ipcRouter.handle("covers:broken", async () => { try { return getCoverStats().brokenItems || []; } catch { return []; } });
  ipcRouter.handle("covers:least-used", async () => { try { return pickLeastUsedCover(getPixelArtFiles()); } catch { return ""; } });
  ipcRouter.handle("covers:thumbnail-status", async () => { try { return getCoverThumbnailStatus(); } catch (error) { return { ok: false, error: error?.message || "thumbnail status failed" }; } });
  ipcRouter.handle("covers:warm-thumbnails", async (_event, payload = {}) => {
    try {
      await yieldToMainLoop();
      return warmCoverThumbnails({ limit: Math.max(1, Math.min(500, Number(payload?.limit || 120))), force: Boolean(payload?.force) });
    } catch (error) {
      console.log("[localtify warm thumbnails error]", error?.message || error);
      return { ok: false, created: 0, cached: 0, warnings: ["Localtify could not prepare cover thumbnails right now. Covers will still load normally."], error: error?.message || "thumbnail warmup failed" };
    }
  });
  ipcRouter.handle("covers:request-thumbnail", async (_event, payload) => thumbnailRuntime.requestThumbnail(payload));
  ipcRouter.handle("covers:cancel-thumbnail", async (_event, payload) => thumbnailRuntime.cancelThumbnail(payload));
  ipcRouter.handle("covers:cleanup-cache", async () => { try { return cleanupCoverThumbnailCache(); } catch (error) { return { ok: false, error: error?.message || "cover cache cleanup failed" }; } });
  ipcRouter.handle("song:set-cover", async (_event, id, coverPath) => {
    const song = typeof id === "string" ? getSong(id) : null;
    if (!song) return null;
    if (typeof coverPath !== "string" || !path.isAbsolute(coverPath) || !isImageFile(coverPath) || !fileExists(coverPath)) return shapeSong(song);
    const updated = patchSong(id, { coverPath, coverSource: "custom", coverUpdatedAt: new Date().toISOString() });
    return updated ? shapeSong(updated) : null;
  });
  ipcRouter.handle("song:pick-cover", async (event, id) => {
    const song = (typeof id === "string" ? getSong(id) : null);
    if (!song) return null;
    try {
      const senderWindow = getWindow(event);
      const options = { title: "Choose localtify cover image", buttonLabel: "Use cover", properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }] };
      const result = senderWindow && !senderWindow.isDestroyed() ? await dialog.showOpenDialog(senderWindow, options) : await dialog.showOpenDialog(options);
      if (result.canceled || !result.filePaths?.[0]) return shapeSong(song);
      const chosen = result.filePaths[0];
      if (!fileExists(chosen) || !isImageFile(chosen)) return shapeSong(song);
      const updated = patchSong(id, { coverPath: chosen, coverSource: "custom", coverUpdatedAt: new Date().toISOString() });
      return updated ? shapeSong(updated) : shapeSong(song);
    } catch (error) {
      console.log("[localitfy pick cover error]", error?.message || error);
      return shapeSong(song);
    }
  });

}
module.exports = { registerCoverIpc };
