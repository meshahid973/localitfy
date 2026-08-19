export const BOOT_MIN_VISIBLE_MS = 650;
export const BOOT_STEPS = [
  { label:"settings", detail:"theme, volume, Discord, and app preferences" }, { label:"library", detail:"songs, folders, durations, and saved order" }, { label:"playlists", detail:"mixes, song order, covers, and totals" }, { label:"covers", detail:"pixel art, album art, and ambience colors" }, { label:"player", detail:"queue, last song, progress, and audio state" }, { label:"interface", detail:"home, settings, animations, and shortcuts" }
] as const;
export const INITIAL_LIBRARY_RENDER_LIMIT = 42;
export const LIBRARY_RENDER_BATCH_SIZE = 48;
export const HOME_GRID_RENDER_LIMIT = 42;
export const CUSTOM_THEME_COMMIT_DELAY_MS = 680;
export const V013_DEFAULTS_KEY = "localitfy.v013.defaultsApplied";
export const START_WITH_WINDOWS_DEFAULT_KEY = "localitfy.v029.startWithWindowsDefaultApplied";
export const ARCADE_GHOST_UNLOCKED_KEY = "localitfy.secret.arcadeGhostUnlocked";
export const localtifyLogo = new URL("../assets/logo.png", import.meta.url).href;
export const loadingScreenGif = new URL("../assets/loading-screen.gif", import.meta.url).href;
export const screensaverImage = new URL("../assets/screensaver.jpg", import.meta.url).href;
export const yukariUpdateImage = new URL("../assets/yukari.png", import.meta.url).href;
