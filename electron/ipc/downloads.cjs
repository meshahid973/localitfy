"use strict";
const { downloadAudioUrls, downloadSpotifyBatch, cancelActiveDownloads, listDownloadJobs, runDownloadOperation, getDownloadRecoveryRequest, clearDownloadJobs } = require("../downloader.cjs");
const { finalizeDownloadImport } = require("../runtime/download-imports.cjs");
const { filePathKey } = require("../runtime/path-identity.cjs");

function registerDownloadsIpc(ipcRouter, { dialog, shell, getWindow, getDownloadDirectory, getPixelArtFiles, getSongs, insertSongs, patchSong, fileExists, isAudioFile, makeSongFromFile, makeSongFromFileWithExactSpotifyTrack, importNewAudioFilesFromDirectory, clearFileInfoCache, listSongsShaped }) {
  const runAudioDownload = async (event, payload) => {
    let downloaded;
    try {
      const urls = Array.isArray(payload?.urls) ? payload.urls : [payload?.url].filter(Boolean);
      const options = payload?.options && typeof payload.options === "object" ? payload.options : {};
      const { quality, format, cleanTitle, keepOriginal } = options;
      const autoAdd = typeof payload?.autoAdd === "boolean" ? payload.autoAdd : options.autoAdd !== false;
      const downloadFolder = getDownloadDirectory(payload?.folder ?? options.downloadFolder);
      const result = await downloadAudioUrls(urls, downloadFolder, (progress) => {
        if (!event.sender || event.sender.isDestroyed()) return;
        event.sender.send("download:progress", progress);
      }, { bitrate: payload?.bitrate || 192, proxy: payload?.proxy || "", quality, format, cleanTitle, keepOriginal: keepOriginal === true, autoAdd });
      downloaded = result;
      const successfulFiles = result.downloads.filter((item) => item.ok && item.filePath && fileExists(item.filePath) && isAudioFile(item.filePath)).map((item) => item.filePath);
      let changedCount = 0;
      if (autoAdd && successfulFiles.length) {
        const pixelArtFiles = getPixelArtFiles();
        const usedCovers = new Set();
        const existingPaths = new Set(getSongs().map(song => filePathKey(song.filePath)));
        const imported = [];
        for (const file of successfulFiles) {
          const key = filePathKey(file);
          if (!key || existingPaths.has(key)) continue;
          existingPaths.add(key);
          imported.push(await makeSongFromFile(file, pixelArtFiles, usedCovers));
        }
        changedCount = insertSongs(imported);
        clearFileInfoCache();
      }
      if (autoAdd) {
        const refresh = await importNewAudioFilesFromDirectory(downloadFolder, [], { includeSongs: false });
        changedCount += refresh.changedCount;
      }
      const afterSongs = listSongsShaped();
      finalizeDownloadImport(event, result.downloads, afterSongs);
      console.log(`[localitfy download] downloaded=${successfulFiles.length}, changed=${changedCount}, autoAdd=${autoAdd}`);
      return { ...result, changedCount, songs: afterSongs, autoAdd };
    } catch (error) {
      console.log("[localitfy download error]", error?.stack || error?.message);
      const songs = listSongsShaped();
      const message = error?.message || "download failed";
      const downloads = finalizeDownloadImport(event, downloaded?.downloads, songs, message);
      return { downloadFolder: downloaded?.downloadFolder || getDownloadDirectory(), downloads, changedCount: 0, songs, autoAdd: true };
    }
  };
  ipcRouter.handle("download:audio", (event, payload) => runDownloadOperation(() => runAudioDownload(event, payload)));
  ipcRouter.handle("download:jobs", () => listDownloadJobs());
  ipcRouter.handle("download:clear-jobs", (_event, ids) => clearDownloadJobs(ids));

  ipcRouter.handle("download:cancel", async () => ({ cancelled: cancelActiveDownloads() }));
  ipcRouter.handle("download:choose-folder", async () => {
    const owner = getWindow();
    const options = { title: "Choose localtify download folder", properties: ["openDirectory", "createDirectory"] };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, folder: "" };
    return { canceled: false, folder: result.filePaths[0] };
  });
  ipcRouter.handle("download:open-folder", async (_event, folder) => { await shell.openPath(getDownloadDirectory(folder)); return true; });

  const runSpotifyDownloadBatch = async (event, payload = {}) => {
    const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
    const options = payload?.options && typeof payload.options === "object" ? payload.options : payload;
    let downloaded;
    try {
      const downloadFolder = getDownloadDirectory(options?.downloadFolder || options?.outputDir || options?.folder);
      const autoAdd = typeof options?.autoAdd === "boolean" ? options.autoAdd : true;
      const progressCallback = (progress) => {
        if (!event.sender || event.sender.isDestroyed()) return;
        event.sender.send("download:progress", progress);
        if (progress?.status === "done") event.sender.send("spotdl-track-done", progress);
      };
      const result = await downloadSpotifyBatch(tracks, downloadFolder, progressCallback, options);
      downloaded = result;
      const tracksBySpotifyId = new Map(tracks.map((track) => [String(track?.spotifyTrackId || track?.id || track?.trackId || "").trim(), track]).filter(([id]) => Boolean(id)));
      const successfulDownloads = (result.downloads || []).map(item => {
        const spotifyTrackId = String(item?.spotifyTrackId || "").trim();
        // A partial or reordered batch is not evidence of a track's identity.
        const track = tracksBySpotifyId.get(spotifyTrackId) || {};
        return { item, track };
      }).filter(({ item }) => item?.ok && item.filePath && item.matchOk !== false && fileExists(item.filePath) && isAudioFile(item.filePath));
      let changedCount = 0;
      const importedFilePaths = [];
      const importedSongIds = [];
      const spotifyImportMap = [];
      if (autoAdd && successfulDownloads.length) {
        const pixelArtFiles = getPixelArtFiles();
        const usedCovers = new Set();
        const importedSongs = [];
        const existingByPath = new Map(getSongs().map(song => [filePathKey(song.filePath), song]));
        for (const { item, track } of successfulDownloads) {
          const filePath = item.filePath;
          importedFilePaths.push(filePath);
          const spotifyTrackId = String(item.spotifyTrackId || track?.spotifyTrackId || track?.id || "").trim();
          const existing = existingByPath.get(filePathKey(filePath));
          if (existing) {
            importedSongIds.push(existing.id);
            spotifyImportMap.push({ spotifyTrackId, songId: existing.id, filePath });
            continue;
          }
          const sourceInfo = { sourceTrackId: spotifyTrackId, sourceUrl: String(item.spotifyUrl || track?.spotifyUrl || (spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : "")).trim(), sourceProvider: String(item.provider || "youtube"), sourceProviderUrl: String(item.providerUrl || ""), sourceMatchScore: Number(item.matchScore || 0), matchedArtist: item.matchedArtist };
          const song = await makeSongFromFileWithExactSpotifyTrack(filePath, track, pixelArtFiles, usedCovers, sourceInfo);
          importedSongs.push(song);
          existingByPath.set(filePathKey(filePath), song);
          importedSongIds.push(song.id);
          spotifyImportMap.push({ spotifyTrackId, songId: song.id, filePath });
        }
        changedCount = insertSongs(importedSongs);
        for (const song of importedSongs) {
          try {
            patchSong(song.id, { title: song.title, artist: song.artist, album: song.album, coverPath: song.coverPath, duration: song.duration, sourceType: song.sourceType, sourceTrackId: song.sourceTrackId, sourceUrl: song.sourceUrl, sourceProvider: song.sourceProvider, sourceProviderUrl: song.sourceProviderUrl, sourceMatchScore: song.sourceMatchScore });
          } catch (error) { console.log("[localitfy spotify metadata patch error]", error?.message || error); }
        }
        clearFileInfoCache();
      }
      const importMapBySpotifyId = new Map(spotifyImportMap.map((item) => [String(item.spotifyTrackId || "").trim(), item]).filter(([id]) => Boolean(id)));
      const importMapByFilePath = new Map(spotifyImportMap.map((item) => [filePathKey(String(item.filePath || "")), item]).filter(([filePath]) => Boolean(filePath)));
      const finalDownloads = (result.downloads || []).map((item) => {
        const imported = importMapBySpotifyId.get(String(item?.spotifyTrackId || "").trim()) || (item?.filePath ? importMapByFilePath.get(filePathKey(String(item.filePath))) : null) || null;
        return { ...item, importedToLibrary: Boolean(imported), librarySongId: imported?.songId || item.librarySongId || "" };
      });
      const songs = listSongsShaped();
      finalizeDownloadImport(event, finalDownloads, songs);
      return { ...result, downloads: finalDownloads, changedCount, songs, autoAdd, downloadFolder, importedFilePaths: Array.from(new Set(importedFilePaths.filter(Boolean))), spotifyImportedSongIds: Array.from(new Set(importedSongIds.filter(Boolean))), spotifyImportMap, spotifySourceName: payload?.sourceName || options?.sourceName || "", spotifySourceType: payload?.sourceType || options?.sourceType || "" };
    } catch (error) {
      console.log("[localitfy spotify batch download error]", error?.message || error);
      const songs = listSongsShaped();
      const message = error?.message || "batch download failed";
      const downloads = finalizeDownloadImport(event, downloaded?.downloads, songs, message);
      return { downloadFolder: downloaded?.downloadFolder || getDownloadDirectory(options?.downloadFolder || options?.outputDir || options?.folder), downloads, changedCount: 0, songs, spotifyImportedSongIds: [], spotifyImportMap: [], importedFilePaths: [] };
    }
  };
  ipcRouter.handle("spotify-download-batch", (event, payload) => runDownloadOperation(() => runSpotifyDownloadBatch(event, payload)));
  ipcRouter.handle("spotdl-download-batch", (event, payload) => runDownloadOperation(() => runSpotifyDownloadBatch(event, payload)));
  ipcRouter.handle("download:resume-job", (event, id) => runDownloadOperation(async () => {
    const request = getDownloadRecoveryRequest(id);
    if (request.source === "spotify") return runSpotifyDownloadBatch(event, {
      tracks: [request.track], options: { ...request.options, downloadFolder: request.folder }
    });
    return runAudioDownload(event, { urls: [request.url], folder: request.folder, options: request.options });
  }));

}

module.exports = { registerDownloadsIpc };
