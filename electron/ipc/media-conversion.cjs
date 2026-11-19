"use strict";

const { convertLocalMediaFiles, isSupportedMediaPath, isDownloadFileInProgress, runDownloadOperation } = require("../downloader.cjs");

function registerMediaConversionIpc(router, { dialog, getWindow, getDownloadDirectory, fileExists, isAudioFile, importFiles, listSongsShaped }) {
  router.handle("media:convert-pick", (event, payload) => runDownloadOperation(async () => {
    let converted;
    const downloadFolder = getDownloadDirectory();
    try {
      const owner = getWindow(event);
      const options = { title: "choose videos or audio to convert", buttonLabel: "convert to mp3", defaultPath: downloadFolder,
        properties: ["openFile", "multiSelections"], filters: [{ name: "media files", extensions: ["mp4", "webm", "mkv", "mov", "avi", "m4v", "mp3", "wav", "ogg", "flac", "m4a", "aac"] }] };
      const picked = owner && !owner.isDestroyed() ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
      if (picked.canceled || !picked.filePaths.length) return { downloadFolder, conversions: [], changedCount: 0, songs: listSongsShaped() };
      const files = picked.filePaths.filter(file => fileExists(file) && isSupportedMediaPath(file) && !isDownloadFileInProgress(file));
      converted = await convertLocalMediaFiles(files, downloadFolder, { bitrate: payload?.bitrate || 192 }, progress => {
        if (event.sender && !event.sender.isDestroyed()) event.sender.send("download:progress", progress);
      });
      const successful = converted.conversions.filter(item => item.ok && item.filePath && fileExists(item.filePath) && isAudioFile(item.filePath)).map(item => item.filePath);
      const { changedCount = 0 } = successful.length ? await importFiles(successful) : {};
      return { ...converted, changedCount, songs: listSongsShaped(), downloadFolder };
    } catch (error) {
      console.error("[localtify conversion import]", error?.message || error);
      const message = error?.message || "Conversion failed";
      return { downloadFolder, conversions: converted?.conversions.map(item => item.ok ? { ...item, ok: false, error: `Audio saved; library import failed: ${message}` } : item) || [{ ok: false, error: message }], changedCount: 0, songs: listSongsShaped() };
    }
  }));
}

module.exports = { registerMediaConversionIpc };
