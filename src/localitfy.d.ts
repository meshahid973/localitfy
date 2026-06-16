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
    coverPath?: string;
    coverSource?: string;
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
    songs: any[];
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
    [key: string]: any;
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
    diagnostics?: Record<string, any>;
  };

  type LocalitfyFeedbackResult = {
    ok: boolean;
    error?: string;
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

  type LocalitfySpotifyDownloadBatchResult = {
    downloadFolder: string;
    downloads: LocalitfyDownloadResult[];
    changedCount?: number;
    songs?: any[];
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
        songs: any[];
        settings: Record<string, any>;
        playlists?: LocalitfyPlaylistRecord[];
        windowsIntegration?: LocalitfyWindowsStartupStatus;
        database?: Record<string, any>;
        discord?: Record<string, any>;
        covers?: Record<string, any>;
      }>;

      importSongs: () => Promise<any[]>;
      scanAlbumFolder?: (payload?: { mode?: "single" | "library" }) => Promise<LocalitfyAlbumFolderScanResult>;
      importAlbumFolder?: (payload: { scanId: string }) => Promise<LocalitfyAlbumFolderImportResult>;
      clearLibrary: () => Promise<any[]>;

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
        songs: any[];
        autoAdd?: boolean;
      }>;

      cancelDownload: () => Promise<{ cancelled: boolean }>;
      chooseDownloadFolder: () => Promise<{ canceled: boolean; folder: string }>;
      openDownloadsFolder: (folder?: string) => Promise<boolean>;

      pickAndConvertMedia: (payload: {
        bitrate?: number;
      }) => Promise<{
        downloadFolder: string;
        conversions: LocalitfyConversionResult[];
        changedCount: number;
        songs: any[];
      }>;

      listPixelArt?: () => Promise<PixelArtBridgeAsset[]>;
      listPixelCovers?: () => Promise<
        Array<{
          name: string;
          key?: string;
          path: string;
          url: string;
        }>
      >;

      setPixelArtCover?: (id: string, coverPath: string) => Promise<any | null>;
      setSongCover?: (id: string, coverPath: string) => Promise<any | null>;

      patchSong: (id: string, patch: any) => Promise<any | null>;
      deleteSong: (id: string) => Promise<any[]>;

      randomizeSongCover: (id: string) => Promise<any | null>;
      randomizeAllSongCovers?: () => Promise<any[]>;
      randomizeMissingSongCovers?: () => Promise<any[]>;
      randomizeSelectedSongCovers?: (ids: string[]) => Promise<any[]>;

      pickSongCover: (id: string) => Promise<any | null>;

      getCoverStats?: () => Promise<any>;
      rescanPixelArt?: () => Promise<any>;
      listBrokenCovers?: () => Promise<any[]>;
      getLeastUsedCover?: () => Promise<any | null>;
      getCoverThumbnailStatus?: () => Promise<LocalitfyCoverThumbnailStatus>;
      warmCoverThumbnails?: (payload?: { limit?: number; force?: boolean }) => Promise<LocalitfyCoverThumbnailWarmResult>;

      analyzeSongVolume?: (id: string) => Promise<any | null>;

      getSettings: () => Promise<Record<string, any>>;
      saveSettings: (settings: any) => Promise<Record<string, any>>;

      getPlaylists?: () => Promise<LocalitfyPlaylistRecord[]>;
      savePlaylists?: (playlists: LocalitfyPlaylistRecord[]) => Promise<LocalitfyPlaylistRecord[]>;

      updateDiscordActivity: (payload: any) => Promise<any>;
      clearDiscordActivity: () => Promise<any>;
      getDiscordStatus?: () => Promise<any>;
      resetDiscordActivity?: () => Promise<any>;

      getDatabaseStatus?: () => Promise<any>;
      backupDatabase?: () => Promise<any>;
      repairDatabase?: () => Promise<any>;

      checkForUpdates?: (payload?: { silent?: boolean }) => Promise<boolean>;
      downloadUpdate?: () => Promise<boolean>;
      installUpdate?: () => Promise<boolean>;

      onAutoUpdate?: (callback: (payload: AutoUpdateEvent) => void) => () => void;
      onAutoUpdateEvent?: (callback: (payload: AutoUpdateEvent) => void) => () => void;

      sendPlayerCommand: (command: LocalitfyPlayerCommand) => Promise<{ ok: boolean; command?: LocalitfyPlayerCommand }> | Promise<boolean>;

      minimizeWindow: () => Promise<boolean>;
      toggleMaximizeWindow: () => Promise<boolean>;
      closeWindow: () => Promise<boolean>;

      updateNativeMediaState?: (payload: LocalitfyNativeMediaState) => Promise<boolean>;
      setMinimizeToTray?: (enabled: boolean) => Promise<boolean | { ok: boolean; minimizeToTray: boolean }>;
      setStartWithWindows?: (enabled: boolean) => Promise<LocalitfyWindowsStartupStatus>;
      getStartWithWindows?: () => Promise<LocalitfyWindowsStartupStatus>;
      getNativeMediaStatus?: () => Promise<any>;
      openDevTools?: (payload?: any) => Promise<any>;
      toggleDevTools?: () => Promise<any>;
      getPerformanceStatus?: () => Promise<{
        ok: boolean;
        appVersion?: string;
        electronVersion?: string;
        chromeVersion?: string;
        nodeVersion?: string;
        platform?: string;
        arch?: string;
        isPackaged?: boolean;
        gpuFeatureStatus?: Record<string, any>;
        window?: Record<string, any>;
      }>;
      getGpuStatus?: () => Promise<any>;
      sendFeedback?: (payload: LocalitfyFeedbackPayload) => Promise<LocalitfyFeedbackResult>;
      getFeedbackStatus?: () => Promise<LocalitfyFeedbackStatus>;
      openExternal?: (url: string) => Promise<{ ok: boolean; reason?: string }>;

      spotifyCheck?: () => Promise<any>;
      spotifyLogin?: () => Promise<any>;
      spotifyLogout?: () => Promise<any>;
      spotifyFetch?: (payload: { url: string }) => Promise<any>;
      spotifyFetchTracks?: (url: string) => Promise<any>;
      spotdlCheck?: () => Promise<any>;
      spotdlDownloadBatch?: (payload: { tracks: LocalitfySpotifyTrackPayload[]; options?: any; sourceName?: string; sourceType?: string }) => Promise<LocalitfySpotifyDownloadBatchResult>;
      spotifyDownloadBatch?: (payload: { tracks: LocalitfySpotifyTrackPayload[]; options?: any; sourceName?: string; sourceType?: string }) => Promise<LocalitfySpotifyDownloadBatchResult>;
      onSpotdlTrackDone?: (callback: (payload: LocalitfyDownloadProgressPayload | LocalitfyDownloadResult) => void) => () => void;

      onAlbumFolderImportProgress?: (callback: (payload: LocalitfyAlbumFolderProgressPayload) => void) => () => void;
      onDownloadProgress: (callback: (payload: LocalitfyDownloadProgressPayload) => void) => () => void;
      onPlayerCommand: (callback: (payload: LocalitfyPlayerCommand) => void) => () => void;
    };
  }
}

