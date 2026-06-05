const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localitfy", {
  bootstrap: () => ipcRenderer.invoke("app:bootstrap"),
  resolvePlaybackUrl: (payload) => ipcRenderer.invoke("playback:resolve-url", payload),

  importSongs: () => ipcRenderer.invoke("library:import"),
  clearLibrary: () => ipcRenderer.invoke("library:clear"),

  downloadAudioUrls: (payload) => ipcRenderer.invoke("download:audio", payload),
  cancelDownload: () => ipcRenderer.invoke("download:cancel"),
  chooseDownloadFolder: () => ipcRenderer.invoke("download:choose-folder"),
  openDownloadsFolder: (folder) => ipcRenderer.invoke("download:open-folder", folder),
  pickAndConvertMedia: (payload) => ipcRenderer.invoke("media:convert-pick", payload),

  listPixelArt: () => ipcRenderer.invoke("pixel:list"),
  setPixelArtCover: (id, coverPath) => ipcRenderer.invoke("song:set-cover", id, coverPath),

  patchSong: (id, patch) => ipcRenderer.invoke("song:patch", id, patch),
  deleteSong: (id) => ipcRenderer.invoke("song:delete", id),
  randomizeSongCover: (id) => ipcRenderer.invoke("song:random-cover", id),
  randomizeAllSongCovers: () => ipcRenderer.invoke("covers:randomize-all"),
  randomizeMissingSongCovers: () => ipcRenderer.invoke("covers:randomize-missing"),
  randomizeSelectedSongCovers: (ids) => ipcRenderer.invoke("covers:randomize-selected", ids),
  listPixelCovers: () => ipcRenderer.invoke("covers:list-pixelart"),
  getCoverStats: () => ipcRenderer.invoke("covers:stats"),
  rescanPixelArt: () => ipcRenderer.invoke("covers:rescan"),
  listBrokenCovers: () => ipcRenderer.invoke("covers:broken"),
  getLeastUsedCover: () => ipcRenderer.invoke("covers:least-used"),
  setSongCover: (id, coverPath) => ipcRenderer.invoke("song:set-cover", id, coverPath),
  pickSongCover: (id) => ipcRenderer.invoke("song:pick-cover", id),
  analyzeSongVolume: (id) => ipcRenderer.invoke("song:analyze-volume", id),

  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  restartApp: () => ipcRenderer.invoke("app:restart"),

  getPlaylists: () => ipcRenderer.invoke("playlists:get"),
  savePlaylists: (playlists) => ipcRenderer.invoke("playlists:save", playlists),

  updateBackupNow: () => ipcRenderer.invoke("database:backup-now"),
  repairDatabaseNow: () => ipcRenderer.invoke("database:repair-now"),
  getDatabaseStatus: () => ipcRenderer.invoke("database:status"),

  setDiscordActivity: (payload) => ipcRenderer.invoke("discord:set-activity", payload),
  updateDiscordActivity: (payload) => ipcRenderer.invoke("discord:set-activity", payload),
  clearDiscordActivity: () => ipcRenderer.invoke("discord:clear-activity"),
  getDiscordStatus: () => ipcRenderer.invoke("discord:status"),
  resetDiscordCache: () => ipcRenderer.invoke("discord:reset-cache"),
  resetDiscordActivity: () => ipcRenderer.invoke("discord:reset-cache"),

  setMinimizeToTray: (enabled) => ipcRenderer.invoke("localitfy:set-minimize-to-tray", { enabled }),
  setStartWithWindows: (enabled) => ipcRenderer.invoke("localitfy:set-start-with-windows", { enabled }),
  getStartWithWindows: () => ipcRenderer.invoke("localitfy:get-start-with-windows"),
  getNativeMediaStatus: () => ipcRenderer.invoke("localitfy:native-media-status"),

  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),

  checkForUpdates: (payload) => ipcRenderer.invoke("localitfy:check-for-updates", payload),
  downloadUpdate: () => ipcRenderer.invoke("localitfy:download-update"),
  installUpdate: () => ipcRenderer.invoke("localitfy:install-update"),

  /** Spotify public-only import. Public playlists/albums/tracks do not need manual cookies. */
  /** Check if Spotify OAuth/PKCE is configured and connected. */
  spotifyCheck: () => ipcRenderer.invoke("spotify-check"),
  /** Open Spotify OAuth login popup. No sp_dc cookie paste. */
  spotifyLogin: () => ipcRenderer.invoke("spotify-login"),
  /** Disabled compatibility method. Use spotifyLogin instead. */
  spotifyImportBrowser: () => ipcRenderer.invoke("spotify-import-browser"),
  /** Disabled compatibility method. Use spotifyLogin instead. */
  spotifySetCookie: (payload) => {
    const spDc = typeof payload === "string" ? payload : payload?.spDc;
    return ipcRenderer.invoke("spotify-set-cookie", { spDc });
  },
  /** Clear stored Spotify OAuth token. */
  spotifyLogout: () => ipcRenderer.invoke("spotify-logout"),
  /** Fetch track list from any public Spotify playlist/album/track URL. */
  spotifyFetch: (payload) => ipcRenderer.invoke("spotify-fetch", payload),
  spotifyFetchTracks: (url) => ipcRenderer.invoke("spotify-fetch", { url }),
  /** Check the local Spotify download bridge. */
  spotdlCheck: () => ipcRenderer.invoke("spotdl-check"),
  /** Download Spotify track searches through localtify's download bridge. */
  spotdlDownloadBatch: (payload) => ipcRenderer.invoke("spotdl-download-batch", payload),
  spotifyDownloadBatch: (payload) => ipcRenderer.invoke("spotdl-download-batch", payload),

  onSpotdlTrackDone: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("spotdl-track-done", handler);

    return () => {
      ipcRenderer.removeListener("spotdl-track-done", handler);
    };
  },

  onAutoUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("localitfy:auto-update-event", handler);

    return () => {
      ipcRenderer.removeListener("localitfy:auto-update-event", handler);
    };
  },

  onDownloadProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("download:progress", handler);

    return () => {
      ipcRenderer.removeListener("download:progress", handler);
    };
  },

  onPlayerCommand: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("player:command", handler);

    return () => {
      ipcRenderer.removeListener("player:command", handler);
    };
  }
});