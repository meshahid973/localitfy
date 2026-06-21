// @ts-nocheck


export type LocaltifyBootStep = {
  label: string;
  detail: string;
};

export type LocaltifyUpdatePromptState = {
  visible: boolean;
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "latest" | "error" | "dev";
  version: string;
  percent: number;
  message: string;
  error: string;
  backupPath?: string;
  libraryBackedUp?: boolean;
  releaseNotes?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  sizeBytes?: number;
  speedBytesPerSecond?: number;
  nagStage?: 0 | 1 | 2 | 3;
};

export const APP_VERSION = "0.4.2";

export const BOOT_STEPS = [
  { label: "settings", detail: "theme, volume, Discord, and app preferences" },
  { label: "library", detail: "songs, folders, durations, and saved order" },
  { label: "playlists", detail: "mixes, song order, covers, and totals" },
  { label: "covers", detail: "pixel art, album art, and ambience colors" },
  { label: "player", detail: "queue, last song, progress, and audio state" },
  { label: "interface", detail: "home, settings, animations, and shortcuts" }
] as const satisfies readonly LocaltifyBootStep[];

export const defaultUpdatePrompt: LocaltifyUpdatePromptState = {
  visible: false,
  status: "idle",
  version: "",
  percent: 0,
  message: "",
  error: ""
};

export const WHATS_NEW_SEEN_KEY = "localitfy.whatsNewSeenVersion";
export const UPDATE_LEAVE_ALONE_PREFIX = "localitfy.updateLeaveAloneVersion.";

export {
  ARCADE_GHOST_UNLOCKED_KEY,
  BOOT_MIN_VISIBLE_MS,
  BUILT_IN_CUSTOM_THEME_PRESETS,
  CODERPIXEL_ARTIST_CHANCE,
  CODERPIXEL_ARTIST_EASTER_EGG,
  CUSTOM_THEME_COMMIT_DELAY_MS,
  CUSTOM_THEME_LIBRARY_STORAGE_KEY,
  DEFAULT_RUNTIME_PIXEL_ART_ASSETS,
  DISCORD_ASSET_KEYS,
  DISCORD_HASH_ASSET_KEYS,
  DISCORD_LOGO_ASSET,
  DISCORD_NAMED_ASSET_KEYS,
  HOME_GRID_RENDER_LIMIT,
  INITIAL_LIBRARY_RENDER_LIMIT,
  LIBRARY_ORDER_STORAGE_KEY,
  LIBRARY_RENDER_BATCH_SIZE,
  LOCALITFY_DOWNLOAD_URL,
  ONBOARDING_STORAGE_KEY,
  PIXEL_ART_CACHE_TTL_MS,
  PIXEL_ART_LIBRARY,
  PIXEL_COVER_EXCLUDED_STORAGE_KEY,
  PIXEL_COVER_FAVORITES_STORAGE_KEY,
  PLAYBACK_URL_CACHE_TTL_MS,
  PLAYLIST_STORAGE_KEY,
  QUEUE_HISTORY_STORAGE_KEY,
  QUEUE_STORAGE_KEY,
  REPEAT_PLAYLIST_STORAGE_KEY,
  RETIRED_ANIMATED_THEME_IDS,
  START_WITH_WINDOWS_DEFAULT_KEY,
  THEME_ID_SET,
  THEME_PRESET_COLORS,
  THEME_SWATCH_COLORS,
  V013_DEFAULTS_KEY,
  V013_RELEASE_DEFAULTS,
  coverColorSyncOptions,
  coverMoodOptions,
  defaultSettings,
  discordArtModeOptions,
  discordCleanupOptions,
  discordSecondLineOptions,
  discordStyleOptions,
  loadingScreenGif,
  localtifyLogo,
  navItems,
  screensaverImage,
  settingsCategorySpring,
  settingsCategoryTabs,
  themes,
  updateRibbonChildSpring,
  updateRibbonEnterSpring,
  whatsNewItems,
  yukariUpdateImage
} from "./LocaltifyAppView";
