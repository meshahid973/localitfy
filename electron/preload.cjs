const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localitfy", {
  bootstrap: () => ipcRenderer.invoke("app:bootstrap"),

  importSongs: () => ipcRenderer.invoke("library:import"),
  clearLibrary: () => ipcRenderer.invoke("library:clear"),

  downloadAudioUrls: (payload) => ipcRenderer.invoke("download:audio", payload),
  openDownloadsFolder: () => ipcRenderer.invoke("download:open-folder"),
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

  getPlaylists: () => ipcRenderer.invoke("playlists:get"),
  savePlaylists: (playlists) => ipcRenderer.invoke("playlists:save", playlists),

  updateDiscordActivity: (payload) => ipcRenderer.invoke("discord:update", payload),
  clearDiscordActivity: () => ipcRenderer.invoke("discord:clear"),
  getDiscordStatus: () => ipcRenderer.invoke("discord:status"),
  resetDiscordActivity: () => ipcRenderer.invoke("discord:reset"),

  getDatabaseStatus: () => ipcRenderer.invoke("db:status"),
  backupDatabase: () => ipcRenderer.invoke("db:backup"),
  repairDatabase: () => ipcRenderer.invoke("db:repair"),

  showMiniWindow: () => ipcRenderer.invoke("mini:show"),
  hideMiniWindow: () => ipcRenderer.invoke("mini:hide"),
  updateMiniWindowState: (payload) => ipcRenderer.invoke("mini:update-state", payload),
  getMiniWindowState: () => ipcRenderer.invoke("mini:get-state"),

  sendPlayerCommand: (command) => ipcRenderer.invoke("player:command", command),

  updateNativeMediaState: (payload) => ipcRenderer.invoke("localitfy:native-media-state", payload),
  setMinimizeToTray: (enabled) => ipcRenderer.invoke("localitfy:set-minimize-to-tray", { enabled }),
  setStartWithWindows: (enabled) => ipcRenderer.invoke("localitfy:set-start-with-windows", { enabled }),
  getStartWithWindows: () => ipcRenderer.invoke("localitfy:get-start-with-windows"),
  getNativeMediaStatus: () => ipcRenderer.invoke("localitfy:native-media-status"),
  openExternal: (url) => ipcRenderer.invoke("localitfy:open-external", url),

  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),

  checkForUpdates: (payload) => ipcRenderer.invoke("localitfy:check-for-updates", payload),
  downloadUpdate: () => ipcRenderer.invoke("localitfy:download-update"),
  installUpdate: () => ipcRenderer.invoke("localitfy:install-update"),

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

  onMiniState: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("mini:state", handler);

    return () => {
      ipcRenderer.removeListener("mini:state", handler);
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
