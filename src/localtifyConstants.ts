// Phase 2 compatibility barrel. New ownership lives in feature/core modules.
export { BOOT_MIN_VISIBLE_MS, BOOT_STEPS, INITIAL_LIBRARY_RENDER_LIMIT, LIBRARY_RENDER_BATCH_SIZE, HOME_GRID_RENDER_LIMIT, CUSTOM_THEME_COMMIT_DELAY_MS, V013_DEFAULTS_KEY, START_WITH_WINDOWS_DEFAULT_KEY, ARCADE_GHOST_UNLOCKED_KEY, localtifyLogo, loadingScreenGif, screensaverImage, yukariUpdateImage } from "./core/app.constants";
export { PLAYBACK_URL_CACHE_TTL_MS, PLAYLIST_STORAGE_KEY, QUEUE_STORAGE_KEY, QUEUE_HISTORY_STORAGE_KEY, REPEAT_PLAYLIST_STORAGE_KEY, LIBRARY_ORDER_STORAGE_KEY, ONBOARDING_STORAGE_KEY, CODERPIXEL_ARTIST_EASTER_EGG, CODERPIXEL_ARTIST_CHANCE } from "./features/library/library.constants";
export { settingsCategoryTabs, coverMoodOptions, coverColorSyncOptions, defaultSettings, settingsCategorySpring } from "./features/settings/settings.constants";
export { themes, THEME_ID_SET, RETIRED_ANIMATED_THEME_IDS, THEME_SWATCH_COLORS } from "./features/settings/theme.constants";
export { APP_VERSION, UPDATE_LEAVE_ALONE_PREFIX, WHATS_NEW_SEEN_KEY, defaultUpdatePrompt, updateRibbonEnterSpring, updateRibbonChildSpring, whatsNewItems } from "./features/updates/update.constants";

// Remaining legacy constants are moved feature-by-feature during this Phase 2 branch.
export {
  BUILT_IN_CUSTOM_THEME_PRESETS,
  CUSTOM_THEME_LIBRARY_STORAGE_KEY,
  DEFAULT_RUNTIME_PIXEL_ART_ASSETS,
  DISCORD_ASSET_KEYS,
  DISCORD_HASH_ASSET_KEYS,
  DISCORD_LOGO_ASSET,
  DISCORD_NAMED_ASSET_KEYS,
  LOCALITIFY_DOWNLOAD_URL,
  PIXEL_ART_CACHE_TTL_MS,
  PIXEL_ART_LIBRARY,
  PIXEL_COVER_EXCLUDED_STORAGE_KEY,
  PIXEL_COVER_FAVORITES_STORAGE_KEY,
  THEME_PRESET_COLORS,
  V013_RELEASE_DEFAULTS,
  discordArtModeOptions,
  discordCleanupOptions,
  discordSecondLineOptions,
  discordStyleOptions,
  navItems
} from "./LocaltifyAppView";
