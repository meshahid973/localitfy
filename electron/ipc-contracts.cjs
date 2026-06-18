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

module.exports = {
  LOCALITFY_IPC_CHANNELS,
  LOCALITFY_ALLOWED_INVOKE_CHANNELS,
  LOCALITFY_ALLOWED_LISTEN_CHANNELS
};
