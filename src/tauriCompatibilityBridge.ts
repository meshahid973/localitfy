type JsonRecord = Record<string, unknown>;

type TauriInvoke = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;

type TauriGlobal = {
  core?: {
    invoke?: TauriInvoke;
    convertFileSrc?: (filePath: string, protocol?: string) => string;
  };
};

type TauriInternals = {
  invoke?: TauriInvoke;
};

type LocaltifyWindow = Window & {
  localitify?: Record<string, any>;
  localtify?: Record<string, any>;
  __TAURI__?: TauriGlobal;
  __TAURI_INTERNALS__?: TauriInternals;
  __LOCALTIFY_DESKTOP_RUNTIME__?: "electron" | "tauri-compat";
};

const SETTINGS_KEY = "localitfy.tauri.settings.v1";
const PLAYLISTS_KEY = "localitfy.tauri.playlists.v1";
const SONGS_KEY = "localitfy.tauri.songs.v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A storage failure must never blank the desktop renderer.
  }
}

function cloneArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? ([...value] as T[]) : [];
}

function asObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function noOpSubscription() {
  return () => undefined;
}

function migrationPending(feature: string, extra: JsonRecord = {}) {
  return {
    ok: false,
    supported: false,
    runtime: "tauri-migration",
    error: `${feature} has not been migrated to the Tauri backend yet.`,
    ...extra
  };
}

function installNativeTauriFrameLayout() {
  document.documentElement.dataset.localtifyRuntime = "tauri";

  const apply = () => {
    const titleBar = document.querySelector<HTMLElement>(".titleBar");
    const appShell = document.querySelector<HTMLElement>(".appShell");

    if (titleBar) {
      titleBar.hidden = true;
      titleBar.style.display = "none";
    }

    if (appShell) {
      appShell.style.height = "100vh";
    }

    return Boolean(titleBar && appShell);
  };

  if (apply()) return;

  const observer = new MutationObserver(() => {
    if (apply()) observer.disconnect();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function installTauriCompatibilityBridge() {
  const desktopWindow = window as LocaltifyWindow;

  if (desktopWindow.localtify || desktopWindow.localitify) {
    desktopWindow.__LOCALTIFY_DESKTOP_RUNTIME__ = "electron";
    return;
  }

  installNativeTauriFrameLayout();

  const resolveInvoke = (): TauriInvoke | null => {
    const globalInvoke = desktopWindow.__TAURI__?.core?.invoke;
    if (typeof globalInvoke === "function") return globalInvoke.bind(desktopWindow.__TAURI__?.core);

    const internalInvoke = desktopWindow.__TAURI_INTERNALS__?.invoke;
    if (typeof internalInvoke === "function") return internalInvoke.bind(desktopWindow.__TAURI_INTERNALS__);

    return null;
  };

  const invoke = async <T = unknown>(command: string, args: Record<string, unknown> = {}) => {
    const invokeCommand = resolveInvoke();
    if (!invokeCommand) {
      throw new Error(
        "Tauri invoke bridge is unavailable. Confirm app.withGlobalTauri is enabled and restart the Tauri process."
      );
    }
    return invokeCommand<T>(command, args);
  };

  const convertFileSrc = (filePath: string) => {
    const convert = desktopWindow.__TAURI__?.core?.convertFileSrc;
    if (typeof convert !== "function") return "";
    try {
      return convert(String(filePath || ""));
    } catch {
      return "";
    }
  };

  let settings = readJson<JsonRecord>(SETTINGS_KEY, {});
  let playlists = readJson<any[]>(PLAYLISTS_KEY, []);
  let songs = readJson<any[]>(SONGS_KEY, []);

  const hydrateSong = (song: any) => {
    if (!song || typeof song !== "object") return song;

    const coverPath = String(song.coverPath || "").trim();
    const coverUrl = coverPath ? convertFileSrc(coverPath) : "";

    return {
      ...song,
      url: "",
      ...(coverUrl ? { coverUrl, coverFullUrl: coverUrl } : {})
    };
  };

  const rememberState = (nextSongs: unknown, nextSettings: unknown, nextPlaylists: unknown) => {
    songs = cloneArray<any>(nextSongs).map(hydrateSong);
    settings = asObject(nextSettings);
    playlists = cloneArray(nextPlaylists);
    writeJson(SONGS_KEY, songs);
    writeJson(SETTINGS_KEY, settings);
    writeJson(PLAYLISTS_KEY, playlists);
  };

  const fallbackBootstrap = (error?: unknown) => ({
    songs: cloneArray(songs),
    settings: { ...settings },
    playlists: cloneArray(playlists),
    windowsIntegration: {
      ok: true,
      supported: false,
      openAtLogin: false,
      restoreState: "tauri-fallback"
    },
    database: {
      ok: !error,
      runtime: "tauri-local-fallback",
      migrated: false,
      legacyPreserved: true,
      error: error instanceof Error ? error.message : error ? String(error) : undefined
    },
    discord: migrationPending("Discord activity"),
    covers: {
      ok: true,
      count: songs.length,
      runtime: "tauri-fallback"
    }
  });

  const api: Record<string, any> = {
    bootstrap: async () => {
      try {
        let payload = await invoke<any>("bootstrap_localtify");
        const payloadSongs = cloneArray(payload?.songs);
        const candidateCount = Number(payload?.database?.candidateCount || 0);

        if (payloadSongs.length === 0 && candidateCount > 0) {
          payload = await invoke<any>("restore_localtify_legacy_data");
        }

        rememberState(payload?.songs, payload?.settings, payload?.playlists);
        return payload;
      } catch (error) {
        console.error("[localtify] Tauri data bootstrap failed.", error);

        if (songs.length > 0 || playlists.length > 0 || Object.keys(settings).length > 0) {
          console.warn("[localtify] Using the last preserved renderer snapshot instead of showing an empty library.");
          return fallbackBootstrap(error);
        }

        throw error;
      }
    },

    restoreLegacyData: async () => {
      const payload = await invoke<any>("restore_localtify_legacy_data");
      rememberState(payload?.songs, payload?.settings, payload?.playlists);
      return payload;
    },

    resolvePlaybackUrl: async (payload: JsonRecord = {}) => {
      const fallbackUrl = String(payload.fallbackUrl || "").trim();
      const filePath = String(payload.filePath || "").trim();

      if (fallbackUrl) {
        return { ok: true, url: fallbackUrl, filePath, fileExists: true };
      }

      const assetUrl = filePath ? convertFileSrc(filePath) : "";
      if (assetUrl) {
        return { ok: true, url: assetUrl, filePath, fileExists: true };
      }

      return migrationPending("Local-file playback URL resolution", {
        filePath,
        fileExists: undefined
      });
    },

    importSongs: async () => cloneArray(songs),
    clearLibrary: async () => {
      songs = cloneArray(await invoke<any[]>("clear_localtify_library"));
      writeJson(SONGS_KEY, songs);
      return cloneArray(songs);
    },
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
    patchSong: async (id: string, patch: JsonRecord) => {
      const updated = await invoke<any>("patch_localtify_song", { id, patch });
      if (updated) {
        songs = songs.map((song) => String(song?.id || "") === String(id) ? hydrateSong(updated) : song);
        writeJson(SONGS_KEY, songs);
      }
      return updated;
    },
    patchSongs: async (ids: string[], patch: JsonRecord) => {
      songs = cloneArray(await invoke<any[]>("patch_localtify_songs", { ids, patch })).map(hydrateSong);
      writeJson(SONGS_KEY, songs);
      return cloneArray(songs);
    },
    deleteSong: async (id: string) => {
      songs = cloneArray(await invoke<any[]>("delete_localtify_song", { id })).map(hydrateSong);
      writeJson(SONGS_KEY, songs);
      return cloneArray(songs);
    },
    setPixelArtCover: async (id: string, coverPath: string) => api.patchSong(id, { coverPath }),
    setSongCover: async (id: string, coverPath: string, coverSource = "custom") => api.patchSong(id, { coverPath, coverSource }),
    randomizeSongCover: async (id: string) => songs.find((song) => String(song?.id || "") === String(id)) || null,
    randomizeAllSongCovers: async () => cloneArray(songs),
    randomizeMissingSongCovers: async () => cloneArray(songs),
    randomizeSelectedSongCovers: async () => cloneArray(songs),
    getCoverStats: async () => ({ ok: true, totalSongs: songs.length, runtime: "tauri-migration" }),
    rescanPixelArt: async () => ({ ok: true, count: 0 }),
    listBrokenCovers: async () => [],
    getLeastUsedCover: async () => null,
    getCoverThumbnailStatus: async () => ({ ok: true, count: 0, sizeBytes: 0, queued: 0 }),
    warmCoverThumbnails: async () => ({ ok: true, scanned: 0, created: 0, cached: 0 }),
    cleanupCoverCache: async () => ({ ok: true, removed: 0, sizeBytes: 0 }),
    pickSongCover: async () => null,
    analyzeSongVolume: async () => null,

    getSettings: async () => {
      settings = asObject(await invoke("get_localtify_settings"));
      writeJson(SETTINGS_KEY, settings);
      return { ...settings };
    },
    saveSettings: async (nextSettings: JsonRecord) => {
      settings = asObject(await invoke("save_localtify_settings", { settings: asObject(nextSettings) }));
      writeJson(SETTINGS_KEY, settings);
      return { ...settings };
    },
    getPlaylists: async () => {
      playlists = cloneArray(await invoke<any[]>("get_localtify_playlists"));
      writeJson(PLAYLISTS_KEY, playlists);
      return cloneArray(playlists);
    },
    savePlaylists: async (nextPlaylists: any[]) => {
      playlists = cloneArray(await invoke<any[]>("save_localtify_playlists", { playlists: cloneArray(nextPlaylists) }));
      writeJson(PLAYLISTS_KEY, playlists);
      return cloneArray(playlists);
    },

    updateBackupNow: async () => invoke("backup_localtify_state"),
    backupDatabaseNow: async () => invoke("backup_localtify_state"),
    repairDatabaseNow: async () => api.getDatabaseStatus(),
    getDatabaseStatus: async () => invoke("localtify_database_status"),

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
    getNativeMediaStatus: async () => ({ ok: true, supported: false, runtime: "tauri-migration" }),

    openDevTools: async () => false,
    toggleDevTools: async () => false,
    getPerformanceStatus: async () => ({
      ok: true,
      runtime: "tauri-migration",
      platform: navigator.platform || "unknown",
      logicalProcessors: navigator.hardwareConcurrency || 1
    }),
    getGpuStatus: async () => ({ ok: true, runtime: "tauri-migration", available: false }),
    getFeedbackStatus: async () => ({
      ok: false,
      configured: false,
      valid: false,
      status: "not_configured",
      label: "Feedback unavailable in Tauri migration",
      message: "The feedback backend has not been migrated yet."
    }),
    sendFeedback: async () => migrationPending("Feedback sending"),

    minimizeWindow: async () => invoke("localtify_window_minimize").then(() => true),
    toggleMaximizeWindow: async () => invoke("localtify_window_toggle_maximize").then(() => true),
    closeWindow: async () => invoke("localtify_window_close").then(() => true),
    startWindowDrag: async () => invoke("localtify_window_start_dragging").then(() => true),

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
  api.songs = {
    patch: api.patchSong,
    patchMany: api.patchSongs,
    delete: api.deleteSong,
    setCover: api.setSongCover,
    pickCover: api.pickSongCover,
    randomCover: api.randomizeSongCover,
    analyzeVolume: api.analyzeSongVolume
  };
  api.covers = {
    listPixelArt: api.listPixelArt,
    stats: api.getCoverStats,
    rescan: api.rescanPixelArt,
    randomizeAll: api.randomizeAllSongCovers,
    randomizeMissing: api.randomizeMissingSongCovers,
    randomizeSelected: api.randomizeSelectedSongCovers,
    broken: api.listBrokenCovers,
    leastUsed: api.getLeastUsedCover,
    thumbnailStatus: api.getCoverThumbnailStatus,
    warmThumbnails: api.warmCoverThumbnails,
    cleanupCache: api.cleanupCoverCache
  };
  api.settings = { get: api.getSettings, save: api.saveSettings };
  api.playlists = { get: api.getPlaylists, save: api.savePlaylists };
  api.database = {
    backupNow: api.updateBackupNow,
    repairNow: api.repairDatabaseNow,
    status: api.getDatabaseStatus,
    restoreLegacyData: api.restoreLegacyData
  };
  api.discord = {
    setActivity: api.setDiscordActivity,
    clearActivity: api.clearDiscordActivity,
    status: api.getDiscordStatus,
    resetCache: api.resetDiscordCache
  };
  api.nativeMedia = {
    updateState: api.updateNativeMediaState,
    sendPlayerCommand: api.sendPlayerCommand,
    onPlayerCommand: api.onPlayerCommand,
    setMinimizeToTray: api.setMinimizeToTray,
    setStartWithWindows: api.setStartWithWindows,
    getStartWithWindows: api.getStartWithWindows,
    status: api.getNativeMediaStatus
  };
  api.system = {
    openDevTools: api.openDevTools,
    toggleDevTools: api.toggleDevTools,
    performanceStatus: api.getPerformanceStatus,
    gpuStatus: api.getGpuStatus,
    openExternal: api.openExternal,
    minimizeWindow: api.minimizeWindow,
    toggleMaximizeWindow: api.toggleMaximizeWindow,
    closeWindow: api.closeWindow
  };

  desktopWindow.localtify = api;
  desktopWindow.__LOCALTIFY_DESKTOP_RUNTIME__ = "tauri-compat";

  console.info("[localtify] Installed stable Tauri bridge with protected legacy-data recovery.");
}

installTauriCompatibilityBridge();
