type JsonRecord = Record<string, unknown>;

type LocaltifyWindow = Window & {
  localitfy?: Record<string, any>;
  __LOCALTIFY_DESKTOP_RUNTIME__?: "electron" | "tauri-compat";
};

const SETTINGS_KEY = "localitfy.tauri.settings.v1";
const PLAYLISTS_KEY = "localitfy.tauri.playlists.v1";
const SONGS_KEY = "localitfy.tauri.songs.v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failures must not prevent the desktop shell from rendering.
  }
}

function cloneArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? [...value] as T[] : [];
}

function noOpSubscription() {
  return () => undefined;
}

function migrationPending(feature: string, extra: JsonRecord = {}) {
  return {
    ok: false,
    supported: false,
    runtime: "tauri-compat",
    error: `${feature} has not been migrated to the Tauri backend yet.`,
    ...extra
  };
}

function installTauriCompatibilityBridge() {
  const desktopWindow = window as LocaltifyWindow;

  if (desktopWindow.localitfy) {
    desktopWindow.__LOCALTIFY_DESKTOP_RUNTIME__ = "electron";
    return;
  }

  let settings = readJson<JsonRecord>(SETTINGS_KEY, {});
  let playlists = readJson<any[]>(PLAYLISTS_KEY, []);
  let songs = readJson<any[]>(SONGS_KEY, []);

  const saveSongs = (nextSongs: any[]) => {
    songs = cloneArray(nextSongs);
    writeJson(SONGS_KEY, songs);
    return cloneArray(songs);
  };

  const patchOneSong = (id: string, patch: JsonRecord) => {
    let updated: any | null = null;
    const nextSongs = songs.map((song) => {
      if (String(song?.id || "") !== String(id || "")) return song;
      updated = { ...song, ...patch };
      return updated;
    });
    saveSongs(nextSongs);
    return updated;
  };

  const api: Record<string, any> = {
    bootstrap: async () => ({
      songs: cloneArray(songs),
      settings: { ...settings },
      playlists: cloneArray(playlists),
      windowsIntegration: {
        ok: true,
        supported: false,
        openAtLogin: false,
        restoreState: "tauri-compat"
      },
      database: {
        ok: true,
        runtime: "tauri-compat",
        migrated: false
      },
      discord: migrationPending("Discord activity"),
      covers: {
        ok: true,
        count: 0,
        runtime: "tauri-compat"
      }
    }),

    resolvePlaybackUrl: async (payload: JsonRecord = {}) => {
      const fallbackUrl = String(payload.fallbackUrl || "").trim();
      const filePath = String(payload.filePath || "").trim();
      if (fallbackUrl) {
        return {
          ok: true,
          url: fallbackUrl,
          filePath,
          fileExists: true
        };
      }
      return migrationPending("Local-file playback URL resolution", {
        filePath,
        fileExists: undefined
      });
    },

    importSongs: async () => cloneArray(songs),
    clearLibrary: async () => saveSongs([]),
    repairMissingMetadata: async () => ({ ok: true, changedCount: 0, songs: cloneArray(songs) }),

    scanAlbumFolder: async () => migrationPending("Album-folder scanning", {
      canceled: true,
      albums: [],
      trackCount: 0,
      albumCount: 0
    }),
    importAlbumFolder: async () => migrationPending("Album-folder importing", {
      changedCount: 0,
      songs: cloneArray(songs),
      albums: []
    }),

    downloadAudioUrls: async () => migrationPending("Downloading", {
      downloadFolder: "",
      downloads: [],
      changedCount: 0,
      songs: cloneArray(songs)
    }),
    cancelDownload: async () => ({ cancelled: false }),
    chooseDownloadFolder: async () => ({ canceled: true, folder: "" }),
    openDownloadsFolder: async () => false,
    pickAndConvertMedia: async () => migrationPending("Media conversion", {
      downloadFolder: "",
      conversions: [],
      changedCount: 0,
      songs: cloneArray(songs)
    }),

    listPixelArt: async () => [],
    listPixelCovers: async () => [],
    setPixelArtCover: async (id: string, coverPath: string) => patchOneSong(id, { coverPath }),
    setSongCover: async (id: string, coverPath: string, coverSource = "custom") => patchOneSong(id, { coverPath, coverSource }),
    patchSong: async (id: string, patch: JsonRecord) => patchOneSong(id, patch || {}),
    patchSongs: async (ids: string[], patch: JsonRecord) => {
      const idSet = new Set(cloneArray<string>(ids).map(String));
      return saveSongs(songs.map((song) => idSet.has(String(song?.id || "")) ? { ...song, ...(patch || {}) } : song));
    },
    deleteSong: async (id: string) => saveSongs(songs.filter((song) => String(song?.id || "") !== String(id || ""))),
    randomizeSongCover: async (id: string) => songs.find((song) => String(song?.id || "") === String(id || "")) || null,
    randomizeAllSongCovers: async () => cloneArray(songs),
    randomizeMissingSongCovers: async () => cloneArray(songs),
    randomizeSelectedSongCovers: async () => cloneArray(songs),
    getCoverStats: async () => ({ ok: true, totalSongs: songs.length, runtime: "tauri-compat" }),
    rescanPixelArt: async () => ({ ok: true, count: 0 }),
    listBrokenCovers: async () => [],
    getLeastUsedCover: async () => null,
    getCoverThumbnailStatus: async () => ({ ok: true, count: 0, sizeBytes: 0, queued: 0 }),
    warmCoverThumbnails: async () => ({ ok: true, scanned: 0, created: 0, cached: 0 }),
    cleanupCoverCache: async () => ({ ok: true, removed: 0, sizeBytes: 0 }),
    pickSongCover: async () => null,
    analyzeSongVolume: async () => null,

    getSettings: async () => ({ ...settings }),
    saveSettings: async (nextSettings: JsonRecord) => {
      settings = { ...(nextSettings || {}) };
      writeJson(SETTINGS_KEY, settings);
      return { ...settings };
    },
    getPlaylists: async () => cloneArray(playlists),
    savePlaylists: async (nextPlaylists: any[]) => {
      playlists = cloneArray(nextPlaylists);
      writeJson(PLAYLISTS_KEY, playlists);
      return cloneArray(playlists);
    },

    updateBackupNow: async () => migrationPending("Database backup"),
    repairDatabaseNow: async () => migrationPending("Database repair"),
    getDatabaseStatus: async () => ({ ok: true, runtime: "tauri-compat", migrated: false }),

    setDiscordActivity: async () => migrationPending("Discord activity"),
    updateDiscordActivity: async () => migrationPending("Discord activity"),
    clearDiscordActivity: async () => ({ ok: true, supported: false }),
    getDiscordStatus: async () => migrationPending("Discord activity"),
    resetDiscordCache: async () => ({ ok: true, supported: false }),
    resetDiscordActivity: async () => ({ ok: true, supported: false }),

    updateNativeMediaState: async () => ({ ok: true, supported: false }),
    sendPlayerCommand: async () => ({ ok: true, supported: false }),
    setMinimizeToTray: async () => ({ ok: true, supported: false }),
    setStartWithWindows: async () => ({ ok: true, supported: false, openAtLogin: false }),
    getStartWithWindows: async () => ({ ok: true, supported: false, openAtLogin: false }),
    getNativeMediaStatus: async () => ({ ok: true, supported: false, runtime: "tauri-compat" }),

    openDevTools: async () => false,
    toggleDevTools: async () => false,
    getPerformanceStatus: async () => ({
      ok: true,
      runtime: "tauri-compat",
      platform: navigator.platform || "unknown",
      logicalProcessors: navigator.hardwareConcurrency || 1
    }),
    getGpuStatus: async () => ({ ok: true, runtime: "tauri-compat", available: false }),
    getFeedbackStatus: async () => ({
      ok: false,
      configured: false,
      valid: false,
      status: "not_configured",
      label: "Feedback unavailable in Tauri migration",
      message: "The feedback backend has not been migrated yet."
    }),
    sendFeedback: async () => migrationPending("Feedback sending"),

    minimizeWindow: async () => false,
    toggleMaximizeWindow: async () => false,
    closeWindow: async () => false,

    checkForUpdates: async () => ({
      type: "dev",
      currentVersion: "0.4.2",
      message: "Tauri updater signing is not configured during migration."
    }),
    downloadUpdate: async () => migrationPending("Tauri updates"),
    installUpdate: async () => migrationPending("Tauri updates"),
    openExternal: async (url: string) => {
      const safeUrl = String(url || "").trim();
      if (!/^https?:\/\//i.test(safeUrl)) return false;
      window.open(safeUrl, "_blank", "noopener,noreferrer");
      return true;
    },

    spotifyCheck: async () => migrationPending("Spotify integration", { configured: false, connected: false }),
    spotifyLogin: async () => migrationPending("Spotify login"),
    spotifyImportBrowser: async () => migrationPending("Spotify browser import"),
    spotifySetCookie: async () => migrationPending("Spotify cookie import"),
    spotifyLogout: async () => ({ ok: true, connected: false }),
    spotifyFetch: async () => migrationPending("Spotify fetching", { tracks: [] }),
    spotifyFetchTracks: async () => migrationPending("Spotify fetching", { tracks: [] }),
    spotdlCheck: async () => migrationPending("spotDL", { installed: false }),
    spotdlDownloadBatch: async () => migrationPending("Spotify downloading", {
      downloadFolder: "",
      downloads: [],
      changedCount: 0,
      songs: cloneArray(songs)
    }),
    spotifyDownloadBatch: async () => migrationPending("Spotify downloading", {
      downloadFolder: "",
      downloads: [],
      changedCount: 0,
      songs: cloneArray(songs)
    }),

    onSpotdlTrackDone: noOpSubscription,
    onAutoUpdate: noOpSubscription,
    onDownloadProgress: noOpSubscription,
    onAlbumFolderImportProgress: noOpSubscription,
    onPlayerCommand: noOpSubscription
  };

  api.app = { bootstrap: api.bootstrap };
  api.playback = { resolveUrl: api.resolvePlaybackUrl };
  api.library = {
    importSongs: api.importSongs,
    clear: api.clearLibrary,
    repairMissingMetadata: api.repairMissingMetadata
  };
  api.albums = {
    scanFolder: api.scanAlbumFolder,
    importFolder: api.importAlbumFolder,
    onProgress: api.onAlbumFolderImportProgress
  };
  api.downloads = {
    downloadAudioUrls: api.downloadAudioUrls,
    cancel: api.cancelDownload,
    chooseFolder: api.chooseDownloadFolder,
    openFolder: api.openDownloadsFolder,
    onProgress: api.onDownloadProgress
  };
  api.media = { pickAndConvert: api.pickAndConvertMedia };
  api.pixel = { list: api.listPixelArt };
  api.settings = { get: api.getSettings, save: api.saveSettings };
  api.playlists = { get: api.getPlaylists, save: api.savePlaylists };
  api.nativeMedia = {
    updateState: api.updateNativeMediaState,
    sendPlayerCommand: api.sendPlayerCommand,
    onPlayerCommand: api.onPlayerCommand,
    setMinimizeToTray: api.setMinimizeToTray,
    setStartWithWindows: api.setStartWithWindows,
    getStartWithWindows: api.getStartWithWindows,
    status: api.getNativeMediaStatus
  };

  desktopWindow.localitfy = api;
  desktopWindow.__LOCALTIFY_DESKTOP_RUNTIME__ = "tauri-compat";

  console.info("[localtify] Installed temporary Tauri compatibility bridge.");
}

installTauriCompatibilityBridge();
