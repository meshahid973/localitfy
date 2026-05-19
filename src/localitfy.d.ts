export {};

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
    file?: string;
    progress?: number;
    percent?: number;
    speed?: string;
    size?: string;
    eta?: string;
    message?: string;
    sizeBytes?: number;
    downloadedBytes?: number;
    totalBytes?: number;
    speedBytesPerSecond?: number;
  };

  type LocalitfyDownloadResult = {
    ok: boolean;
    url?: string;
    filePath?: string;
    filename?: string;
    sizeBytes?: number;
    error?: string;
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
    hasSong?: boolean;
    minimizeToTray?: boolean;
    startWithWindows?: boolean;
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
      clearLibrary: () => Promise<any[]>;

      downloadAudioUrls: (payload: {
        urls?: string[] | string;
        text?: string;
      }) => Promise<{
        downloadFolder: string;
        downloads: LocalitfyDownloadResult[];
        changedCount: number;
        songs: any[];
      }>;

      openDownloadsFolder: () => Promise<boolean>;

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

      sendPlayerCommand: (command: any) => Promise<boolean>;

      minimizeWindow: () => Promise<boolean>;
      toggleMaximizeWindow: () => Promise<boolean>;
      closeWindow: () => Promise<boolean>;

      updateNativeMediaState?: (payload: LocalitfyNativeMediaState) => Promise<boolean>;
      setMinimizeToTray?: (enabled: boolean) => Promise<boolean | { ok: boolean; minimizeToTray: boolean }>;
      setStartWithWindows?: (enabled: boolean) => Promise<LocalitfyWindowsStartupStatus>;
      getStartWithWindows?: () => Promise<LocalitfyWindowsStartupStatus>;
      getNativeMediaStatus?: () => Promise<any>;
      openExternal?: (url: string) => Promise<{ ok: boolean; reason?: string }>;

      onDownloadProgress: (callback: (payload: LocalitfyDownloadProgressPayload) => void) => () => void;
      onPlayerCommand: (callback: (payload: any) => void) => () => void;
    };
  }
}
