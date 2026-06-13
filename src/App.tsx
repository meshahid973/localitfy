// @ts-nocheck
/* localtify 0.3.9 V395 playback settings cleanup + faster volume changes. */
/* localtify 0.3.9 V396 audio engine stability pass. */
/* localtify 0.3.9 V419 background-audio and settings-save stability. */
/* localtify 0.3.9 V418 missing-file recovery actions. */
/* localtify 0.3.9 V425 cover tools + metadata cleaner preview. */
/* localtify 0.3.9 V423 like system + quick library modes. */
/* localtify 0.3.9 V417 metadata cleaner stability pass. */
/* localtify 0.3.9 V415 shuffle queue + context delete. */
import { lazy, memo, startTransition, Suspense, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import type { CSSProperties, PointerEvent, DragEvent, MouseEvent as ReactMouseEvent, SyntheticEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FastAverageColor } from "fast-average-color";
import {
  BarChart3,
  Download,
  FolderPlus,
  Heart,
  Home,
  Images,
  LibraryBig,
  ListMusic,
  MessageCircle,
  Palette,
  Pause,
  Play,
  PlayCircle,
  Settings as SettingsIcon,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Repeat2,
  Volume2,
  VolumeX,
  X,
  Send
} from "lucide-react";
import { useProximityMotion } from "./useProximityMotion";
import { HtmlAudioEngine } from "./player/htmlAudioEngine";
import { createPlayerController } from "./player/playerController";
import type { PlayerController } from "./player/playerController";
import type { PlayerEngineSource } from "./player/PlayerEngine";
import {
  initLocalitfyAnalytics,
  trackAppLaunched,
  trackAppSessionEnded,
  trackAppActive,
  trackAppBackgrounded,
  trackAppForegrounded,
  trackAppView,
  trackSettingsOpened,
  trackThemeChanged,
  trackSongsImported,
  trackImportFailed,
  trackLibrarySnapshot,
  trackLibraryViewChanged,
  trackDownloadsOpened,
  trackDiscordToggled,
  trackUpdatePopupSeen,
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  trackError,
  trackAudienceSnapshot,
  trackMarketingSnapshot,
  trackPlaylistSnapshot,
  trackAcquisitionSource
} from "./analytics";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./styles/tokens.css";
import "./app-core.css";
import "./App.css";
import "./themes.css";
import "./settings.css";
import "./home.css";
import "./motion.css";
import "./onboarding-first-run.css";
import "./player.css";
import "./effects.css";

import LocaltifyAppView, {
  Cover,
  VirtualHomeSongCards,
  VirtualSongRows
} from "./LocaltifyAppView";
import Onboarding from "./Onboarding";
import CatBuddy from "./CatBuddy";
import {
  APP_VERSION,
  BOOT_MIN_VISIBLE_MS,
  BOOT_STEPS,
  BUILT_IN_CUSTOM_THEME_PRESETS,
  CODERPIXEL_ARTIST_EASTER_EGG,
  CUSTOM_THEME_COMMIT_DELAY_MS,
  DISCORD_ASSET_KEYS,
  DISCORD_LOGO_ASSET,
  HOME_GRID_RENDER_LIMIT,
  INITIAL_LIBRARY_RENDER_LIMIT,
  LIBRARY_RENDER_BATCH_SIZE,
  LOCALITFY_DOWNLOAD_URL,
  ONBOARDING_STORAGE_KEY,
  PIXEL_ART_CACHE_TTL_MS,
  PIXEL_COVER_EXCLUDED_STORAGE_KEY,
  PIXEL_COVER_FAVORITES_STORAGE_KEY,
  PLAYBACK_URL_CACHE_TTL_MS,
  PLAYLIST_STORAGE_KEY,
  QUEUE_HISTORY_STORAGE_KEY,
  QUEUE_STORAGE_KEY,
  REPEAT_PLAYLIST_STORAGE_KEY,
  START_WITH_WINDOWS_DEFAULT_KEY,
  THEME_SWATCH_COLORS,
  V013_DEFAULTS_KEY,
  V013_RELEASE_DEFAULTS,
  WHATS_NEW_SEEN_KEY,
  coverColorSyncOptions,
  defaultSettings,
  defaultUpdatePrompt,
  discordArtModeOptions,
  discordCleanupOptions,
  discordSecondLineOptions,
  discordStyleOptions,
  loadingScreenGif,
  localtifyLogo,
  screensaverImage,
  settingsCategoryTabs,
  themes,
  whatsNewItems
} from "./localtifyConstants";
import {
  applyLibraryOrder,
  buildAnimatedThemeVisualStyle,
  buildDiscordPreview,
  buildDiscordSongSearchUrl,
  buildRuntimePixelArtAssets,
  buildSongSearchEntry,
  clamp,
  cleanPlaylistList,
  cleanSongOrderIds,
  cleanStringList,
  cleanToastCopy,
  collapseSpaces,
  coverMoodName,
  createImportAnimationState,
  formatTime,
  friendlyUpdateError,
  getAmbientStyle,
  getCachedRuntimePixelArtAssets,
  getCustomThemeColorPatch,
  getGreeting,
  getMetadataRepairPatch,
  getPixelArtAssetKey,
  getPixelAssetMoodTags,
  getRendererSafeImageUrl,
  getSongAmbientSource,
  getSongCoverUsageKeys,
  getSongPlaybackSourceKey,
  heroTitleDensityClass,
  hexToRgbString,
  hexToRgbaString,
  insertIdNearTarget,
  isPlayableSong,
  lower,
  makeCustomThemeColors,
  makeLocalId,
  makeThemePresetStyle,
  maybeApplyCoderpixelArtist,
  normalizeCoverColorSyncMode,
  normalizeHexColor,
  normalizeHexInputDraft,
  normalizeSettingsSearch,
  normalizeThemeId,
  pixelArtForSong,
  pixelArtUrl,
  prettyMeta,
  prettyTitle,
  randomThemeHex,
  rankSongsForSearch,
  readLocalJson,
  readSavedCustomThemePresets,
  reorderIdList,
  reorderSongList,
  resolveSettingsCategoryFromSearch,
  sanitizeSongList,
  saveLibraryOrder,
  settingsTabMatchesSearch,
  songSignature,
  stableHash,
  stableSongSourceKey,
  updateStatusLabel,
  updateWasLeftAlone,
  useCoverAverageStyle,
  useStableCallback,
  writeLocalJson,
  writeSavedCustomThemePresets
} from "./localtifyUtils";
import type {
  AppToastKind,
  AutoUpdateEvent,
  CoverColorSyncMode,
  CoverMood,
  CustomThemeColorKey,
  CustomThemePreset,
  DiscordArtMode,
  DownloadQueueItem,
  DownloadResult,
  ImportAnimationState,
  LibraryDropSide,
  LibraryDropTarget,
  PlaybackUrlCacheEntry,
  PlaybackUrlResult,
  Playlist,
  PlaylistSummary,
  QueueHistoryItem,
  RuntimePixelArtAsset,
  SecretMode,
  SecretTriggerMode,
  Settings,
  SettingsCategory,
  Song,
  SongContextMenuState,
  SpotifyTrack,
  ThemeId,
  UpdatePromptState,
  View
} from "./localtifyTypes";

const SettingsCategoryContent = lazy(() => import("./SettingsCategoryContent"));

const LOCALTIFY_V301_HEAVY_MOTION_VIEWS = new Set<View>([
  "library",
  "liked",
  "albums",
  "covers",
  "downloads"
]);

const LOCALTIFY_V301_HEAVY_SETTINGS_CATEGORIES = new Set<SettingsCategory>([
  "covers",
  "library",
  "advanced"
]);

function isLocaltifyV301HeavyMotionSurface(view: View, settingsCategory: SettingsCategory) {
  if (LOCALTIFY_V301_HEAVY_MOTION_VIEWS.has(view)) return true;
  return view === "settings" && LOCALTIFY_V301_HEAVY_SETTINGS_CATEGORIES.has(settingsCategory);
}

function runLocaltifyIdleTask(task: () => void, timeout = 1400) {
  const requestIdleCallback = (window as typeof window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  }).requestIdleCallback;

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(task, { timeout });
    return;
  }

  window.setTimeout(task, 0);
}


type LocaltifyAnalyticsSnapshot = Record<string, string | number | boolean>;

function localtifyAnalyticsNumber(snapshot: LocaltifyAnalyticsSnapshot, key: string, fallback = 0) {
  const value = Number(snapshot[key]);
  return Number.isFinite(value) ? value : fallback;
}

function localtifyAnalyticsString(snapshot: LocaltifyAnalyticsSnapshot, key: string, fallback = "") {
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function formatAnalyticsDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) return `${minutes}m`;
  return `${safeSeconds}s`;
}

function computeLocaltifyAnalyticsSnapshot(input: {
  activeView: string;
  songs?: any[];
  likedCount?: number;
  playlists?: any[];
  settings?: Record<string, any>;
  isShuffle?: boolean;
  repeatMode?: string;
  downloadResultCount?: number;
}): LocaltifyAnalyticsSnapshot {
  const songs = Array.isArray(input.songs) ? input.songs : [];
  const playlists = Array.isArray(input.playlists) ? input.playlists : [];
  const settings = input.settings || {};
  const songCount = songs.length;
  const likedCount = Number(input.likedCount || 0);
  const playlistCount = playlists.length;
  const recentImportCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

  let playlistSongTotal = 0;
  let totalLibrarySeconds = 0;
  let totalListenedSeconds = 0;
  let totalPlays = 0;
  let playedSongCount = 0;
  let recentImportWeekCount = 0;
  let missingFileCount = 0;
  let monthImportCount = 0;
  let yearImportCount = 0;
  let monthImportSeconds = 0;
  let yearImportSeconds = 0;
  let longestSongDuration = 0;
  let longestSongTitle = "";

  const artistNames = new Set<string>();
  const albumNames = new Set<string>();
  const monthArtists = new Set<string>();
  const yearArtists = new Set<string>();
  const yearAlbums = new Set<string>();

  for (const playlist of playlists) {
    playlistSongTotal += Array.isArray(playlist?.songIds) ? playlist.songIds.length : 0;
  }

  for (const song of songs) {
    const duration = Math.max(0, Number(song?.duration) || 0);
    const playCount = Math.max(0, Number(song?.playCount) || 0);
    const addedAt = Date.parse(String(song?.dateAdded || ""));
    const artist = String(song?.artist || "").trim().toLowerCase();
    const album = String(song?.album || "").trim().toLowerCase();

    totalLibrarySeconds += duration;
    totalListenedSeconds += duration * playCount;
    totalPlays += playCount;

    if (playCount > 0) playedSongCount += 1;
    if (song?.fileExists === false) missingFileCount += 1;

    if (artist && artist !== "unknown artist") artistNames.add(artist);
    if (album && album !== "unknown album") albumNames.add(album);

    if (duration > longestSongDuration) {
      longestSongDuration = duration;
      longestSongTitle = String(song?.title || "").trim();
    }

    if (Number.isFinite(addedAt)) {
      if (addedAt >= recentImportCutoff) recentImportWeekCount += 1;

      if (addedAt >= monthStart) {
        monthImportCount += 1;
        monthImportSeconds += duration;
        if (artist && artist !== "unknown artist") monthArtists.add(artist);
      }

      if (addedAt >= yearStart) {
        yearImportCount += 1;
        yearImportSeconds += duration;
        if (artist && artist !== "unknown artist") yearArtists.add(artist);
        if (album && album !== "unknown album") yearAlbums.add(album);
      }
    }
  }

  const averageSongSeconds = songCount ? Math.round(totalLibrarySeconds / songCount) : 0;
  const neverPlayedCount = Math.max(0, songCount - playedSongCount);
  const likedPercent = songCount ? Math.round((likedCount / songCount) * 100) : 0;
  const playedPercent = songCount ? Math.round((playedSongCount / songCount) * 100) : 0;
  const averagePlaysPerSong = songCount ? Math.round((totalPlays / songCount) * 10) / 10 : 0;
  const libraryHealthPercent = songCount
    ? Math.max(0, Math.round(((songCount - missingFileCount) / songCount) * 100))
    : 0;

  let userStage = "new_no_library";
  if (songCount > 0 && songCount < 15) userStage = "small_library";
  else if (songCount >= 15 && songCount < 75) userStage = "building_library";
  else if (songCount >= 75) userStage = "power_library";

  let audienceSegment = "new_local_music_user";
  if (playlistCount > 0 && settings.discordEnabled) audienceSegment = "playlist_social_listener";
  else if (settings.discordEnabled) audienceSegment = "discord_presence_listener";
  else if (settings.customThemeEnabled || settings.coverColorSyncMode !== "off") audienceSegment = "visual_customizer";
  else if (playlistCount > 0) audienceSegment = "playlist_builder";
  else if (songCount >= 75) audienceSegment = "large_library_listener";
  else if (songCount > 0) audienceSegment = "casual_local_listener";

  let primaryAdAngle = "local_music_no_account";
  if (settings.discordEnabled) primaryAdAngle = "discord_rich_presence";
  else if (settings.customThemeEnabled || settings.coverColorSyncMode !== "off") primaryAdAngle = "custom_themes_and_covers";
  else if (playlistCount > 0) primaryAdAngle = "premium_playlists";
  else if (songCount >= 75) primaryAdAngle = "large_library_player";

  return {
    active_view: input.activeView,
    user_stage: userStage,
    audience_segment: audienceSegment,
    primary_ad_angle: primaryAdAngle,
    song_count: songCount,
    liked_count: likedCount,
    playlist_count: playlistCount,
    playlist_song_total: playlistSongTotal,
    total_plays: totalPlays,
    total_listened_seconds: Math.round(totalListenedSeconds),
    library_duration_seconds: Math.round(totalLibrarySeconds),
    total_library_seconds: Math.round(totalLibrarySeconds),
    average_song_seconds: averageSongSeconds,
    average_plays_per_song: averagePlaysPerSong,
    played_song_count: playedSongCount,
    never_played_count: neverPlayedCount,
    recent_import_count: recentImportWeekCount,
    recent_import_week_count: recentImportWeekCount,
    missing_file_count: missingFileCount,
    library_health_percent: libraryHealthPercent,
    liked_percent: likedPercent,
    played_percent: playedPercent,
    month_import_count: monthImportCount,
    month_import_seconds: Math.round(monthImportSeconds),
    month_artist_count: monthArtists.size,
    year_import_count: yearImportCount,
    year_import_seconds: Math.round(yearImportSeconds),
    year_artist_count: yearArtists.size,
    year_album_count: yearAlbums.size,
    longest_song_duration: Math.round(longestSongDuration),
    longest_song_title: longestSongTitle,
    artist_count: artistNames.size,
    album_count: albumNames.size,
    has_library: songCount > 0,
    has_liked_songs: likedCount > 0,
    has_playlists: playlistCount > 0,
    has_played_music: playedSongCount > 0,
    discord_enabled: Boolean(settings.discordEnabled),
    discord_privacy_mode: Boolean(settings.discordPrivacyMode),
    discord_buttons_enabled: Boolean(settings.discordButtons),
    discord_art_mode: String(settings.discordArtMode || "albumCover"),
    discord_activity_style: String(settings.discordActivityStyle || "normal"),
    start_with_windows_enabled: Boolean(settings.startWithWindows),
    minimize_to_tray_enabled: Boolean(settings.minimizeToTray),
    custom_theme_enabled: Boolean(settings.customThemeEnabled),
    theme_id: settings.customThemeEnabled ? "custom" : String(settings.theme || "default"),
    cover_color_sync_mode: String(settings.coverColorSyncMode || "normal"),
    compact_player_enabled: Boolean(settings.compactPlayer),
    simple_mode_enabled: Boolean(settings.simpleMode),
    reduced_motion_enabled: Boolean(settings.reducedMotion),
    crossfade_enabled: Boolean(settings.crossfadeEnabled),
    gapless_enabled: Boolean(settings.gaplessPlayback),
    volume_normalization_enabled: Boolean(settings.volumeNormalization),
    per_song_volume_memory_enabled: Boolean(settings.perSongVolumeMemory),
    playback_speed_changed: Number(settings.playbackSpeed || 1) !== 1,
    shuffle_enabled: Boolean(input.isShuffle),
    repeat_mode: String(input.repeatMode || "off"),
    download_result_count: Number(input.downloadResultCount || 0)
  };
}

function makeLocaltifyAnalyticsSnapshotFallback(input: {
  activeView: string;
  songs?: any[];
  likedCount?: number;
  playlists?: any[];
  settings?: Record<string, any>;
  isShuffle?: boolean;
  repeatMode?: string;
  downloadResultCount?: number;
}): LocaltifyAnalyticsSnapshot {
  return computeLocaltifyAnalyticsSnapshot(input);
}

function createLocaltifyLibraryWorker() {
  try {
    return new Worker(new URL("./library.worker.ts", import.meta.url), {
      type: "module",
      name: "localtify-library-worker"
    });
  } catch {
    return null;
  }
}

const VISUAL_CUSTOMIZATION_DEFAULTS = {
  homeBannerType: "dynamic",
  blurEffects: "normal",
  mediaCardBackground: "glassy",
  homeLayoutMode: "balanced",
  libraryRowStyle: "comfyRows",
  starsIntensity: "off",
  sidebarBehavior: "fixed",
  playerBackgroundStyle: "coverBlur"
} as const;

function normalizeVisualChoice(value: unknown, allowed: readonly string[], fallback: string) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}


function applyVisualCustomizationDefaults<T extends Record<string, any>>(settings: T): T {
  return {
    ...settings,
    homeBannerType: normalizeVisualChoice(settings.homeBannerType, ["dynamic", "albumCover", "cleanBlack", "none"], VISUAL_CUSTOMIZATION_DEFAULTS.homeBannerType),
    // Blur strength is no longer exposed as a setting. Keep the app on the stable default.
    blurEffects: VISUAL_CUSTOMIZATION_DEFAULTS.blurEffects,
    mediaCardBackground: normalizeVisualChoice(settings.mediaCardBackground, ["solid", "glassy", "oledFlat"], VISUAL_CUSTOMIZATION_DEFAULTS.mediaCardBackground),
    homeLayoutMode: normalizeVisualChoice(settings.homeLayoutMode, ["compact", "balanced", "bigHero"], VISUAL_CUSTOMIZATION_DEFAULTS.homeLayoutMode),
    libraryRowStyle: normalizeVisualChoice(settings.libraryRowStyle, ["compactRows", "comfyRows", "coverCards", "listOnly"], VISUAL_CUSTOMIZATION_DEFAULTS.libraryRowStyle),
    starsIntensity: normalizeVisualChoice(settings.starsIntensity, ["off", "subtle", "normal", "bright"], "off"),
    sidebarBehavior: normalizeVisualChoice(settings.sidebarBehavior, ["fixed", "slim", "hover"], VISUAL_CUSTOMIZATION_DEFAULTS.sidebarBehavior),
    playerBackgroundStyle: normalizeVisualChoice(settings.playerBackgroundStyle, ["flat", "coverBlur", "oledBlack"], VISUAL_CUSTOMIZATION_DEFAULTS.playerBackgroundStyle),
    homeHeroCoverBrightness: Number.isFinite(Number(settings.homeHeroCoverBrightness)) ? Math.min(1.55, Math.max(0.65, Number(settings.homeHeroCoverBrightness))) : 1,
    // V385: visible Appearance toggle. Default ON so the current cover-blur look stays enabled.
    quickLibraryMoreBlur: settings.quickLibraryMoreBlur !== false,
    catBuddyEnabled: settings.catBuddyEnabled === true
  };
}


type LocaltifyPlatformInfo = {
  id: "windows" | "linux" | "mac" | "unknown";
  label: string;
  releaseLabel: string;
  startupSettingSupported: boolean;
  desktopControlsLabel: string;
  desktopControlsHelp: string;
  startupSettingLabel: string;
  startupSettingHelp: string;
  linuxInstallNotes: string[];
};

function getLocaltifyPlatformInfo(): LocaltifyPlatformInfo {
  const userAgent = typeof navigator !== "undefined" ? String(navigator.userAgent || "").toLowerCase() : "";
  const platform = typeof navigator !== "undefined" ? String(navigator.platform || "").toLowerCase() : "";

  const isLinux = /linux|x11|wayland/.test(userAgent) || platform.includes("linux");
  const isMac = /mac os|macintosh|darwin/.test(userAgent) || platform.includes("mac");
  const isWindows = /windows|win32|win64|wow64/.test(userAgent) || platform.includes("win");

  if (isLinux) {
    return {
      id: "linux",
      label: "Linux",
      releaseLabel: "AppImage / RPM / DEB",
      startupSettingSupported: false,
      desktopControlsLabel: "Linux desktop controls",
      desktopControlsHelp: "Tray and media keys work where your Linux desktop environment exposes them. Windows startup is hidden here because Linux uses desktop-specific autostart files.",
      startupSettingLabel: "Start localtify with Linux",
      startupSettingHelp: "Linux autostart will be added later through a proper desktop-entry flow.",
      linuxInstallNotes: [
        "AppImage: chmod +x Localtify-0.3.9-x86_64.AppImage, then run it directly.",
        "RPM: for Fedora, openSUSE, and RHEL-style distros.",
        "DEB: for Ubuntu, Debian, Linux Mint, and related distros."
      ]
    };
  }

  if (isMac) {
    return {
      id: "mac",
      label: "macOS",
      releaseLabel: "macOS build not published yet",
      startupSettingSupported: false,
      desktopControlsLabel: "macOS desktop controls",
      desktopControlsHelp: "macOS support is not part of this release yet. This page keeps Windows-only startup controls hidden.",
      startupSettingLabel: "Start localtify with macOS",
      startupSettingHelp: "macOS autostart will be added later when a signed macOS build exists.",
      linuxInstallNotes: []
    };
  }

  return {
    id: isWindows ? "windows" : "unknown",
    label: isWindows ? "Windows" : "Unknown desktop",
    releaseLabel: isWindows ? "NSIS installer" : "Desktop build",
    startupSettingSupported: isWindows,
    desktopControlsLabel: isWindows ? "Windows controls" : "Desktop controls",
    desktopControlsHelp: isWindows
      ? "Use keyboard media keys, taskbar buttons, tray controls, and Windows now playing."
      : "Tray and media keys are available where the current desktop environment supports them.",
    startupSettingLabel: "Start localtify when Windows starts",
    startupSettingHelp: "Enabled by default so the player is ready after you sign in. You can turn it off anytime.",
    linuxInstallNotes: []
  };
}

const ONBOARDING_RELEASE_SHOWCASE_KEY = `localitfy.onboarding.release-showcase.${APP_VERSION}`;

const FEEDBACK_PROMPT_SEEN_KEY = "localitfy.feedbackPrompt.seen.v1";
const FEEDBACK_PROMPT_DELAY_MS = 40_000;
const FEEDBACK_PROMPT_RETRY_DELAY_MS = 15_000;
const FEEDBACK_MESSAGE_MAX_LENGTH = 1_500;
const FEEDBACK_PROMPT_COPY = {
  title: "Thanks for using localtify!",
  body:
    "really it has been amazing for users like you to keep using the app which make me want to update the app even more, why did this popup come? Well as you may know or may also have experienced localtify has few here and there visual or ui bugs in the app and that probably has made you angry. or maybe you really want a feature to be added.",
  footer:
    "Which is why below me theres a message box where you can send bug reports and suggestions. and I will be actively reviewing them! (also you can type feeback in search bar)"
} as const;

const FEEDBACK_CATEGORY_OPTIONS = [
  { id: "bug", label: "Bug" },
  { id: "ui", label: "UI issue" },
  { id: "feature", label: "Feature request" },
  { id: "other", label: "Other" }
] as const;

type FeedbackCategoryId = typeof FEEDBACK_CATEGORY_OPTIONS[number]["id"];

function shouldOpenFeedbackPromptFromSettingsSearch(value: string) {
  const query = value.trim().toLowerCase();
  return query === "/feedback" || query === "feedback";
}

function shouldOpenFeedbackPromptFromGlobalSearch(value: string) {
  const query = value.trim().toLowerCase();
  return query === "/feedback" || query === "feedback";
}


function shouldOpenOnboardingForThisRelease() {
  try {
    const oldOnboardingDone = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "done";
    const releaseShowcaseDone = window.localStorage.getItem(ONBOARDING_RELEASE_SHOWCASE_KEY) === "done";

    // New users still see onboarding because the normal onboarding key is missing.
    // Existing users also see the new v0.3.9 onboarding once because the release key is missing.
    return !oldOnboardingDone || !releaseShowcaseDone;
  } catch {
    return true;
  }
}

function markOnboardingSeenForThisRelease() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
    window.localStorage.setItem(ONBOARDING_RELEASE_SHOWCASE_KEY, "done");
  } catch {
    // Storage can fail in locked-down environments. Never block the player.
  }
}

function resetOnboardingForThisRelease() {
  try {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_RELEASE_SHOWCASE_KEY);
  } catch {
    // Ignore reset storage errors.
  }
}

function MainModeApp() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerEngineRef = useRef<HtmlAudioEngine | null>(null);
  const playerControllerRef = useRef<PlayerController | null>(null);
  const crossfadeIntervalRef = useRef<number | null>(null);
  const crossfadeAutoStartedRef = useRef(false);
  const crossfadeAutoTargetRef = useRef("");
  const crossfadeMainPauseGuardRef = useRef(false);
  const crossfadeLastStartAtRef = useRef(0);
  const crossfadeHandoffClearTimerRef = useRef<number | null>(null);
  const crossfadeHandoffRef = useRef<{
    songId: string;
    url: string;
    time: number;
    volume: number;
  } | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const progressLoopTimeoutRef = useRef<number | null>(null);
  const saveSettingsTimerRef = useRef<number | null>(null);
  const saveSettingsSerialRef = useRef(0);
  const backgroundAudioRepairTimerRef = useRef<number | null>(null);
  const analyticsWorkerRef = useRef<Worker | null>(null);
  const analyticsWorkerRequestRef = useRef(0);
  const playlistSaveTimerRef = useRef<number | null>(null);
  const playerResizeFrameRef = useRef<number | null>(null);
  const sidebarResizeFrameRef = useRef<number | null>(null);
  const pendingPlayRef = useRef(false);
  const countPlayRef = useRef(false);
  const playCountSongIdRef = useRef("");
  const playCountListenedRef = useRef(0);
  const playCountLastTimeRef = useRef(0);
  const sleepTimerRef = useRef<number | null>(null);
  const positionSaveRef = useRef(0);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlCacheRef = useRef<Map<string, PlaybackUrlCacheEntry>>(new Map());
  const playbackUrlPendingRef = useRef<Map<string, Promise<PlaybackUrlResult>>>(new Map());
  const bootedRef = useRef(false);
  const lastQueueHistoryRef = useRef("");
  const toastTimerRef = useRef<number | null>(null);
  const importOverlayTimerRef = useRef<number | null>(null);
  const songRef = useRef<Song | null>(null);
  const timeRef = useRef(0);
  const durationRef = useRef(0);
  const playingRef = useRef(false);
  const volumeRef = useRef(0.75);
  const lastNonZeroVolumeRef = useRef(0.75);
  const secretBufferRef = useRef("");
  const secretTimeoutRef = useRef<number | null>(null);
  const playButtonBurstTimerRef = useRef<number | null>(null);
  const beatFrameRef = useRef<number | null>(null);
  const beatFrameTimerRef = useRef<number | null>(null);
  const beatAudioContextRef = useRef<AudioContext | null>(null);
  const beatAnalyserRef = useRef<AnalyserNode | null>(null);
  const beatSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioEffectDryGainRef = useRef<GainNode | null>(null);
  const audioEffectWetGainRef = useRef<GainNode | null>(null);
  const audioEffectDelayRef = useRef<DelayNode | null>(null);
  const audioEffectFeedbackGainRef = useRef<GainNode | null>(null);
  const audioEffectFilterRef = useRef<BiquadFilterNode | null>(null);
  const beatDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const beatSmoothRef = useRef({ bass: 0, mid: 0, energy: 0, phase: 0 });
  const beatReactiveTargetCacheRef = useRef<{ nodes: HTMLElement[]; refreshedAt: number; songId: string }>({
    nodes: [],
    refreshedAt: 0,
    songId: ""
  });
  const beatLastPaintSignatureRef = useRef("");
  const discordAssetBySongRef = useRef<Record<string, string>>({});
  const lastDiscordAssetKeyRef = useRef<string>("");
  const contentRef = useRef<HTMLElement | null>(null);
  const scrollBusyRef = useRef(false);
  const scrollBusyFrameRef = useRef<number | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const rendererQuietUntilRef = useRef(0);
  const progressDomSignatureRef = useRef("");
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const themeSettlingTimerRef = useRef<number | null>(null);
  const customThemeCommitTimerRef = useRef<number | null>(null);
  const customThemeQuietCommitTimerRef = useRef<number | null>(null);
  const customThemeQuietPatchRef = useRef<Partial<Settings>>({});
  const customThemePreviewFrameRef = useRef<number | null>(null);
  const themePaintIdleTimerRef = useRef<number | null>(null);
  const viewSwitchTimerRef = useRef<number | null>(null);
  const heroReflowTimerRef = useRef<number | null>(null);
  const heroCoverMotionTimerRef = useRef<number | null>(null);
  const customThemeLivePatchRef = useRef<Partial<Settings>>({});
  const pendingCustomThemePreviewPatchRef = useRef<Partial<Settings>>({});
  const appRootRef = useRef<HTMLElement | null>(null);
  const updateAnalyticsSeenRef = useRef("");
  const updateNagTimerRef = useRef<number | null>(null);
  const updateNagVersionRef = useRef("");
  const updateNagStatusRef = useRef<"available" | "downloaded">("available");
  const analyticsSessionEndedRef = useRef(false);
  const analyticsViewRef = useRef<View>("home");
  const librarySnapshotSignatureRef = useRef("");
  const libraryOrderSaveTimerRef = useRef<number | null>(null);
  const rememberCurrentSongTimerRef = useRef<number | null>(null);
  const latestRememberedSongIdRef = useRef("");
  const selectSongBurstTimerRef = useRef<number | null>(null);
  const selectSongBurstIntentRef = useRef<{ songId: string; shouldPlay?: boolean } | null>(null);
  const selectSongLastCommitRef = useRef({ key: "", time: 0 });
  const selectSongLastSameSongRef = useRef({ key: "", time: 0 });

  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootLogCopied, setBootLogCopied] = useState(false);
  const [bootRetryKey, setBootRetryKey] = useState(0);
  const [bootStepIndex, setBootStepIndex] = useState(0);
  const [bootStage, setBootStage] = useState("starting localtify...");
  const [songs, setSongs] = useState<Song[]>([]);
  const [settings, setSettings] = useState<Settings>(() => applyVisualCustomizationDefaults(defaultSettings as Settings));
  const settingsRef = useRef(settings);
  const [heroMotion, setHeroMotion] = useState<"idle" | "expanding" | "compacting">("idle");
  const [homeEntranceSettled, setHomeEntranceSettled] = useState(false);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const [volumeDraft, setVolumeDraft] = useState(() => Math.round(defaultSettings.volume * 100));
  const volumeDraftRef = useRef(Math.round(defaultSettings.volume * 100));
  const volumeDraftFrameRef = useRef<number | null>(null);
  const liveVolumeFrameRef = useRef<number | null>(null);
  const liveVolumePendingPercentRef = useRef(Math.round(defaultSettings.volume * 100));
  const fadeFrameRef = useRef<number | null>(null);
  const [view, setView] = useState<View>("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("appearance");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [isAppBackgrounded, setIsAppBackgrounded] = useState(() => (typeof document === "undefined" ? false : document.hidden));
  const isAppBackgroundedRef = useRef(isAppBackgrounded);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [performanceStatus, setPerformanceStatus] = useState<any | null>(null);
  const feedbackPromptBlockersRef = useRef({
    onboardingOpen: false,
    settingsOpen: false,
    whatsNewOpen: false,
    editorOpen: false,
    playlistPickerOpen: false,
    deleteOpen: false,
    importBusy: false,
    downloadBusy: false,
    spotifyDownloadBusy: false,
    libraryScanBusy: false
  });
  const [feedbackPromptOpen, setFeedbackPromptOpen] = useState(false);
  const [feedbackPromptManualOpen, setFeedbackPromptManualOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategoryId>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSendBusy, setFeedbackSendBusy] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<{
    kind: "idle" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
  const [feedbackConfigStatus, setFeedbackConfigStatus] = useState<{
    ok?: boolean;
    configured?: boolean;
    valid?: boolean;
    envName?: string;
    status?: string;
    label?: string;
    message?: string;
  } | null>(null);
  const feedbackLastSentAtRef = useRef(0);
  const deferredSettingsSearch = useDeferredValue(settingsSearch);
  const [isViewSwitching, setIsViewSwitching] = useState(false);
  const [customThemeName, setCustomThemeName] = useState("My Custom Theme");
  const [customThemeHexDrafts, setCustomThemeHexDrafts] = useState<Partial<Record<CustomThemeColorKey, string>>>({});
  const [savedCustomThemes, setSavedCustomThemes] = useState<CustomThemePreset[]>(() => readSavedCustomThemePresets());
  const [onboardingOpen, setOnboardingOpen] = useState(() => shouldOpenOnboardingForThisRelease());
  const [onboardingDevPreview, setOnboardingDevPreview] = useState(false);
  const [pixelArtAssets, setPixelArtAssets] = useState<RuntimePixelArtAsset[]>(() => getCachedRuntimePixelArtAssets());
  const [coverGalleryMood, setCoverGalleryMood] = useState<CoverMood>("all");
  const [coverSelectedSongIds, setCoverSelectedSongIds] = useState<string[]>([]);
  const [favoritePixelCoverKeys, setFavoritePixelCoverKeys] = useState<string[]>(() =>
    cleanStringList(readLocalJson<string[]>(PIXEL_COVER_FAVORITES_STORAGE_KEY, []))
  );
  const [excludedPixelCoverKeys, setExcludedPixelCoverKeys] = useState<string[]>(() =>
    cleanStringList(readLocalJson<string[]>(PIXEL_COVER_EXCLUDED_STORAGE_KEY, []))
  );
  const pixelArtCacheRef = useRef<{
    assets: RuntimePixelArtAsset[];
    loadedAt: number;
    pending: Promise<RuntimePixelArtAsset[]> | null;
  }>({
    assets: getCachedRuntimePixelArtAssets(),
    loadedAt: 0,
    pending: null
  });

  const loadPixelArtAssets = useCallback(async (force = false) => {
    const cache = pixelArtCacheRef.current;
    const nowMs = Date.now();

    if (!force && cache.assets.length && nowMs - cache.loadedAt < PIXEL_ART_CACHE_TTL_MS) {
      return cache.assets;
    }

    if (!force && cache.pending) {
      return cache.pending;
    }

    if (!window.localitfy.listPixelArt) {
      cache.assets = getCachedRuntimePixelArtAssets();
      cache.loadedAt = nowMs;
      return cache.assets;
    }

    let pending: Promise<RuntimePixelArtAsset[]>;
    pending = window.localitfy
      .listPixelArt()
      .then((assets) => {
        const runtimeAssets = buildRuntimePixelArtAssets(assets);
        cache.assets = runtimeAssets;
        cache.loadedAt = Date.now();
        return runtimeAssets;
      })
      .catch(() => {
        if (!cache.assets.length) {
          cache.assets = getCachedRuntimePixelArtAssets();
        }

        cache.loadedAt = Date.now();
        return cache.assets;
      })
      .finally(() => {
        if (cache.pending === pending) {
          cache.pending = null;
        }
      });

    cache.pending = pending;
    return pending;
  }, []);
  const [editorSong, setEditorSong] = useState<Song | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editAlbum, setEditAlbum] = useState("");

  const [currentId, setCurrentId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "one" | "all">("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [libraryFilterMode, setLibraryFilterMode] = useState<"all" | "missing">("all");
  const [libraryRenderLimit, setLibraryRenderLimit] = useState(INITIAL_LIBRARY_RENDER_LIMIT);
  const libraryRenderLimitRef = useRef(INITIAL_LIBRARY_RENDER_LIMIT);
  const libraryListLengthRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekDraftPercent, setSeekDraftPercent] = useState(0);
  const seekDraftPercentRef = useRef(0);
  const isSeekingRef = useRef(false);
  const seekDraftFrameRef = useRef(0);
  const progressInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const progressTimeLabelRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const progressDurationLabelRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const lastProgressUiPaintRef = useRef(0);
  const lastProgressStatePaintRef = useRef(0);
  const [statusText, setStatusText] = useState("ready to play");
  const [playerError, setPlayerError] = useState("");
  const [updatePrompt, setUpdatePrompt] = useState<UpdatePromptState>(defaultUpdatePrompt);
  const [, setLastUpdateCheckedLabel] = useState("not checked yet");
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [screensaverVisible, setScreensaverVisible] = useState(false);
  const [screensaverPreviewActive, setScreensaverPreviewActive] = useState(false);
  const screensaverTimerRef = useRef<number | null>(null);
  const screensaverPreviewTimerRef = useRef<number | null>(null);
  const screensaverIgnoreActivityUntilRef = useRef(0);

  const [downloadText, setDownloadText] = useState("");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadResults, setDownloadResults] = useState<DownloadResult[]>([]);
  const [downloadQueue, setDownloadQueue] = useState<DownloadQueueItem[]>([]);
  const [downloadFolderLabel, setDownloadFolderLabel] = useState("");

  const [convertBusy, setConvertBusy] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertMessage, setConvertMessage] = useState("");

  // -- Spotify import ------------------------------------------
  const [downloadsTab, setDownloadsTab] = useState<"youtube" | "spotify">("youtube");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyTracks, setSpotifyTracks] = useState<SpotifyTrack[]>([]);
  const [spotifySourceName, setSpotifySourceName] = useState("");
  const [spotifySourceType, setSpotifySourceType] = useState("");
  const [spotifyFetchBusy, setSpotifyFetchBusy] = useState(false);
  const [spotifyFetchError, setSpotifyFetchError] = useState("");
  const [spotifySelectedIds, setSpotifySelectedIds] = useState<Set<string>>(new Set());
  const [spotifyDownloadBusy, setSpotifyDownloadBusy] = useState(false);
  const [spotifyLoggedIn, setSpotifyLoggedIn] = useState(false);
  const [spotifyConnectionReady, setSpotifyConnectionReady] = useState(true);
  const [spotifyNeedsClientId, setSpotifyNeedsClientId] = useState(false);
  const [spotifyConnectionMode, setSpotifyConnectionMode] = useState("oauth-pkce");
  const [spotifyRedirectUri, setSpotifyRedirectUri] = useState("http://127.0.0.1:43877/spotify/callback");
  const [spotifyLoginBusy, setSpotifyLoginBusy] = useState(false);
  const [spotifyShowCookieInput, setSpotifyShowCookieInput] = useState(false);
  const [spotifyCookieDraft, setSpotifyCookieDraft] = useState("");
  // ------------------------------------------------------------

  const [secretMode, setSecretMode] = useState<SecretMode>("none");
  const [secretToast, setSecretToast] = useState("");
  const [secretBurst, setSecretBurst] = useState(0);
  const [playButtonBurst, setPlayButtonBurst] = useState(0);
  const misideModeActive = false;
  const arcadeGhostUnlocked = false;

  const isThreeAm = now.getHours() === 3;
  const greeting = isThreeAm ? "late night local files" : getGreeting(now.getHours());

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    isAppBackgroundedRef.current = isAppBackgrounded;
    document.body.classList.toggle("localtifyBackgroundMode", isAppBackgrounded);

    return () => {
      document.body.classList.remove("localtifyBackgroundMode");
    };
  }, [isAppBackgrounded]);

  useEffect(() => {
    const body = document.body;

    body.classList.add("localtifyPerfV301", "localtifyPerfV303", "localtifyPerfV307", "localtifyPerfV310", "localtifyPerfV319", "localtifyGpuFriendly");
    body.dataset.localtifyPerf = "v319";

    return () => {
      body.classList.remove("localtifyPerfV301", "localtifyPerfV303", "localtifyPerfV307", "localtifyPerfV310", "localtifyPerfV319", "localtifyGpuFriendly");
      if (["v319", "v318", "v310", "v307", "v305", "v304", "v303", "v301"].includes(String(body.dataset.localtifyPerf || ""))) {
        delete body.dataset.localtifyPerf;
      }
    };
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.toggle("localtifyAudioPlaying", Boolean(isPlaying));

    return () => {
      body.classList.remove("localtifyAudioPlaying");
    };
  }, [isPlaying]);

  useEffect(() => {
    const body = document.body;
    const wantsMoreBlur = settings.quickLibraryMoreBlur !== false;

    body.classList.toggle("localtifyWantMoreBlur", wantsMoreBlur);
    body.classList.toggle("localtifyNoMoreBlur", !wantsMoreBlur);

    return () => {
      body.classList.remove("localtifyWantMoreBlur");
      body.classList.remove("localtifyNoMoreBlur");
    };
  }, [settings.quickLibraryMoreBlur]);

  function resumeAudioContextSafely() {
    const context = beatAudioContextRef.current;
    if (!context || context.state !== "suspended") return;
    void context.resume().catch(() => undefined);
  }

  function repairPlaybackAfterAppReturns(reason: "focus" | "visibility" | "background-tick") {
    const audio = audioRef.current;
    if (!audio) return;

    resumeAudioContextSafely();

    if (!playingRef.current && !pendingPlayRef.current) return;
    if (!songRef.current) return;

    applyPlaybackRateSettings(audio);
    setAudioElementVolume(audio, getTargetAudioVolume(songRef.current));

    if (!audio.paused) return;

    const canRepair = reason !== "background-tick" || document.hidden;
    if (!canRepair) return;

    void audio.play()
      .then(() => {
        pendingPlayRef.current = false;
        if (!playingRef.current) setIsPlaying(true);
      })
      .catch(() => {
        // Alt-tab/focus repair should never flip the player into a failed state.
      });
  }

  useEffect(() => {
    let analyticsLaunchCancelled = false;
    const analyticsLaunchTimer = window.setTimeout(() => {
      if (analyticsLaunchCancelled) return;
      const analyticsReady = initLocalitfyAnalytics(APP_VERSION);

      if (analyticsReady) {
        trackAppLaunched({ initial_view: analyticsViewRef.current });
        trackAppActive({ reason: "launch", current_view: analyticsViewRef.current });
        trackAcquisitionSource({ source: "direct_app_launch", initial_view: analyticsViewRef.current });
      }
    }, 950);

    const finishAnalyticsSession = (reason: "beforeunload" | "unmount") => {
      if (analyticsSessionEndedRef.current) return;
      analyticsSessionEndedRef.current = true;
      trackAppSessionEnded({ reason, current_view: analyticsViewRef.current });
    };

    const handleBeforeUnload = () => {
      finishAnalyticsSession("beforeunload");
    };

    let focusRepairTimer = 0;

    const repairHeroAmbienceAfterFocus = () => {
      if (focusRepairTimer) {
        window.clearTimeout(focusRepairTimer);
      }

      // V319: Windows/Electron can occasionally restore the cover pseudo-layer
      // without reapplying the blur filter after alt-tab. Toggling a short body
      // class forces a compositor repaint without changing the user setting.
      document.body.classList.add("localtifyFocusRecovering");
      appRootRef.current?.classList.add("localtifyHeroAmbienceRecovering");

      focusRepairTimer = window.setTimeout(() => {
        document.body.classList.remove("localtifyFocusRecovering");
        appRootRef.current?.classList.remove("localtifyHeroAmbienceRecovering");
        focusRepairTimer = 0;
      }, 420);
    };

    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsAppBackgrounded(hidden);

      if (hidden) {
        repairPlaybackAfterAppReturns("background-tick");
        trackAppBackgrounded({ reason: "visibility_hidden", current_view: analyticsViewRef.current });
        return;
      }

      repairPlaybackAfterAppReturns("visibility");
      repairHeroAmbienceAfterFocus();
      trackAppForegrounded({ reason: "visibility_visible", current_view: analyticsViewRef.current });
      trackAppActive({ reason: "visibility_visible", current_view: analyticsViewRef.current });
    };

    const handleFocus = () => {
      if (!document.hidden) {
        setIsAppBackgrounded(false);
        repairPlaybackAfterAppReturns("focus");
        repairHeroAmbienceAfterFocus();
      }
      trackAppActive({ reason: "window_focus", current_view: analyticsViewRef.current });
    };

    const handleBlur = () => {
      if (document.hidden) setIsAppBackgrounded(true);
      trackAppBackgrounded({ reason: "window_blur", current_view: analyticsViewRef.current });
    };

    const handleWindowError = (event: ErrorEvent) => {
      trackError("renderer_error", event.message || event.error?.name || "unknown renderer error", {
        current_view: analyticsViewRef.current
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "unknown rejection");
      trackError("unhandled_rejection", reason, { current_view: analyticsViewRef.current });
    };

    const heartbeatTimer = window.setInterval(() => {
      if (!document.hidden) {
        trackAppActive({ reason: "heartbeat", current_view: analyticsViewRef.current });
      }
    }, 300_000);

    const backgroundAudioKeeper = window.setInterval(() => {
      if (!document.hidden || !playingRef.current) return;
      repairPlaybackAfterAppReturns("background-tick");
    }, 1800);

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      analyticsLaunchCancelled = true;
      window.clearTimeout(analyticsLaunchTimer);
      if (focusRepairTimer) window.clearTimeout(focusRepairTimer);
      document.body.classList.remove("localtifyFocusRecovering");
      appRootRef.current?.classList.remove("localtifyHeroAmbienceRecovering");
      finishAnalyticsSession("unmount");
      window.clearInterval(heartbeatTimer);
      window.clearInterval(backgroundAudioKeeper);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // V313: onboarding is now a true first-run mini-app.
  // Do not auto-close it just because songs exist; import completion is handled inside Onboarding.

  useEffect(() => {
    if (!ready) return;

    const seenVersion = window.localStorage.getItem(WHATS_NEW_SEEN_KEY);
    if (seenVersion !== APP_VERSION) {
      const timer = window.setTimeout(() => setWhatsNewOpen(true), 420);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [ready]);

  function closeWhatsNew() {
    window.localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION);
    setWhatsNewOpen(false);
  }

  const settingsSearchQuery = normalizeSettingsSearch(deferredSettingsSearch);

  const visibleSettingsTabs = useMemo(() => {
    if (!settingsSearchQuery) return settingsCategoryTabs;
    return settingsCategoryTabs.filter((tab) => settingsTabMatchesSearch(tab, settingsSearchQuery));
  }, [settingsSearchQuery]);

  const settingsSearchResultLabel = settingsSearchQuery
    ? visibleSettingsTabs.length
      ? `showing ${visibleSettingsTabs.length} matching section${visibleSettingsTabs.length === 1 ? "" : "s"}`
      : "no exact section found — Search for settings such as Discord, theme, cover, update, volume, or type /feedback."
    : "Search for settings such as Discord, theme, cover, update, volume, or type /feedback.";

  function handleSettingsSearchInput(value: string) {
    setSettingsSearch(value);

    if (shouldOpenFeedbackPromptFromSettingsSearch(value)) {
      setSettingsSearch("");
      setQuery("");
      setSettingsCategory("advanced");
      setFeedbackCategory("bug");
      openFeedbackPrompt(true);
      setStatusText("feedback box opened");
      showAppToast("feedback box opened", "success");
      return;
    }

    const nextCategory = resolveSettingsCategoryFromSearch(value);
    if (nextCategory && nextCategory !== settingsCategory) {
      setSettingsCategory(nextCategory);
    }
  }

  function openSettingsPanel(category: SettingsCategory = "appearance") {
    trackSettingsOpened();
    setSettingsCategory(category);
    setSettingsOpen(false);
    setEditorSong(null);
    setDeleteTarget(null);
    changeView("settings", "settings");
  }

  function changeView(nextView: View, source: "nav" | "onboarding" | "settings" | "unknown" = "nav") {
    if (view === nextView) return;

    if (viewSwitchTimerRef.current !== null) {
      window.clearTimeout(viewSwitchTimerRef.current);
      viewSwitchTimerRef.current = null;
    }

    // v0.2.8: switching sections should feel instant. The old viewSwitching
    // timer forced extra renders and briefly paused the app ambience, which made
    // every page feel like it was loading. Keep the page change low-priority,
    // but do not add the extra visual shutdown state.
    setIsViewSwitching(false);

    trackAppView(nextView, source, {
      previous_view: view,
      song_count: songs.length,
      liked_count: likedSongs.length
    });

    if (nextView === "library" || nextView === "liked" || view === "library" || view === "liked") {
      trackLibraryViewChanged({
        previous_view: view,
        library_view: nextView,
        source
      });
    }

    if (nextView === "downloads") {
      trackDownloadsOpened({ source, previous_view: view });
    }

    startTransition(() => {
      setView(nextView);
    });
  }

  useEffect(() => {
    if (view !== "home" && view !== "library" && view !== "liked") return;

    const nextLimit = view === "home" && settings.homeExpanded ? HOME_GRID_RENDER_LIMIT : INITIAL_LIBRARY_RENDER_LIMIT;
    if (libraryRenderLimitRef.current === nextLimit) return;

    libraryRenderLimitRef.current = nextLimit;
    setLibraryRenderLimit(nextLimit);
  }, [view, deferredQuery, settings.homeExpanded, settings.denseList]);

  useEffect(() => {
    analyticsViewRef.current = view;
  }, [view]);

  useEffect(() => {
    return () => {
      if (rememberCurrentSongTimerRef.current !== null) {
        window.clearTimeout(rememberCurrentSongTimerRef.current);
        rememberCurrentSongTimerRef.current = null;
      }

      if (selectSongBurstTimerRef.current !== null) {
        window.clearTimeout(selectSongBurstTimerRef.current);
        selectSongBurstTimerRef.current = null;
      }

      if (viewSwitchTimerRef.current !== null) {
        window.clearTimeout(viewSwitchTimerRef.current);
        viewSwitchTimerRef.current = null;
      }

      if (heroReflowTimerRef.current !== null) {
        window.clearTimeout(heroReflowTimerRef.current);
        heroReflowTimerRef.current = null;
      }

      if (heroCoverMotionTimerRef.current !== null) {
        window.clearTimeout(heroCoverMotionTimerRef.current);
        heroCoverMotionTimerRef.current = null;
      }

      if (screensaverPreviewTimerRef.current !== null) {
        window.clearTimeout(screensaverPreviewTimerRef.current);
        screensaverPreviewTimerRef.current = null;
      }

      document.body.classList.remove(
        "localitfyHeroReflowing",
        "localitfyHeroCoverGrowing",
        "localitfyHeroCoverShrinking",
        "localitfyHeroWantsExpanded",
        "localitfyHeroWantsCompact",
        "localitfyHeroFlipMotion",
        "localitfyHeroFlipPlay",
        "localitfyHeroExpandMotion",
        "localitfyHeroCompactMotion",
        "localitfyHeroPanelGrowing",
        "localitfyHeroPanelShrinking"
      );
    };
  }, []);
  useEffect(() => {
    writeLocalJson(PIXEL_COVER_FAVORITES_STORAGE_KEY, favoritePixelCoverKeys);
  }, [favoritePixelCoverKeys]);

  useEffect(() => {
    writeLocalJson(PIXEL_COVER_EXCLUDED_STORAGE_KEY, excludedPixelCoverKeys);
  }, [excludedPixelCoverKeys]);

  useEffect(() => {
    if (!bootedRef.current) return;

    const validSongIds: Set<string> = new Set(songs.map((song) => song.id));
    setCoverSelectedSongIds((oldIds) => cleanSongOrderIds(oldIds, validSongIds));
    setPlaylists((items) => {
      let changed = false;

      const next = items.map((playlist) => {
        const cleanIds = cleanSongOrderIds(playlist.songIds, validSongIds);
        if (cleanIds.length !== playlist.songIds.length || cleanIds.some((id, index) => id !== playlist.songIds[index])) {
          changed = true;
          return { ...playlist, songIds: cleanIds };
        }

        return playlist;
      });

      return changed ? next : items;
    });
  }, [songs]);

  const currentSong = useMemo(() => {
    return songs.find((song) => song.id === currentId) ?? null;
  }, [songs, currentId]);
  function buildPlayerEngineSource(song: Song, url: string): PlayerEngineSource {
    return {
      id: song.id,
      url,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration
    };
  }

  function ensurePlayerController() {
    const audio = audioRef.current;
    if (!audio) return null;

    if (!playerEngineRef.current || playerEngineRef.current.element !== audio) {
      playerControllerRef.current?.destroy();

      const engine = new HtmlAudioEngine(audio);
      playerEngineRef.current = engine;
      playerControllerRef.current = createPlayerController(engine);
    }

    return playerControllerRef.current;
  }

  const [crossfadePreviewSongId, setCrossfadePreviewSongId] = useState("");
  const visualCurrentSong = useMemo(() => {
    if (!crossfadePreviewSongId) return currentSong;
    return songs.find((song) => song.id === crossfadePreviewSongId) ?? currentSong;
  }, [crossfadePreviewSongId, songs, currentSong]);
  const screensaverVisualSource = screensaverImage;

  function clearScreensaverPreviewTimer() {
    if (screensaverPreviewTimerRef.current !== null) {
      window.clearTimeout(screensaverPreviewTimerRef.current);
      screensaverPreviewTimerRef.current = null;
    }
  }

  function dismissScreensaverFromActivity() {
    if (Date.now() < screensaverIgnoreActivityUntilRef.current) return;
    setScreensaverPreviewActive(false);
    setScreensaverVisible(false);
  }

  function openScreensaverPreview(delayMs = 2000) {
    clearScreensaverPreviewTimer();
    setScreensaverPreviewActive(true);
    setScreensaverVisible(false);
    setStatusText("screensaver preview opening in 2 seconds");
    showAppToast("screensaver preview opening in 2 seconds", "success");

    screensaverIgnoreActivityUntilRef.current = Date.now() + delayMs + 1400;
    screensaverPreviewTimerRef.current = window.setTimeout(() => {
      screensaverPreviewTimerRef.current = null;
      screensaverIgnoreActivityUntilRef.current = Date.now() + 1400;
      setScreensaverVisible(true);
      setStatusText("screensaver preview opened");
    }, delayMs);
  }

  useEffect(() => {
    const clearScreensaverTimer = () => {
      if (screensaverTimerRef.current) {
        window.clearTimeout(screensaverTimerRef.current);
        screensaverTimerRef.current = null;
      }
    };

    const canShowScreensaver = screensaverPreviewActive || (settings.animeVisuals && settings.animatedBackgrounds && !isPlaying);

    const armScreensaverTimer = () => {
      clearScreensaverTimer();
      if (!canShowScreensaver) return;
      screensaverTimerRef.current = window.setTimeout(() => {
        screensaverIgnoreActivityUntilRef.current = Date.now() + 1000;
        setScreensaverPreviewActive(false);
        setScreensaverVisible(true);
      }, 5 * 60 * 1000);
    };

    let lastPointerMoveAt = 0;

    const handleUserActivity = () => {
      if (Date.now() < screensaverIgnoreActivityUntilRef.current) return;
      setScreensaverVisible(false);
      armScreensaverTimer();
    };

    const handlePointerMoveActivity = () => {
      const now = Date.now();
      if (!screensaverVisible && now - lastPointerMoveAt < 1400) return;
      lastPointerMoveAt = now;
      handleUserActivity();
    };

    if (!canShowScreensaver) {
      setScreensaverVisible(false);
      clearScreensaverTimer();
      return clearScreensaverTimer;
    }

    armScreensaverTimer();
    window.addEventListener("pointerdown", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("wheel", handleUserActivity, { passive: true });
    window.addEventListener("pointermove", handlePointerMoveActivity, { passive: true });

    return () => {
      clearScreensaverTimer();
      window.removeEventListener("pointerdown", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("wheel", handleUserActivity);
      window.removeEventListener("pointermove", handlePointerMoveActivity);
    };
  }, [currentSong?.id, isPlaying, screensaverPreviewActive, screensaverVisible, settings.animeVisuals, settings.animatedBackgrounds]);

  const heroDisplayTitle = visualCurrentSong ? prettyTitle(visualCurrentSong.title, 9) : "drop in your music";
  const heroDisplayArtist = visualCurrentSong ? prettyMeta(visualCurrentSong.artist) : "import songs to start listening";
  const heroTitleClass = heroTitleDensityClass(heroDisplayTitle);

  const songIdentityRef = useRef<string | null>(null);
  const songTransitionCounterRef = useRef(0);
  const [nowPlayingTransitionKey, setNowPlayingTransitionKey] = useState("empty:0");
  const [playlists, setPlaylists] = useState<Playlist[]>(() => readLocalJson<Playlist[]>(PLAYLIST_STORAGE_KEY, []));
  const [playQueue, setPlayQueue] = useState<string[]>(() => readLocalJson<string[]>(QUEUE_STORAGE_KEY, []));
  const [queueHistory, setQueueHistory] = useState<QueueHistoryItem[]>(() => readLocalJson<QueueHistoryItem[]>(QUEUE_HISTORY_STORAGE_KEY, []));
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [playlistPickerName, setPlaylistPickerName] = useState("");
  const [repeatPlaylist, setRepeatPlaylist] = useState(() => readLocalJson<boolean>(REPEAT_PLAYLIST_STORAGE_KEY, false));
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistPickerSong, setPlaylistPickerSong] = useState<Song | null>(null);
  const [playlistDragOverPlaylistId, setPlaylistDragOverPlaylistId] = useState("");
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<string | null>(null);
  const [renamingPlaylistName, setRenamingPlaylistName] = useState("");
  const [songContextMenu, setSongContextMenu] = useState<SongContextMenuState | null>(null);
  const [pixelArtBusy, setPixelArtBusy] = useState(false);
  const [libraryScanBusy, setLibraryScanBusy] = useState(false);
  const [libraryScanMessage, setLibraryScanMessage] = useState("instant search index ready");
  const [metadataCleanPreview, setMetadataCleanPreview] = useState<any | null>(null);
  const [metadataUndoItems, setMetadataUndoItems] = useState<any[]>([]);
  const [appToast, setAppToast] = useState<{
    id: number;
    message: string;
    kind: AppToastKind;
  } | null>(null);
  const [importAnimation, setImportAnimation] = useState<ImportAnimationState>(() =>
    createImportAnimationState()
  );
  const [draggedSongId, setDraggedSongId] = useState("");
  const [draggedSongTitle, setDraggedSongTitle] = useState("");
  const [libraryDragOverSongId, setLibraryDragOverSongId] = useState("");
  const [libraryDropSide, setLibraryDropSide] = useState<LibraryDropSide>("after");
  const [queueDropHot, setQueueDropHot] = useState(false);
  const [themeSettling, setThemeSettling] = useState(false);
  const [themeMotionReady, setThemeMotionReady] = useState(false);
  const draggedSongIdRef = useRef("");
  const libraryDragOverSongIdRef = useRef("");
  const libraryDropSideRef = useRef<LibraryDropSide>("after");
  const libraryDropPullRef = useRef(0);
  const libraryDropVisualSongIdRef = useRef("");
  const libraryDropVisualSideRef = useRef<LibraryDropSide>("after");
  const librarySongElementRefs = useRef<Map<string, HTMLElement>>(new Map());
  const pointerLibraryDragRef = useRef<{
    songId: string;
    originIndex: number;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    latestTargetId: string | null;
    latestSide: LibraryDropSide;
    sourceElement: HTMLElement | null;
  } | null>(null);
  const pointerLibraryDragFrameRef = useRef<number | null>(null);
  const queueDropHotRef = useRef(false);
  const themeSettlingRef = useRef(false);
  const songIdentity = useMemo(() => {
    if (!visualCurrentSong) return "empty";
    return [visualCurrentSong.id, visualCurrentSong.filePath, visualCurrentSong.title, visualCurrentSong.artist, visualCurrentSong.coverUrl]
      .filter(Boolean)
      .join("::");
  }, [visualCurrentSong?.id, visualCurrentSong?.filePath, visualCurrentSong?.title, visualCurrentSong?.artist, visualCurrentSong?.coverUrl]);

  useEffect(() => {
    if (!ready || !songs.length) return undefined;

    if (libraryOrderSaveTimerRef.current !== null) {
      window.clearTimeout(libraryOrderSaveTimerRef.current);
    }

    libraryOrderSaveTimerRef.current = window.setTimeout(() => {
      libraryOrderSaveTimerRef.current = null;
      const snapshot = songs;

      runLocaltifyIdleTask(() => {
        saveLibraryOrder(snapshot);
      }, 1600);
    }, 520);

    return () => {
      if (libraryOrderSaveTimerRef.current !== null) {
        window.clearTimeout(libraryOrderSaveTimerRef.current);
        libraryOrderSaveTimerRef.current = null;
      }
    };
  }, [ready, songs]);

  useEffect(() => {
    draggedSongIdRef.current = draggedSongId;
  }, [draggedSongId]);

  useEffect(() => {
    libraryDragOverSongIdRef.current = libraryDragOverSongId;
  }, [libraryDragOverSongId]);

  useEffect(() => {
    libraryDropSideRef.current = libraryDropSide;
  }, [libraryDropSide]);

  useEffect(() => {
    queueDropHotRef.current = queueDropHot;
  }, [queueDropHot]);

  useEffect(() => {
    themeSettlingRef.current = themeSettling;
  }, [themeSettling]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const paintScrollBusy = () => {
      scrollBusyFrameRef.current = null;
      scrollBusyRef.current = true;
      rendererQuietUntilRef.current = performance.now() + 900;
      appRootRef.current?.classList.add("isScrolling");

      const nearBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 680;
      const activeView = analyticsViewRef.current;
      const shouldLoadMore = nearBottom && (activeView === "library" || activeView === "liked" || activeView === "home");

      if (shouldLoadMore && libraryRenderLimitRef.current < libraryListLengthRef.current) {
        setLibraryRenderLimit((limit) => {
          const nextLimit = Math.min(libraryListLengthRef.current, limit + LIBRARY_RENDER_BATCH_SIZE);
          libraryRenderLimitRef.current = nextLimit;
          return nextLimit;
        });
      }

      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }

      scrollIdleTimerRef.current = window.setTimeout(() => {
        scrollBusyRef.current = false;
        appRootRef.current?.classList.remove("isScrolling");
        scrollIdleTimerRef.current = null;
      }, playingRef.current ? 520 : 320);
    };

    const markScrollBusy = () => {
      if (scrollBusyFrameRef.current !== null) return;
      scrollBusyFrameRef.current = window.requestAnimationFrame(paintScrollBusy);
    };

    node.addEventListener("scroll", markScrollBusy, { passive: true });

    return () => {
      node.removeEventListener("scroll", markScrollBusy);

      if (scrollBusyFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollBusyFrameRef.current);
        scrollBusyFrameRef.current = null;
      }

      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }

      scrollBusyRef.current = false;
      appRootRef.current?.classList.remove("isScrolling");
    };
  }, []);

  useLayoutEffect(() => {
    if (songIdentityRef.current === songIdentity) return;

    if (songIdentityRef.current !== null) {
      songTransitionCounterRef.current += 1;
    }

    songIdentityRef.current = songIdentity;
    setNowPlayingTransitionKey(`${songIdentity}:${songTransitionCounterRef.current}`);
  }, [songIdentity]);

  useEffect(() => {
    if (!bootedRef.current) return;

    const cleanedPlaylists = cleanPlaylistList(playlists);

    writeLocalJson(PLAYLIST_STORAGE_KEY, cleanedPlaylists);

    const savePlaylists = window.localitfy.savePlaylists;
    if (!savePlaylists) return;

    if (playlistSaveTimerRef.current !== null) {
      window.clearTimeout(playlistSaveTimerRef.current);
    }

    playlistSaveTimerRef.current = window.setTimeout(() => {
      playlistSaveTimerRef.current = null;
      savePlaylists(cleanedPlaylists).catch(() => undefined);
    }, 140);
  }, [playlists]);

  useEffect(() => {
    writeLocalJson(QUEUE_STORAGE_KEY, playQueue);
  }, [playQueue]);

  useEffect(() => {
    writeLocalJson(QUEUE_HISTORY_STORAGE_KEY, queueHistory);
  }, [queueHistory]);

  useEffect(() => {
    writeLocalJson(REPEAT_PLAYLIST_STORAGE_KEY, repeatPlaylist);
  }, [repeatPlaylist]);

  useEffect(() => {
    if (!songContextMenu) return;

    const closeMenu = () => setSongContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [songContextMenu]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }

      if (importOverlayTimerRef.current) {
        window.clearTimeout(importOverlayTimerRef.current);
      }

      if (themeSettlingTimerRef.current) {
        window.clearTimeout(themeSettlingTimerRef.current);
      }

      if (customThemeCommitTimerRef.current !== null) {
        window.clearTimeout(customThemeCommitTimerRef.current);
        customThemeCommitTimerRef.current = null;
      }

      if (customThemeQuietCommitTimerRef.current !== null) {
        window.clearTimeout(customThemeQuietCommitTimerRef.current);
        customThemeQuietCommitTimerRef.current = null;
      }
      customThemeQuietPatchRef.current = {};

      if (playlistSaveTimerRef.current !== null) {
        window.clearTimeout(playlistSaveTimerRef.current);
        playlistSaveTimerRef.current = null;
      }

      if (customThemePreviewFrameRef.current !== null) {
        window.cancelAnimationFrame(customThemePreviewFrameRef.current);
        customThemePreviewFrameRef.current = null;
      }

      customThemeLivePatchRef.current = {};
      pendingCustomThemePreviewPatchRef.current = {};

      if (themePaintIdleTimerRef.current !== null) {
        window.clearTimeout(themePaintIdleTimerRef.current);
        themePaintIdleTimerRef.current = null;
      }

      document.body.classList.remove("localitfyThemePainting");
      document.body.classList.remove("isResizingPlayer");
      document.body.classList.remove("isResizingSidebar");
      document.body.classList.remove("localitfyNoSelect");

      if (playerResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(playerResizeFrameRef.current);
        playerResizeFrameRef.current = null;
      }

      if (volumeDraftFrameRef.current !== null) {
        window.cancelAnimationFrame(volumeDraftFrameRef.current);
        volumeDraftFrameRef.current = null;
      }

      if (sidebarResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(sidebarResizeFrameRef.current);
        sidebarResizeFrameRef.current = null;
      }

      if (appRootRef.current) {
        appRootRef.current.style.removeProperty("--player-size-live");
        appRootRef.current.style.removeProperty("--sidebar-width-live");
        appRootRef.current.classList.remove("isScrolling");
      }

      if (libraryOrderSaveTimerRef.current !== null) {
        window.clearTimeout(libraryOrderSaveTimerRef.current);
        libraryOrderSaveTimerRef.current = null;
      }

      if (scrollBusyFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollBusyFrameRef.current);
        scrollBusyFrameRef.current = null;
      }

      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }

      if (dragPreviewRef.current) {
        dragPreviewRef.current.remove();
        dragPreviewRef.current = null;
      }
    };
  }, []);

  const effectiveSimpleMode = false;
  const selectedThemeId = settings.theme as string;
  const safeTheme: ThemeId = selectedThemeId === "arcadeGhost" && !arcadeGhostUnlocked
    ? "mint"
    : normalizeThemeId(selectedThemeId);
  const effectiveTheme: ThemeId = safeTheme;
  const visibleThemes = themes;
  const currentTheme = themes.find((theme) => theme.id === effectiveTheme) ?? themes.find((theme) => theme.id === "mint") ?? themes[0];
  const animatedThemeSeedRef = useRef(`localtify-theme-motion-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const themePresetStyle = useMemo<CSSProperties>(() => makeThemePresetStyle(effectiveTheme), [effectiveTheme]);
  const animatedThemeVisualStyle = useMemo<CSSProperties>(
    () => buildAnimatedThemeVisualStyle(effectiveTheme, animatedThemeSeedRef.current),
    [effectiveTheme]
  );
  const showStarBackdrop = false;

  useEffect(() => {
    setThemeMotionReady(false);

    if (settings.reducedMotion || effectiveTheme !== "stars") {
      setThemeMotionReady(true);
      return;
    }

    let firstFrame = 0;
    let secondFrame = 0;
    let warmupTimer = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        warmupTimer = window.setTimeout(() => setThemeMotionReady(true), 260);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(warmupTimer);
    };
  }, [effectiveTheme, settings.reducedMotion]);

  const shouldSuspendProximityMotion = false;

  useProximityMotion({
    rootRef: appRootRef,
    disabled: settings.reducedMotion,
    suspended:
      isAppBackgrounded ||
      !themeMotionReady ||
      shouldSuspendProximityMotion ||
      isSeeking ||
      isVolumeDragging ||
      Boolean(draggedSongId) ||
      isViewSwitching,
    resetKey: `${effectiveTheme}:${view}:${settingsCategory}:${themeMotionReady ? "ready" : "boot"}:${isPlaying ? "playing" : "idle"}`
  });

  const platformInfo = useMemo(() => getLocaltifyPlatformInfo(), []);

  useEffect(() => {
    if (!ready || !window.localitfy?.getPerformanceStatus) return;

    let cancelled = false;

    runLocaltifyIdleTask(() => {
      window.localitfy
        .getPerformanceStatus?.()
        .then((status: any) => {
          if (!cancelled && status?.ok) setPerformanceStatus(status);
        })
        .catch(() => undefined);
    }, 1800);

    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !window.localitfy?.getFeedbackStatus) return;

    let cancelled = false;

    runLocaltifyIdleTask(() => {
      window.localitfy
        .getFeedbackStatus?.()
        .then((status: any) => {
          if (!cancelled) setFeedbackConfigStatus(status || null);
        })
        .catch(() => {
          if (!cancelled) {
            setFeedbackConfigStatus({
              ok: false,
              configured: false,
              valid: false,
              status: "unknown",
              label: "Feedback status unavailable",
              message: "The feedback status bridge did not respond."
            });
          }
        });
    }, 1200);

    return () => {
      cancelled = true;
    };
  }, [ready]);

  const diagnosticsInfo = useMemo(() => {
    const themeLabel = settings.customThemeEnabled ? `${currentTheme.name} + custom colors` : currentTheme.name;
    const discordStatus = settings.discordEnabled ? "enabled" : "disabled";
    const startupStatus = platformInfo.startupSettingSupported
      ? (settings.startWithWindows ? "enabled" : "disabled")
      : "not supported on this platform";
    const libraryAlbumCount = new Set(
      songs
        .map((song) => String(song.album || "").trim().toLowerCase())
        .filter((album) => album && album !== "unknown album")
    ).size;
    const downloadFolderStatus = downloadFolderLabel || settings.downloadFolder || "default downloads folder";
    const updateStatus = updatePrompt.visible
      ? updateStatusLabel(updatePrompt)
      : updatePrompt.lastCheckedAt
        ? "checked"
        : "not checked this session";
    const feedbackWebhookStatus = feedbackConfigStatus?.configured
      ? feedbackConfigStatus.valid
        ? "enabled"
        : "configured but invalid"
      : "not configured";
    const electronVersion = String(performanceStatus?.electronVersion || "not reported yet");
    const chromeVersion = String(performanceStatus?.chromeVersion || "not reported yet");
    const packageSupport = platformInfo.id === "windows"
      ? "Windows: full support"
      : platformInfo.id === "linux"
        ? "Linux: AppImage / DEB / RPM supported"
        : platformInfo.id === "mac"
          ? "macOS: not officially supported yet"
          : "desktop support: unknown platform";

    const items = [
      { label: "app version", value: APP_VERSION },
      { label: "platform", value: platformInfo.label },
      { label: "Electron", value: electronVersion },
      { label: "Chromium", value: chromeVersion },
      { label: "song count", value: String(songs.length) },
      { label: "playlist count", value: String(playlists.length) },
      { label: "album count", value: String(libraryAlbumCount) },
      { label: "downloads folder", value: downloadFolderStatus },
      { label: "Discord RPC", value: discordStatus },
      { label: "update status", value: updateStatus },
      { label: "feedback webhook", value: feedbackWebhookStatus },
      { label: "startup status", value: startupStatus },
      { label: "platform support", value: packageSupport }
    ];

    return {
      items,
      copyText: [
        `localtify version: ${APP_VERSION}`,
        `platform: ${platformInfo.label}`,
        `release package: ${platformInfo.releaseLabel}`,
        `electron: ${electronVersion}`,
        `chromium: ${chromeVersion}`,
        `song count: ${songs.length}`,
        `playlist count: ${playlists.length}`,
        `album count: ${libraryAlbumCount}`,
        `downloads folder: ${downloadFolderStatus}`,
        `theme: ${themeLabel}`,
        `Discord RPC: ${discordStatus}`,
        `update status: ${updateStatus}`,
        `feedback webhook: ${feedbackWebhookStatus}`,
        `startup status: ${startupStatus}`,
        `platform support: ${packageSupport}`
      ].join("\n")
    };
  }, [
    currentTheme.name,
    downloadFolderLabel,
    performanceStatus?.chromeVersion,
    performanceStatus?.electronVersion,
    feedbackConfigStatus?.configured,
    feedbackConfigStatus?.valid,
    platformInfo.id,
    platformInfo.label,
    platformInfo.releaseLabel,
    platformInfo.startupSettingSupported,
    playlists.length,
    settings.customThemeEnabled,
    settings.discordEnabled,
    settings.downloadFolder,
    settings.startWithWindows,
    songs,
    updatePrompt
  ]);

  const copyDiagnosticsInfo = useCallback(async () => {
    const textToCopy = diagnosticsInfo.copyText;
    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    setDiagnosticsCopied(true);
    window.setTimeout(() => setDiagnosticsCopied(false), copied ? 1500 : 2200);
  }, [diagnosticsInfo.copyText]);

  const selectedCoverColorSyncMode = normalizeCoverColorSyncMode(
    settings.coverColorSyncMode ?? (settings.showAmbientGradient ? "normal" : "off")
  );
  const effectiveCoverColorSyncMode: CoverColorSyncMode = selectedCoverColorSyncMode;
  const effectiveAmbient = !isViewSwitching && effectiveCoverColorSyncMode !== "off";
  const effectiveNotes = !isViewSwitching && (settings.showFloatingNotes || isThreeAm);
  const customThemeColor = normalizeHexColor(settings.customThemeColor, "#8dffce");
  const customThemeColor2 = normalizeHexColor(settings.customThemeColor2, customThemeColor);
  const customThemeBackground = normalizeHexColor(settings.customThemeBackground, "#050517");
  const customThemeSurface = normalizeHexColor(settings.customThemeSurface, "#151528");
  const customThemeText = normalizeHexColor(settings.customThemeText, "#f5f3ff");
  const customThemeHighlight = normalizeHexColor(settings.customThemeHighlight, "#c084fc");
  const customThemeProgress = normalizeHexColor(settings.customThemeProgress, customThemeColor);
  const customThemeStyle = useMemo<CSSProperties>(() => {
    if (!settings.customThemeEnabled) return {};

    return {
      "--bg": customThemeBackground,
      "--bg-2": customThemeBackground,
      "--bg-3": customThemeSurface,
      "--panel": hexToRgbaString(customThemeSurface, "#151528", 0.42),
      "--surface": hexToRgbaString(customThemeSurface, "#151528", 0.22),
      "--surface-2": hexToRgbaString(customThemeSurface, "#151528", 0.32),
      "--surface-3": hexToRgbaString(customThemeSurface, "#151528", 0.48),
      "--text": customThemeText,
      "--text-2": hexToRgbaString(customThemeText, "#f5f3ff", 0.78),
      "--muted": hexToRgbaString(customThemeText, "#f5f3ff", 0.52),
      "--accent": customThemeColor,
      "--accent-2": customThemeColor2,
      "--highlight": customThemeHighlight,
      "--progress": customThemeProgress,
      "--accent-rgb": hexToRgbString(customThemeColor, "#8dffce"),
      "--accent-2-rgb": hexToRgbString(customThemeColor2, "#8ecbff"),
      "--highlight-rgb": hexToRgbString(customThemeHighlight, "#c084fc"),
      "--progress-rgb": hexToRgbString(customThemeProgress, "#8dffce"),
      "--accent-soft": hexToRgbaString(customThemeColor, "#8dffce", 0.14),
      "--accent-line": hexToRgbaString(customThemeColor, "#8dffce", 0.34),
      "--theme-accent": customThemeColor,
      "--theme-accent-2": customThemeColor2,
      "--theme-highlight": customThemeHighlight,
      "--theme-progress": customThemeProgress,
      "--theme-card-glass": hexToRgbaString(customThemeColor, "#8dffce", 0.045),
      "--theme-card-border": hexToRgbaString(customThemeColor, "#8dffce", 0.16),
      "--theme-hover-glass": hexToRgbaString(customThemeColor, "#8dffce", 0.09),
      "--theme-hover-border": hexToRgbaString(customThemeColor, "#8dffce", 0.32),
      "--card-rgb": hexToRgbString(customThemeColor, "#8dffce")
    } as CSSProperties;
  }, [
    settings.customThemeEnabled,
    customThemeBackground,
    customThemeSurface,
    customThemeText,
    customThemeColor,
    customThemeColor2,
    customThemeHighlight,
    customThemeProgress
  ]);


  const customThemeTokens = useMemo(
    () =>
      [
        { label: "App background", key: "customThemeBackground", value: customThemeBackground, help: "main app color" },
        { label: "Card color", key: "customThemeSurface", value: customThemeSurface, help: "boxes and panels" },
        { label: "Button color", key: "customThemeColor", value: customThemeColor, help: "buttons and glow" },
        { label: "Text color", key: "customThemeText", value: customThemeText, help: "words and labels" }
      ] as Array<{ label: string; key: CustomThemeColorKey; value: string; help: string }>,
    [
      customThemeBackground,
      customThemeSurface,
      customThemeColor,
      customThemeText
    ]
  );

  function clearPendingCustomThemeCommit() {
    if (customThemeCommitTimerRef.current !== null) {
      window.clearTimeout(customThemeCommitTimerRef.current);
      customThemeCommitTimerRef.current = null;
    }

    if (customThemeQuietCommitTimerRef.current !== null) {
      window.clearTimeout(customThemeQuietCommitTimerRef.current);
      customThemeQuietCommitTimerRef.current = null;
    }

    customThemeQuietPatchRef.current = {};
  }

  function markCustomThemePaintBusy(duration = 520) {
    document.body.classList.add("localitfyThemePainting");

    if (themePaintIdleTimerRef.current !== null) {
      window.clearTimeout(themePaintIdleTimerRef.current);
    }

    themePaintIdleTimerRef.current = window.setTimeout(() => {
      document.body.classList.remove("localitfyThemePainting");
      themePaintIdleTimerRef.current = null;
    }, duration);
  }

  function clearCustomThemePreviewStyles() {
    if (customThemePreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(customThemePreviewFrameRef.current);
      customThemePreviewFrameRef.current = null;
    }

    pendingCustomThemePreviewPatchRef.current = {};

    const target = appRootRef.current;
    if (!target) return;

    [
      "--bg",
      "--bg-2",
      "--bg-3",
      "--panel",
      "--surface",
      "--surface-2",
      "--surface-3",
      "--text",
      "--text-2",
      "--muted",
      "--accent",
      "--accent-2",
      "--highlight",
      "--progress",
      "--accent-rgb",
      "--accent-2-rgb",
      "--highlight-rgb",
      "--progress-rgb",
      "--accent-soft",
      "--accent-line",
      "--theme-accent",
      "--theme-accent-2",
      "--theme-highlight",
      "--theme-progress",
      "--theme-card-glass",
      "--theme-card-border",
      "--theme-hover-glass",
      "--theme-hover-border",
      "--card-rgb"
    ].forEach((name) => target.style.removeProperty(name));
  }

  function beginFastThemePaint(previewColor?: string) {
    if (previewColor) {
      commitCustomThemePreview(previewColor, 0);
    }

    document.body.classList.add("localitfyThemePainting");

    if (themePaintIdleTimerRef.current !== null) {
      window.clearTimeout(themePaintIdleTimerRef.current);
    }

    themePaintIdleTimerRef.current = window.setTimeout(() => {
      document.body.classList.remove("localitfyThemePainting");
      themePaintIdleTimerRef.current = null;
    }, 260);
  }

  function kickThemeSettle() {
    // Keep this DOM-only. Changing React state here was causing settings content
    // to re-render and replay its fade animation when pressing normal settings.
    beginFastThemePaint();
    themeSettlingRef.current = true;

    if (themeSettlingTimerRef.current) {
      window.clearTimeout(themeSettlingTimerRef.current);
    }

    themeSettlingTimerRef.current = window.setTimeout(() => {
      themeSettlingRef.current = false;
      themeSettlingTimerRef.current = null;
    }, 180);
  }

  function applyCustomThemePreviewPatch(patch: Partial<Settings>) {
    const target = appRootRef.current;
    if (!target) return;

    const livePatch = {
      ...customThemeLivePatchRef.current,
      ...patch
    };

    const previewColor = normalizeHexColor(String(livePatch.customThemeColor ?? settings.customThemeColor), "#8dffce");
    const previewColor2 = normalizeHexColor(String(livePatch.customThemeColor2 ?? settings.customThemeColor2), previewColor);
    const previewBackground = normalizeHexColor(String(livePatch.customThemeBackground ?? settings.customThemeBackground), "#050517");
    const previewSurface = normalizeHexColor(String(livePatch.customThemeSurface ?? settings.customThemeSurface), "#151528");
    const previewText = normalizeHexColor(String(livePatch.customThemeText ?? settings.customThemeText), "#f5f3ff");
    const previewHighlight = normalizeHexColor(String(livePatch.customThemeHighlight ?? settings.customThemeHighlight), "#c084fc");
    const previewProgress = normalizeHexColor(String(livePatch.customThemeProgress ?? settings.customThemeProgress), previewColor);

    const vars: Record<string, string> = {
      "--bg": previewBackground,
      "--bg-2": previewBackground,
      "--bg-3": previewSurface,
      "--panel": hexToRgbaString(previewSurface, "#151528", 0.42),
      "--surface": hexToRgbaString(previewSurface, "#151528", 0.22),
      "--surface-2": hexToRgbaString(previewSurface, "#151528", 0.32),
      "--surface-3": hexToRgbaString(previewSurface, "#151528", 0.48),
      "--text": previewText,
      "--text-2": hexToRgbaString(previewText, "#f5f3ff", 0.78),
      "--muted": hexToRgbaString(previewText, "#f5f3ff", 0.52),
      "--accent": previewColor,
      "--accent-2": previewColor2,
      "--highlight": previewHighlight,
      "--progress": previewProgress,
      "--accent-rgb": hexToRgbString(previewColor, "#8dffce"),
      "--accent-2-rgb": hexToRgbString(previewColor2, "#8ecbff"),
      "--highlight-rgb": hexToRgbString(previewHighlight, "#c084fc"),
      "--progress-rgb": hexToRgbString(previewProgress, "#8dffce"),
      "--accent-soft": hexToRgbaString(previewColor, "#8dffce", 0.14),
      "--accent-line": hexToRgbaString(previewColor, "#8dffce", 0.34),
      "--theme-accent": previewColor,
      "--theme-accent-2": previewColor2,
      "--theme-highlight": previewHighlight,
      "--theme-progress": previewProgress,
      "--theme-card-glass": hexToRgbaString(previewColor, "#8dffce", 0.045),
      "--theme-card-border": hexToRgbaString(previewColor, "#8dffce", 0.16),
      "--theme-hover-glass": hexToRgbaString(previewColor, "#8dffce", 0.09),
      "--theme-hover-border": hexToRgbaString(previewColor, "#8dffce", 0.32),
      "--card-rgb": hexToRgbString(previewColor, "#8dffce")
    };

    Object.entries(vars).forEach(([name, value]) => target.style.setProperty(name, value));
  }

  function queueCustomThemePreviewPatch(patch: Partial<Settings>) {
    pendingCustomThemePreviewPatchRef.current = {
      ...pendingCustomThemePreviewPatchRef.current,
      ...patch
    };

    if (customThemePreviewFrameRef.current !== null) return;

    customThemePreviewFrameRef.current = window.requestAnimationFrame(() => {
      const nextPatch = pendingCustomThemePreviewPatchRef.current;
      pendingCustomThemePreviewPatchRef.current = {};
      customThemePreviewFrameRef.current = null;
      applyCustomThemePreviewPatch(nextPatch);
    });
  }

  function stageCustomThemePatch(patch: Partial<Settings>, delay = CUSTOM_THEME_COMMIT_DELAY_MS) {
    customThemeLivePatchRef.current = {
      ...customThemeLivePatchRef.current,
      ...patch,
      customThemeEnabled: true
    };

    markCustomThemePaintBusy(delay + 520);
    queueCustomThemePreviewPatch(customThemeLivePatchRef.current);
    clearPendingCustomThemeCommit();

    customThemeCommitTimerRef.current = window.setTimeout(() => {
      const commitPatch = {
        ...customThemeLivePatchRef.current,
        customThemeEnabled: true
      };

      customThemeCommitTimerRef.current = null;
      customThemeLivePatchRef.current = {};

      startTransition(() => {
        setSettings((old) => {
          const next: Settings = {
            ...old,
            ...commitPatch
          };

          settingsRef.current = next;

          if (bootedRef.current) {
            void saveSettingsSafely(next, false);
          }

          return next;
        });
      });
    }, delay);
  }

  function queueQuietCustomThemeColorPatch(patch: Partial<Settings>, delay = 620) {
    const livePatch = {
      ...customThemeLivePatchRef.current,
      ...patch,
      customThemeEnabled: true
    };

    customThemeQuietPatchRef.current = {
      ...customThemeQuietPatchRef.current,
      ...patch,
      customThemeEnabled: true
    };

    customThemeLivePatchRef.current = livePatch;

    // Live preview is DOM-only and rAF-throttled. No React state, no settings
    // remount, no fade replay while the picker is being dragged.
    queueCustomThemePreviewPatch(livePatch);
    document.body.classList.add("localitfyThemePainting");

    if (themePaintIdleTimerRef.current !== null) {
      window.clearTimeout(themePaintIdleTimerRef.current);
    }

    themePaintIdleTimerRef.current = window.setTimeout(() => {
      document.body.classList.remove("localitfyThemePainting");
      themePaintIdleTimerRef.current = null;
    }, 160);

    if (customThemeQuietCommitTimerRef.current !== null) {
      window.clearTimeout(customThemeQuietCommitTimerRef.current);
    }

    customThemeQuietCommitTimerRef.current = window.setTimeout(() => {
      const commitPatch = {
        ...customThemeQuietPatchRef.current,
        customThemeEnabled: true
      };

      customThemeQuietCommitTimerRef.current = null;
      customThemeQuietPatchRef.current = {};
      customThemeLivePatchRef.current = {};

      startTransition(() => {
        setSettings((old) => {
          const next: Settings = {
            ...old,
            ...commitPatch
          };

          settingsRef.current = next;

          if (bootedRef.current) {
            void saveSettingsSafely(next, false);
          }

          return next;
        });
      });
    }, delay);
  }

  function getCustomThemeFallbackColor(key: CustomThemeColorKey) {
    const fallbackByKey: Record<CustomThemeColorKey, string> = {
      customThemeColor: "#8dffce",
      customThemeColor2: customThemeColor,
      customThemeBackground: "#050517",
      customThemeSurface: "#151528",
      customThemeText: "#f5f3ff",
      customThemeHighlight: "#c084fc",
      customThemeProgress: customThemeColor
    };

    return fallbackByKey[key];
  }

  function stageCustomThemeColor(key: CustomThemeColorKey, value: string) {
    const safeColor = normalizeHexColor(value, getCustomThemeFallbackColor(key));
    queueQuietCustomThemeColorPatch({ [key]: safeColor } as Partial<Settings>);
  }

  function handleCustomThemeHexDraftChange(key: CustomThemeColorKey, value: string) {
    const draft = normalizeHexInputDraft(value);
    setCustomThemeHexDrafts((old) => ({ ...old, [key]: draft }));
  }

  function commitCustomThemeHexDraft(key: CustomThemeColorKey, value: string, fallback: string) {
    const safeColor = normalizeHexColor(value, fallback);
    setCustomThemeHexDrafts((old) => {
      const next = { ...old };
      delete next[key];
      return next;
    });
    stageCustomThemeColor(key, safeColor);
  }

  function commitCustomThemePreview(color: string, delay = CUSTOM_THEME_COMMIT_DELAY_MS) {
    const safeColor = normalizeHexColor(color, "#8dffce");
    stageCustomThemePatch(
      {
        customThemeColor: safeColor,
        customThemeColor2: safeColor,
        customThemeHighlight: safeColor,
        customThemeProgress: safeColor
      },
      delay
    );
  }

  function applyCustomThemePreset(preset: CustomThemePreset) {
    setCustomThemeHexDrafts({});
    setCustomThemeName(preset.name || "My Custom Theme");
    stageCustomThemePatch(preset.colors, 0);
  }

  function randomizeCustomThemePalette() {
    const basePreset = BUILT_IN_CUSTOM_THEME_PRESETS[Math.floor(Math.random() * BUILT_IN_CUSTOM_THEME_PRESETS.length)] || BUILT_IN_CUSTOM_THEME_PRESETS[0];
    const accent = randomThemeHex();
    const accent2 = randomThemeHex();

    setCustomThemeName("My Custom Theme");
    stageCustomThemePatch(
      makeCustomThemeColors({
        ...basePreset.colors,
        customThemeColor: accent,
        customThemeColor2: accent2,
        customThemeHighlight: accent,
        customThemeProgress: accent
      }),
      0
    );
  }

  function resetCustomThemePalette() {
    clearPendingCustomThemeCommit();
    clearCustomThemePreviewStyles();
    setCustomThemeName("My Custom Theme");
    void updateSettingsPatch(
      {
        customThemeEnabled: false,
        ...makeCustomThemeColors()
      },
      false
    );
  }

  function saveCurrentCustomThemePreset() {
    const presetName = collapseSpaces(customThemeName) || "My Custom Theme";
    const colors = getCustomThemeColorPatch({
      ...settings,
      ...customThemeLivePatchRef.current
    });

    const preset: CustomThemePreset = {
      id: makeLocalId("theme"),
      name: presetName.slice(0, 40),
      note: "saved custom theme",
      colors,
      custom: true,
      createdAt: Date.now()
    };

    setSavedCustomThemes((old) => {
      const next = [preset, ...old.filter((item) => item.name.toLowerCase() !== preset.name.toLowerCase())].slice(0, 18);
      writeSavedCustomThemePresets(next);
      return next;
    });

    stageCustomThemePatch(colors, 0);
  }

  function removeSavedCustomThemePreset(id: string) {
    setSavedCustomThemes((old) => {
      const next = old.filter((preset) => preset.id !== id);
      writeSavedCustomThemePresets(next);
      return next;
    });
  }

  function clearSongDragPreview() {
    if (!dragPreviewRef.current) return;

    dragPreviewRef.current.remove();
    dragPreviewRef.current = null;
  }

  function attachSongDragPreview(event: DragEvent<HTMLElement>, song: Song) {
    clearSongDragPreview();

    const preview = document.createElement("div");
    preview.className = "localitfyDragPreview";
    preview.setAttribute("aria-hidden", "true");

    const orb = document.createElement("span");
    orb.className = "localitfyDragPreviewOrb";
    orb.textContent = "";
    orb.dataset.kind = song.liked ? "liked" : "song";

    const text = document.createElement("span");
    text.className = "localitfyDragPreviewText";

    const title = document.createElement("strong");
    title.textContent = prettyTitle(song.title, 7);

    const note = document.createElement("small");
    note.textContent = "drop to reorder · player = queue next";

    text.append(title, note);
    preview.append(orb, text);
    document.body.appendChild(preview);

    dragPreviewRef.current = preview;
    event.dataTransfer.setDragImage(preview, 18, 18);
  }

  function showAppToast(message: string, kind: AppToastKind = "info") {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setAppToast({ id: Date.now(), message: cleanToastCopy(message, kind), kind });

    toastTimerRef.current = window.setTimeout(() => {
      setAppToast(null);
      toastTimerRef.current = null;
    }, kind === "work" ? 1900 : 2600);
  }


  useEffect(() => {
    const handleDevToolsShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== "i") return;

      event.preventDefault();
      event.stopPropagation();

      const bridge = window.localitfy as typeof window.localitfy & {
        toggleDevTools?: () => Promise<void> | void;
        openDevTools?: () => Promise<void> | void;
        showDevTools?: () => Promise<void> | void;
      };

      const toggleDevTools = bridge?.toggleDevTools || bridge?.openDevTools || bridge?.showDevTools;

      if (typeof toggleDevTools === "function") {
        void Promise.resolve(toggleDevTools()).catch(() => showAppToast("DevTools bridge failed", "error"));
        return;
      }

      try {
        const maybeRequire = (window as typeof window & { require?: (name: string) => any }).require;
        const electron = typeof maybeRequire === "function" ? maybeRequire("electron") : null;
        const ipcRenderer = electron?.ipcRenderer;

        if (ipcRenderer?.send) {
          ipcRenderer.send("localitfy:toggle-devtools");
          return;
        }
      } catch {
        // Production builds with contextIsolation may not expose require. Main/preload can still wire the bridge later.
      }

      showAppToast("DevTools shortcut needs the main/preload bridge", "error");
    };

    window.addEventListener("keydown", handleDevToolsShortcut, true);
    return () => window.removeEventListener("keydown", handleDevToolsShortcut, true);
  }, []);

  function openSnakeGame() {
    const gameUrl = new URL("snakegame.html", window.location.href).toString();

    const popup = window.open(
      gameUrl,
      "localitfy-snakegame",
      "width=560,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no"
    );

    if (popup) {
      popup.focus();
      showAppToast("snake game opened ??", "success");
      return;
    }

    showAppToast("popup blocked — opening snake game here", "info");
    window.location.href = gameUrl;
  }

  function hideImportAnimation(delay = 1150) {
    if (importOverlayTimerRef.current) {
      window.clearTimeout(importOverlayTimerRef.current);
    }

    importOverlayTimerRef.current = window.setTimeout(() => {
      setImportAnimation((current) => createImportAnimationState({ ...current, active: false }));
      importOverlayTimerRef.current = null;
    }, delay);
  }

  function setHeroExpanded(nextExpanded: boolean) {
    if (settings.heroExpanded === nextExpanded) return;

    const nextMotion = nextExpanded ? "expanding" : "compacting";
    const nextSettings: Settings = {
      ...settings,
      heroExpanded: nextExpanded
    };

    // V141: compact/expand is a local hero animation only.
    // After the first toggle, permanent home entrance animations are locked
    // so the Listen now / recent covers shelf cannot replay a delayed fade-in.
    document.body.classList.remove(
      "localitfyHeroReflowing",
      "localitfyHeroWantsExpanded",
      "localitfyHeroWantsCompact",
      "localitfyHeroCoverGrowing",
      "localitfyHeroCoverShrinking",
      "localitfyHeroFlipMotion",
      "localitfyHeroFlipPlay",
      "localitfyHeroExpandMotion",
      "localitfyHeroCompactMotion",
      "localitfyHeroPanelGrowing",
      "localitfyHeroPanelShrinking"
    );

    if (heroReflowTimerRef.current !== null) {
      window.clearTimeout(heroReflowTimerRef.current);
      heroReflowTimerRef.current = null;
    }

    if (heroCoverMotionTimerRef.current !== null) {
      window.clearTimeout(heroCoverMotionTimerRef.current);
      heroCoverMotionTimerRef.current = null;
    }

    setHomeEntranceSettled(true);
    setHeroMotion(nextMotion);
    setSettings((current) => {
      if (current.heroExpanded === nextExpanded) return current;
      return {
        ...current,
        heroExpanded: nextExpanded
      };
    });

    heroReflowTimerRef.current = window.setTimeout(() => {
      setHeroMotion("idle");
      heroReflowTimerRef.current = null;
    }, nextExpanded ? 860 : 700);

    if (bootedRef.current) {
      if (saveSettingsTimerRef.current !== null) {
        window.clearTimeout(saveSettingsTimerRef.current);
      }

      saveSettingsTimerRef.current = window.setTimeout(() => {
        window.localitfy.saveSettings(nextSettings).catch(() => undefined);
        saveSettingsTimerRef.current = null;
      }, 360);
    }
  }

  function toggleHeroExpanded() {
    setHeroExpanded(!settings.heroExpanded);
  }

  const starParticleStyles = useMemo<CSSProperties[]>(() => [], []);

  const librarySearchIndex = useMemo(() => songs.map((song) => buildSongSearchEntry(song)), [songs]);

  const filteredSongs = useMemo(() => {
    if (!deferredQuery.trim()) return songs;
    return rankSongsForSearch(librarySearchIndex, deferredQuery);
  }, [librarySearchIndex, deferredQuery, songs]);

  const likedSongs = useMemo(() => {
    const seen = new Set<string>();

    return songs.filter((song) => {
      if (!song.liked) return false;

      const key = String(song.id || stableSongSourceKey(song) || `${song.title}|${song.artist}|${song.duration}`).trim();
      if (!key) return true;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }, [songs]);

  const topSongs = useMemo(() => {
    return [...songs].sort((a, b) => b.playCount - a.playCount).slice(0, 6);
  }, [songs]);

  const mostPlayed = topSongs[0] ?? null;
  const missingSongsForLibrary = useMemo(() => songs.filter((song) => song.fileExists === false), [songs]);
  const visibleSongs =
    view === "liked"
      ? likedSongs
      : view === "library" && libraryFilterMode === "missing"
        ? missingSongsForLibrary
        : filteredSongs;

  useEffect(() => {
    libraryListLengthRef.current = visibleSongs.length;
  }, [visibleSongs.length]);

  useEffect(() => {
    libraryRenderLimitRef.current = libraryRenderLimit;
  }, [libraryRenderLimit]);

  const songsById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const songIndexById = useMemo(() => new Map(songs.map((song, index) => [song.id, index])), [songs]);
  const playableSongs = useMemo(() => songs.filter(isPlayableSong), [songs]);
  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) ?? null,
    [activePlaylistId, playlists]
  );

  const activePlaylistSongs = useMemo(
    () => activePlaylist?.songIds.map((songId) => songsById.get(songId)).filter(isPlayableSong) ?? [],
    [activePlaylist, songsById]
  );

  const currentPlaybackPlaylist = useMemo(() => {
    if (!currentSong || !activePlaylist) return null;
    return activePlaylist.songIds.includes(currentSong.id) ? activePlaylist : null;
  }, [activePlaylist, currentSong?.id]);

  const currentNowPlayingLabel = currentPlaybackPlaylist ? `now playing ${currentPlaybackPlaylist.name}` : "now playing";

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? playlists[0] ?? null,
    [selectedPlaylistId, playlists]
  );

  const selectedPlaylistSongs = useMemo(
    () => selectedPlaylist?.songIds.map((songId) => songsById.get(songId)).filter(isPlayableSong) ?? [],
    [selectedPlaylist, songsById]
  );

  const selectedPlaylistDuration = useMemo(
    () => selectedPlaylistSongs.reduce((total, song) => total + (song.duration || 0), 0),
    [selectedPlaylistSongs]
  );

  const playlistSummaries = useMemo<PlaylistSummary[]>(
    () => playlists.map((playlist) => {
      let duration = 0;
      let songCount = 0;
      const previewSongs: Song[] = [];

      for (const songId of playlist.songIds) {
        const song = songsById.get(songId);
        if (!isPlayableSong(song)) continue;

        songCount += 1;
        duration += song.duration || 0;
        if (previewSongs.length < 4) previewSongs.push(song);
      }

      return { playlist, previewSongs, songCount, duration };
    }),
    [playlists, songsById]
  );


  const [analyticsAudienceSnapshot, setAnalyticsAudienceSnapshot] = useState<LocaltifyAnalyticsSnapshot>(() =>
    makeLocaltifyAnalyticsSnapshotFallback({
      activeView: view,
      songs: [],
      likedCount: 0,
      playlists: [],
      settings,
      isShuffle,
      repeatMode,
      downloadResultCount: 0
    })
  );
  const [analyticsAudienceSnapshotReady, setAnalyticsAudienceSnapshotReady] = useState(false);

  useEffect(() => {
    const requestId = analyticsWorkerRequestRef.current + 1;
    analyticsWorkerRequestRef.current = requestId;
    setAnalyticsAudienceSnapshotReady(false);

    const workerPayload = {
      type: "compute-analytics-snapshot",
      requestId,
      activeView: view,
      songs,
      likedCount: likedSongs.length,
      playlists,
      settings: {
        discordEnabled: settings.discordEnabled,
        discordPrivacyMode: settings.discordPrivacyMode,
        discordButtons: settings.discordButtons,
        discordArtMode: settings.discordArtMode,
        discordActivityStyle: settings.discordActivityStyle,
        startWithWindows: settings.startWithWindows,
        minimizeToTray: settings.minimizeToTray,
        customThemeEnabled: settings.customThemeEnabled,
        theme: settings.theme,
        coverColorSyncMode: settings.coverColorSyncMode,
        compactPlayer: settings.compactPlayer,
        simpleMode: settings.simpleMode,
        reducedMotion: settings.reducedMotion,
        crossfadeEnabled: settings.crossfadeEnabled,
        gaplessPlayback: settings.gaplessPlayback,
        volumeNormalization: settings.volumeNormalization,
        perSongVolumeMemory: settings.perSongVolumeMemory,
        playbackSpeed: settings.playbackSpeed
      },
      isShuffle,
      repeatMode,
      downloadResultCount: downloadResults.length
    };

    let cancelled = false;

    const applySnapshot = (snapshot: LocaltifyAnalyticsSnapshot) => {
      if (cancelled || analyticsWorkerRequestRef.current !== requestId) return;
      setAnalyticsAudienceSnapshot(snapshot);
      setAnalyticsAudienceSnapshotReady(true);
    };

    const applyFallback = () => {
      runLocaltifyIdleTask(() => {
        applySnapshot(makeLocaltifyAnalyticsSnapshotFallback(workerPayload));
      }, 900);
    };

    const worker = analyticsWorkerRef.current || createLocaltifyLibraryWorker();

    if (!worker) {
      applyFallback();
      return () => {
        cancelled = true;
      };
    }

    analyticsWorkerRef.current = worker;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type !== "analytics-snapshot" || data.requestId !== requestId) return;
      applySnapshot(data.snapshot || makeLocaltifyAnalyticsSnapshotFallback(workerPayload));
    };

    const handleError = () => {
      try {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        worker.terminate();
      } catch {
        // Ignore worker shutdown errors.
      }

      if (analyticsWorkerRef.current === worker) {
        analyticsWorkerRef.current = null;
      }

      applyFallback();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    try {
      worker.postMessage(workerPayload);
    } catch {
      handleError();
    }

    return () => {
      cancelled = true;
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };
  }, [
    songs,
    likedSongs.length,
    playlists,
    view,
    settings.discordEnabled,
    settings.discordPrivacyMode,
    settings.discordButtons,
    settings.discordArtMode,
    settings.discordActivityStyle,
    settings.startWithWindows,
    settings.minimizeToTray,
    settings.customThemeEnabled,
    settings.theme,
    settings.coverColorSyncMode,
    settings.compactPlayer,
    settings.simpleMode,
    settings.reducedMotion,
    settings.crossfadeEnabled,
    settings.gaplessPlayback,
    settings.volumeNormalization,
    settings.perSongVolumeMemory,
    settings.playbackSpeed,
    isShuffle,
    repeatMode,
    downloadResults.length
  ]);

  useEffect(() => {
    return () => {
      try {
        analyticsWorkerRef.current?.terminate();
      } catch {
        // Ignore worker shutdown errors.
      }
      analyticsWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !analyticsAudienceSnapshotReady) return;
    let cancelled = false;

    runLocaltifyIdleTask(() => {
      if (cancelled) return;
      trackAudienceSnapshot(analyticsAudienceSnapshot);
      trackMarketingSnapshot(analyticsAudienceSnapshot);
      trackPlaylistSnapshot({
        playlist_count: Number(analyticsAudienceSnapshot.playlist_count || 0),
        playlist_song_total: Number(analyticsAudienceSnapshot.playlist_song_total || 0),
        has_playlists: Boolean(analyticsAudienceSnapshot.has_playlists),
        user_stage: String(analyticsAudienceSnapshot.user_stage || "new_no_library"),
        audience_segment: String(analyticsAudienceSnapshot.audience_segment || "new_local_music_user")
      });
    }, 2600);

    return () => {
      cancelled = true;
    };
  }, [ready, analyticsAudienceSnapshotReady, analyticsAudienceSnapshot]);

  const showHomeSideCards = settings.showRightColumn && !settings.homeExpanded;
  const homeDashboardClass = [
    "dashboardGrid",
    showHomeSideCards ? "" : "singleColumn",
    settings.homeExpanded ? "homeExpandedGrid" : "homeCompactGrid"
  ]
    .filter(Boolean)
    .join(" ");

  const totalPlays = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "total_plays");
  const libraryAlbumCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "album_count");
  const libraryArtistCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "artist_count");
  const totalListenedSeconds = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "total_listened_seconds");
  const totalMinutes = Math.floor(totalListenedSeconds / 60);
  const totalLibrarySeconds = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "total_library_seconds");
  const averageSongSeconds = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "average_song_seconds");
  const playedSongCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "played_song_count");
  const neverPlayedCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "never_played_count");
  const likedPercent = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "liked_percent");
  const playedPercent = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "played_percent");
  const averagePlaysPerSong = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "average_plays_per_song");
  const recentImportWeekCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "recent_import_week_count");
  const missingFileCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "missing_file_count");
  const missingSongs = missingSongsForLibrary;
  const effectiveMissingFileCount = Math.max(missingFileCount, missingSongs.length);
  const libraryHealthPercent = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "library_health_percent");
  const monthImportCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "month_import_count");
  const monthImportSeconds = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "month_import_seconds");
  const monthArtistCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "month_artist_count");
  const yearImportCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "year_import_count");
  const yearImportSeconds = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "year_import_seconds");
  const yearAlbumCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "year_album_count");
  const longestSongDuration = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "longest_song_duration");
  const longestSongTitle = localtifyAnalyticsString(analyticsAudienceSnapshot, "longest_song_title", "");

  const activeSongs = useMemo(() => {
    if (!songs.length || playedSongCount <= 0) return [];
    return songs.filter((song) => (song.playCount || 0) > 0).slice(0, Math.min(40, playedSongCount));
  }, [songs, playedSongCount]);

  const neverPlayedSongs = useMemo(() => {
    if (neverPlayedCount <= 0) return [] as Song[];
    return new Array(neverPlayedCount).fill(null) as Song[];
  }, [neverPlayedCount]);

  const listenedTimeLabel = formatAnalyticsDuration(totalListenedSeconds);
  const libraryLengthLabel = formatAnalyticsDuration(totalLibrarySeconds);

  const longestSong = useMemo(() => {
    if (!longestSongTitle && longestSongDuration <= 0) return null;
    return {
      id: "analytics-longest-track",
      title: longestSongTitle || "longest track",
      artist: "",
      album: "",
      duration: longestSongDuration
    } as Song;
  }, [longestSongTitle, longestSongDuration]);

  const recentlyAdded = useMemo(() => {
    return [...songs]
      .sort((a, b) => new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime())
      .slice(0, 12);
  }, [songs]);

  const homeListenNowSongs = useMemo(() => {
    const picked: Song[] = [];
    const seen = new Set<string>();

    [currentSong, ...topSongs, ...recentlyAdded, ...songs].forEach((song) => {
      if (!song || seen.has(song.id)) return;
      seen.add(song.id);
      picked.push(song);
    });

    return picked.slice(0, 6);
  }, [currentSong, topSongs, recentlyAdded, songs]);

  const homeFreshShelfSongs = useMemo(() => {
    const picked: Song[] = [];
    const seen = new Set<string>();

    [...recentlyAdded, ...songs].forEach((song) => {
      if (!song || seen.has(song.id)) return;
      seen.add(song.id);
      picked.push(song);
    });

    return picked.slice(0, 10);
  }, [recentlyAdded, songs]);

  const libraryHealthLabel = !songs.length
    ? "empty"
    : effectiveMissingFileCount > 0
      ? `${libraryHealthPercent}% healthy`
      : "100% healthy";

  const analyticsRecapCards = useMemo(() => {
    return [
      {
        label: "monthly recap",
        value: monthImportCount ? `${monthImportCount.toLocaleString()} imported` : "no imports",
        note: monthImportCount
          ? `${formatAnalyticsDuration(monthImportSeconds)} of music added this month`
          : "import music this month to build a recap",
        meta: `${monthArtistCount.toLocaleString()} artist${monthArtistCount === 1 ? "" : "s"}`,
        progress: songs.length ? Math.min(100, Math.round((monthImportCount / Math.max(1, songs.length)) * 100)) : 0
      },
      {
        label: "yearly recap",
        value: yearImportCount ? `${yearImportCount.toLocaleString()} imported` : "year is quiet",
        note: yearImportCount
          ? `${formatAnalyticsDuration(yearImportSeconds)} of music imported this year`
          : "your yearly recap starts with imports",
        meta: `${yearAlbumCount.toLocaleString()} album${yearAlbumCount === 1 ? "" : "s"}`,
        progress: songs.length ? Math.min(100, Math.round((yearImportCount / Math.max(1, songs.length)) * 100)) : 0
      },
      {
        label: "all-time listening",
        value: listenedTimeLabel,
        note: `${totalPlays.toLocaleString()} play${totalPlays === 1 ? "" : "s"} • ${formatAnalyticsDuration(totalLibrarySeconds)} library`,
        meta: mostPlayed ? `top: ${prettyTitle(mostPlayed.title, 7)}` : "play music to build this",
        progress: playedPercent
      }
    ];
  }, [
    monthImportCount,
    monthImportSeconds,
    monthArtistCount,
    yearImportCount,
    yearImportSeconds,
    yearAlbumCount,
    songs.length,
    listenedTimeLabel,
    totalPlays,
    totalLibrarySeconds,
    mostPlayed,
    playedPercent
  ]);

  const analyticsStatCards = useMemo(() => ([
    {
      label: "songs",
      value: songs.length.toLocaleString(),
      note: `${libraryArtistCount.toLocaleString()} artist${libraryArtistCount === 1 ? "" : "s"} • ${libraryAlbumCount.toLocaleString()} album${libraryAlbumCount === 1 ? "" : "s"}`
    },
    {
      label: "plays",
      value: totalPlays.toLocaleString(),
      note: `${playedSongCount.toLocaleString()} played song${playedSongCount === 1 ? "" : "s"} • ${averagePlaysPerSong} avg`
    },
    {
      label: "listened",
      value: listenedTimeLabel,
      note: `${totalMinutes.toLocaleString()} minute${totalMinutes === 1 ? "" : "s"} estimated`
    },
    {
      label: "library health",
      value: libraryHealthLabel,
      note: effectiveMissingFileCount > 0 ? `${effectiveMissingFileCount.toLocaleString()} missing file${effectiveMissingFileCount === 1 ? "" : "s"}` : "all files available"
    }
  ]), [
    songs.length,
    libraryArtistCount,
    libraryAlbumCount,
    totalPlays,
    playedSongCount,
    averagePlaysPerSong,
    listenedTimeLabel,
    totalMinutes,
    libraryHealthLabel,
    effectiveMissingFileCount
  ]);

  useEffect(() => {
    if (!ready || !analyticsAudienceSnapshotReady) return;

    const signature = [
      songs.length,
      likedSongs.length,
      playedSongCount,
      totalPlays,
      libraryAlbumCount,
      libraryArtistCount,
      view,
      settings.theme,
      settings.customThemeEnabled,
      settings.discordEnabled
    ].join(":");

    if (librarySnapshotSignatureRef.current === signature) return;
    librarySnapshotSignatureRef.current = signature;

    runLocaltifyIdleTask(() => {
      trackLibrarySnapshot({
        song_count: songs.length,
        liked_count: likedSongs.length,
        played_song_count: playedSongCount,
        never_played_count: neverPlayedCount,
        total_plays: totalPlays,
        album_count: libraryAlbumCount,
        artist_count: libraryArtistCount,
        current_view: view,
        theme_id: settings.theme,
        custom_theme_enabled: settings.customThemeEnabled,
        discord_enabled: settings.discordEnabled
      });
    }, 2200);
  }, [
    ready,
    analyticsAudienceSnapshotReady,
    songs.length,
    likedSongs.length,
    playedSongCount,
    neverPlayedCount,
    totalPlays,
    libraryAlbumCount,
    libraryArtistCount,
    view,
    settings.theme,
    settings.customThemeEnabled,
    settings.discordEnabled
  ]);

  // Keep playback progress hot-path out of React renders as much as possible.
  // The animation loop paints the progress DOM directly; React only uses this snapshot when something else renders.
  const liveCurrentTime = Number.isFinite(timeRef.current) ? timeRef.current : currentTime;
  const progress = currentDuration > 0 ? Math.min(100, (liveCurrentTime / currentDuration) * 100) : 0;
  const displayedProgress = isSeeking ? seekDraftPercent : progress;
  const displayedTime = isSeeking && currentDuration > 0 ? (seekDraftPercent / 100) * currentDuration : liveCurrentTime;
  const progressRangeStyle = useMemo(
    () => ({
      "--range-progress": `${clamp(displayedProgress, 0, 100)}%`
    } as CSSProperties),
    [displayedProgress]
  );
  const volumeRangeStyle = useMemo(
    () => ({
      "--range-progress": `${clamp(volumeDraft, 0, 100)}%`,
      "--volume-percent": `${clamp(volumeDraft, 0, 100)}%`
    } as CSSProperties),
    [volumeDraft]
  );
  const ambientSource = useMemo(() => getSongAmbientSource(currentSong), [currentSong]);
  const coverAverageStyle = useCoverAverageStyle(ambientSource, effectiveAmbient);
  const ambientStyle = useMemo(() => {
    const sourceStyle = getAmbientStyle(ambientSource) ?? {};
    return { ...sourceStyle, ...coverAverageStyle } as CSSProperties;
  }, [ambientSource, coverAverageStyle]);

  const syncProgressDom = useCallback((time: number, durationInput?: number, forceInputValue = false) => {
    const duration = Number.isFinite(durationInput || 0) && (durationInput || 0) > 0
      ? durationInput || 0
      : durationRef.current || currentDuration || currentSong?.duration || 0;
    const safeTime = clamp(Number(time) || 0, 0, Math.max(0, duration || 0));
    const safeProgress = duration > 0 ? clamp((safeTime / duration) * 100, 0, 100) : 0;
    const progressBucket = Math.floor(safeProgress * 2) / 2;
    const timeBucket = Math.floor(safeTime);
    const durationBucket = Math.floor(duration || 0);
    const progressText = formatTime(safeTime);
    const durationText = formatTime(duration || 0);
    const domSignature = `${progressBucket}:${timeBucket}:${durationBucket}:${forceInputValue ? "force" : "normal"}`;

    if (!forceInputValue && progressDomSignatureRef.current === domSignature) {
      return;
    }

    progressDomSignatureRef.current = domSignature;

    progressInputRefs.current.forEach((input) => {
      if (!input) return;
      const nextProgress = `${progressBucket}%`;
      if (input.style.getPropertyValue("--range-progress") !== nextProgress) {
        input.style.setProperty("--range-progress", nextProgress);
      }
      if (forceInputValue || !isSeekingRef.current) {
        const nextValue = String(progressBucket);
        if (input.value !== nextValue) input.value = nextValue;
      }
    });

    progressTimeLabelRefs.current.forEach((label) => {
      if (label && label.textContent !== progressText) label.textContent = progressText;
    });

    progressDurationLabelRefs.current.forEach((label) => {
      if (label && label.textContent !== durationText) label.textContent = durationText;
    });
  }, [currentDuration, currentSong?.duration]);


  useEffect(() => {
    if (!isSeekingRef.current) {
      syncProgressDom(currentTime, currentDuration || currentSong?.duration || 0, true);
    }
  }, [currentSong?.id, currentTime, currentDuration, currentSong?.duration, syncProgressDom]);

  const pixelArtPool = useMemo(
    () => (pixelArtAssets.length ? pixelArtAssets : getCachedRuntimePixelArtAssets()),
    [pixelArtAssets]
  );
  const pixelArtUsageMap = useMemo(() => {
    const map = new Map<string, number>();

    songs.forEach((song) => {
      const keys = getSongCoverUsageKeys(song);
      keys.forEach((key) => map.set(key, (map.get(key) || 0) + 1));
    });

    return map;
  }, [songs]);

  const favoritePixelCoverKeySet = useMemo(() => new Set(favoritePixelCoverKeys), [favoritePixelCoverKeys]);
  const excludedPixelCoverKeySet = useMemo(() => new Set(excludedPixelCoverKeys), [excludedPixelCoverKeys]);

  const getRuntimePixelArtForSong = (song?: Song | null, salt = "") => {
    const pool = pixelArtPool.length ? pixelArtPool : getCachedRuntimePixelArtAssets();
    const index = stableHash(`${songSignature(song)}::${salt}`) % pool.length;
    return pool[index] || pixelArtForSong(song);
  };

  const getPixelArtUsageKey = (asset: RuntimePixelArtAsset) => getPixelArtAssetKey(asset);

  const pickBalancedPixelAsset = (
    song: Song,
    salt = "manual",
    usageOverride?: Map<string, number>,
    poolOverride?: RuntimePixelArtAsset[]
  ): RuntimePixelArtAsset | null => {
    const pool = (poolOverride || pixelArtPool).filter((asset) => {
      if (!(asset.path || asset.url || asset.file)) return false;
      return poolOverride ? true : !excludedPixelCoverKeySet.has(getPixelArtUsageKey(asset));
    });
    if (!pool.length) return null;

    const usage = usageOverride || pixelArtUsageMap;
    const currentKeys = new Set([song.coverPath, song.coverUrl].filter(Boolean) as string[]);
    const randomSalt = `${Date.now()}::${Math.random()}::${salt}`;

    const ranked = pool
      .map((asset, index) => {
        const key = getPixelArtUsageKey(asset);
        const isCurrent = currentKeys.has(asset.path || "") || currentKeys.has(asset.url || "") || currentKeys.has(asset.file || "");

        return {
          asset,
          key,
          isCurrent,
          usage: usage.get(key) || 0,
          score: stableHash(`${songSignature(song)}::${randomSalt}::${index}::${asset.file}`)
        };
      })
      .filter((entry) => pool.length <= 1 || !entry.isCurrent)
      .sort((a, b) => a.usage - b.usage || a.score - b.score);

    return ranked[0]?.asset || pool[0] || null;
  };

  const coverToolsActive = view === "covers" || (view === "settings" && (settingsCategory === "covers" || settingsCategory === "advanced"));

  const coverGalleryAssets = useMemo(() => {
    if (!coverToolsActive) return [];

    return pixelArtPool.map((asset) => {
      const key = getPixelArtUsageKey(asset);
      const tags = getPixelAssetMoodTags(asset);
      const usage = Math.max(
        pixelArtUsageMap.get(key) || 0,
        asset.url ? pixelArtUsageMap.get(asset.url) || 0 : 0,
        asset.path ? pixelArtUsageMap.get(asset.path) || 0 : 0,
        asset.file ? pixelArtUsageMap.get(asset.file) || 0 : 0
      );

      return {
        asset,
        key,
        tags,
        usage,
        favorite: favoritePixelCoverKeySet.has(key),
        excluded: excludedPixelCoverKeySet.has(key)
      };
    });
  }, [coverToolsActive, pixelArtPool, pixelArtUsageMap, favoritePixelCoverKeySet, excludedPixelCoverKeySet]);

  const coverMoodCounts = useMemo(() => {
    const counts = new Map<CoverMood, number>();

    coverGalleryAssets.forEach((entry) => {
      if (!entry.excluded) counts.set("all", (counts.get("all") || 0) + 1);
      if (entry.favorite && !entry.excluded) counts.set("favorites", (counts.get("favorites") || 0) + 1);
      entry.tags.forEach((tag) => {
        if (!entry.excluded) counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    counts.set("leastUsed", coverGalleryAssets.filter((entry) => !entry.excluded).length);
    return counts;
  }, [coverGalleryAssets]);

  const filteredCoverGalleryAssets = useMemo(() => {
    const visible = coverGalleryAssets.filter((entry) => {
      if (coverGalleryMood === "favorites") return entry.favorite && !entry.excluded;
      if (coverGalleryMood === "leastUsed") return !entry.excluded;
      if (coverGalleryMood === "all") return !entry.excluded;
      return entry.tags.includes(coverGalleryMood) && !entry.excluded;
    });

    return visible.sort((a, b) => {
      if (coverGalleryMood === "leastUsed") return a.usage - b.usage || a.asset.label.localeCompare(b.asset.label);
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.usage - b.usage || a.asset.label.localeCompare(b.asset.label);
    });
  }, [coverGalleryAssets, coverGalleryMood]);

  const selectedCoverSongs = useMemo(() => {
    return coverSelectedSongIds.map((songId) => songsById.get(songId)).filter((song): song is Song => Boolean(song));
  }, [coverSelectedSongIds, songsById]);

  const coverPickerSongList = useMemo(() => {
    const source = query.trim() ? filteredSongs : songs;
    return source.slice(0, 120);
  }, [filteredSongs, query, songs]);

  const missingCoverSongs = useMemo(() => {
    return songs.filter((song) => {
      const coverPath = String(song.coverPath || song.savedCoverPath || "").trim();
      const coverUrl = String(song.coverUrl || song.coverThumbnailUrl || song.thumbnailUrl || "").trim();
      const coverExists = typeof song.coverExists === "boolean" ? song.coverExists : true;
      const usesFallbackCover = Boolean(song.usesFallbackCover || song.missingSavedCover);

      return usesFallbackCover || !coverPath || coverExists === false || (!coverUrl && !coverPath);
    });
  }, [songs]);

  const coverStats = useMemo(() => {
    const usable = coverGalleryAssets.filter((entry) => !entry.excluded);
    const used = usable.filter((entry) => entry.usage > 0);
    const least = [...usable].sort((a, b) => a.usage - b.usage || a.asset.label.localeCompare(b.asset.label))[0] || null;
    const most = [...usable].sort((a, b) => b.usage - a.usage || a.asset.label.localeCompare(b.asset.label))[0] || null;

    return {
      total: coverGalleryAssets.length,
      usable: usable.length,
      used: used.length,
      favorites: favoritePixelCoverKeys.length,
      excluded: excludedPixelCoverKeys.length,
      missingSongs: missingCoverSongs.length,
      least,
      most
    };
  }, [coverGalleryAssets, favoritePixelCoverKeys.length, excludedPixelCoverKeys.length, missingCoverSongs.length]);

  // Kept intentionally disabled: this preview was calculated every render but is not currently rendered.
  // Re-enable it only when the queue preview UI actually uses this value.
  const queuePreviewSongs = useMemo(() => [] as Song[], []);
  void queuePreviewSongs;

  const headerHint = useMemo(() => {
    if (view === "home") {
      return "";
    }

    if (view === "library") return "";
    if (view === "albums") return "local albums from metadata and your custom collections";
    if (view === "playlists") return `${playlists.length} playlist${playlists.length === 1 ? "" : "s"}`;
    if (view === "liked") return `${likedSongs.length} liked track${likedSongs.length === 1 ? "" : "s"}`;
    if (view === "covers") return `${coverStats.usable} usable cover${coverStats.usable === 1 ? "" : "s"} • ${coverStats.favorites} favorite${coverStats.favorites === 1 ? "" : "s"}`;
    if (view === "downloads") return "download direct audio links and import them automatically";
    if (view === "settings") return "theme, playback, discord, library, and advanced controls";
    return "your listening numbers and favorite tracks";
  }, [view, isPlaying, currentSong, songs.length, filteredSongs.length, likedSongs.length, playlists.length, libraryAlbumCount, isThreeAm, coverStats.usable, coverStats.favorites]);

  const discordPreview = useMemo(() => buildDiscordPreview({
    settings,
    song: currentSong,
    isPlaying,
    currentTime: liveCurrentTime,
    currentDuration: currentDuration || currentSong?.duration || 0,
    totalSongs: songs.length,
    mostPlayed
  }), [settings, currentSong, isPlaying, currentDuration, songs.length, mostPlayed]);



  useEffect(() => {
    const body = document.body;
    let idleTimer: number | null = null;
    let activityTimer: number | null = null;
    const passiveOptions: AddEventListenerOptions = { passive: true };

    const clearIdleTimer = () => {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const clearActivityTimer = () => {
      if (activityTimer !== null) {
        window.clearTimeout(activityTimer);
        activityTimer = null;
      }
    };

    const markIdle = () => {
      body.classList.add("localtifyIdle");
    };

    const markActive = () => {
      body.classList.remove("localtifyIdle");
      clearIdleTimer();
      idleTimer = window.setTimeout(markIdle, isPlaying ? 45_000 : 12_000);
    };

    const scheduleActive = () => {
      if (activityTimer !== null) return;
      activityTimer = window.setTimeout(() => {
        activityTimer = null;
        markActive();
      }, 90);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearIdleTimer();
        clearActivityTimer();
        if (!playingRef.current) markIdle();
        return;
      }

      markActive();
    };

    markActive();

    window.addEventListener("pointerdown", scheduleActive, passiveOptions);
    window.addEventListener("wheel", scheduleActive, passiveOptions);
    window.addEventListener("keydown", scheduleActive);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearIdleTimer();
      clearActivityTimer();
      window.removeEventListener("pointerdown", scheduleActive, passiveOptions);
      window.removeEventListener("wheel", scheduleActive, passiveOptions);
      window.removeEventListener("keydown", scheduleActive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      body.classList.remove("localtifyIdle");
    };
  }, [isPlaying]);

  useEffect(() => {
    songRef.current = currentSong;
    if (!audioRef.current || audioRef.current.paused || !isPlaying) {
      timeRef.current = currentTime;
    }
    durationRef.current = currentDuration;
    playingRef.current = isPlaying;
    volumeRef.current = settings.volume;

    if (settings.volume > 0.01) {
      lastNonZeroVolumeRef.current = settings.volume;
    }
  }, [currentSong, currentTime, currentDuration, isPlaying, settings.volume]);


  useEffect(() => {
    const root = appRootRef.current;

    if (!root) return;

    const beatVariableNames = [
      "--active-song-beat",
      "--active-song-bass",
      "--active-song-mid",
      "--active-song-beat-x",
      "--active-song-beat-y",
      "--active-song-glow-opacity",
      "--active-song-glow-scale",
      "--active-song-art-scale",
      "--active-song-ring-opacity",
      "--active-song-pulse-speed"
    ];

    const clearBeatVariablesFromNode = (node: HTMLElement) => {
      beatVariableNames.forEach((name) => node.style.removeProperty(name));
      delete node.dataset.localtifyBeatSignature;
    };

    const resetBeatVariables = () => {
      const cache = beatReactiveTargetCacheRef.current;

      clearBeatVariablesFromNode(root);
      cache.nodes.forEach((node) => clearBeatVariablesFromNode(node));
      cache.nodes = [];
      cache.refreshedAt = 0;
      cache.songId = "";
      beatLastPaintSignatureRef.current = "";
    };

    const clearBeatTimers = () => {
      if (beatFrameRef.current !== null) {
        window.cancelAnimationFrame(beatFrameRef.current);
        beatFrameRef.current = null;
      }

      if (beatFrameTimerRef.current !== null) {
        window.clearTimeout(beatFrameTimerRef.current);
        beatFrameTimerRef.current = null;
      }
    };

    clearBeatTimers();

    const shouldSleepBeatFx = isLocaltifyV301HeavyMotionSurface(view, settingsCategory);

    if (!ready || !isPlaying || !currentSong || !settings.animatedGlow || settings.reducedMotion || document.hidden) {
      resetBeatVariables();
      return;
    }

    const averageRange = (data: Uint8Array<ArrayBuffer>, start: number, end: number) => {
      const safeStart = clamp(Math.floor(start), 0, Math.max(0, data.length - 1));
      const safeEnd = clamp(Math.floor(end), safeStart + 1, data.length);
      let total = 0;

      for (let index = safeStart; index < safeEnd; index += 2) {
        total += data[index] || 0;
      }

      return total / Math.max(1, Math.ceil((safeEnd - safeStart) / 2)) / 255;
    };

    const ensureAnalyser = () => {
      const audio = audioRef.current;
      if (!audio) return null;

      if (beatAnalyserRef.current) return beatAnalyserRef.current;

      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) return null;

      try {
        const context = beatAudioContextRef.current || new AudioContextCtor({ latencyHint: "playback" });
        beatAudioContextRef.current = context;

        const analyser = context.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.88;

        const source = beatSourceRef.current || context.createMediaElementSource(audio);
        beatSourceRef.current = source;

        beatAnalyserRef.current = analyser;
        beatDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        syncAudioEffectGraph(audio);

        return analyser;
      } catch {
        return null;
      }
    };

    const getBeatTargets = (now: number) => {
      const cache = beatReactiveTargetCacheRef.current;
      const songId = currentSong.id;
      const shouldRefresh =
        cache.songId !== songId ||
        now - cache.refreshedAt > 8000 ||
        cache.nodes.some((node) => !root.contains(node));

      if (!shouldRefresh) return cache.nodes;

      cache.nodes.forEach((node) => clearBeatVariablesFromNode(node));

      // V303: do not run getBoundingClientRect() here. The performance recording showed
      // style recalculation spikes inside the analyser tick, and layout reads make that worse.
      // Keep the reactive glow on a tiny set of likely-visible art nodes only.
      cache.nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          [
            ".playerBar .smallArt",
            ".simpleHero .simpleHeroArtSwap",
            ".hero.heroPremium .heroArtWrap"
          ].join(",")
        )
      ).filter((node) => root.contains(node)).slice(0, 2);
      cache.refreshedAt = now;
      cache.songId = songId;

      return cache.nodes;
    };

    const applyBeatVariables = (nodes: HTMLElement[], variables: Record<string, string>, signature: string) => {
      for (const node of nodes) {
        if (node.dataset.localtifyBeatSignature === signature) continue;
        node.dataset.localtifyBeatSignature = signature;

        for (const [name, value] of Object.entries(variables)) {
          if (node.style.getPropertyValue(name) !== value) {
            node.style.setProperty(name, value);
          }
        }
      }
    };

    const context = beatAudioContextRef.current;
    if (context?.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    let lastPaint = 0;
    let hiddenResetDone = false;
    let busyResetDone = false;

    const scheduleBeatTick = (delayMs: number) => {
      if (beatFrameTimerRef.current !== null) {
        window.clearTimeout(beatFrameTimerRef.current);
      }

      beatFrameTimerRef.current = window.setTimeout(() => {
        beatFrameTimerRef.current = null;
        beatFrameRef.current = window.requestAnimationFrame(tick);
      }, delayMs);
    };

    const tick = (now: number) => {
      const runtimeBusy = false;

      if (document.hidden || runtimeBusy) {
        if (!hiddenResetDone || !busyResetDone) {
          resetBeatVariables();
        }
        hiddenResetDone = document.hidden;
        busyResetDone = runtimeBusy;
        lastPaint = now;
        scheduleBeatTick(document.hidden ? 900 : 520);
        return;
      }

      hiddenResetDone = false;
      busyResetDone = false;

      const frameBudgetMs = view === "home" ? 520 : 760;

      if (now - lastPaint >= frameBudgetMs) {
        const analyser = ensureAnalyser();
        const data = analyser ? beatDataRef.current : null;
        const audio = audioRef.current;
        const time = Number.isFinite(audio?.currentTime || 0) ? audio?.currentTime || 0 : 0;
        const safeVolume = clamp(volumeRef.current || settings.volume || 0.75, 0.16, 1);

        let bass = 0;
        let mid = 0;
        let energy = 0;

        if (analyser && data) {
          analyser.getByteFrequencyData(data);

          bass = averageRange(data, 1, 8);
          mid = averageRange(data, 8, 28);
          energy = averageRange(data, 1, data.length);
        } else {
          const wave = (Math.sin(time * 6.4) + Math.sin(time * 12.8) * 0.35 + Math.sin(time * 3.2) * 0.2 + 1.55) / 3.1;
          bass = clamp(wave, 0, 1);
          mid = clamp((Math.sin(time * 4.7) + 1) / 2, 0, 1);
          energy = clamp((bass + mid) / 2, 0, 1);
        }

        const smooth = beatSmoothRef.current;
        smooth.bass += (bass - smooth.bass) * 0.16;
        smooth.mid += (mid - smooth.mid) * 0.13;
        smooth.energy += (energy - smooth.energy) * 0.12;
        smooth.phase += 0.024 + smooth.bass * 0.024;

        const beat = clamp((smooth.bass * 0.72 + smooth.energy * 0.28 + smooth.mid * 0.14) * safeVolume, 0.04, 0.82);
        const travel = 4 + beat * 14;
        const x = Math.sin(time * 1.65 + smooth.phase) * travel;
        const y = Math.cos(time * 2.05 + smooth.phase * 0.75) * (travel * 0.62);
        const opacity = 0.16 + beat * 0.42;
        const glowScale = 1.02 + beat * 0.105;
        const artScale = 1 + beat * 0.02;
        const ringOpacity = 0.12 + beat * 0.28;
        const pulseSpeed = Math.round(1280 - beat * 420);
        const paintSignature = [
          Math.round(beat * 42),
          Math.round(x / 4),
          Math.round(y / 4),
          Math.round(opacity * 34),
          Math.round(glowScale * 34),
          Math.round(ringOpacity * 34),
          Math.round(pulseSpeed / 64)
        ].join(":");

        if (paintSignature !== beatLastPaintSignatureRef.current) {
          applyBeatVariables(getBeatTargets(now), {
            "--active-song-beat": beat.toFixed(2),
            "--active-song-bass": smooth.bass.toFixed(2),
            "--active-song-mid": smooth.mid.toFixed(2),
            "--active-song-beat-x": `${x.toFixed(1)}px`,
            "--active-song-beat-y": `${y.toFixed(1)}px`,
            "--active-song-glow-opacity": opacity.toFixed(2),
            "--active-song-glow-scale": glowScale.toFixed(2),
            "--active-song-art-scale": artScale.toFixed(3),
            "--active-song-ring-opacity": ringOpacity.toFixed(2),
            "--active-song-pulse-speed": `${pulseSpeed}ms`
          }, paintSignature);
          beatLastPaintSignatureRef.current = paintSignature;
        }

        lastPaint = now;
      }

      scheduleBeatTick(frameBudgetMs);
    };

    beatFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      clearBeatTimers();
    };
  }, [ready, isPlaying, currentSong?.id, settings.animatedGlow, settings.reducedMotion, settings.volume, view, settingsCategory, isViewSwitching, isSeeking, isVolumeDragging]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!window.localitfy.onAutoUpdate) return;

    const off = window.localitfy.onAutoUpdate((payload: AutoUpdateEvent) => {
      if (!payload || typeof payload !== "object") return;

      const version = payload.version || "latest";
      const percent = clamp(Number(payload.percent || 0), 0, 100);

      if (!payload.silent && (payload.type === "checking" || payload.type === "not-available" || payload.type === "available" || payload.type === "error" || payload.type === "dev")) {
        setLastUpdateCheckedLabel(payload.type === "checking" ? "checking now" : "just now");
      }

      if (payload.type === "backup") {
        setUpdatePrompt((old) => ({
          ...old,
          visible: old.visible,
          backupPath: payload.backupPath || old.backupPath,
          libraryBackedUp: Boolean(payload.libraryBackedUp),
          message: old.message || payload.message || "your library has been backed up"
        }));
        return;
      }

      if (payload.type === "checking") {
        if (payload.silent) return;
        setUpdatePrompt({
          visible: true,
          status: "checking",
          version: "",
          percent: 0,
          message: payload.message || "Checking for updates...",
          error: ""
        });
        showAppToast("Checking for updates", "work");
        return;
      }

      if (payload.type === "available") {
        updateNagVersionRef.current = version;
        updateNagStatusRef.current = "available";
        if (version && updateWasLeftAlone(version)) {
          return;
        }
        setUpdatePrompt({
          visible: true,
          status: "available",
          version,
          percent: 0,
          message: payload.message || `localtify ${version} is ready to download.`,
          error: "",
          backupPath: payload.backupPath || "",
          libraryBackedUp: Boolean(payload.libraryBackedUp),
          releaseNotes: payload.releaseNotes || ""
        });
        showAppToast("Update available", "success");
        return;
      }

      if (payload.type === "downloading") {
        setUpdatePrompt((old) => ({
          ...old,
          visible: true,
          status: "downloading",
          percent,
          message: payload.message || `Downloading update... ${Math.round(percent)}%`,
          error: "",
          backupPath: payload.backupPath || old.backupPath,
          libraryBackedUp: Boolean(payload.libraryBackedUp || old.libraryBackedUp),
          downloadedBytes: payload.downloadedBytes,
          totalBytes: payload.totalBytes,
          sizeBytes: payload.sizeBytes,
          speedBytesPerSecond: payload.speedBytesPerSecond
        }));
        return;
      }

      if (payload.type === "downloaded") {
        updateNagVersionRef.current = version || updateNagVersionRef.current || "latest";
        updateNagStatusRef.current = "downloaded";
        setUpdatePrompt((old) => ({
          ...old,
          visible: true,
          status: "downloaded",
          percent: 100,
          version: version || old.version,
          message: payload.message || "Update ready. Your library has been backed up. Restart localtify to install it.",
          error: "",
          backupPath: payload.backupPath || old.backupPath,
          libraryBackedUp: Boolean(payload.libraryBackedUp || old.libraryBackedUp),
          releaseNotes: payload.releaseNotes || old.releaseNotes
        }));
        showAppToast("Update ready to install", "success");
        return;
      }

      if (payload.type === "not-available") {
        if (payload.silent) return;
        setUpdatePrompt(defaultUpdatePrompt);
        setStatusText("localtify is up to date");
        showAppToast("localtify is up to date", "success");
        return;
      }

      if (payload.type === "dev") {
        if (payload.silent) return;

        // V179: dev/packaged-only update messages must never open the global top ribbon.
        // The ribbon is reserved for real update states only, so the app does not look broken
        // while testing with npm run dev.
        setUpdatePrompt(defaultUpdatePrompt);
        setStatusText("update checks work in the installed app");
        showAppToast("Update checks work after installing the app", "work");
        return;
      }

      if (payload.type === "error") {
        if (payload.silent) return;
        setUpdatePrompt({
          visible: true,
          status: "error",
          version: "",
          percent: 0,
          message: friendlyUpdateError(payload.error || payload.message),
          error: friendlyUpdateError(payload.error || payload.message)
        });
        showAppToast("Update check failed", "error");
      }
    });

    return () => off();
  }, []);

  useEffect(() => {
    if (!ready || !settings.autoUpdateEnabled || !window.localitfy.checkForUpdates) return;

    const timer = window.setTimeout(() => {
      window.localitfy.checkForUpdates?.({ silent: true }).catch(() => undefined);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [ready, settings.autoUpdateEnabled]);

  useEffect(() => {
    return () => {
      if (updateNagTimerRef.current) {
        window.clearTimeout(updateNagTimerRef.current);
        updateNagTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!updatePrompt.visible) return;

    const signature = [updatePrompt.status, updatePrompt.version || "none", updatePrompt.nagStage || 0].join(":");
    if (updateAnalyticsSeenRef.current === signature) return;

    updateAnalyticsSeenRef.current = signature;
    trackUpdatePopupSeen({
      update_status: updatePrompt.status,
      current_version: APP_VERSION,
      latest_version: updatePrompt.version || null,
      current_view: analyticsViewRef.current,
      has_error: Boolean(updatePrompt.error)
    });
  }, [updatePrompt.visible, updatePrompt.status, updatePrompt.version, updatePrompt.error, updatePrompt.nagStage]);

  useEffect(() => {
    if (!updatePrompt.visible) return;
    if (updatePrompt.status !== "latest" && updatePrompt.status !== "dev") return;

    const timer = window.setTimeout(() => {
      setUpdatePrompt(defaultUpdatePrompt);
    }, updatePrompt.status === "latest" ? 1400 : 2600);

    return () => window.clearTimeout(timer);
  }, [updatePrompt.visible, updatePrompt.status]);

  async function askUpdaterToDownload() {
    if (!window.localitfy.downloadUpdate) {
      setUpdatePrompt((old) => ({
        ...old,
        visible: true,
        status: "error",
        message: "Could not check for updates. Try again later.",
        error: "Updater is not available in this build."
      }));
      return;
    }

    setUpdatePrompt((old) => ({
      ...old,
      visible: true,
      status: "downloading",
      percent: 0,
      message: "Backing up your library, then starting download...",
      error: ""
    }));

    await window.localitfy.downloadUpdate().catch((error: unknown) => {
      setUpdatePrompt((old) => ({
        ...old,
        visible: true,
        status: "error",
        message: friendlyUpdateError(error),
        error: friendlyUpdateError(error)
      }));
    });
  }

  async function askUpdaterToInstall() {
    if (!window.localitfy.installUpdate) return;
    await window.localitfy.installUpdate().catch(() => {
      setUpdatePrompt((old) => ({
        ...old,
        visible: true,
        status: "error",
        message: "Could not restart to install the update.",
        error: "Could not restart to install the update."
      }));
    });
  }

  async function manualUpdateCheck() {
    setLastUpdateCheckedLabel("checking now");

    if (!window.localitfy.checkForUpdates) {
      setUpdatePrompt({
        visible: true,
        status: "error",
        version: "",
        percent: 0,
        message: "Could not check for updates. Try again later.",
        error: "Updater is not available in this build."
      });
      setLastUpdateCheckedLabel("just now");
      return;
    }

    setUpdatePrompt({
      visible: true,
      status: "checking",
      version: "",
      percent: 0,
      message: "Checking for updates...",
      error: ""
    });

    await window.localitfy.checkForUpdates({ silent: false }).catch((error: unknown) => {
      setUpdatePrompt({
        visible: true,
        status: "error",
        version: "",
        percent: 0,
        message: friendlyUpdateError(error),
        error: friendlyUpdateError(error)
      });
      setLastUpdateCheckedLabel("just now");
    });
  }

  function openUpdateChangelog() {
    setWhatsNewOpen(true);
  }

  function clearUpdateNagTimer() {
    if (updateNagTimerRef.current) {
      window.clearTimeout(updateNagTimerRef.current);
      updateNagTimerRef.current = null;
    }
  }

  function showUpdateNag(stage: 1 | 2 | 3, versionInput?: string) {
    const version = versionInput || updateNagVersionRef.current || updatePrompt.version || "latest";
    if (updateWasLeftAlone(version)) return;

    updateNagVersionRef.current = version;
    setUpdatePrompt({
      visible: true,
      status: updateNagStatusRef.current,
      version,
      percent: updateNagStatusRef.current === "downloaded" ? 100 : 0,
      nagStage: stage,
      message: "",
      error: "",
      libraryBackedUp: true
    });
  }

  function scheduleUpdateNag(versionInput?: string, stageInput?: 1 | 2 | 3, customDelayMs?: number, statusInput?: "available" | "downloaded") {
    const version = versionInput || updatePrompt.version || updateNagVersionRef.current || "latest";
    const stage = stageInput || 1;

    if (updateWasLeftAlone(version)) return;

    updateNagVersionRef.current = version;
    updateNagStatusRef.current = statusInput || updateNagStatusRef.current || "available";
    clearUpdateNagTimer();

    const delayMs = typeof customDelayMs === "number"
      ? customDelayMs
      : stage === 1
        ? 120_000
        : 60_000;

    updateNagTimerRef.current = window.setTimeout(() => {
      updateNagTimerRef.current = null;
      showUpdateNag(stage, version);
    }, delayMs);
  }

  function handleUpdateLater() {
    const currentStage = updatePrompt.nagStage || 0;
    const nextStage = currentStage >= 2 ? 3 : currentStage === 1 ? 2 : 1;
    const nextDelay = currentStage === 0 ? 120_000 : 60_000;
    const version = updatePrompt.version || updateNagVersionRef.current || "latest";
    const reminderStatus = updatePrompt.status === "downloaded" ? "downloaded" : "available";

    setUpdatePrompt(defaultUpdatePrompt);
    scheduleUpdateNag(version, nextStage, nextDelay, reminderStatus);
    setStatusText("update reminder snoozed");
  }


  function skipAvailableUpdate() {
    handleUpdateLater();
  }

  function resetPlayCountTracker() {
    countPlayRef.current = false;
    playCountSongIdRef.current = "";
    playCountListenedRef.current = 0;
    playCountLastTimeRef.current = 0;
  }

  function armPlayCount(songId: string, startTime = 0) {
    countPlayRef.current = true;
    playCountSongIdRef.current = songId;
    playCountListenedRef.current = 0;
    playCountLastTimeRef.current = Math.max(0, Number.isFinite(startTime) ? startTime : 0);
  }

  function tickPlayCountTracker(nextTime: number) {
    const song = songRef.current;
    if (!song || !countPlayRef.current || playCountSongIdRef.current !== song.id) return;

    const safeNextTime = Math.max(0, Number.isFinite(nextTime) ? nextTime : 0);
    const delta = safeNextTime - playCountLastTimeRef.current;

    // Count real listening progress only. Big jumps are usually seeking, not listening.
    if (delta > 0 && delta < 3) {
      playCountListenedRef.current += delta;
    }

    playCountLastTimeRef.current = safeNextTime;
  }

  function markSongCompletedForPlayCount(song: Song | null) {
    if (!song || !countPlayRef.current || playCountSongIdRef.current !== song.id) return false;

    const duration = Math.max(0, Number(durationRef.current || song.duration || 0));
    const listened = playCountListenedRef.current;
    const required = duration > 0 ? Math.max(8, duration * 0.82) : 8;

    resetPlayCountTracker();

    if (listened + 1 < required) return false;

    const latest = songs.find((item) => item.id === song.id) || song;

    void patchSongLocal(song.id, {
      playCount: Math.max(0, Number(latest.playCount || 0)) + 1,
      lastPlayed: new Date().toISOString()
    });

    return true;
  }
  const triggerSecret = useCallback((mode: SecretTriggerMode, message: string) => {
    const allowedMode: SecretTriggerMode | null = mode === "yukari" ? mode : null;
    if (!allowedMode) return;

    if (secretTimeoutRef.current) {
      window.clearTimeout(secretTimeoutRef.current);
      secretTimeoutRef.current = null;
    }

    setSecretMode(allowedMode);
    setSecretToast(message);
    setSecretBurst((value) => value + 1);

    const duration = 5200;
    secretTimeoutRef.current = window.setTimeout(() => {
      setSecretMode("none");
      setSecretToast("");
      secretTimeoutRef.current = null;
    }, duration);
  }, [secretMode]);

  function triggerPlayButtonSecret() {
    setPlayButtonBurst((value) => value + 1);

    if (!playingRef.current) {
      showAppToast("play button bounce triggered", "info");
    }

    if (playButtonBurstTimerRef.current) {
      window.clearTimeout(playButtonBurstTimerRef.current);
    }

    playButtonBurstTimerRef.current = window.setTimeout(() => {
      setPlayButtonBurst(0);
      playButtonBurstTimerRef.current = null;
    }, 1200);
  }

  const getLiveDiscordAssetKey = (song: Song | null, songIndex: number, mode: DiscordArtMode) => {
    if (mode === "none") return undefined;
    if (mode === "logo") return DISCORD_LOGO_ASSET;
    if (!song) return DISCORD_LOGO_ASSET;

    const songKey = `${song.id}:${song.filePath || song.title}:${song.duration}:${songIndex}`;
    const cached = discordAssetBySongRef.current[songKey];
    if (cached) return cached;

    let pick = getRuntimePixelArtForSong(song, "rpc");
    if (pick.discordKey === lastDiscordAssetKeyRef.current && pixelArtPool.length > 1) {
      pick = getRuntimePixelArtForSong(song, "rpc-next");
    }

    discordAssetBySongRef.current[songKey] = pick.discordKey;
    lastDiscordAssetKeyRef.current = pick.discordKey;
    return pick.discordKey;
  };

  function openOnboardingDevPreview() {
    setOnboardingDevPreview(true);
    setOnboardingOpen(true);
    setSettingsOpen(false);
    setEditorSong(null);
    setDeleteTarget(null);
    changeView("home", "unknown");
    setStatusText("onboarding preview opened");
    showAppToast("onboarding preview opened", "success");
  }

  const handleSearchInput = (value: string) => {
    const command = value.trim().toLowerCase();

    if (shouldOpenFeedbackPromptFromGlobalSearch(value)) {
      setQuery("");
      setSettingsSearch("");
      setSettingsOpen(false);
      setFeedbackCategory("bug");
      openFeedbackPrompt(true);
      setStatusText("feedback box opened");
      showAppToast("feedback box opened", "success");
      return;
    }

    if (
      command === "onboardingtrue" ||
      command === "/onboardingtrue" ||
      command === "showonboarding" ||
      command === "/showonboarding" ||
      command === "onboarding"
    ) {
      openOnboardingDevPreview();
      setQuery("");
      return;
    }

    if (
      command === "onboardingreset" ||
      command === "/onboardingreset"
    ) {
      resetOnboardingForThisRelease();

      openOnboardingDevPreview();
      setStatusText("onboarding reset and opened");
      showAppToast("onboarding reset and opened", "success");
      setQuery("");
      return;
    }

    if (command === "screensaver" || command === "/screensaver") {
      setQuery("");
      openScreensaverPreview(2000);
      return;
    }

    if (command === "ilovesnakes" || command === "/ilovesnakes" || command === "snakegame" || command === "/snakegame") {
      openSnakeGame();
      setQuery("");
      return;
    }


    if (command === "whatsnew" || command === "whatsnewtrue" || command === "showwhatsnew") {
      setWhatsNewOpen(true);
      setQuery("");
      showAppToast("what's new opened", "success");
      return;
    }

    if (command === "popup1" || command === "/popup1") {
      clearUpdateNagTimer();
      updateNagVersionRef.current = "test";
      updateNagStatusRef.current = "available";
      setUpdatePrompt({
        visible: true,
        status: "available",
        version: "test",
        percent: 0,
        message: "localtify test update is ready to download.",
        error: "",
        libraryBackedUp: true
      });
      setQuery("");
      return;
    }

    if (command === "popup2" || command === "/popup2") {
      clearUpdateNagTimer();
      showUpdateNag(1, updatePrompt.version || updateNagVersionRef.current || "test");
      setQuery("");
      return;
    }

    if (command === "popup3" || command === "/popup3") {
      clearUpdateNagTimer();
      showUpdateNag(2, updatePrompt.version || updateNagVersionRef.current || "test");
      setQuery("");
      return;
    }

    if (command === "popup4" || command === "/popup4") {
      clearUpdateNagTimer();
      showUpdateNag(3, updatePrompt.version || updateNagVersionRef.current || "test");
      setQuery("");
      return;
    }

    if (command === "/dev" || command === "dev") {
      setQuery("");
      return;
    }

    if (command === "ppp" || command === "/ppp") {
      triggerPlayButtonSecret();
      setQuery("");
      return;
    }
    const secretMap: Record<string, { mode: SecretTriggerMode; message: string }> = {
      "/yukari": { mode: "yukari", message: "yukari peeked in" },
      "yukari": { mode: "yukari", message: "yukari peeked in" },
      "/peek": { mode: "yukari", message: "yukari peeked in" },
      "peek": { mode: "yukari", message: "yukari peeked in" },
      "/y": { mode: "yukari", message: "yukari peeked in" }
    };

    const secret = secretMap[command];
    if (secret) {
      triggerSecret(secret.mode, secret.message);
      setQuery("");
      return;
    }

    const nextQuery = value;
    setQuery(nextQuery);

    const cleanQuery = nextQuery.trim();
    if (!cleanQuery) return;

    if (settingsOpen) {
      setSettingsOpen(false);
    }

    if (view !== "library" && view !== "liked") {
      changeView("library", "unknown");
    }

    setStatusText(cleanQuery.length > 1 ? "searching: " + cleanQuery : "searching songs");
  };

  useEffect(() => {
    const clearSecretTyping = () => {
      secretBufferRef.current = "";
    };

    const shouldIgnoreSecretTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      const tag = element?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || Boolean(element?.isContentEditable);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || shouldIgnoreSecretTarget(event.target)) return;
      const typed = event.key.length === 1 ? event.key.toLowerCase() : "";
      if (!/^[a-z0-9]$/.test(typed)) return;

      secretBufferRef.current = `${secretBufferRef.current}${typed}`.slice(-24);
      const compactBuffer = secretBufferRef.current.replace(/[^a-z0-9]/g, "");


      if (compactBuffer.endsWith("yukari")) {
        event.preventDefault();
        triggerSecret("yukari", "yukari peeked in");
        clearSecretTyping();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (secretTimeoutRef.current) window.clearTimeout(secretTimeoutRef.current);
      if (playButtonBurstTimerRef.current) window.clearTimeout(playButtonBurstTimerRef.current);
    };
  }, [triggerSecret]);

  useEffect(() => {
    let mounted = true;
    let bootStepTimer: number | null = null;
    const bootStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    const setBootStep = (index: number, stage?: string) => {
      if (!mounted) return;
      setBootStepIndex(Math.max(0, Math.min(index, BOOT_STEPS.length - 1)));
      if (stage) setBootStage(stage);
    };

    const waitForMinimumBoot = () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      // V251: keep the loading screen visible for polish, but do not force a long wait
      // after the real bootstrap work has already finished.
      const fastBootMinimumMs = Math.min(BOOT_MIN_VISIBLE_MS, 520);
      const remaining = Math.max(0, fastBootMinimumMs - (now - bootStartedAt));
      if (remaining <= 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        window.setTimeout(resolve, remaining);
      });
    };

    setReady(false);
    setBootError(null);
    setBootLogCopied(false);
    setBootStepIndex(0);
    setBootStage("starting localtify...");

    bootStepTimer = window.setInterval(() => {
      setBootStepIndex((step) => Math.min(step + 1, BOOT_STEPS.length - 1));
    }, 240);

    window.localitfy.bootstrap().then(async (payload) => {
      if (!mounted) return;

      setBootStep(0, "loading settings and theme...");

      const storedSettings = (payload.settings || {}) as Partial<Settings>;
      const shouldApplyV013Defaults = window.localStorage.getItem(V013_DEFAULTS_KEY) !== "true";
      const shouldApplyStartWithWindowsDefault = platformInfo.startupSettingSupported && typeof storedSettings.startWithWindows === "undefined";
      const nextSettings: Settings = applyVisualCustomizationDefaults({
        ...defaultSettings,
        ...storedSettings,
        ...(shouldApplyV013Defaults ? V013_RELEASE_DEFAULTS : {})
      } as Settings);

      if (shouldApplyStartWithWindowsDefault) {
        nextSettings.startWithWindows = true;
      }

      if (!platformInfo.startupSettingSupported) {
        nextSettings.startWithWindows = false;
      }

      const shouldRepairAnimatedVisualSettings = nextSettings.animatedBackgrounds !== true || nextSettings.animeVisuals !== true;
      nextSettings.animatedBackgrounds = true;
      nextSettings.animeVisuals = true;

      nextSettings.coverColorSyncMode = normalizeCoverColorSyncMode(
        storedSettings.coverColorSyncMode ?? (storedSettings.showAmbientGradient === false ? "off" : nextSettings.coverColorSyncMode)
      );
      nextSettings.showAmbientGradient = nextSettings.coverColorSyncMode !== "off";

      // Simple Mode was removed in v0.2.8. Keep old installs from booting into it.
      nextSettings.simpleMode = false;

      const normalizedBootTheme = normalizeThemeId(nextSettings.theme);
      const shouldRepairBootTheme = normalizedBootTheme !== nextSettings.theme;
      nextSettings.theme = normalizedBootTheme;

      const shouldPersistVisualCustomizationDefaults =
        nextSettings.homeBannerType !== storedSettings.homeBannerType ||
        nextSettings.blurEffects !== storedSettings.blurEffects ||
        nextSettings.mediaCardBackground !== storedSettings.mediaCardBackground ||
        nextSettings.homeLayoutMode !== storedSettings.homeLayoutMode ||
        nextSettings.libraryRowStyle !== storedSettings.libraryRowStyle ||
        nextSettings.starsIntensity !== storedSettings.starsIntensity ||
        nextSettings.sidebarBehavior !== storedSettings.sidebarBehavior ||
        nextSettings.playerBackgroundStyle !== storedSettings.playerBackgroundStyle;

      const shouldPersistBootSettings =
        shouldApplyV013Defaults ||
        shouldApplyStartWithWindowsDefault ||
        shouldRepairAnimatedVisualSettings ||
        shouldRepairBootTheme ||
        shouldPersistVisualCustomizationDefaults ||
        (platformInfo.startupSettingSupported && typeof storedSettings.startWithWindows === "undefined");

      if (shouldPersistBootSettings) {
        if (shouldApplyV013Defaults) window.localStorage.setItem(V013_DEFAULTS_KEY, "true");
        if (shouldApplyStartWithWindowsDefault) window.localStorage.setItem(START_WITH_WINDOWS_DEFAULT_KEY, "true");
        window.localitfy.saveSettings(nextSettings).catch(() => undefined);
      }

      setBootStep(1, "loading your library...");
      const nextSongs = applyLibraryOrder(sanitizeSongList(payload.songs || []));
      const validBootSongIds = new Set(nextSongs.map((song) => song.id));

      setBootStep(2, "loading playlists...");
      const localPlaylists = cleanPlaylistList(readLocalJson<Playlist[]>(PLAYLIST_STORAGE_KEY, []), validBootSongIds);
      const databasePlaylists = cleanPlaylistList(payload.playlists || [], validBootSongIds);
      const initialPlaylists = databasePlaylists.length ? databasePlaylists : localPlaylists;

      setBootStep(3, "preparing covers and visuals...");
      const initialSongId =
        nextSettings.rememberLastSong &&
        nextSettings.lastSongId &&
        nextSongs.some((song) => song.id === nextSettings.lastSongId)
          ? nextSettings.lastSongId
          : nextSongs[0]?.id || "";

      setBootStep(4, "warming up the player...");
      await waitForMinimumBoot();
      if (!mounted) return;

      if (bootStepTimer) {
        window.clearInterval(bootStepTimer);
        bootStepTimer = null;
      }

      setBootStep(5, "opening localtify...");
      setSongs(nextSongs);
      setPlaylists(initialPlaylists);
      setSettings(nextSettings);
      setCurrentId(initialSongId);
      setReady(true);

      if (!databasePlaylists.length && localPlaylists.length && window.localitfy.savePlaylists) {
        window.localitfy.savePlaylists(localPlaylists).catch(() => undefined);
      }

      loadPixelArtAssets(false)
        .then((assets) => {
          if (!mounted) return;
          setPixelArtAssets(assets);
        })
        .catch(() => {
          if (mounted) setPixelArtAssets(getCachedRuntimePixelArtAssets());
        });
      bootedRef.current = true;
    }).catch((error) => {
      if (!mounted) return;
      if (bootStepTimer) {
        window.clearInterval(bootStepTimer);
        bootStepTimer = null;
      }

      const message = error instanceof Error ? error.message : String(error || "Unknown startup error");
      console.error("localtify startup failed", error);
      setBootError(message);
      setReady(false);
      setBootStage("startup failed");
      trackError("startup_bootstrap_failed", message, { category: "startup" });
    });

    return () => {
      mounted = false;
      if (bootStepTimer) window.clearInterval(bootStepTimer);
    };
  }, [loadPixelArtAssets, bootRetryKey]);
  // Heavy automatic late-night secret effects were removed in V215.
  // Heavy automatic MiSide/joke visual mode was removed in V215.


  useEffect(() => {
    const off = window.localitfy.onDownloadProgress((payload) => {
      const nextProgress = clamp(Number(payload.progress || 0), 0, 100);
      const nextMessage = payload.message || "working...";

      if (!payload.id && !payload.url) return;

      const itemId = payload.id || payload.url || `download-${Date.now()}`;

      setDownloadQueue((current) => {
        const existingIndex = current.findIndex((item) => item.id === itemId || item.url === payload.url);
        const previous = existingIndex >= 0 ? current[existingIndex] : null;
        const nextItem: DownloadQueueItem = {
          id: itemId,
          url: payload.url || previous?.url || "",
          title: payload.file || payload.filename || previous?.title || "download",
          status: payload.status || (nextProgress >= 100 ? "done" : "downloading"),
          progress: nextProgress,
          message: nextMessage,
          speed: payload.speed || previous?.speed,
          eta: payload.eta || previous?.eta,
          filename: payload.filename || previous?.filename,
          error: payload.error || previous?.error
        };

        if (existingIndex === -1) return [...current, nextItem];

        const merged = {
          ...previous,
          ...nextItem,
          title: payload.file || payload.filename || previous?.title || nextItem.title,
          url: payload.url || previous?.url || nextItem.url
        };

        const sameVisualState =
          Math.abs((previous?.progress || 0) - merged.progress) < 0.75 &&
          previous?.status === merged.status &&
          previous?.message === merged.message &&
          previous?.title === merged.title &&
          previous?.filename === merged.filename &&
          previous?.error === merged.error;

        if (sameVisualState) return current;

        const copy = [...current];
        copy[existingIndex] = merged;
        return copy;
      });
    });

    return () => {
      off();
    };
  }, []);

  function stopPlaybackFromNative() {
    const audio = audioRef.current;

    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // native controls should never break playback
      }
    }

    pendingPlayRef.current = false;
    resetPlayCountTracker();
    setIsPlaying(false);
    setCurrentTime(0);
    setStatusText("stopped");
  }

  function toggleMuteFromNative() {
    const currentVolume = clamp(Number(volumeRef.current) || 0, 0, 1);
    const nextVolume = currentVolume > 0.01 ? 0 : clamp(lastNonZeroVolumeRef.current || defaultSettings.volume, 0.05, 1);
    updateVolumeFast(nextVolume);
  }

  useEffect(() => {
    const off = window.localitfy.onPlayerCommand((command: any) => {
      if (!command || typeof command !== "object") return;

      if (command.type === "toggle") togglePlay();
      if (command.type === "play") setIsPlaying(true);
      if (command.type === "pause") setIsPlaying(false);
      if (command.type === "stop") stopPlaybackFromNative();
      if (command.type === "prev") playPrevious();
      if (command.type === "next") playNext(true);
      if (command.type === "repeat") toggleRepeat();
      if (command.type === "shuffle") setIsShuffle((value) => !value);
      if (command.type === "muteToggle") toggleMuteFromNative();
      if (command.type === "seekPercent") handleSeek(String(command.value ?? 0));

      if (command.type === "volume") {
        updateVolumeFast(clamp(Number(command.value) || 0, 0, 1));
      }
    });

    return () => off();
  }, [settings.volume, currentId, isPlaying, songs]);


  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const seekBy = (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      const duration = currentDuration || audio.duration || 0;
      audio.currentTime = clamp(audio.currentTime + seconds, 0, duration || Number.MAX_SAFE_INTEGER);
    };

    try {
      const mediaArtworkSrc = getRendererSafeImageUrl(currentSong?.coverUrl);
      const artwork = mediaArtworkSrc
        ? ([96, 128, 192, 256, 512].map((size) => ({
            src: mediaArtworkSrc,
            sizes: `${size}x${size}`,
            type: "image/png"
          })) as MediaImage[])
        : [];

      navigator.mediaSession.metadata = currentSong
        ? new MediaMetadata({
            title: currentSong.title || "Unknown song",
            artist: prettyMeta(currentSong.artist) || "Unknown artist",
            album: currentSong.album || "localtify",
            artwork
          })
        : null;

      navigator.mediaSession.playbackState = currentSong ? (isPlaying ? "playing" : "paused") : "none";
      navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler("stop" as MediaSessionAction, () => stopPlaybackFromNative());
      navigator.mediaSession.setActionHandler("previoustrack", () => playPrevious());
      navigator.mediaSession.setActionHandler("nexttrack", () => playNext(true));
      navigator.mediaSession.setActionHandler("seekbackward", () => seekBy(-10));
      navigator.mediaSession.setActionHandler("seekforward", () => seekBy(10));
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        const audio = audioRef.current;
        if (audio && typeof details.seekTime === "number") audio.currentTime = clamp(details.seekTime, 0, currentDuration || audio.duration || 0);
      });
    } catch {
      // media session is optional and should never break playback
    }
  }, [currentSong?.id, currentSong?.coverUrl, currentSong?.title, currentSong?.artist, currentSong?.album, isPlaying, currentDuration]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;

    try {
      const canSetPosition = typeof navigator.mediaSession.setPositionState === "function";
      if (!canSetPosition) return;

      const duration = Math.max(0, Number(currentDuration) || 0);
      const position = clamp(Number(timeRef.current || currentTime) || 0, 0, duration || Number.MAX_SAFE_INTEGER);

      navigator.mediaSession.setPositionState({
        duration: duration || Math.max(position, 1),
        playbackRate: clamp(Number(settings.playbackSpeed) || 1, 0.5, 2),
        position
      });
    } catch {
      // Windows media progress is optional; never risk playback for it.
    }
  }, [currentSong?.id, currentDuration, settings.playbackSpeed]);

  useEffect(() => {
    window.localitfy.setMinimizeToTray?.(settings.minimizeToTray).catch(() => undefined);
  }, [settings.minimizeToTray]);

  useEffect(() => {
    if (!platformInfo.startupSettingSupported) return;
    window.localitfy.setStartWithWindows?.(settings.startWithWindows).catch(() => undefined);
  }, [platformInfo.startupSettingSupported, settings.startWithWindows]);

  useEffect(() => {
    window.localitfy.updateNativeMediaState?.({
      appVersion: APP_VERSION,
      isPlaying,
      volume: settings.volume,
      muted: settings.volume <= 0.01,
      title: currentSong?.title || "",
      artist: currentSong?.artist || "",
      album: currentSong?.album || "",
      coverUrl: currentSong?.coverUrl || "",
      hasSong: Boolean(currentSong),
      minimizeToTray: settings.minimizeToTray,
      startWithWindows: platformInfo.startupSettingSupported ? settings.startWithWindows : false,
      platform: platformInfo.id
    }).catch(() => undefined);
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, currentSong?.album, currentSong?.coverUrl, isPlaying, platformInfo.id, platformInfo.startupSettingSupported, settings.volume, settings.minimizeToTray, settings.startWithWindows]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const editing = tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (editing) return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.code === "ArrowRight" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        playNext(true);
        return;
      }

      if (event.code === "ArrowLeft" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        playPrevious();
        return;
      }

      if (event.code === "KeyM") {
        event.preventDefault();
        updateVolumeFast(settings.volume > 0 ? 0 : 0.75);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.volume, currentSong?.id, currentId, isPlaying, songs.length]);

  useEffect(() => {
    return () => {
      stopFade();
      stopCrossfadeAuto();
      stopProgressLoop();

      if (saveSettingsTimerRef.current !== null) {
        window.clearTimeout(saveSettingsTimerRef.current);
      }

      if (backgroundAudioRepairTimerRef.current !== null) {
        window.clearTimeout(backgroundAudioRepairTimerRef.current);
        backgroundAudioRepairTimerRef.current = null;
      }

      if (sleepTimerRef.current !== null) {
        window.clearTimeout(sleepTimerRef.current);
      }

      if (volumeDraftFrameRef.current !== null) {
        window.cancelAnimationFrame(volumeDraftFrameRef.current);
        volumeDraftFrameRef.current = null;
      }

      if (liveVolumeFrameRef.current !== null) {
        window.cancelAnimationFrame(liveVolumeFrameRef.current);
        liveVolumeFrameRef.current = null;
      }

      if (fadeFrameRef.current !== null) {
        window.cancelAnimationFrame(fadeFrameRef.current);
        fadeFrameRef.current = null;
      }

      nextAudioRef.current?.pause();
      nextAudioRef.current = null;
      disposeAudioEngine();

      window.localitfy.clearDiscordActivity().catch(() => undefined);
    };
  }, []);

  function getAudioEffectMode() {
    return String((settings as any).audioEffectMode || "normal") as "normal" | "nightcore" | "daycore";
  }

  function getAudioEffectAmount() {
    return 50;
  }

  function getAudioReverbAmount() {
    return 0;
  }

  function disposeAudioEngine() {
    try { beatSourceRef.current?.disconnect(); } catch {}
    try { beatAnalyserRef.current?.disconnect(); } catch {}
    try { audioEffectDryGainRef.current?.disconnect(); } catch {}
    try { audioEffectWetGainRef.current?.disconnect(); } catch {}
    try { audioEffectDelayRef.current?.disconnect(); } catch {}
    try { audioEffectFeedbackGainRef.current?.disconnect(); } catch {}
    try { audioEffectFilterRef.current?.disconnect(); } catch {}

    beatAnalyserRef.current = null;
    beatDataRef.current = null;
    audioEffectDryGainRef.current = null;
    audioEffectWetGainRef.current = null;
    audioEffectDelayRef.current = null;
    audioEffectFeedbackGainRef.current = null;
    audioEffectFilterRef.current = null;

    const context = beatAudioContextRef.current;
    beatAudioContextRef.current = null;
    beatSourceRef.current = null;

    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  function setAudioElementVolume(audio: HTMLAudioElement | null | undefined, volume: number) {
    if (!audio) return;

    const safeVolume = clamp(Number(volume) || 0, 0, 1);

    try {
      if (audio === audioRef.current) {
        const controller = ensurePlayerController();

        if (controller) {
          controller.setVolume(safeVolume);
          return;
        }
      }

      audio.muted = false;
      audio.volume = safeVolume;
    } catch {
      // Volume changes should never break playback.
    }
  }

  function getEffectivePlaybackRate() {
    const baseRate = clamp(Number(settings.playbackSpeed) || 1, 0.5, 2);
    const mode = getAudioEffectMode();
    const amount = getAudioEffectAmount() / 100;

    if (mode === "nightcore") return clamp(baseRate * (1.08 + amount * 0.14), 0.5, 2);
    if (mode === "daycore") return clamp(baseRate * (0.96 - amount * 0.14), 0.5, 2);

    return baseRate;
  }

  function applyPlaybackRateSettings(audio: HTMLAudioElement | null | undefined) {
    if (!audio) return;

    const mode = getAudioEffectMode();
    const rate = getEffectivePlaybackRate();

    audio.playbackRate = rate;

    // Nightcore/daycore should change pitch too, not just tempo.
    try {
      (audio as any).preservesPitch = mode === "normal";
      (audio as any).mozPreservesPitch = mode === "normal";
      (audio as any).webkitPreservesPitch = mode === "normal";
    } catch {
      // Older Chromium builds can ignore pitch flags safely.
    }
  }

  function syncAudioEffectGraph(audio: HTMLAudioElement | null | undefined) {
    if (!audio || audio !== audioRef.current) return;

    const needsAnalyser = Boolean(beatAnalyserRef.current);
    const reverbAmount = getAudioReverbAmount() / 100;
    const needsGraph = needsAnalyser || reverbAmount > 0.01 || Boolean(beatSourceRef.current);

    if (!needsGraph) return;

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return;

    try {
      const context = beatAudioContextRef.current || new AudioContextCtor({ latencyHint: "playback" });
      beatAudioContextRef.current = context;

      if (context.state === "suspended") {
        void context.resume().catch(() => undefined);
      }

      const source = beatSourceRef.current || context.createMediaElementSource(audio);
      beatSourceRef.current = source;

      const dryGain = audioEffectDryGainRef.current || context.createGain();
      audioEffectDryGainRef.current = dryGain;

      try { source.disconnect(); } catch {}
      try { dryGain.disconnect(); } catch {}
      try { beatAnalyserRef.current?.disconnect(); } catch {}

      dryGain.gain.value = 1;
      source.connect(dryGain);
      dryGain.connect(context.destination);

      if (needsAnalyser && beatAnalyserRef.current) {
        source.connect(beatAnalyserRef.current);
      }
    } catch {
      // Keep normal HTMLAudio playback alive if WebAudio cannot attach.
    }
  }

  const getTargetAudioVolume = useCallback(
    (song: Song | null = songRef.current) => {
      const baseVolume = clamp(Number(settings.volume) || 0, 0, 1);
      const memoryVolume = settings.perSongVolumeMemory ? clamp(Number(song?.customVolume ?? 1), 0, 1) : 1;
      const gain = settings.volumeNormalization ? clamp(Number(song?.volumeGain ?? 1), 0.2, 2.4) : 1;
      return clamp(baseVolume * memoryVolume * gain, 0, 1);
    },
    [settings.volume, settings.perSongVolumeMemory, settings.volumeNormalization]
  );

  const applyAudioQualitySettings = useCallback(
    (audio: HTMLAudioElement | null = audioRef.current, song: Song | null = songRef.current) => {
      if (!audio) return 0;
      const safeVolume = getTargetAudioVolume(song);

      setAudioElementVolume(audio, safeVolume);
      applyPlaybackRateSettings(audio);
      audio.preload = settings.gaplessPlayback ? "auto" : "metadata";
      volumeRef.current = safeVolume;
      return safeVolume;
    },
    [
      getTargetAudioVolume,
      settings.playbackSpeed,
      settings.gaplessPlayback,
      (settings as any).audioEffectMode
    ]
  );

  const resolvePlaybackUrl = useCallback(
    async (song: Song | null | undefined, options: { force?: boolean } = {}): Promise<PlaybackUrlResult> => {
      if (!song) return { ok: false, fileExists: false, error: "missing song" };

      const sourceKey = getSongPlaybackSourceKey(song);
      const filePath = String(song.filePath || "");

      if (!sourceKey) return { ok: false, fileExists: false, error: "missing file path" };
      if (song.fileExists === false && !options.force) return { ok: false, fileExists: false, error: "file marked missing" };

      const now = Date.now();
      const cached = playbackUrlCacheRef.current.get(sourceKey);

      if (!options.force && cached?.url && cached.fileExists && now - cached.checkedAt < PLAYBACK_URL_CACHE_TTL_MS) {
        return {
          ok: true,
          url: cached.url,
          filePath,
          fileExists: true,
          sizeBytes: cached.sizeBytes,
          mtimeMs: cached.mtimeMs,
          cacheTtlMs: PLAYBACK_URL_CACHE_TTL_MS
        };
      }

      const bridge = window.localitfy as any;
      const resolver = bridge?.resolvePlaybackUrl;

      if (typeof resolver !== "function") {
        if (song.url) {
          return { ok: true, url: song.url, filePath, fileExists: true, cacheTtlMs: PLAYBACK_URL_CACHE_TTL_MS };
        }

        return { ok: false, filePath, fileExists: undefined, error: "playback resolver unavailable" };
      }

      const pendingKey = `${sourceKey}:${options.force ? "force" : "normal"}`;
      const existingPending = playbackUrlPendingRef.current.get(pendingKey);
      if (existingPending) return existingPending;

      const request = Promise.resolve(
        resolver({
          songId: song.id,
          filePath,
          fallbackUrl: song.url || "",
          force: Boolean(options.force)
        })
      )
        .then((result: any): PlaybackUrlResult => {
          const fileExists =
            typeof result?.fileExists === "boolean"
              ? result.fileExists
              : typeof result?.exists === "boolean"
                ? result.exists
                : Boolean(result?.ok);

          if (result?.ok && result?.url && fileExists !== false) {
            const entry: PlaybackUrlCacheEntry = {
              url: String(result.url),
              checkedAt: Date.now(),
              fileExists: true,
              sizeBytes: typeof result.sizeBytes === "number" ? result.sizeBytes : undefined,
              mtimeMs: typeof result.mtimeMs === "number" ? result.mtimeMs : undefined
            };

            playbackUrlCacheRef.current.set(sourceKey, entry);

            return {
              ok: true,
              url: entry.url,
              filePath: result.filePath || filePath,
              fileExists: true,
              sizeBytes: entry.sizeBytes,
              mtimeMs: entry.mtimeMs,
              cacheTtlMs: PLAYBACK_URL_CACHE_TTL_MS
            };
          }

          playbackUrlCacheRef.current.delete(sourceKey);

          if (fileExists === false && song.id) {
            setSongs((oldSongs) =>
              oldSongs.map((item) => (item.id === song.id ? { ...item, fileExists: false, url: "" } : item))
            );

            void window.localitfy?.patchSong?.(song.id, { fileExists: false, url: "" }).catch(() => undefined);
          }

          return {
            ok: false,
            filePath,
            fileExists,
            error: String(result?.error || "could not resolve playback url")
          };
        })
        .catch((error: unknown): PlaybackUrlResult => {
          playbackUrlCacheRef.current.delete(sourceKey);
          return {
            ok: false,
            filePath,
            fileExists: undefined,
            error: error instanceof Error ? error.message : String(error || "could not resolve playback url")
          };
        })
        .finally(() => {
          playbackUrlPendingRef.current.delete(pendingKey);
        }) as Promise<PlaybackUrlResult>;

      playbackUrlPendingRef.current.set(pendingKey, request);
      return request;
    },
    []
  );

  useEffect(() => {
    applyAudioQualitySettings();
  }, [applyAudioQualitySettings, currentSong?.id, currentSong?.volumeGain, currentSong?.customVolume]);

  useEffect(() => {
    if (!isVolumeDragging) {
      const safeVolumePercent = Math.round(settings.volume * 100);
      volumeDraftRef.current = safeVolumePercent;
      setVolumeDraft(safeVolumePercent);
    }
  }, [isVolumeDragging, settings.volume]);

  useEffect(() => {
    if (!isPlaying || !currentSong) {
      stopProgressLoop();
      syncProgressDom(timeRef.current || 0, durationRef.current || currentDuration, true);
      return;
    }

    let lastPaintedDuration = currentDuration || 0;

    const scheduleProgressTick = (delayMs: number) => {
      if (progressLoopTimeoutRef.current !== null) {
        window.clearTimeout(progressLoopTimeoutRef.current);
      }

      progressLoopTimeoutRef.current = window.setTimeout(() => {
        progressLoopTimeoutRef.current = null;
        animationFrameRef.current = window.requestAnimationFrame(tick);
      }, delayMs);
    };

    const tick = (clock: number) => {
      animationFrameRef.current = null;
      const audio = audioRef.current;
      const backgroundMode = isAppBackgroundedRef.current;
      const busyUi = scrollBusyRef.current || performance.now() < rendererQuietUntilRef.current || Boolean(draggedSongIdRef.current) || themeSettlingRef.current;

      if (audio && !audio.paused) {
        const nextTime = audio.currentTime || 0;
        const nextDuration = Number.isFinite(audio.duration) ? audio.duration : currentDuration;

        timeRef.current = nextTime;
        if (Number.isFinite(nextDuration) && nextDuration > 0) durationRef.current = nextDuration;

        const uiPaintEveryMs = backgroundMode ? 3000 : busyUi ? 420 : 120;
        if (!backgroundMode && !isSeekingRef.current && clock - lastProgressUiPaintRef.current > uiPaintEveryMs) {
          lastProgressUiPaintRef.current = clock;
          syncProgressDom(nextTime, nextDuration);
        }

        // Keep playback position out of React's hot path. The DOM progress gets painted
        // directly and React state only changes when the actual song duration changes.
        if (!isSeekingRef.current && clock - lastProgressStatePaintRef.current > 12000) {
          lastProgressStatePaintRef.current = clock;
        }

        if (!backgroundMode && Number.isFinite(nextDuration) && nextDuration > 0 && Math.abs(nextDuration - lastPaintedDuration) > 0.5) {
          lastPaintedDuration = nextDuration;
          setCurrentDuration(nextDuration);
          syncProgressDom(nextTime, nextDuration, true);
        }

        // V341: Localtify now always starts songs from the beginning.
        // Do not keep writing resume positions during normal playback.
        positionSaveRef.current = Date.now();

        if (!backgroundMode && !busyUi && settings.gaplessPlayback && nextDuration > 0 && nextDuration - nextTime < 20) {
          window.setTimeout(() => runLocaltifyIdleTask(() => primeNextAudioCache(), 1800), 650);
        }
      }

      scheduleProgressTick(backgroundMode ? 1000 : busyUi ? 300 : 100);
    };

    scheduleProgressTick(80);

    return () => stopProgressLoop();
  }, [isPlaying, currentSong?.id, currentDuration, settings.gaplessPlayback, syncProgressDom]);

  const discordSettingsRef = useRef(settings);

  useEffect(() => {
    discordSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!ready) return;

    if (!settings.discordEnabled) {
      window.localitfy.clearDiscordActivity().catch(() => undefined);
      return;
    }

    let alive = true;
    let lastPayloadKey = "";

    const sendActivity = (reason = "tick") => {
      if (!alive) return;

      const audio = audioRef.current;
      const song = songRef.current;
      const latestSettings = discordSettingsRef.current;

      const safeCurrentTime = Number.isFinite(audio?.currentTime)
        ? Math.floor(audio?.currentTime || 0)
        : Math.floor(timeRef.current || 0);

      const safeDuration = Number.isFinite(audio?.duration)
        ? Math.floor(audio?.duration || 0)
        : Math.floor(durationRef.current || song?.duration || 0);

      const pixel = getRuntimePixelArtForSong(song, "rpc-preview");
      const backupPixel = getRuntimePixelArtForSong(song, "rpc-backup");
      const currentSongIndexForRpc = song ? songIndexById.get(song.id) ?? -1 : -1;
      const chosenDiscordAsset = getLiveDiscordAssetKey(song, currentSongIndexForRpc, latestSettings.discordArtMode);

      const discordSongSearchUrl = buildDiscordSongSearchUrl(song?.title || "", song?.artist || "");
      const discordHasSong = Boolean(song?.title);
      const discordPrimaryLabel = latestSettings.discordPrivacyMode || !discordHasSong
        ? "Download localtify"
        : "Search this song on YouTube";
      const discordPrimaryUrl = latestSettings.discordPrivacyMode || !discordHasSong
        ? LOCALITFY_DOWNLOAD_URL
        : discordSongSearchUrl;

      const payloadKey = [
        song?.id || "idle",
        song?.title || "",
        song?.artist || "",
        song?.album || "",
        song?.playCount || 0,
        song?.liked ? "liked" : "plain",
        playingRef.current ? "playing" : "paused",
        safeDuration,
        Math.floor(safeCurrentTime / 15),
        songs.length,
        mostPlayed?.id || "",
        latestSettings.discordEnabled,
        latestSettings.discordShowPausedIdle,
        latestSettings.discordPrivacyMode,
        latestSettings.discordButtons,
        latestSettings.discordArtMode,
        latestSettings.discordActivityStyle,
        latestSettings.discordTitleCleanup,
        latestSettings.discordSecondLine,
        chosenDiscordAsset,
        reason
      ].join("|");

      if (payloadKey === lastPayloadKey) return;
      lastPayloadKey = payloadKey;

      const localitfyBridge = window.localitfy as any;
      const sendDiscordActivity = localitfyBridge?.updateDiscordActivity || localitfyBridge?.setDiscordActivity;
      if (!sendDiscordActivity) return;

      sendDiscordActivity({
          isPlaying: playingRef.current,
          songId: song?.id || "",
          title: song?.title || "",
          artist: song?.artist || "",
          album: song?.album || "",
          playCount: song?.playCount || 0,
          liked: song?.liked || false,
          currentTime: safeCurrentTime,
          duration: safeDuration,
          songCount: songs.length,
          mostPlayedTitle: mostPlayed?.title || "",

          discordEnabled: latestSettings.discordEnabled,
          discordShowPausedIdle: latestSettings.discordShowPausedIdle,
          discordPrivacyMode: latestSettings.discordPrivacyMode,
          discordButtons: latestSettings.discordButtons,
          discordArtMode: latestSettings.discordArtMode,
          discordActivityStyle: latestSettings.discordActivityStyle,
          discordTitleCleanup: latestSettings.discordTitleCleanup,
          discordSecondLine: latestSettings.discordSecondLine,
          discordAssetKey: chosenDiscordAsset,
          discordAltAssetKey: backupPixel.discordKey,
          discordAssetLabel: pixel.label,
          discordAssetPreview: "url" in pixel && pixel.url ? pixel.url : pixelArtUrl(pixel.file),
          discordFallbackAssets: [...DISCORD_ASSET_KEYS],
          discordOpenUrl: discordPrimaryUrl,
          discordGithubUrl: LOCALITFY_DOWNLOAD_URL,
          discordOpenLabel: discordPrimaryLabel,
          discordGithubLabel: "Get localtify",
          discordButtonLabels: [discordPrimaryLabel, "Get localtify"],
          discordButtonRetry: true,
          discordActivityName: "localtify",
          discordActivityType: "listening",
          discordSmallImageMode: "player"
        })
        .catch(() => undefined);
    };

    sendActivity("now");

    const discordRefreshEveryMs = isAppBackgrounded ? 45000 : 15000;
    const timer = window.setInterval(() => sendActivity("tick"), discordRefreshEveryMs);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [
    ready,
    currentSong?.id,
    currentSong?.title,
    currentSong?.artist,
    currentSong?.album,
    currentSong?.playCount,
    currentSong?.liked,
    isPlaying,
    songs.length,
    songIndexById,
    mostPlayed?.id,
    settings.discordEnabled,
    settings.discordShowPausedIdle,
    settings.discordPrivacyMode,
    settings.discordButtons,
    settings.discordArtMode,
    settings.discordActivityStyle,
    settings.discordTitleCleanup,
    settings.discordSecondLine,
    pixelArtAssets.length,
    isAppBackgrounded
  ]);


  useEffect(() => {
    if (sleepTimerRef.current !== null) {
      window.clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    const minutes = Number(settings.sleepTimerMinutes) || 0;
    if (!isPlaying || minutes <= 0) return;

    sleepTimerRef.current = window.setTimeout(() => {
      const audio = audioRef.current;
      const finishSleepTimer = () => {
        setIsPlaying(false);
        updateSetting("sleepTimerMinutes", 0).catch(() => undefined);
        setStatusText("sleep timer faded out playback");
      };

      if (audio && !audio.paused && !settings.reducedMotion) {
        fadeAudio(0, 2200, finishSleepTimer);
      } else {
        finishSleepTimer();
      }
    }, Math.max(1, minutes) * 60 * 1000);

    return () => {
      if (sleepTimerRef.current !== null) {
        window.clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    };
  }, [settings.sleepTimerMinutes, isPlaying]);

  useEffect(() => {
    if (settings.volumeNormalization && currentSong && typeof currentSong.volumeGain !== "number" && window.localitfy.analyzeSongVolume) {
      window.localitfy.analyzeSongVolume(currentSong.id)
        .then((result) => {
          if (result?.song) replaceSong(result.song);
        })
        .catch(() => undefined);
    }
  }, [settings.volumeNormalization, currentSong?.id, currentSong?.volumeGain]);

  useEffect(() => {
    if (songs.length && playQueue.some((songId) => !songsById.has(songId))) {
      setPlayQueue((queue) => queue.filter((songId) => isPlayableSong(songsById.get(songId))));
    }
  }, [songs.length, songsById, playQueue]);

  useEffect(() => {
    if (!songs.length) {
      setCurrentId("");
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentDuration(0);
      return;
    }

    if (currentId && songs.some((song) => song.id === currentId)) return;

    const fallbackId = (playableSongs[0] ?? songs[0]).id;
    setCurrentId(fallbackId);
    void rememberCurrentSong(fallbackId);
  }, [songs, currentId]);

  useEffect(() => {
    let cancelled = false;
    const audio = audioRef.current;
    if (!audio) return;

    stopFade();

    applyAudioQualitySettings(audio, currentSong);

    if (!currentSong) {
      stopCrossfadeAuto();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      setCurrentTime(0);
      setCurrentDuration(0);
      setIsPlaying(false);
      setPlayerError("");
      return;
    }

    const sourceKey = getSongPlaybackSourceKey(currentSong);

    if (!sourceKey || currentSong.fileExists === false) {
      stopCrossfadeAuto();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      pendingPlayRef.current = false;
      resetPlayCountTracker();
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentDuration(0);
      setPlayerError("this audio file is missing. reimport it on this pc.");
      setStatusText("file missing");
      return;
    }

    setStatusText(`loading ${prettyTitle(currentSong.title, 5)}`);

    void resolvePlaybackUrl(currentSong).then((result) => {
      if (cancelled) return;
      if ((songRef.current || currentSong)?.id !== currentSong.id) return;

      if (!result.ok || !result.url || result.fileExists === false) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();

        pendingPlayRef.current = false;
        resetPlayCountTracker();

        setIsPlaying(false);
        setCurrentTime(0);
        setCurrentDuration(0);
        setPlayerError(result.fileExists === false ? "this audio file is missing. reimport it on this pc." : "could not create a playback URL for this song.");
        setStatusText(result.fileExists === false ? "file missing" : "playback url failed");
        return;
      }

      const handoff = crossfadeHandoffRef.current;
      const canUseHandoff = handoff?.songId === currentSong.id && handoff.url === result.url;

      if (canUseHandoff) {
        clearCrossfadeHandoffSoon(currentSong.id);

        try {
          if (audio.src !== result.url) {
            audio.src = result.url;
          }

          audio.currentTime = Math.max(0, handoff.time || 0);
          const handoffVolume = clamp(handoff.volume || getTargetAudioVolume(currentSong), 0, 1);
          setAudioElementVolume(audio, handoffVolume);
          volumeRef.current = handoffVolume;

          if (isPlaying || pendingPlayRef.current) {
            void audio.play().catch(() => undefined);
          }
        } catch {
          // normal playback recovery will handle it
        }

        setCurrentTime(Math.max(0, handoff.time || 0));
        setCurrentDuration(currentSong.duration || 0);
        setPlayerError("");
        setStatusText(`playing ${prettyTitle(currentSong.title, 5)}`);
        window.setTimeout(() => runLocaltifyIdleTask(() => primeNextAudioCache(), 1800), 650);
        return;
      }

      if (audio.src !== result.url) {
        stopCrossfadeAuto();
        audio.pause();
        audio.src = result.url;
        audio.load();

        const savedPosition = 0;

        try {
          audio.currentTime = 0;
        } catch {
          // ignore seek reset errors
        }

        setCurrentTime(0);
        setCurrentDuration(currentSong.duration || 0);
        setPlayerError("");
        setStatusText(`loaded ${prettyTitle(currentSong.title, 5)}`);
        window.setTimeout(() => runLocaltifyIdleTask(() => primeNextAudioCache(), 1800), 650);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentSong?.id, currentSong?.filePath, currentSong?.fileExists, currentSong?.volumeGain, currentSong?.customVolume, applyAudioQualitySettings, resolvePlaybackUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (isPlaying) {
      void startAudioPlayback("state-sync");
      return;
    }

    pauseAudioSmooth();
  }, [isPlaying, currentSong?.id]);

  function getNextPlayableSongForCache() {
    if (!playableSongs.length || !currentSong) return null;
    const queuedSong = playQueue.map((songId) => songsById.get(songId)).find(isPlayableSong) ?? null;
    if (queuedSong) return queuedSong;

    if (activePlaylist && activePlaylistSongs.length) {
      const playlistIndex = activePlaylistSongs.findIndex((song) => song.id === currentSong.id);
      if (playlistIndex !== -1) {
        if (isShuffle && activePlaylistSongs.length > 1) {
          return activePlaylistSongs.find((song) => song.id !== currentSong.id) || null;
        }

        const playlistNext = activePlaylistSongs[playlistIndex + 1] || (repeatPlaylist || repeatMode === "all" ? activePlaylistSongs[0] : null);
        return playlistNext ?? null;
      }
    }

    const index = currentIndex();
    if (isShuffle && playableSongs.length > 1) {
      return playableSongs.find((song) => song.id !== currentSong.id) || null;
    }

    const next = playableSongs[index + 1] || (repeatMode === "all" ? playableSongs[0] : null);
    return next ?? null;
  }

  function primeNextAudioCache() {
    if (!settings.gaplessPlayback) return;
    const nextSong = getNextPlayableSongForCache();
    if (!nextSong || !getSongPlaybackSourceKey(nextSong)) return;

    void resolvePlaybackUrl(nextSong).then((result) => {
      if (!result.ok || !result.url || result.fileExists === false) return;

      if (!nextAudioRef.current) {
        nextAudioRef.current = new Audio();
        nextAudioRef.current.preload = "auto";
      }

      if (nextAudioRef.current.src !== result.url) {
        nextAudioRef.current.src = result.url;
        nextAudioRef.current.load();
      }
    });
  }

  function getAutoCrossfadeSeconds() {
    // V342: end-of-song transitions should feel like a real 3 second crossfade.
    // Existing shorter settings are respected for manual fade-in, but auto-next uses at least 3s.
    return clamp(Math.max(3, Number(settings.crossfadeSeconds || 3)), 3, 6);
  }

  function clearCrossfadeHandoffSoon(songId: string, delayMs = 1400) {
    if (crossfadeHandoffClearTimerRef.current !== null) {
      window.clearTimeout(crossfadeHandoffClearTimerRef.current);
      crossfadeHandoffClearTimerRef.current = null;
    }

    crossfadeHandoffClearTimerRef.current = window.setTimeout(() => {
      if (crossfadeHandoffRef.current?.songId === songId) {
        crossfadeHandoffRef.current = null;
      }

      crossfadeHandoffClearTimerRef.current = null;
    }, delayMs);
  }

  function stopCrossfadeAuto() {
    if (crossfadeIntervalRef.current !== null) {
      window.clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }

    if (crossfadeHandoffClearTimerRef.current !== null) {
      window.clearTimeout(crossfadeHandoffClearTimerRef.current);
      crossfadeHandoffClearTimerRef.current = null;
    }

    crossfadeAutoStartedRef.current = false;
    crossfadeAutoTargetRef.current = "";
    crossfadeMainPauseGuardRef.current = false;
    setCrossfadePreviewSongId("");

    const nextAudio = nextAudioRef.current;
    if (nextAudio) {
      try {
        nextAudio.pause();
        nextAudio.currentTime = 0;
        setAudioElementVolume(nextAudio, 0);
      } catch {
        // ignore audio cleanup errors
      }
    }
  }

  function getAutoTransitionTarget() {
    if (!playableSongs.length || !currentSong) return null;

    if (repeatMode === "one") {
      return {
        song: currentSong,
        playlistId: currentPlaybackPlaylist?.id || activePlaylist?.id || null,
        kind: "repeat-one" as const
      };
    }

    const queuedIndex = playQueue.findIndex((songId) => isPlayableSong(songsById.get(songId)));
    if (queuedIndex !== -1) {
      const queuedSong = songsById.get(playQueue[queuedIndex]);
      if (queuedSong) {
        return {
          song: queuedSong,
          playlistId: activePlaylist?.songIds.includes(queuedSong.id) ? activePlaylist.id : null,
          kind: "queue" as const,
          queuedIndex
        };
      }
    }

    if (activePlaylist && currentSong) {
      const playlistIndex = activePlaylistSongs.findIndex((song) => song.id === currentSong.id);

      if (playlistIndex !== -1) {
        if (isShuffle && activePlaylistSongs.length > 1) {
          const { nextSong } = buildShuffleQueue(activePlaylistSongs, currentSong.id);

          if (nextSong) {
            return {
              song: nextSong,
              playlistId: activePlaylist.id,
              kind: "playlist-shuffle" as const
            };
          }
        }

        const playlistNext = activePlaylistSongs[playlistIndex + 1] || (repeatPlaylist || repeatMode === "all" ? activePlaylistSongs[0] : null);

        if (playlistNext && playlistNext.id !== currentSong.id) {
          return {
            song: playlistNext,
            playlistId: activePlaylist.id,
            kind: "playlist" as const,
            playlistIndex: activePlaylistSongs.findIndex((song) => song.id === playlistNext.id)
          };
        }

        return null;
      }
    }

    if (isShuffle && playableSongs.length > 1) {
      const { nextSong } = buildShuffleQueue(playableSongs, currentId);

      if (nextSong) {
        return {
          song: nextSong,
          playlistId: null,
          kind: "library-shuffle" as const
        };
      }
    }

    const index = currentIndex();

    if (index === -1) {
      const firstSong = playableSongs[0];
      return firstSong ? { song: firstSong, playlistId: null, kind: "library" as const } : null;
    }

    const nextSong = playableSongs[index + 1] || (repeatMode === "all" ? playableSongs[0] : null);

    return nextSong
      ? {
          song: nextSong,
          playlistId: null,
          kind: "library" as const
        }
      : null;
  }

  function commitAutoTransitionTarget(target: ReturnType<typeof getAutoTransitionTarget>) {
    if (!target?.song) return;

    if (target.kind === "queue" && typeof target.queuedIndex === "number") {
      setPlayQueue((queue) => queue.slice(target.queuedIndex + 1));
    } else if (playQueue.length && target.kind !== "queue") {
      const hasPlayableQueuedSong = playQueue.some((songId) => isPlayableSong(songsById.get(songId)));
      if (!hasPlayableQueuedSong) setPlayQueue([]);
    }

    if (target.kind === "playlist" && activePlaylist) {
      const nextIndex = activePlaylistSongs.findIndex((song) => song.id === target.song.id);
      setPlayQueue(nextIndex >= 0 ? activePlaylistSongs.slice(nextIndex + 1).map((song) => song.id) : []);
    }

    if (target.playlistId !== undefined) {
      setActivePlaylistId(target.playlistId);
    } else if (activePlaylistId && !target.playlistId) {
      setActivePlaylistId(null);
    }
  }

  async function takeOverMainAudioFromCrossfade(target: ReturnType<typeof getAutoTransitionTarget>, nextAudio: HTMLAudioElement, safeVolume: number) {
    const audio = audioRef.current;
    if (!audio || !target?.song) return;

    const handoffTime = Number.isFinite(nextAudio.currentTime) ? nextAudio.currentTime : 0;
    const handoffUrl = nextAudio.src;

    crossfadeHandoffRef.current = {
      songId: target.song.id,
      url: handoffUrl,
      time: handoffTime,
      volume: safeVolume
    };

    crossfadeMainPauseGuardRef.current = true;

    try {
      if (audio.src !== handoffUrl) {
        audio.src = handoffUrl;
      }

      audio.currentTime = Math.max(0, handoffTime);
      setAudioElementVolume(audio, 0);
      applyPlaybackRateSettings(audio);
      audio.preload = settings.gaplessPlayback ? "auto" : "metadata";
      syncAudioEffectGraph(audio);

      await audio.play();

      commitAutoTransitionTarget(target);

      pendingPlayRef.current = false;
      armPlayCount(target.song.id, Math.max(0, handoffTime));
      setCurrentId(target.song.id);
      setCrossfadePreviewSongId("");
      void rememberCurrentSong(target.song.id);
      setCurrentTime(Math.max(0, handoffTime));
      timeRef.current = Math.max(0, handoffTime);
      setCurrentDuration(target.song.duration || nextAudio.duration || 0);
      setIsPlaying(true);
      setPlayerError("");
      setStatusText(`crossfading into ${prettyTitle(target.song.title, 5)}`);

      const blendMs = 420;
      const blendStart = performance.now();

      window.setTimeout(() => {
        const blendTimer = window.setInterval(() => {
          const progressValue = clamp((performance.now() - blendStart) / blendMs, 0, 1);
          const eased = 1 - Math.pow(1 - progressValue, 2.6);

          setAudioElementVolume(audio, safeVolume * eased);
          setAudioElementVolume(nextAudio, safeVolume * (1 - eased));

          if (progressValue >= 1) {
            window.clearInterval(blendTimer);
            setAudioElementVolume(audio, safeVolume);

            try {
              nextAudio.pause();
              nextAudio.currentTime = 0;
              setAudioElementVolume(nextAudio, 0);
            } catch {
              // ignore cleanup errors
            }

            crossfadeMainPauseGuardRef.current = false;
            clearCrossfadeHandoffSoon(target.song.id, 450);
          }
        }, 16);
      }, 0);
    } catch {
      // Keep the already-playing hidden audio alive briefly so users do not hear a hard stop,
      // then let the normal playback state-sync recover.
      commitAutoTransitionTarget(target);
      setCurrentId(target.song.id);
      setCrossfadePreviewSongId("");
      void rememberCurrentSong(target.song.id);
      setIsPlaying(true);
      crossfadeMainPauseGuardRef.current = false;

      window.setTimeout(() => {
        try {
          nextAudio.pause();
          nextAudio.currentTime = 0;
          setAudioElementVolume(nextAudio, 0);
        } catch {
          // ignore cleanup errors
        }
      }, 950);
    }
  }

  async function startAutoCrossfadeToNext() {
    const audio = audioRef.current;
    const current = songRef.current || currentSong;

    if (
      !audio ||
      !current ||
      !isPlaying ||
      isSeekingRef.current ||
      crossfadeAutoStartedRef.current ||
      performance.now() - crossfadeLastStartAtRef.current < 900 ||
      settings.reducedMotion ||
      !settings.crossfadeEnabled
    ) {
      return;
    }

    const target = getAutoTransitionTarget();
    if (!target?.song || (target.kind !== "repeat-one" && target.song.id === current.id)) return;

    crossfadeAutoStartedRef.current = true;
    crossfadeAutoTargetRef.current = target.song.id;
    crossfadeLastStartAtRef.current = performance.now();

    const playbackUrl = await resolvePlaybackUrl(target.song);

    if (!playbackUrl.ok || !playbackUrl.url || playbackUrl.fileExists === false) {
      crossfadeAutoStartedRef.current = false;
      crossfadeAutoTargetRef.current = "";
      setCrossfadePreviewSongId("");
      try {
        setAudioElementVolume(audio, getTargetAudioVolume(current));
      } catch {
        // ignore volume restore errors
      }
      return;
    }

    if (!nextAudioRef.current) {
      nextAudioRef.current = new Audio();
      nextAudioRef.current.preload = "auto";
      nextAudioRef.current.crossOrigin = "anonymous";
    }

    const nextAudio = nextAudioRef.current;
    const safeVolume = getTargetAudioVolume(target.song);
    const crossfadeMs = getAutoCrossfadeSeconds() * 1000;
    const startVolume = audio.volume || getTargetAudioVolume(current);

    try {
      if (nextAudio.src !== playbackUrl.url) {
        nextAudio.src = playbackUrl.url;
        nextAudio.load();
      }

      setAudioElementVolume(nextAudio, 0);
      applyPlaybackRateSettings(nextAudio);

      await nextAudio.play();

      setCrossfadePreviewSongId(target.song.id);
      stopFade();

      const startTime = performance.now();

      if (crossfadeIntervalRef.current !== null) {
        window.clearInterval(crossfadeIntervalRef.current);
      }

      crossfadeIntervalRef.current = window.setInterval(() => {
        const elapsed = performance.now() - startTime;
        const rawProgress = clamp(elapsed / crossfadeMs, 0, 1);

        // V342 curve:
        // - outgoing track stays full for a tiny moment, then drops faster
        // - incoming track rises slower and smoother so the transition feels musical
        const outgoingHold = 0.16;
        const outgoingProgress = rawProgress <= outgoingHold
          ? 0
          : clamp((rawProgress - outgoingHold) / (1 - outgoingHold), 0, 1);
        const outgoingFactor = 1 - Math.pow(outgoingProgress, 0.72);
        const incomingFactor = Math.pow(rawProgress, 1.48);

        setAudioElementVolume(audio, startVolume * outgoingFactor);
        setAudioElementVolume(nextAudio, safeVolume * incomingFactor);

        if (rawProgress >= 1) {
          if (crossfadeIntervalRef.current !== null) {
            window.clearInterval(crossfadeIntervalRef.current);
            crossfadeIntervalRef.current = null;
          }

          setAudioElementVolume(audio, 0);
          setAudioElementVolume(nextAudio, safeVolume);

          markSongCompletedForPlayCount(current);
          if (current.id) void patchSongLocal(current.id, { playbackPosition: 0 });

          crossfadeAutoStartedRef.current = false;
          crossfadeAutoTargetRef.current = "";

          void takeOverMainAudioFromCrossfade(target, nextAudio, safeVolume);
          window.setTimeout(() => runLocaltifyIdleTask(() => primeNextAudioCache(), 1800), 650);
        }
      }, 16);
    } catch {
      crossfadeAutoStartedRef.current = false;
      crossfadeAutoTargetRef.current = "";
      crossfadeMainPauseGuardRef.current = false;
      setCrossfadePreviewSongId("");
      try {
        setAudioElementVolume(audio, getTargetAudioVolume(current));
      } catch {
        // ignore volume restore errors
      }
      try {
        nextAudio.pause();
        setAudioElementVolume(nextAudio, 0);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  function handleAudioTimeUpdate(event: SyntheticEvent<HTMLAudioElement>) {
    const audio = event.currentTarget;
    const nextTime = audio.currentTime;
    const duration = Number.isFinite(audio.duration) ? audio.duration : durationRef.current || currentDuration || 0;

    timeRef.current = nextTime;
    tickPlayCountTracker(nextTime);

    if (duration > 0) {
      const crossfadeWindow = getAutoCrossfadeSeconds();
      const remaining = duration - nextTime;

      if (
        remaining > 0 &&
        remaining <= crossfadeWindow &&
        nextTime > 5 &&
        !audio.paused &&
        !settings.reducedMotion &&
        settings.crossfadeEnabled
      ) {
        void startAutoCrossfadeToNext();
      }
    }
  }

  function handleAudioPause() {
    if (crossfadeAutoStartedRef.current || crossfadeMainPauseGuardRef.current || crossfadeHandoffRef.current) {
      return;
    }

    if (!audioRef.current?.ended) {
      setIsPlaying(false);
    }
  }

  function handleAudioEnded() {
    if (crossfadeAutoStartedRef.current || crossfadeHandoffRef.current) {
      // The hidden next audio is already taking over. Do not double-skip.
      return;
    }

    const endedSong = songRef.current || currentSong;
    markSongCompletedForPlayCount(endedSong);

    if (endedSong?.id) {
      void patchSongLocal(endedSong.id, { playbackPosition: 0 });
    }

    playNext(true, "auto");
  }

  function stopFade() {
    if (fadeIntervalRef.current !== null) {
      window.clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    if (fadeFrameRef.current !== null) {
      window.cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }
  }

  function stopProgressLoop() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (progressLoopTimeoutRef.current !== null) {
      window.clearTimeout(progressLoopTimeoutRef.current);
      progressLoopTimeoutRef.current = null;
    }
  }

  function fadeAudio(target: number, duration: number, onDone?: () => void) {
    const audio = audioRef.current;
    if (!audio) return;

    stopFade();

    const safeTarget = clamp(Number(target) || 0, 0, 1);
    const safeDuration = Math.max(0, Number(duration) || 0);
    const startVolume = clamp(Number(audio.volume) || 0, 0, 1);
    const delta = safeTarget - startVolume;

    if (safeDuration <= 0 || Math.abs(delta) < 0.002) {
      setAudioElementVolume(audio, safeTarget);
      volumeRef.current = safeTarget;
      if (onDone) onDone();
      return;
    }

    const startTime = performance.now();

    const step = () => {
      const progressValue = clamp((performance.now() - startTime) / safeDuration, 0, 1);
      const eased = 1 - Math.pow(1 - progressValue, 2.2);
      const nextVolume = clamp(startVolume + delta * eased, 0, 1);

      setAudioElementVolume(audio, nextVolume);
      volumeRef.current = nextVolume;

      if (progressValue >= 1) {
        fadeFrameRef.current = null;
        if (onDone) onDone();
        return;
      }

      fadeFrameRef.current = window.requestAnimationFrame(step);
    };

    fadeFrameRef.current = window.requestAnimationFrame(step);
  }

  function getAudioErrorText(audio: HTMLAudioElement | null) {
    const code = audio?.error?.code;

    if (code === 1) return "audio loading was cancelled";
    if (code === 2) return "file loading failed. check if the audio still exists";
    if (code === 3) return "audio file could not decode. it may be corrupted";
    if (code === 4) return "audio stream unavailable. restart localtify, then reimport if it still happens";

    return "audio could not start. try reimporting the file.";
  }

  async function startAudioPlayback(reason = "manual") {
    const audio = audioRef.current;
    const song = songRef.current || currentSong;

    if (!audio || !song) {
      setIsPlaying(false);
      return false;
    }

    if (!getSongPlaybackSourceKey(song) || song.fileExists === false) {
      pendingPlayRef.current = false;
      resetPlayCountTracker();
      setIsPlaying(false);
      setPlayerError("this audio file is missing. reimport it on this pc.");
      setStatusText("file missing");
      return false;
    }

    const playbackUrl = await resolvePlaybackUrl(song);

    if (!playbackUrl.ok || !playbackUrl.url || playbackUrl.fileExists === false) {
      pendingPlayRef.current = false;
      resetPlayCountTracker();
      setIsPlaying(false);
      setPlayerError(playbackUrl.fileExists === false ? "this audio file is missing. reimport it on this pc." : "could not create a playback URL for this song.");
      setStatusText(playbackUrl.fileExists === false ? "file missing" : "playback url failed");
      return false;
    }

    try {
      stopFade();

      const playerController = ensurePlayerController();
      const safeVolume = getTargetAudioVolume(song);

      const handoffActive = crossfadeHandoffRef.current?.songId === song.id;
      const continuingCrossfadePlayback =
        handoffActive ||
        (
          reason === "state-sync" &&
          audio.src === playbackUrl.url &&
          !audio.paused &&
          Number.isFinite(audio.currentTime) &&
          audio.currentTime > 0.05
        );

      setAudioElementVolume(audio, continuingCrossfadePlayback || settings.reducedMotion || !settings.crossfadeEnabled ? safeVolume : 0);
      applyPlaybackRateSettings(audio);
      audio.preload = settings.gaplessPlayback ? "auto" : "metadata";
      syncAudioEffectGraph(audio);
      resumeAudioContextSafely();
      volumeRef.current = safeVolume;

      if (playerController) {
        playerController.load(buildPlayerEngineSource(song, playbackUrl.url));
      } else if (audio.src !== playbackUrl.url) {
        audio.src = playbackUrl.url;
        audio.load();
      }

      pendingPlayRef.current = true;

      await (playerController ? playerController.play() : audio.play());

      pendingPlayRef.current = false;

      if (!continuingCrossfadePlayback && !settings.reducedMotion && settings.crossfadeEnabled && safeVolume > 0) {
        fadeAudio(safeVolume, Math.max(120, Number(settings.crossfadeSeconds || 1.6) * 1000));
      } else {
        setAudioElementVolume(audio, safeVolume);
      }

      if (handoffActive) {
        clearCrossfadeHandoffSoon(song.id, 650);
      }

      window.setTimeout(() => runLocaltifyIdleTask(() => primeNextAudioCache(), 1800), 650);

      setIsPlaying(true);
      setPlayerError("");
      setStatusText(`playing ${prettyTitle(song.title, 5)}`);

      return true;
    } catch {
      pendingPlayRef.current = false;
      resetPlayCountTracker();
      setIsPlaying(false);
      setPlayerError(getAudioErrorText(audio));
      setStatusText(reason === "manual" ? "playback failed" : "audio not ready");

      return false;
    }
  }

  function pauseAudioSmooth() {
    const audio = audioRef.current;
    const playerController = ensurePlayerController();

    pendingPlayRef.current = false;
    stopCrossfadeAuto();

    if (!audio) {
      setIsPlaying(false);
      setStatusText("paused");
      return;
    }

    if (!audio.paused) {
      if (settings.reducedMotion) {
        if (playerController) playerController.pause();
        else audio.pause();
        applyAudioQualitySettings(audio, currentSong);
      } else {
        fadeAudio(0, 120, () => {
          if (playerController) playerController.pause();
          else audio.pause();
          applyAudioQualitySettings(audio, currentSong);
        });
      }
    } else {
      applyAudioQualitySettings(audio, currentSong);
    }

    setStatusText("paused");
  }

  function settingsAreSame(left: Settings, right: Settings) {
    const leftKeys = Object.keys(left || {});
    const rightKeys = Object.keys(right || {});
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => Object.is((left as any)[key], (right as any)[key]));
  }

  function isImmediateSettingsKey(key: string) {
    return [
      "volume",
      "playbackSpeed",
      "crossfadeSeconds",
      "crossfadeEnabled",
      "gaplessPlayback",
      "volumeNormalization",
      "perSongVolumeMemory",
      "sleepTimerMinutes",
      "discordEnabled",
      "discordPrivacyMode",
      "discordButtons",
      "discordArtMode",
      "discordActivityStyle",
      "discordTitleCleanup",
      "discordSecondLine"
    ].includes(key);
  }

  async function saveSettingsSafely(next: Settings, debounce = false) {
    if (!bootedRef.current) return;

    const saveSerial = ++saveSettingsSerialRef.current;

    const runSave = () => {
      if (saveSerial !== saveSettingsSerialRef.current) return;
      window.localitfy.saveSettings(next).catch(() => undefined);
    };

    if (debounce) {
      if (saveSettingsTimerRef.current !== null) {
        window.clearTimeout(saveSettingsTimerRef.current);
      }

      saveSettingsTimerRef.current = window.setTimeout(() => {
        saveSettingsTimerRef.current = null;
        runSave();
      }, 260);
      return;
    }

    await window.localitfy.saveSettings(next).catch(() => undefined);
  }

  async function persistSettings(next: Settings, debounce = false, priority: "immediate" | "transition" = "transition") {
    const previous = settingsRef.current;
    if (settingsAreSame(previous, next)) return;

    const shouldTrackThemeChange =
      bootedRef.current &&
      (previous.theme !== next.theme || previous.customThemeEnabled !== next.customThemeEnabled);
    const shouldTrackDiscordToggle = bootedRef.current && previous.discordEnabled !== next.discordEnabled;

    settingsRef.current = next;

    if (priority === "immediate") {
      setSettings(next);
    } else {
      startTransition(() => setSettings(next));
    }

    if (!bootedRef.current) return;

    if (shouldTrackThemeChange) {
      trackThemeChanged(next.customThemeEnabled ? "custom" : next.theme, next.customThemeEnabled);
    }

    if (shouldTrackDiscordToggle) {
      trackDiscordToggled(next.discordEnabled);
    }

    await saveSettingsSafely(next, debounce);
  }

  async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K], debounce = false) {
    const currentSettings = settingsRef.current;
    const next: Settings = {
      ...currentSettings,
      [key]: value
    };

    if (key === "volume") {
      const safeVolume = clamp(Number(value) || 0, 0, 1);
      next.volume = safeVolume;
      volumeDraftRef.current = Math.round(safeVolume * 100);
      applyLiveVolumePercent(volumeDraftRef.current);
      settingsRef.current = next;
      setSettings(next);

      if (bootedRef.current) {
        if (saveSettingsTimerRef.current !== null) {
          window.clearTimeout(saveSettingsTimerRef.current);
        }

        saveSettingsTimerRef.current = window.setTimeout(() => {
          saveSettingsTimerRef.current = null;
          void saveSettingsSafely(next, false);
        }, debounce ? 420 : 120);
      }

      return;
    }

    if (key === "theme") {
      next.theme = normalizeThemeId(value);
      next.customThemeEnabled = false;
      clearPendingCustomThemeCommit();
      clearCustomThemePreviewStyles();
      kickThemeSettle();
    }

    if (key === "coverColorSyncMode") {
      next.coverColorSyncMode = normalizeCoverColorSyncMode(value);
      next.showAmbientGradient = next.coverColorSyncMode !== "off";
      kickThemeSettle();
    }

    if (key === "showAmbientGradient") {
      next.coverColorSyncMode = value ? "normal" : "off";
      kickThemeSettle();
    }

    if (
      key === "customThemeEnabled" ||
      key === "customThemeColor" ||
      key === "customThemeColor2" ||
      key === "customThemeBackground" ||
      key === "customThemeSurface" ||
      key === "customThemeText" ||
      key === "customThemeHighlight" ||
      key === "customThemeProgress"
    ) {
      if (key === "customThemeEnabled" && value === false) {
        clearPendingCustomThemeCommit();
        clearCustomThemePreviewStyles();
      }

      kickThemeSettle();
    }

    if (
      key === "homeBannerType" ||
      key === "blurEffects" ||
      key === "mediaCardBackground" ||
      key === "homeLayoutMode" ||
      key === "libraryRowStyle" ||
      key === "starsIntensity" ||
      key === "sidebarBehavior" ||
      key === "playerBackgroundStyle" ||
      key === "quickLibraryMoreBlur" ||
      key === "catBuddyEnabled"
    ) {
      kickThemeSettle();
    }

    if (key === "animatedBackgrounds" || key === "animeVisuals") {
      next.animatedBackgrounds = true;
      next.animeVisuals = true;
    }

    if (key === "simpleMode") {
      // Simple Mode was removed in v0.2.8. Do not let old UI/state re-enable it.
      next.simpleMode = false;
    }

    await persistSettings(next, debounce, isImmediateSettingsKey(String(key)) ? "immediate" : "transition");

    if (!debounce && bootedRef.current) {
      if (key === "theme" || key === "customThemeEnabled") {
        showAppToast("Theme changed", "success");
      } else if (String(key).startsWith("discord")) {
        showAppToast("Discord presence updated", "success");
      } else if (key === "autoUpdateEnabled" || key === "autoUpdateNotifyOnly") {
        showAppToast("Settings saved", "success");
      }
    }
  }

  async function updateSettingsPatch(patch: Partial<Settings>, debounce = false) {
    const currentSettings = settingsRef.current;
    const next: Settings = {
      ...currentSettings,
      ...patch
    };

    if (Object.prototype.hasOwnProperty.call(patch, "coverColorSyncMode")) {
      next.coverColorSyncMode = normalizeCoverColorSyncMode(patch.coverColorSyncMode);
      next.showAmbientGradient = next.coverColorSyncMode !== "off";
    } else if (Object.prototype.hasOwnProperty.call(patch, "showAmbientGradient")) {
      next.coverColorSyncMode = patch.showAmbientGradient ? "normal" : "off";
    }

    if (patch.theme) {
      next.theme = normalizeThemeId(patch.theme);
      next.customThemeEnabled = false;
      clearPendingCustomThemeCommit();
      clearCustomThemePreviewStyles();
    }

    if (patch.customThemeEnabled === false) {
      clearPendingCustomThemeCommit();
      clearCustomThemePreviewStyles();
    }

    if (Object.prototype.hasOwnProperty.call(patch, "animatedBackgrounds") || Object.prototype.hasOwnProperty.call(patch, "animeVisuals")) {
      next.animatedBackgrounds = true;
      next.animeVisuals = true;
    }

    if (
      patch.theme ||
      Object.prototype.hasOwnProperty.call(patch, "customThemeEnabled") ||
      Object.prototype.hasOwnProperty.call(patch, "customThemeColor") ||
      Object.prototype.hasOwnProperty.call(patch, "customThemeColor2") ||
      Object.prototype.hasOwnProperty.call(patch, "customThemeBackground") ||
      Object.prototype.hasOwnProperty.call(patch, "customThemeSurface") ||
      Object.prototype.hasOwnProperty.call(patch, "customThemeText") ||
      Object.prototype.hasOwnProperty.call(patch, "customThemeHighlight") ||
      Object.prototype.hasOwnProperty.call(patch, "customThemeProgress")
    ) {
      kickThemeSettle();
    }

    const patchKeys = Object.keys(patch || {});
    const priority = patchKeys.some((key) => isImmediateSettingsKey(key)) ? "immediate" : "transition";
    await persistSettings(next, debounce, priority);
  }

  function resetDiscordSettings() {
    void updateSettingsPatch({
      discordEnabled: defaultSettings.discordEnabled,
      discordShowPausedIdle: defaultSettings.discordShowPausedIdle,
      discordPrivacyMode: defaultSettings.discordPrivacyMode,
      discordButtons: defaultSettings.discordButtons,
      discordArtMode: defaultSettings.discordArtMode,
      discordActivityStyle: defaultSettings.discordActivityStyle,
      discordTitleCleanup: defaultSettings.discordTitleCleanup,
      discordSecondLine: defaultSettings.discordSecondLine
    });
    setStatusText("Discord settings reset");
    showAppToast("Discord settings reset", "success");
  }

  function resetAppearanceSettings() {
    void updateSettingsPatch({
      theme: defaultSettings.theme,
      themePanelCollapsed: defaultSettings.themePanelCollapsed,
      customThemeEnabled: defaultSettings.customThemeEnabled,
      customThemeColor: defaultSettings.customThemeColor,
      customThemeColor2: defaultSettings.customThemeColor2,
      customThemeBackground: defaultSettings.customThemeBackground,
      customThemeSurface: defaultSettings.customThemeSurface,
      customThemeText: defaultSettings.customThemeText,
      customThemeHighlight: defaultSettings.customThemeHighlight,
      customThemeProgress: defaultSettings.customThemeProgress,
      showAmbientGradient: defaultSettings.showAmbientGradient,
      coverColorSyncMode: defaultSettings.coverColorSyncMode,
      showFloatingNotes: defaultSettings.showFloatingNotes,
      homeBannerType: VISUAL_CUSTOMIZATION_DEFAULTS.homeBannerType,
      blurEffects: VISUAL_CUSTOMIZATION_DEFAULTS.blurEffects,
      mediaCardBackground: VISUAL_CUSTOMIZATION_DEFAULTS.mediaCardBackground,
      homeLayoutMode: VISUAL_CUSTOMIZATION_DEFAULTS.homeLayoutMode,
      starsIntensity: VISUAL_CUSTOMIZATION_DEFAULTS.starsIntensity,
      sidebarBehavior: VISUAL_CUSTOMIZATION_DEFAULTS.sidebarBehavior,
      playerBackgroundStyle: VISUAL_CUSTOMIZATION_DEFAULTS.playerBackgroundStyle,
      animeVisuals: true,
      animatedBackgrounds: true,
      gifVisualsMode: defaultSettings.gifVisualsMode,
      animatedGlow: defaultSettings.animatedGlow,
      softCorners: defaultSettings.softCorners,
      reducedMotion: defaultSettings.reducedMotion,
      catBuddyEnabled: defaultSettings.catBuddyEnabled
    });
    setStatusText("appearance reset");
    showAppToast("Appearance reset", "success");
  }

  function resetPlayerLayoutSettings() {
    void updateSettingsPatch({
      playerSize: defaultSettings.playerSize,
      compactPlayer: defaultSettings.compactPlayer,
      showVisualizer: defaultSettings.showVisualizer,
      volume: defaultSettings.volume,
      playbackSpeed: defaultSettings.playbackSpeed
    });
    setStatusText("player layout reset");
    showAppToast("Player layout reset", "success");
  }

  function resetLibraryLayoutSettings() {
    void updateSettingsPatch({
      sidebarWidth: defaultSettings.sidebarWidth,
      showRightColumn: defaultSettings.showRightColumn,
      denseList: defaultSettings.denseList,
      homeExpanded: defaultSettings.homeExpanded,
      heroExpanded: defaultSettings.heroExpanded,
      showHeroBadge: defaultSettings.showHeroBadge
    });
    setStatusText("library layout reset");
    showAppToast("Library layout reset", "success");
  }

  function resetAllSettingsSafely() {
    const confirmed = window.confirm("Reset all localtify settings? Your imported songs will stay in the library.");
    if (!confirmed) return;

    void updateSettingsPatch(defaultSettings);
    setStatusText("all settings reset");
    showAppToast("All settings reset", "success");
  }

  function updateCoverColorSyncMode(mode: CoverColorSyncMode) {
    const safeMode = normalizeCoverColorSyncMode(mode);
    void updateSettingsPatch(
      {
        coverColorSyncMode: safeMode,
        showAmbientGradient: safeMode !== "off"
      },
      true
    );
  }

  function startPlayerResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    const resizeHandle = event.currentTarget;
    const pointerId = event.pointerId;
    const appRoot = appRootRef.current;
    const startY = event.clientY;
    const startSize = clamp(Number(discordSettingsRef.current.playerSize || settings.playerSize || 108), 74, 168);
    let latestSize = startSize;
    let saveDone = false;

    const paintSize = () => {
      playerResizeFrameRef.current = null;
      appRoot?.style.setProperty("--player-size-live", `${latestSize}px`);
    };

    const queuePaint = () => {
      if (playerResizeFrameRef.current !== null) return;
      playerResizeFrameRef.current = window.requestAnimationFrame(paintSize);
    };

    const commitSize = () => {
      if (saveDone) return;
      saveDone = true;

      const nextSettings = {
        ...discordSettingsRef.current,
        playerSize: latestSize
      };

      discordSettingsRef.current = nextSettings;
      setSettings(nextSettings);

      if (bootedRef.current) {
        window.localitfy.saveSettings(nextSettings).catch(() => undefined);
      }

      window.setTimeout(() => {
        appRoot?.style.removeProperty("--player-size-live");
      }, 90);
    };

    const finishResize = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      window.removeEventListener("keydown", handleKeyDown);

      document.body.classList.remove("isResizingPlayer");
      document.body.classList.remove("localitfyNoSelect");

      if (playerResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(playerResizeFrameRef.current);
        playerResizeFrameRef.current = null;
      }

      appRoot?.style.setProperty("--player-size-live", `${latestSize}px`);

      try {
        if (resizeHandle.hasPointerCapture(pointerId)) resizeHandle.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be gone if Windows cancels the drag.
      }

      commitSize();
    };

    const cancelResize = () => {
      latestSize = startSize;
      appRoot?.style.setProperty("--player-size-live", `${startSize}px`);
      finishResize();
    };

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      latestSize = Math.round(clamp(startSize + startY - moveEvent.clientY, 74, 168));
      queuePaint();
    };

    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") cancelResize();
    };

    document.body.classList.add("isResizingPlayer");
    document.body.classList.add("localitfyNoSelect");
    appRoot?.style.setProperty("--player-size-live", `${startSize}px`);

    try {
      resizeHandle.setPointerCapture(pointerId);
    } catch {
      // Safe fallback for older Electron/Chromium edge cases.
    }

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerup", finishResize, { once: true });
    window.addEventListener("pointercancel", finishResize, { once: true });
    window.addEventListener("keydown", handleKeyDown);
  }

  function startSidebarResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    const resizeHandle = event.currentTarget;
    const pointerId = event.pointerId;
    const appRoot = appRootRef.current;
    const startX = event.clientX;
    const startWidth = clamp(Number(discordSettingsRef.current.sidebarWidth || settings.sidebarWidth || 249), 184, 340);
    let latestWidth = startWidth;
    let saveDone = false;

    const paintWidth = () => {
      sidebarResizeFrameRef.current = null;
      appRoot?.style.setProperty("--sidebar-width-live", `${latestWidth}px`);
    };

    const queuePaint = () => {
      if (sidebarResizeFrameRef.current !== null) return;
      sidebarResizeFrameRef.current = window.requestAnimationFrame(paintWidth);
    };

    const commitWidth = () => {
      if (saveDone) return;
      saveDone = true;

      const nextSettings = {
        ...discordSettingsRef.current,
        sidebarWidth: latestWidth
      };

      discordSettingsRef.current = nextSettings;
      setSettings(nextSettings);

      if (bootedRef.current) {
        window.localitfy.saveSettings(nextSettings).catch(() => undefined);
      }

      window.setTimeout(() => {
        appRoot?.style.removeProperty("--sidebar-width-live");
      }, 90);
    };

    const finishResize = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      window.removeEventListener("keydown", handleKeyDown);

      document.body.classList.remove("isResizingSidebar");
      document.body.classList.remove("localitfyNoSelect");

      if (sidebarResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(sidebarResizeFrameRef.current);
        sidebarResizeFrameRef.current = null;
      }

      appRoot?.style.setProperty("--sidebar-width-live", `${latestWidth}px`);

      try {
        if (resizeHandle.hasPointerCapture(pointerId)) resizeHandle.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be gone if Windows cancels the drag.
      }

      commitWidth();
    };

    const cancelResize = () => {
      latestWidth = startWidth;
      appRoot?.style.setProperty("--sidebar-width-live", `${startWidth}px`);
      finishResize();
    };

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      latestWidth = Math.round(clamp(startWidth + moveEvent.clientX - startX, 184, 340));
      queuePaint();
    };

    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") cancelResize();
    };

    document.body.classList.add("isResizingSidebar");
    document.body.classList.add("localitfyNoSelect");
    appRoot?.style.setProperty("--sidebar-width-live", `${startWidth}px`);

    try {
      resizeHandle.setPointerCapture(pointerId);
    } catch {
      // Safe fallback for older Electron/Chromium edge cases.
    }

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerup", finishResize, { once: true });
    window.addEventListener("pointercancel", finishResize, { once: true });
    window.addEventListener("keydown", handleKeyDown);
  }


  async function rememberCurrentSong(id: string) {
    if (!id || !discordSettingsRef.current.rememberLastSong) return;

    latestRememberedSongIdRef.current = id;

    setSettings((previousSettings) => {
      if (!previousSettings.rememberLastSong || previousSettings.lastSongId === id) {
        return previousSettings;
      }

      return {
        ...previousSettings,
        lastSongId: id
      };
    });

    if (!bootedRef.current) return;

    if (rememberCurrentSongTimerRef.current !== null) {
      window.clearTimeout(rememberCurrentSongTimerRef.current);
    }

    rememberCurrentSongTimerRef.current = window.setTimeout(() => {
      rememberCurrentSongTimerRef.current = null;

      const songIdToSave = latestRememberedSongIdRef.current;
      if (!songIdToSave || !discordSettingsRef.current.rememberLastSong) return;

      window.localitfy
        .saveSettings({
          ...discordSettingsRef.current,
          lastSongId: songIdToSave
        })
        .catch(() => undefined);
    }, 420);
  }

  function replaceSong(updated: Song | null) {
    if (!updated) return;

    setSongs((oldSongs) => oldSongs.map((song) => (song.id === updated.id ? updated : song)));

    if (editorSong?.id === updated.id) {
      setEditorSong(updated);
    }
  }

  async function rescanPixelArtFolder() {
    setPixelArtBusy(true);
    setStatusText("rescanning pixel art folder...");
    showAppToast("rescanning pixel art covers...", "work");

    try {
      const runtimeAssets = await loadPixelArtAssets(true);
      setPixelArtAssets(runtimeAssets);
      discordAssetBySongRef.current = {};
      setStatusText(`found ${runtimeAssets.length} pixel art cover${runtimeAssets.length === 1 ? "" : "s"}`);
      showAppToast(`found ${runtimeAssets.length} pixel art cover${runtimeAssets.length === 1 ? "" : "s"}`, "success");
    } catch (error) {
      console.error("[localitfy pixel art rescan error]", error);
      setPixelArtAssets(getCachedRuntimePixelArtAssets());
      setStatusText("pixel art rescan failed, using fallback art");
      showAppToast("pixel art rescan failed safely", "error");
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function applyPixelAssetToSong(song: Song, asset: RuntimePixelArtAsset | null, successMessage = "pixel cover applied", announce = true) {
    if (!song) return null;

    try {
      let updated: Song | null = null;
      const publicCoverUrl = asset?.url || (asset?.file ? pixelArtUrl(asset.file) : "");

      if (asset?.path && window.localitfy.setSongCover) {
        updated = await window.localitfy.setSongCover(song.id, asset.path);
      } else if (publicCoverUrl && window.localitfy.patchSong) {
        updated = await window.localitfy.patchSong(song.id, {
          coverPath: asset?.path || null,
          coverUrl: publicCoverUrl
        });
      } else if (window.localitfy.randomizeSongCover) {
        updated = await window.localitfy.randomizeSongCover(song.id);
      }

      if (updated) {
        replaceSong(updated);
        setStatusText(successMessage);
        if (announce) showAppToast(successMessage, "success");
        return updated;
      }
    } catch (error) {
      console.error("[localitfy cover update error]", error);
    }

    setStatusText("cover update failed");
    if (announce) showAppToast("cover update failed", "error");
    return null;
  }

  async function randomizeCoverForSong(song: Song | null) {
    if (!song || pixelArtBusy) return null;

    setPixelArtBusy(true);
    showAppToast("picking a fresh pixel cover...", "work");
    try {
      const asset = pickBalancedPixelAsset(song, "single");
      return await applyPixelAssetToSong(song, asset, "cover randomized");
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function changeCoverForSongAction(song: Song | null) {
    if (!song) return null;
    setSongContextMenu(null);
    return chooseCoverFromPc(song);
  }

  async function randomizeCoverForSongAction(song: Song | null) {
    if (!song) return null;
    setSongContextMenu(null);
    return randomizeCoverForSong(song);
  }

  async function resetCoverForSongAction(song: Song | null) {
    if (!song || pixelArtBusy) return null;

    setSongContextMenu(null);
    setPixelArtBusy(true);
    setStatusText("resetting cover...");
    showAppToast("resetting cover...", "work");

    const optimistic = { ...song, coverPath: null, savedCoverPath: "", savedCoverExists: false, usesFallbackCover: true, missingSavedCover: true, coverUrl: null, coverThumbUrl: null, coverThumbnailUrl: null, thumbnailUrl: null };
    replaceSong(optimistic as Song);

    try {
      const updated = await window.localitfy.patchSong(song.id, { coverPath: null, coverUrl: null });
      if (updated) replaceSong(updated);
      setStatusText("cover reset to default");
      showAppToast("cover reset to default", "success");
      return updated || optimistic;
    } catch (error) {
      console.error("[localitfy reset cover error]", error);
      replaceSong(song);
      setStatusText("cover reset failed");
      showAppToast("cover reset failed", "error");
      return null;
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function randomizeMissingCoversAction() {
    if (pixelArtBusy) return;

    setPixelArtBusy(true);
    setStatusText("randomizing missing covers...");
    showAppToast("randomizing missing covers...", "work");

    try {
      const updatedSongs = await window.localitfy.randomizeMissingSongCovers?.();
      if (Array.isArray(updatedSongs)) {
        setSongs(applyLibraryOrder(sanitizeSongList(updatedSongs)));
      }

      const changedCount = Array.isArray(updatedSongs) ? Math.max(0, missingCoverSongs.length) : 0;
      setStatusText(changedCount ? `fixed ${changedCount} missing cover${changedCount === 1 ? "" : "s"}` : "missing cover scan complete");
      showAppToast(changedCount ? `fixed ${changedCount} missing cover${changedCount === 1 ? "" : "s"}` : "missing cover scan complete", changedCount ? "success" : "info");
    } catch (error) {
      console.error("[localitfy missing cover randomize error]", error);
      setStatusText("missing cover fix failed");
      showAppToast("missing cover fix failed", "error");
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function cleanupCoverCacheAction() {
    if (pixelArtBusy) return;

    setPixelArtBusy(true);
    setStatusText("cleaning cover cache...");
    showAppToast("cleaning cover cache...", "work");

    try {
      const result = await window.localitfy.cleanupCoverCache?.();
      const removed = Number(result?.removed || 0);
      const message = removed
        ? `cleaned ${removed} cached cover thumbnail${removed === 1 ? "" : "s"}`
        : "cover cache already clean";

      setStatusText(message);
      showAppToast(message, removed ? "success" : "info");
    } catch (error) {
      console.error("[localitfy cover cache cleanup error]", error);
      setStatusText("cover cache cleanup failed");
      showAppToast("cover cache cleanup failed", "error");
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function chooseCoverFromPc(song: Song | null) {
    if (!song || pixelArtBusy) return null;

    setPixelArtBusy(true);
    showAppToast("opening cover picker...", "work");
    try {
      const updated = await window.localitfy.pickSongCover(song.id);
      replaceSong(updated);
      setStatusText(updated ? "cover updated" : "cover unchanged");
      showAppToast(updated ? "cover updated" : "cover unchanged", updated ? "success" : "info");
      return updated;
    } catch (error) {
      console.error("[localitfy pick cover error]", error);
      setStatusText("cover update failed");
      showAppToast("cover update failed", "error");
      return null;
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function randomizeAllCovers() {
    if (!songs.length || pixelArtBusy) return;

    setPixelArtBusy(true);
    setStatusText("randomizing all pixel covers...");
    showAppToast("randomizing pixel covers...", "work");

    try {
      let freshPixelArtPool = pixelArtPool.filter((asset) => !excludedPixelCoverKeySet.has(getPixelArtUsageKey(asset)));

      if (!freshPixelArtPool.length) {
        const runtimeAssets = await loadPixelArtAssets(false);
        freshPixelArtPool = runtimeAssets.filter((asset) => !excludedPixelCoverKeySet.has(getPixelArtUsageKey(asset)));
        setPixelArtAssets(runtimeAssets);
      }

      if (!freshPixelArtPool.length) {
        freshPixelArtPool = getCachedRuntimePixelArtAssets();
        setPixelArtAssets(freshPixelArtPool);
      }

      if (!freshPixelArtPool.length) {
        setStatusText("no pixel art found");
        showAppToast("add images to the pixelart folder first", "error");
        return;
      }

      const nextSongs = [...songs];
      const usage = new Map<string, number>();
      let changedCount = 0;

      for (const song of songs) {
        const asset = pickBalancedPixelAsset(song, `all-${changedCount}`, usage, freshPixelArtPool);
        let updated: Song | null = null;

        const publicCoverUrl = asset?.url || (asset?.file ? pixelArtUrl(asset.file) : "");

        if (asset?.path && window.localitfy.setSongCover) {
          updated = await window.localitfy.setSongCover(song.id, asset.path);
        } else if (publicCoverUrl && window.localitfy.patchSong) {
          updated = await window.localitfy.patchSong(song.id, {
            coverPath: asset?.path || null,
            coverUrl: publicCoverUrl
          });
        } else if (window.localitfy.randomizeSongCover) {
          updated = await window.localitfy.randomizeSongCover(song.id);
        }

        const finalSong = updated || (asset
          ? {
              ...song,
              coverPath: asset.path || null,
              coverUrl: publicCoverUrl || song.coverUrl
            }
          : null);

        if (finalSong) {
          const index = nextSongs.findIndex((candidate) => candidate.id === finalSong.id);
          if (index !== -1) nextSongs[index] = finalSong;
          const key = asset ? getPixelArtUsageKey(asset) : finalSong.coverPath || finalSong.coverUrl || finalSong.id;
          usage.set(key, (usage.get(key) || 0) + 1);
          changedCount += 1;
        }
      }

      setSongs(nextSongs);
      if (editorSong) {
        const refreshedEditorSong = nextSongs.find((song) => song.id === editorSong.id) || editorSong;
        setEditorSong(refreshedEditorSong);
      }
      setStatusText(changedCount ? `randomized ${changedCount} cover${changedCount === 1 ? "" : "s"}` : "no covers changed");
      showAppToast(changedCount ? `randomized ${changedCount} cover${changedCount === 1 ? "" : "s"}` : "no covers changed", changedCount ? "success" : "info");
    } catch (error) {
      console.error("[localitfy randomize all covers error]", error);
      setStatusText("randomize all covers failed");
      showAppToast("randomize all covers failed", "error");
    } finally {
      setPixelArtBusy(false);
    }
  }

  function togglePixelCoverFavorite(key: string) {
    if (!key) return;

    setFavoritePixelCoverKeys((oldKeys) => {
      const set = new Set(oldKeys);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return [...set];
    });
  }

  function togglePixelCoverExcluded(key: string) {
    if (!key) return;

    setExcludedPixelCoverKeys((oldKeys) => {
      const set = new Set(oldKeys);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return [...set];
    });
  }

  function toggleCoverSongSelection(songId: string) {
    setCoverSelectedSongIds((oldIds) => {
      if (oldIds.includes(songId)) return oldIds.filter((id) => id !== songId);
      return [...oldIds, songId];
    });
  }

  function selectCurrentSongForCovers() {
    if (!currentSong) {
      showAppToast("play or select a song first", "info");
      return;
    }

    setCoverSelectedSongIds([currentSong.id]);
    showAppToast("selected current song", "success");
  }

  function selectVisibleSongsForCovers() {
    const nextIds = coverPickerSongList.map((song) => song.id);
    setCoverSelectedSongIds(nextIds);
    showAppToast(nextIds.length ? `selected ${nextIds.length} song${nextIds.length === 1 ? "" : "s"}` : "nothing to select", nextIds.length ? "success" : "info");
  }

  function getPixelArtPoolForMood(mood: CoverMood) {
    const candidates = coverGalleryAssets.filter((entry) => {
      if (entry.excluded) return false;
      if (mood === "all") return true;
      if (mood === "favorites") return entry.favorite;
      if (mood === "leastUsed") return true;
      return entry.tags.includes(mood);
    });

    const sorted = [...candidates].sort((a, b) => {
      if (mood === "leastUsed") return a.usage - b.usage || a.asset.label.localeCompare(b.asset.label);
      return a.usage - b.usage || a.asset.label.localeCompare(b.asset.label);
    });

    return sorted.map((entry) => entry.asset);
  }

  async function applyPixelAssetToSongs(targetSongs: Song[], asset: RuntimePixelArtAsset | null, finalMessage: string) {
    if (!targetSongs.length || !asset || pixelArtBusy) return;

    setPixelArtBusy(true);
    setStatusText(finalMessage);
    showAppToast(finalMessage, "work");

    try {
      let changedCount = 0;

      for (const song of targetSongs) {
        const updated = await applyPixelAssetToSong(song, asset, finalMessage, false);
        if (updated) changedCount += 1;
      }

      setStatusText(changedCount ? `updated ${changedCount} cover${changedCount === 1 ? "" : "s"}` : "no covers changed");
      showAppToast(changedCount ? `updated ${changedCount} cover${changedCount === 1 ? "" : "s"}` : "no covers changed", changedCount ? "success" : "info");
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function applyCoverAssetToSelection(asset: RuntimePixelArtAsset) {
    const targetSongs = selectedCoverSongs.length ? selectedCoverSongs : currentSong ? [currentSong] : [];

    if (!targetSongs.length) {
      showAppToast("select a song first", "info");
      return;
    }

    await applyPixelAssetToSongs(targetSongs, asset, `applying ${asset.label}`);
  }

  async function randomizeSelectedCovers(mood: CoverMood = coverGalleryMood) {
    const targetSongs = selectedCoverSongs.length ? selectedCoverSongs : currentSong ? [currentSong] : [];

    if (!targetSongs.length) {
      showAppToast("select songs first", "info");
      return;
    }

    const sourcePool = getPixelArtPoolForMood(mood);

    if (!sourcePool.length) {
      showAppToast(`no ${coverMoodName(mood)} covers ready`, "error");
      return;
    }

    setPixelArtBusy(true);
    setStatusText(`randomizing ${targetSongs.length} selected cover${targetSongs.length === 1 ? "" : "s"}...`);
    showAppToast(`randomizing ${coverMoodName(mood)} covers...`, "work");

    try {
      const usage = new Map<string, number>(pixelArtUsageMap);
      const nextSongs = [...songs];
      let changedCount = 0;

      for (const song of targetSongs) {
        const asset = pickBalancedPixelAsset(song, `${mood}-${changedCount}`, usage, sourcePool);
        if (!asset) continue;

        let updated: Song | null = null;
        const publicCoverUrl = asset.url || (asset.file ? pixelArtUrl(asset.file) : "");

        if (asset.path && window.localitfy.setSongCover) {
          updated = await window.localitfy.setSongCover(song.id, asset.path);
        } else if (publicCoverUrl && window.localitfy.patchSong) {
          updated = await window.localitfy.patchSong(song.id, {
            coverPath: asset.path || null,
            coverUrl: publicCoverUrl
          });
        } else if (window.localitfy.randomizeSongCover) {
          updated = await window.localitfy.randomizeSongCover(song.id);
        }

        const finalSong = updated || (asset
          ? {
              ...song,
              coverPath: asset.path || null,
              coverUrl: publicCoverUrl || song.coverUrl
            }
          : null);

        if (finalSong) {
          const index = nextSongs.findIndex((candidate) => candidate.id === finalSong.id);
          if (index !== -1) nextSongs[index] = finalSong;
          const key = getPixelArtUsageKey(asset);
          usage.set(key, (usage.get(key) || 0) + 1);
          if (asset.url) usage.set(asset.url, (usage.get(asset.url) || 0) + 1);
          if (asset.path) usage.set(asset.path, (usage.get(asset.path) || 0) + 1);
          changedCount += 1;
        }
      }

      setSongs(nextSongs);
      if (editorSong) setEditorSong(nextSongs.find((song) => song.id === editorSong.id) || editorSong);
      setStatusText(changedCount ? `randomized ${changedCount} selected cover${changedCount === 1 ? "" : "s"}` : "no covers changed");
      showAppToast(changedCount ? `randomized ${changedCount} selected cover${changedCount === 1 ? "" : "s"}` : "no covers changed", changedCount ? "success" : "info");
    } catch (error) {
      console.error("[localitfy selected cover randomize error]", error);
      setStatusText("selected cover randomize failed");
      showAppToast("selected cover randomize failed", "error");
    } finally {
      setPixelArtBusy(false);
    }
  }

  function openCoversViewWithCurrentSong() {
    if (currentSong && !coverSelectedSongIds.includes(currentSong.id)) {
      setCoverSelectedSongIds([currentSong.id]);
    }

    changeView("covers", "unknown");
  }

  async function patchSongLocal(id: string, patch: Partial<Song>) {
    if (Object.prototype.hasOwnProperty.call(patch, "filePath") || Object.prototype.hasOwnProperty.call(patch, "url")) {
      const cachedSong = songsById.get(id);
      const cacheKey = getSongPlaybackSourceKey(cachedSong);
      if (cacheKey) playbackUrlCacheRef.current.delete(cacheKey);
    }

    setSongs((oldSongs) => oldSongs.map((song) => (song.id === id ? { ...song, ...patch } : song)));

    try {
      const updated = await window.localitfy.patchSong(id, patch);
      replaceSong(updated);
    } catch {
      // optimistic update stays
    }
  }


  function buildMetadataCleanPreview(scope: "all" | "selected" = "all") {
    const selectedIds = new Set(coverSelectedSongIds);
    const targetSongs = scope === "selected" && selectedIds.size
      ? songs.filter((song) => selectedIds.has(song.id))
      : songs;

    const items = targetSongs.map((song) => {
      const patch = getMetadataRepairPatch(song);
      const fields = Object.keys(patch).filter((key) => key !== "playbackPosition");

      return {
        id: song.id,
        song,
        before: {
          title: song.title,
          artist: song.artist,
          album: song.album
        },
        after: {
          title: patch.title ?? song.title,
          artist: patch.artist ?? song.artist,
          album: patch.album ?? song.album
        },
        patch,
        fields
      };
    });

    const changedItems = items.filter((item) => Object.keys(item.patch).length > 0);
    const titleFixCount = changedItems.filter((item) => Object.prototype.hasOwnProperty.call(item.patch, "title")).length;
    const artistFixCount = changedItems.filter((item) => Object.prototype.hasOwnProperty.call(item.patch, "artist")).length;
    const albumFixCount = changedItems.filter((item) => Object.prototype.hasOwnProperty.call(item.patch, "album")).length;

    return {
      id: Date.now(),
      scope,
      totalCount: targetSongs.length,
      changedCount: changedItems.length,
      skippedCount: Math.max(0, targetSongs.length - changedItems.length),
      titleFixCount,
      artistFixCount,
      albumFixCount,
      items: changedItems
    };
  }

  function openMetadataCleanPreview(scope: "all" | "selected" = "all") {
    if (!songs.length || libraryScanBusy) return;

    if (scope === "selected" && !coverSelectedSongIds.length) {
      showAppToast("select songs in cover studio first", "info");
      setLibraryScanMessage("select songs in cover studio first");
      return;
    }

    const preview = buildMetadataCleanPreview(scope);
    setMetadataCleanPreview(preview);

    if (!preview.changedCount) {
      const message = preview.totalCount ? "song names already look clean" : "no songs to clean";
      setLibraryScanMessage(`${message} • skipped ${preview.skippedCount}`);
      setStatusText(message);
      showAppToast(message, "success");
      return;
    }

    setLibraryScanMessage(
      `preview ready • ${preview.changedCount} fix${preview.changedCount === 1 ? "" : "es"} • ${preview.skippedCount} skipped`
    );
    setStatusText("metadata preview ready");
    showAppToast(`preview ready: ${preview.changedCount} fix${preview.changedCount === 1 ? "" : "es"}`, "info");
  }

  function cleanLibraryMetadataAction() {
    openMetadataCleanPreview("all");
  }

  function cleanSelectedMetadataAction() {
    openMetadataCleanPreview("selected");
  }

  function cancelMetadataCleanPreviewAction() {
    setMetadataCleanPreview(null);
    setLibraryScanMessage("metadata clean preview cancelled");
    setStatusText("metadata clean preview cancelled");
  }

  async function applyMetadataCleanPreviewAction() {
    const preview = metadataCleanPreview;
    if (!preview || !preview.items?.length || libraryScanBusy) return;

    setLibraryScanBusy(true);
    setPlayerError("");
    setStatusText("saving metadata fixes...");
    showAppToast("saving metadata fixes...", "work");
    setLibraryScanMessage(`saving ${preview.changedCount} metadata fix${preview.changedCount === 1 ? "" : "es"}...`);

    try {
      const repairs = preview.items;
      const patchById = new Map(repairs.map((item: any) => [item.id, item.patch]));
      const undoItems = repairs.map((item: any) => ({
        id: item.id,
        patch: {
          title: item.before.title,
          artist: item.before.artist,
          album: item.before.album
        }
      }));

      const optimisticSongs = songs.map((song) => {
        const patch = patchById.get(song.id);
        return patch ? { ...song, ...patch } : song;
      });

      const indexed = applyLibraryOrder(sanitizeSongList(optimisticSongs));
      setSongs(indexed);

      const chunkSize = 12;
      for (let index = 0; index < repairs.length; index += chunkSize) {
        const chunk = repairs.slice(index, index + chunkSize);
        await Promise.allSettled(
          chunk.map((item: any) => window.localitfy.patchSong(item.id, item.patch))
        );

        setLibraryScanMessage(`saved ${Math.min(index + chunk.length, repairs.length)}/${repairs.length} metadata fixes...`);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }

      setMetadataUndoItems(undoItems);
      setMetadataCleanPreview(null);
      setLibraryScanMessage(
        `cleaned ${preview.changedCount} • titles ${preview.titleFixCount} • artists ${preview.artistFixCount} • albums ${preview.albumFixCount} • skipped ${preview.skippedCount}`
      );
      setStatusText(`cleaned ${preview.changedCount} song metadata fix${preview.changedCount === 1 ? "" : "es"}`);
      showAppToast(
        `cleaned ${preview.changedCount} • ${preview.skippedCount} skipped`,
        "success"
      );
    } catch (error) {
      console.error("[localitfy metadata cleaner apply error]", error);
      setPlayerError("metadata cleaner failed. your library was not deleted.");
      setStatusText("metadata cleaner failed");
      setLibraryScanMessage("cleaner failed safely");
      showAppToast("metadata cleaner failed safely", "error");
    } finally {
      setLibraryScanBusy(false);
    }
  }

  async function undoLastMetadataCleanAction() {
    if (!metadataUndoItems.length || libraryScanBusy) return;

    setLibraryScanBusy(true);
    setPlayerError("");
    setStatusText("undoing metadata clean...");
    showAppToast("undoing metadata clean...", "work");
    setLibraryScanMessage(`undoing ${metadataUndoItems.length} metadata fix${metadataUndoItems.length === 1 ? "" : "es"}...`);

    try {
      const patchById = new Map(metadataUndoItems.map((item) => [item.id, item.patch]));
      const restoredSongs = songs.map((song) => {
        const patch = patchById.get(song.id);
        return patch ? { ...song, ...patch } : song;
      });

      setSongs(applyLibraryOrder(sanitizeSongList(restoredSongs)));

      const chunkSize = 12;
      for (let index = 0; index < metadataUndoItems.length; index += chunkSize) {
        const chunk = metadataUndoItems.slice(index, index + chunkSize);
        await Promise.allSettled(
          chunk.map((item) => window.localitfy.patchSong(item.id, item.patch))
        );
        setLibraryScanMessage(`restored ${Math.min(index + chunk.length, metadataUndoItems.length)}/${metadataUndoItems.length} songs...`);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }

      const restoredCount = metadataUndoItems.length;
      setMetadataUndoItems([]);
      setLibraryScanMessage(`undid metadata clean • restored ${restoredCount} song${restoredCount === 1 ? "" : "s"}`);
      setStatusText("metadata clean undone");
      showAppToast("metadata clean undone", "success");
    } catch (error) {
      console.error("[localitfy metadata undo error]", error);
      setStatusText("metadata undo failed");
      setLibraryScanMessage("metadata undo failed safely");
      showAppToast("metadata undo failed", "error");
    } finally {
      setLibraryScanBusy(false);
    }
  }

  function rebuildSearchIndexAction() {
    const repairedSongs = applyLibraryOrder(sanitizeSongList(songs));
    setSongs(repairedSongs);
    setLibraryScanMessage(`search rebuilt • ${repairedSongs.length} tracks indexed`);
    setStatusText("fast search index rebuilt");
    showAppToast(`search rebuilt • ${repairedSongs.length} tracks`, "success");
  }

  function getShuffleRandomIndex(maxExclusive: number) {
    const safeMax = Math.max(0, Math.floor(maxExclusive));

    if (safeMax <= 1) return 0;

    try {
      const values = new Uint32Array(1);
      window.crypto?.getRandomValues(values);
      return values[0] % safeMax;
    } catch {
      return Math.floor(Math.random() * safeMax);
    }
  }

  function makeShuffledPlayableSongs(sourceSongs: Song[], avoidFirstSongId = "") {
    const seenSongIds = new Set<string>();
    const shuffled = sourceSongs.filter(isPlayableSong).filter((song) => {
      if (seenSongIds.has(song.id)) return false;
      seenSongIds.add(song.id);
      return true;
    });

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = getShuffleRandomIndex(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    if (avoidFirstSongId && shuffled.length > 1 && shuffled[0]?.id === avoidFirstSongId) {
      const swapIndex = shuffled.findIndex((song, index) => index > 0 && song.id !== avoidFirstSongId);
      if (swapIndex > 0) {
        [shuffled[0], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[0]];
      }
    }

    return shuffled;
  }

  function buildShuffleQueue(sourceSongs: Song[], avoidFirstSongId = "") {
    const shuffled = makeShuffledPlayableSongs(sourceSongs, avoidFirstSongId);
    const [nextSong, ...queuedSongs] = shuffled;

    return {
      shuffled,
      nextSong: nextSong || null,
      queuedSongIds: queuedSongs.map((song) => song.id)
    };
  }

  async function shuffleLibrarySongsAction() {
    const { shuffled, nextSong, queuedSongIds } = buildShuffleQueue(playableSongs, currentId);

    if (!nextSong || shuffled.length < 2) {
      setStatusText("add more playable songs before shuffling");
      showAppToast("add more playable songs before shuffling", "info");
      return;
    }

    setIsShuffle(true);
    setActivePlaylistId(null);
    setSelectedPlaylistId(null);
    setQueueHistory([]);
    setPlayQueue(queuedSongIds);

    await selectSong(nextSong.id, true, { playlistId: null });

    setLibraryScanMessage(`library shuffle ready · ${queuedSongIds.length} queued`);
    setStatusText(`shuffling library · ${shuffled.length} songs`);
    showAppToast(`shuffling library · ${shuffled.length} songs`, "success");
  }

  async function importSongs() {
    const beforeCount = songs.length;
    const previousSongIds = new Set<string>(songs.map((song) => song.id));
    const previousSongSources = new Set<string>(songs.map(stableSongSourceKey).filter((source): source is string => Boolean(source)));

    if (importOverlayTimerRef.current) {
      window.clearTimeout(importOverlayTimerRef.current);
      importOverlayTimerRef.current = null;
    }

    setPlayerError("");
    setLibraryScanBusy(true);
    setStatusText("opening file picker...");
    setLibraryScanMessage("waiting for files... localtify will index them safely");
    setImportAnimation(
      createImportAnimationState({
        active: true,
        phase: "picking",
        message: "waiting for your local files...",
        count: 0,
        total: Math.max(1, songs.length),
        preview: songs.slice(0, 10)
      })
    );
    showAppToast("scanning local music...", "work");

    try {
      setImportAnimation((current) =>
        createImportAnimationState({
          ...current,
          active: true,
          phase: "scanning",
          message: "reading titles, covers, folders, and metadata...",
          total: Math.max(1, songs.length)
        })
      );

      const rawImported = applyLibraryOrder(sanitizeSongList(await window.localitfy.importSongs()));
      const { songs: imported, changedSongs } = maybeApplyCoderpixelArtist(
        rawImported,
        previousSongIds,
        previousSongSources
      );

      playbackUrlCacheRef.current.clear();
      playbackUrlPendingRef.current.clear();
      setSongs(imported);
      setLibraryScanMessage(`indexed ${imported.length} tracks • search, folders, and metadata ready`);

      if (changedSongs.length > 0) {
        void Promise.allSettled(
          changedSongs.map((song) =>
            window.localitfy.patchSong(song.id, { artist: CODERPIXEL_ARTIST_EASTER_EGG })
          )
        ).catch(() => undefined);
      }

      const pickedSong =
        imported.find((song) => song.id === currentId) ||
        imported[beforeCount] ||
        imported[0] ||
        null;

      if (pickedSong && (!currentId || !imported.some((song) => song.id === currentId))) {
        setCurrentId(pickedSong.id);
        await rememberCurrentSong(pickedSong.id);
      }

      const importedNewSongs = imported.filter((song) => {
        const sourceKey = stableSongSourceKey(song);
        return !previousSongIds.has(song.id) && (!sourceKey || !previousSongSources.has(sourceKey));
      });
      const addedCount = importedNewSongs.length;
      const previewSongs = (importedNewSongs.length ? importedNewSongs : imported.slice(-12)).slice(0, 12);

      if (addedCount > 0) {
        trackSongsImported(addedCount, "import_dialog");
        setImportAnimation(
          createImportAnimationState({
            active: true,
            phase: "success",
            message: `found ${addedCount} new song${addedCount === 1 ? "" : "s"}`,
            count: addedCount,
            total: imported.length,
            preview: previewSongs
          })
        );
        setStatusText(`imported ${addedCount} new song${addedCount === 1 ? "" : "s"}`);
        showAppToast(`imported ${addedCount} new song${addedCount === 1 ? "" : "s"}`, "success");
        changeView("library", "unknown");
        hideImportAnimation(1500);
      } else if (imported.length > 0) {
        setImportAnimation(
          createImportAnimationState({
            active: true,
            phase: "success",
            message: "library checked — no duplicates added",
            count: 0,
            total: imported.length,
            preview: previewSongs
          })
        );
        setStatusText("no new songs added, maybe they were already imported");
        showAppToast("no new songs added", "info");
        hideImportAnimation(1200);
      } else {
        setImportAnimation(
          createImportAnimationState({
            active: true,
            phase: "success",
            message: "no songs imported",
            count: 0,
            total: 0,
            preview: []
          })
        );
        setStatusText("no songs imported");
        showAppToast("no songs imported", "info");
        hideImportAnimation(950);
      }
    } catch (error) {
      console.error("[localitfy import failed]", error);
      trackImportFailed("import_dialog_failed", "import_dialog");
      setImportAnimation(
        createImportAnimationState({
          active: true,
          phase: "error",
          message: "import failed safely — your library was not deleted",
          count: 0,
          total: songs.length,
          preview: songs.slice(0, 8)
        })
      );
      setPlayerError("import failed. check the terminal for the real error.");
      setStatusText("import failed");
      showAppToast("import failed safely", "error");
      hideImportAnimation(1700);
    } finally {
      setLibraryScanBusy(false);
    }
  }

  function parseDownloadUrls(text: string) {
    return text
      .split(/\r?\n|,/) 
      .map((url) => url.trim())
      .filter(Boolean);
  }

  function makeQueuedDownloads(urls: string[]): DownloadQueueItem[] {
    return urls.map((url, index) => ({
      id: `${Date.now()}-${index}`,
      url,
      title: `download ${index + 1}`,
      source: "youtube",
      status: "queued",
      progress: 0,
      message: "Queued..."
    }));
  }

  function friendlyDownloadError(error: unknown, fallback = "Download failed. Try again or check the link.") {
    const raw = String(error || "").trim();
    const lowerMessage = raw.toLowerCase();

    if (!raw) return fallback;
    if (/invalid url|unsupported url|not a url|url/i.test(lowerMessage) && /invalid|unsupported|malformed|empty/.test(lowerMessage)) {
      return "Invalid URL. Paste a normal YouTube/Spotify link and retry.";
    }
    if (/yt-dlp|ytdlp|youtube-dl|no such file|not installed|spawn/.test(lowerMessage)) {
      return "yt-dlp could not run. Check the bundled downloader setup, then retry.";
    }
    if (/eacces|eperm|permission|access denied|forbidden|403|folder|directory|write|readonly|read-only/.test(lowerMessage)) {
      return "Permission or folder error. Choose a writable downloads folder and retry.";
    }
    if (/private|unavailable|not available|members-only|login|required|age restricted|sign in/.test(lowerMessage)) {
      return "This source looks private or unavailable. Try a public link.";
    }
    if (/copyright|blocked|restricted|region|geo/.test(lowerMessage)) {
      return "This source is blocked or region restricted.";
    }
    if (/network|timeout|timed out|socket|econn|dns|connection|internet|fetch failed/.test(lowerMessage)) {
      return "Network problem while downloading. Check your connection and retry.";
    }
    if (/rate|429|too many|captcha|bot/.test(lowerMessage)) {
      return "The source rate-limited or blocked the request. Wait a bit, then retry.";
    }
    if (/ffmpeg|convert|conversion/.test(lowerMessage)) {
      return "Downloaded, but conversion failed. Check FFmpeg/download setup.";
    }
    if (/no audio|audio only|format|no formats|requested format|unable to extract|extractor/.test(lowerMessage)) {
      return "No usable audio was found for this link.";
    }

    return raw.length > 170 ? `${raw.slice(0, 167)}...` : raw;
  }

  function findDownloadedSongMatch(result: DownloadResult, librarySongs: Song[]) {
    const filePath = String(result.filePath || "").trim().toLowerCase();
    const filename = String(result.filename || "").trim().toLowerCase();
    const spotifyTrackId = String((result as any).spotifyTrackId || "").trim();

    if (spotifyTrackId) {
      const exactSpotify = librarySongs.find((song) => String((song as any).sourceTrackId || "").trim() === spotifyTrackId);
      if (exactSpotify) return exactSpotify;
    }

    if (filePath) {
      const exact = librarySongs.find((song) => String(song.filePath || "").trim().toLowerCase() === filePath);
      if (exact) return exact;
    }

    if (filename) {
      return librarySongs.find((song) => {
        const songPath = String(song.filePath || "").trim().toLowerCase();
        return songPath.endsWith(filename);
      }) || null;
    }

    return null;
  }

  function enrichDownloadResultsWithLibraryMatches(results: DownloadResult[], librarySongs: Song[]) {
    return results.map((result) => {
      const match = result.ok ? findDownloadedSongMatch(result, librarySongs) : null;
      const importedToLibrary = Boolean(match);
      const cleanedError = result.ok ? "" : friendlyDownloadError(result.error || result.url || "Download failed.");

      return {
        ...result,
        importedToLibrary,
        librarySongId: match?.id || "",
        error: cleanedError || result.error,
        statusLabel: result.ok
          ? importedToLibrary
            ? "Added to library"
            : "Downloaded, not imported"
          : "Failed — retry available"
      };
    });
  }

  function syncDownloadFilesToQueue(results: DownloadResult[], librarySongs: Song[] = songs) {
    if (!results.length) return;

    const enrichedResults = enrichDownloadResultsWithLibraryMatches(results, librarySongs);

    setDownloadQueue((current) => {
      const next = [...current];
      enrichedResults.forEach((result) => {
        const resultSpotifyTrackId = String((result as any).spotifyTrackId || "").trim();
        const index = next.findIndex((item) =>
          (resultSpotifyTrackId && String((item as any).spotifyTrackId || "").trim() === resultSpotifyTrackId) ||
          item.url === result.url ||
          (result.filename && item.filename === result.filename) ||
          (result.filePath && item.filePath === result.filePath)
        );

        if (index === -1) return;

        next[index] = {
          ...next[index],
          status: result.ok ? "done" : "failed",
          progress: 100,
          message: result.ok
            ? result.importedToLibrary
              ? "Added to library"
              : "Downloaded, but not imported"
            : friendlyDownloadError(result.error || "Download failed."),
          filePath: result.filePath,
          filename: result.filename,
          error: result.ok ? "" : friendlyDownloadError(result.error || "Download failed."),
          importedToLibrary: result.importedToLibrary,
          librarySongId: result.librarySongId,
          statusLabel: result.statusLabel,
          spotifyTrackId: (result as any).spotifyTrackId || (next[index] as any).spotifyTrackId,
          spotifyUrl: (result as any).spotifyUrl || (next[index] as any).spotifyUrl,
          providerUrl: (result as any).providerUrl || (next[index] as any).providerUrl,
          matchScore: (result as any).matchScore,
          title: result.filename || next[index].title
        };
      });
      return next;
    });
  }

  function clearFailedDownloads() {
    setDownloadQueue((items) => items.filter((item) => item.status !== "failed" && item.status !== "cancelled"));
    setDownloadResults((items) => items.filter((item: any) => item.ok));
    setSpotifyTracks((items) => items.map((track: any) => (
      track.downloadStatus === "failed"
        ? { ...track, downloadStatus: "ready", downloadError: "", downloadMessage: "Ready" }
        : track
    )));
    setSpotifyFetchError("");
    setStatusText("cleared failed downloads");
    showAppToast("cleared failed downloads", "success");
  }

  function clearFinishedDownloads() {
    setDownloadQueue((items) => items.filter((item) => item.status === "queued" || item.status === "downloading" || item.status === "converting"));
    setDownloadResults((items) => items.filter((item: any) => !item.ok));
    setStatusText("cleared finished downloads");
    showAppToast("cleared finished downloads", "success");
  }

  function openDownloadedSongInLibrary(item: DownloadResult | DownloadQueueItem) {
    const filePath = "filePath" in item ? item.filePath : undefined;
    if (!filePath) {
      changeView("library", "unknown");
      return;
    }

    const match = songs.find((song) => song.filePath === filePath);
    if (match) {
      setCurrentId(match.id);
      void rememberCurrentSong(match.id);
      changeView("library", "unknown");
      setStatusText("opened downloaded song in library");
    } else {
      changeView("library", "unknown");
      setStatusText("download is saved, but auto-add is off");
    }
  }

  async function chooseDownloadFolder() {
    try {
      const result = await window.localitfy.chooseDownloadFolder?.();
      if (!result || result.canceled || !result.folder) return;
      await updateSetting("downloadFolder", result.folder);
      setDownloadFolderLabel(result.folder);
      showAppToast("download folder updated", "success");
    } catch (error) {
      console.error("[localtify choose download folder failed]", error);
      showAppToast("could not choose download folder", "error");
    }
  }

  async function cancelCurrentDownload() {
    try {
      await window.localitfy.cancelDownload?.();
      setDownloadBusy(false);
      setStatusText("download cancelled");
      setDownloadQueue((current) => current.map((item) => (
        item.status === "queued" || item.status === "downloading" || item.status === "converting"
          ? { ...item, status: "cancelled", progress: item.progress || 100, message: "Download cancelled" }
          : item
      )));
    } catch (error) {
      console.error("[localtify cancel download failed]", error);
      showAppToast("could not cancel download", "error");
    }
  }

  async function retryDownload(url: string, source: "youtube" | "spotify" | "auto" = "auto", spotifyTrackId = "") {
    if (!url) {
      showAppToast("No URL saved for this failed item", "error");
      return;
    }

    setStatusText("retrying failed download...");
    showAppToast("retrying failed download", "info");

    if (source === "spotify" || url.startsWith("spotify:")) {
      const track = spotifyTracks.find((item: any) => item.id === spotifyTrackId) ||
        spotifyTracks.find((item: any) => url.toLowerCase().includes(String(item.title || "").toLowerCase()));
      if (track) {
        await downloadSpotifyTracks([track]);
        return;
      }

      setDownloadsTab("spotify");
      setSpotifyFetchError("Could not match this failed queue item back to a Spotify track. Fetch the playlist again, then retry the track.");
      return;
    }

    setDownloadText(url);
    await downloadAudioLinks(url);
  }

  async function retrySpotifyTrack(track: SpotifyTrack) {
    if (!track?.id) return;
    await downloadSpotifyTracks([track]);
  }

  async function downloadAudioLinks(overrideText?: string) {
    const urls = parseDownloadUrls(overrideText || downloadText);

    if (!urls.length) {
      setPlayerError("paste at least one YouTube link first");
      setStatusText("nothing to download");
      return;
    }

    setDownloadBusy(true);
    setConvertBusy(false);
    setConvertProgress(0);
    setConvertMessage("");
    setPlayerError("");
    setStatusText("downloading audio...");
    setDownloadQueue(makeQueuedDownloads(urls));

    try {
      const result = await window.localitfy.downloadAudioUrls({
        urls,
        options: {
          quality: settings.downloadQuality,
          format: settings.downloadFormat,
          autoAdd: settings.downloadAutoAdd,
          cleanTitle: settings.downloadCleanTitle,
          downloadFolder: settings.downloadFolder
        }
      });

      let nextSongs = applyLibraryOrder(sanitizeSongList(result.songs || []));
      const downloads = result.downloads || [];
      const successCount = downloads.filter((item) => item.ok).length;
      const failCount = downloads.filter((item) => !item.ok).length;

      // V320: after a successful download, refresh from the real database rows once.
      // This prevents the old bug where a downloaded file finished but did not appear in Library.
      if ((successCount > 0 || Number(result.changedCount || 0) > 0) && window.localitfy?.bootstrap) {
        try {
          const refreshed = await window.localitfy.bootstrap();
          const refreshedSongs = applyLibraryOrder(sanitizeSongList(refreshed?.songs || []));
          if (refreshedSongs.length) nextSongs = refreshedSongs;
        } catch (refreshError) {
          console.warn("[localtify download library refresh failed]", refreshError);
        }
      }

      const enrichedDownloads = enrichDownloadResultsWithLibraryMatches(downloads, nextSongs);
      setDownloadResults(enrichedDownloads);
      syncDownloadFilesToQueue(enrichedDownloads, nextSongs);
      setDownloadFolderLabel(result.downloadFolder || settings.downloadFolder || "");
      playbackUrlCacheRef.current.clear();
      playbackUrlPendingRef.current.clear();
      setSongs(nextSongs);
      setLibraryScanMessage(`library refreshed: ${nextSongs.length} tracks`);

      if (nextSongs.length && !currentId) {
        const firstSong = nextSongs[0];
        if (firstSong) {
          setCurrentId(firstSong.id);
          await rememberCurrentSong(firstSong.id);
        }
      }

      if (successCount > 0) {
        trackSongsImported(result.changedCount || successCount, "downloads");
        const importedCount = enrichedDownloads.filter((item: any) => item.ok && item.importedToLibrary).length;
        const notImportedCount = enrichedDownloads.filter((item: any) => item.ok && !item.importedToLibrary).length;
        setStatusText(
          settings.downloadAutoAdd
            ? notImportedCount > 0
              ? `downloaded ${successCount}; ${notImportedCount} not imported`
              : `downloaded ${successCount} and added ${importedCount || result.changedCount || successCount} to library`
            : `downloaded ${successCount} file${successCount === 1 ? "" : "s"}`
        );
        showAppToast(
          notImportedCount > 0
            ? `${notImportedCount} downloaded file${notImportedCount === 1 ? "" : "s"} not imported`
            : `added ${importedCount || successCount} to library`,
          notImportedCount > 0 ? "info" : "success"
        );
        if (settings.downloadAutoAdd) changeView("library", "unknown");
      } else {
        trackImportFailed("download_no_audio", "downloads");
        setStatusText("download failed");
        setPlayerError("no audio files downloaded. check the results below.");
      }

      if (failCount > 0) {
        console.warn("[localitfy download partial failures]", downloads);
      }
    } catch (error) {
      console.error("[localitfy download failed]", error);
      trackImportFailed("download_failed", "downloads");
      const message = friendlyDownloadError((error as Error)?.message || "Download failed.");
      const failedDownloads = urls.map((url) => ({
        ok: false,
        url,
        error: message,
        statusLabel: "Failed — retry available"
      })) as any[];

      setDownloadResults(failedDownloads);
      setDownloadQueue((items) => items.map((item) => ({
        ...item,
        status: "failed",
        progress: 100,
        message,
        error: message,
        statusLabel: "Failed — retry available"
      })));
      setPlayerError(message);
      setStatusText("download failed");
      showAppToast("Download failed — retry from the queue", "error");
    } finally {
      setDownloadBusy(false);
    }
  }

  // -- Spotify auth + import functions --------------------------------------
  function updateSpotifyConnectionState(res: any = {}) {
    const hasReadyValue = Object.prototype.hasOwnProperty.call(res || {}, "ready") || Object.prototype.hasOwnProperty.call(res || {}, "ok");
    const fallbackAvailable = Boolean(res?.fallbackAvailable || res?.publicOnly || res?.mode === "public-fallback");
    const ready = hasReadyValue ? Boolean(res?.ready ?? res?.ok ?? fallbackAvailable) : true;
    const loggedIn = Boolean(res?.loggedIn);
    const needsClientId = Boolean(res?.needsClientId) && !fallbackAvailable;

    setSpotifyConnectionReady(ready || fallbackAvailable);
    setSpotifyNeedsClientId(needsClientId);
    setSpotifyConnectionMode(String(res?.mode || (fallbackAvailable ? "public-fallback" : "oauth-pkce")));
    if (res?.redirectUri) setSpotifyRedirectUri(String(res.redirectUri));
    setSpotifyLoggedIn(loggedIn || Boolean(res?.ok && fallbackAvailable));

    return { ready: ready || fallbackAvailable, loggedIn: loggedIn || Boolean(res?.ok && fallbackAvailable), fallbackAvailable };
  }

  function formatSpotifyPrivatePlaylistMessage(rawMessage = "", hint = "") {
    const message = String(rawMessage || "Failed to fetch Spotify tracks.").trim();
    const cleanHint = String(hint || "").trim();
    const looksPrivate = /private|public|profile|could not read|could not expose|404|403|blocked/i.test(`${message} ${cleanHint}`);

    if (!looksPrivate) return cleanHint ? `${message}\n\nTip: ${cleanHint}` : message;

    return [
      "Spotify could not read this playlist.",
      "Make sure it is public on your Spotify profile, not only shareable by link.",
      "Open Spotify ? playlist menu ? add to profile / make public, then paste the link again."
    ].join("\n");
  }

  useEffect(() => {
    if (downloadsTab !== "spotify" || !ready) return;

    let cancelled = false;

    Promise.resolve((window.localitfy as any).spotifyCheck?.())
      .then((res: any) => {
        if (cancelled) return;
        updateSpotifyConnectionState(res || { ready: true, loggedIn: false, mode: "oauth-pkce" });
      })
      .catch(() => {
        if (cancelled) return;
        setSpotifyConnectionReady(true);
        setSpotifyNeedsClientId(false);
        setSpotifyConnectionMode("oauth-pkce");
        setSpotifyLoggedIn(false);
      });

    return () => {
      cancelled = true;
    };
  }, [downloadsTab, ready]);

  async function handleSpotifyLogin() {
    if (spotifyLoginBusy) return;

    setSpotifyLoginBusy(true);
    setSpotifyFetchError("");
    setStatusText("opening spotify login...");

    try {
      const bridge = (window.localitfy as any);
      if (!bridge?.spotifyLogin) {
        setSpotifyFetchError("Spotify login is not wired in preload/main yet.");
        setStatusText("spotify login unavailable");
        return;
      }

      const res = await bridge.spotifyLogin();
      const state = updateSpotifyConnectionState(res || {});

      if (!res?.ok && !state.loggedIn && !state.fallbackAvailable) {
        const message = res?.needsClientId
          ? "Spotify public import fallback is not available in this build. Replace electron/main.cjs with the v315 Spotify public fallback file."
          : res?.error || "Spotify login cancelled.";
        setSpotifyFetchError(message);
        setStatusText(res?.cancelled ? "spotify login cancelled" : "spotify connection failed");
      } else {
        setSpotifyFetchError("");
        setStatusText(state.fallbackAvailable && !res?.loggedIn ? "spotify public import ready — paste a link" : "spotify connected — paste a link to fetch tracks");
      }
    } catch (error) {
      const message = String((error as Error)?.message || "Spotify login failed.");
      setSpotifyFetchError(message);
      setStatusText(/cancel/i.test(message) ? "spotify login cancelled" : "spotify connection failed");
    } finally {
      setSpotifyLoginBusy(false);
    }
  }

  async function handleSpotifySetCookie(sp_dc: string) {
    const value = sp_dc.trim();
    if (!value) return;

    setSpotifyLoginBusy(true);
    setSpotifyFetchError("");

    try {
      const bridge = (window.localitfy as any);
      if (!bridge?.spotifySetCookie) {
        setSpotifyFetchError("Spotify cookie login is not wired in preload/main yet.");
        return;
      }

      const res = await bridge.spotifySetCookie(value);
      updateSpotifyConnectionState(res || { ready: true, loggedIn: Boolean(res?.ok) });
      if (res?.ok) {
        setSpotifyShowCookieInput(false);
        setSpotifyCookieDraft("");
        setStatusText("connected to spotify");
      } else {
        setSpotifyFetchError(res?.error || "Invalid sp_dc cookie.");
      }
    } catch (error) {
      setSpotifyFetchError(String((error as Error)?.message || "Cookie save failed."));
    } finally {
      setSpotifyLoginBusy(false);
    }
  }

  async function handleSpotifyLogout() {
    try {
      const res = await (window.localitfy as any).spotifyLogout?.();
      updateSpotifyConnectionState(res || { ready: true, loggedIn: false, mode: "oauth-pkce" });
    } catch {
      setSpotifyConnectionReady(true);
      setSpotifyNeedsClientId(false);
      setSpotifyLoggedIn(false);
    }

    setSpotifyTracks([]);
    setSpotifySelectedIds(new Set());
    setSpotifyUrl("");
    setSpotifyFetchError("");
    setSpotifyShowCookieInput(false);
    setSpotifyCookieDraft("");
    setStatusText("disconnected from spotify");
  }

  async function fetchSpotifyTracks() {
    const cleanUrl = spotifyUrl.trim();
    if (!cleanUrl) return;

    setSpotifyFetchBusy(true);
    setSpotifyFetchError("");
    setSpotifyTracks([]);
    setSpotifySelectedIds(new Set());
    setSpotifySourceName("");
    setSpotifySourceType("");
    setPlayerError("");
    setStatusText("fetching spotify tracks...");

    try {
      const bridge = (window.localitfy as any);
      const checkRes = await Promise.resolve(bridge?.spotifyCheck?.()).catch(() => null);
      if (checkRes) {
        const connection = updateSpotifyConnectionState(checkRes);
        if ((!connection.ready || checkRes?.needsClientId) && !connection.fallbackAvailable) {
          const message = "Spotify public import is not ready in this build. Replace electron/main.cjs with the v315 Spotify public fallback file.";
          setSpotifyFetchError(message);
          setStatusText("spotify setup needed");
          return;
        }
      }

      const spotifyFetchBridge = bridge?.spotifyFetch || bridge?.spotifyFetchTracks;
      if (!spotifyFetchBridge) {
        setSpotifyFetchError("Spotify fetch is not wired in preload/main yet.");
        setStatusText("spotify fetch unavailable");
        return;
      }

      const result = bridge?.spotifyFetch
        ? await spotifyFetchBridge({ url: cleanUrl })
        : await spotifyFetchBridge(cleanUrl);

      if (result?.loggedIn !== undefined || result?.ready !== undefined || result?.mode) {
        updateSpotifyConnectionState(result);
      }

      if (result?.error) {
        const message = formatSpotifyPrivatePlaylistMessage(result.error, result.hint);
        setSpotifyFetchError(message);
        setStatusText(/public|private|profile/i.test(message) ? "spotify playlist not public" : "spotify fetch failed");
        return;
      }

      if (!result || !Array.isArray(result.tracks) || !result.tracks.length) {
        setSpotifyFetchError("No tracks found. Make sure the link is a public Spotify playlist, album, or track.");
        setStatusText("no spotify tracks found");
        return;
      }

      const tracks: SpotifyTrack[] = result.tracks.map((t: SpotifyTrack, i: number) => ({
        ...t,
        id: t.id || `spt_${i}`,
        title: (t.title || (t as any).name || "unknown track").trim(),
        artist: (t.artist || (t as any).artists || "").trim(),
        albumName: (t.albumName || (t as any).album || "").trim(),
        coverUrl: (t.coverUrl || (t as any).spotifyCoverUrl || (t as any).albumCoverUrl || "").trim(),
        spotifyUrl: String((t as any).spotifyUrl || "").trim(),
        isrc: String((t as any).isrc || "").trim(),
        durationMs: Number((t as any).durationMs || 0) || undefined
      }));

      const sourceName = String(result.playlistName || result.name || result.title || "").trim();
      const sourceType = String(result.type || "").trim();
      const finalSourceType = sourceType || (tracks.length === 1 ? "track" : "playlist");

      setSpotifySourceName(sourceName || (finalSourceType === "album" ? "Spotify Album" : finalSourceType === "track" ? "Spotify Track" : "Spotify Playlist"));
      setSpotifySourceType(finalSourceType);
      setSpotifyTracks(tracks);
      setSpotifySelectedIds(new Set(tracks.map((t) => t.id)));
      setSpotifyFetchError("");
      setStatusText(`fetched ${tracks.length} track${tracks.length !== 1 ? "s" : ""} from spotify`);
    } catch (error) {
      const message = formatSpotifyPrivatePlaylistMessage(String((error as Error)?.message || "Failed to fetch Spotify tracks."));
      setSpotifyFetchError(message);
      setStatusText(/public|private|profile/i.test(message) ? "spotify playlist not public" : "spotify fetch failed");
      console.error("[localtify spotify fetch failed]", error);
    } finally {
      setSpotifyFetchBusy(false);
    }
  }

  function upsertSpotifyPlaylistFromImport(sourceName: string, importedSongs: Song[]) {
    const cleanIds = Array.from(new Set(importedSongs.map((song) => song.id).filter(Boolean)));
    if (!cleanIds.length) return null;

    const safeName = normalizePlaylistName(sourceName, `Spotify import ${new Date().toLocaleDateString()}`);
    let selectedId: string | null = null;
    let created = false;

    setPlaylists((items) => {
      const existing = items.find((playlist) => playlist.name.trim().toLowerCase() === safeName.toLowerCase());

      if (existing) {
        selectedId = existing.id;

        // Spotify auto playlists are replaced with the exact imported set.
        // Do not merge, because merging was keeping old random songs in the playlist.
        return items.map((playlist) =>
          playlist.id === existing.id ? { ...playlist, songIds: cleanIds } : playlist
        );
      }

      const playlist: Playlist = {
        id: makeLocalId("playlist"),
        name: safeName,
        songIds: cleanIds,
        createdAt: Date.now()
      };

      selectedId = playlist.id;
      created = true;
      return [playlist, ...items];
    });

    if (selectedId) {
      setSelectedPlaylistId(selectedId);
      setActivePlaylistId(selectedId);
    }

    setStatusText(`${created ? "created" : "fixed"} Spotify playlist: ${safeName}`);
    showAppToast(`${created ? "created" : "fixed"} playlist: ${safeName}`, "success");
    return selectedId;
  }

  async function downloadSpotifyTracks(trackOverride?: SpotifyTrack[]) {
    const selected = Array.isArray(trackOverride) && trackOverride.length
      ? trackOverride
      : spotifyTracks.filter((t) => spotifySelectedIds.has(t.id));
    if (!selected.length) return;

    if (Array.isArray(trackOverride) && trackOverride.length) {
      setSpotifySelectedIds(new Set(trackOverride.map((track) => track.id)));
    }

    setSpotifyDownloadBusy(true);
    setDownloadBusy(true);
    setDownloadResults([]);
    setPlayerError("");
    setSpotifyFetchError("");
    setSpotifyTracks((items) => items.map((track: any) => (
      selected.some((selectedTrack) => selectedTrack.id === track.id)
        ? { ...track, downloadStatus: "queued", downloadError: "", downloadMessage: "Queued" }
        : track
    )));
    setDownloadQueue(
      selected.map((t, i) => ({
        id: `spt_${t.id}_${i}`,
        spotifyTrackId: t.id,
        source: "spotify",
        url: (t as any).spotifyUrl || `spotify:track:${t.id}`,
        title: t.artist ? `${t.artist} — ${t.title}` : t.title,
        status: "queued" as const,
        progress: 0,
        message: "Waiting..."
      }))
    );
    setStatusText(`downloading ${selected.length} track${selected.length !== 1 ? "s" : ""} from spotify...`);

    try {
      const bridge = (window.localitfy as any);
      const spotifyDownloadBridge = bridge?.spotifyDownloadBatch || bridge?.spotdlDownloadBatch;
      if (!spotifyDownloadBridge) {
        const message = "Spotify download is not wired in preload/main yet.";
        setSpotifyFetchError(message);
        setDownloadQueue((items) => items.map((item) => ({ ...item, status: "failed", progress: 100, message, error: message, statusLabel: "Failed — retry available" })));
        setStatusText("spotify download failed");
        showAppToast("Spotify download bridge missing", "error");
        return;
      }

      const result = await spotifyDownloadBridge({
        tracks: selected.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          albumName: t.albumName,
          coverUrl: t.coverUrl || (t as any).spotifyCoverUrl || (t as any).albumCoverUrl || "",
          spotifyUrl: (t as any).spotifyUrl || "",
          isrc: (t as any).isrc || "",
          duration: t.duration,
          durationMs: (t as any).durationMs
        })),
        sourceName: spotifySourceName,
        sourceType: spotifySourceType,
        options: {
          quality: settings.downloadQuality,
          format: settings.downloadFormat,
          autoAdd: settings.downloadAutoAdd,
          downloadFolder: settings.downloadFolder,
          sourceName: spotifySourceName,
          sourceType: spotifySourceType
        }
      });

      if (result) {
        let nextSongs = applyLibraryOrder(sanitizeSongList(result.songs || []));
        setDownloadFolderLabel(result.downloadFolder || settings.downloadFolder || "");

        const downloads = result.downloads || [];
        const successCount = downloads.filter((d: DownloadResult) => d.ok).length;
        const failCount = downloads.filter((d: DownloadResult) => !d.ok).length;

        // Restart-lite safety: after Spotify downloads, reload the real DB library.
        // Set the song list once with the final refreshed DB rows to avoid a double
        // home/library render right after download.
        if ((successCount > 0 || Number(result.changedCount || 0) > 0) && bridge?.bootstrap) {
          try {
            const refreshed = await bridge.bootstrap();
            const refreshedSongs = applyLibraryOrder(sanitizeSongList(refreshed?.songs || []));
            if (refreshedSongs.length) {
              nextSongs = refreshedSongs;
              setLibraryScanMessage(`library refreshed: ${refreshedSongs.length} tracks`);
            }
          } catch (refreshError) {
            console.warn("[localtify spotify library refresh failed]", refreshError);
          }
        }

        const enrichedDownloads = enrichDownloadResultsWithLibraryMatches(downloads, nextSongs);
        setDownloadResults(enrichedDownloads);
        syncDownloadFilesToQueue(enrichedDownloads, nextSongs);

        const enrichedDownloadsBySpotifyId = new Map(
          enrichedDownloads
            .map((item: any) => [String(item.spotifyTrackId || "").trim(), item])
            .filter(([id]) => Boolean(id))
        );
        const rawDownloadsBySpotifyId = new Map(
          downloads
            .map((item: any) => [String(item.spotifyTrackId || "").trim(), item])
            .filter(([id]) => Boolean(id))
        );

        setSpotifyTracks((items) => items.map((track: any) => {
          const selectedIndex = selected.findIndex((selectedTrack) => selectedTrack.id === track.id);
          if (selectedIndex === -1) return track;

          const resultForTrack: any =
            enrichedDownloadsBySpotifyId.get(String(track.id || "").trim()) ||
            rawDownloadsBySpotifyId.get(String(track.id || "").trim()) ||
            enrichedDownloads[selectedIndex] ||
            downloads[selectedIndex] ||
            null;
          if (!resultForTrack) {
            return {
              ...track,
              downloadStatus: "failed",
              downloadError: "No result returned for this track.",
              downloadMessage: "No result returned"
            };
          }

          return {
            ...track,
            downloadStatus: resultForTrack.ok ? "done" : "failed",
            downloadError: resultForTrack.ok ? "" : friendlyDownloadError(resultForTrack.error || "Spotify download failed."),
            downloadMessage: resultForTrack.ok
              ? resultForTrack.importedToLibrary
                ? "Added to library"
                : "Downloaded, not imported"
              : "Failed — retry available",
            downloadedFilePath: resultForTrack.filePath || "",
            importedToLibrary: Boolean(resultForTrack.importedToLibrary),
            librarySongId: resultForTrack.librarySongId || "",
            matchScore: resultForTrack.matchScore,
            providerUrl: resultForTrack.providerUrl || ""
          };
        }));

        setSongs(nextSongs);

        if (settings.downloadAutoAdd && successCount > 0) {
          const exactImportedIds = Array.from(
            new Set<string>(
              Array.isArray(result.spotifyImportedSongIds)
                ? result.spotifyImportedSongIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
                : []
            )
          );

          const playlistName =
            spotifySourceName ||
            result.spotifySourceName ||
            result.playlistName ||
            result.name ||
            (spotifySourceType === "album" ? "Spotify Album" : "Spotify Playlist");

          if (!exactImportedIds.length) {
            const message = "Spotify import finished, but the backend did not return exact song IDs. Playlist creation skipped to avoid adding random songs.";
            setSpotifyFetchError(message);
            showAppToast(message, "error");
            console.warn("[localtify spotify playlist skipped]", { reason: "missing exact imported song ids", result });
          } else {
            const songsById = new Map(nextSongs.map((song) => [song.id, song]));
            const importedSpotifySongs = exactImportedIds
              .map((id) => songsById.get(id))
              .filter((song): song is Song => Boolean(song));

            if (!importedSpotifySongs.length) {
              const message = "Spotify import finished, but the imported songs were not found after library refresh. Playlist creation skipped.";
              setSpotifyFetchError(message);
              showAppToast(message, "error");
              console.warn("[localtify spotify playlist skipped]", { reason: "imported ids missing after refresh", exactImportedIds });
            } else {
              if (importedSpotifySongs.length !== exactImportedIds.length) {
                console.warn("[localtify spotify playlist partial id match]", {
                  expected: exactImportedIds.length,
                  matched: importedSpotifySongs.length,
                  exactImportedIds
                });
              }

              upsertSpotifyPlaylistFromImport(playlistName, importedSpotifySongs);
            }
          }
        }

        if (nextSongs.length && !currentId) {
          const firstSong = nextSongs[0];
          if (firstSong) {
            setCurrentId(firstSong.id);
            await rememberCurrentSong(firstSong.id);
          }
        }

        if (successCount > 0) {
          const importedCount = enrichedDownloads.filter((item: any) => item.ok && item.importedToLibrary).length;
          const notImportedCount = enrichedDownloads.filter((item: any) => item.ok && !item.importedToLibrary).length;
          trackSongsImported(result.changedCount || importedCount || successCount, "downloads");
          setStatusText(
            failCount > 0
              ? `spotify finished: ${successCount} done, ${failCount} failed`
              : notImportedCount > 0
                ? `spotify finished: ${successCount} downloaded, ${notImportedCount} not imported`
                : `spotify finished: ${importedCount || successCount} added to library`
          );
          showAppToast(
            failCount > 0
              ? `Spotify: ${successCount} done, ${failCount} failed`
              : `Spotify added ${importedCount || successCount} to library`,
            failCount > 0 ? "info" : "success"
          );
          if (settings.downloadAutoAdd && nextSongs.length) changeView("library", "unknown");
        } else {
          setStatusText("spotify download finished — no tracks added");
          setPlayerError("no tracks downloaded. check the queue for errors.");
          showAppToast("Spotify download failed — retry from the queue", "error");
        }

        if (failCount > 0) {
          const firstFailure = enrichedDownloads.find((item: any) => !item.ok);
          setSpotifyFetchError(firstFailure ? friendlyDownloadError(firstFailure.error || "Some Spotify tracks failed.") : "Some Spotify tracks failed. Retry failed items from the queue.");
          console.warn("[localtify spotify partial failures]", enrichedDownloads);
        } else {
          setSpotifyFetchError("");
        }
      }
    } catch (error) {
      const message = friendlyDownloadError((error as Error)?.message || "Spotify download failed.");
      console.error("[localtify spotify download failed]", error);
      setSpotifyFetchError(message);
      setSpotifyTracks((items) => items.map((track: any) => (
        selected.some((selectedTrack) => selectedTrack.id === track.id)
          ? { ...track, downloadStatus: "failed", downloadError: message, downloadMessage: "Failed — retry available" }
          : track
      )));
      const failedDownloads = selected.map((track) => ({
        ok: false,
        url: (track as any).spotifyUrl || `spotify:track:${track.id}`,
        source: "spotify",
        spotifyTrackId: track.id,
        error: message,
        statusLabel: "Failed — retry available"
      })) as any[];
      setDownloadResults(failedDownloads);
      setDownloadQueue((items) => items.map((item) => ({
        ...item,
        status: "failed",
        progress: 100,
        message,
        error: message,
        statusLabel: "Failed — retry available"
      })));
      setStatusText("spotify download failed");
      showAppToast("Spotify download failed — retry from the queue", "error");
    } finally {
      setSpotifyDownloadBusy(false);
      setDownloadBusy(false);
    }
  }
  // ------------------------------------------------------------------------

  async function convertLocalMedia() {
    setConvertBusy(true);
    setConvertProgress(0);
    setConvertMessage("choose files to convert...");
    setPlayerError("");
    setStatusText("opening converter...");

    try {
      const result = await window.localitfy.pickAndConvertMedia({
        bitrate: 192
      });

      const conversions = result.conversions || [];
      const nextSongs = applyLibraryOrder(sanitizeSongList(result.songs || []));

      setSongs(nextSongs);
      setLibraryScanMessage(`indexed ${nextSongs.length} tracks instantly`);
      setDownloadResults(
        conversions.map((item) => ({
          ok: item.ok,
          filename: item.filename,
          filePath: item.filePath,
          error: item.error,
          url: item.sourcePath
        }))
      );

      const successCount = conversions.filter((item) => item.ok).length;

      if (nextSongs.length && !currentId) {
        const firstSong = nextSongs[0];

        if (firstSong) {
          setCurrentId(firstSong.id);
          await rememberCurrentSong(firstSong.id);
        }
      }

      if (successCount > 0) {
        trackSongsImported(result.changedCount || successCount, "conversion");
        setConvertProgress(100);
        setConvertMessage("conversion complete");
        setStatusText(
          `converted ${successCount} file${successCount === 1 ? "" : "s"} and imported ${result.changedCount}`
        );
        changeView("library", "unknown");
      } else {
        trackImportFailed("conversion_no_files", "conversion");
        setStatusText("nothing converted");
        setConvertMessage("no files converted");
      }
    } catch (error) {
      console.error("[localitfy convert failed]", error);
      trackImportFailed("conversion_failed", "conversion");
      setPlayerError("conversion failed. check terminal.");
      setConvertMessage("conversion failed");
      setStatusText("conversion failed");
    } finally {
      setConvertBusy(false);
    }
  }

  function normalizePlaylistName(sourceName: string, fallbackName: string) {
    return (sourceName.trim() || fallbackName).slice(0, 120);
  }

  function createPlaylist(forcedName?: string) {
    const sourceName = typeof forcedName === "string" ? forcedName : newPlaylistName;
    const fallbackName = `playlist ${playlists.length + 1}`;
    const name = normalizePlaylistName(sourceName, fallbackName);
    const existingPlaylist = playlists.find(
      (playlist) => playlist.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (existingPlaylist) {
      setSelectedPlaylistId(existingPlaylist.id);
      setStatusText("playlist already exists");
      showAppToast("playlist already exists", "info");
      return existingPlaylist.id;
    }

    const playlist: Playlist = { id: makeLocalId("playlist"), name, songIds: [], createdAt: Date.now() };

    setPlaylists((items) => [playlist, ...items]);
    setSelectedPlaylistId(playlist.id);
    if (typeof forcedName === "string") setPlaylistPickerName("");
    else setNewPlaylistName("");

    showAppToast("playlist created", "success");
    setStatusText(`created playlist: ${name}`);
    return playlist.id;
  }

  function createPlaylistWithSong(songId: string, forcedName: string) {
    const sourceName = forcedName.trim();
    if (!sourceName || !songsById.has(songId)) return;

    const name = normalizePlaylistName(sourceName, `playlist ${playlists.length + 1}`);
    const existingPlaylist = playlists.find(
      (playlist) => playlist.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (existingPlaylist) {
      addSongToPlaylist(existingPlaylist.id, songId);
      setSelectedPlaylistId(existingPlaylist.id);
      setPlaylistPickerSong(null);
      setPlaylistPickerName("");
      return existingPlaylist.id;
    }

    const playlist: Playlist = {
      id: makeLocalId("playlist"),
      name,
      songIds: [songId],
      createdAt: Date.now()
    };

    setPlaylists((items) => [playlist, ...items]);
    setSelectedPlaylistId(playlist.id);
    setPlaylistPickerSong(null);
    setPlaylistPickerName("");
    setStatusText(`added to ${name}`);
    showAppToast(`added to ${name}`, "success");
    return playlist.id;
  }

  function removePlaylist(playlistId: string) {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return;

    const shouldRemove = window.confirm(`Delete "${playlist.name}"? Songs stay in your library.`);
    if (!shouldRemove) return;

    setPlaylists((items) => items.filter((item) => item.id !== playlistId));
    setSelectedPlaylistId((id) => (id === playlistId ? null : id));
    setActivePlaylistId((id) => (id === playlistId ? null : id));
    if (renamingPlaylistId === playlistId) {
      setRenamingPlaylistId(null);
      setRenamingPlaylistName("");
    }
    setStatusText(`removed ${playlist.name}`);
    showAppToast("playlist deleted", "success");
  }

  function startRenamePlaylist(playlist: Playlist) {
    setRenamingPlaylistId(playlist.id);
    setRenamingPlaylistName(playlist.name);
    setSelectedPlaylistId(playlist.id);
  }

  function cancelRenamePlaylist() {
    setRenamingPlaylistId(null);
    setRenamingPlaylistName("");
  }

  function savePlaylistRename(playlistId: string) {
    const current = playlists.find((playlist) => playlist.id === playlistId);
    if (!current) return;

    const nextName = renamingPlaylistName.trim().slice(0, 120) || current.name;
    const duplicate = playlists.some(
      (playlist) => playlist.id !== playlistId && playlist.name.trim().toLowerCase() === nextName.toLowerCase()
    );

    if (duplicate) {
      setStatusText("playlist name already exists");
      showAppToast("playlist name already exists", "info");
      return;
    }

    setPlaylists((items) =>
      items.map((playlist) => (playlist.id === playlistId ? { ...playlist, name: nextName } : playlist))
    );
    setRenamingPlaylistId(null);
    setRenamingPlaylistName("");
    setStatusText(`renamed playlist to ${nextName}`);
    showAppToast("playlist renamed", "success");
  }

  function duplicatePlaylist(playlistId: string) {
    const source = playlists.find((playlist) => playlist.id === playlistId);
    if (!source) return;

    const existingNames = new Set(playlists.map((playlist) => playlist.name.trim().toLowerCase()));
    const baseName = `${source.name} copy`.trim();
    let name = baseName;
    let index = 2;

    while (existingNames.has(name.toLowerCase())) {
      name = `${baseName} ${index}`;
      index += 1;
    }

    const copy: Playlist = {
      id: makeLocalId("playlist"),
      name,
      songIds: [...source.songIds],
      createdAt: Date.now()
    };

    setPlaylists((items) => [copy, ...items]);
    setSelectedPlaylistId(copy.id);
    setStatusText(`duplicated ${source.name}`);
    showAppToast("playlist duplicated", "success");
  }

  function openPlaylist(playlistId: string) {
    setSelectedPlaylistId(playlistId);
    changeView("playlists", "unknown");
  }

  function openPlaylistPicker(song: Song) {
    setSongContextMenu(null);
    setPlaylistPickerName("");
    setPlaylistPickerSong(song);
  }

  function openSongContextMenu(event: ReactMouseEvent<HTMLElement>, song: Song) {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 236;
    const menuHeight = 282;
    const margin = 12;
    const x = Math.min(event.clientX, Math.max(margin, window.innerWidth - menuWidth - margin));
    const y = Math.min(event.clientY, Math.max(margin, window.innerHeight - menuHeight - margin));

    setSongContextMenu({ songId: song.id, x, y });
  }

  function addSongToPlaylist(playlistId: string, songId: string) {
    const song = songsById.get(songId);
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!song || !playlist) return;

    if (playlist.songIds.includes(songId)) {
      setStatusText("song is already in that playlist");
      return;
    }

    setPlaylists((items) =>
      items.map((item) =>
        item.id === playlistId ? { ...item, songIds: [...item.songIds, songId] } : item
      )
    );

    setSelectedPlaylistId(playlistId);
    setStatusText(`added ${prettyTitle(song.title, 4)} to ${playlist.name}`);
    showAppToast("added to playlist", "success");

    if (playlistPickerSong?.id === songId) {
      setPlaylistPickerSong(null);
      setPlaylistPickerName("");
    }
  }

  function removeSongFromPlaylist(playlistId: string, songId: string) {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return;

    setPlaylists((items) =>
      items.map((item) =>
        item.id === playlistId ? { ...item, songIds: item.songIds.filter((id) => id !== songId) } : item
      )
    );

    setStatusText(`removed from ${playlist.name}`);
    showAppToast("removed from playlist", "success");
  }

  function toggleSongPlaylist(playlistId: string, songId: string) {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return;

    if (playlist.songIds.includes(songId)) {
      removeSongFromPlaylist(playlistId, songId);
      return;
    }

    addSongToPlaylist(playlistId, songId);
  }

  function handlePlaylistSongDrop(playlistId: string, songId: string, targetSongId: string, side: LibraryDropSide) {
    if (!playlistId || !songId || !targetSongId || !songsById.has(songId) || songId === targetSongId) return;

    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return;

    const nextIds = playlist.songIds.includes(songId)
      ? reorderIdList(playlist.songIds, songId, targetSongId, side)
      : insertIdNearTarget(playlist.songIds, songId, targetSongId, side);

    if (nextIds.length === playlist.songIds.length && nextIds.every((id, index) => id === playlist.songIds[index])) {
      return;
    }

    setPlaylists((items) =>
      items.map((item) => (item.id === playlistId ? { ...item, songIds: nextIds } : item))
    );
    setSelectedPlaylistId(playlistId);
    setStatusText(playlist.songIds.includes(songId) ? "playlist order updated" : `added to ${playlist.name}`);
    showAppToast(playlist.songIds.includes(songId) ? "playlist order updated" : "added to playlist", "success");
  }

  function handlePlaylistSongAppend(playlistId: string, songId: string) {
    if (!playlistId || !songId || !songsById.has(songId)) return;
    addSongToPlaylist(playlistId, songId);
  }

  function handlePlaylistShelfDragOver(event: DragEvent<HTMLElement>, playlistId: string) {
    const songId = readDraggedSongId(event);
    if (!songId || !songsById.has(songId)) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setPlaylistDragOverPlaylistId((current) => (current === playlistId ? current : playlistId));
  }

  function handlePlaylistShelfDragLeave(event: DragEvent<HTMLElement>, playlistId: string) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    if (playlistDragOverPlaylistId === playlistId) setPlaylistDragOverPlaylistId("");
  }

  function handlePlaylistShelfDrop(event: DragEvent<HTMLElement>, playlistId: string) {
    const songId = readDraggedSongId(event);
    if (!songId || !songsById.has(songId)) return;

    event.preventDefault();
    event.stopPropagation();
    addSongToPlaylist(playlistId, songId);
    setPlaylistDragOverPlaylistId("");
    endSongDrag();
  }


  function queueSong(songId: string, next = false) {
    setPlayQueue((queue) => {
      const cleanedQueue = queue.filter((id) => id !== songId);
      return next ? [songId, ...cleanedQueue] : [...cleanedQueue, songId];
    });
    setStatusText(next ? "queued next" : "added to queue");
  }

  function clearQueue() {
    setPlayQueue([]);
    setStatusText("queue cleared");
  }

  function normalizeAlbumQueueSongIds(songIds: string[]) {
    const seen = new Set<string>();
    return songIds
      .map((songId) => songsById.get(songId))
      .filter(isPlayableSong)
      .filter((song) => {
        if (seen.has(song.id)) return false;
        seen.add(song.id);
        return true;
      })
      .map((song) => song.id);
  }

  function playAlbumSongs(songIds: string[], albumTitle = "album") {
    const ids = normalizeAlbumQueueSongIds(songIds);
    if (!ids.length) {
      setStatusText("album has no playable songs");
      return;
    }

    setActivePlaylistId(null);
    setPlayQueue(ids.slice(1));
    void selectSong(ids[0], true, { playlistId: null });
    setStatusText(`playing ${albumTitle}`);
  }

  function shuffleAlbumSongs(songIds: string[], albumTitle = "album") {
    const ids = normalizeAlbumQueueSongIds(songIds);
    if (!ids.length) {
      setStatusText("album has no playable songs");
      return;
    }

    const shuffled = makeShuffledPlayableSongs(ids.map((id) => songsById.get(id)).filter(isPlayableSong)).map((song) => song.id);
    setActivePlaylistId(null);
    setPlayQueue(shuffled.slice(1));
    void selectSong(shuffled[0], true, { playlistId: null });
    setStatusText(`shuffling ${albumTitle}`);
  }

  function queueAlbumSongs(songIds: string[], albumTitle = "album") {
    const ids = normalizeAlbumQueueSongIds(songIds);
    if (!ids.length) {
      setStatusText("album has no playable songs");
      return;
    }

    setPlayQueue((queue) => {
      const albumIdSet = new Set(ids);
      const cleanedQueue = queue.filter((songId) => !albumIdSet.has(songId));
      return [...cleanedQueue, ...ids];
    });
    setStatusText(`queued ${ids.length} track${ids.length === 1 ? "" : "s"} from ${albumTitle}`);
  }

  function readDraggedSongId(event: DragEvent<HTMLElement>) {
    return (
      draggedSongIdRef.current ||
      event.dataTransfer.getData("text/localitfy-song-id") ||
      event.dataTransfer.getData("text/plain") ||
      draggedSongId
    );
  }

  function clearLibraryDropElementVisual(songId = libraryDropVisualSongIdRef.current) {
    if (!songId) return;

    const element = librarySongElementRefs.current.get(songId);
    if (element) {
      element.style.removeProperty("--drop-pull");
      element.style.removeProperty("--drop-push");
      element.style.removeProperty("--drop-line-width");
      element.style.removeProperty("--drop-line-offset");
    }

    if (libraryDropVisualSongIdRef.current === songId) {
      libraryDropVisualSongIdRef.current = "";
      libraryDropVisualSideRef.current = "after";
    }
  }

  function applyLibraryDropElementVisual(songId: string, side: LibraryDropSide, pull = 10) {
    const safePull = Math.max(0, Math.min(58, Math.round(pull)));

    if (libraryDropVisualSongIdRef.current && libraryDropVisualSongIdRef.current !== songId) {
      clearLibraryDropElementVisual(libraryDropVisualSongIdRef.current);
    }

    const element = librarySongElementRefs.current.get(songId);
    if (!element) return;

    const push = Math.max(4, Math.min(18, Math.round(safePull * 0.34)));
    const lineWidth = Math.max(8, Math.min(28, Math.round(8 + safePull * 0.34)));
    const lineOffset = Math.max(12, Math.min(48, Math.round(12 + safePull * 0.62)));

    element.style.setProperty("--drop-pull", `${safePull}px`);
    element.style.setProperty("--drop-push", `${side === "before" ? push : -push}px`);
    element.style.setProperty("--drop-line-width", `${lineWidth}px`);
    element.style.setProperty("--drop-line-offset", `${lineOffset}px`);
    libraryDropVisualSongIdRef.current = songId;
    libraryDropVisualSideRef.current = side;
  }

  function setLibraryDragTarget(nextTargetId: string, side: LibraryDropSide, pull = 10) {
    const safePull = Math.max(0, Math.min(58, Math.round(pull)));

    if (libraryDragOverSongIdRef.current !== nextTargetId) {
      clearLibraryDropElementVisual(libraryDragOverSongIdRef.current);
      libraryDragOverSongIdRef.current = nextTargetId;
      setLibraryDragOverSongId(nextTargetId);
    }

    if (libraryDropSideRef.current !== side) {
      libraryDropSideRef.current = side;
      setLibraryDropSide(side);
    }

    if (
      nextTargetId &&
      (libraryDropPullRef.current !== safePull ||
        libraryDropVisualSongIdRef.current !== nextTargetId ||
        libraryDropVisualSideRef.current !== side)
    ) {
      libraryDropPullRef.current = safePull;
      applyLibraryDropElementVisual(nextTargetId, side, safePull);
    }
  }

  function clearLibraryDragTarget(side: LibraryDropSide = "after") {
    clearLibraryDropElementVisual();
    libraryDropPullRef.current = 0;

    if (libraryDragOverSongIdRef.current) {
      libraryDragOverSongIdRef.current = "";
      setLibraryDragOverSongId("");
    }

    if (libraryDropSideRef.current !== side) {
      libraryDropSideRef.current = side;
      setLibraryDropSide(side);
    }
  }

  function setQueueDropHotSafely(nextHot: boolean) {
    if (queueDropHotRef.current === nextHot) return;
    queueDropHotRef.current = nextHot;
    setQueueDropHot(nextHot);
  }

  function getLibraryDropSideInfoForElement(
    clientX: number,
    clientY: number,
    element: HTMLElement
  ): Pick<LibraryDropTarget, "side" | "pull"> {
    const rect = element.getBoundingClientRect();
    const isCard = element.classList.contains("homeAlbumCard");

    if (isCard) {
      const centerX = rect.left + rect.width / 2;
      const halfWidth = Math.max(rect.width / 2, 1);
      const side: LibraryDropSide = clientX > centerX ? "after" : "before";
      const distanceFromCenter = Math.min(1, Math.abs(clientX - centerX) / halfWidth);
      const distanceFromEdge = side === "before" ? Math.max(0, clientX - rect.left) : Math.max(0, rect.right - clientX);
      const edgePull = 1 - Math.min(1, distanceFromEdge / Math.max(rect.width * 0.42, 1));
      return { side, pull: 10 + distanceFromCenter * 16 + edgePull * 32 };
    }

    const centerY = rect.top + rect.height / 2;
    const halfHeight = Math.max(rect.height / 2, 1);
    const side: LibraryDropSide = clientY > centerY ? "after" : "before";
    const distanceFromCenter = Math.min(1, Math.abs(clientY - centerY) / halfHeight);
    return { side, pull: 10 + distanceFromCenter * 16 };
  }

  function getLibraryDropSideForElement(event: DragEvent<HTMLElement>, element: HTMLElement): LibraryDropSide {
    return getLibraryDropSideInfoForElement(event.clientX, event.clientY, element).side;
  }

  function getLibraryDropSide(event: DragEvent<HTMLElement>): LibraryDropSide {
    return getLibraryDropSideForElement(event, event.currentTarget);
  }

  function getLibraryDropElement(event: DragEvent<HTMLElement>) {
    if (!(event.target instanceof HTMLElement)) return null;
    const element = event.target.closest<HTMLElement>("[data-library-song-id]");
    if (!element || !event.currentTarget.contains(element)) return null;
    return element;
  }

  function pulseLibraryDropCommit() {
    document.body.classList.remove("localitfyDropCommitted");

    window.requestAnimationFrame(() => {
      document.body.classList.add("localitfyDropCommitted");

      window.setTimeout(() => {
        document.body.classList.remove("localitfyDropCommitted");
      }, 360);
    });
  }

  function moveSongToLibraryEnd(songId: string) {
    if (!songId || !songsById.has(songId)) return;

    setSongs((previousSongs) => {
      const currentIndex = previousSongs.findIndex((song) => song.id === songId);
      if (currentIndex === -1 || currentIndex === previousSongs.length - 1) return previousSongs;

      const draggedSong = previousSongs[currentIndex];
      const nextSongs = previousSongs.filter((song) => song.id !== songId);
      nextSongs.push(draggedSong);
      saveLibraryOrder(nextSongs);
      return nextSongs;
    });

    setStatusText("moved song to the end");
    pulseLibraryDropCommit();
  }

  const registerLibrarySongElement = useCallback((songId: string, element: HTMLElement | null) => {
    if (!songId) return;

    if (element) {
      librarySongElementRefs.current.set(songId, element);
    } else {
      librarySongElementRefs.current.delete(songId);
    }
  }, []);

  const findPointerLibraryTarget = useCallback(
    (clientX: number, clientY: number, sourceSongId: string): LibraryDropTarget | null => {
      const getSideAndPull = (rect: DOMRect): Pick<LibraryDropTarget, "side" | "pull"> => {
        const centerX = rect.left + rect.width / 2;
        const halfWidth = Math.max(rect.width / 2, 1);
        const side: LibraryDropSide = clientX < centerX ? "before" : "after";
        const distanceFromCenter = Math.min(1, Math.abs(clientX - centerX) / halfWidth);
        const distanceFromEdge = side === "before" ? Math.max(0, clientX - rect.left) : Math.max(0, rect.right - clientX);
        const edgePull = 1 - Math.min(1, distanceFromEdge / Math.max(rect.width * 0.42, 1));
        const pull = 10 + distanceFromCenter * 14 + edgePull * 26;

        return { side, pull };
      };

      const readCandidate = (element: Element | null): HTMLElement | null => {
        const card = element instanceof HTMLElement ? element.closest<HTMLElement>("[data-library-song-id]") : null;
        const songId = card?.dataset.librarySongId || "";
        if (!card || !songId || songId === sourceSongId) return null;
        return card;
      };

      const directElement = document.elementFromPoint(clientX, clientY);
      let targetCard = readCandidate(directElement);

      // Native pointer-drag reordering used to scan every registered song/card
      // when the pointer sat between elements. That became expensive on large
      // libraries and made audio playback + dragging feel stuttery. A tiny
      // elementsFromPoint stack keeps the forgiving target behavior without an
      // O(song count) loop on every frame.
      if (!targetCard) {
        const stack = typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(clientX, clientY).slice(0, 8) : [];
        for (const element of stack) {
          targetCard = readCandidate(element);
          if (targetCard) break;
        }
      }

      if (!targetCard) return null;

      const targetSongId = targetCard.dataset.librarySongId || "";
      const rect = targetCard.getBoundingClientRect();
      const { side, pull } = getSideAndPull(rect);
      return { songId: targetSongId, side, pull };
    },
    []
  );

  const moveSongInLibraryByPointer = useCallback((sourceSongId: string, targetSongId: string, side: LibraryDropSide) => {
    let moved = false;

    setSongs((previousSongs) => {
      const nextSongs = reorderSongList(previousSongs, sourceSongId, targetSongId, side);
      if (nextSongs === previousSongs) return previousSongs;

      saveLibraryOrder(nextSongs);
      moved = true;
      return nextSongs;
    });

    if (moved) {
      setStatusText("song order updated");
      pulseLibraryDropCommit();
      showAppToast("song order updated", "success");
    }
  }, []);

  const finishPointerLibraryDrag = useCallback((shouldApplyDrop: boolean) => {
    const runtime = pointerLibraryDragRef.current;
    pointerLibraryDragRef.current = null;

    if (pointerLibraryDragFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerLibraryDragFrameRef.current);
      pointerLibraryDragFrameRef.current = null;
    }

    document.body.classList.remove("localitfyLibraryPointerDragging");
    runtime?.sourceElement?.classList.remove("songCardPointerSource");

    if (shouldApplyDrop && runtime?.active && runtime.latestTargetId && runtime.latestTargetId !== runtime.songId) {
      moveSongInLibraryByPointer(runtime.songId, runtime.latestTargetId, runtime.latestSide);
    }

    endSongDrag();
  }, [moveSongInLibraryByPointer]);

  function startPointerSongDrag(event: PointerEvent<HTMLElement>, songId: string) {
    if (event.button !== 0 || !songId) return;

    const blockedDragOrigin =
      event.target instanceof HTMLElement
        ? event.target.closest(
            "button, input, textarea, select, a, [role='button'], .homeAlbumPlayZone, .homeAlbumCoverButton, .homeAlbumActions, .iconAction"
          )
        : null;

    if (blockedDragOrigin) return;

    const originIndex = songs.findIndex((song) => song.id === songId);
    if (originIndex < 0) return;

    pointerLibraryDragRef.current = {
      songId,
      originIndex,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      latestTargetId: null,
      latestSide: "after",
      sourceElement: event.currentTarget
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const runtime = pointerLibraryDragRef.current;
      if (!runtime || runtime.pointerId !== moveEvent.pointerId) return;

      const distance = Math.hypot(moveEvent.clientX - runtime.startX, moveEvent.clientY - runtime.startY);
      if (!runtime.active && distance < 7) return;

      moveEvent.preventDefault();

      if (!runtime.active) {
        runtime.active = true;
        draggedSongIdRef.current = runtime.songId;
        setDraggedSongId(runtime.songId);
        const song = songsById.get(runtime.songId);
        setDraggedSongTitle(song ? prettyTitle(song.title, 7) : "song");
        clearLibraryDragTarget("after");
        setQueueDropHotSafely(false);
        document.body.classList.add("localitfySongDragging", "localitfyLibraryPointerDragging", "localitfyNoSelect");
        runtime.sourceElement?.classList.add("songCardPointerSource");
      }

      if (pointerLibraryDragFrameRef.current !== null) return;

      const clientX = moveEvent.clientX;
      const clientY = moveEvent.clientY;

      pointerLibraryDragFrameRef.current = window.requestAnimationFrame(() => {
        pointerLibraryDragFrameRef.current = null;
        const latestRuntime = pointerLibraryDragRef.current;
        if (!latestRuntime?.active) return;

        const targetInfo = findPointerLibraryTarget(clientX, clientY, latestRuntime.songId);
        if (!targetInfo) {
          latestRuntime.latestTargetId = null;
          libraryDragOverSongIdRef.current = "";
          clearLibraryDragTarget(latestRuntime.latestSide);
          return;
        }

        latestRuntime.latestTargetId = targetInfo.songId;
        latestRuntime.latestSide = targetInfo.side;
        setLibraryDragTarget(targetInfo.songId, targetInfo.side, targetInfo.pull);
      });
    };

    const stopListening = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };

    const onUp = (upEvent: globalThis.PointerEvent) => {
      if (pointerLibraryDragRef.current?.pointerId !== upEvent.pointerId) return;
      stopListening();
      finishPointerLibraryDrag(true);
    };

    const onCancel = () => {
      stopListening();
      finishPointerLibraryDrag(false);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  function startSongDrag(event: DragEvent<HTMLElement>, songId: string) {
    const blockedDragOrigin =
      event.target instanceof HTMLElement
        ? event.target.closest(
            "button, input, textarea, select, a, [role='button'], .homeAlbumPlayZone, .homeAlbumCoverButton, .homeAlbumActions, .iconAction"
          )
        : null;

    if (blockedDragOrigin) {
      event.preventDefault();
      return;
    }

    const song = songsById.get(songId);

    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/localitfy-song-id", songId);
    event.dataTransfer.setData("text/plain", songId);

    if (song) {
      event.dataTransfer.setData("text/localitfy-song-title", song.title);
      attachSongDragPreview(event, song);
    }

    document.body.classList.add("localitfySongDragging", "localitfyNoSelect");
    draggedSongIdRef.current = songId;
    setDraggedSongId(songId);
    setDraggedSongTitle(song ? prettyTitle(song.title, 7) : "song");
    clearLibraryDragTarget("after");
    setQueueDropHotSafely(false);
  }

  function endSongDrag() {
    clearSongDragPreview();
    document.body.classList.remove("localitfySongDragging", "localitfyNoSelect");
    draggedSongIdRef.current = "";
    setDraggedSongId("");
    setDraggedSongTitle("");
    clearLibraryDragTarget("after");
    setPlaylistDragOverPlaylistId("");
    setQueueDropHotSafely(false);
  }

  function handleLibraryDragOver(event: DragEvent<HTMLElement>, targetSongId: string) {
    const songId = readDraggedSongId(event);
    if (!songId || songId === targetSongId || !songsById.has(songId)) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const dropInfo = getLibraryDropSideInfoForElement(event.clientX, event.clientY, event.currentTarget);
    setLibraryDragTarget(targetSongId, dropInfo.side, dropInfo.pull);
  }

  function handleLibraryDragLeave(event: DragEvent<HTMLElement>, targetSongId: string) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    if (libraryDragOverSongIdRef.current === targetSongId) clearLibraryDragTarget(libraryDropSideRef.current);
  }

  function handleLibraryDrop(event: DragEvent<HTMLElement>, targetSongId: string) {
    const songId = readDraggedSongId(event);
    if (!songId || songId === targetSongId || !songsById.has(songId)) return;

    event.preventDefault();
    event.stopPropagation();

    const side = getLibraryDropSide(event);

    setSongs((previousSongs) => {
      const nextSongs = reorderSongList(previousSongs, songId, targetSongId, side);
      if (nextSongs === previousSongs) return previousSongs;
      saveLibraryOrder(nextSongs);
      return nextSongs;
    });

    setStatusText("library order updated");
    pulseLibraryDropCommit();
    endSongDrag();
  }

  function handleLibraryAreaDragOver(event: DragEvent<HTMLElement>) {
    const songId = readDraggedSongId(event);
    if (!songId || !songsById.has(songId)) return;

    const dropElement = getLibraryDropElement(event);
    const targetSongId = dropElement?.dataset.librarySongId || "";

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (!dropElement || !targetSongId || targetSongId === songId) {
      clearLibraryDragTarget("after");
      return;
    }

    const dropInfo = getLibraryDropSideInfoForElement(event.clientX, event.clientY, dropElement);
    setLibraryDragTarget(targetSongId, dropInfo.side, dropInfo.pull);
  }

  function handleLibraryAreaDrop(event: DragEvent<HTMLElement>) {
    const songId = readDraggedSongId(event);
    if (!songId || !songsById.has(songId)) return;

    const dropElement = getLibraryDropElement(event);
    const targetSongId = dropElement?.dataset.librarySongId || "";

    event.preventDefault();
    event.stopPropagation();

    if (!dropElement || !targetSongId || targetSongId === songId) {
      moveSongToLibraryEnd(songId);
      endSongDrag();
      return;
    }

    const side = getLibraryDropSideForElement(event, dropElement);

    setSongs((previousSongs) => {
      const nextSongs = reorderSongList(previousSongs, songId, targetSongId, side);
      if (nextSongs === previousSongs) return previousSongs;
      saveLibraryOrder(nextSongs);
      return nextSongs;
    });

    setStatusText("library order updated");
    pulseLibraryDropCommit();
    endSongDrag();
  }

  function handleLibraryAreaDragLeave(event: DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    clearLibraryDragTarget("after");
  }

  function handlePlayerDragOver(event: DragEvent<HTMLElement>) {
    const hasLocalSongDrag =
      Boolean(draggedSongIdRef.current || draggedSongId) || Array.from(event.dataTransfer.types).includes("text/localitfy-song-id");

    if (!hasLocalSongDrag) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setQueueDropHotSafely(true);
  }

  function handlePlayerDragLeave(event: DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setQueueDropHotSafely(false);
  }

  function handlePlayerDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const songId = readDraggedSongId(event);

    if (songId && songsById.has(songId)) {
      queueSong(songId, true);
      showAppToast("queued next", "success");
    }

    endSongDrag();
  }


  function pushQueueHistory(song: Song | null) {
    if (!song) return;

    const stamp = `${song.id}:${Math.floor(Date.now() / 5000)}`;
    if (lastQueueHistoryRef.current === stamp) return;
    lastQueueHistoryRef.current = stamp;

    setQueueHistory((history) => [
      {
        id: makeLocalId("history"),
        songId: song.id,
        title: song.title,
        artist: song.artist,
        playedAt: Date.now()
      },
      ...history
    ].slice(0, 30));
  }

  async function playPlaylist(playlist: Playlist, shuffled = false) {
    const playable = playlist.songIds.map((songId) => songsById.get(songId)).filter(isPlayableSong);
    if (!playable.length) {
      setStatusText("playlist is empty");
      return;
    }
    const ordered = shuffled ? makeShuffledPlayableSongs(playable) : playable;
    setActivePlaylistId(playlist.id);
    setSelectedPlaylistId(playlist.id);
    setPlayQueue(ordered.slice(1).map((song) => song.id));
    await selectSong(ordered[0].id, true, { playlistId: playlist.id });
    setStatusText(`${shuffled ? "shuffling" : "playing"} ${playlist.name}`);
  }

  async function playSongFromPlaylist(playlistId: string, songId: string, shouldPlay = true) {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist || !playlist.songIds.includes(songId)) {
      await selectSong(songId, shouldPlay);
      return;
    }

    const orderedSongs = playlist.songIds
      .map((id) => songsById.get(id))
      .filter(isPlayableSong);
    const startIndex = orderedSongs.findIndex((song) => song.id === songId);

    if (startIndex === -1) {
      await selectSong(songId, shouldPlay);
      return;
    }

    setActivePlaylistId(playlist.id);
    setSelectedPlaylistId(playlist.id);
    setPlayQueue(orderedSongs.slice(startIndex + 1).map((song) => song.id));
    await selectSong(songId, shouldPlay, { playlistId: playlist.id });
    setStatusText(`playing ${playlist.name}`);
  }

  async function selectSong(songId: string, shouldPlay = settings.autoplayOnSelect, playbackContext?: { playlistId?: string | null; keepPlaylistContext?: boolean }) {
    const targetSong = songsById.get(songId);
    const sameSong = songId === currentId;
    const audio = audioRef.current;

    if (!sameSong) {
      stopCrossfadeAuto();
      crossfadeHandoffRef.current = null;
      setCrossfadePreviewSongId("");
    }
    const nowMs = performance.now();
    const sameSongKey = `${songId}:${shouldPlay ? "play" : "select"}`;

    if (sameSong && selectSongLastSameSongRef.current.key === sameSongKey && nowMs - selectSongLastSameSongRef.current.time < 220) {
      return;
    }

    if (sameSong) {
      selectSongLastSameSongRef.current = { key: sameSongKey, time: nowMs };
    }

    setPlayerError("");

    if (!targetSong) {
      pendingPlayRef.current = false;
      resetPlayCountTracker();
      setIsPlaying(false);
      setStatusText("song not found");
      return;
    }

    if (!getSongPlaybackSourceKey(targetSong) || targetSong.fileExists === false) {
      pendingPlayRef.current = false;
      resetPlayCountTracker();

      setCurrentId(songId);
      void rememberCurrentSong(songId);

      setIsPlaying(false);
      setPlayerError("this audio file is missing. reimport it on this pc.");
      setStatusText("file missing");
      return;
    }

    const shouldKeepPlaylistContext = Boolean(playbackContext?.keepPlaylistContext && activePlaylist?.songIds.includes(targetSong.id));

    if (playbackContext?.playlistId !== undefined) {
      setActivePlaylistId(playbackContext.playlistId);
    } else if (!shouldKeepPlaylistContext && activePlaylistId) {
      setActivePlaylistId(null);
    }

    if (sameSong && audio) {
      stopCrossfadeAuto();
      crossfadeHandoffRef.current = null;
      audio.currentTime = 0;
      timeRef.current = 0;
      setCurrentTime(0);

      if (shouldPlay) {
        armPlayCount(songId, 0);
        await startAudioPlayback("same-song");
      }

      return;
    }

    pendingPlayRef.current = shouldPlay;
    if (shouldPlay) {
      armPlayCount(songId, 0);
    } else {
      resetPlayCountTracker();
    }

    setCurrentId(songId);
    void rememberCurrentSong(songId);
    setCurrentTime(0);
    setCurrentDuration(targetSong.duration || 0);

    if (shouldPlay) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }

  function requestLibraryGridSongSelect(songId: string, shouldPlay?: boolean) {
    if (!songId) return;

    selectSongBurstIntentRef.current = { songId, shouldPlay };

    const nowMs = performance.now();
    const elapsedSinceLastCommit = nowMs - selectSongLastCommitRef.current.time;
    const delay = Math.max(0, 72 - elapsedSinceLastCommit);

    if (selectSongBurstTimerRef.current !== null) {
      return;
    }

    selectSongBurstTimerRef.current = window.setTimeout(() => {
      selectSongBurstTimerRef.current = null;

      const intent = selectSongBurstIntentRef.current;
      selectSongBurstIntentRef.current = null;

      if (!intent) return;

      const key = `${intent.songId}:${intent.shouldPlay === false ? "select" : "play"}`;
      const commitNow = performance.now();

      if (selectSongLastCommitRef.current.key === key && commitNow - selectSongLastCommitRef.current.time < 96) {
        return;
      }

      selectSongLastCommitRef.current = { key, time: commitNow };
      void selectSong(intent.songId, intent.shouldPlay);
    }, delay);
  }

  function togglePlay() {
    if (!currentSong) {
      if (playableSongs[0]) {
        void selectSong(playableSongs[0].id, true);
      }

      return;
    }

    if (isPlaying) {
      stopCrossfadeAuto();
      setIsPlaying(false);
      return;
    }

    if (!getSongPlaybackSourceKey(currentSong) || currentSong.fileExists === false) {
      pendingPlayRef.current = false;
      resetPlayCountTracker();
      setIsPlaying(false);
      setPlayerError("this audio file is missing. reimport it on this pc.");
      setStatusText("file missing");
      return;
    }

    if (!countPlayRef.current && (timeRef.current <= 2 || currentTime <= 2)) {
      armPlayCount(currentSong.id, timeRef.current || currentTime || 0);
    }
    pendingPlayRef.current = true;
    setIsPlaying(true);
  }

  function currentIndex() {
    return playableSongs.findIndex((song) => song.id === currentId);
  }

  function playNext(forcePlay = true, trigger: "manual" | "auto" = "manual") {
    if (trigger === "manual") stopCrossfadeAuto();
    if (!playableSongs.length) return;

    if (trigger === "auto" && repeatMode === "one" && currentSong) {
      const audio = audioRef.current;

      if (audio) {
        try {
          const controller = ensurePlayerController();
          if (controller) controller.seekTo(0);
          else audio.currentTime = 0;
        } catch {
          // ignore seek errors from unavailable audio sources
        }
      }

      timeRef.current = 0;
      setCurrentTime(0);
      void selectSong(currentSong.id, true, currentPlaybackPlaylist ? { playlistId: currentPlaybackPlaylist.id } : undefined);
      return;
    }

    const queuedIndex = playQueue.findIndex((songId) => isPlayableSong(songsById.get(songId)));
    if (queuedIndex !== -1) {
      const queuedSong = songsById.get(playQueue[queuedIndex]);
      setPlayQueue((queue) => queue.slice(queuedIndex + 1));
      if (queuedSong) {
        const queuedBelongsToPlaylist = Boolean(activePlaylist?.songIds.includes(queuedSong.id));
        void selectSong(queuedSong.id, forcePlay, queuedBelongsToPlaylist && activePlaylist ? { playlistId: activePlaylist.id } : undefined);
        return;
      }
    } else if (playQueue.length) {
      setPlayQueue([]);
    }

    if (activePlaylist && currentSong) {
      const playlistIndex = activePlaylistSongs.findIndex((song) => song.id === currentSong.id);

      if (playlistIndex !== -1) {
        if (isShuffle && activePlaylistSongs.length > 1) {
          const { nextSong, queuedSongIds } = buildShuffleQueue(activePlaylistSongs, currentSong.id);

          if (nextSong) {
            setPlayQueue(queuedSongIds);
            void selectSong(nextSong.id, forcePlay, { playlistId: activePlaylist.id });
          }

          return;
        }

        const playlistNext = activePlaylistSongs[playlistIndex + 1] || (repeatPlaylist || repeatMode === "all" ? activePlaylistSongs[0] : null);

        if (playlistNext && playlistNext.id !== currentSong.id) {
          setPlayQueue(activePlaylistSongs.slice(activePlaylistSongs.findIndex((song) => song.id === playlistNext.id) + 1).map((song) => song.id));
          void selectSong(playlistNext.id, forcePlay, { playlistId: activePlaylist.id });
        } else {
          setIsPlaying(false);
          pendingPlayRef.current = false;
          setStatusText(`${activePlaylist.name} ended`);
        }

        return;
      }
    }

    if (isShuffle && playableSongs.length > 1) {
      const { nextSong, queuedSongIds } = buildShuffleQueue(playableSongs, currentId);

      if (nextSong) {
        setActivePlaylistId(null);
        setPlayQueue(queuedSongIds);
        void selectSong(nextSong.id, forcePlay, { playlistId: null });
      }

      return;
    }

    const index = currentIndex();

    if (index === -1) {
      void selectSong(playableSongs[0].id, forcePlay);
      return;
    }

    if (index >= playableSongs.length - 1) {
      if (repeatMode === "all") {
        void selectSong(playableSongs[0].id, forcePlay);
      } else {
        setIsPlaying(false);
        setStatusText("queue ended");
      }

      return;
    }

    void selectSong(playableSongs[index + 1].id, forcePlay);
  }

  function playPrevious() {
    stopCrossfadeAuto();
    if (!playableSongs.length) return;

    const audio = audioRef.current;

    if (audio && audio.currentTime > 4) {
      const controller = ensurePlayerController();
      if (controller) controller.seekTo(0);
      else audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (activePlaylist && currentSong) {
      const playlistIndex = activePlaylistSongs.findIndex((song) => song.id === currentSong.id);

      if (playlistIndex !== -1) {
        const playlistPrevious = activePlaylistSongs[playlistIndex - 1] || (repeatPlaylist || repeatMode === "all" ? activePlaylistSongs[activePlaylistSongs.length - 1] : activePlaylistSongs[0]);
        if (playlistPrevious) void selectSong(playlistPrevious.id, true, { playlistId: activePlaylist.id });
        return;
      }
    }

    const index = currentIndex();

    if (index <= 0) {
      void selectSong(playableSongs[playableSongs.length - 1].id, true);
      return;
    }

    void selectSong(playableSongs[index - 1].id, true);
  }

  function toggleRepeat() {
    setRepeatMode((mode) => {
      if (mode === "all") return "one";
      if (mode === "one") return "off";
      return "all";
    });
  }

  function saveDuration(duration: number) {
    if (!currentSong || !Number.isFinite(duration) || duration <= 0) return;

    const rounded = Math.floor(duration);
    setCurrentDuration(rounded);

    if (rounded !== currentSong.duration) {
      void patchSongLocal(currentSong.id, { duration: rounded });
    }
  }

  function handleCanPlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if ((pendingPlayRef.current || isPlaying) && audio.paused) {
      void startAudioPlayback("can-play");
    }
  }

  function handlePlaying() {
    const song = songRef.current || currentSong;
    if (!song) return;

    pendingPlayRef.current = false;
    setIsPlaying(true);

    pushQueueHistory(song);
    setPlayerError("");
    setStatusText(`playing ${prettyTitle(song.title, 5)}`);
  }

  function queueSeekDraftPaint(percent: number) {
    // Keep scrubbing instant without forcing the whole app to re-render every pointer move.
    seekDraftPercentRef.current = clamp(percent, 0, 100);
  }

  function handleSeek(value: string | number) {
    const audio = audioRef.current;
    const duration = durationRef.current || currentDuration || currentSong?.duration || 0;
    if (!audio || duration <= 0) return;

    const safePercent = clamp(Number(value), 0, 100);
    const nextTime = (safePercent / 100) * duration;
    const controller = ensurePlayerController();
    if (controller) controller.seekTo(nextTime);
    else audio.currentTime = nextTime;
    timeRef.current = nextTime;
    lastProgressUiPaintRef.current = 0;
    lastProgressStatePaintRef.current = 0;
    syncProgressDom(nextTime, duration, true);
    setCurrentTime(nextTime);

    // V341: seeking is temporary only. Next play still starts at 0:00.
  }

  function paintRangeProgress(input: HTMLInputElement | null | undefined, percent: number) {
    if (!input) return;
    input.style.setProperty("--range-progress", `${clamp(percent, 0, 100)}%`);
  }

  function startSeekPreview(value?: string | number, input?: HTMLInputElement | null) {
    const duration = durationRef.current || currentDuration || currentSong?.duration || 0;
    const nextPercent = Number(value);
    const safePercent = Number.isFinite(nextPercent) ? clamp(nextPercent, 0, 100) : clamp(progress, 0, 100);
    const nextTime = duration > 0 ? (safePercent / 100) * duration : 0;

    isSeekingRef.current = true;
    seekDraftPercentRef.current = safePercent;
    setIsSeeking(true);
    setSeekDraftPercent(safePercent);
    paintRangeProgress(input, safePercent);
    syncProgressDom(nextTime, duration, true);
  }

  function previewSeek(value: string | number, input?: HTMLInputElement | null) {
    const duration = durationRef.current || currentDuration || currentSong?.duration || 0;
    const safePercent = clamp(Number(value), 0, 100);
    const nextTime = duration > 0 ? (safePercent / 100) * duration : 0;

    isSeekingRef.current = true;
    seekDraftPercentRef.current = safePercent;
    paintRangeProgress(input, safePercent);
    syncProgressDom(nextTime, duration, false);
    queueSeekDraftPaint(safePercent);
  }

  function commitSeek(value?: string | number) {
    const rawPercent = Number(value ?? seekDraftPercentRef.current);
    const safePercent = Number.isFinite(rawPercent) ? clamp(rawPercent, 0, 100) : clamp(progress, 0, 100);

    if (seekDraftFrameRef.current) {
      window.cancelAnimationFrame(seekDraftFrameRef.current);
      seekDraftFrameRef.current = 0;
    }

    seekDraftPercentRef.current = safePercent;
    setSeekDraftPercent(safePercent);
    handleSeek(safePercent);

    window.setTimeout(() => {
      isSeekingRef.current = false;
      setIsSeeking(false);
      syncProgressDom(timeRef.current, durationRef.current || currentDuration || currentSong?.duration || 0, true);
    }, 0);
  }

  function applyLiveVolumePercent(percent: number, song: Song | null = songRef.current) {
    const safePercent = clamp(Number(percent), 0, 100);
    const baseVolume = safePercent / 100;
    const memoryVolume = settings.perSongVolumeMemory ? clamp(Number(song?.customVolume ?? 1), 0, 1) : 1;
    const gain = settings.volumeNormalization ? clamp(Number(song?.volumeGain ?? 1), 0.2, 2.4) : 1;
    const safeVolume = clamp(baseVolume * memoryVolume * gain, 0, 1);

    liveVolumePendingPercentRef.current = safePercent;

    if (liveVolumeFrameRef.current !== null) {
      window.cancelAnimationFrame(liveVolumeFrameRef.current);
    }

    liveVolumeFrameRef.current = window.requestAnimationFrame(() => {
      liveVolumeFrameRef.current = null;
      setAudioElementVolume(audioRef.current, safeVolume);
      setAudioElementVolume(nextAudioRef.current, safeVolume);
      volumeRef.current = safeVolume;

      if (safeVolume > 0.001) {
        lastNonZeroVolumeRef.current = baseVolume;
      }
    });

    return safeVolume;
  }

  function updateVolumeFast(nextVolume: number) {
    const safeVolume = clamp(Number(nextVolume) || 0, 0, 1);
    const safePercent = Math.round(safeVolume * 100);
    const nextSettings = { ...settings, volume: safeVolume };

    volumeDraftRef.current = safePercent;
    setVolumeDraft(safePercent);
    applyLiveVolumePercent(safePercent);
    setSettings(nextSettings);

    if (!bootedRef.current) return;

    if (saveSettingsTimerRef.current !== null) {
      window.clearTimeout(saveSettingsTimerRef.current);
    }

    saveSettingsTimerRef.current = window.setTimeout(() => {
      window.localitfy.saveSettings(nextSettings).catch(() => undefined);
    }, 180);
  }

  function paintVolumeDraft(percent: number) {
    if (volumeDraftFrameRef.current !== null) {
      window.cancelAnimationFrame(volumeDraftFrameRef.current);
    }

    volumeDraftFrameRef.current = window.requestAnimationFrame(() => {
      volumeDraftFrameRef.current = null;
      setVolumeDraft(percent);
    });
  }

  function previewVolume(value: string | number, input?: HTMLInputElement | null) {
    const safePercent = clamp(Number(value), 0, 100);
    volumeDraftRef.current = safePercent;
    paintVolumeDraft(safePercent);
    paintRangeProgress(input, safePercent);
    input?.style.setProperty("--volume-percent", `${safePercent}%`);
    applyLiveVolumePercent(safePercent);
  }

  function commitVolume(value?: string | number) {
    const safePercent = clamp(Number(value ?? volumeDraftRef.current), 0, 100);
    volumeDraftRef.current = safePercent;

    if (volumeDraftFrameRef.current !== null) {
      window.cancelAnimationFrame(volumeDraftFrameRef.current);
      volumeDraftFrameRef.current = null;
    }

    setVolumeDraft(safePercent);
    updateVolumeFast(safePercent / 100);
    setIsVolumeDragging(false);
  }

  function toggleLike(songId: string) {
    const target = songsById.get(songId) || songs.find((song) => song.id === songId);
    if (!target) return;

    const nextLiked = !target.liked;
    const toastTitle = prettyTitle(target.title, 5);

    setSongs((oldSongs) =>
      oldSongs.map((song) => (song.id === songId ? { ...song, liked: nextLiked } : song))
    );

    showAppToast(
      nextLiked ? `added "${toastTitle}" to liked` : `removed "${toastTitle}" from liked`,
      nextLiked ? "success" : "info"
    );

    void window.localitfy.patchSong(songId, { liked: nextLiked })
      .then((updated) => {
        replaceSong({ ...updated, liked: nextLiked });
      })
      .catch(() => {
        setSongs((oldSongs) =>
          oldSongs.map((song) => (song.id === songId ? { ...song, liked: target.liked } : song))
        );
        showAppToast("could not save like change", "error");
      });
  }

  function askRemoveSong(songId: string) {
    const target = songs.find((song) => song.id === songId);
    if (!target) return;

    setDeleteTarget(target);
  }

  async function removeSong(songId: string) {
    const target = songs.find((song) => song.id === songId);
    if (!target) return;

    const wasCurrent = songId === currentId;
    const removedIndex = songs.findIndex((song) => song.id === songId);
    const nextLocalSongs = songs.filter((song) => song.id !== songId);
    const nextSong =
      nextLocalSongs[removedIndex] || nextLocalSongs[removedIndex - 1] || nextLocalSongs[0] || null;

    setSongContextMenu(null);
    setPlaylistPickerSong((current) => (current?.id === songId ? null : current));
    setPlayQueue((queue) => queue.filter((queuedId) => queuedId !== songId));
    setQueueHistory((history) => history.filter((item) => item.songId !== songId));
    setPlaylists((items) => items.map((item) => ({ ...item, songIds: item.songIds.filter((id) => id !== songId) })));

    setDeleteBusy(true);

    try {
      if (wasCurrent) {
        const audio = audioRef.current;

        stopFade();
        stopProgressLoop();
        audio?.pause();
        audio?.removeAttribute("src");
        audio?.load();

        pendingPlayRef.current = false;
        resetPlayCountTracker();

        setIsPlaying(false);
        setCurrentTime(0);
        setCurrentDuration(0);
        setPlayerError("");
        await window.localitfy.clearDiscordActivity().catch(() => undefined);

        setCurrentId(nextSong?.id || "");

        if (settings.rememberLastSong) {
          const nextSettings = {
            ...settings,
            lastSongId: nextSong?.id || ""
          };

          setSettings(nextSettings);
          await window.localitfy.saveSettings(nextSettings).catch(() => undefined);
        }
      }

      if (editorSong?.id === songId) {
        setEditorSong(null);
      }

      setSongs(nextLocalSongs);
      setStatusText("song removed from library");

      const updatedSongs = await window.localitfy.deleteSong(songId);
      setSongs(applyLibraryOrder(sanitizeSongList(updatedSongs)));
    } catch (error) {
      console.error("[localitfy remove song error]", error);
      setStatusText("could not remove song");
    } finally {
      setDeleteBusy(false);
      setDeleteTarget(null);
    }
  }


  async function removeMissingSongs() {
    const targets = songs.filter((song) => song.fileExists === false);
    if (!targets.length) {
      showAppToast("no missing songs to remove", "info");
      setLibraryFilterMode("all");
      return;
    }

    const targetIds = new Set(targets.map((song) => song.id).filter(Boolean));
    const wasCurrent = currentId ? targetIds.has(currentId) : false;
    const nextLocalSongs = songs.filter((song) => !targetIds.has(song.id));
    const nextSong = nextLocalSongs[0] || null;
    const removedLabel = `${targets.length} missing song${targets.length === 1 ? "" : "s"}`;

    setSongContextMenu(null);
    setPlaylistPickerSong((current) => (current?.id && targetIds.has(current.id) ? null : current));
    setPlayQueue((queue) => queue.filter((queuedId) => !targetIds.has(queuedId)));
    setQueueHistory((history) => history.filter((item) => !targetIds.has(item.songId)));
    setPlaylists((items) => items.map((item) => ({ ...item, songIds: item.songIds.filter((id) => !targetIds.has(id)) })));
    setDeleteTarget((current) => (current?.id && targetIds.has(current.id) ? null : current));

    if (editorSong?.id && targetIds.has(editorSong.id)) {
      setEditorSong(null);
    }

    setDeleteBusy(true);

    try {
      if (wasCurrent) {
        const audio = audioRef.current;

        stopFade();
        stopProgressLoop();
        audio?.pause();
        audio?.removeAttribute("src");
        audio?.load();

        pendingPlayRef.current = false;
        resetPlayCountTracker();

        setIsPlaying(false);
        setCurrentTime(0);
        setCurrentDuration(0);
        setPlayerError("");
        await window.localitfy.clearDiscordActivity().catch(() => undefined);

        setCurrentId(nextSong?.id || "");

        if (settings.rememberLastSong) {
          const nextSettings = {
            ...settings,
            lastSongId: nextSong?.id || ""
          };

          setSettings(nextSettings);
          await window.localitfy.saveSettings(nextSettings).catch(() => undefined);
        }
      }

      setSongs(nextLocalSongs);
      setLibraryFilterMode("all");
      setStatusText(`removed ${removedLabel} from library`);

      let updatedSongs: Song[] | null = null;
      for (const id of targetIds) {
        updatedSongs = await window.localitfy.deleteSong(id);
      }

      if (updatedSongs) {
        setSongs(applyLibraryOrder(sanitizeSongList(updatedSongs)));
      }

      showAppToast(`removed ${removedLabel}`, "success");
    } catch (error) {
      console.error("[localitfy remove missing songs error]", error);
      setStatusText("could not remove missing songs");
      showAppToast("could not remove missing songs", "error");
    } finally {
      setDeleteBusy(false);
      setDeleteTarget(null);
    }
  }

  function openEditor(song: Song) {
    setEditorSong(song);
    setEditTitle(song.title || "");
    setEditArtist(song.artist || "");
    setEditAlbum(song.album || "");
  }

  const selectSongCardAction = useStableCallback((songId: string, shouldPlay?: boolean) => {
    requestLibraryGridSongSelect(songId, shouldPlay);
  });

  const togglePlayCardAction = useStableCallback(() => {
    togglePlay();
  });

  const toggleLikeCardAction = useStableCallback((songId: string) => {
    toggleLike(songId);
  });

  const openEditorCardAction = useStableCallback((song: Song) => {
    openEditor(song);
  });

  const openPlaylistPickerCardAction = useStableCallback((song: Song) => {
    openPlaylistPicker(song);
  });

  const openSongContextMenuCardAction = useStableCallback((event: ReactMouseEvent<HTMLElement>, song: Song) => {
    openSongContextMenu(event, song);
  });

  const startSongDragCardAction = useStableCallback((event: DragEvent<HTMLElement>, songId: string) => {
    startSongDrag(event, songId);
  });

  const startPointerSongDragCardAction = useStableCallback((event: PointerEvent<HTMLElement>, songId: string) => {
    startPointerSongDrag(event, songId);
  });

  const dragOverSongCardAction = useStableCallback((event: DragEvent<HTMLElement>, songId: string) => {
    handleLibraryDragOver(event, songId);
  });

  const dragLeaveSongCardAction = useStableCallback((event: DragEvent<HTMLElement>, songId: string) => {
    handleLibraryDragLeave(event, songId);
  });

  const dropSongCardAction = useStableCallback((event: DragEvent<HTMLElement>, songId: string) => {
    handleLibraryDrop(event, songId);
  });

  const endSongDragCardAction = useStableCallback(() => {
    endSongDrag();
  });

  const selectPlaylistSongAction = useStableCallback((songId: string) => {
    void playSongFromPlaylist(selectedPlaylist?.id || "", songId, true);
  });

  const startPlaylistSongDragAction = useStableCallback((event: DragEvent<HTMLElement>, songId: string) => {
    startSongDrag(event, songId);
  });

  const dropPlaylistSongAction = useStableCallback((playlistId: string, songId: string, targetSongId: string, side: LibraryDropSide) => {
    handlePlaylistSongDrop(playlistId, songId, targetSongId, side);
  });

  const appendPlaylistSongAction = useStableCallback((playlistId: string, songId: string) => {
    handlePlaylistSongAppend(playlistId, songId);
  });

  const endPlaylistSongDragAction = useStableCallback(() => {
    endSongDrag();
  });

  const openPlaylistSongContextMenuAction = useStableCallback((event: ReactMouseEvent<HTMLElement>, song: Song) => {
    openSongContextMenu(event, song);
  });

  const removePlaylistSongAction = useStableCallback((playlistId: string, songId: string) => {
    removeSongFromPlaylist(playlistId, songId);
  });

  async function saveEditor() {
    if (!editorSong) return;

    await patchSongLocal(editorSong.id, {
      title: editTitle.trim() || "untitled",
      artist: editArtist.trim() || "unknown artist",
      album: editAlbum.trim() || "local files"
    });

    setEditorSong(null);
  }

  async function randomizeCover() {
    await randomizeCoverForSong(editorSong);
  }

  async function pickCover() {
    await chooseCoverFromPc(editorSong);
  }

  function renderPlaylistCollage(list: Song[], className = "playlistCoverCollage") {
    const coverSongs = list.slice(0, 4);
    const tiles = Array.from({ length: 4 }, (_, index) => coverSongs[index] ?? null);

    return (
      <div className={className} aria-hidden="true">
        {tiles.map((song, index) => (
          <div className={song ? "playlistCoverTile" : "playlistCoverTile empty"} key={song ? `${song.id}-${index}` : `empty-${index}`}>
            {song ? <Cover song={song} className="playlistCoverImage" /> : <span><Images size={18} aria-hidden="true" /></span>}
          </div>
        ))}
      </div>
    );
  }


  function renderSongRows(list: Song[], className = "songList fullList") {
    return (
      <VirtualSongRows
        list={list}
        className={className}
        currentId={currentId}
        isPlaying={isPlaying}
        draggedSongId={draggedSongId}
        libraryDragOverSongId={libraryDragOverSongId}
        libraryDropSide={libraryDropSide}
        draggedSongTitle={draggedSongTitle}
        onAreaDragOver={handleLibraryAreaDragOver}
        onAreaDragLeave={handleLibraryAreaDragLeave}
        onAreaDrop={handleLibraryAreaDrop}
        onSelectSong={selectSongCardAction}
        onTogglePlay={togglePlayCardAction}
        onToggleLike={toggleLikeCardAction}
        onOpenEditor={openEditorCardAction}
        onOpenPlaylistPicker={openPlaylistPickerCardAction}
        onOpenSongContextMenu={openSongContextMenuCardAction}
        onStartSongDrag={startSongDragCardAction}
        onDragOverSong={dragOverSongCardAction}
        onDragLeaveSong={dragLeaveSongCardAction}
        onDropSong={dropSongCardAction}
        onDragEnd={endSongDragCardAction}
      />
    );
  }


  function renderHomeSongCards(list: Song[], className: string) {
    return (
      <VirtualHomeSongCards
        list={list}
        className={className}
        currentId={currentId}
        isPlaying={isPlaying}
        draggedSongId={draggedSongId}
        libraryDragOverSongId={libraryDragOverSongId}
        libraryDropSide={libraryDropSide}
        draggedSongTitle={draggedSongTitle}
        onAreaDragOver={handleLibraryAreaDragOver}
        onAreaDragLeave={handleLibraryAreaDragLeave}
        onAreaDrop={handleLibraryAreaDrop}
        onSelectSong={selectSongCardAction}
        onTogglePlay={togglePlayCardAction}
        onToggleLike={toggleLikeCardAction}
        onOpenEditor={openEditorCardAction}
        onOpenPlaylistPicker={openPlaylistPickerCardAction}
        onOpenSongContextMenu={openSongContextMenuCardAction}
        onStartSongDrag={startSongDragCardAction}
        onPointerStartSongDrag={startPointerSongDragCardAction}
        registerLibrarySongElement={registerLibrarySongElement}
        onDragOverSong={dragOverSongCardAction}
        onDragLeaveSong={dragLeaveSongCardAction}
        onDropSong={dropSongCardAction}
        onDragEnd={endSongDragCardAction}
      />
    );
  }

  function dismissOnboarding() {
    markOnboardingSeenForThisRelease();

    setOnboardingDevPreview(false);
    setOnboardingOpen(false);
  }

  function skipOnboarding() {
    trackOnboardingSkipped(undefined, songs.length);
    dismissOnboarding();
  }

  async function handleOnboardingImportMusic() {
    setStatusText("choose local audio to import");
    await importSongs();
    setStatusText("onboarding import flow complete");
  }

  function handleOnboardingDownloads() {
    changeView("downloads", "onboarding");
    setStatusText("downloads will be ready after setup");
  }

  function handleOnboardingTheme(themeId: string) {
    if (!themeId) return;

    const pickedTheme = themes.find((themeItem) => themeItem.id === themeId);
    if (!pickedTheme) {
      return;
    }

    const nextTheme = pickedTheme.id as ThemeId;

    void updateSettingsPatch(
      {
        theme: nextTheme,
        customThemeEnabled: false
      },
      false
    );

    setStatusText(`${pickedTheme.name} theme selected`);
  }

  function handleOnboardingDiscord(enabled: boolean) {
    void updateSetting("discordEnabled", enabled, true);
    setStatusText(enabled ? "Discord activity enabled" : "Discord activity disabled");
    showAppToast(enabled ? "Discord activity enabled" : "Discord activity disabled", "info");
  }

  function handleOnboardingStartListening() {
    trackOnboardingCompleted(undefined, songs.length);
    dismissOnboarding();
    changeView("home", "onboarding");
    setStatusText(songs.length ? "ready to listen" : "add songs when you are ready");
  }


  const retryStartup = () => {
    setBootError(null);
    setBootLogCopied(false);
    setReady(false);
    setBootRetryKey((value) => value + 1);
  };

  const copyStartupLog = () => {
    const body = [
      "localtify startup error",
      `version: ${APP_VERSION}`,
      `message: ${bootError || "unknown error"}`
    ].join("\n");

    console.error(body);
    const writeLog = navigator.clipboard?.writeText?.(body);
    if (writeLog) {
      void writeLog.then(() => {
        setBootLogCopied(true);
      }).catch(() => {
        setBootLogCopied(true);
      });
    } else {
      setBootLogCopied(true);
    }
  };

  useEffect(() => {
    feedbackPromptBlockersRef.current = {
      onboardingOpen,
      settingsOpen,
      whatsNewOpen,
      editorOpen: Boolean(editorSong),
      playlistPickerOpen: Boolean(playlistPickerSong),
      deleteOpen: Boolean(deleteTarget),
      importBusy: Boolean(importAnimation?.visible) || libraryScanBusy,
      downloadBusy,
      spotifyDownloadBusy,
      libraryScanBusy
    };
  }, [
    deleteTarget,
    downloadBusy,
    editorSong,
    importAnimation?.visible,
    libraryScanBusy,
    onboardingOpen,
    playlistPickerSong,
    settingsOpen,
    spotifyDownloadBusy,
    whatsNewOpen
  ]);

  function feedbackPromptWasSeen() {
    try {
      return window.localStorage.getItem(FEEDBACK_PROMPT_SEEN_KEY) === "done";
    } catch {
      return true;
    }
  }

  function markFeedbackPromptSeen() {
    try {
      window.localStorage.setItem(FEEDBACK_PROMPT_SEEN_KEY, "done");
    } catch {
      // Ignore storage failures. The popup must never break the player.
    }
  }


  function feedbackPromptIsBlocked() {
    const blockers = feedbackPromptBlockersRef.current;

    return (
      blockers.onboardingOpen ||
      blockers.settingsOpen ||
      blockers.whatsNewOpen ||
      blockers.editorOpen ||
      blockers.playlistPickerOpen ||
      blockers.deleteOpen ||
      blockers.importBusy ||
      blockers.downloadBusy ||
      blockers.spotifyDownloadBusy ||
      blockers.libraryScanBusy
    );
  }

  const openFeedbackPrompt = useCallback((manual = false) => {
    setFeedbackPromptManualOpen(manual);
    setFeedbackStatus({ kind: "idle", message: "" });
    setFeedbackPromptOpen(true);
  }, []);

  const closeFeedbackPrompt = useCallback((markSeen = true) => {
    if (markSeen) markFeedbackPromptSeen();
    setFeedbackPromptOpen(false);
    setFeedbackPromptManualOpen(false);
    setFeedbackSendBusy(false);
    setFeedbackStatus({ kind: "idle", message: "" });
  }, []);

  useEffect(() => {
    if (!ready) return;

    const openFeedbackNow = () => {
      setQuery("");
      setSettingsSearch("");
      setSettingsOpen(false);
      setFeedbackCategory("bug");
      openFeedbackPrompt(true);
      setStatusText("feedback box opened");
      showAppToast("feedback box opened", "success");
    };

    const isFeedbackCommand = (value: unknown) => {
      const query = String(value || "").trim().toLowerCase();
      return query === "/feedback" || query === "feedback";
    };

    const looksLikeSearchInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLInputElement)) return false;
      const haystack = [
        target.className,
        target.placeholder,
        target.getAttribute("aria-label"),
        target.getAttribute("name"),
        target.getAttribute("type")
      ].map((item) => String(item || "").toLowerCase()).join(" ");

      return haystack.includes("search") || haystack.includes("query");
    };

    const handleExternalFeedback = (event: Event) => {
      event.preventDefault?.();
      openFeedbackNow();
    };

    const handleSearchInputCommand = (event: Event) => {
      const target = event.target;

      if (!looksLikeSearchInput(target)) return;
      if (!isFeedbackCommand((target as HTMLInputElement).value)) return;

      (target as HTMLInputElement).value = "";
      event.preventDefault?.();
      event.stopPropagation?.();
      openFeedbackNow();
    };

    const handleFeedbackButtonClick = (event: MouseEvent) => {
      const target = event.target;
      const element = target instanceof Element
        ? target.closest("[data-localtify-feedback-open], .feedbackSettingsButtonV331")
        : null;

      if (!element) return;

      event.preventDefault();
      event.stopPropagation();
      openFeedbackNow();
    };

    window.addEventListener("localtify:open-feedback", handleExternalFeedback as EventListener);
    document.addEventListener("input", handleSearchInputCommand, true);
    document.addEventListener("click", handleFeedbackButtonClick, true);

    return () => {
      window.removeEventListener("localtify:open-feedback", handleExternalFeedback as EventListener);
      document.removeEventListener("input", handleSearchInputCommand, true);
      document.removeEventListener("click", handleFeedbackButtonClick, true);
    };
  }, [openFeedbackPrompt, ready]);

  useEffect(() => {
    if (!ready || feedbackPromptWasSeen()) return;

    let cancelled = false;
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const attemptOpen = () => {
      if (cancelled || feedbackPromptWasSeen()) return;

      if (feedbackPromptIsBlocked()) {
        timer = window.setTimeout(attemptOpen, FEEDBACK_PROMPT_RETRY_DELAY_MS);
        return;
      }

      openFeedbackPrompt(false);
    };

    timer = window.setTimeout(attemptOpen, FEEDBACK_PROMPT_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [openFeedbackPrompt, ready]);

  const submitFeedbackPrompt = useCallback(async () => {
    const message = feedbackMessage.trim();

    if (message.length < 4) {
      setFeedbackStatus({ kind: "error", message: "Write a little more so the feedback is useful." });
      return;
    }

    if (message.length > FEEDBACK_MESSAGE_MAX_LENGTH) {
      setFeedbackStatus({ kind: "error", message: "That feedback is too long. Keep it under 1500 characters." });
      return;
    }

    const now = Date.now();
    if (now - feedbackLastSentAtRef.current < 10_000) {
      setFeedbackStatus({ kind: "error", message: "Hold on a few seconds before sending another report." });
      return;
    }

    if (!window.localitfy?.sendFeedback) {
      setFeedbackStatus({ kind: "error", message: "Feedback bridge is not ready in this build." });
      return;
    }

    setFeedbackSendBusy(true);
    setFeedbackStatus({ kind: "idle", message: "" });

    try {
      const result = await window.localitfy.sendFeedback({
        category: feedbackCategory,
        message,
        appVersion: APP_VERSION,
        platform: platformInfo.label,
        diagnostics: {
          appVersion: APP_VERSION,
          platform: platformInfo.label,
          electronVersion: performanceStatus?.electronVersion || "",
          chromeVersion: performanceStatus?.chromeVersion || "",
          songCount: songs.length,
          playlistCount: playlists.length,
          downloadsFolder: downloadFolderLabel || settings.downloadFolder || "default downloads folder",
          discordRpc: settings.discordEnabled ? "enabled" : "disabled",
          updateStatus: updatePrompt.visible ? updateStatusLabel(updatePrompt) : "not visible",
          feedbackWebhook: feedbackConfigStatus?.configured
            ? feedbackConfigStatus.valid
              ? "enabled"
              : "configured but invalid"
            : "not configured"
        }
      });

      if (!result?.ok) {
        const code = String((result as any)?.code || "");
        const message =
          code === "webhook_missing"
            ? "Discord feedback is not configured. Add LOCALTIFY_FEEDBACK_WEBHOOK_URL in your env."
            : code === "webhook_invalid"
              ? "Discord webhook URL is invalid. Use a real discord.com/api/webhooks URL."
              : code === "webhook_failed"
                ? result?.error || "Discord did not accept the feedback. Check the webhook."
                : result?.error || "Could not send feedback right now.";

        setFeedbackStatus({ kind: "error", message });
        return;
      }

      feedbackLastSentAtRef.current = Date.now();
      markFeedbackPromptSeen();
      setFeedbackStatus({ kind: "success", message: "Sent successfully. Thanks, I will review this." });
      setFeedbackMessage("");

      window.setTimeout(() => {
        setFeedbackPromptOpen(false);
        setFeedbackPromptManualOpen(false);
        setFeedbackStatus({ kind: "idle", message: "" });
      }, 1500);
    } catch (error) {
      setFeedbackStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not send feedback right now."
      });
    } finally {
      setFeedbackSendBusy(false);
    }
  }, [
    downloadFolderLabel,
    feedbackCategory,
    feedbackConfigStatus?.configured,
    feedbackConfigStatus?.valid,
    feedbackMessage,
    performanceStatus?.chromeVersion,
    performanceStatus?.electronVersion,
    platformInfo.label,
    playlists.length,
    settings.discordEnabled,
    settings.downloadFolder,
    songs.length,
    updatePrompt
  ]);

  if (!ready) {
    const isBootError = Boolean(bootError);

    if (onboardingOpen && !onboardingDevPreview && !isBootError) {
      return (
        <main className="onboardingBootBlank" aria-label="localtify is preparing onboarding">
          <span>localtify</span>
        </main>
      );
    }

    const bootArtSrc = `${loadingScreenGif}#boot-${bootRetryKey}`;

    return (
      <main className={`loadingScreen bootScreen ${isBootError ? "bootScreenError" : ""}`} aria-label="localtify is loading">
        <div className="bootGlow" aria-hidden="true" />

        <section className="bootCard" role={isBootError ? "alert" : "status"} aria-live={isBootError ? "assertive" : "polite"}>
          <div className="bootArtWrap" aria-hidden="true">
            <img key={`boot-art-${bootRetryKey}`} className="bootArt" src={bootArtSrc} alt="" loading="eager" decoding="async" />
            <span className="bootArtAura" />
          </div>

          <div className="bootCopy">
            <div className="bootBrandRow">
              <img className="bootLogo" src={localtifyLogo} alt="" aria-hidden="true" />
              <span>localtify</span>
            </div>

            {isBootError ? (
              <>
                <h1>localtify had trouble starting</h1>
                <p>{bootError}</p>
                <div className="bootActions">
                  <button type="button" className="bootButton bootButtonPrimary" onClick={retryStartup}>Retry</button>
                  <button type="button" className="bootButton" onClick={copyStartupLog}>
                    {bootLogCopied ? "Copied error" : "Open logs"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1>loading your library...</h1>
                <p>{bootStage}</p>
                <ul className="bootAssetList" aria-label="startup assets">
                  {BOOT_STEPS.map((step, index) => {
                    const state = index < bootStepIndex ? "done" : index === bootStepIndex ? "active" : "waiting";
                    return (
                      <li key={step.label} className={`bootAssetItem ${state}`}>
                        <span className="bootAssetDot" aria-hidden="true" />
                        <span className="bootAssetText">
                          <strong>{step.label}</strong>
                          <small>{step.detail}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="bootProgress" aria-hidden="true"><span /></div>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  if (onboardingOpen || onboardingDevPreview) {
    return (
      <Onboarding
        appVersion={APP_VERSION}
        songsCount={songs.length}
        currentTheme={currentTheme?.id ?? settings.theme}
        discordEnabled={settings.discordEnabled}
        onChooseTheme={handleOnboardingTheme}
        onSetDiscordEnabled={handleOnboardingDiscord}
        onImportMusic={handleOnboardingImportMusic}
        onOpenDownloads={handleOnboardingDownloads}
        onStartListening={handleOnboardingStartListening}
        onSkip={skipOnboarding}
      />
    );
  }

  const repeatButtonStateText = repeatMode === "one" ? "1" : repeatMode === "all" ? "all" : "";
  const repeatButtonTitle = repeatMode === "one" ? "Loop current song is on" : repeatMode === "all" ? "Loop library is on" : "Loop is off";
  const repeatButtonAriaLabel = repeatButtonTitle;

  const nowPlayingMotionNonce = Number(nowPlayingTransitionKey.split(":").pop() || "0");
  const nowPlayingSongMotionClass =
    nowPlayingMotionNonce === 0
      ? "nowPlayingSongInitial"
      : nowPlayingMotionNonce % 2 === 0
        ? "nowPlayingSongEven"
        : "nowPlayingSongOdd";


  const simpleModeView = (
    <section className="simpleShell">
      <header className="simpleTopbar">
        <div className="simpleBrand">
          <div className="simpleBrandLogo"><img className="loadingLogoImage" src={localtifyLogo} alt="" aria-hidden="true" /></div>
          <div>
            <strong>localtify</strong>
            <small>simple mode</small>
          </div>
        </div>

        <div className="simpleTopActions">
          <button className="simpleAction iconTextButton" onClick={importSongs}>
            <FolderPlus className="buttonInlineIcon" size={17} strokeWidth={2.1} aria-hidden="true" />
            add audio
          </button>

          <button type="button" className="simpleGhost" onClick={() => openSettingsPanel()}>
            settings
          </button>
        </div>
      </header>

      <section
        className={`simpleHero ambientSurface heroLayoutMotion ${settings.heroExpanded ? "simpleHeroExpanded" : "simpleHeroCompact"}`}
        style={ambientStyle}
      >
        <div className="heroAmbiencePulse" aria-hidden="true" />
        <div
          className={`simpleHeroArtSwap nowPlayingArtSwap ${nowPlayingSongMotionClass}`}
          data-song-motion-key={nowPlayingTransitionKey}
        >
          <Cover song={currentSong} className="simpleHeroArt" />
        </div>

        <div className={`simpleHeroText nowPlayingCopySwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
          <small className={`nowPlayingEyebrowSwap ${nowPlayingSongMotionClass}`} title={currentNowPlayingLabel}>{currentNowPlayingLabel}</small>
          <h2 className={`nowPlayingTitleSwap ${nowPlayingSongMotionClass}`}>{currentSong ? prettyTitle(currentSong.title, 7) : "nothing playing"}</h2>
          <p className={`nowPlayingArtistSwap ${nowPlayingSongMotionClass}`}>{currentSong ? prettyMeta(currentSong.artist) : "import a song to begin"}</p>

          <div className="simpleControls">
            <button className="circleButton" onClick={playPrevious} aria-label="previous song">
              <SkipBack className="playerControlIcon" size={17} strokeWidth={2.15} aria-hidden="true" />
            </button>
            <button className={`circleButton main ${playButtonBurst ? `playButtonBurst playButtonBurst${playButtonBurst % 2}` : ""}`} onClick={togglePlay} aria-label={isPlaying ? "pause" : "play"}>
              {isPlaying ? (
                <Pause className="playerControlIcon" size={18} strokeWidth={2.2} fill="none" aria-hidden="true" />
              ) : (
                <Play className="playerControlIcon playIcon" size={18} strokeWidth={2.2} fill="none" aria-hidden="true" />
              )}
            </button>
            <button className="circleButton" onClick={() => playNext(true)} aria-label="next song">
              <SkipForward className="playerControlIcon" size={17} strokeWidth={2.15} aria-hidden="true" />
            </button>
            <button
              className={`circleButton repeatButton ${repeatMode !== "off" ? `active repeat-${repeatMode}` : ""}`}
              onClick={toggleRepeat}
              type="button"
              aria-label={repeatButtonAriaLabel}
              aria-pressed={repeatMode !== "off"}
              title={repeatButtonTitle}
              data-repeat-mode={repeatMode}
            >
              <Repeat2 className="playerControlIcon" size={16} strokeWidth={2.15} aria-hidden="true" />
              {repeatButtonStateText ? <span className="repeatStateMark" aria-hidden="true">{repeatButtonStateText}</span> : null}
            </button>
          </div>

          <div className="simpleProgress">
            <span ref={(node) => { progressTimeLabelRefs.current[0] = node; }}>{formatTime(displayedTime)}</span>
            <input
              ref={(node) => { progressInputRefs.current[0] = node; }}
              type="range"
              min="0"
              max="100"
              step="0.1"
              defaultValue={displayedProgress}
              style={progressRangeStyle}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                startSeekPreview(event.currentTarget.value, event.currentTarget);
              }}
              onInput={(event) => previewSeek(event.currentTarget.value, event.currentTarget)}
              onChange={(event) => previewSeek(event.currentTarget.value, event.currentTarget)}
              onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture?.(event.pointerId);
                commitSeek(event.currentTarget.value);
              }}
              onPointerCancel={(event) => commitSeek(event.currentTarget.value)}
              onKeyUp={(event) => commitSeek(event.currentTarget.value)}
              onBlur={(event) => isSeeking && commitSeek(event.currentTarget.value)}
            />
            <span ref={(node) => { progressDurationLabelRefs.current[0] = node; }}>{formatTime(currentDuration || currentSong?.duration || 0)}</span>
          </div>

          <div className="heroQuickActions simpleHeroActions">
            <button className="heroTinyButton" type="button" onClick={toggleHeroExpanded}>
              {settings.heroExpanded ? "compact player" : "expand player"}
            </button>
          </div>
        </div>
      </section>

      <section className={`simpleLibraryPanel ${settings.homeExpanded ? "simpleLibraryExpanded" : "simpleLibraryCompact"}`}>
        <div className="simpleLibraryHead">
          <div className="simpleLibraryTitle">
            <strong>library</strong>
            <small>{songs.length} song{songs.length === 1 ? "" : "s"}</small>
          </div>

          <div className="simpleLibraryControls">
            <input
              className="simpleSearch"
              value={query}
              onChange={(event) => handleSearchInput(event.currentTarget.value)}
              placeholder="search songs... try /feedback"
            />

            <button
              className="expandLibraryButton"
              type="button"
              onClick={() => updateSetting("homeExpanded", !settings.homeExpanded)}
              aria-pressed={settings.homeExpanded}
            >
              {settings.homeExpanded ? "compact" : "expand"}
            </button>
          </div>
        </div>

        {settings.homeExpanded
          ? renderHomeSongCards(filteredSongs, "homeAlbumGrid simpleAlbumGrid")
          : renderSongRows(filteredSongs, "songList simpleList")}
      </section>
    </section>
  );



  function renderSettingsRail(mode: "page" | "modal" = "page") {
    const shownTabs = visibleSettingsTabs;

    return (
      <aside className={`settingsCategoryRail settingsCategoryRailV027 ${mode === "page" ? "settingsCategoryRailPage" : "settingsCategoryRailModal"}`} aria-label="settings categories">
        <label className="settingsSearchBoxV027">
          <span>search settings</span>
          <input
            value={settingsSearch}
            onChange={(event) => handleSettingsSearchInput(event.currentTarget.value)}
            placeholder="Search settings"
            aria-label="Search settings"
          />
        </label>

        <p className="settingsSearchHintV027">{settingsSearchResultLabel}</p>

        {shownTabs.length ? (
          shownTabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                className={`settingsCategoryButton ${settingsCategory === tab.id ? "active" : ""}`}
                type="button"
                onClick={() => setSettingsCategory(tab.id)}
                aria-pressed={settingsCategory === tab.id}
              >
                <span className="settingsCategoryIcon" aria-hidden="true">
                  <Icon className="settingsLucideIcon" size={19} strokeWidth={2.05} fill="none" />
                </span>
                <span className="settingsCategoryCopy">
                  <strong>{tab.label}</strong>
                  <span>{tab.description}</span>
                </span>
              </button>
            );
          })
        ) : (
          <div className="settingsNoSearchResultsV027">
            <strong>Nothing matched</strong>
            <span>Try words like discord, privacy, theme, cover, update, volume.</span>
          </div>
        )}
      </aside>
    );
  }






  function renderFeedbackSettingsCard() {
    if (settingsCategory !== "advanced") return null;

    const feedbackReady = Boolean(feedbackConfigStatus?.configured && feedbackConfigStatus?.valid);
    const feedbackStatusLabel = feedbackConfigStatus
      ? feedbackConfigStatus.label || (feedbackReady ? "Discord feedback enabled" : "Discord feedback not configured")
      : "Checking feedback status...";
    const feedbackStatusMessage = feedbackConfigStatus?.message ||
      (feedbackReady ? "Feedback will be delivered to your Discord channel." : "Add LOCALTIFY_FEEDBACK_WEBHOOK_URL to your .env or packaged resources to enable Discord delivery.");

    return (
      <section className={`settingsPageCard feedbackSettingsCardV331 ${feedbackReady ? "feedbackReady" : "feedbackNotReady"}`} aria-label="Send feedback">
        <div className="feedbackSettingsHeaderV331">
          <span className="feedbackSettingsIconV331" aria-hidden="true">✦</span>
          <div className="settingsSectionTitle">
            <span>feedback</span>
            <strong>Send feedback</strong>
            <small>Report bugs, UI issues, or feature ideas directly from localtify. Type feedback or /feedback in search, or press this button.</small>
          </div>
        </div>

        <div className={`feedbackWebhookStatusV337 ${feedbackReady ? "ready" : "notReady"}`}>
          <strong>{feedbackStatusLabel}</strong>
          <small>{feedbackStatusMessage}</small>
          {feedbackConfigStatus?.envName ? <em>{feedbackConfigStatus.envName}</em> : null}
        </div>

        <button
          type="button"
          className="feedbackSettingsButtonV331 localtifyProximityTarget"
          data-localtify-feedback-open="true"
          onClick={() => openFeedbackPrompt(true)}
        >
          <span>
            <strong>Open feedback box</strong>
            <small>{feedbackReady ? "Send a short report straight to the feedback channel." : "You can test the popup UI, but delivery needs the webhook env."}</small>
          </span>
          <em>open</em>
        </button>
      </section>
    );
  }


  function renderFeedbackPrompt() {
    if (!feedbackPromptOpen) return null;

    const remaining = FEEDBACK_MESSAGE_MAX_LENGTH - feedbackMessage.length;
    const feedbackReady = feedbackMessage.trim().length >= 4;

    return (
      <AnimatePresence>
        <Motion.div
          className="feedbackPromptOverlayV331"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedbackPromptTitleV329"
        >
          <Motion.div
            className={`feedbackPromptCardV331 ${feedbackStatus.kind === "success" ? "feedbackSentV337" : ""} ${feedbackSendBusy ? "feedbackSendingV337" : ""}`}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="feedbackPromptTopV331">
              <div className="feedbackPromptBrandV331">
                <span className="feedbackPromptLogoV331" aria-hidden="true">
                  <img src={localtifyLogo} alt="" />
                </span>
                <span>
                  <em>localtify feedback</em>
                  <strong>bug reports + suggestions</strong>
                </span>
              </div>

              <button
                type="button"
                className="feedbackPromptCloseV331"
                onClick={() => closeFeedbackPrompt(!feedbackPromptManualOpen)}
                aria-label="Close feedback popup"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="feedbackPromptCopyV331">
              <span className="feedbackPromptBadgeV331">quick check-in</span>
              <h2 id="feedbackPromptTitleV329">{FEEDBACK_PROMPT_COPY.title}</h2>
              <p>{FEEDBACK_PROMPT_COPY.body}</p>
              <p>{FEEDBACK_PROMPT_COPY.footer}</p>
            </div>

            <div className="feedbackCategoryRowV331" role="group" aria-label="Feedback type">
              {FEEDBACK_CATEGORY_OPTIONS.map((option) => {
                const active = feedbackCategory === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`feedbackCategoryButtonV331 ${active ? "active" : ""}`}
                    onClick={() => {
                      setFeedbackCategory(option.id);
                      if (feedbackStatus.kind !== "idle") setFeedbackStatus({ kind: "idle", message: "" });
                    }}
                    aria-pressed={active}
                  >
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>

            <label className={`feedbackTextareaWrapV331 ${feedbackMessage.trim().length > 0 ? "isTyping" : ""} ${feedbackReady ? "isReady" : ""}`}>
              <span>Your message</span>
              <textarea
                value={feedbackMessage}
                onChange={(event) => {
                  const next = event.target.value.slice(0, FEEDBACK_MESSAGE_MAX_LENGTH);
                  setFeedbackMessage(next);
                  if (feedbackStatus.kind !== "idle") setFeedbackStatus({ kind: "idle", message: "" });
                }}
                placeholder="Tell me what broke, what looks weird, or what feature you want..."
                maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
                disabled={feedbackSendBusy}
              />
              <small>{remaining} characters left</small>
            </label>

            {feedbackStatus.message ? (
              <div className={`feedbackStatusV331 ${feedbackStatus.kind}`} role="status">
                {feedbackStatus.message}
              </div>
            ) : null}

            <div className="feedbackPromptActionsV331">
              <button
                type="button"
                className="feedbackMaybeButtonV331"
                onClick={() => closeFeedbackPrompt(!feedbackPromptManualOpen)}
                disabled={feedbackSendBusy}
              >
                Maybe later
              </button>
              <button
                type="button"
                className={`feedbackSendButtonV331 localtifyProximityTarget ${feedbackReady ? "isReady" : "isLocked"} ${feedbackSendBusy ? "isSending" : ""}`}
                onClick={submitFeedbackPrompt}
                disabled={feedbackSendBusy || feedbackStatus.kind === "success" || !feedbackReady}
              >
                <span className="feedbackSendTextV334">{feedbackStatus.kind === "success" ? "Sent" : feedbackSendBusy ? "Sending..." : "Send"}</span>
                <span className="feedbackSendSparkV334" aria-hidden="true"><Send size={14} strokeWidth={2.4} /></span>
              </button>
            </div>
          </Motion.div>
        </Motion.div>
      </AnimatePresence>
    );
  }


  function renderAudioEffectsCard() {
    if (settingsCategory !== "playback") return null;

    const effectMode = getAudioEffectMode();

    const modeOptions: Array<{
      id: "normal" | "nightcore" | "daycore";
      label: string;
      note: string;
    }> = [
      { id: "normal", label: "Normal", note: "Uses the speed and volume controls above." },
      { id: "nightcore", label: "Nightcore", note: "Higher pitch with a faster preset." },
      { id: "daycore", label: "Daycore", note: "Lower pitch with a slower preset." }
    ];

    return (
      <section className="settingsPageCard playbackLabCardV343" aria-label="Pitch presets">
        <div className="settingsSectionTitle">
          <span>optional sound preset</span>
          <strong>Pitch presets</strong>
          <small>Normal is the clean default. Nightcore and Daycore are one-tap styles, not extra volume or speed sliders.</small>
        </div>

        <div className="playbackModeGridV343">
          {modeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`playbackModeChoiceV343 ${effectMode === option.id ? "active" : ""}`}
              onClick={() => void updateSetting("audioEffectMode" as any, option.id as any, true)}
              aria-pressed={effectMode === option.id}
            >
              <strong>{option.label}</strong>
              <small>{option.note}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  function renderSidebarBehaviorRestoreCard() {
    if (settingsCategory !== "appearance") return null;

    const sidebarModeOptions: Array<{
      id: "fixed" | "slim" | "hover";
      label: string;
      note: string;
      preview: string;
    }> = [
      {
        id: "fixed",
        label: "Fixed",
        note: "Full sidebar always visible.",
        preview: "steady"
      },
      {
        id: "slim",
        label: "Slim",
        note: "Icons only, more room for the app.",
        preview: "compact"
      },
      {
        id: "hover",
        label: "Hover open",
        note: "Slim normally, slides open when hovered.",
        preview: "slide"
      }
    ];

    return (
      <section className="settingsPageCard sidebarBehaviorRestoreCardV327" aria-label="Sidebar behavior">
        <div className="settingsSectionTitle sidebarBehaviorTitleV327">
          <span>layout</span>
          <strong>Sidebar behavior</strong>
          <small>Bring back fixed, slim, or hover-open sidebar without restoring the noisy visual settings panel.</small>
        </div>

        <div className="sidebarBehaviorPreviewV327" data-mode={settings.sidebarBehavior || "fixed"} aria-hidden="true">
          <span className="sidebarPreviewRailV327">
            <i />
            <i />
            <i />
          </span>
          <span className="sidebarPreviewPanelV327">
            <b />
            <b />
            <b />
          </span>
        </div>

        <div className="sidebarBehaviorChoicesV327" role="group" aria-label="Choose sidebar behavior">
          {sidebarModeOptions.map((option) => {
            const active = (settings.sidebarBehavior || "fixed") === option.id;

            return (
              <button
                key={option.id}
                type="button"
                className={`sidebarBehaviorChoiceV327 ${active ? "active" : ""}`}
                onClick={() => updateSetting("sidebarBehavior", option.id)}
                aria-pressed={active}
              >
                <span className="sidebarChoiceDotV327" aria-hidden="true" />
                <span className="sidebarChoiceCopyV327">
                  <strong>{option.label}</strong>
                  <small>{option.note}</small>
                </span>
                <em>{option.preview}</em>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function renderSettingsCategoryContent() {
    return (
      <>
        <Suspense
          fallback={
            <div className="settingsPageCard settingsLazyLoading" role="status" aria-live="polite">
              <div className="settingsSectionTitle">
                <span>settings</span>
                <strong>loading this section</strong>
                <small>only loading the panel you opened, so startup stays lighter.</small>
              </div>
            </div>
          }
        >
          <SettingsCategoryContent
          settingsCategory={settingsCategory}
        currentTheme={currentTheme}
        settings={settings}
        updateSetting={updateSetting}
        visibleThemes={visibleThemes}
        THEME_SWATCH_COLORS={THEME_SWATCH_COLORS}
        effectiveTheme={effectiveTheme}
        randomizeCustomThemePalette={randomizeCustomThemePalette}
        resetCustomThemePalette={resetCustomThemePalette}
        saveCurrentCustomThemePreset={saveCurrentCustomThemePreset}
        customThemeName={customThemeName}
        setCustomThemeName={setCustomThemeName}
        currentSong={currentSong}
        BUILT_IN_CUSTOM_THEME_PRESETS={BUILT_IN_CUSTOM_THEME_PRESETS}
        applyCustomThemePreset={applyCustomThemePreset}
        savedCustomThemes={savedCustomThemes}
        removeSavedCustomThemePreset={removeSavedCustomThemePreset}
        customThemeTokens={customThemeTokens}
        customThemeHexDrafts={customThemeHexDrafts}
        handleCustomThemeHexDraftChange={handleCustomThemeHexDraftChange}
        commitCustomThemeHexDraft={commitCustomThemeHexDraft}
        previewCustomThemeColor={stageCustomThemeColor}
        coverColorSyncOptions={coverColorSyncOptions}
        selectedCoverColorSyncMode={selectedCoverColorSyncMode}
        updateCoverColorSyncMode={updateCoverColorSyncMode}
        discordPreview={discordPreview}
        discordStyleOptions={discordStyleOptions}
        discordSecondLineOptions={discordSecondLineOptions}
        discordArtModeOptions={discordArtModeOptions}
        discordCleanupOptions={discordCleanupOptions}
        songs={songs}
        libraryScanBusy={libraryScanBusy}
        cleanLibraryMetadataAction={cleanLibraryMetadataAction}
        cleanSelectedMetadataAction={cleanSelectedMetadataAction}
        metadataSelectedCount={coverSelectedSongIds.length}
        metadataCleanPreview={metadataCleanPreview}
        applyMetadataCleanPreviewAction={applyMetadataCleanPreviewAction}
        cancelMetadataCleanPreviewAction={cancelMetadataCleanPreviewAction}
        undoLastMetadataCleanAction={undoLastMetadataCleanAction}
        metadataUndoCount={metadataUndoItems.length}
        rebuildSearchIndexAction={rebuildSearchIndexAction}
        importSongs={importSongs}
        importAnimation={importAnimation}
        libraryScanMessage={libraryScanMessage}
        newPlaylistName={newPlaylistName}
        setNewPlaylistName={setNewPlaylistName}
        createPlaylist={createPlaylist}
        changeView={changeView}
        clearQueue={clearQueue}
        playQueue={playQueue}
        repeatPlaylist={repeatPlaylist}
        setRepeatPlaylist={setRepeatPlaylist}
        playlists={playlists}
        openPlaylist={openPlaylist}
        playPlaylist={playPlaylist}
        removePlaylist={removePlaylist}
        pixelArtAssets={pixelArtAssets}
        pixelArtBusy={pixelArtBusy}
        randomizeAllCovers={randomizeAllCovers}
        rescanPixelArtFolder={rescanPixelArtFolder}
        downloadFolderLabel={downloadFolderLabel}
        chooseDownloadFolder={chooseDownloadFolder}
        APP_VERSION={APP_VERSION}
        updatePrompt={updatePrompt}
        updateStatusLabel={updateStatusLabel}
        manualUpdateCheck={manualUpdateCheck}
        askUpdaterToInstall={askUpdaterToInstall}
        skipAvailableUpdate={skipAvailableUpdate}
        setWhatsNewOpen={setWhatsNewOpen}
        whatsNewItems={whatsNewItems}
        copyDiagnosticsInfo={copyDiagnosticsInfo}
        diagnosticsCopied={diagnosticsCopied}
        diagnosticsInfo={diagnosticsInfo}
        platformInfo={platformInfo}
        likedSongs={likedSongs}
        libraryRenderLimitRef={libraryRenderLimitRef}
        INITIAL_LIBRARY_RENDER_LIMIT={INITIAL_LIBRARY_RENDER_LIMIT}
        setLibraryRenderLimit={setLibraryRenderLimit}
        resetDiscordSettings={resetDiscordSettings}
        resetAppearanceSettings={resetAppearanceSettings}
        resetPlayerLayoutSettings={resetPlayerLayoutSettings}
        resetLibraryLayoutSettings={resetLibraryLayoutSettings}
        resetAllSettingsSafely={resetAllSettingsSafely}
        />
        </Suspense>
        {renderAudioEffectsCard()}
        {renderFeedbackSettingsCard()}
      </>
    );
  }


  const heroMotionClass = heroMotion === "expanding" ? "heroMotionExpanding" : heroMotion === "compacting" ? "heroMotionCompacting" : "";
  const heroMotionAppClass = heroMotion !== "idle" ? `heroMotionActive ${heroMotionClass}` : "";
  const homeEntranceSettledClass = homeEntranceSettled ? "homeEntranceSettled" : "";
  const showTopUpdateRibbon =
    updatePrompt.visible &&
    updatePrompt.status !== "latest" &&
    updatePrompt.status !== "dev";

  const localtifyAppViewProps = {
    appRootRef,
    settings,
    themeMotionReady,
    showTopUpdateRibbon,
    isViewSwitching,
    view,
    heroMotion,
    heroMotionAppClass,
    homeEntranceSettledClass,
    isSeeking,
    isVolumeDragging,
    isAppBackgrounded,
    scrollBusyRef,
    themeSettling,
    draggedSongId,
    isPlaying,
    isThreeAm,
    misideModeActive,
    secretMode,
    themePresetStyle,
    animatedThemeVisualStyle,
    customThemeStyle,
    effectiveTheme,
    screensaverPreviewActive,
    screensaverVisible,
    effectiveAmbient,
    effectiveCoverColorSyncMode,
    effectiveNotes,
    statusText,
    draggedSongTitle,
    showStarBackdrop,
    updatePrompt,
    openUpdateChangelog,
    skipAvailableUpdate,
    askUpdaterToDownload,
    askUpdaterToInstall,
    manualUpdateCheck,
    setUpdatePrompt,
    progress,
    dismissScreensaverFromActivity,
    setScreensaverVisible,
    screensaverVisualSource,
    secretBurst,
    secretToast,
    starParticleStyles,
    appToast,
    importAnimation,
    songs,
    setSongs,
    setLibraryScanBusy,
    setLibraryScanMessage,
    setImportAnimation,
    libraryScanBusy,
    pixelArtBusy,
    libraryScanMessage,
    onboardingOpen,
    currentTheme,
    handleOnboardingTheme,
    handleOnboardingDiscord,
    handleOnboardingImportMusic,
    handleOnboardingDownloads,
    handleOnboardingStartListening,
    skipOnboarding,
    effectiveSimpleMode,
    simpleModeView,
    changeView,
    importSongs,
    startSidebarResize,
    contentRef,
    headerHint,
    greeting,
    playlists,
    query,
    handleSearchInput,
    heroMotionClass,
    heroTitleClass,
    ambientStyle,
    now,
    nowPlayingTransitionKey,
    nowPlayingSongMotionClass,
    currentNowPlayingLabel,
    currentSong: visualCurrentSong,
    heroDisplayTitle,
    heroDisplayArtist,
    playerError,
    toggleHeroExpanded,
    openCoversViewWithCurrentSong,
    homeListenNowSongs,
    shuffleLibrarySongsAction,
    playableSongCount: playableSongs.length,
    currentId,
    selectSong,
    updateSetting,
    homeFreshShelfSongs,
    homeDashboardClass,
    renderHomeSongCards,
    filteredSongs,
    renderSongRows,
    showHomeSideCards,
    mostPlayed,
    likedSongs,
    totalPlays,
    totalMinutes,
    topSongs,
    libraryAlbumCount,
    libraryArtistCount,
    handleLibraryAreaDragOver,
    handleLibraryAreaDragLeave,
    handleLibraryAreaDrop,
    visibleSongs,
    libraryFilterMode,
    setLibraryFilterMode,
    missingSongs,
    removeMissingSongs,
    selectedPlaylist,
    selectedPlaylistSongs,
    selectedPlaylistDuration,
    renderPlaylistCollage,
    playPlaylist,
    startRenamePlaylist,
    duplicatePlaylist,
    createPlaylist,
    newPlaylistName,
    setNewPlaylistName,
    playlistSummaries,
    activePlaylistId,
    playlistDragOverPlaylistId,
    setSelectedPlaylistId,
    handlePlaylistShelfDragOver,
    handlePlaylistShelfDragLeave,
    handlePlaylistShelfDrop,
    renamingPlaylistId,
    savePlaylistRename,
    renamingPlaylistName,
    setRenamingPlaylistName,
    cancelRenamePlaylist,
    removePlaylist,
    selectedPlaylistId,
    selectPlaylistSongAction,
    startPlaylistSongDragAction,
    dropPlaylistSongAction,
    appendPlaylistSongAction,
    endPlaylistSongDragAction,
    openPlaylistSongContextMenuAction,
    removePlaylistSongAction,
    selectedCoverSongs,
    coverGalleryMood,
    coverMoodCounts,
    coverStats,
    filteredCoverGalleryAssets,
    coverPickerSongList,
    coverSelectedSongIds,
    setCoverGalleryMood,
    randomizeSelectedCovers,
    randomizeMissingCoversAction,
    cleanupCoverCacheAction,
    missingCoverSongs,
    rescanPixelArtFolder,
    selectCurrentSongForCovers,
    selectVisibleSongsForCovers,
    setCoverSelectedSongIds,
    toggleCoverSongSelection,
    applyCoverAssetToSelection,
    togglePixelCoverFavorite,
    togglePixelCoverExcluded,
    playedPercent,
    likedPercent,
    libraryHealthLabel,
    analyticsStatCards,
    analyticsRecapCards,
    topArtists: [],
    recentImportWeekCount,
    recentlyAdded,
    neverPlayedSongs,
    missingSongs,
    missingFileCount: effectiveMissingFileCount,
    libraryLengthLabel,
    averageSongSeconds,
    longestSong,
    renderSettingsRail,
    settingsCategory,
    renderSettingsCategoryContent,
    setSettingsCategory,
    downloadsTab,
    setDownloadsTab,
    downloadText,
    setDownloadText,
    downloadAudioLinks,
    downloadBusy,
    cancelCurrentDownload,
    setDownloadResults,
    setDownloadQueue,
    downloadResults,
    downloadQueue,
    spotifyUrl,
    setSpotifyUrl,
    setSpotifyFetchError,
    spotifyFetchBusy,
    spotifyDownloadBusy,
    fetchSpotifyTracks,
    spotifyFetchError,
    spotifyTracks,
    setSpotifySelectedIds,
    spotifySelectedIds,
    downloadSpotifyTracks,
    setSpotifyTracks,
    spotifyLoggedIn,
    spotifyConnectionReady,
    spotifyNeedsClientId,
    spotifyConnectionMode,
    spotifyRedirectUri,
    spotifySourceName,
    spotifySourceType,
    spotifyLoginBusy,
    spotifyShowCookieInput,
    setSpotifyShowCookieInput,
    spotifyCookieDraft,
    setSpotifyCookieDraft,
    handleSpotifyLogin,
    handleSpotifySetCookie,
    handleSpotifyLogout,
    ready,
    retryDownload,
    retrySpotifyTrack,
    clearFailedDownloads,
    clearFinishedDownloads,
    openDownloadedSongInLibrary,
    convertLocalMedia,
    convertBusy,
    convertMessage,
    convertProgress,
    queueDropHot,
    handlePlayerDragOver,
    handlePlayerDragLeave,
    handlePlayerDrop,
    startPlayerResize,
    isShuffle,
    setIsShuffle,
    playPrevious,
    playButtonBurst,
    togglePlay,
    playNext,
    repeatMode,
    toggleRepeat,
    repeatButtonAriaLabel,
    repeatButtonTitle,
    repeatButtonStateText,
    progressTimeLabelRefs,
    displayedTime,
    progressInputRefs,
    displayedProgress,
    progressRangeStyle,
    startSeekPreview,
    previewSeek,
    commitSeek,
    progressDurationLabelRefs,
    currentDuration,
    volumeDraft,
    volumeRangeStyle,
    volumeDraftRef,
    setIsVolumeDragging,
    previewVolume,
    commitVolume,
    settingsOpen,
    setSettingsOpen,
    songContextMenu,
    songsById,
    setSongContextMenu,
    queueSong,
    playAlbumSongs,
    shuffleAlbumSongs,
    queueAlbumSongs,
    openPlaylistPicker,
    toggleLike,
    openEditor,
    whatsNewOpen,
    closeWhatsNew,
    editorSong,
    setEditorSong,
    randomizeCover,
    pickCover,
    changeCoverForSongAction,
    randomizeCoverForSongAction,
    resetCoverForSongAction,
    editTitle,
    setEditTitle,
    editArtist,
    setEditArtist,
    editAlbum,
    setEditAlbum,
    toggleSongPlaylist,
    askRemoveSong,
    saveEditor,
    playlistPickerSong,
    setPlaylistPickerSong,
    setPlaylistPickerName,
    addSongToPlaylist,
    playlistPickerName,
    createPlaylistWithSong,
    deleteTarget,
    deleteBusy,
    setDeleteTarget,
    removeSong,
    audioRef,
    handleAudioTimeUpdate,
    handleAudioPause,
    handleAudioEnded,
    handleCanPlay,
    handlePlaying,
    pendingPlayRef,
    setIsPlaying,
    saveDuration,
    currentTime,
    timeRef,
    tickPlayCountTracker,
    songRef,
    markSongCompletedForPlayCount,
    patchSongLocal,
    playbackUrlCacheRef,
    setPlayerError,
    getAudioErrorText,
    setStatusText,
    resetPlayCountTracker,
    stopFade,
    stopCrossfadeAuto,
    stopProgressLoop
  };

  return (
    <>
      <LocaltifyAppView {...localtifyAppViewProps} />
      <CatBuddy enabled={settings.catBuddyEnabled === true} reducedMotion={settings.reducedMotion === true} />
      {renderFeedbackPrompt()}
    </>
  );
}

export default function App() {
  return <MainModeApp />;
}



