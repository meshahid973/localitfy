import type { Song } from "./features/library/song.types";
import type { Settings } from "./features/settings/settings.types";

export {};

type LocalitfyFeedbackStatus = {
  ok: boolean;
  configured: boolean;
  valid: boolean;
  envName?: string;
  status?: "ready" | "invalid" | "not_configured" | string;
  label?: string;
  message?: string;
};

declare global {
  type LocalitfyPixelArtItem = {
    name: string;
    filePath: string;
    url: string;
    assetKey?: string;
  };

  type PixelArtBridgeAsset = {
    name?: string;
    key?: string;
    path?: string;
    url?: string;
  };

  type LocalitfyDownloadProgressPayload = {
    type: string;
    id?: string;
    url?: string;
    index?: number;
    total?: number;
    status?: "queued" | "downloading" | "converting" | "importing" | "done" | "failed" | "cancelled";
    file?: string;
    filename?: string;
    progress?: number;
    percent?: number;
    speed?: string | null;
    size?: string | null;
    eta?: string | null;
    message?: string;
    error?: string;
    sizeBytes?: number;
    downloadedBytes?: number;
    totalBytes?: number;
    speedBytesPerSecond?: number;
    source?: string;
    spotifyTrackId?: string;
    spotifyUrl?: string;
    provider?: string;
    providerUrl?: string;
    matchedTitle?: string;
    matchedArtist?: string;
    matchedDurationMs?: number;
    matchScore?: number;
    matchOk?: boolean;
    librarySongId?: string;
    importedToLibrary?: boolean;
    statusLabel?: string;
  };

  type LocalitfyDownloadResult = {
    ok: boolean;
    url?: string;
    filePath?: string;
    filename?: string;
    sizeBytes?: number;
    error?: string;
    source?: string;
    spotifyTrackId?: string;
    spotifyUrl?: string;
    provider?: string;
    providerUrl?: string;
    matchedTitle?: string;
    matchedArtist?: string;
    matchedDurationMs?: number;
    matchScore?: number;
    matchOk?: boolean;
    librarySongId?: string;
    importedToLibrary?: boolean;
    statusLabel?: string;
  };

  type LocalitfyConversionResult = {
    ok: boolean;
    sourcePath?: string;
    filePath?: string;
    filename?: string;
    error?: string;
  };

  type LocalitfyPlaylistRecord = {
    id: string;
    name: string;
    songIds: string[];
    createdAt: number;
  };

  type LocalitfyAlbumFolderScanTrack = {
    id: string;
    filePath: string;
    title: string;
    artist: string;
    album: string;
    disc?: number;
    track?: number;
    duplicate?: boolean;
  };

  type LocalitfyAlbumFolderPreview = {
    id: string;
    title: string;
    artist: string;
    sourcePath: string;
    coverPath?: string;
    coverSource?: "custom" | "embedded" | "folder" | "spotify" | "fallback" | "none" | "unknown" | string;
    coverUpdatedAt?: string | null;
    durationMs?: number;
    coverUrl?: string;
    embeddedCoverPath?: string;
    coverThumbUrl?: string;
    coverThumbnailUrl?: string;
    thumbnailUrl?: string;
    coverFullUrl?: string;
    trackCount: number;
    duplicateCount?: number;
    warnings?: string[];
    tracks: LocalitfyAlbumFolderScanTrack[];
  };

  type LocalitfyAlbumFolderScanResult = {
    ok: boolean;
    canceled?: boolean;
    scanId?: string;
    mode?: "single" | "library";
    rootPath?: string;
    albumCount?: number;
    trackCount?: number;
    duplicateCount?: number;
    albums?: LocalitfyAlbumFolderPreview[];
    message?: string;
    error?: string;
  };

  type LocalitfyImportedFolderAlbum = {
    id: string;
    manualAlbumId?: string;
    title: string;
    artist: string;
    year?: string;
    coverUrl?: string;
    coverPath?: string;
    coverSource?: string;
    embeddedCoverPath?: string;
    sourceType: "folder";
    sourcePath: string;
    folderCoverPath?: string;
    importedAt: number;
    createdAt: number;
    updatedAt: number;
    songIds: string[];
    trackCount: number;
    warnings?: string[];
  };

  type LocalitfyAlbumFolderImportResult = {
    ok: boolean;
    scanId?: string;
    mode?: "single" | "library";
    rootPath?: string;
    changedCount: number;
    skippedDuplicates?: number;
    duplicateCount?: number;
    repairedExistingCount?: number;
    songs: Song[];
    albums: LocalitfyImportedFolderAlbum[];
    message?: string;
    error?: string;
  };

  type LocalitfyAlbumFolderProgressPayload = {
    type:
      | "picking"
      | "scan-start"
      | "scan-candidate"
      | "scan-folders-ready"
      | "scan-folder"
      | "scan-done"
      | "import-start"
      | "import-album"
      | "import-track"
      | "import-done"
      | "error";
    mode?: "single" | "library";
    scanId?: string;
    rootPath?: string;
    folder?: string;
    index?: number;
    total?: number;
    changedCount?: number;
    message?: string;
  };

  type LocalitfyWindowsStartupStatus = {
    ok: boolean;
    supported: boolean;
    openAtLogin: boolean;
    openAsHidden?: boolean;
    wasOpenedAtLogin?: boolean;
    wasOpenedAsHidden?: boolean;
    restoreState?: string;
    error?: string;
  };

  type LocalitfyNativeMediaState = {
    appVersion?: string;
    isPlaying?: boolean;
    volume?: number;
    muted?: boolean;
    title?: string;
    artist?: string;
    album?: string;
    coverUrl?: string;
    coverPath?: string;
    coverSource?: string;
    embeddedCoverPath?: string;
    hasSong?: boolean;
    minimizeToTray?: boolean;
    startWithWindows?: boolean;
    platform?: "windows" | "linux" | "mac" | "unknown" | string;
  };

  type LocalitfyNativeMediaStatus = {
    ok: boolean;
    state?: LocalitfyNativeMediaState;
    minimizeToTray?: boolean;
    startWithWindows?: LocalitfyWindowsStartupStatus;
    trayReady?: boolean;
    mediaKeysRegistered?: boolean;
    error?: string;
  };

  type LocalitfyPlayerCommand = {
    type:
      | "toggle"
      | "play"
      | "pause"
      | "stop"
      | "prev"
      | "next"
      | "repeat"
      | "shuffle"
      | "muteToggle"
      | "seekPercent"
      | "volume"
      | string;
    value?: number | string;
    source?: string;
    [key: string]: unknown;
  };

  type AutoUpdateEvent = {
    type: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error" | "dev" | "backup";
    version?: string;
    currentVersion?: string;
    latestVersion?: string;
    percent?: number;
    message?: string;
    error?: string;
    silent?: boolean;
    downloadedBytes?: number;
    totalBytes?: number;
    sizeBytes?: number;
    speedBytesPerSecond?: number;
    backupPath?: string;
    libraryBackedUp?: boolean;
    releaseNotes?: string;
  };

  type LocalitfyFeedbackPayload = {
    category: "bug" | "ui" | "feature" | "other";
    message: string;
    appVersion?: string;
    platform?: string;
    diagnostics?: Record<string, unknown>;
  };

  type LocalitfyFeedbackResult = {
    ok: boolean;
    code?: string;
    statusCode?: number;
    envName?: string;
    error?: string;
  };

  type LocalitfyVolumeAnalysisResult = {
    ok: boolean;
    song?: Song;
    volumeGain?: number;
    meanVolumeDb?: number;
    maxVolumeDb?: number;
    gainDb?: number;
    error?: string;
  };

  type LocalitfyPlaybackUrlResult = {
    ok: boolean;
    filePath?: string;
    url?: string;
    fileExists?: boolean;
    sizeBytes?: number;
    mtimeMs?: number;
    cacheTtlMs?: number;
    error?: string;
  };

  type LocalitfyMetadataRepairResult = {
    ok: boolean;
    changedCount?: number;
    repairedCount?: number;
    skippedCount?: number;
    songs?: Song[];
    error?: string;
  };

  type LocalitfyDatabaseBackupResult = {
    ok: boolean | string;
    error?: string;
  };

  type LocalitfyDatabaseStatus = {
    path?: string;
    schemaVersion?: number;
    expectedSchemaVersion?: number;
    songCount?: number;
    settingsCount?: number;
    playlistCount?: number;
    playlistSongCount?: number;
    missingPathRows?: number;
    missingDurationRows?: number;
    lastMigration?: Record<string, unknown>;
    [key: string]: unknown;
  };

  type LocalitfyDatabaseRepairResult = {
    ok: boolean;
    status?: LocalitfyDatabaseStatus;
    songs?: Song[];
    error?: string;
  };

  type LocalitfyCoverBrokenItem = {
    id: string;
    title?: string;
    coverPath?: string;
  };

  type LocalitfyCoverStats = {
    pixelDir?: string;
    coverCount?: number;
    songCount?: number;
    songsWithCovers?: number;
    songsMissingCovers?: number;
    songsWithBrokenCovers?: number;
    brokenItems?: LocalitfyCoverBrokenItem[];
  };

  type LocalitfyCoverThumbnailStatus = {
    ok: boolean;
    directory?: string;
    count?: number;
    sizeBytes?: number;
    queued?: number;
    size?: number;
    message?: string;
    error?: string;
  };

  type LocalitfyCoverThumbnailWarmResult = {
    ok: boolean;
    scanned?: number;
    created?: number;
    cached?: number;
    warnings?: string[];
    status?: LocalitfyCoverThumbnailStatus;
    message?: string;
    error?: string;
  };

  type LocalitfyCoverThumbnailCleanupResult = {
    ok: boolean;
    directory?: string;
    removed?: number;
    sizeBytes?: number;
    message?: string;
    error?: string;
  };

  type LocalitfyDiscordActivityPayload = Record<string, unknown>;
  type LocalitfyDiscordResult = {
    ok?: boolean;
    status?: string;
    error?: string;
    [key: string]: unknown;
  };

  type LocalitfyDevToolsResult = {
    ok: boolean;
    opened?: boolean;
    mode?: string;
    gpuFeatureStatus?: Record<string, unknown>;
    error?: string;
  };

  type LocalitfySpotifyStatus = {
    ok: boolean;
    ready?: boolean;
    loggedIn?: boolean;
    publicOnly?: boolean;
    fallbackAvailable?: boolean;
    mode?: "oauth-pkce" | "public-fallback" | string;
    needsClientId?: boolean;
    redirectUri?: string;
    message?: string;
    error?: string;
  };

  type LocalitfySpotifyTrackPayload = {
    id?: string;
    spotifyTrackId?: string;
    title?: string;
    name?: string;
    artist?: string;
    artists?: string;
    albumName?: string;
    coverUrl?: string;
    coverPath?: string;
    coverSource?: string;
    embeddedCoverPath?: string;
    spotifyCoverUrl?: string;
    albumCoverUrl?: string;
    spotifyUrl?: string;
    isrc?: string;
    duration?: number;
    durationMs?: number;
  };

  type LocalitfySpotifyFetchResult = {
    ok: boolean;
    name?: string;
    playlistName?: string;
    type?: "playlist" | "album" | "track" | string;
    publicOnly?: boolean;
    fallback?: boolean;
    tracks: LocalitfySpotifyTrackPayload[];
    hint?: string;
    error?: string;
  };

  type LocalitfySpotifyDownloadBatchResult = {
    downloadFolder: string;
    downloads: LocalitfyDownloadResult[];
    changedCount?: number;
    songs?: Song[];
    importedFilePaths?: string[];
    spotifyImportedSongIds?: string[];
    spotifyImportMap?: Array<{
      spotifyTrackId: string;
      songId: string;
      filePath: string;
    }>;
    spotifySourceName?: string;
    spotifySourceType?: string;
    error?: string;
  };

  interface Window {
    localitfy: {
      bootstrap: () => Promise<{
        songs: Song[];
        settings: Partial<Settings>;
        playlists?: LocalitfyPlaylistRecord[];
        windowsIntegration?: LocalitfyWindowsStartupStatus;
        database?: LocalitfyDatabaseStatus;
        discord?: Record<string, unknown>;
        covers?: Record<string, unknown>;
      }>;
      resolvePlaybackUrl: (payload: { filePath: string }) => Promise<LocalitfyPlaybackUrlResult>;

      importSongs: () => Promise<Song[]>;
      repairMissingMetadata: (payload?: Record<string, unknown>) => Promise<LocalitfyMetadataRepairResult>;
      scanAlbumFolder?: (payload?: { mode?: "single" | "library" }) => Promise<LocalitfyAlbumFolderScanResult>;
      importAlbumFolder?: (payload: { scanId: string }) => Promise<LocalitfyAlbumFolderImportResult>;
      clearLibrary: () => Promise<Song[]>;

      downloadAudioUrls: (payload: {
        urls?: string[] | string;
        text?: string;
        options?: {
          quality?: string;
          format?: string;
          autoAdd?: boolean;
          cleanTitle?: boolean;
          downloadFolder?: string;
        };
      }) => Promise<{
        downloadFolder: string;
        downloads: LocalitfyDownloadResult[];
        changedCount: number;
        songs: Song[];
        autoAdd?: boolean;
      }>;

      cancelDownload: () => Promise<{ cancelled: boolean }>;
      chooseDownloadFolder: () => Promise<{ canceled: boolean; folder: string }>;
      openDownloadsFolder: (folder?: string) => Promise<boolean>;

      pickAndConvertMedia: (payload: { bitrate?: number }) => Promise<{
        downloadFolder: string;
        conversions: LocalitfyConversionResult[];
        changedCount: number;
        songs: Song[];
      }>;

      listPixelArt?: () => Promise<PixelArtBridgeAsset[]>;
      listPixelCovers?: () => Promise<Array<{ name: string; key?: string; path: string; url: string }>>;

      setPixelArtCover?: (id: string, coverPath: string) => Promise<Song | null>;
      setSongCover?: (id: string, coverPath: string) => Promise<Song | null>;

      patchSong: (id: string, patch: Partial<Song>) => Promise<Song | null>;
      deleteSong: (id: string) => Promise<Song[]>;

      randomizeSongCover: (id: string) => Promise<Song | null>;
      randomizeAllSongCovers?: () => Promise<Song[]>;
      randomizeMissingSongCovers?: () => Promise<Song[]>;
      randomizeSelectedSongCovers?: (ids: string[]) => Promise<Song[]>;

      pickSongCover: (id: string) => Promise<Song | null>;

      getCoverStats?: () => Promise<LocalitfyCoverStats>;
      rescanPixelArt?: () => Promise<Song[]>;
      listBrokenCovers?: () => Promise<LocalitfyCoverBrokenItem[]>;
      getLeastUsedCover?: () => Promise<string | null>;
      getCoverThumbnailStatus?: () => Promise<LocalitfyCoverThumbnailStatus>;
      warmCoverThumbnails?: (payload?: { limit?: number; force?: boolean }) => Promise<LocalitfyCoverThumbnailWarmResult>;
      cleanupCoverCache: () => Promise<LocalitfyCoverThumbnailCleanupResult>;

      analyzeSongVolume?: (id: string) => Promise<LocalitfyVolumeAnalysisResult>;

      getSettings: () => Promise<Partial<Settings>>;
      saveSettings: (settings: Partial<Settings>) => Promise<Partial<Settings>>;

      getPlaylists?: () => Promise<LocalitfyPlaylistRecord[]>;
      savePlaylists?: (playlists: LocalitfyPlaylistRecord[]) => Promise<LocalitfyPlaylistRecord[]>;

      setDiscordActivity: (payload: LocalitfyDiscordActivityPayload) => Promise<LocalitfyDiscordResult>;
      updateDiscordActivity: (payload: LocalitfyDiscordActivityPayload) => Promise<LocalitfyDiscordResult>;
      clearDiscordActivity: () => Promise<LocalitfyDiscordResult>;
      getDiscordStatus?: () => Promise<LocalitfyDiscordResult>;
      resetDiscordCache: () => Promise<LocalitfyDiscordResult>;
      resetDiscordActivity?: () => Promise<LocalitfyDiscordResult>;

      getDatabaseStatus?: () => Promise<LocalitfyDatabaseStatus>;
      updateBackupNow: () => Promise<LocalitfyDatabaseBackupResult>;
      repairDatabaseNow: () => Promise<LocalitfyDatabaseRepairResult>;

      checkForUpdates?: (payload?: { silent?: boolean }) => Promise<boolean>;
      downloadUpdate?: () => Promise<boolean>;
      installUpdate?: () => Promise<boolean>;
      onAutoUpdate?: (callback: (payload: AutoUpdateEvent) => void) => () => void;

      sendPlayerCommand: (command: LocalitfyPlayerCommand) => Promise<{ ok: boolean; command?: LocalitfyPlayerCommand }> | Promise<boolean>;

      minimizeWindow: () => Promise<boolean>;
      toggleMaximizeWindow: () => Promise<boolean>;
      closeWindow: () => Promise<boolean>;

      updateNativeMediaState?: (payload: LocalitfyNativeMediaState) => Promise<boolean>;
      setMinimizeToTray?: (enabled: boolean) => Promise<boolean | { ok: boolean; minimizeToTray: boolean }>;
      setStartWithWindows?: (enabled: boolean) => Promise<LocalitfyWindowsStartupStatus>;
      getStartWithWindows?: () => Promise<LocalitfyWindowsStartupStatus>;
      getNativeMediaStatus?: () => Promise<LocalitfyNativeMediaStatus>;
      openDevTools?: (payload?: { mode?: string }) => Promise<LocalitfyDevToolsResult>;
      toggleDevTools?: () => Promise<LocalitfyDevToolsResult>;
      restartApp?: () => Promise<boolean>;
      openLogsFolder?: () => Promise<{ ok: boolean; path?: string; error?: string }>;
      getPerformanceStatus?: () => Promise<{
        ok: boolean;
        appVersion?: string;
        electronVersion?: string;
        chromeVersion?: string;
        nodeVersion?: string;
        platform?: string;
        arch?: string;
        isPackaged?: boolean;
        gpuFeatureStatus?: Record<string, unknown>;
        window?: Record<string, unknown>;
      }>;
      getGpuStatus?: () => Promise<unknown>;
      sendFeedback?: (payload: LocalitfyFeedbackPayload) => Promise<LocalitfyFeedbackResult>;
      getFeedbackStatus?: () => Promise<LocalitfyFeedbackStatus>;
      openExternal?: (url: string) => Promise<{ ok: boolean; reason?: string }>;

      spotifyCheck?: () => Promise<LocalitfySpotifyStatus>;
      spotifyLogin?: () => Promise<LocalitfySpotifyStatus>;
      spotifyImportBrowser: () => Promise<LocalitfySpotifyStatus>;
      spotifySetCookie: (payload: string | { spDc?: string }) => Promise<LocalitfySpotifyStatus>;
      spotifyLogout?: () => Promise<LocalitfySpotifyStatus>;
      spotifyFetch?: (payload: { url: string }) => Promise<LocalitfySpotifyFetchResult>;
      spotifyFetchTracks?: (url: string) => Promise<LocalitfySpotifyFetchResult>;
      spotdlCheck?: () => Promise<{ ok: boolean; installed?: boolean; engine?: string; message?: string; error?: string }>;
      spotdlDownloadBatch?: (payload: { tracks: LocalitfySpotifyTrackPayload[]; options?: Record<string, unknown>; sourceName?: string; sourceType?: string }) => Promise<LocalitfySpotifyDownloadBatchResult>;
      spotifyDownloadBatch?: (payload: { tracks: LocalitfySpotifyTrackPayload[]; options?: Record<string, unknown>; sourceName?: string; sourceType?: string }) => Promise<LocalitfySpotifyDownloadBatchResult>;
      onSpotdlTrackDone?: (callback: (payload: LocalitfyDownloadProgressPayload | LocalitfyDownloadResult) => void) => () => void;

      onAlbumFolderImportProgress?: (callback: (payload: LocalitfyAlbumFolderProgressPayload) => void) => () => void;
      onDownloadProgress: (callback: (payload: LocalitfyDownloadProgressPayload) => void) => () => void;
      onPlayerCommand: (callback: (payload: LocalitfyPlayerCommand) => void) => () => void;
    };
  }
}
