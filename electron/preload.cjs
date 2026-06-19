const { contextBridge, ipcRenderer } = require("electron");
const LOCALITFY_IPC_CHANNELS = Object.freeze({
  app: Object.freeze({ bootstrap: "app:bootstrap" }),
  playback: Object.freeze({ resolveUrl: "playback:resolve-url" }),
  library: Object.freeze({
    import: "library:import",
    clear: "library:clear",
    repairMissingMetadata: "library:repair-missing-metadata"
  }),
  albums: Object.freeze({
    scanFolder: "album:scan-folder",
    importFolder: "album:import-folder",
    progress: "album-folder-import:progress"
  }),
  downloads: Object.freeze({
    audio: "download:audio",
    cancel: "download:cancel",
    chooseFolder: "download:choose-folder",
    openFolder: "download:open-folder",
    progress: "download:progress"
  }),
  media: Object.freeze({ convertPick: "media:convert-pick" }),
  songs: Object.freeze({
    patch: "song:patch",
    patchMany: "song:patch-many",
    delete: "song:delete",
    setCover: "song:set-cover",
    pickCover: "song:pick-cover",
    randomCover: "song:random-cover",
    analyzeVolume: "song:analyze-volume"
  }),
  covers: Object.freeze({
    listPixelArt: "covers:list-pixelart",
    stats: "covers:stats",
    rescan: "covers:rescan",
    randomizeAll: "covers:randomize-all",
    randomizeMissing: "covers:randomize-missing",
    randomizeSelected: "covers:randomize-selected",
    broken: "covers:broken",
    leastUsed: "covers:least-used",
    thumbnailStatus: "covers:thumbnail-status",
    warmThumbnails: "covers:warm-thumbnails",
    cleanupCache: "covers:cleanup-cache"
  }),
  pixel: Object.freeze({ list: "pixel:list" }),
  settings: Object.freeze({ get: "settings:get", save: "settings:save" }),
  playlists: Object.freeze({ get: "playlists:get", save: "playlists:save" }),
  database: Object.freeze({
    backupNow: "database:backup-now",
    repairNow: "database:repair-now",
    status: "database:status"
  }),
  discord: Object.freeze({
    setActivity: "discord:set-activity",
    clearActivity: "discord:clear-activity",
    status: "discord:status",
    resetCache: "discord:reset-cache"
  }),
  nativeMedia: Object.freeze({
    state: "localitfy:native-media-state",
    playerCommand: "localitfy:player-command",
    playerCommandEvent: "player:command",
    setMinimizeToTray: "localitfy:set-minimize-to-tray",
    setStartWithWindows: "localitfy:set-start-with-windows",
    getStartWithWindows: "localitfy:get-start-with-windows",
    status: "localitfy:native-media-status"
  }),
  system: Object.freeze({
    openDevTools: "localitfy:open-devtools",
    toggleDevTools: "localitfy:toggle-devtools",
    performanceStatus: "localitfy:performance-status",
    gpuStatus: "localitfy:gpu-status",
    openExternal: "localitfy:open-external",
    minimizeWindow: "window:minimize",
    toggleMaximizeWindow: "window:toggle-maximize",
    closeWindow: "window:close"
  }),
  feedback: Object.freeze({ status: "feedback:status", send: "feedback:send" }),
  updates: Object.freeze({
    check: "localitfy:check-for-updates",
    download: "localitfy:download-update",
    install: "localitfy:install-update",
    event: "localitfy:auto-update-event"
  }),
  spotify: Object.freeze({
    check: "spotify-check",
    login: "spotify-login",
    importBrowser: "spotify-import-browser",
    setCookie: "spotify-set-cookie",
    logout: "spotify-logout",
    fetch: "spotify-fetch",
    fetchTracks: "spotify-fetch-tracks",
    spotdlCheck: "spotdl-check",
    spotdlDownloadBatch: "spotdl-download-batch",
    spotifyDownloadBatch: "spotify-download-batch",
    spotdlTrackDone: "spotdl-track-done"
  })
});

function flattenChannels(value, output = new Set()) {
  if (!value || typeof value !== "object") return output;
  for (const entry of Object.values(value)) {
    if (typeof entry === "string") output.add(entry);
    else flattenChannels(entry, output);
  }
  return output;
}

const LOCALITFY_ALLOWED_INVOKE_CHANNELS = new Set([...flattenChannels(LOCALITFY_IPC_CHANNELS)].filter((channel) => !channel.endsWith(":progress") && channel !== "player:command" && channel !== "spotdl-track-done" && channel !== "localitfy:auto-update-event"));
const LOCALITFY_ALLOWED_LISTEN_CHANNELS = new Set([
  LOCALITFY_IPC_CHANNELS.downloads.progress,
  LOCALITFY_IPC_CHANNELS.albums.progress,
  LOCALITFY_IPC_CHANNELS.nativeMedia.playerCommandEvent,
  LOCALITFY_IPC_CHANNELS.updates.event,
  LOCALITFY_IPC_CHANNELS.spotify.spotdlTrackDone
]);

function safeInvoke(channel, ...args) {
  if (!LOCALITFY_ALLOWED_INVOKE_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`Blocked IPC invoke channel: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

function listen(channel, callback) {
  if (!LOCALITFY_ALLOWED_LISTEN_CHANNELS.has(channel)) {
    throw new Error(`Blocked IPC listen channel: ${channel}`);
  }

  if (typeof callback !== "function") {
    return () => {};
  }

  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);

  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const channels = LOCALITFY_IPC_CHANNELS;

const localtifyApi = Object.freeze({
  ipcChannels: channels,

  app: Object.freeze({
    bootstrap: () => safeInvoke(channels.app.bootstrap)
  }),

  playback: Object.freeze({
    resolveUrl: (payload) => safeInvoke(channels.playback.resolveUrl, payload)
  }),

  library: Object.freeze({
    importSongs: () => safeInvoke(channels.library.import),
    clear: () => safeInvoke(channels.library.clear),
    repairMissingMetadata: (payload) => safeInvoke(channels.library.repairMissingMetadata, payload)
  }),

  albums: Object.freeze({
    scanFolder: (payload) => safeInvoke(channels.albums.scanFolder, payload),
    importFolder: (payload) => safeInvoke(channels.albums.importFolder, payload),
    onProgress: (callback) => listen(channels.albums.progress, callback)
  }),

  downloads: Object.freeze({
    downloadAudioUrls: (payload) => safeInvoke(channels.downloads.audio, payload),
    cancel: () => safeInvoke(channels.downloads.cancel),
    chooseFolder: () => safeInvoke(channels.downloads.chooseFolder),
    openFolder: (folder) => safeInvoke(channels.downloads.openFolder, folder),
    onProgress: (callback) => listen(channels.downloads.progress, callback)
  }),

  media: Object.freeze({
    pickAndConvert: (payload) => safeInvoke(channels.media.convertPick, payload)
  }),

  pixel: Object.freeze({
    list: () => safeInvoke(channels.pixel.list)
  }),

  songs: Object.freeze({
    patch: (id, patch) => safeInvoke(channels.songs.patch, id, patch),
    patchMany: (ids, patch) => safeInvoke(channels.songs.patchMany, ids, patch),
    delete: (id) => safeInvoke(channels.songs.delete, id),
    setCover: (id, coverPath) => safeInvoke(channels.songs.setCover, id, coverPath),
    pickCover: (id) => safeInvoke(channels.songs.pickCover, id),
    randomCover: (id) => safeInvoke(channels.songs.randomCover, id),
    analyzeVolume: (id) => safeInvoke(channels.songs.analyzeVolume, id)
  }),

  covers: Object.freeze({
    listPixelArt: () => safeInvoke(channels.covers.listPixelArt),
    stats: () => safeInvoke(channels.covers.stats),
    rescan: () => safeInvoke(channels.covers.rescan),
    randomizeAll: () => safeInvoke(channels.covers.randomizeAll),
    randomizeMissing: () => safeInvoke(channels.covers.randomizeMissing),
    randomizeSelected: (ids) => safeInvoke(channels.covers.randomizeSelected, ids),
    broken: () => safeInvoke(channels.covers.broken),
    leastUsed: () => safeInvoke(channels.covers.leastUsed),
    thumbnailStatus: () => safeInvoke(channels.covers.thumbnailStatus),
    warmThumbnails: (payload) => safeInvoke(channels.covers.warmThumbnails, payload),
    cleanupCache: () => safeInvoke(channels.covers.cleanupCache)
  }),

  settings: Object.freeze({
    get: () => safeInvoke(channels.settings.get),
    save: (settings) => safeInvoke(channels.settings.save, settings)
  }),

  playlists: Object.freeze({
    get: () => safeInvoke(channels.playlists.get),
    save: (playlists) => safeInvoke(channels.playlists.save, playlists)
  }),

  database: Object.freeze({
    backupNow: () => safeInvoke(channels.database.backupNow),
    repairNow: () => safeInvoke(channels.database.repairNow),
    status: () => safeInvoke(channels.database.status)
  }),

  discord: Object.freeze({
    setActivity: (payload) => safeInvoke(channels.discord.setActivity, payload),
    clearActivity: () => safeInvoke(channels.discord.clearActivity),
    status: () => safeInvoke(channels.discord.status),
    resetCache: () => safeInvoke(channels.discord.resetCache)
  }),

  nativeMedia: Object.freeze({
    updateState: (payload) => safeInvoke(channels.nativeMedia.state, payload),
    sendPlayerCommand: (command) => safeInvoke(channels.nativeMedia.playerCommand, command),
    onPlayerCommand: (callback) => listen(channels.nativeMedia.playerCommandEvent, callback),
    setMinimizeToTray: (enabled) => safeInvoke(channels.nativeMedia.setMinimizeToTray, { enabled }),
    setStartWithWindows: (enabled) => safeInvoke(channels.nativeMedia.setStartWithWindows, { enabled }),
    getStartWithWindows: () => safeInvoke(channels.nativeMedia.getStartWithWindows),
    status: () => safeInvoke(channels.nativeMedia.status)
  }),

  system: Object.freeze({
    openDevTools: (payload) => safeInvoke(channels.system.openDevTools, payload),
    toggleDevTools: () => safeInvoke(channels.system.toggleDevTools),
    performanceStatus: () => safeInvoke(channels.system.performanceStatus),
    gpuStatus: () => safeInvoke(channels.system.gpuStatus),
    openExternal: (url) => safeInvoke(channels.system.openExternal, url),
    minimizeWindow: () => safeInvoke(channels.system.minimizeWindow),
    toggleMaximizeWindow: () => safeInvoke(channels.system.toggleMaximizeWindow),
    closeWindow: () => safeInvoke(channels.system.closeWindow)
  }),

  feedback: Object.freeze({
    status: () => safeInvoke(channels.feedback.status),
    send: (payload) => safeInvoke(channels.feedback.send, payload)
  }),

  updates: Object.freeze({
    check: (payload) => safeInvoke(channels.updates.check, payload),
    download: () => safeInvoke(channels.updates.download),
    install: () => safeInvoke(channels.updates.install),
    onEvent: (callback) => listen(channels.updates.event, callback)
  }),

  spotify: Object.freeze({
    check: () => safeInvoke(channels.spotify.check),
    login: () => safeInvoke(channels.spotify.login),
    importBrowser: () => safeInvoke(channels.spotify.importBrowser),
    setCookie: (payload) => {
      const spDc = typeof payload === "string" ? payload : payload?.spDc;
      return safeInvoke(channels.spotify.setCookie, { spDc });
    },
    logout: () => safeInvoke(channels.spotify.logout),
    fetch: (payload) => safeInvoke(channels.spotify.fetch, payload),
    fetchTracks: (url) => safeInvoke(channels.spotify.fetchTracks, url),
    spotdlCheck: () => safeInvoke(channels.spotify.spotdlCheck),
    spotdlDownloadBatch: (payload) => safeInvoke(channels.spotify.spotdlDownloadBatch, payload),
    spotifyDownloadBatch: (payload) => safeInvoke(channels.spotify.spotdlDownloadBatch, payload),
    onTrackDone: (callback) => listen(channels.spotify.spotdlTrackDone, callback)
  })
});

const legacyLocalitfyApi = Object.freeze({
  ipcChannels: channels,

  // App / playback
  bootstrap: localtifyApi.app.bootstrap,
  resolvePlaybackUrl: localtifyApi.playback.resolveUrl,

  // Library / albums
  importSongs: localtifyApi.library.importSongs,
  clearLibrary: localtifyApi.library.clear,
  repairMissingMetadata: localtifyApi.library.repairMissingMetadata,
  scanAlbumFolder: localtifyApi.albums.scanFolder,
  importAlbumFolder: localtifyApi.albums.importFolder,
  onAlbumFolderImportProgress: localtifyApi.albums.onProgress,

  // Downloads / media
  downloadAudioUrls: localtifyApi.downloads.downloadAudioUrls,
  cancelDownload: localtifyApi.downloads.cancel,
  chooseDownloadFolder: localtifyApi.downloads.chooseFolder,
  openDownloadsFolder: localtifyApi.downloads.openFolder,
  pickAndConvertMedia: localtifyApi.media.pickAndConvert,
  onDownloadProgress: localtifyApi.downloads.onProgress,

  // Pixel art / covers / songs
  listPixelArt: localtifyApi.pixel.list,
  setPixelArtCover: localtifyApi.songs.setCover,
  patchSong: localtifyApi.songs.patch,
  patchSongs: localtifyApi.songs.patchMany,
  deleteSong: localtifyApi.songs.delete,
  randomizeSongCover: localtifyApi.songs.randomCover,
  randomizeAllSongCovers: localtifyApi.covers.randomizeAll,
  randomizeMissingSongCovers: localtifyApi.covers.randomizeMissing,
  randomizeSelectedSongCovers: localtifyApi.covers.randomizeSelected,
  listPixelCovers: localtifyApi.covers.listPixelArt,
  getCoverStats: localtifyApi.covers.stats,
  rescanPixelArt: localtifyApi.covers.rescan,
  listBrokenCovers: localtifyApi.covers.broken,
  getLeastUsedCover: localtifyApi.covers.leastUsed,
  getCoverThumbnailStatus: localtifyApi.covers.thumbnailStatus,
  warmCoverThumbnails: localtifyApi.covers.warmThumbnails,
  cleanupCoverCache: localtifyApi.covers.cleanupCache,
  setSongCover: localtifyApi.songs.setCover,
  pickSongCover: localtifyApi.songs.pickCover,
  analyzeSongVolume: localtifyApi.songs.analyzeVolume,

  // Settings / playlists / database
  getSettings: localtifyApi.settings.get,
  saveSettings: localtifyApi.settings.save,
  getPlaylists: localtifyApi.playlists.get,
  savePlaylists: localtifyApi.playlists.save,
  updateBackupNow: localtifyApi.database.backupNow,
  repairDatabaseNow: localtifyApi.database.repairNow,
  getDatabaseStatus: localtifyApi.database.status,

  // Discord / native media
  setDiscordActivity: localtifyApi.discord.setActivity,
  updateDiscordActivity: localtifyApi.discord.setActivity,
  clearDiscordActivity: localtifyApi.discord.clearActivity,
  getDiscordStatus: localtifyApi.discord.status,
  resetDiscordCache: localtifyApi.discord.resetCache,
  resetDiscordActivity: localtifyApi.discord.resetCache,
  updateNativeMediaState: localtifyApi.nativeMedia.updateState,
  sendPlayerCommand: localtifyApi.nativeMedia.sendPlayerCommand,
  setMinimizeToTray: localtifyApi.nativeMedia.setMinimizeToTray,
  setStartWithWindows: localtifyApi.nativeMedia.setStartWithWindows,
  getStartWithWindows: localtifyApi.nativeMedia.getStartWithWindows,
  getNativeMediaStatus: localtifyApi.nativeMedia.status,
  onPlayerCommand: localtifyApi.nativeMedia.onPlayerCommand,

  // System / feedback / updates
  openDevTools: localtifyApi.system.openDevTools,
  toggleDevTools: localtifyApi.system.toggleDevTools,
  getPerformanceStatus: localtifyApi.system.performanceStatus,
  getGpuStatus: localtifyApi.system.gpuStatus,
  getFeedbackStatus: localtifyApi.feedback.status,
  sendFeedback: localtifyApi.feedback.send,
  minimizeWindow: localtifyApi.system.minimizeWindow,
  toggleMaximizeWindow: localtifyApi.system.toggleMaximizeWindow,
  closeWindow: localtifyApi.system.closeWindow,
  checkForUpdates: localtifyApi.updates.check,
  downloadUpdate: localtifyApi.updates.download,
  installUpdate: localtifyApi.updates.install,
  openExternal: localtifyApi.system.openExternal,
  onAutoUpdate: localtifyApi.updates.onEvent,

  // Spotify
  spotifyCheck: localtifyApi.spotify.check,
  spotifyLogin: localtifyApi.spotify.login,
  spotifyImportBrowser: localtifyApi.spotify.importBrowser,
  spotifySetCookie: localtifyApi.spotify.setCookie,
  spotifyLogout: localtifyApi.spotify.logout,
  spotifyFetch: localtifyApi.spotify.fetch,
  spotifyFetchTracks: localtifyApi.spotify.fetchTracks,
  spotdlCheck: localtifyApi.spotify.spotdlCheck,
  spotdlDownloadBatch: localtifyApi.spotify.spotdlDownloadBatch,
  spotifyDownloadBatch: localtifyApi.spotify.spotifyDownloadBatch,
  onSpotdlTrackDone: localtifyApi.spotify.onTrackDone
});

contextBridge.exposeInMainWorld("localtify", localtifyApi);
contextBridge.exposeInMainWorld("localitfy", legacyLocalitfyApi);
