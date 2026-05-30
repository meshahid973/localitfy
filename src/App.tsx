/* localtify 0.3.5 stars-only animated theme cleanup V124 — download/file patch label only; APP_VERSION stays 0.3.5. */
import { memo, startTransition, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import type { CSSProperties, PointerEvent, DragEvent, MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";
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
  VolumeX
} from "lucide-react";
import Onboarding from "./Onboarding";
import CoverStudio from "./cover";
import SettingsCategoryContent from "./SettingsCategoryContent";
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
import "./app-core.css";
import "./App.css";
import "./themes.css";
import "./settings.css";
import "./home.css";
import "./motion.css";
import "./effects.css";
import "./player.css";

type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  filePath: string;
  url: string;
  fileExists?: boolean;
  coverPath?: string | null;
  coverUrl?: string | null;
  liked: boolean;
  playCount: number;
  duration: number;
  dateAdded: string;
  lastPlayed?: string | null;
  volumeGain?: number;
  playbackPosition?: number;
  customVolume?: number;
  fileSizeBytes?: number;
  sizeBytes?: number;
  bitrate?: number;
  sampleRate?: number;
};

function isPlayableSong(song: Song | null | undefined): song is Song {
  return !!song && !!song.url && song.fileExists !== false;
}

type View = "home" | "library" | "playlists" | "liked" | "covers" | "analytics" | "downloads" | "settings";
type CoverMood = "all" | "favorites" | "leastUsed" | "cute" | "space" | "dark" | "cozy" | "energy";

type SettingsCategory = "appearance" | "playback" | "discord" | "library" | "downloads" | "covers" | "updates" | "about" | "advanced" | "metadata";

const settingsCategoryTabs: {
  id: SettingsCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string;
}[] = [
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme, colors, and layout",
    icon: Palette,
    keywords: "appearance theme themes color colors accent custom dark light layout spacing corners density ambience glow sidebar"
  },
  {
    id: "playback",
    label: "Playback",
    description: "Crossfade, speed, and volume",
    icon: PlayCircle,
    keywords: "playback play pause player audio crossfade gapless speed volume boost normalize normalization per song sleep timer queue repeat shuffle"
  },
  {
    id: "discord",
    label: "Discord",
    description: "Privacy, text, and artwork",
    icon: MessageCircle,
    keywords: "discord rpc rich presence privacy mode status activity buttons artwork art image second line artist album time left play count title cleanup paused idle"
  },
  {
    id: "library",
    label: "Library",
    description: "Imports, playlists, and metadata",
    icon: LibraryBig,
    keywords: "library import imports songs folders playlists queue metadata cleaner cleanup search rebuild title names artist album file local"
  },
  {
    id: "downloads",
    label: "Downloads",
    description: "Queue, quality, and folders",
    icon: Download,
    keywords: "downloads download youtube yt-dlp ytdlp queue progress speed eta cancel retry failed clear finished folder quality mp3 flac wav format auto add clean title"
  },
  {
    id: "covers",
    label: "Covers",
    description: "Cover art and cover tools",
    icon: Images,
    keywords: "cover covers artwork art pixel pixelart gallery randomize randomise rescan favorites hidden excluded album image glow"
  },
  {
    id: "updates",
    label: "Updates",
    description: "Version and update settings",
    icon: Download,
    keywords: "update updates updater version changelog whats new release download install restart github check publish"
  },
  {
    id: "about",
    label: "About",
    description: "Version, diagnostics, and links",
    icon: SettingsIcon,
    keywords: "about app info diagnostics debug copy version song count playlist count theme discord startup status github bug report contributors open source"
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Reset and app status",
    icon: SlidersHorizontal,
    keywords: "advanced reset status app stats diagnostics maintenance backup database safe storage settings"
  }
];

function normalizeSettingsSearch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveSettingsCategoryFromSearch(value: string): SettingsCategory | null {
  const query = normalizeSettingsSearch(value);
  if (!query) return null;

  if (/discord|rpc|rich presence|privacy|status style|second line|artwork|buttons?/.test(query)) return "discord";
  if (/theme|themes|appearance|accent|color|colour|layout|spacing|corner|ambience|glow|sidebar/.test(query)) return "appearance";
  if (/playback|player|crossfade|gapless|speed|volume|sleep|repeat|shuffle|queue/.test(query)) return "playback";
  if (/cover|covers|artwork|pixel|pixelart|gallery|random|rescan|favorite|hidden/.test(query)) return "covers";
  if (/download|downloads|youtube|yt-dlp|ytdlp|quality|mp3|flac|wav|folder|queue|retry|cancel/.test(query)) return "downloads";
  if (/update|updates|version|changelog|what'?s new|release|install|github/.test(query)) return "updates";
  if (/about|app info|diagnostic|diagnostics|debug|copy info|version|song count|playlist count|startup|open source|github|contributors|bug report/.test(query)) return "about";
  if (/library|import|songs|playlist|metadata|clean|cleanup|search|folder|queue/.test(query)) return "library";
  if (/advanced|reset|status|diagnostic|maintenance|storage|database/.test(query)) return "advanced";

  const matchingTab = settingsCategoryTabs.find((tab) => {
    const haystack = `${tab.id} ${tab.label} ${tab.description} ${tab.keywords}`.toLowerCase();
    return haystack.includes(query);
  });

  return matchingTab?.id ?? null;
}

function settingsTabMatchesSearch(tab: (typeof settingsCategoryTabs)[number], value: string) {
  const query = normalizeSettingsSearch(value);
  if (!query) return true;

  const haystack = `${tab.id} ${tab.label} ${tab.description} ${tab.keywords}`.toLowerCase();
  return haystack.includes(query) || query.split(" ").every((part) => haystack.includes(part));
}

const navItems: Array<{
  id: View;
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  { id: "home", label: "home", hint: "now playing", icon: Home },
  { id: "library", label: "library", hint: "all songs", icon: LibraryBig },
  { id: "playlists", label: "playlists", hint: "your mixes", icon: ListMusic },
  { id: "liked", label: "liked", hint: "favorites", icon: Heart },
  { id: "covers", label: "covers", hint: "pixel art", icon: Images },
  { id: "analytics", label: "analytics", hint: "stats", icon: BarChart3 },
  { id: "downloads", label: "downloads", hint: "imports", icon: Download },
  { id: "settings", label: "settings", hint: "controls", icon: SettingsIcon }
];

const coverMoodOptions: Array<{
  id: CoverMood;
  label: string;
  note: string;
}> = [
  { id: "all", label: "all covers", note: "everything that is not blocked" },
  { id: "favorites", label: "favorites", note: "only covers you starred" },
  { id: "leastUsed", label: "least used", note: "spread art more evenly" },
  { id: "cute", label: "cute", note: "cats, anime, soft covers" },
  { id: "space", label: "space", note: "stars, planets, glow" },
  { id: "dark", label: "dark", note: "black, night, moody" },
  { id: "cozy", label: "cozy", note: "peaceful and warm" },
  { id: "energy", label: "energy", note: "bright and loud" }
];

const coverColorSyncOptions: Array<{
  id: CoverColorSyncMode;
  label: string;
  note: string;
}> = [
  { id: "off", label: "off", note: "no cover tint, fastest look" },
  { id: "subtle", label: "subtle", note: "tiny cover color around the app" },
  { id: "normal", label: "normal", note: "balanced cover tint for daily use" },
  { id: "strong", label: "strong", note: "bigger cover mood and player glow" }
];

type ImportAnimationPhase = "idle" | "picking" | "scanning" | "success" | "error";

type ImportAnimationState = {
  active: boolean;
  phase: ImportAnimationPhase;
  message: string;
  count: number;
  total: number;
  preview: Song[];
};

function createImportAnimationState(patch: Partial<ImportAnimationState> = {}): ImportAnimationState {
  return {
    active: false,
    phase: "idle",
    message: "ready to scan local music",
    count: 0,
    total: 0,
    preview: [],
    ...patch
  };
}


type Playlist = {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
};

type PlaylistSummary = {
  playlist: Playlist;
  previewSongs: Song[];
  songCount: number;
  duration: number;
};

type QueueHistoryItem = {
  id: string;
  songId: string;
  title: string;
  artist: string;
  playedAt: number;
};

type SongContextMenuState = {
  songId: string;
  x: number;
  y: number;
};

const PLAYLIST_STORAGE_KEY = "localitfy.playlists.v1";
const QUEUE_STORAGE_KEY = "localitfy.queue.v1";
const QUEUE_HISTORY_STORAGE_KEY = "localitfy.queueHistory.v1";
const REPEAT_PLAYLIST_STORAGE_KEY = "localitfy.repeatPlaylist.v1";
const LIBRARY_ORDER_STORAGE_KEY = "localitfy.libraryOrder.v1";
const ONBOARDING_STORAGE_KEY = "localitfy.onboarding.v1";

const CODERPIXEL_ARTIST_EASTER_EGG = "all hail coderpixel";
const CODERPIXEL_ARTIST_CHANCE = 0.05;

function stableSongSourceKey(song: Pick<Song, "filePath" | "url">) {
  return String(song.filePath || song.url || "").trim().toLowerCase();
}

function maybeApplyCoderpixelArtist(
  importedSongs: Song[],
  previousSongIds: Set<string>,
  previousSongSources: Set<string>
): { songs: Song[]; changedSongs: Song[] } {
  const changedSongs: Song[] = [];

  const songs = importedSongs.map((song) => {
    const sourceKey = stableSongSourceKey(song);
    const isNewSong = !previousSongIds.has(song.id) && (!sourceKey || !previousSongSources.has(sourceKey));

    if (!isNewSong || Math.random() >= CODERPIXEL_ARTIST_CHANCE) {
      return song;
    }

    const updatedSong = {
      ...song,
      artist: CODERPIXEL_ARTIST_EASTER_EGG
    };

    changedSongs.push(updatedSong);
    return updatedSong;
  });

  return { songs, changedSongs };
}

function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, value: T) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // storage failures should never break playback
  }
}

type LibraryDropSide = "before" | "after";
type LibraryDropTarget = { songId: string; side: LibraryDropSide; pull: number };

function cleanSongOrderIds(value: unknown, validIds?: Set<string>) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const output: string[] = [];

  value.forEach((item) => {
    const id = String(item || "").trim();
    if (!id || seen.has(id)) return;
    if (validIds && !validIds.has(id)) return;
    seen.add(id);
    output.push(id);
  });

  return output;
}

function cleanPlaylistList(value: unknown, validIds?: Set<string>): Playlist[] {
  if (!Array.isArray(value)) return [];

  const seenPlaylistIds = new Set<string>();
  const output: Playlist[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;

    const source = item as Partial<Playlist>;
    const fallbackId = makeLocalId("playlist");
    const id = String(source.id || fallbackId).trim();
    const name = String(source.name || `playlist ${index + 1}`).trim().slice(0, 120) || `playlist ${index + 1}`;

    if (!id || seenPlaylistIds.has(id)) return;

    seenPlaylistIds.add(id);
    output.push({
      id,
      name,
      songIds: cleanSongOrderIds(source.songIds, validIds),
      createdAt: Number.isFinite(Number(source.createdAt)) && Number(source.createdAt) > 0
        ? Number(source.createdAt)
        : Date.now()
    });
  });

  return output;
}

function applyLibraryOrder(list: Song[]) {
  const orderIds = cleanSongOrderIds(
    readLocalJson<string[]>(LIBRARY_ORDER_STORAGE_KEY, []),
    new Set(list.map((song) => song.id))
  );

  if (!orderIds.length) return list;

  const songById = new Map(list.map((song) => [song.id, song]));
  const used = new Set<string>();
  const ordered: Song[] = [];

  orderIds.forEach((id) => {
    const song = songById.get(id);
    if (!song || used.has(id)) return;
    used.add(id);
    ordered.push(song);
  });

  list.forEach((song) => {
    if (used.has(song.id)) return;
    ordered.push(song);
  });

  return ordered;
}

function saveLibraryOrder(list: Song[]) {
  writeLocalJson(
    LIBRARY_ORDER_STORAGE_KEY,
    list.map((song) => song.id)
  );
}

function reorderSongList(list: Song[], draggedId: string, targetId: string, side: LibraryDropSide) {
  if (!draggedId || !targetId || draggedId === targetId) return list;

  const draggedSong = list.find((song) => song.id === draggedId);
  if (!draggedSong) return list;

  const withoutDragged = list.filter((song) => song.id !== draggedId);
  const targetIndex = withoutDragged.findIndex((song) => song.id === targetId);
  if (targetIndex === -1) return list;

  const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
  const next = [...withoutDragged];
  next.splice(insertIndex, 0, draggedSong);

  return next;
}

function reorderIdList(list: string[], draggedId: string, targetId: string, side: LibraryDropSide) {
  if (!draggedId || !targetId || draggedId === targetId) return list;

  const withoutDragged = list.filter((id) => id !== draggedId);
  const targetIndex = withoutDragged.findIndex((id) => id === targetId);
  if (targetIndex === -1) return list;

  const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
  const next = [...withoutDragged];
  next.splice(insertIndex, 0, draggedId);

  return next;
}

function insertIdNearTarget(list: string[], draggedId: string, targetId: string, side: LibraryDropSide) {
  if (!draggedId || !targetId) return list;

  const withoutDragged = list.filter((id) => id !== draggedId);
  const targetIndex = withoutDragged.findIndex((id) => id === targetId);
  if (targetIndex === -1) return withoutDragged.includes(draggedId) ? withoutDragged : [...withoutDragged, draggedId];

  const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
  const next = [...withoutDragged];
  next.splice(insertIndex, 0, draggedId);

  return next;
}
type ThemeId =
  | "mint"
  | "berry"
  | "aqua"
  | "sunset"
  | "lavender"
  | "mono"
  | "rose"
  | "cotton"
  | "honey"
  | "lime"
  | "midnight"
  | "mocha"
  | "cherry"
  | "ice"
  | "matcha"
  | "bubblegum"
  | "sakura"
  | "dreamcore"
  | "peach"
  | "moon"
  | "starlight"
  | "neonNoir"
  | "cyberGrape"
  | "ember"
  | "forest"
  | "ocean"
  | "ruby"
  | "aurora"
  | "vanilla"
  | "vaporwave"
  | "ultraviolet"
  | "terminal"
  | "candyCloud"
  | "rainstorm"
  | "lavaLamp"
  | "softSky"
  | "stars"
  | "arcadeGhost";
type DiscordArtMode = "albumCover" | "randomPixel" | "logo" | "none";
type DiscordActivityStyle = "clean" | "cute" | "detailed" | "minimal" | "meme";
type DiscordTitleCleanup = "off" | "light" | "heavy";
type DiscordSecondLine = "artist" | "album" | "timeLeft" | "playCount" | "appName";
type SecretMode = "none" | "disco" | "stars" | "pulse" | "vinyl" | "rain" | "night" | "fast" | "playBounce" | "arcadeGhost";
type SecretTriggerMode = Exclude<SecretMode, "none">;
type CoverColorSyncMode = "off" | "subtle" | "normal" | "strong";

type Settings = {
  theme: ThemeId;
  themePanelCollapsed: boolean;
  customThemeEnabled: boolean;
  customThemeColor: string;
  customThemeColor2: string;
  customThemeBackground: string;
  customThemeSurface: string;
  customThemeText: string;
  customThemeHighlight: string;
  customThemeProgress: string;
  volume: number;
  playerSize: number;
  sidebarWidth: number;
  compactPlayer: boolean;
  autoplayOnSelect: boolean;
  rememberLastSong: boolean;
  showVisualizer: boolean;
  homeExpanded: boolean;
  heroExpanded: boolean;
  showRightColumn: boolean;
  showAmbientGradient: boolean;
  coverColorSyncMode: CoverColorSyncMode;
  showFloatingNotes: boolean;
  animeVisuals: boolean;
  animatedBackgrounds: boolean;
  gifVisualsMode: "loadingOnly" | "everywhere" | "none";
  animatedGlow: boolean;
  softCorners: boolean;
  denseList: boolean;
  reducedMotion: boolean;
  showHeroBadge: boolean;
  simpleMode: boolean;
  lastSongId: string;

  discordEnabled: boolean;
  discordShowPausedIdle: boolean;
  discordPrivacyMode: boolean;
  discordButtons: boolean;
  discordArtMode: DiscordArtMode;
  discordActivityStyle: DiscordActivityStyle;
  discordTitleCleanup: DiscordTitleCleanup;
  discordSecondLine: DiscordSecondLine;

  autoUpdateEnabled: boolean;
  autoUpdateNotifyOnly: boolean;

  crossfadeEnabled: boolean;
  crossfadeSeconds: number;
  gaplessPlayback: boolean;
  volumeNormalization: boolean;
  perSongVolumeMemory: boolean;
  sleepTimerMinutes: number;
  playbackSpeed: number;
  rememberPlaybackPosition: boolean;
  skipSilence: boolean;
  minimizeToTray: boolean;
  startWithWindows: boolean;
  downloadQuality: "best" | "320" | "256" | "192";
  downloadFormat: "mp3" | "flac" | "wav";
  downloadAutoAdd: boolean;
  downloadCleanTitle: boolean;
  downloadFolder: string;
};

type CustomThemeColorKey =
  | "customThemeColor"
  | "customThemeColor2"
  | "customThemeBackground"
  | "customThemeSurface"
  | "customThemeText"
  | "customThemeHighlight"
  | "customThemeProgress";

type CustomThemeColorPatch = Pick<Settings, CustomThemeColorKey>;

type CustomThemePreset = {
  id: string;
  name: string;
  note: string;
  colors: CustomThemeColorPatch;
  custom?: boolean;
  createdAt?: number;
};


type DownloadResult = {
  ok: boolean;
  url?: string;
  filePath?: string;
  filename?: string;
  sizeBytes?: number;
  error?: string;
};

type DownloadQueueItem = {
  id: string;
  url: string;
  title: string;
  status: "queued" | "downloading" | "converting" | "importing" | "done" | "failed" | "cancelled";
  progress: number;
  message: string;
  speed?: string | null;
  eta?: string | null;
  filePath?: string;
  filename?: string;
  error?: string;
};

type AutoUpdateEvent = {
  type: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error" | "dev" | "backup";
  version?: string;
  currentVersion?: string;
  percent?: number;
  message?: string;
  error?: string;
  silent?: boolean;
  backupPath?: string;
  libraryBackedUp?: boolean;
  releaseNotes?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  sizeBytes?: number;
  speedBytesPerSecond?: number;
  nagStage?: 0 | 1 | 2 | 3;
};

type UpdatePromptState = {
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

const defaultUpdatePrompt: UpdatePromptState = {
  visible: false,
  status: "idle",
  version: "",
  percent: 0,
  message: "",
  error: ""
};

function friendlyUpdateError(error?: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const text = raw.toLowerCase();

  if (text.includes("dev") || text.includes("packaged")) {
    return "Update checks work after the app is installed.";
  }

  if (text.includes("network") || text.includes("fetch") || text.includes("timeout") || text.includes("github") || text.includes("release")) {
    return "Could not check for updates. Try again later.";
  }

  return "Could not check for updates. Try again later.";
}

function updateStatusLabel(status: UpdatePromptState["status"]) {
  if (status === "checking") return "checking";
  if (status === "available") return "update available";
  if (status === "downloading") return "downloading";
  if (status === "downloaded") return "ready to restart";
  if (status === "latest") return "up to date";
  if (status === "error") return "check failed";
  if (status === "dev") return "installed app only";
  return "ready";
}

const UPDATE_LEAVE_ALONE_PREFIX = "localitfy.updateLeaveAloneVersion.";

function updateLeaveAloneKey(version: string) {
  return `${UPDATE_LEAVE_ALONE_PREFIX}${version || "latest"}`;
}

function updateWasLeftAlone(version: string) {
  if (!version) return false;
  try {
    return window.localStorage.getItem(updateLeaveAloneKey(version)) === "1";
  } catch {
    return false;
  }
}



function updateRibbonTitle(prompt: UpdatePromptState) {
  const version = prompt.version || APP_VERSION;

  if (prompt.status === "available") return `Update available — Localtify ${version} is available.`;
  if (prompt.status === "downloaded") return `Update ready — restart to install Localtify ${version}.`;
  if (prompt.status === "downloading") return `Downloading update — ${Math.round(clamp(prompt.percent, 0, 100))}%`;
  if (prompt.status === "latest") return "Localtify is up to date.";
  if (prompt.status === "error") return "Update check failed.";
  if (prompt.status === "dev") return "Installed app required — auto update only works in the packaged app.";
  if (prompt.status === "checking") return "Checking for updates...";
  return "Localtify update";
}

const settingsCategorySpring = { type: "spring", stiffness: 430, damping: 36, mass: 0.68 } as const;
const updateRibbonEnterSpring = { type: "spring", stiffness: 500, damping: 35, mass: 0.58 } as const;
const updateRibbonChildSpring = { type: "spring", stiffness: 520, damping: 34, mass: 0.55 } as const;


const APP_VERSION = "0.3.5";
const localtifyLogo = new URL("./assets/logo.png", import.meta.url).href;
const loadingScreenGif = new URL("./assets/loading-screen.gif", import.meta.url).href;
const screensaverImage = new URL("./assets/screensaver.jpg", import.meta.url).href;
const BOOT_MIN_VISIBLE_MS = 1450;
const BOOT_STEPS = [
  { label: "settings", detail: "theme, volume, Discord, and app preferences" },
  { label: "library", detail: "songs, folders, durations, and saved order" },
  { label: "playlists", detail: "mixes, song order, covers, and totals" },
  { label: "covers", detail: "pixel art, album art, and ambience colors" },
  { label: "player", detail: "queue, last song, progress, and audio state" },
  { label: "interface", detail: "home, settings, animations, and shortcuts" }
] as const;
const INITIAL_LIBRARY_RENDER_LIMIT = 60;
const LIBRARY_RENDER_BATCH_SIZE = 60;
const HOME_GRID_RENDER_LIMIT = 60;
const CUSTOM_THEME_COMMIT_DELAY_MS = 680;
const WHATS_NEW_SEEN_KEY = "localitfy.whatsNewSeenVersion";

type AppToastKind = "info" | "success" | "work" | "error";

function cleanToastCopy(message: string, kind: AppToastKind) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) return kind === "error" ? "Something went wrong" : "Done";

  if (lower.includes("discord")) {
    if (lower.includes("reset")) return "Discord settings reset";
    return "Discord presence updated";
  }

  if (lower.includes("theme") || lower.includes("appearance")) {
    if (lower.includes("reset")) return "Appearance reset";
    return "Theme changed";
  }

  if (lower.includes("update")) {
    if (kind === "error" || lower.includes("failed") || lower.includes("could not")) return "Update check failed";
    if (lower.includes("downloaded") || lower.includes("install")) return "Update ready to install";
    if (lower.includes("available") || lower.includes("ready")) return "Update available";
    if (lower.includes("up to date") || lower.includes("latest")) return "localtify is up to date";
    return "Checking for updates";
  }

  if (lower.includes("import") || lower.includes("new song") || lower.includes("scanning local music")) {
    if (kind === "error" || lower.includes("failed")) return "Could not import songs";
    if (lower.includes("no songs")) return "No songs imported";
    if (lower.includes("no new")) return "Library already up to date";
    if (kind === "work" || lower.includes("scanning")) return "Importing songs";
    return "Songs imported";
  }

  if (lower.includes("download")) {
    if (kind === "error" || lower.includes("failed")) return "Download failed";
    if (lower.includes("ready")) return "Downloads ready";
    return "Download added";
  }

  if (lower.includes("convert") || lower.includes("conversion")) {
    if (kind === "error" || lower.includes("failed")) return "Conversion failed";
    if (lower.includes("nothing")) return "No files converted";
    return "Files converted";
  }

  if (lower.includes("cover") || lower.includes("pixel art")) {
    if (kind === "error" || lower.includes("failed")) return "Could not update cover";
    if (kind === "work" || lower.includes("randomizing") || lower.includes("rescan") || lower.includes("picking")) return "Updating covers";
    if (lower.includes("no covers") || lower.includes("nothing")) return "No covers changed";
    return "Cover updated";
  }

  if (lower.includes("metadata")) {
    if (kind === "error" || lower.includes("failed")) return "Could not clean metadata";
    if (kind === "work") return "Cleaning metadata";
    return "Metadata cleaned";
  }

  if (lower.includes("library order") || lower.includes("song order") || lower.includes("queue")) {
    return "Library updated";
  }

  if (lower.includes("reset")) return "Settings reset";
  if (lower.includes("settings saved")) return "Settings saved";

  return raw
    .replace(/\s*[•—-]\s*check (?:the )?(?:terminal|console).*$/i, "")
    .replace(/\s*safely\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

const whatsNewItems = [
  "0.3.5 keeps the animated theme list focused on stars only",
  "Stars now randomize per launch, sparkle, and drift slowly instead of sitting in the same tiled spots",
  "Boot motion keeps the row and card shimmer on, including the heavier shimmer pass",
  "Vapor glass and night train were retired from Settings so the theme picker stays cleaner",
  "Old installs saved on vapor glass or night train are safely moved to stars on boot",
  "The startup screen still feels alive without turning off blur, ambience, cover glow, or motion",
  "Playlist playback still stays inside the playlist you started from",
  "Hero covers, titles, and ambience continue to animate more smoothly when songs change",
  "No player layout, Discord, downloads, playlists, blur, or ambience features were removed"
];
const V013_DEFAULTS_KEY = "localitfy.v013.defaultsApplied";
const START_WITH_WINDOWS_DEFAULT_KEY = "localitfy.v029.startWithWindowsDefaultApplied";
const ARCADE_GHOST_UNLOCKED_KEY = "localitfy.secret.arcadeGhostUnlocked";
const PIXEL_COVER_FAVORITES_STORAGE_KEY = "localitfy.pixelCoverFavorites";
const PIXEL_COVER_EXCLUDED_STORAGE_KEY = "localitfy.pixelCoverExcluded";
const CUSTOM_THEME_LIBRARY_STORAGE_KEY = "localitfy.customThemeLibrary.v1";

const V013_RELEASE_DEFAULTS: Partial<Settings> = {
  playerSize: 108,
  sidebarWidth: 249,
  compactPlayer: true,
  homeExpanded: true,
  heroExpanded: true,
  showRightColumn: false,
  showAmbientGradient: true,
  coverColorSyncMode: "normal",
  showFloatingNotes: true,
  animeVisuals: true,
  animatedBackgrounds: true,
  gifVisualsMode: "loadingOnly",
  animatedGlow: true,
  softCorners: true,
  denseList: true,
  reducedMotion: false,
  showHeroBadge: true,
  simpleMode: false,
};


const themes = [
  { id: "mint", name: "mint berry", note: "black and fresh", mood: "clean + calm", emoji: "🌿" },
  { id: "bubblegum", name: "bubblegum", note: "pink blue pop", mood: "cute UI", emoji: "🫧" },
  { id: "berry", name: "berry", note: "deep purple glow", mood: "soft night", emoji: "🍓" },
  { id: "midnight", name: "midnight", note: "deep blue OLED", mood: "late night", emoji: "🌙" },
  { id: "mono", name: "mono", note: "clean white", mood: "simple focus", emoji: "○" },
  { id: "stars", name: "stars", note: "random sparkle motion", mood: "sparkly night", emoji: "✦" },
] as const;

const THEME_ID_SET = new Set<string>(themes.map((theme) => theme.id));
const RETIRED_ANIMATED_THEME_IDS = new Set(["vaporGlass", "nightTrain"]);

function isRetiredAnimatedThemeId(value: unknown) {
  return RETIRED_ANIMATED_THEME_IDS.has(String(value || ""));
}

function isThemeId(value: string): value is ThemeId {
  return THEME_ID_SET.has(value);
}

function normalizeThemeId(value: unknown, fallback: ThemeId = "mint"): ThemeId {
  const rawTheme = String(value || "").trim();

  if (isRetiredAnimatedThemeId(rawTheme)) return "stars";
  if (rawTheme === "oled") return "mint";

  return isThemeId(rawTheme) ? rawTheme : fallback;
}

const THEME_SWATCH_COLORS: Record<ThemeId, string> = {
  mint: "#8dffce",
  berry: "#ff72c8",
  aqua: "#53d7ff",
  sunset: "#ffb86b",
  lavender: "#c084fc",
  mono: "#f4f4f5",
  rose: "#fb7185",
  cotton: "#93c5fd",
  honey: "#facc15",
  lime: "#a3e635",
  midnight: "#60a5fa",
  mocha: "#c08457",
  cherry: "#f43f5e",
  ice: "#67e8f9",
  matcha: "#86efac",
  bubblegum: "#f472d0",
  stars: "#d7d5ff",
  sakura: "#f9a8d4",
  dreamcore: "#a78bfa",
  peach: "#fdba74",
  moon: "#cbd5e1",
  starlight: "#e0e7ff",
  neonNoir: "linear-gradient(135deg, #062a30 0%, #37f8ff 55%, #000 100%)",
  cyberGrape: "linear-gradient(135deg, #170033 0%, #a855f7 55%, #22d3ee 100%)",
  ember: "linear-gradient(135deg, #180704 0%, #ff7a2f 55%, #ffd166 100%)",
  forest: "linear-gradient(135deg, #03150d 0%, #34d399 55%, #0b3b25 100%)",
  ocean: "linear-gradient(135deg, #03142b 0%, #38bdf8 55%, #2563eb 100%)",
  ruby: "linear-gradient(135deg, #22040b 0%, #fb315d 55%, #7f1d1d 100%)",
  aurora: "linear-gradient(135deg, #071417 0%, #5eead4 40%, #c084fc 100%)",
  vanilla: "linear-gradient(135deg, #1d1710 0%, #fff1c2 55%, #f0b35a 100%)",
  vaporwave: "linear-gradient(135deg, #0e0630 0%, #fb6fd9 50%, #4dd4ff 100%)",
  ultraviolet: "linear-gradient(135deg, #12001f 0%, #8b5cf6 50%, #f0abfc 100%)",
  terminal: "linear-gradient(135deg, #001005 0%, #22c55e 55%, #bbf7d0 100%)",
  candyCloud: "linear-gradient(135deg, #2b0522 0%, #fb7bdc 48%, #67e8f9 100%)",
  rainstorm: "linear-gradient(135deg, #020617 0%, #38bdf8 45%, #818cf8 100%)",
  lavaLamp: "linear-gradient(135deg, #1b0500 0%, #ef4444 45%, #f59e0b 100%)",
  softSky: "linear-gradient(135deg, #06111f 0%, #93c5fd 52%, #e0f2fe 100%)",
  arcadeGhost: "#22d3ee"
};

const discordStyleOptions: Array<{
  id: DiscordActivityStyle;
  name: string;
  note: string;
}> = [
  { id: "clean", name: "Clean", note: "Show the title and selected second line." },
  { id: "cute", name: "Cute", note: "Use a softer status style." },
  { id: "detailed", name: "Detailed", note: "Show artist, album, and time details." },
  { id: "minimal", name: "Minimal", note: "Show a simple title and artist." },
  { id: "meme", name: "Meme", note: "Use a lighter Discord status style." }
];

const discordArtModeOptions: Array<{
  id: DiscordArtMode;
  name: string;
  note: string;
}> = [
  { id: "randomPixel", name: "Pixel shuffle", note: "Use a random pixel art image for each song." },
  { id: "albumCover", name: "Song cover", note: "Use the current song cover when possible." },
  { id: "logo", name: "Logo only", note: "Use the localtify logo." },
  { id: "none", name: "No large image", note: "Show no large image." }
];

const discordCleanupOptions: Array<{
  id: DiscordTitleCleanup;
  name: string;
  note: string;
}> = [
  { id: "off", name: "Off", note: "keep original" },
  { id: "light", name: "Light", note: "clean filename only" },
  { id: "heavy", name: "Heavy", note: "remove audio junk" }
];

const discordSecondLineOptions: Array<{
  id: DiscordSecondLine;
  name: string;
  note: string;
}> = [
  { id: "artist", name: "Artist", note: "show artist name" },
  { id: "album", name: "Album", note: "show album name" },
  { id: "timeLeft", name: "Time left", note: "remaining time" },
  { id: "playCount", name: "Count", note: "times played" },
  { id: "appName", name: "App", note: "from localtify" }
];


type PixelArtAsset = {
  file: string;
  label: string;
  discordKey: string;
};

type RuntimePixelArtAsset = PixelArtAsset & {
  path?: string;
  url?: string;
};

type PixelArtBridgeAsset = {
  name?: string;
  key?: string;
  path?: string;
  url?: string;
};

const LOCALITFY_DOWNLOAD_URL = "https://github.com/meshahid973/localitfy/releases/latest";

function buildDiscordSongSearchUrl(title: string, artist: string) {
  const query = [artist, title]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!query) return LOCALITFY_DOWNLOAD_URL;

  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

const DISCORD_HASH_ASSET_KEYS = [
  "28c5d68dccf1fb03e939e1bd59eee485",
  "2e7b21cb459fb08d135b2b9f6aa673e7",
  "34a2b4266a9e1c1b09a842e24508eba8",
  "3c6d3a6d7de389f664f9c6c46d81356a",
  "40b7313f6d324ea27b0de2a5bfc3d903",
  "47e615582babeca0e1b683bc3a7282a6",
  "6889208e0600df4bdd975e867a147ad9",
  "70b62000ff8794fe9d885235eb2b20a1",
  "76412f8797d881310fe6c0532f7214af",
  "9ddd013bcaabc39173c34642de5cd425",
  "9fa42c9757a71f479d873f77121b8e97",
  "a1484e915622e681bbdc484b93ce7288",
  "c0ac14763553f0dff275e3b558e1121d",
  "d3004f1d9ef904124c9f4778bfca8cc0",
  "dcd577d1d9f08b535a573fc0a90c2a77",
  "e23598836900abf05ae7acd2f56464d7",
  "eabd17ab2f36db183bbf4ad98043e1bb",
  "f40ffeed5b3b1be61709df79c1bb2f35"
] as const;

const DISCORD_NAMED_ASSET_KEYS = [
  "2cats",
  "2tankpeople",
  "4glasses",
  "animepixell",
  "animepixel",
  "beach_house",
  "blackcat",
  "blackcatlaying",
  "callhello",
  "catinspace",
  "catquestion",
  "content",
  "earthglow",
  "erikaringingyobell",
  "gumballl",
  "marie",
  "mikuinfortnite",
  "mikuuu",
  "mitapixel",
  "peaceanime",
  "smallcatwithwand",
  "smallmita",
  "somegirl",
  "somegirllooking",
  "spaceearth",
  "spacemetor",
  "starpersonlookup"
] as const;

const DISCORD_ASSET_KEYS = [...DISCORD_NAMED_ASSET_KEYS, ...DISCORD_HASH_ASSET_KEYS] as const;

const discordKeyFromFileName = (file: string) => {
  const base = String(file || "")
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[a-z0-9]+$/i, "")
    .trim()
    .toLowerCase();

  return base
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "earthglow";
};

const DISCORD_LOGO_ASSET = "earthglow";

const PIXEL_ART_LIBRARY: PixelArtAsset[] = [
  "2cats.jpg",
  "2tankpeople.jpg",
  "4glasses.jpg",
  "animepixell.jpg",
  "animepixel.jpg",
  "beach house.jpg",
  "blackcat.jpg",
  "blackcatlaying.jpg",
  "callhello.jpg",
  "catinspace.jpg",
  "catquestion.jpg",
  "content.png",
  "earthglow.jpg",
  "erikaringingyobell.jpg",
  "gumballl.jpg",
  "marie.jpg",
  "mikuinfortnite.jpg",
  "mikuuu.gif",
  "mitapixel.jpg",
  "peaceanime.jpg",
  "smallcatwithwand.jpg",
  "smallmita.jpg",
  "somegirl.jpg",
  "somegirllooking.jpg",
  "spaceearth.jpg",
  "spacemetor.gif",
  "starpersonlookup.jpg"
].map((file) => ({
  file,
  label: file
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim(),
  discordKey: discordKeyFromFileName(file)
}));

function normalizePixelArtFileName(asset: PixelArtBridgeAsset, index: number) {
  const pathName = String(asset.path || "").split(/[\\/]/).pop() || "";
  const name = String(asset.name || asset.key || "pixel").trim();
  return pathName || `${name || `pixel-${index + 1}`}.jpg`;
}

const pixelArtUrl = (file: string) => `/pixelart/${encodeURIComponent(file)}`;

const DEFAULT_RUNTIME_PIXEL_ART_ASSETS: RuntimePixelArtAsset[] = PIXEL_ART_LIBRARY.map((asset) => ({
  ...asset,
  url: pixelArtUrl(asset.file)
}));

const PIXEL_ART_CACHE_TTL_MS = 30 * 60 * 1000;

function getCachedRuntimePixelArtAssets() {
  return DEFAULT_RUNTIME_PIXEL_ART_ASSETS;
}

function buildRuntimePixelArtAssets(assets?: PixelArtBridgeAsset[]): RuntimePixelArtAsset[] {
  if (!Array.isArray(assets) || !assets.length) {
    return getCachedRuntimePixelArtAssets();
  }

  const assetByName = new Map(PIXEL_ART_LIBRARY.map((asset) => [asset.file.toLowerCase(), asset]));

  const runtimeAssets = assets
    .map((asset, index) => {
      const fileName = normalizePixelArtFileName(asset, index);
      const fallback = PIXEL_ART_LIBRARY[index % PIXEL_ART_LIBRARY.length];
      const base = assetByName.get(fileName.toLowerCase()) || fallback;
      const label = String(asset.name || base.label || fileName.replace(/\.[a-z0-9]+$/i, "")).trim();
      const runtimeDiscordKey = discordKeyFromFileName(String(asset.key || fileName || label || base.discordKey));

      return {
        ...base,
        file: fileName,
        label: label || base.label,
        discordKey: runtimeDiscordKey || base.discordKey || DISCORD_LOGO_ASSET,
        path: asset.path,
        url: asset.url || pixelArtUrl(fileName)
      };
    })
    .filter((asset) => Boolean(asset.file || asset.path || asset.url));

  return runtimeAssets.length ? runtimeAssets : getCachedRuntimePixelArtAssets();
}

const stableHash = (input: string) => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};


const seededUnit = (seed: number, salt: number) => {
  const raw = Math.sin((seed + salt * 1009) * 12.9898) * 43758.5453123;
  return raw - Math.floor(raw);
};

function buildRandomStarLayer(seedKey: string, count: number, palette: string[], minSize = 0.85, maxSize = 1.75) {
  const seed = stableHash(seedKey);

  return Array.from({ length: count }, (_, index) => {
    const x = 1.5 + seededUnit(seed, index * 9 + 1) * 97;
    const y = 2 + seededUnit(seed, index * 9 + 2) * 96;
    const size = minSize + seededUnit(seed, index * 9 + 3) * (maxSize - minSize);
    const fade = 0.36 + seededUnit(seed, index * 9 + 4) * 0.58;
    const color = palette[Math.floor(seededUnit(seed, index * 9 + 5) * palette.length)] || palette[0];

    return `radial-gradient(circle at ${x.toFixed(2)}% ${y.toFixed(2)}%, rgba(${color}, ${fade.toFixed(2)}) 0 ${size.toFixed(2)}px, transparent ${(size + 1.1).toFixed(2)}px)`;
  }).join(", ");
}

function buildAnimatedThemeVisualStyle(theme: ThemeId, seedKey: string) {
  if (theme !== "stars") return {} as CSSProperties;

  const seed = stableHash(`${seedKey}:stars:v124`);
  const driftDuration = 64 + seededUnit(seed, 1) * 18;
  const sparkleDuration = 2.35 + seededUnit(seed, 2) * 1.15;
  const shimmerDuration = 7.4 + seededUnit(seed, 3) * 2.4;
  const sweepDuration = 18 + seededUnit(seed, 4) * 7;

  return {
    "--localtify-stars-field-a": buildRandomStarLayer(`${seedKey}:stars:v124:slow`, 32, ["255, 255, 255", "215, 213, 255", "143, 220, 255"], 0.7, 1.55),
    "--localtify-stars-field-b": buildRandomStarLayer(`${seedKey}:stars:v124:sparkle`, 20, ["255, 255, 255", "255, 167, 248", "148, 234, 255"], 0.95, 2.15),
    "--localtify-stars-field-c": buildRandomStarLayer(`${seedKey}:stars:v124:tiny`, 18, ["255, 255, 255", "190, 176, 255", "134, 241, 255"], 0.45, 1.0),
    "--localtify-stars-drift-duration": `${driftDuration.toFixed(2)}s`,
    "--localtify-stars-sparkle-duration": `${sparkleDuration.toFixed(2)}s`,
    "--localtify-stars-shimmer-duration": `${shimmerDuration.toFixed(2)}s`,
    "--localtify-stars-sweep-duration": `${sweepDuration.toFixed(2)}s`,
    "--localtify-stars-drift-x": `${(3.4 + seededUnit(seed, 5) * 3.2).toFixed(2)}vw`,
    "--localtify-stars-drift-y": `${(1.6 + seededUnit(seed, 6) * 2.1).toFixed(2)}vh`
  } as CSSProperties;
}

const songSignature = (song?: Song | null) => {
  if (!song) return "localitfy-idle";
  return [song.id, song.title, song.artist, song.album, song.duration, song.filePath]
    .filter(Boolean)
    .join("::")
    .toLowerCase();
};

const pixelArtForSong = (song?: Song | null) => {
  const index = stableHash(songSignature(song)) % PIXEL_ART_LIBRARY.length;
  return PIXEL_ART_LIBRARY[index];
};

const nextPixelArtForSong = (song?: Song | null) => {
  const index = (stableHash(`${songSignature(song)}::next`) + 7) % PIXEL_ART_LIBRARY.length;
  return PIXEL_ART_LIBRARY[index];
};


function cleanStringList(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const output: string[] = [];

  value.forEach((item) => {
    const key = String(item || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(key);
  });

  return output;
}

function getPixelArtAssetKey(asset: RuntimePixelArtAsset) {
  return String(asset.path || asset.url || (asset.file ? pixelArtUrl(asset.file) : asset.label) || "").trim();
}

function getSongCoverUsageKeys(song: Song) {
  return cleanStringList([
    song.coverPath,
    song.coverUrl,
    song.coverUrl ? song.coverUrl.split(/[\\/]/).pop() : "",
    song.coverPath ? song.coverPath.split(/[\\/]/).pop() : ""
  ]);
}

function getPixelAssetMoodTags(asset: RuntimePixelArtAsset): CoverMood[] {
  const haystack = `${asset.file} ${asset.label} ${asset.path || ""} ${asset.url || ""}`.toLowerCase();
  const tags = new Set<CoverMood>();

  if (/cat|miku|anime|girl|gumball|mita|marie|wand|hello|cute|peace/.test(haystack)) tags.add("cute");
  if (/space|earth|star|meteor|glow|sky|planet/.test(haystack)) tags.add("space");
  if (/black|night|dark|void|shadow/.test(haystack)) tags.add("dark");
  if (/beach|peace|house|laying|soft|cozy|calm/.test(haystack)) tags.add("cozy");
  if (/fortnite|ringing|meteor|content|glitch|neon|energy/.test(haystack)) tags.add("energy");

  if (!tags.size) tags.add("cozy");
  return [...tags];
}

function coverMoodName(mood: CoverMood) {
  return coverMoodOptions.find((option) => option.id === mood)?.label || mood;
}


const defaultSettings: Settings = {
  theme: "mint",
  themePanelCollapsed: false,
  customThemeEnabled: false,
  customThemeColor: "#8dffce",
  customThemeColor2: "#8ecbff",
  customThemeBackground: "#050517",
  customThemeSurface: "#151528",
  customThemeText: "#f5f3ff",
  customThemeHighlight: "#c084fc",
  customThemeProgress: "#8dffce",
  volume: 0.75,
  playerSize: 108,
  sidebarWidth: 249,
  compactPlayer: true,
  autoplayOnSelect: true,
  rememberLastSong: true,
  showVisualizer: true,
  showRightColumn: false,
  showAmbientGradient: true,
  coverColorSyncMode: "normal",
  showFloatingNotes: true,
  animeVisuals: true,
  animatedBackgrounds: true,
  gifVisualsMode: "loadingOnly",
  homeExpanded: true,
  heroExpanded: true,
  animatedGlow: true,
  softCorners: true,
  denseList: true,
  reducedMotion: false,
  showHeroBadge: true,
  simpleMode: false,
  lastSongId: "",

  discordEnabled: true,
  discordShowPausedIdle: true,
  discordPrivacyMode: false,
  discordButtons: true,
  discordArtMode: "randomPixel",
  discordActivityStyle: "cute",
  discordTitleCleanup: "heavy",
  discordSecondLine: "artist",

  autoUpdateEnabled: true,
  autoUpdateNotifyOnly: true,

  crossfadeEnabled: true,
  crossfadeSeconds: 1.6,
  gaplessPlayback: true,
  volumeNormalization: true,
  perSongVolumeMemory: false,
  sleepTimerMinutes: 0,
  playbackSpeed: 1,
  rememberPlaybackPosition: true,
  skipSilence: false,
  minimizeToTray: false,
  startWithWindows: true,
  downloadQuality: "best",
  downloadFormat: "mp3",
  downloadAutoAdd: true,
  downloadCleanTitle: true,
  downloadFolder: ""
};

function normalizeUiText(text: string) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF\u2060\u034F]/g, "")
    .replace(/\p{Cf}/gu, "");
}

function lower(text: string) {
  return normalizeUiText(text).toLowerCase();
}

function normalizeHexColor(value: string, fallback = "#8dffce") {
  const raw = String(value || "").trim();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  const shortMatch = /^#([0-9a-f]{3})$/i.exec(withHash);

  if (shortMatch) {
    return `#${shortMatch[1]
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`.toLowerCase();
  }

  return /^#[0-9a-f]{6}$/i.test(withHash) ? withHash.toLowerCase() : fallback;
}

function normalizeHexInputDraft(value: string) {
  const raw = String(value || "").trim().replace(/[^0-9a-f#]/gi, "");
  const withoutHashes = raw.replace(/#/g, "").slice(0, 6);
  return `#${withoutHashes}`;
}

function isCompleteHexColorInput(value: string) {
  const raw = String(value || "").trim();
  return /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw);
}

function normalizeCoverColorSyncMode(value: unknown): CoverColorSyncMode {
  const safeValue = String(value || "normal").trim() as CoverColorSyncMode;
  return coverColorSyncOptions.some((option) => option.id === safeValue) ? safeValue : "normal";
}

function hexToRgbParts(value: string, fallback = "#8dffce") {
  const hex = normalizeHexColor(value, fallback).slice(1);
  const number = Number.parseInt(hex, 16);

  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255
  };
}

function hexToRgbString(value: string, fallback = "#8dffce") {
  const { r, g, b } = hexToRgbParts(value, fallback);
  return `${r}, ${g}, ${b}`;
}

function hexToRgbaString(value: string, fallback = "#8dffce", alpha = 1) {
  return `rgba(${hexToRgbString(value, fallback)}, ${alpha})`;
}

type ThemeVisualPalette = {
  accent: string;
  accent2: string;
  background: string;
  surface: string;
  text: string;
  highlight: string;
  progress?: string;
};

const THEME_PRESET_COLORS: Record<ThemeId, ThemeVisualPalette> = {
  mint: { accent: "#8dffce", accent2: "#68d8ff", background: "#020706", surface: "#0b1713", text: "#f4fff9", highlight: "#d8fff0" },
  berry: { accent: "#ff72c8", accent2: "#b05cff", background: "#0b0209", surface: "#1b0b18", text: "#fff3fb", highlight: "#ffc4ee" },
  aqua: { accent: "#53d7ff", accent2: "#7c5cff", background: "#02070b", surface: "#071724", text: "#effaff", highlight: "#c6f3ff" },
  sunset: { accent: "#ffb86b", accent2: "#ff5f8a", background: "#0b0502", surface: "#1c1008", text: "#fff7ed", highlight: "#ffd7a8" },
  lavender: { accent: "#c084fc", accent2: "#f0abfc", background: "#080412", surface: "#161024", text: "#f8f3ff", highlight: "#e9d5ff" },
  mono: { accent: "#f4f4f5", accent2: "#a1a1aa", background: "#030303", surface: "#121212", text: "#f8f8f8", highlight: "#d4d4d8" },
  rose: { accent: "#fb7185", accent2: "#f472b6", background: "#0b0306", surface: "#1a0b10", text: "#fff1f4", highlight: "#fecdd3" },
  cotton: { accent: "#93c5fd", accent2: "#f0abfc", background: "#030711", surface: "#0e1626", text: "#f0f7ff", highlight: "#dbeafe" },
  honey: { accent: "#facc15", accent2: "#fb923c", background: "#090701", surface: "#1a1405", text: "#fffbe7", highlight: "#fef3c7" },
  lime: { accent: "#a3e635", accent2: "#22c55e", background: "#030800", surface: "#0d1805", text: "#f7ffe8", highlight: "#d9f99d" },
  midnight: { accent: "#60a5fa", accent2: "#818cf8", background: "#020617", surface: "#0b1223", text: "#f1f5ff", highlight: "#bfdbfe" },
  mocha: { accent: "#c08457", accent2: "#f5c17a", background: "#090604", surface: "#19110c", text: "#fff7ed", highlight: "#fed7aa" },
  cherry: { accent: "#f43f5e", accent2: "#fb7185", background: "#0c0205", surface: "#1d0710", text: "#fff1f3", highlight: "#fecdd3" },
  ice: { accent: "#67e8f9", accent2: "#bae6fd", background: "#02090c", surface: "#081821", text: "#effdff", highlight: "#cffafe" },
  matcha: { accent: "#86efac", accent2: "#bef264", background: "#020804", surface: "#0b180e", text: "#effff3", highlight: "#bbf7d0" },
  bubblegum: { accent: "#f472d0", accent2: "#67e8f9", background: "#0b0310", surface: "#1b1025", text: "#fff3fb", highlight: "#fbcfe8" },
  stars: { accent: "#d7d5ff", accent2: "#8fdcff", background: "#050610", surface: "#17182d", text: "#f6f3ff", highlight: "#ffffff" },
  sakura: { accent: "#f9a8d4", accent2: "#fb7185", background: "#0b0408", surface: "#1c0e16", text: "#fff5fa", highlight: "#fce7f3" },
  dreamcore: { accent: "#a78bfa", accent2: "#f0abfc", background: "#050416", surface: "#121027", text: "#f7f3ff", highlight: "#ddd6fe" },
  peach: { accent: "#fdba74", accent2: "#fb7185", background: "#0b0603", surface: "#1b1008", text: "#fff7ed", highlight: "#fed7aa" },
  moon: { accent: "#cbd5e1", accent2: "#94a3b8", background: "#04060a", surface: "#111827", text: "#f8fafc", highlight: "#e2e8f0" },
  starlight: { accent: "#e0e7ff", accent2: "#93c5fd", background: "#030414", surface: "#0e1025", text: "#f8fbff", highlight: "#dbeafe" },
  neonNoir: { accent: "#37f8ff", accent2: "#22d3ee", background: "#010608", surface: "#06171b", text: "#effeff", highlight: "#a5f3fc" },
  cyberGrape: { accent: "#a855f7", accent2: "#22d3ee", background: "#080011", surface: "#170826", text: "#fbf4ff", highlight: "#e9d5ff" },
  ember: { accent: "#ff7a2f", accent2: "#ffd166", background: "#0b0301", surface: "#1d0b04", text: "#fff7ed", highlight: "#fed7aa" },
  forest: { accent: "#34d399", accent2: "#86efac", background: "#020704", surface: "#08170e", text: "#effff5", highlight: "#bbf7d0" },
  ocean: { accent: "#38bdf8", accent2: "#2563eb", background: "#020716", surface: "#09162c", text: "#f0f9ff", highlight: "#bae6fd" },
  ruby: { accent: "#fb315d", accent2: "#f97316", background: "#0c0205", surface: "#1e0710", text: "#fff1f4", highlight: "#fecdd3" },
  aurora: { accent: "#5eead4", accent2: "#c084fc", background: "#02090b", surface: "#08171a", text: "#f2fffd", highlight: "#ccfbf1" },
  vanilla: { accent: "#fff1c2", accent2: "#f0b35a", background: "#080604", surface: "#17120b", text: "#fffaf0", highlight: "#fde68a" },
  vaporwave: { accent: "#fb6fd9", accent2: "#4dd4ff", background: "#070315", surface: "#160c28", text: "#fff4fd", highlight: "#fbcfe8" },
  ultraviolet: { accent: "#8b5cf6", accent2: "#f0abfc", background: "#07000f", surface: "#150822", text: "#faf5ff", highlight: "#ddd6fe" },
  terminal: { accent: "#22c55e", accent2: "#bbf7d0", background: "#000804", surface: "#06140b", text: "#effff3", highlight: "#86efac" },
  candyCloud: { accent: "#fb7bdc", accent2: "#67e8f9", background: "#0b0310", surface: "#1b1025", text: "#fff4fd", highlight: "#fbcfe8" },
  rainstorm: { accent: "#38bdf8", accent2: "#818cf8", background: "#020617", surface: "#0b1224", text: "#f0f9ff", highlight: "#bfdbfe" },
  lavaLamp: { accent: "#ef4444", accent2: "#f59e0b", background: "#0b0200", surface: "#1c0803", text: "#fff4ee", highlight: "#fecaca" },
  softSky: { accent: "#93c5fd", accent2: "#e0f2fe", background: "#04101d", surface: "#0c1b2f", text: "#f0f9ff", highlight: "#dbeafe" },
  arcadeGhost: { accent: "#22d3ee", accent2: "#f472b6", background: "#03030a", surface: "#0e1020", text: "#f8fbff", highlight: "#a5f3fc" }
};

function makeThemePresetStyle(themeId: ThemeId): CSSProperties {
  const palette = THEME_PRESET_COLORS[themeId] ?? THEME_PRESET_COLORS.mint;
  const progress = palette.progress ?? palette.accent;
  const accentRgb = hexToRgbString(palette.accent, THEME_PRESET_COLORS.mint.accent);
  const accent2Rgb = hexToRgbString(palette.accent2, palette.accent);
  const highlightRgb = hexToRgbString(palette.highlight, palette.accent);
  const progressRgb = hexToRgbString(progress, palette.accent);

  return {
    "--bg": palette.background,
    "--bg-2": palette.background,
    "--bg-3": palette.surface,
    "--panel": hexToRgbaString(palette.surface, "#121212", 0.56),
    "--surface": hexToRgbaString(palette.surface, "#121212", 0.42),
    "--surface-2": hexToRgbaString(palette.surface, "#121212", 0.56),
    "--surface-3": hexToRgbaString(palette.surface, "#121212", 0.72),
    "--text": palette.text,
    "--text-2": hexToRgbaString(palette.text, "#ffffff", 0.78),
    "--muted": hexToRgbaString(palette.text, "#ffffff", 0.54),
    "--faint": hexToRgbaString(palette.text, "#ffffff", 0.34),
    "--line": hexToRgbaString(palette.accent, "#8dffce", 0.18),
    "--line-2": hexToRgbaString(palette.accent, "#8dffce", 0.28),
    "--accent": palette.accent,
    "--accent-2": palette.accent2,
    "--highlight": palette.highlight,
    "--progress": progress,
    "--accent-rgb": accentRgb,
    "--accent-2-rgb": accent2Rgb,
    "--highlight-rgb": highlightRgb,
    "--progress-rgb": progressRgb,
    "--accent-soft": hexToRgbaString(palette.accent, "#8dffce", 0.14),
    "--accent-line": hexToRgbaString(palette.accent, "#8dffce", 0.34),
    "--theme-accent": palette.accent,
    "--theme-accent-2": palette.accent2,
    "--theme-highlight": palette.highlight,
    "--theme-progress": progress,
    "--theme-card-glass": hexToRgbaString(palette.accent, "#8dffce", 0.045),
    "--theme-card-border": hexToRgbaString(palette.accent, "#8dffce", 0.16),
    "--theme-hover-glass": hexToRgbaString(palette.accent, "#8dffce", 0.09),
    "--theme-hover-border": hexToRgbaString(palette.accent, "#8dffce", 0.32),
    "--card-rgb": accentRgb,
    "--localtify-sidebar-bg": hexToRgbaString(palette.background, "#050505", 0.98),
    "--localtify-sidebar-bg-2": hexToRgbaString(palette.surface, "#111111", 0.72),
    "--localtify-panel-bg": hexToRgbaString(palette.surface, "#111111", 0.52),
    "--localtify-panel-bg-2": hexToRgbaString(palette.background, "#050505", 0.74),
    "--localtify-line-soft": hexToRgbaString(palette.accent, "#8dffce", 0.16)
  } as CSSProperties;
}


function makeCustomThemeColors(input: Partial<Record<CustomThemeColorKey, string>> = {}): CustomThemeColorPatch {
  const accent = normalizeHexColor(input.customThemeColor || "#8dffce", "#8dffce");

  return {
    customThemeBackground: normalizeHexColor(input.customThemeBackground || "#050517", "#050517"),
    customThemeSurface: normalizeHexColor(input.customThemeSurface || "#151528", "#151528"),
    customThemeText: normalizeHexColor(input.customThemeText || "#f5f3ff", "#f5f3ff"),
    customThemeColor: accent,
    customThemeColor2: normalizeHexColor(input.customThemeColor2 || accent, accent),
    customThemeHighlight: normalizeHexColor(input.customThemeHighlight || accent, accent),
    customThemeProgress: normalizeHexColor(input.customThemeProgress || accent, accent)
  };
}

function getCustomThemeColorPatch(source: Partial<Settings>): CustomThemeColorPatch {
  return makeCustomThemeColors({
    customThemeBackground: source.customThemeBackground,
    customThemeSurface: source.customThemeSurface,
    customThemeText: source.customThemeText,
    customThemeColor: source.customThemeColor,
    customThemeColor2: source.customThemeColor2,
    customThemeHighlight: source.customThemeHighlight,
    customThemeProgress: source.customThemeProgress
  });
}

const BUILT_IN_CUSTOM_THEME_PRESETS: CustomThemePreset[] = [
  {
    id: "midnight-pop",
    name: "midnight pop",
    note: "purple black glow",
    colors: makeCustomThemeColors({
      customThemeBackground: "#050517",
      customThemeSurface: "#151528",
      customThemeText: "#f5f3ff",
      customThemeColor: "#e55ae7",
      customThemeColor2: "#a989ff",
      customThemeHighlight: "#ff8bfb",
      customThemeProgress: "#e55ae7"
    })
  },
  {
    id: "kopuz-dracula",
    name: "dracula",
    note: "clean grey violet",
    colors: makeCustomThemeColors({
      customThemeBackground: "#0f0f17",
      customThemeSurface: "#282838",
      customThemeText: "#e2e2f6",
      customThemeColor: "#5f8aff",
      customThemeColor2: "#8faeff",
      customThemeHighlight: "#c77dff",
      customThemeProgress: "#5f8aff"
    })
  },
  {
    id: "mint-night",
    name: "mint night",
    note: "black and fresh",
    colors: makeCustomThemeColors({
      customThemeBackground: "#000000",
      customThemeSurface: "#0b1712",
      customThemeText: "#effff7",
      customThemeColor: "#64f0a8",
      customThemeColor2: "#9fffd1",
      customThemeHighlight: "#d8ffe9",
      customThemeProgress: "#64f0a8"
    })
  },
  {
    id: "soft-sky",
    name: "soft sky",
    note: "calm blue silver",
    colors: makeCustomThemeColors({
      customThemeBackground: "#06111f",
      customThemeSurface: "#12233a",
      customThemeText: "#eff7ff",
      customThemeColor: "#78d7ff",
      customThemeColor2: "#b8e7ff",
      customThemeHighlight: "#9fd5ff",
      customThemeProgress: "#78d7ff"
    })
  },
  {
    id: "ruby-night",
    name: "ruby night",
    note: "red velvet dark",
    colors: makeCustomThemeColors({
      customThemeBackground: "#12040a",
      customThemeSurface: "#231018",
      customThemeText: "#fff0f6",
      customThemeColor: "#ff4f81",
      customThemeColor2: "#ff9ab7",
      customThemeHighlight: "#ff6b9a",
      customThemeProgress: "#ff4f81"
    })
  },
  {
    id: "terminal-green",
    name: "terminal",
    note: "green console",
    colors: makeCustomThemeColors({
      customThemeBackground: "#020604",
      customThemeSurface: "#07120d",
      customThemeText: "#eafff3",
      customThemeColor: "#46ff96",
      customThemeColor2: "#9dffbf",
      customThemeHighlight: "#72ffab",
      customThemeProgress: "#46ff96"
    })
  }
];

function cleanCustomThemePreset(value: unknown): CustomThemePreset | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<CustomThemePreset> & Partial<CustomThemeColorPatch>;
  const id = collapseSpaces(String(raw.id || makeLocalId("theme")));
  const name = collapseSpaces(String(raw.name || "My Custom Theme"));

  if (!id || !name) return null;

  const colorSource = raw.colors && typeof raw.colors === "object" ? raw.colors : raw;

  return {
    id,
    name: name.slice(0, 40),
    note: collapseSpaces(String(raw.note || "saved custom theme")).slice(0, 48),
    colors: makeCustomThemeColors(colorSource as Partial<Record<CustomThemeColorKey, string>>),
    custom: true,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now()
  };
}

function readSavedCustomThemePresets() {
  const raw = readLocalJson<unknown[]>(CUSTOM_THEME_LIBRARY_STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => cleanCustomThemePreset(item))
    .filter(Boolean) as CustomThemePreset[];
}

function writeSavedCustomThemePresets(presets: CustomThemePreset[]) {
  writeLocalJson(CUSTOM_THEME_LIBRARY_STORAGE_KEY, presets.slice(0, 24));
}

function randomThemeHex() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 74 + Math.floor(Math.random() * 18);
  const lightness = 62 + Math.floor(Math.random() * 10);

  const chroma = (1 - Math.abs((2 * lightness) / 100 - 1)) * (saturation / 100);
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness / 100 - chroma / 2;

  const [r1, g1, b1] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];

  const toHex = (part: number) =>
    Math.round((part + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

function collapseSpaces(text: string) {
  return normalizeUiText(text).replace(/\s+/g, " ").trim();
}

function removeUrlNoise(text: string) {
  return collapseSpaces(
    text
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/www\.\S+/gi, " ")
      .replace(/(?:youtube|youtu\.be|soundcloud|spotify|bandcamp|tiktok|instagram|discord)\S*/gi, " ")
  );
}

function stripAudioExtension(fileName = "") {
  return normalizeUiText(fileName)
    .replace(/\.(mp3|flac|wav|m4a|aac|ogg|opus|webm|mp4|aiff|alac)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrackNumber(text: string) {
  return collapseSpaces(
    text
      .replace(/^\s*(?:track\s*)?\d{1,3}\s*[.\-_)]+\s*/i, "")
      .replace(/^\s*cd\s*\d+\s*[.\-_)]+\s*/i, "")
  );
}

function stripDuplicateCopySuffix(text: string) {
  let next = text;
  for (let index = 0; index < 5; index += 1) {
    const cleaned = next
      .replace(/\s*\((?:copy|копия|duplicate|\d+)\)\s*$/gi, "")
      .replace(/\s*\[(?:copy|копия|duplicate|\d+)\]\s*$/gi, "")
      .replace(/\s+-\s+copy\s*$/gi, "")
      .replace(/\s+copy\s*$/gi, "")
      .trim();

    if (cleaned === next) break;
    next = cleaned;
  }

  return next;
}

function removeBracketNoise(text: string, strength: DiscordTitleCleanup = "heavy") {
  const noiseWords =
    strength === "light"
      ? "official|audio|video|lyrics?|lyric video|visualizer|hq|hd|4k|320kbps"
      : "official|audio|video|lyrics?|lyric video|visualizer|hq|hd|4k|320kbps|slowed|reverb|slowed and reverb|sped up|nightcore|bass boosted|extended|remaster(?:ed)?|clean|edit|loop|tik ?tok|full song";

  const noisePattern = new RegExp(`\\s*[\\[(][^\\])]*(?:${noiseWords})[^\\])]*[\\])]`, "gi");
  return text.replace(noisePattern, " ");
}

function removeLooseNoiseWords(text: string, strength: DiscordTitleCleanup = "heavy") {
  if (strength !== "heavy") return collapseSpaces(text);

  return collapseSpaces(
    text
      .replace(/\b(?:official\s+music\s+video|official\s+video|official\s+audio|lyric\s+video|lyrics?\s+video)\b/gi, " ")
      .replace(/\b(?:visualizer|hq|hd|4k|320kbps|full\s+song)\b/gi, " ")
      .replace(/\b(?:slowed\s*(?:and|&)?\s*reverb|slowedandreverb|slowedreverb|sped\s*up|bass\s*boosted|nightcore|remaster(?:ed)?|extended\s+mix)\b/gi, " ")
      .replace(/\b(?:from\s+tiktok|tiktok\s+version|youtube\s+rip)\b/gi, " ")
  );
}

function cleanupSongTitle(rawTitle: string, strength: DiscordTitleCleanup = "heavy") {
  let text = removeUrlNoise(normalizeUiText(rawTitle || "untitled"));

  text = stripAudioExtension(text)
    .replace(/[_]+/g, " ")
    .replace(/[–—−]+/g, " - ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  text = stripTrackNumber(stripDuplicateCopySuffix(text));
  text = removeBracketNoise(text, strength);
  text = removeLooseNoiseWords(text, strength);

  if (strength === "heavy") {
    text = text
      .replace(/\s+[|/]+\s*(?:slowed|reverb|sped up|nightcore|lyrics?|official|audio|video).*$/i, "")
      .replace(/\s+-\s*(?:slowed|reverb|sped up|nightcore|lyrics?|official|audio|video).*$/i, "");
  }

  text = text
    .replace(/\s*[{}\[\]]\s*/g, " ")
    .replace(/\s*\(\s*\)\s*/g, " ")
    .replace(/(^|\s)[+~]+(?=\s|$)/g, " ")
    .replace(/\s+[–—-]\s*$/g, " ");

  return collapseSpaces(text) || "untitled";
}

function shortenWords(text: string, maxWords = 7) {
  const words = collapseSpaces(text).split(" ").filter(Boolean);
  if (!words.length) return "untitled";
  return words.slice(0, maxWords).join(" ");
}

function prettyTitle(rawTitle: string, maxWords = 7) {
  return lower(shortenWords(cleanupSongTitle(rawTitle, "heavy"), maxWords));
}

function heroTitleDensityClass(title: string) {
  const clean = collapseSpaces(title || "");
  const letters = clean.replace(/[^a-z0-9]/gi, "");

  if (letters.length <= 5) return "heroTitleTiny";
  if (letters.length <= 11) return "heroTitleShort";
  if (letters.length >= 32) return "heroTitleLong";

  return "heroTitleNormal";
}

function previewTitle(rawTitle: string, cleanup: DiscordTitleCleanup, maxWords = 7) {
  if (cleanup === "off") {
    return lower(shortenWords(collapseSpaces(rawTitle || "local song"), maxWords));
  }

  if (cleanup === "light") {
    return lower(shortenWords(cleanupSongTitle(rawTitle || "local song", "light"), maxWords));
  }

  return lower(shortenWords(cleanupSongTitle(rawTitle, "heavy"), maxWords));
}

function compactSongKey(text: string) {
  return lower(cleanupSongTitle(text || "", "heavy"))
    .replace(/\b(official|audio|lyrics|lyric|video|visualizer|remix|remastered|slowed|reverb|sped|nightcore|lofi)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type SongSearchEntry = {
  song: Song;
  title: string;
  artist: string;
  album: string;
  fileName: string;
  filePath: string;
  compactTitle: string;
  compactArtist: string;
  compactAlbum: string;
  haystack: string;
  tokens: string[];
};

type SearchQueryInfo = {
  raw: string;
  clean: string;
  compact: string;
  terms: string[];
};

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/[()[\]{}]+/g, " ")
    .replace(/[^a-zA-Z0-9\s:/]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function splitSearchTerms(query: string) {
  return normalizeSearchText(query).split(" ").filter(Boolean).slice(0, 14);
}

function prepareSearchQuery(query: string): SearchQueryInfo {
  const clean = normalizeSearchText(query);

  return {
    raw: query,
    clean,
    compact: compactSongKey(clean),
    terms: clean ? splitSearchTerms(clean) : []
  };
}

function fileNameFromPath(filePath = "") {
  return String(filePath || "").split(/[\\/]/).pop() || "";
}

function cleanMetadataField(value: unknown, fallback: string) {
  const raw = removeUrlNoise(String(value ?? ""));
  const cleaned = cleanupSongTitle(raw, "light")
    .replace(/\b(?:unknown|n\/a|null|undefined)\b$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return lower(cleaned || fallback);
}

function looksUnknownMeta(value: unknown) {
  const text = normalizeSearchText(value);
  return !text || text === "unknown" || text === "unknown artist" || text === "unknown album" || text === "n a" || text === "na" || text === "null" || text === "undefined";
}

type SmartSongMetadata = {
  title: string;
  artist: string;
  album: string;
};

function cleanArtistName(value: unknown) {
  return cleanMetadataField(value, "unknown artist")
    .replace(/^by\s+/i, "")
    .replace(/\s+(?:official|topic|vevo)$/i, "")
    .trim() || "unknown artist";
}

function cleanTrackName(value: unknown, fallback = "untitled") {
  return cleanMetadataField(value, fallback)
    .replace(/^[-–—|/]+\s*/, "")
    .replace(/\s*[-–—|/]+$/, "")
    .trim() || fallback;
}

function scoreArtistGuess(text: string) {
  const clean = normalizeSearchText(text);
  let score = 0;
  if (/\b(feat|ft|prod|records|music|official|topic|vevo)\b/i.test(clean)) score += 2;
  if (clean.split(" ").length <= 5) score += 1;
  if (/^[a-z0-9 ._&'!]+$/i.test(text)) score += 1;
  return score;
}

function splitArtistTitleCandidate(value: string) {
  const base = cleanupSongTitle(stripAudioExtension(value), "light");
  const separators = [" - ", " – ", " — ", " | ", " / ", " ~ "];

  for (const separator of separators) {
    if (!base.includes(separator)) continue;
    const pieces = base.split(separator).map((part) => collapseSpaces(part)).filter(Boolean);
    if (pieces.length < 2) continue;

    const left = pieces[0];
    const right = pieces.slice(1).join(separator.trim() === "-" ? " - " : " ");
    if (left.length < 2 || right.length < 2) continue;

    return {
      artist: cleanArtistName(left),
      title: cleanTrackName(right)
    };
  }

  const byMatch = base.match(/^(.{2,120}?)\s+by\s+(.{2,80}?)(?:\s+(?:version|cover|remix|edit))?$/i);
  if (byMatch) {
    return {
      title: cleanTrackName(byMatch[1]),
      artist: cleanArtistName(byMatch[2])
    };
  }

  return null;
}

function smartSongMetadata(song: Partial<Song> & Record<string, any>, index: number): SmartSongMetadata {
  const fileName = fileNameFromPath(song.filePath || song.url || "");
  const fileBase = stripAudioExtension(fileName);
  const fileSplit = splitArtistTitleCandidate(fileBase);
  const titleSplit = splitArtistTitleCandidate(String(song.title || ""));

  let title = looksUnknownMeta(song.title) ? "" : cleanTrackName(song.title, "");
  let artist = looksUnknownMeta(song.artist) ? "" : cleanArtistName(song.artist);
  let album = looksUnknownMeta(song.album) ? "" : cleanMetadataField(song.album, "");

  if (!artist && titleSplit) {
    title = titleSplit.title;
    artist = titleSplit.artist;
  } else if (artist && titleSplit && normalizeSearchText(titleSplit.artist) === normalizeSearchText(artist)) {
    title = titleSplit.title;
  }

  if ((!title || !artist) && fileSplit) {
    if (!title) title = fileSplit.title;
    if (!artist) artist = fileSplit.artist;
  }

  if (title && !artist) {
    const bySplit = splitArtistTitleCandidate(title);
    if (bySplit) {
      title = bySplit.title;
      artist = bySplit.artist;
    }
  }

  if (!title) title = cleanTrackName(fileBase, `track ${index + 1}`);
  if (!artist) artist = "unknown artist";
  if (!album) album = "local files";

  const artistTitleSplit = splitArtistTitleCandidate(`${artist} - ${title}`);
  if (artistTitleSplit && scoreArtistGuess(artistTitleSplit.artist) >= scoreArtistGuess(artistTitleSplit.title)) {
    artist = artistTitleSplit.artist;
    title = artistTitleSplit.title;
  }

  return {
    title: cleanTrackName(title, `track ${index + 1}`),
    artist: cleanArtistName(artist),
    album: cleanMetadataField(album, "local files")
  };
}

function safeNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

function sanitizeSongRecord(song: Partial<Song> & Record<string, any>, index: number): Song {
  const metadata = smartSongMetadata(song, index);

  return {
    id: String(song.id || makeLocalId("song")),
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    filePath: String(song.filePath || ""),
    url: String(song.url || ""),
    fileExists: song.fileExists,
    coverPath: song.coverPath ?? null,
    coverUrl: song.coverUrl ?? null,
    liked: Boolean(song.liked),
    playCount: Math.floor(safeNumber(song.playCount, 0)),
    duration: safeNumber(song.duration, 0),
    dateAdded: String(song.dateAdded || new Date().toISOString()),
    lastPlayed: song.lastPlayed ?? null,
    volumeGain: typeof song.volumeGain === "number" && Number.isFinite(song.volumeGain) ? song.volumeGain : undefined,
    playbackPosition: safeNumber(song.playbackPosition, 0),
    customVolume: typeof song.customVolume === "number" && Number.isFinite(song.customVolume) ? song.customVolume : undefined,
    fileSizeBytes: typeof song.fileSizeBytes === "number" && Number.isFinite(song.fileSizeBytes) ? song.fileSizeBytes : song.sizeBytes,
    sizeBytes: typeof song.sizeBytes === "number" && Number.isFinite(song.sizeBytes) ? song.sizeBytes : song.fileSizeBytes,
    bitrate: typeof song.bitrate === "number" && Number.isFinite(song.bitrate) ? song.bitrate : undefined,
    sampleRate: typeof song.sampleRate === "number" && Number.isFinite(song.sampleRate) ? song.sampleRate : undefined
  };
}

function sanitizeSongList(input: unknown): Song[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Partial<Song> & Record<string, any> => Boolean(item && typeof item === "object"))
    .map((song, index) => sanitizeSongRecord(song, index));
}

function getMetadataRepairPatch(song: Song): Partial<Song> {
  const cleaned = sanitizeSongRecord(song, 0);
  const patch: Partial<Song> = {};

  if (cleaned.title && cleaned.title !== song.title) patch.title = cleaned.title;
  if (cleaned.artist && cleaned.artist !== song.artist) patch.artist = cleaned.artist;
  if (cleaned.album && cleaned.album !== song.album) patch.album = cleaned.album;
  if (cleaned.duration !== song.duration) patch.duration = cleaned.duration;
  if (cleaned.playCount !== song.playCount) patch.playCount = cleaned.playCount;
  if ((song.playbackPosition || 0) < 0 || !Number.isFinite(Number(song.playbackPosition || 0))) patch.playbackPosition = 0;

  return patch;
}

function buildSongSearchEntry(song: Song): SongSearchEntry {
  const rawFileName = stripAudioExtension(fileNameFromPath(song.filePath || song.url || ""));
  const fileName = normalizeSearchText(rawFileName);
  const title = normalizeSearchText(song.title);
  const artist = normalizeSearchText(song.artist);
  const album = normalizeSearchText(song.album);
  const filePath = normalizeSearchText(song.filePath || song.url || "");
  const compactTitle = compactSongKey(song.title || rawFileName);
  const compactArtist = compactSongKey(song.artist || "");
  const compactAlbum = compactSongKey(song.album || "");
  const haystack = [title, artist, album, fileName, filePath, compactTitle, compactArtist, compactAlbum, song.liked ? "liked favorite heart" : ""]
    .filter(Boolean)
    .join(" ");
  const tokens = Array.from(new Set(haystack.split(" ").filter(Boolean)));

  return {
    song,
    title,
    artist,
    album,
    fileName,
    filePath,
    compactTitle,
    compactArtist,
    compactAlbum,
    haystack,
    tokens
  };
}

function scoreSongSearch(entry: SongSearchEntry, search: SearchQueryInfo) {
  if (!search.clean) return 1;
  if (!search.terms.length) return 1;

  let score = 0;

  if (entry.title === search.clean) score += 280;
  if (entry.artist === search.clean) score += 190;
  if (entry.album === search.clean) score += 150;
  if (entry.title.startsWith(search.clean)) score += 165;
  if (entry.artist.startsWith(search.clean)) score += 110;
  if (entry.album.startsWith(search.clean)) score += 78;
  if (entry.compactTitle.includes(search.compact)) score += 100;
  if (entry.compactArtist.includes(search.compact)) score += 48;
  if (entry.fileName.includes(search.clean)) score += 58;
  if (entry.filePath.includes(search.clean)) score += 36;
  if (entry.haystack.includes(search.clean)) score += 44;

  for (const term of search.terms) {
    if (entry.title.startsWith(term)) score += 36;
    else if (entry.title.includes(term)) score += 26;
    else if (entry.artist.startsWith(term)) score += 22;
    else if (entry.artist.includes(term)) score += 18;
    else if (entry.album.includes(term)) score += 14;
    else if (entry.fileName.includes(term)) score += 12;
    else if (entry.filePath.includes(term)) score += 8;
    else if (entry.tokens.some((token) => token.startsWith(term) || token.includes(term))) score += 5;
    else return 0;
  }

  score += Math.min(entry.song.playCount || 0, 60) / 6;
  if (entry.song.liked) score += 3;

  return score;
}

function rankSongsForSearch(entries: SongSearchEntry[], query: string) {
  const search = prepareSearchQuery(query);
  if (!search.clean) return entries.map((entry) => entry.song);

  return entries
    .map((entry, index) => ({ entry, index, score: scoreSongSearch(entry, search) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.entry.song);
}

function prettyMeta(text: string) {
  const value = lower(collapseSpaces(text));
  return value || "unknown artist";
}

function discordArtist(text: string) {
  const value = prettyMeta(text);
  if (!value || value === "unknown" || value === "unknown artist") return "coderpixel :p";
  return value;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getGreeting(hour: number) {
  if (hour < 5) return "good night";
  if (hour < 12) return "good morning";
  if (hour < 17) return "good afternoon";
  if (hour < 22) return "good evening";
  return "late night vibes";
}

function toCssUrl(value?: string | null): string {
  if (!value) return "none";
  return `url(${JSON.stringify(value)})`;
}

function getAmbientStyle(coverUrl?: string | null): CSSProperties | undefined {
  if (!coverUrl) return undefined;

  return {
    "--cover-url": toCssUrl(coverUrl),
    "--cover-art-url": toCssUrl(coverUrl)
  } as CSSProperties;
}

function looksLikeDirectImageUrl(value?: string | null) {
  if (!value) return false;
  return /^(?:data:image\/|blob:|https?:\/\/|file:\/\/|\/)/i.test(value);
}

function getSongAmbientSource(song?: Song | null) {
  if (!song) return "";

  const directCover = String(song.coverUrl || "").trim();
  if (directCover) return directCover;

  const savedCover = String(song.coverPath || "").trim();
  if (looksLikeDirectImageUrl(savedCover)) return savedCover;

  const stableFallback = pixelArtForSong(song);
  return stableFallback ? pixelArtUrl(stableFallback.file) : "";
}


type CoverAverageStyle = CSSProperties & {
  "--cover-rgb"?: string;
  "--player-ambient-rgb"?: string;
  "--active-cover-rgb"?: string;
  "--cover-average"?: string;
};

const coverAverageColorCache = new Map<string, CoverAverageStyle>();
const fastAverageColor = typeof window !== "undefined" ? new FastAverageColor() : null;

function buildCoverAverageStyle(hex: string): CoverAverageStyle {
  const safeHex = normalizeHexColor(hex, "#8dffce");
  const rgb = hexToRgbString(safeHex, "#8dffce");

  return {
    "--cover-rgb": rgb,
    "--player-ambient-rgb": rgb,
    "--active-cover-rgb": rgb,
    "--cover-average": safeHex
  } as CoverAverageStyle;
}

function useCoverAverageStyle(source: string, enabled: boolean) {
  const [style, setStyle] = useState<CoverAverageStyle>({});
  const requestIdRef = useRef(0);

  useEffect(() => {
    const coverSource = String(source || "").trim();

    if (!enabled || !coverSource || !fastAverageColor) {
      setStyle({});
      return;
    }

    const cached = coverAverageColorCache.get(coverSource);
    if (cached) {
      setStyle(cached);
      return;
    }

    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const timer = window.setTimeout(() => {
      fastAverageColor
        .getColorAsync(coverSource, {
          algorithm: "sqrt",
          mode: "precision"
        })
        .then((color) => {
          if (cancelled || requestIdRef.current !== requestId) return;

          const nextStyle = buildCoverAverageStyle(color.hex);
          coverAverageColorCache.set(coverSource, nextStyle);
          setStyle(nextStyle);
        })
        .catch(() => {
          if (cancelled || requestIdRef.current !== requestId) return;
          setStyle({});
        });
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, source]);

  return style;
}

const Cover = memo(function Cover({ song, className }: { song: Song | null; className: string }) {
  const [failedSources, setFailedSources] = useState<Record<string, boolean>>({});
  const [imageReady, setImageReady] = useState(false);

  const directCover = String(song?.coverUrl || "").trim();
  const savedCover = String(song?.coverPath || "").trim();
  const savedCoverSrc = looksLikeDirectImageUrl(savedCover) ? savedCover : "";
  const fallbackAsset = song ? pixelArtForSong(song) : null;
  const backupFallbackAsset = song ? nextPixelArtForSong(song) : null;
  const fallbackSrc = fallbackAsset ? pixelArtUrl(fallbackAsset.file) : "";
  const backupFallbackSrc = backupFallbackAsset ? pixelArtUrl(backupFallbackAsset.file) : "";

  const sourceCandidates = [directCover, savedCoverSrc, fallbackSrc, backupFallbackSrc]
    .map((source) => source.trim())
    .filter(Boolean);
  const coverSrc = sourceCandidates.find((source) => !failedSources[source]) || "";
  const hasCover = Boolean(coverSrc);
  const fallback = song ? prettyTitle(song.title, 1).slice(0, 1) || "♪" : "♪";
  const style = hasCover ? ({ "--cover-art-url": toCssUrl(coverSrc), "--cover-url": toCssUrl(coverSrc) } as CSSProperties) : undefined;

  useEffect(() => {
    setFailedSources({});
    setImageReady(false);
  }, [song?.id, song?.coverUrl, song?.coverPath]);

  useEffect(() => {
    setImageReady(false);
  }, [coverSrc]);

  return (
    <div
      className={`coverAura ${className} ${hasCover ? "hasCover" : "noCover"} ${imageReady ? "coverReady" : "coverLoading"}`}
      style={style}
      data-cover-title={song?.title ?? "localtify"}
    >
      <span className="coverPlaceholder" aria-hidden="true">
        {fallback}
      </span>

      {hasCover ? (
        <img
          key={coverSrc}
          className={`coverImage ${imageReady ? "isLoaded" : ""}`}
          src={coverSrc}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageReady(true)}
          onError={() => {
            setImageReady(false);
            setFailedSources((old) => ({ ...old, [coverSrc]: true }));
          }}
        />
      ) : null}
    </div>
  );
});

type SongInteractionHandlers = {
  onSelectSong: (songId: string, shouldPlay?: boolean) => void;
  onTogglePlay: () => void;
  onToggleLike: (songId: string) => void;
  onOpenEditor: (song: Song) => void;
  onOpenPlaylistPicker: (song: Song) => void;
  onOpenSongContextMenu?: (event: ReactMouseEvent<HTMLElement>, song: Song) => void;
  onStartSongDrag: (event: DragEvent<HTMLElement>, songId: string) => void;
  onPointerStartSongDrag?: (event: PointerEvent<HTMLElement>, songId: string) => void;
  registerLibrarySongElement?: (songId: string, element: HTMLElement | null) => void;
  onDragOverSong: (event: DragEvent<HTMLElement>, songId: string) => void;
  onDragLeaveSong: (event: DragEvent<HTMLElement>, songId: string) => void;
  onDropSong: (event: DragEvent<HTMLElement>, songId: string) => void;
  onDragEnd: () => void;
};

type SongRowItemProps = SongInteractionHandlers & {
  song: Song;
  index: number;
  active: boolean;
  isPlaying: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  libraryDropSide: LibraryDropSide;
  draggedSongTitle: string;
};

const SongRowItem = memo(function SongRowItem({
  song,
  index,
  active,
  isPlaying,
  isDragging,
  isDropTarget,
  libraryDropSide,
  draggedSongTitle,
  onSelectSong,
  onToggleLike,
  onOpenEditor,
  onOpenPlaylistPicker,
  onOpenSongContextMenu,
  onStartSongDrag,
  onDragOverSong,
  onDragLeaveSong,
  onDropSong,
  onDragEnd
}: SongRowItemProps) {
  return (
    <article
      className={`songRow ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""} ${isDragging ? "songDragging" : ""} ${isDropTarget ? "songDropTarget" : ""}`}
      data-library-song-id={song.id}
      data-drop-side={isDropTarget ? libraryDropSide : undefined}
      draggable
      onDragStart={(event) => onStartSongDrag(event, song.id)}
      onDragOver={(event) => onDragOverSong(event, song.id)}
      onDragLeave={(event) => onDragLeaveSong(event, song.id)}
      onDrop={(event) => onDropSong(event, song.id)}
      onDragEnd={onDragEnd}
      onContextMenu={(event) => onOpenSongContextMenu?.(event, song)}
      aria-grabbed={isDragging}
      title={draggedSongTitle ? `dragging ${draggedSongTitle}` : "drag onto another song to reorder, or drop on the bottom player to play next"}
      style={{ "--stagger": `${Math.min(index, 20) * 18}ms` } as CSSProperties}
    >
      <button className="songButton" onClick={() => onSelectSong(song.id, true)}>
        <span className="songIndex">{active && isPlaying ? "▶" : index + 1}</span>

        <Cover song={song} className="songArt" />

        <span className="songMeta">
          <strong title={song.title}>{prettyTitle(song.title, 7)}</strong>
          <small>{prettyMeta(song.artist)}</small>
        </span>
      </button>

      <span className="songInfo songDurationInfo">{formatTime(song.duration)}</span>

      <button
        className={`iconAction ${song.liked ? "liked" : ""}`}
        onClick={() => onToggleLike(song.id)}
        aria-label="like song"
        title={song.liked ? "unlike" : "like"}
      >
        ♥
      </button>

      <button
        className="iconAction playlistAddAction"
        onClick={() => onOpenPlaylistPicker(song)}
        aria-label="add to playlist"
        title="add to playlist"
      >
        +
      </button>

      <button
        className="iconAction"
        onClick={() => onOpenEditor(song)}
        aria-label="edit song"
        title="edit details"
      >
        ⋯
      </button>

    </article>
  );
});

type HomeAlbumCardItemProps = SongInteractionHandlers & {
  song: Song;
  index: number;
  active: boolean;
  isPlaying: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  libraryDropSide: LibraryDropSide;
  draggedSongTitle: string;
};

const HomeAlbumCardItem = memo(function HomeAlbumCardItem({
  song,
  index,
  active,
  isPlaying,
  isDragging,
  isDropTarget,
  libraryDropSide,
  draggedSongTitle,
  onSelectSong,
  onTogglePlay,
  onToggleLike,
  onOpenEditor,
  onOpenPlaylistPicker,
  onOpenSongContextMenu,
  onStartSongDrag,
  onPointerStartSongDrag,
  registerLibrarySongElement,
  onDragOverSong,
  onDragLeaveSong,
  onDropSong,
  onDragEnd
}: HomeAlbumCardItemProps) {
  const rankLabel = index < 9 ? `0${index + 1}` : String(index + 1);

  function clickedInteractiveElement(target: EventTarget | null) {
    return target instanceof HTMLElement
      ? Boolean(target.closest("button, input, textarea, select, a, [role='button'], .homeAlbumActions"))
      : false;
  }

  return (
    <article
      ref={(element) => registerLibrarySongElement?.(song.id, element)}
      className={`homeAlbumCard ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""} ${isDragging ? "songDragging" : ""} ${isDropTarget ? "songDropTarget" : ""}`}
      data-library-song-id={song.id}
      data-drop-side={isDropTarget ? libraryDropSide : undefined}
      draggable={false}
      onClick={(event) => {
        if (clickedInteractiveElement(event.target)) return;
        onSelectSong(song.id, true);
      }}
      onPointerDown={(event) => {
        if (clickedInteractiveElement(event.target)) return;
        onPointerStartSongDrag?.(event, song.id);
      }}
      onContextMenu={(event) => onOpenSongContextMenu?.(event, song)}
      onDragStart={(event) => {
        event.preventDefault();
        onStartSongDrag(event, song.id);
      }}
      onDragOver={(event) => onDragOverSong(event, song.id)}
      onDragLeave={(event) => onDragLeaveSong(event, song.id)}
      onDrop={(event) => onDropSong(event, song.id)}
      onDragEnd={onDragEnd}
      aria-grabbed={isDragging}
      title={draggedSongTitle ? `dragging ${draggedSongTitle}` : "click to play, drag the card body to reorder"}
      style={{ "--stagger": `${Math.min(index, 28) * 16}ms` } as CSSProperties}
    >
      <button
        className="homeAlbumPlayZone homeAlbumCoverButton"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          active ? onTogglePlay() : onSelectSong(song.id, true);
        }}
        title={`${active && isPlaying ? "pause" : "play"} ${song.title}`}
        aria-label={`${active && isPlaying ? "pause" : "play"} ${song.title}`}
      >
        <Cover song={song} className="homeAlbumArt" />
        <span className="homeAlbumRank">{rankLabel}</span>
      </button>

      <div className="homeAlbumMeta">
        <strong title={song.title}>{prettyTitle(song.title, 7)}</strong>
        <small>{prettyMeta(song.artist)}</small>
      </div>

      <div className="homeAlbumStats">
        <span>{formatTime(song.duration)}</span>
      </div>

      <div className="homeAlbumActions">
        <button
          className={`iconAction ${song.liked ? "liked" : ""}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLike(song.id);
          }}
          aria-label="like song"
          title={song.liked ? "unlike" : "like"}
        >
          ♥
        </button>

        <button
          className="iconAction playlistAddAction"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenPlaylistPicker(song);
          }}
          aria-label="add to playlist"
          title="add to playlist"
        >
          +
        </button>

        <button
          className="iconAction"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenEditor(song);
          }}
          aria-label="edit song"
          title="edit details"
        >
          ⋯
        </button>
      </div>
    </article>
  );
});


type VirtualSongRowsProps = SongInteractionHandlers & {
  list: Song[];
  className: string;
  currentId: string;
  isPlaying: boolean;
  draggedSongId: string;
  libraryDragOverSongId: string;
  libraryDropSide: LibraryDropSide;
  draggedSongTitle: string;
  onAreaDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onAreaDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onAreaDrop: (event: DragEvent<HTMLDivElement>) => void;
};

const VirtualSongRows = memo(function VirtualSongRows({
  list,
  className,
  currentId,
  isPlaying,
  draggedSongId,
  libraryDragOverSongId,
  libraryDropSide,
  draggedSongTitle,
  onAreaDragOver,
  onAreaDragLeave,
  onAreaDrop,
  onSelectSong,
  onTogglePlay,
  onToggleLike,
  onOpenEditor,
  onOpenPlaylistPicker,
  onOpenSongContextMenu,
  onStartSongDrag,
  onDragOverSong,
  onDragLeaveSong,
  onDropSong,
  onDragEnd
}: VirtualSongRowsProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 74,
    overscan: 8,
    getItemKey: (index) => list[index]?.id || index
  });

  if (!list.length) {
    return (
      <div
        className={className}
        onDragOver={onAreaDragOver}
        onDragLeave={onAreaDragLeave}
        onDrop={onAreaDrop}
      >
        <div className="emptyState">
          <strong>import songs to fill this area</strong>
          <p>import some music and this area will wake up.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`${className} virtualSongViewport virtualSongRowsViewport`}
      onDragOver={onAreaDragOver}
      onDragLeave={onAreaDragLeave}
      onDrop={onAreaDrop}
      data-virtual-count={list.length}
    >
      <div
        className="virtualSongCanvas"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const song = list[virtualRow.index];
          if (!song) return null;

          const active = song.id === currentId;
          const isDragging = draggedSongId === song.id;
          const isDropTarget = Boolean(draggedSongId && draggedSongId !== song.id && libraryDragOverSongId === song.id);

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="virtualSongItem"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <SongRowItem
                song={song}
                index={virtualRow.index}
                active={active}
                isPlaying={isPlaying}
                isDragging={isDragging}
                isDropTarget={isDropTarget}
                libraryDropSide={libraryDropSide}
                draggedSongTitle={draggedSongTitle}
                onSelectSong={onSelectSong}
                onTogglePlay={onTogglePlay}
                onToggleLike={onToggleLike}
                onOpenEditor={onOpenEditor}
                onOpenPlaylistPicker={onOpenPlaylistPicker}
                onOpenSongContextMenu={onOpenSongContextMenu}
                onStartSongDrag={onStartSongDrag}
                onDragOverSong={onDragOverSong}
                onDragLeaveSong={onDragLeaveSong}
                onDropSong={onDropSong}
                onDragEnd={onDragEnd}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

type VirtualHomeSongCardsProps = SongInteractionHandlers & {
  list: Song[];
  className: string;
  currentId: string;
  isPlaying: boolean;
  draggedSongId: string;
  libraryDragOverSongId: string;
  libraryDropSide: LibraryDropSide;
  draggedSongTitle: string;
  onAreaDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onAreaDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onAreaDrop: (event: DragEvent<HTMLDivElement>) => void;
};

const VirtualHomeSongCards = memo(function VirtualHomeSongCards({
  list,
  className,
  currentId,
  isPlaying,
  draggedSongId,
  libraryDragOverSongId,
  libraryDropSide,
  draggedSongTitle,
  onAreaDragOver,
  onAreaDragLeave,
  onAreaDrop,
  onSelectSong,
  onTogglePlay,
  onToggleLike,
  onOpenEditor,
  onOpenPlaylistPicker,
  onOpenSongContextMenu,
  onStartSongDrag,
  onPointerStartSongDrag,
  registerLibrarySongElement,
  onDragOverSong,
  onDragLeaveSong,
  onDropSong,
  onDragEnd
}: VirtualHomeSongCardsProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useLayoutEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const updateWidth = () => setViewportWidth(element.clientWidth || 0);
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const isSimpleGrid = className.includes("simpleAlbumGrid");
  const minColumnWidth = isSimpleGrid ? 156 : 168;
  const gridGap = 14;
  const columns = Math.max(1, Math.floor(((viewportWidth || minColumnWidth) + gridGap) / (minColumnWidth + gridGap)));
  const rowCount = Math.max(1, Math.ceil(list.length / columns));

  const rowVirtualizer = useVirtualizer({
    count: list.length ? rowCount : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 256,
    overscan: 4,
    getItemKey: (rowIndex) => {
      const firstSong = list[rowIndex * columns];
      return firstSong?.id ? `${firstSong.id}-${columns}` : `${rowIndex}-${columns}`;
    }
  });

  if (!list.length) {
    return (
      <div
        className={className}
        onDragOver={onAreaDragOver}
        onDragLeave={onAreaDragLeave}
        onDrop={onAreaDrop}
      >
        <div className="emptyState homeAlbumEmpty">
          <strong>import songs to fill this area</strong>
          <p>import some music and this expanded area turns into a proper home library.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`${className} virtualSongViewport virtualHomeGridViewport`}
      onDragOver={onAreaDragOver}
      onDragLeave={onAreaDragLeave}
      onDrop={onAreaDrop}
      data-virtual-count={list.length}
      data-virtual-columns={columns}
    >
      <div
        className="virtualSongCanvas virtualHomeGridCanvas"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowStartIndex = virtualRow.index * columns;
          const rowSongs = list.slice(rowStartIndex, rowStartIndex + columns);

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="virtualHomeGridRow"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
              }}
            >
              {rowSongs.map((song, offset) => {
                const index = rowStartIndex + offset;
                const active = song.id === currentId;
                const isDragging = draggedSongId === song.id;
                const isDropTarget = Boolean(draggedSongId && draggedSongId !== song.id && libraryDragOverSongId === song.id);

                return (
                  <HomeAlbumCardItem
                    key={song.id}
                    song={song}
                    index={index}
                    active={active}
                    isPlaying={isPlaying}
                    isDragging={isDragging}
                    isDropTarget={isDropTarget}
                    libraryDropSide={libraryDropSide}
                    draggedSongTitle={draggedSongTitle}
                    onSelectSong={onSelectSong}
                    onTogglePlay={onTogglePlay}
                    onToggleLike={onToggleLike}
                    onOpenEditor={onOpenEditor}
                    onOpenPlaylistPicker={onOpenPlaylistPicker}
                    onOpenSongContextMenu={onOpenSongContextMenu}
                    onStartSongDrag={onStartSongDrag}
                    onPointerStartSongDrag={onPointerStartSongDrag}
                    registerLibrarySongElement={registerLibrarySongElement}
                    onDragOverSong={onDragOverSong}
                    onDragLeaveSong={onDragLeaveSong}
                    onDropSong={onDropSong}
                    onDragEnd={onDragEnd}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function readPlaylistDraggedSongId(event: DragEvent<HTMLElement>, fallbackSongId = "") {
  return (
    event.dataTransfer.getData("text/localitfy-song-id") ||
    event.dataTransfer.getData("text/plain") ||
    fallbackSongId
  );
}

function getPlaylistDropSide(event: DragEvent<HTMLElement>): LibraryDropSide {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerY = rect.top + rect.height / 2;
  return event.clientY < centerY ? "before" : "after";
}

type VirtualPlaylistTrackListProps = {
  selectedPlaylistId: string;
  list: Song[];
  currentId: string;
  isPlaying: boolean;
  draggedSongId: string;
  onSelectSong: (songId: string) => void;
  onStartSongDrag: (event: DragEvent<HTMLElement>, songId: string) => void;
  onDropSong: (playlistId: string, draggedSongId: string, targetSongId: string, side: LibraryDropSide) => void;
  onAppendSong: (playlistId: string, draggedSongId: string) => void;
  onDragEnd: () => void;
  onOpenContextMenu: (event: ReactMouseEvent<HTMLElement>, song: Song) => void;
  onRemoveSong: (playlistId: string, songId: string) => void;
};

const VirtualPlaylistTrackList = memo(function VirtualPlaylistTrackList({
  selectedPlaylistId,
  list,
  currentId,
  isPlaying,
  draggedSongId,
  onSelectSong,
  onStartSongDrag,
  onDropSong,
  onAppendSong,
  onDragEnd,
  onOpenContextMenu,
  onRemoveSong
}: VirtualPlaylistTrackListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [dropTarget, setDropTarget] = useState<{ songId: string; side: LibraryDropSide } | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) => `${selectedPlaylistId}-${list[index]?.id || index}`
  });

  const clearLocalDropTarget = useCallback(() => {
    setDropTarget((current) => (current ? null : current));
  }, []);

  const handleEmptyDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    const songId = readPlaylistDraggedSongId(event, draggedSongId);
    if (!selectedPlaylistId || !songId) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }, [draggedSongId, selectedPlaylistId]);

  const handleEmptyDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    const songId = readPlaylistDraggedSongId(event, draggedSongId);
    if (!selectedPlaylistId || !songId) return;

    event.preventDefault();
    event.stopPropagation();
    onAppendSong(selectedPlaylistId, songId);
    clearLocalDropTarget();
    onDragEnd();
  }, [clearLocalDropTarget, draggedSongId, onAppendSong, onDragEnd, selectedPlaylistId]);

  if (!selectedPlaylistId || !list.length) {
    return (
      <div
        className={`playlistEmptyState ${selectedPlaylistId ? "playlistDropEmpty" : ""}`}
        onDragOver={handleEmptyDragOver}
        onDrop={handleEmptyDrop}
      >
        <strong>{selectedPlaylistId ? "This playlist is empty" : "Choose a playlist"}</strong>
        <p>{selectedPlaylistId ? "Drop a song here, or use the + button on any song to add music." : "Your playlist songs will show up here."}</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="playlistTrackList virtualPlaylistTrackList" aria-label="playlist songs">
      <div className="virtualPlaylistTrackCanvas" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const song = list[virtualRow.index];
          if (!song) return null;

          const active = song.id === currentId;
          const isDragging = draggedSongId === song.id;
          const isDropTarget = dropTarget?.songId === song.id && draggedSongId !== song.id;

          return (
            <article
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className={`playlistTrackRow virtualPlaylistTrackRow ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""} ${isDragging ? "songDragging" : ""} ${isDropTarget ? "songDropTarget" : ""}`}
              data-drop-side={isDropTarget ? dropTarget?.side : undefined}
              style={{
                "--playlist-row-y": `${virtualRow.start}px`,
                "--playlist-stagger": Math.min(virtualRow.index, 12)
              } as CSSProperties}
              draggable
              onDragStart={(event) => onStartSongDrag(event, song.id)}
              onDragOver={(event) => {
                const incomingSongId = readPlaylistDraggedSongId(event, draggedSongId);
                if (!incomingSongId || incomingSongId === song.id) return;

                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = list.some((item) => item.id === incomingSongId) ? "move" : "copy";

                const side = getPlaylistDropSide(event);
                setDropTarget((current) => (
                  current?.songId === song.id && current.side === side
                    ? current
                    : { songId: song.id, side }
                ));
              }}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget;
                if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
                setDropTarget((current) => (current?.songId === song.id ? null : current));
              }}
              onDrop={(event) => {
                const incomingSongId = readPlaylistDraggedSongId(event, draggedSongId);
                if (!incomingSongId || incomingSongId === song.id) return;

                event.preventDefault();
                event.stopPropagation();
                const side = getPlaylistDropSide(event);
                onDropSong(selectedPlaylistId, incomingSongId, song.id, side);
                clearLocalDropTarget();
                onDragEnd();
              }}
              onDragEnd={() => {
                clearLocalDropTarget();
                onDragEnd();
              }}
              onContextMenu={(event) => onOpenContextMenu(event, song)}
            >
              <span className="playlistTrackGrip">⋮⋮</span>
              <button className="playlistTrackMain" type="button" onClick={() => onSelectSong(song.id)}>
                <span className="playlistTrackIndex">{active && isPlaying ? "▶" : virtualRow.index + 1}</span>
                <Cover song={song} className="playlistTrackCover" />
                <span className="playlistTrackText">
                  <strong>{prettyTitle(song.title, 7)}</strong>
                  <small>{prettyMeta(song.artist)}</small>
                </span>
              </button>
              <span className="playlistTrackDuration">{formatTime(song.duration)}</span>
              <button className="iconAction" type="button" onClick={() => onRemoveSong(selectedPlaylistId, song.id)} aria-label="remove from playlist">
                ×
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
});

function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args: Parameters<T>) => callbackRef.current(...args)) as T, []);
}


function TitleBar({ mini = false }: { mini?: boolean }) {
  function handleTitleDoubleClick() {
    if (!mini) window.localitfy.toggleMaximizeWindow();
  }

  return (
    <header className={mini ? "titleBar miniTitleBar" : "titleBar"}>
      <div className="titleDrag" onDoubleClick={handleTitleDoubleClick} title="drag to move localtify">
        <img className="titleLogo titleLogoImage" src={localtifyLogo} alt="" aria-hidden="true" />
        <span>localtify</span>
      </div>

      <div className="windowButtons">
        <button type="button" onClick={() => window.localitfy.minimizeWindow()} aria-label="Minimize window">─</button>
        {!mini ? (
          <button type="button" onClick={() => window.localitfy.toggleMaximizeWindow()} aria-label="Maximize window">□</button>
        ) : null}
        <button type="button" className="closeWin" onClick={() => window.localitfy.closeWindow()} aria-label="Close window">
          ×
        </button>
      </div>
    </header>
  );
}


function buildDiscordPreview({
  settings,
  song,
  isPlaying,
  currentTime,
  currentDuration,
  totalSongs,
  mostPlayed
}: {
  settings: Settings;
  song: Song | null;
  isPlaying: boolean;
  currentTime: number;
  currentDuration: number;
  totalSongs: number;
  mostPlayed: Song | null;
}) {
  const title = previewTitle(song?.title || "local song", settings.discordTitleCleanup, 7);
  const artist = discordArtist(song?.artist || "");
  const album = prettyMeta(song?.album || "local files");
  const timeLeft = formatTime(Math.max(0, (currentDuration || song?.duration || 0) - currentTime)) + " left";

  if (settings.discordPrivacyMode) {
    return {
      badge: isPlaying ? "PLAYING" : "IDLE",
      details: "Listening to local music",
      state: "localtify"
    };
  }

  if (!song) {
    return {
      badge: "IDLE",
      details: "browsing localtify",
      state: `${totalSongs} song${totalSongs === 1 ? "" : "s"} imported`
    };
  }

  let moodTitle = title;

  if (song.liked) moodTitle = `♡ ${title}`;
  else if (mostPlayed && mostPlayed.id === song.id) moodTitle = `on repeat • ${title}`;
  else if ((song.playCount || 0) <= 0) moodTitle = `discovering • ${title}`;

  const getSecondLine = () => {
    if (settings.discordSecondLine === "album") return album;
    if (settings.discordSecondLine === "timeLeft") return timeLeft;
    if (settings.discordSecondLine === "playCount") return `played ${song.playCount || 0} times`;
    if (settings.discordSecondLine === "appName") return "localtify";
    return artist;
  };

  if (!isPlaying && settings.discordShowPausedIdle) {
    return {
      badge: "PAUSED",
      details: `paused • ${title}`,
      state: timeLeft
    };
  }

  if (settings.discordActivityStyle === "cute") {
    return {
      badge: "PLAYING",
      details: `vibing to ${moodTitle} ♡`,
      state: `${getSecondLine()} • localtify`
    };
  }

  if (settings.discordActivityStyle === "detailed") {
    return {
      badge: "PLAYING",
      details: moodTitle,
      state: `${artist} • ${album} • ${timeLeft}`
    };
  }

  if (settings.discordActivityStyle === "minimal") {
    return {
      badge: "PLAYING",
      details: moodTitle,
      state: "localtify"
    };
  }

  if (settings.discordActivityStyle === "meme") {
    return {
      badge: "PLAYING",
      details: `currently emotionally damaged by ${title}`,
      state: getSecondLine()
    };
  }

  return {
    badge: "PLAYING",
    details: `♪ ${moodTitle}`,
    state: getSecondLine()
  };
}

function MainModeApp() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const progressLoopTimeoutRef = useRef<number | null>(null);
  const saveSettingsTimerRef = useRef<number | null>(null);
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
  const konamiBufferRef = useRef<string[]>([]);
  const secretTimeoutRef = useRef<number | null>(null);
  const playButtonBurstTimerRef = useRef<number | null>(null);
  const beatFrameRef = useRef<number | null>(null);
  const beatAudioContextRef = useRef<AudioContext | null>(null);
  const beatAnalyserRef = useRef<AnalyserNode | null>(null);
  const beatSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const beatDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const beatSmoothRef = useRef({ bass: 0, mid: 0, energy: 0, phase: 0 });
  const misideTimerRef = useRef<number | null>(null);
  const discordAssetBySongRef = useRef<Record<string, string>>({});
  const lastDiscordAssetKeyRef = useRef<string>("");
  const contentRef = useRef<HTMLElement | null>(null);
  const scrollBusyRef = useRef(false);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const themeSettlingTimerRef = useRef<number | null>(null);
  const customThemeCommitTimerRef = useRef<number | null>(null);
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
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const [volumeDraft, setVolumeDraft] = useState(() => Math.round(defaultSettings.volume * 100));
  const volumeDraftRef = useRef(Math.round(defaultSettings.volume * 100));
  const [view, setView] = useState<View>("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("appearance");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [isAppBackgrounded, setIsAppBackgrounded] = useState(() => (typeof document === "undefined" ? false : document.hidden));
  const isAppBackgroundedRef = useRef(isAppBackgrounded);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const deferredSettingsSearch = useDeferredValue(settingsSearch);
  const [isViewSwitching, setIsViewSwitching] = useState(false);
  const [customThemeName, setCustomThemeName] = useState("My Custom Theme");
  const [customThemeHexDrafts, setCustomThemeHexDrafts] = useState<Partial<Record<CustomThemeColorKey, string>>>({});
  const [savedCustomThemes, setSavedCustomThemes] = useState<CustomThemePreset[]>(() => readSavedCustomThemePresets());
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    try {
      return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "done";
    } catch {
      return true;
    }
  });
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
  const [secretMode, setSecretMode] = useState<SecretMode>("none");
  const [secretToast, setSecretToast] = useState("");
  const [secretBurst, setSecretBurst] = useState(0);
  const [playButtonBurst, setPlayButtonBurst] = useState(0);
  const [misideModeActive, setMisideModeActive] = useState(false);
  const [arcadeGhostUnlocked, setArcadeGhostUnlocked] = useState(() => {
    try {
      return window.localStorage.getItem(ARCADE_GHOST_UNLOCKED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const isThreeAm = now.getHours() === 3;
  const greeting = isThreeAm ? "late night local files" : getGreeting(now.getHours());

  useEffect(() => {
    isAppBackgroundedRef.current = isAppBackgrounded;
    document.body.classList.toggle("localtifyBackgroundMode", isAppBackgrounded);

    return () => {
      document.body.classList.remove("localtifyBackgroundMode");
    };
  }, [isAppBackgrounded]);

  useEffect(() => {
    const analyticsReady = initLocalitfyAnalytics(APP_VERSION);

    if (analyticsReady) {
      trackAppLaunched({ initial_view: analyticsViewRef.current });
      trackAppActive({ reason: "launch", current_view: analyticsViewRef.current });
      trackAcquisitionSource({ source: "direct_app_launch", initial_view: analyticsViewRef.current });
    }

    const finishAnalyticsSession = (reason: "beforeunload" | "unmount") => {
      if (analyticsSessionEndedRef.current) return;
      analyticsSessionEndedRef.current = true;
      trackAppSessionEnded({ reason, current_view: analyticsViewRef.current });
    };

    const handleBeforeUnload = () => {
      finishAnalyticsSession("beforeunload");
    };

    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsAppBackgrounded(hidden);

      if (hidden) {
        trackAppBackgrounded({ reason: "visibility_hidden", current_view: analyticsViewRef.current });
        return;
      }

      trackAppForegrounded({ reason: "visibility_visible", current_view: analyticsViewRef.current });
      trackAppActive({ reason: "visibility_visible", current_view: analyticsViewRef.current });
    };

    const handleFocus = () => {
      if (!document.hidden) setIsAppBackgrounded(false);
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

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      finishAnalyticsSession("unmount");
      window.clearInterval(heartbeatTimer);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!ready || !onboardingOpen || onboardingDevPreview || songs.length === 0) return;

    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
    } catch {
      // localStorage can fail in dev/private contexts; the UI can still continue safely.
    }

    setOnboardingOpen(false);
  }, [ready, onboardingOpen, onboardingDevPreview, songs.length]);

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
      : "no exact section found — Search for settings such as Discord, theme, cover, update, volume."
    : "Search for settings such as Discord, theme, cover, update, volume.";

  function handleSettingsSearchInput(value: string) {
    setSettingsSearch(value);

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
        "localitfyHeroCoverShrinking"
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

    const handleUserActivity = () => {
      if (Date.now() < screensaverIgnoreActivityUntilRef.current) return;
      setScreensaverVisible(false);
      armScreensaverTimer();
    };

    if (!canShowScreensaver) {
      setScreensaverVisible(false);
      clearScreensaverTimer();
      return clearScreensaverTimer;
    }

    armScreensaverTimer();
    window.addEventListener("pointermove", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("wheel", handleUserActivity, { passive: true });

    return () => {
      clearScreensaverTimer();
      window.removeEventListener("pointermove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("wheel", handleUserActivity);
    };
  }, [currentSong?.id, isPlaying, screensaverPreviewActive, settings.animeVisuals, settings.animatedBackgrounds]);

  const heroDisplayTitle = currentSong ? prettyTitle(currentSong.title, 9) : "drop in your music";
  const heroDisplayArtist = currentSong ? prettyMeta(currentSong.artist) : "import songs to start listening";
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
    if (!currentSong) return "empty";
    return [currentSong.id, currentSong.filePath, currentSong.title, currentSong.artist, currentSong.coverUrl]
      .filter(Boolean)
      .join("::");
  }, [currentSong?.id, currentSong?.filePath, currentSong?.title, currentSong?.artist, currentSong?.coverUrl]);

  useEffect(() => {
    if (!ready || !songs.length) return;
    saveLibraryOrder(songs);
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

    const markScrollBusy = () => {
      scrollBusyRef.current = true;

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
        scrollIdleTimerRef.current = null;
      }, 140);
    };

    node.addEventListener("scroll", markScrollBusy, { passive: true });
    node.addEventListener("wheel", markScrollBusy, { passive: true });

    return () => {
      node.removeEventListener("scroll", markScrollBusy);
      node.removeEventListener("wheel", markScrollBusy);

      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }

      scrollBusyRef.current = false;
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

      if (sidebarResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(sidebarResizeFrameRef.current);
        sidebarResizeFrameRef.current = null;
      }

      if (appRootRef.current) {
        appRootRef.current.style.removeProperty("--player-size-live");
        appRootRef.current.style.removeProperty("--sidebar-width-live");
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

  const diagnosticsInfo = useMemo(() => {
    const themeLabel = settings.customThemeEnabled ? `${currentTheme.name} + custom colors` : currentTheme.name;
    const discordStatus = settings.discordEnabled ? "enabled" : "disabled";
    const startupStatus = settings.startWithWindows ? "enabled" : "disabled";

    const items = [
      { label: "app version", value: APP_VERSION },
      { label: "song count", value: String(songs.length) },
      { label: "playlist count", value: String(playlists.length) },
      { label: "theme", value: themeLabel },
      { label: "Discord status", value: discordStatus },
      { label: "startup status", value: startupStatus }
    ];

    return {
      items,
      copyText: [
        `localtify version: ${APP_VERSION}`,
        `song count: ${songs.length}`,
        `playlist count: ${playlists.length}`,
        `theme: ${themeLabel}`,
        `Discord status: ${discordStatus}`,
        `startup status: ${startupStatus}`
      ].join("\n")
    };
  }, [
    currentTheme.name,
    playlists.length,
    settings.customThemeEnabled,
    settings.discordEnabled,
    settings.startWithWindows,
    songs.length
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
        { label: "Background", key: "customThemeBackground", value: customThemeBackground, help: "app background" },
        { label: "Surface", key: "customThemeSurface", value: customThemeSurface, help: "cards and panels" },
        { label: "Text", key: "customThemeText", value: customThemeText, help: "main text" },
        { label: "Accent", key: "customThemeColor", value: customThemeColor, help: "buttons and active items" },
        { label: "Accent 2", key: "customThemeColor2", value: customThemeColor2, help: "soft details" },
        { label: "Highlight", key: "customThemeHighlight", value: customThemeHighlight, help: "small labels" },
        { label: "Progress", key: "customThemeProgress", value: customThemeProgress, help: "player bar and sliders" }
      ] as Array<{ label: string; key: CustomThemeColorKey; value: string; help: string }>,
    [
      customThemeBackground,
      customThemeSurface,
      customThemeText,
      customThemeColor,
      customThemeColor2,
      customThemeHighlight,
      customThemeProgress
    ]
  );

  function clearPendingCustomThemeCommit() {
    if (customThemeCommitTimerRef.current !== null) {
      window.clearTimeout(customThemeCommitTimerRef.current);
      customThemeCommitTimerRef.current = null;
    }
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
    beginFastThemePaint();

    if (!themeSettlingRef.current) {
      themeSettlingRef.current = true;
      setThemeSettling(true);
    }

    if (themeSettlingTimerRef.current) {
      window.clearTimeout(themeSettlingTimerRef.current);
    }

    themeSettlingTimerRef.current = window.setTimeout(() => {
      themeSettlingRef.current = false;
      setThemeSettling(false);
      themeSettlingTimerRef.current = null;
    }, 280);
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

    queueCustomThemePreviewPatch(customThemeLivePatchRef.current);
    clearPendingCustomThemeCommit();

    customThemeCommitTimerRef.current = window.setTimeout(() => {
      const commitPatch = {
        ...customThemeLivePatchRef.current,
        customThemeEnabled: true
      };

      customThemeCommitTimerRef.current = null;
      customThemeLivePatchRef.current = {};

      setSettings((old) => {
        const next: Settings = {
          ...old,
          ...commitPatch
        };

        if (bootedRef.current) {
          window.localitfy.saveSettings(next).catch(() => undefined);
        }

        return next;
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
    stageCustomThemePatch({ [key]: safeColor } as Partial<Settings>);
  }

  function handleCustomThemeNativeColor(key: CustomThemeColorKey, value: string) {
    const safeColor = normalizeHexColor(value, getCustomThemeFallbackColor(key));
    setCustomThemeHexDrafts((old) => ({ ...old, [key]: safeColor }));
    stageCustomThemeColor(key, safeColor);
  }

  function handleCustomThemeHexDraftChange(key: CustomThemeColorKey, value: string) {
    const draft = normalizeHexInputDraft(value);
    setCustomThemeHexDrafts((old) => ({ ...old, [key]: draft }));

    if (isCompleteHexColorInput(draft)) {
      stageCustomThemeColor(key, draft);
    }
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
    orb.textContent = song.liked ? "♥" : "♫";

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


  function openSnakeGame() {
    const gameUrl = new URL("snakegame.html", window.location.href).toString();

    const popup = window.open(
      gameUrl,
      "localitfy-snakegame",
      "width=560,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no"
    );

    if (popup) {
      popup.focus();
      showAppToast("snake game opened 🐍", "success");
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

    document.body.classList.add("localitfyHeroReflowing");
    document.body.classList.remove("localitfyHeroCoverGrowing", "localitfyHeroCoverShrinking");

    if (heroReflowTimerRef.current !== null) {
      window.clearTimeout(heroReflowTimerRef.current);
    }

    if (heroCoverMotionTimerRef.current !== null) {
      window.clearTimeout(heroCoverMotionTimerRef.current);
      heroCoverMotionTimerRef.current = null;
    }

    window.requestAnimationFrame(() => {
      document.body.classList.add(nextExpanded ? "localitfyHeroCoverGrowing" : "localitfyHeroCoverShrinking");
    });

    heroReflowTimerRef.current = window.setTimeout(() => {
      document.body.classList.remove("localitfyHeroReflowing");
      heroReflowTimerRef.current = null;
    }, 620);

    heroCoverMotionTimerRef.current = window.setTimeout(() => {
      document.body.classList.remove("localitfyHeroCoverGrowing", "localitfyHeroCoverShrinking");
      heroCoverMotionTimerRef.current = null;
    }, 760);

    // Save this setting through the debounced path. That keeps the click
    // animation away from an immediate disk write while still persisting it.
    window.requestAnimationFrame(() => {
      void updateSetting("heroExpanded", nextExpanded, true);
    });
  }

  function toggleHeroExpanded() {
    setHeroExpanded(!settings.heroExpanded);
  }

  const starParticleStyles = useMemo(
    () =>
      Array.from({ length: 124 }, (_, index) => {
        const baseSeed = stableHash(`${secretBurst}:${currentSong?.id || "idle"}:localtify-white-stars:${index}`);
        const random = (salt: number) => {
          const raw = Math.sin((baseSeed + salt * 7919) * 12.9898) * 43758.5453123;
          return raw - Math.floor(raw);
        };
        const x = random(1) * 100;
        const y = random(2) * 100;
        const dx = Math.round((random(3) - 0.5) * 78);
        const dy = Math.round((random(4) - 0.5) * 58);
        const size = Math.round(3 + random(5) * 12);
        const delay = Math.round(-random(6) * 26000);
        const duration = Math.round(14000 + random(7) * 24000);
        const alpha = 0.34 + random(8) * 0.62;

        return {
          "--x": `${x.toFixed(2)}%`,
          "--y": `${y.toFixed(2)}%`,
          "--dx": `${dx}px`,
          "--dy": `${dy}px`,
          "--size": `${size}px`,
          "--delay": `${delay}ms`,
          "--duration": `${duration}ms`,
          "--alpha": alpha.toFixed(2)
        } as CSSProperties;
      }),
    [secretBurst, currentSong?.id]
  );
  const misideAlbumSignature = currentSong ? lower(currentSong.album || "") : "";
  const misideFullSignature = currentSong
    ? lower(`${currentSong.title} ${currentSong.artist} ${currentSong.album} ${currentSong.filePath} ${currentSong.coverPath || ""}`)
    : "";
  const misideLooseAlbumHit =
    misideAlbumSignature.includes("miside") ||
    misideAlbumSignature.includes("mi side") ||
    misideAlbumSignature.includes("mita");
  const isMisideSong =
    misideLooseAlbumHit || /(?:^|[^a-z0-9])(?:miside|mi\s*side|mita)(?:[^a-z0-9]|$)/.test(misideFullSignature);

  const librarySearchIndex = useMemo(() => songs.map((song) => buildSongSearchEntry(song)), [songs]);

  const filteredSongs = useMemo(() => {
    if (!deferredQuery.trim()) return songs;
    return rankSongsForSearch(librarySearchIndex, deferredQuery);
  }, [librarySearchIndex, deferredQuery, songs]);

  const likedSongs = useMemo(() => songs.filter((song) => song.liked), [songs]);

  const topSongs = useMemo(() => {
    return [...songs].sort((a, b) => b.playCount - a.playCount).slice(0, 6);
  }, [songs]);

  const mostPlayed = topSongs[0] ?? null;
  const visibleSongs = view === "liked" ? likedSongs : filteredSongs;

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


  const analyticsAudienceSnapshot = useMemo(() => {
    const songCount = songs.length;
    const likedCount = likedSongs.length;
    const playlistCount = playlists.length;
    const playlistSongTotal = playlists.reduce((total, playlist) => total + playlist.songIds.length, 0);
    const libraryDurationSeconds = Math.round(songs.reduce((total, song) => total + (song.duration || 0), 0));
    const playedSongCount = songs.filter((song) => (song.playCount || 0) > 0).length;
    const recentImportCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentImportCount = songs.filter((song) => {
      const addedAt = Date.parse(song.dateAdded || "");
      return Number.isFinite(addedAt) && addedAt >= recentImportCutoff;
    }).length;

    const artistCount = new Set(
      songs
        .map((song) => String(song.artist || "").trim().toLowerCase())
        .filter((artist) => artist && artist !== "unknown artist")
    ).size;

    const albumCount = new Set(
      songs
        .map((song) => String(song.album || "").trim().toLowerCase())
        .filter((album) => album && album !== "unknown album")
    ).size;

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
      active_view: view,
      user_stage: userStage,
      audience_segment: audienceSegment,
      primary_ad_angle: primaryAdAngle,
      song_count: songCount,
      liked_count: likedCount,
      playlist_count: playlistCount,
      playlist_song_total: playlistSongTotal,
      library_duration_seconds: libraryDurationSeconds,
      played_song_count: playedSongCount,
      recent_import_count: recentImportCount,
      artist_count: artistCount,
      album_count: albumCount,
      has_library: songCount > 0,
      has_liked_songs: likedCount > 0,
      has_playlists: playlistCount > 0,
      has_played_music: playedSongCount > 0,
      discord_enabled: settings.discordEnabled,
      discord_privacy_mode: settings.discordPrivacyMode,
      discord_buttons_enabled: settings.discordButtons,
      discord_art_mode: settings.discordArtMode,
      discord_activity_style: settings.discordActivityStyle,
      start_with_windows_enabled: settings.startWithWindows,
      minimize_to_tray_enabled: settings.minimizeToTray,
      custom_theme_enabled: settings.customThemeEnabled,
      theme_id: settings.customThemeEnabled ? "custom" : settings.theme,
      cover_color_sync_mode: settings.coverColorSyncMode,
      compact_player_enabled: settings.compactPlayer,
      simple_mode_enabled: settings.simpleMode,
      reduced_motion_enabled: settings.reducedMotion,
      crossfade_enabled: settings.crossfadeEnabled,
      gapless_enabled: settings.gaplessPlayback,
      volume_normalization_enabled: settings.volumeNormalization,
      per_song_volume_memory_enabled: settings.perSongVolumeMemory,
      playback_speed_changed: settings.playbackSpeed !== 1,
      shuffle_enabled: isShuffle,
      repeat_mode: repeatMode,
      download_result_count: downloadResults.length
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
    if (!ready) return;

    trackAudienceSnapshot(analyticsAudienceSnapshot);
    trackMarketingSnapshot(analyticsAudienceSnapshot);
    trackPlaylistSnapshot({
      playlist_count: analyticsAudienceSnapshot.playlist_count,
      playlist_song_total: analyticsAudienceSnapshot.playlist_song_total,
      has_playlists: analyticsAudienceSnapshot.has_playlists,
      user_stage: analyticsAudienceSnapshot.user_stage,
      audience_segment: analyticsAudienceSnapshot.audience_segment
    });
  }, [ready, analyticsAudienceSnapshot]);

  const showHomeSideCards = settings.showRightColumn && !settings.homeExpanded;
  const homeDashboardClass = [
    "dashboardGrid",
    showHomeSideCards ? "" : "singleColumn",
    settings.homeExpanded ? "homeExpandedGrid" : "homeCompactGrid"
  ]
    .filter(Boolean)
    .join(" ");

  const totalPlays = useMemo(() => songs.reduce((total, song) => total + song.playCount, 0), [songs]);

  const libraryAlbumCount = useMemo(() => {
    const names = songs
      .map((song) => String(song.album || "").trim().toLowerCase())
      .filter(Boolean);

    return new Set(names).size;
  }, [songs]);

  const libraryArtistCount = useMemo(() => {
    const names = songs
      .map((song) => String(song.artist || "").trim().toLowerCase())
      .filter(Boolean);

    return new Set(names).size;
  }, [songs]);

  const totalMinutes = useMemo(() => {
    const seconds = songs.reduce((total, song) => total + song.duration * song.playCount, 0);
    return Math.floor(seconds / 60);
  }, [songs]);

  const totalLibrarySeconds = useMemo(() => {
    return songs.reduce((total, song) => total + Math.max(0, Number(song.duration) || 0), 0);
  }, [songs]);

  const averageSongSeconds = useMemo(() => {
    if (!songs.length) return 0;
    return Math.round(totalLibrarySeconds / songs.length);
  }, [songs.length, totalLibrarySeconds]);

  const activeSongs = useMemo(() => songs.filter((song) => (song.playCount || 0) > 0), [songs]);
  const neverPlayedSongs = useMemo(() => songs.filter((song) => (song.playCount || 0) <= 0), [songs]);
  const likedPercent = songs.length ? Math.round((likedSongs.length / songs.length) * 100) : 0;
  const playedPercent = songs.length ? Math.round((activeSongs.length / songs.length) * 100) : 0;
  const averagePlaysPerSong = songs.length ? Math.round((totalPlays / songs.length) * 10) / 10 : 0;
  const listenedTimeLabel = totalMinutes >= 60 ? `${Math.round((totalMinutes / 60) * 10) / 10}h` : `${totalMinutes}m`;
  const libraryLengthLabel = formatTime(totalLibrarySeconds);

  const longestSong = useMemo(() => {
    return [...songs].sort((a, b) => (b.duration || 0) - (a.duration || 0))[0] ?? null;
  }, [songs]);

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

  const topArtists = useMemo(() => {
    const artistMap = new Map<string, { name: string; plays: number; songs: number }>();

    songs.forEach((song) => {
      const name = prettyMeta(song.artist);
      const current = artistMap.get(name) ?? { name, plays: 0, songs: 0 };
      current.plays += song.playCount || 0;
      current.songs += 1;
      artistMap.set(name, current);
    });

    return [...artistMap.values()].sort((a, b) => b.plays - a.plays || b.songs - a.songs).slice(0, 5);
  }, [songs]);

  const recentImportWeekCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return songs.filter((song) => {
      const addedAt = Date.parse(song.dateAdded || "");
      return Number.isFinite(addedAt) && addedAt >= cutoff;
    }).length;
  }, [songs]);

  const missingFileCount = useMemo(() => songs.filter((song) => song.fileExists === false).length, [songs]);
  const libraryHealthPercent = songs.length ? Math.max(0, Math.round(((songs.length - missingFileCount) / songs.length) * 100)) : 0;
  const libraryHealthLabel = !songs.length
    ? "empty"
    : missingFileCount > 0
      ? `${libraryHealthPercent}% ok`
      : "healthy";
  const analyticsStatCards = useMemo(() => ([
    { label: "total songs", value: songs.length.toLocaleString(), note: `${libraryArtistCount} artist${libraryArtistCount === 1 ? "" : "s"}` },
    { label: "total plays", value: totalPlays.toLocaleString(), note: `${averagePlaysPerSong} avg per song` },
    { label: "minutes listened", value: totalMinutes.toLocaleString(), note: listenedTimeLabel },
    { label: "most played song", value: mostPlayed ? prettyTitle(mostPlayed.title, 12) : "none yet", note: mostPlayed ? `${mostPlayed.playCount || 0} plays` : "play music first", wide: true },
    { label: "recent imports", value: recentImportWeekCount.toLocaleString(), note: "last 7 days" },
    { label: "library health", value: libraryHealthLabel, note: missingFileCount > 0 ? `${missingFileCount} missing file${missingFileCount === 1 ? "" : "s"}` : "all files look available" },
    { label: "liked percent", value: `${likedPercent}%`, note: `${likedSongs.length} liked` },
    { label: "played percent", value: `${playedPercent}%`, note: `${activeSongs.length} played` }
  ]), [
    songs.length,
    libraryArtistCount,
    totalPlays,
    averagePlaysPerSong,
    totalMinutes,
    listenedTimeLabel,
    mostPlayed,
    recentImportWeekCount,
    libraryHealthLabel,
    missingFileCount,
    likedPercent,
    likedSongs.length,
    playedPercent,
    activeSongs.length
  ]);

  useEffect(() => {
    if (!ready) return;

    const artistCount = new Set(
      songs.map((song) => String(song.artist || "").trim().toLowerCase()).filter(Boolean)
    ).size;
    const albumCount = new Set(
      songs.map((song) => String(song.album || "").trim().toLowerCase()).filter(Boolean)
    ).size;
    const playedSongCount = songs.filter((song) => (song.playCount || 0) > 0).length;

    const signature = [
      songs.length,
      likedSongs.length,
      playedSongCount,
      totalPlays,
      view,
      settings.theme,
      settings.customThemeEnabled,
      settings.discordEnabled
    ].join(":");

    if (librarySnapshotSignatureRef.current === signature) return;
    librarySnapshotSignatureRef.current = signature;

    trackLibrarySnapshot({
      song_count: songs.length,
      liked_count: likedSongs.length,
      played_song_count: playedSongCount,
      never_played_count: Math.max(0, songs.length - playedSongCount),
      total_plays: totalPlays,
      album_count: albumCount,
      artist_count: artistCount,
      current_view: view,
      theme_id: settings.theme,
      custom_theme_enabled: settings.customThemeEnabled,
      discord_enabled: settings.discordEnabled
    });
  }, [ready, songs, likedSongs.length, totalPlays, view, settings.theme, settings.customThemeEnabled, settings.discordEnabled]);

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
    const progressText = formatTime(safeTime);
    const durationText = formatTime(duration || 0);

    progressInputRefs.current.forEach((input) => {
      if (!input) return;
      input.style.setProperty("--range-progress", `${safeProgress}%`);
      if (forceInputValue || !isSeekingRef.current) {
        input.value = String(safeProgress);
      }
    });

    progressTimeLabelRefs.current.forEach((label) => {
      if (label) label.textContent = progressText;
    });

    progressDurationLabelRefs.current.forEach((label) => {
      if (label) label.textContent = durationText;
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
      least,
      most
    };
  }, [coverGalleryAssets, favoritePixelCoverKeys.length, excludedPixelCoverKeys.length]);

  // Kept intentionally disabled: this preview was calculated every render but is not currently rendered.
  // Re-enable it only when the queue preview UI actually uses this value.
  const queuePreviewSongs = useMemo(() => [] as Song[], []);
  void queuePreviewSongs;

  const headerHint = useMemo(() => {
    if (view === "home") {
      return "";
    }

    if (view === "library") return "";
    if (view === "playlists") return `${playlists.length} playlist${playlists.length === 1 ? "" : "s"}`;
    if (view === "liked") return `${likedSongs.length} liked track${likedSongs.length === 1 ? "" : "s"}`;
    if (view === "covers") return `${coverStats.usable} usable cover${coverStats.usable === 1 ? "" : "s"} • ${coverStats.favorites} favorite${coverStats.favorites === 1 ? "" : "s"}`;
    if (view === "downloads") return "download direct audio links and import them automatically";
    if (view === "settings") return "theme, playback, discord, library, and advanced controls";
    return "your listening numbers and favorite tracks";
  }, [view, isPlaying, currentSong, songs.length, filteredSongs.length, likedSongs.length, playlists.length, isThreeAm, coverStats.usable, coverStats.favorites]);

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
    let pointerFrame: number | null = null;
    const passiveOptions: AddEventListenerOptions = { passive: true };

    const clearIdleTimer = () => {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
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
      if (pointerFrame !== null) return;

      pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = null;
        markActive();
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearIdleTimer();
        markIdle();
        return;
      }

      markActive();
    };

    markActive();

    window.addEventListener("pointermove", scheduleActive, passiveOptions);
    window.addEventListener("pointerdown", scheduleActive, passiveOptions);
    window.addEventListener("wheel", scheduleActive, passiveOptions);
    window.addEventListener("keydown", scheduleActive);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearIdleTimer();

      if (pointerFrame !== null) {
        window.cancelAnimationFrame(pointerFrame);
      }

      window.removeEventListener("pointermove", scheduleActive, passiveOptions);
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

    const resetBeatVariables = () => {
      root.style.setProperty("--active-song-beat", "0");
      root.style.setProperty("--active-song-bass", "0");
      root.style.setProperty("--active-song-mid", "0");
      root.style.setProperty("--active-song-beat-x", "0px");
      root.style.setProperty("--active-song-beat-y", "0px");
      root.style.setProperty("--active-song-glow-opacity", "0.18");
      root.style.setProperty("--active-song-glow-scale", "1.03");
      root.style.setProperty("--active-song-art-scale", "1");
      root.style.setProperty("--active-song-ring-opacity", "0.18");
      root.style.setProperty("--active-song-pulse-speed", "1280ms");
    };

    if (beatFrameRef.current) {
      window.cancelAnimationFrame(beatFrameRef.current);
      beatFrameRef.current = null;
    }

    if (!ready || !isPlaying || !currentSong || !settings.animatedGlow || settings.reducedMotion || isViewSwitching || isSeeking || isVolumeDragging || isAppBackgrounded) {
      resetBeatVariables();
      return;
    }

    const averageRange = (data: Uint8Array<ArrayBuffer>, start: number, end: number) => {
      const safeStart = clamp(Math.floor(start), 0, Math.max(0, data.length - 1));
      const safeEnd = clamp(Math.floor(end), safeStart + 1, data.length);
      let total = 0;

      for (let index = safeStart; index < safeEnd; index += 1) {
        total += data[index] || 0;
      }

      return total / Math.max(1, safeEnd - safeStart) / 255;
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
        const context = beatAudioContextRef.current || new AudioContextCtor();
        beatAudioContextRef.current = context;

        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.78;

        const source = beatSourceRef.current || context.createMediaElementSource(audio);
        beatSourceRef.current = source;

        source.connect(analyser);
        analyser.connect(context.destination);

        beatAnalyserRef.current = analyser;
        beatDataRef.current = new Uint8Array(analyser.frequencyBinCount);

        return analyser;
      } catch {
        return null;
      }
    };

    const context = beatAudioContextRef.current;
    if (context?.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    let lastPaint = 0;

    const tick = (now: number) => {
      const busyAnimationBudget = scrollBusyRef.current || draggedSongIdRef.current || themeSettlingRef.current;
      const frameBudgetMs = busyAnimationBudget ? 150 : 72;

      if (document.hidden) {
        resetBeatVariables();
        lastPaint = now;
        beatFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

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

          bass = averageRange(data, 1, 12);
          mid = averageRange(data, 12, 42);
          energy = averageRange(data, 1, data.length);
        } else {
          const wave = (Math.sin(time * 6.4) + Math.sin(time * 12.8) * 0.35 + Math.sin(time * 3.2) * 0.2 + 1.55) / 3.1;
          bass = clamp(wave, 0, 1);
          mid = clamp((Math.sin(time * 4.7) + 1) / 2, 0, 1);
          energy = clamp((bass + mid) / 2, 0, 1);
        }

        const smooth = beatSmoothRef.current;
        smooth.bass += (bass - smooth.bass) * 0.26;
        smooth.mid += (mid - smooth.mid) * 0.2;
        smooth.energy += (energy - smooth.energy) * 0.18;
        smooth.phase += 0.035 + smooth.bass * 0.035;

        const beat = clamp((smooth.bass * 0.78 + smooth.energy * 0.34 + smooth.mid * 0.18) * safeVolume, 0.04, 1);
        const travel = 5 + beat * 20;
        const x = Math.sin(time * 2.15 + smooth.phase) * travel;
        const y = Math.cos(time * 2.75 + smooth.phase * 0.75) * (travel * 0.72);

        root.style.setProperty("--active-song-beat", beat.toFixed(3));
        root.style.setProperty("--active-song-bass", smooth.bass.toFixed(3));
        root.style.setProperty("--active-song-mid", smooth.mid.toFixed(3));
        root.style.setProperty("--active-song-beat-x", `${x.toFixed(2)}px`);
        root.style.setProperty("--active-song-beat-y", `${y.toFixed(2)}px`);
        root.style.setProperty("--active-song-glow-opacity", (0.18 + beat * 0.58).toFixed(3));
        root.style.setProperty("--active-song-glow-scale", (1.03 + beat * 0.16).toFixed(3));
        root.style.setProperty("--active-song-art-scale", (1 + beat * 0.032).toFixed(3));
        root.style.setProperty("--active-song-ring-opacity", (0.16 + beat * 0.42).toFixed(3));
        root.style.setProperty("--active-song-pulse-speed", `${Math.round(1200 - beat * 520)}ms`);

        lastPaint = now;
      }

      beatFrameRef.current = window.requestAnimationFrame(tick);
    };

    beatFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (beatFrameRef.current) {
        window.cancelAnimationFrame(beatFrameRef.current);
        beatFrameRef.current = null;
      }
    };
  }, [ready, isPlaying, currentSong?.id, settings.animatedGlow, settings.reducedMotion, settings.volume, isViewSwitching, isSeeking, isVolumeDragging, isAppBackgrounded]);

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
        setUpdatePrompt({
          visible: true,
          status: "latest",
          version: payload.currentVersion || "",
          percent: 100,
          message: payload.message || "localtify is up to date.",
          error: ""
        });
        showAppToast("localtify is up to date", "success");
        return;
      }

      if (payload.type === "dev") {
        if (payload.silent) return;
        setUpdatePrompt({
          visible: true,
          status: "dev",
          version: payload.currentVersion || "dev",
          percent: 0,
          message: payload.message || "Update checks work after installing the app.",
          error: ""
        });
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
    const persistentMode = mode === "stars" || mode === "night";

    const showMode = () => {
      setSecretMode(mode);
      setSecretToast(message);
      setSecretBurst((value) => value + 1);
    };

    if (secretTimeoutRef.current) {
      window.clearTimeout(secretTimeoutRef.current);
      secretTimeoutRef.current = null;
    }

    if (persistentMode && secretMode === mode) {
      setSecretMode("none");
      setSecretToast("");
      setSecretBurst((value) => value + 1);
      return;
    }

    if (mode === "arcadeGhost") {
      setArcadeGhostUnlocked(true);

      try {
        window.localStorage.setItem(ARCADE_GHOST_UNLOCKED_KEY, "true");
      } catch {
        // local storage can fail in locked-down environments; the theme still works for this session
      }

      setSettings((old) => {
        const next: Settings = { ...old, theme: "arcadeGhost", customThemeEnabled: false };
        window.localitfy.saveSettings(next).catch(() => undefined);
        return next;
      });
    }

    if (secretMode === mode && !persistentMode) {
      setSecretMode("none");
      window.setTimeout(showMode, 18);
    } else {
      showMode();
    }

    if (persistentMode) {
      secretTimeoutRef.current = window.setTimeout(() => {
        setSecretToast("");
        secretTimeoutRef.current = null;
      }, 2600);
      return;
    }

    const secretDuration =
      mode === "fast" ? 5200 :
      mode === "playBounce" ? 1500 :
      mode === "disco" ? 7600 :
      mode === "arcadeGhost" ? 6200 :
      5200;

    secretTimeoutRef.current = window.setTimeout(() => {
      setSecretMode("none");
      setSecretToast("");
      secretTimeoutRef.current = null;
    }, secretDuration);
  }, [secretMode]);

  function triggerPlayButtonSecret() {
    setPlayButtonBurst((value) => value + 1);
    triggerSecret("playBounce", "play button mega bounce");

    if (!playingRef.current) {
      showAppToast("play button bounce triggered", "info");
    }

    if (playButtonBurstTimerRef.current) {
      window.clearTimeout(playButtonBurstTimerRef.current);
    }

    playButtonBurstTimerRef.current = window.setTimeout(() => {
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
      try {
        window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      } catch {
        // ignore storage errors in dev preview
      }

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

    const compactSecretCommand = command.replace(/\s+/g, "");

    if (compactSecretCommand === "localtify" || compactSecretCommand === "localitfy") {
      triggerSecret("disco", "localtify stage mode unlocked");
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
      "/disco": { mode: "disco", message: "mini disco floor unlocked" },
      "disco": { mode: "disco", message: "mini disco floor unlocked" },
      "/stage": { mode: "disco", message: "stage lights online" },
      "stage": { mode: "disco", message: "stage lights online" },
      "/arcadeghost": { mode: "arcadeGhost", message: "secret theme unlocked: arcade ghost" },
      "/arcade ghost": { mode: "arcadeGhost", message: "secret theme unlocked: arcade ghost" },
      "arcade ghost": { mode: "arcadeGhost", message: "secret theme unlocked: arcade ghost" },
      "/stars": { mode: "stars", message: "star field enabled — type /stars again to hide" },
      "stars": { mode: "stars", message: "star field enabled — type /stars again to hide" },
      "/star": { mode: "stars", message: "star field enabled — type /stars again to hide" },
      "/rain": { mode: "rain", message: "soft rain ambience unlocked" },
      "rain": { mode: "rain", message: "soft rain ambience unlocked" },
      "/pulse": { mode: "pulse", message: "bass pulse unlocked" },
      "pulse": { mode: "pulse", message: "bass pulse unlocked" },
      "/vinyl": { mode: "vinyl", message: "vinyl room unlocked" },
      "vinyl": { mode: "vinyl", message: "vinyl room unlocked" },
      "/night": { mode: "night", message: "late night mode enabled" },
      "night": { mode: "night", message: "late night mode enabled" },
      "/fast": { mode: "fast", message: "speed mode enabled" },
      "fast": { mode: "fast", message: "speed mode enabled" },
      "/localtify": { mode: "disco", message: "localtify stage mode unlocked" },
      "/localitfy": { mode: "disco", message: "localtify stage mode unlocked" },
      "localtify secret": { mode: "disco", message: "localtify stage mode unlocked" },
      "localitfy secret": { mode: "disco", message: "localtify stage mode unlocked" },
      "localtify easter egg": { mode: "disco", message: "localtify stage mode unlocked" },
      "localitfy easter egg": { mode: "disco", message: "localtify stage mode unlocked" }
    };

    const secret = secretMap[command];
    if (secret) {
      triggerSecret(secret.mode, secret.message);
      setQuery("");
      return;
    }

    setQuery(value);
  };

  useEffect(() => {
    const konami = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
    const arrowRush = ["up", "down", "up", "down", "left", "right"];
    const arrowStage = ["left", "right", "left", "right"];

    const sequenceEndsWith = (sequence: string[], ending: string[]) => {
      if (sequence.length < ending.length) return false;
      return ending.every((value, index) => sequence[sequence.length - ending.length + index] === value);
    };

    const clearSecretTyping = () => {
      secretBufferRef.current = "";
    };

    const triggerTypedSecret = (compactBuffer: string) => {
      if (compactBuffer.endsWith("ilovesnakes") || compactBuffer.endsWith("snakegame")) {
        openSnakeGame();
        clearSecretTyping();
        return true;
      }

      if (
        compactBuffer.endsWith("localtify") ||
        compactBuffer.endsWith("localitfy") ||
        compactBuffer.endsWith("localtifystage") ||
        compactBuffer.endsWith("localitfystage")
      ) {
        triggerSecret("disco", "localtify stage mode unlocked");
        clearSecretTyping();
        return true;
      }

      if (compactBuffer.endsWith("stars") || compactBuffer.endsWith("starfield")) {
        triggerSecret("stars", "star field enabled");
        clearSecretTyping();
        return true;
      }

      if (compactBuffer.endsWith("night") || compactBuffer.endsWith("latenight")) {
        triggerSecret("night", "late night mode enabled");
        clearSecretTyping();
        return true;
      }

      if (compactBuffer.endsWith("fast") || compactBuffer.endsWith("speed")) {
        triggerSecret("fast", "speed mode enabled");
        clearSecretTyping();
        return true;
      }


      if (compactBuffer.endsWith("ppp")) {
        triggerPlayButtonSecret();
        clearSecretTyping();
        return true;
      }

      return false;
    };

    const shouldIgnoreSecretTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      const tag = element?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || Boolean(element?.isContentEditable);
    };

    const getSecretKey = (event: KeyboardEvent) => {
      if (event.code === "ArrowUp") return { arrow: "up", typed: "" };
      if (event.code === "ArrowDown") return { arrow: "down", typed: "" };
      if (event.code === "ArrowLeft") return { arrow: "left", typed: "" };
      if (event.code === "ArrowRight") return { arrow: "right", typed: "" };

      if (event.code === "KeyA") return { arrow: "a", typed: "a" };
      if (event.code === "KeyB") return { arrow: "b", typed: "b" };

      const typed = event.key.length === 1 ? event.key.toLowerCase() : "";
      if (/^[a-z0-9]$/.test(typed)) return { arrow: "", typed };
      return { arrow: "", typed: "" };
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || shouldIgnoreSecretTarget(event.target)) return;

      const { arrow, typed } = getSecretKey(event);

      if (arrow) {
        konamiBufferRef.current = [...konamiBufferRef.current, arrow].slice(-konami.length);

        if (konamiBufferRef.current.join("|") === konami.join("|")) {
          event.preventDefault();
          triggerSecret("arcadeGhost", "secret theme unlocked: arcade ghost");
          konamiBufferRef.current = [];
          clearSecretTyping();
          return;
        }

        if (sequenceEndsWith(konamiBufferRef.current, arrowRush)) {
          event.preventDefault();
          triggerSecret("fast", "arrow speed mode enabled");
          konamiBufferRef.current = [];
          clearSecretTyping();
          return;
        }

        if (sequenceEndsWith(konamiBufferRef.current, arrowStage)) {
          event.preventDefault();
          triggerSecret("disco", "arrow stage lights online");
          konamiBufferRef.current = [];
          clearSecretTyping();
          return;
        }
      }

      if (!typed) return;

      secretBufferRef.current = `${secretBufferRef.current}${typed}`.slice(-72);
      if (triggerTypedSecret(secretBufferRef.current.replace(/[^a-z0-9]/g, ""))) {
        event.preventDefault();
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
      const remaining = Math.max(0, BOOT_MIN_VISIBLE_MS - (now - bootStartedAt));
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
    }, 360);

    window.localitfy.bootstrap().then(async (payload) => {
      if (!mounted) return;

      setBootStep(0, "loading settings and theme...");

      const storedSettings = (payload.settings || {}) as Partial<Settings>;
      const shouldApplyV013Defaults = window.localStorage.getItem(V013_DEFAULTS_KEY) !== "true";
      const shouldApplyStartWithWindowsDefault = typeof storedSettings.startWithWindows === "undefined";
      const nextSettings: Settings = {
        ...defaultSettings,
        ...storedSettings,
        ...(shouldApplyV013Defaults ? V013_RELEASE_DEFAULTS : {})
      };

      if (shouldApplyStartWithWindowsDefault) {
        nextSettings.startWithWindows = true;
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

      const shouldPersistBootSettings =
        shouldApplyV013Defaults ||
        shouldApplyStartWithWindowsDefault ||
        shouldRepairAnimatedVisualSettings ||
        shouldRepairBootTheme ||
        typeof storedSettings.startWithWindows === "undefined";

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

      setBootStep(3, "preparing covers and ambience...");
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

  useEffect(() => {
    if (!ready || !isThreeAm) return;

    const message = settings.volume > 0.8 ? "why are we still awake? volume is high too" : "why are we still awake?";
    triggerSecret("rain", message);
  }, [ready, isThreeAm, settings.volume, triggerSecret]);

  useEffect(() => {
    if (misideTimerRef.current) {
      window.clearTimeout(misideTimerRef.current);
      misideTimerRef.current = null;
    }

    if (!currentSong || !isMisideSong) {
      setMisideModeActive(false);
      setSecretToast("");
      return;
    }

    setMisideModeActive(true);
    setSecretToast("mita is listening...");
    setSecretBurst((value) => value + 1);

    return () => {
      if (misideTimerRef.current) {
        window.clearTimeout(misideTimerRef.current);
        misideTimerRef.current = null;
      }
    };
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, currentSong?.album, currentSong?.filePath, isMisideSong]);

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
    void updateSetting("volume", nextVolume, true);
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
        void updateSetting("volume", clamp(Number(command.value) || 0, 0, 1), true);
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
      const artwork = currentSong?.coverUrl
        ? ([96, 128, 192, 256, 512].map((size) => ({
            src: currentSong.coverUrl || "",
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
    window.localitfy.setStartWithWindows?.(settings.startWithWindows).catch(() => undefined);
  }, [settings.startWithWindows]);

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
      startWithWindows: settings.startWithWindows
    }).catch(() => undefined);
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, currentSong?.album, currentSong?.coverUrl, isPlaying, settings.volume, settings.minimizeToTray, settings.startWithWindows]);

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
        updateSetting("volume", settings.volume > 0 ? 0 : 0.75, true).catch(() => undefined);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.volume, currentSong?.id, currentId, isPlaying, songs.length]);

  useEffect(() => {
    return () => {
      stopFade();
      stopProgressLoop();

      if (saveSettingsTimerRef.current !== null) {
        window.clearTimeout(saveSettingsTimerRef.current);
      }

      if (sleepTimerRef.current !== null) {
        window.clearTimeout(sleepTimerRef.current);
      }

      nextAudioRef.current?.pause();
      nextAudioRef.current = null;

      window.localitfy.clearDiscordActivity().catch(() => undefined);
    };
  }, []);

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

      audio.muted = false;
      audio.volume = safeVolume;
      audio.playbackRate = clamp(Number(settings.playbackSpeed) || 1, 0.5, 2);
      audio.preload = settings.gaplessPlayback ? "auto" : "metadata";
      volumeRef.current = safeVolume;
      return safeVolume;
    },
    [getTargetAudioVolume, settings.playbackSpeed, settings.gaplessPlayback]
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

    const tick = (clock: number) => {
      const audio = audioRef.current;

      const backgroundMode = isAppBackgroundedRef.current;

      if (audio && !audio.paused) {
        const nextTime = audio.currentTime || 0;
        const nextDuration = Number.isFinite(audio.duration) ? audio.duration : currentDuration;

        timeRef.current = nextTime;
        if (Number.isFinite(nextDuration) && nextDuration > 0) durationRef.current = nextDuration;

        const busyUi = scrollBusyRef.current || draggedSongIdRef.current || themeSettlingRef.current;
        const uiPaintEveryMs = backgroundMode ? 3000 : busyUi ? 240 : 90;
        if (!backgroundMode && !isSeekingRef.current && clock - lastProgressUiPaintRef.current > uiPaintEveryMs) {
          lastProgressUiPaintRef.current = clock;
          syncProgressDom(nextTime, nextDuration);
        }

        // Do not push every progress tick through React state.
        // timeRef + direct DOM painting keep the player smooth while the huge app tree stays asleep.
        if (!isSeekingRef.current && clock - lastProgressStatePaintRef.current > 8000) {
          lastProgressStatePaintRef.current = clock;
        }

        if (!backgroundMode && Number.isFinite(nextDuration) && nextDuration > 0 && Math.abs(nextDuration - lastPaintedDuration) > 0.5) {
          lastPaintedDuration = nextDuration;
          setCurrentDuration(nextDuration);
          syncProgressDom(nextTime, nextDuration, true);
        }

        if (settings.rememberPlaybackPosition && currentSong?.id && Date.now() - positionSaveRef.current > 12000) {
          positionSaveRef.current = Date.now();
          void patchSongLocal(currentSong.id, { playbackPosition: Math.floor(nextTime) });
        }

        if (!backgroundMode && settings.gaplessPlayback && nextDuration > 0 && nextDuration - nextTime < 20) {
          primeNextAudioCache();
        }
      }

      if (backgroundMode) {
        progressLoopTimeoutRef.current = window.setTimeout(() => {
          progressLoopTimeoutRef.current = null;
          animationFrameRef.current = window.requestAnimationFrame(tick);
        }, 1000);
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => stopProgressLoop();
  }, [isPlaying, currentSong?.id, currentDuration, settings.rememberPlaybackPosition, settings.gaplessPlayback, syncProgressDom]);

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

      window.localitfy
        .updateDiscordActivity({
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
    const audio = audioRef.current;
    if (!audio) return;

    stopFade();

    applyAudioQualitySettings(audio, currentSong);

    if (!currentSong) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      setCurrentTime(0);
      setCurrentDuration(0);
      setIsPlaying(false);
      setPlayerError("");
      return;
    }

    if (!currentSong.url || currentSong.fileExists === false) {
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

    if (audio.src !== currentSong.url) {
      audio.pause();
      audio.src = currentSong.url;
      audio.load();

      const savedPosition = settings.rememberPlaybackPosition
        ? Math.max(0, Math.min(Number(currentSong.playbackPosition || 0), Math.max(0, (currentSong.duration || 0) - 8)))
        : 0;

      if (savedPosition > 3) {
        audio.currentTime = savedPosition;
      }

      setCurrentTime(savedPosition);
      setCurrentDuration(currentSong.duration || 0);
      setPlayerError("");
      setStatusText(`loaded ${prettyTitle(currentSong.title, 5)}`);
      primeNextAudioCache();
    }
  }, [currentSong?.id, currentSong?.url, currentSong?.fileExists, currentSong?.volumeGain, currentSong?.customVolume, settings.rememberPlaybackPosition, applyAudioQualitySettings]);

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
    if (!nextSong?.url) return;

    if (!nextAudioRef.current) {
      nextAudioRef.current = new Audio();
      nextAudioRef.current.preload = "auto";
    }

    if (nextAudioRef.current.src !== nextSong.url) {
      nextAudioRef.current.src = nextSong.url;
      nextAudioRef.current.load();
    }
  }

  function stopFade() {
    if (fadeIntervalRef.current !== null) {
      window.clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
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

    const startVolume = audio.volume;
    const delta = target - startVolume;
    const startTime = performance.now();

    fadeIntervalRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progressValue = Math.min(1, elapsed / duration);

      audio.volume = clamp(startVolume + delta * progressValue, 0, 1);

      if (progressValue >= 1) {
        stopFade();
        if (onDone) onDone();
      }
    }, 16);
  }

  function getAudioErrorText(audio: HTMLAudioElement | null) {
    const code = audio?.error?.code;

    if (code === 1) return "audio loading was cancelled";
    if (code === 2) return "file loading failed. check if the audio still exists";
    if (code === 3) return "audio file could not decode. it may be corrupted";
    if (code === 4) return "audio format unsupported or file path missing";

    return "audio could not start. try reimporting the file.";
  }

  async function startAudioPlayback(reason = "manual") {
    const audio = audioRef.current;
    const song = songRef.current || currentSong;

    if (!audio || !song) {
      setIsPlaying(false);
      return false;
    }

    if (!song.url || song.fileExists === false) {
      pendingPlayRef.current = false;
      resetPlayCountTracker();

      setIsPlaying(false);
      setPlayerError("this audio file is missing. reimport it on this pc.");
      setStatusText("file missing");
      return false;
    }

    try {
      stopFade();

      const safeVolume = getTargetAudioVolume(song);

      audio.muted = false;
      audio.volume = settings.reducedMotion || !settings.crossfadeEnabled ? safeVolume : 0;
      audio.playbackRate = clamp(Number(settings.playbackSpeed) || 1, 0.5, 2);
      audio.preload = settings.gaplessPlayback ? "auto" : "metadata";
      volumeRef.current = safeVolume;

      if (audio.src !== song.url) {
        audio.src = song.url;
        audio.load();
      }

      pendingPlayRef.current = true;

      await audio.play();

      pendingPlayRef.current = false;

      if (!settings.reducedMotion && settings.crossfadeEnabled && safeVolume > 0) {
        fadeAudio(safeVolume, Math.max(120, Number(settings.crossfadeSeconds || 1.6) * 1000));
      } else {
        audio.volume = safeVolume;
      }

      primeNextAudioCache();

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

    pendingPlayRef.current = false;

    if (!audio) {
      setIsPlaying(false);
      setStatusText("paused");
      return;
    }

    if (!audio.paused) {
      if (settings.reducedMotion) {
        audio.pause();
        applyAudioQualitySettings(audio, currentSong);
      } else {
        fadeAudio(0, 120, () => {
          audio.pause();
          applyAudioQualitySettings(audio, currentSong);
        });
      }
    } else {
      applyAudioQualitySettings(audio, currentSong);
    }

    setStatusText("paused");
  }

  async function persistSettings(next: Settings, debounce = false) {
    const shouldTrackThemeChange =
      bootedRef.current &&
      (settings.theme !== next.theme || settings.customThemeEnabled !== next.customThemeEnabled);
    const shouldTrackDiscordToggle = bootedRef.current && settings.discordEnabled !== next.discordEnabled;

    setSettings(next);

    if (!bootedRef.current) return;

    const trackSettingsAnalytics = () => {
      if (shouldTrackThemeChange) {
        trackThemeChanged(next.customThemeEnabled ? "custom" : next.theme, next.customThemeEnabled);
      }

      if (shouldTrackDiscordToggle) {
        trackDiscordToggled(next.discordEnabled);
      }
    };

    if (debounce) {
      if (saveSettingsTimerRef.current !== null) {
        window.clearTimeout(saveSettingsTimerRef.current);
      }

      saveSettingsTimerRef.current = window.setTimeout(() => {
        window.localitfy.saveSettings(next).catch(() => undefined);
      }, 240);

      trackSettingsAnalytics();
      return;
    }

    await window.localitfy.saveSettings(next);
    trackSettingsAnalytics();
  }

  async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K], debounce = false) {
    const next: Settings = {
      ...settings,
      [key]: value
    };

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

    if (key === "animatedBackgrounds" || key === "animeVisuals") {
      next.animatedBackgrounds = true;
      next.animeVisuals = true;
    }

    if (key === "simpleMode") {
      // Simple Mode was removed in v0.2.8. Do not let old UI/state re-enable it.
      next.simpleMode = false;
    }

    await persistSettings(next, debounce);

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
    const next: Settings = {
      ...settings,
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

    await persistSettings(next, debounce);
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
      animeVisuals: true,
      animatedBackgrounds: true,
      gifVisualsMode: defaultSettings.gifVisualsMode,
      animatedGlow: defaultSettings.animatedGlow,
      softCorners: defaultSettings.softCorners,
      reducedMotion: defaultSettings.reducedMotion
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
    setSongs((oldSongs) => oldSongs.map((song) => (song.id === id ? { ...song, ...patch } : song)));

    try {
      const updated = await window.localitfy.patchSong(id, patch);
      replaceSong(updated);
    } catch {
      // optimistic update stays
    }
  }


  async function cleanLibraryMetadataAction() {
    if (!songs.length || libraryScanBusy) return;

    setLibraryScanBusy(true);
    setPlayerError("");
    setStatusText("cleaning metadata...");
    showAppToast("cleaning metadata...", "work");
    setLibraryScanMessage("checking titles, artists, albums, durations, and play counts...");

    try {
      const repairs = songs
        .map((song) => ({ song, patch: getMetadataRepairPatch(song) }))
        .filter((item) => Object.keys(item.patch).length > 0);

      if (!repairs.length) {
        setLibraryScanMessage(`library clean • ${songs.length} indexed`);
        setStatusText("metadata already looks clean");
        showAppToast("metadata already looks clean", "success");
        return;
      }

      for (let index = 0; index < repairs.length; index += 1) {
        const { song, patch } = repairs[index];
        await patchSongLocal(song.id, patch);

        if (index % 8 === 0) {
          setLibraryScanMessage(`cleaned ${index + 1}/${repairs.length} tracks...`);
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }
      }

      setLibraryScanMessage(`cleaned ${repairs.length} tracks • search rebuilt`);
      setStatusText(`cleaned ${repairs.length} metadata fix${repairs.length === 1 ? "" : "es"}`);
      showAppToast(`cleaned ${repairs.length} metadata fix${repairs.length === 1 ? "" : "es"}`, "success");
    } catch (error) {
      console.error("[localitfy metadata cleaner error]", error);
      setPlayerError("metadata cleaner failed. your library was not deleted.");
      setStatusText("metadata cleaner failed");
      setLibraryScanMessage("cleaner failed safely");
      showAppToast("metadata cleaner failed safely", "error");
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

  function shuffleLibrarySongsAction() {
    if (songs.length < 2) {
      setStatusText("add more songs before shuffling");
      showAppToast("add more songs before shuffling", "info");
      return;
    }

    setSongs((previousSongs) => {
      if (previousSongs.length < 2) return previousSongs;

      const nextSongs = [...previousSongs];
      for (let index = nextSongs.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [nextSongs[index], nextSongs[swapIndex]] = [nextSongs[swapIndex], nextSongs[index]];
      }

      saveLibraryOrder(nextSongs);
      return nextSongs;
    });

    setLibraryScanMessage(`shuffled ${songs.length} songs`);
    setStatusText("library order shuffled");
    showAppToast("library order shuffled", "success");
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
      status: "queued",
      progress: 0,
      message: "Queued..."
    }));
  }

  function syncDownloadFilesToQueue(results: DownloadResult[]) {
    if (!results.length) return;
    setDownloadQueue((current) => {
      const next = [...current];
      results.forEach((result) => {
        const index = next.findIndex((item) => item.url === result.url);
        if (index === -1) return;
        next[index] = {
          ...next[index],
          status: result.ok ? "done" : "failed",
          progress: 100,
          message: result.ok ? "Added to library" : "Download failed — retry?",
          filePath: result.filePath,
          filename: result.filename,
          error: result.error,
          title: result.filename || next[index].title
        };
      });
      return next;
    });
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

  async function retryDownload(url: string) {
    if (!url) return;
    setDownloadText(url);
    await downloadAudioLinks(url);
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

      const nextSongs = applyLibraryOrder(sanitizeSongList(result.songs || []));
      const downloads = result.downloads || [];

      setDownloadResults(downloads);
      syncDownloadFilesToQueue(downloads);
      setDownloadFolderLabel(result.downloadFolder || settings.downloadFolder || "");
      setSongs(nextSongs);
      setLibraryScanMessage(`indexed ${nextSongs.length} tracks instantly`);

      const successCount = downloads.filter((item) => item.ok).length;
      const failCount = downloads.filter((item) => !item.ok).length;

      if (nextSongs.length && !currentId) {
        const firstSong = nextSongs[0];
        if (firstSong) {
          setCurrentId(firstSong.id);
          await rememberCurrentSong(firstSong.id);
        }
      }

      if (successCount > 0) {
        trackSongsImported(result.changedCount || successCount, "downloads");
        setStatusText(
          settings.downloadAutoAdd
            ? `downloaded ${successCount} and added ${result.changedCount || 0} to library`
            : `downloaded ${successCount} file${successCount === 1 ? "" : "s"}`
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
      setPlayerError("download failed. check the terminal for details.");
      setStatusText("download failed");
    } finally {
      setDownloadBusy(false);
    }
  }

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
    const menuHeight = 232;
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
        const pull = 10 + distanceFromCenter * 16 + edgePull * 32;

        return { side, pull };
      };

      const directElement = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const directCard = directElement?.closest<HTMLElement>("[data-library-song-id]");
      const directSongId = directCard?.dataset.librarySongId || "";

      if (directCard && directSongId && directSongId !== sourceSongId) {
        const rect = directCard.getBoundingClientRect();
        const { side, pull } = getSideAndPull(rect);
        return { songId: directSongId, side, pull };
      }

      let closest: (LibraryDropTarget & { distance: number }) | null = null;

      for (const [songId, element] of librarySongElementRefs.current.entries()) {
        if (songId === sourceSongId) continue;

        const rect = element.getBoundingClientRect();
        const expandedLeft = rect.left - 58;
        const expandedRight = rect.right + 58;
        const expandedTop = rect.top - 42;
        const expandedBottom = rect.bottom + 42;

        if (clientX < expandedLeft || clientX > expandedRight || clientY < expandedTop || clientY > expandedBottom) {
          continue;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(clientX - centerX, clientY - centerY);
        const { side, pull } = getSideAndPull(rect);

        if (!closest || distance < closest.distance) {
          closest = { songId, side, pull, distance };
        }
      }

      return closest ? { songId: closest.songId, side: closest.side, pull: closest.pull } : null;
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
    const ordered = shuffled ? [...playable].sort(() => Math.random() - 0.5) : playable;
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

    if (!targetSong.url || targetSong.fileExists === false) {
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
      audio.currentTime = 0;
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
      setIsPlaying(false);
      return;
    }

    if (!currentSong.url || currentSong.fileExists === false) {
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
    if (!playableSongs.length) return;

    if (trigger === "auto" && repeatMode === "one" && currentSong) {
      const audio = audioRef.current;

      if (audio) {
        try {
          audio.currentTime = 0;
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
          const otherPlaylistSongs = activePlaylistSongs.filter((song) => song.id !== currentSong.id);
          const randomPlaylistSong = otherPlaylistSongs[Math.floor(Math.random() * otherPlaylistSongs.length)];
          if (randomPlaylistSong) void selectSong(randomPlaylistSong.id, forcePlay, { playlistId: activePlaylist.id });
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
      const otherSongs = playableSongs.filter((song) => song.id !== currentId);
      const randomSong = otherSongs[Math.floor(Math.random() * otherSongs.length)];
      if (randomSong) void selectSong(randomSong.id, forcePlay);
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
    if (!playableSongs.length) return;

    const audio = audioRef.current;

    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
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
    audio.currentTime = nextTime;
    timeRef.current = nextTime;
    lastProgressUiPaintRef.current = 0;
    lastProgressStatePaintRef.current = 0;
    syncProgressDom(nextTime, duration, true);
    setCurrentTime(nextTime);

    if (settings.rememberPlaybackPosition && currentSong?.id) {
      void patchSongLocal(currentSong.id, { playbackPosition: Math.floor(nextTime) });
    }
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

  function previewVolume(value: string | number, input?: HTMLInputElement | null) {
    const safePercent = clamp(Number(value), 0, 100);
    volumeDraftRef.current = safePercent;
    setVolumeDraft(safePercent);
    paintRangeProgress(input, safePercent);
    input?.style.setProperty("--volume-percent", `${safePercent}%`);
    if (audioRef.current) {
      audioRef.current.volume = safePercent / 100;
    }
  }

  function commitVolume(value?: string | number) {
    const safePercent = clamp(Number(value ?? volumeDraftRef.current), 0, 100);
    volumeDraftRef.current = safePercent;
    setVolumeDraft(safePercent);
    updateSetting("volume", safePercent / 100, true);
    setIsVolumeDragging(false);
  }

  function toggleLike(songId: string) {
    const target = songs.find((song) => song.id === songId);
    if (!target) return;

    void patchSongLocal(songId, {
      liked: !target.liked
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
            {song ? <Cover song={song} className="playlistCoverImage" /> : <span>♪</span>}
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
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
    } catch {
      // ignore storage errors so onboarding never blocks the player
    }

    setOnboardingDevPreview(false);
    setOnboardingOpen(false);
  }

  function skipOnboarding() {
    trackOnboardingSkipped(undefined, songs.length);
    dismissOnboarding();
  }

  async function handleOnboardingImportMusic() {
    setStatusText("choose local audio to import");

    try {
      await importSongs();
    } finally {
      dismissOnboarding();
    }
  }

  function handleOnboardingDownloads() {
    dismissOnboarding();
    changeView("downloads", "onboarding");
    setStatusText("downloads panel ready");
    showAppToast("downloads are ready when you need them", "info");
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

  if (!ready) {
    const isBootError = Boolean(bootError);
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

  const repeatButtonStateText = repeatMode === "one" ? "1" : repeatMode === "all" ? "all" : "";
  const repeatButtonTitle = repeatMode === "one" ? "Loop current song is on" : repeatMode === "all" ? "Loop library is on" : "Loop is off";
  const repeatButtonAriaLabel = repeatButtonTitle;

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
        <div className="simpleHeroArtSwap" key={`simple-art-${nowPlayingTransitionKey}`}>
          <Cover song={currentSong} className="simpleHeroArt" />
        </div>

        <div className="simpleHeroText nowPlayingCopySwap" key={`simple-copy-${nowPlayingTransitionKey}`}>
          <small title={currentNowPlayingLabel}>{currentNowPlayingLabel}</small>
          <h2>{currentSong ? prettyTitle(currentSong.title, 7) : "nothing playing"}</h2>
          <p>{currentSong ? prettyMeta(currentSong.artist) : "import a song to begin"}</p>

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
              placeholder="search songs... try /stars, /localtify"
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

  function renderSettingsCategoryContent() {
    return (
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
        handleCustomThemeNativeColor={handleCustomThemeNativeColor}
        handleCustomThemeHexDraftChange={handleCustomThemeHexDraftChange}
        commitCustomThemeHexDraft={commitCustomThemeHexDraft}
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
    );
  }


  return (
    <main
      ref={appRootRef}
      className={`app ${settings.animatedGlow ? "animatedGlow" : ""} ${
        settings.compactPlayer ? "compactPlayer" : ""
      } ${settings.denseList ? "denseList" : ""} ${themeMotionReady ? "themeMotionReady" : "themeMotionBooting"} animatedBackgrounds ${settings.reducedMotion ? "reducedMotion" : ""} ${updatePrompt.visible ? "updateRibbonVisible" : ""} ${isViewSwitching ? "viewSwitching" : ""} ${isSeeking || isVolumeDragging ? "playerScrubbing" : ""} ${isAppBackgrounded ? "appBackgrounded" : ""} ${scrollBusyRef.current ? "isScrolling" : ""} ${themeSettling ? "themeSettling" : ""} ${draggedSongId ? "songDragActive" : ""} ${isThreeAm ? "lateNightMode" : ""} ${misideModeActive ? "misideMode" : ""} ${
        secretMode !== "none" ? `secretActive secret-${secretMode}` : ""
      }`}
      style={
        {
          "--player-size": `${clamp(Number(settings.playerSize || 108), 74, 168)}px`,
          "--sidebar-width": `${clamp(Number(settings.sidebarWidth || 249), 184, 340)}px`,
          ...themePresetStyle,
          ...animatedThemeVisualStyle,
          ...customThemeStyle
        } as CSSProperties
      }
      data-theme={effectiveTheme}
      data-anime-visuals={settings.animeVisuals || screensaverPreviewActive || screensaverVisible ? "on" : "off"}
      data-gif-visuals={settings.gifVisualsMode}
      data-custom-theme={settings.customThemeEnabled ? "true" : "false"}
      data-corners={settings.softCorners ? "soft" : "sharp"}
      data-ambient={effectiveAmbient ? "on" : "off"}
      data-cover-sync={effectiveCoverColorSyncMode}
      data-notes={effectiveNotes ? "on" : "off"}
      data-badge={settings.showHeroBadge ? "on" : "off"}
      data-home-expanded={settings.homeExpanded ? "on" : "off"}
      data-hero-expanded={settings.heroExpanded ? "on" : "off"}
      data-status={statusText}
      data-app-version={APP_VERSION}
      data-secret-mode={secretMode}
      data-late-night={isThreeAm ? "on" : "off"}
      data-playing={isPlaying ? "on" : "off"}
      data-motion-level={settings.reducedMotion ? "reduced" : "smooth"}
      data-drag-title={draggedSongTitle}
    >
      <TitleBar />

      <AnimatePresence initial={false}>
        {updatePrompt.visible ? (
          <Motion.div
            key={`update-ribbon-${updatePrompt.status}-${updatePrompt.version || APP_VERSION}`}
            className="updateToastLayer topUpdateRibbonLayer"
            role="presentation"
            initial={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -18 }}
            animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
            transition={settings.reducedMotion ? { duration: 0.12 } : updateRibbonEnterSpring}
          >
            <Motion.section
              className={`updateToastCard topUpdateRibbon ${updatePrompt.status} ${updatePrompt.nagStage ? `updateNagStage-${updatePrompt.nagStage}` : ""}`}
              onClick={(event) => event.stopPropagation()}
              role="status"
              aria-live="polite"
              aria-label="localtify update"
              initial={settings.reducedMotion ? false : { opacity: 0, y: -8, scale: 0.992 }}
              animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.995 }}
              transition={settings.reducedMotion ? { duration: 0.12 } : updateRibbonEnterSpring}
            >
              <Motion.div
                className="topUpdateRibbonMain"
                initial={settings.reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={settings.reducedMotion ? { duration: 0.1 } : { ...updateRibbonChildSpring, delay: 0.04 }}
              >
                <div className="updateToastIcon topUpdateRibbonIcon" aria-hidden="true">
                  {updatePrompt.status === "downloaded" ? "✓" : updatePrompt.status === "downloading" ? "↓" : updatePrompt.status === "error" ? "!" : "↧"}
                </div>

                <div className="updateToastText topUpdateRibbonText">
                  <p className="eyebrow">localtify update</p>
                  <h3>{updateRibbonTitle(updatePrompt)}</h3>
                </div>
              </Motion.div>

              <Motion.div
                className="topUpdateRibbonRight"
                initial={settings.reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={settings.reducedMotion ? { duration: 0.1 } : { ...updateRibbonChildSpring, delay: 0.12 }}
              >
                <Motion.div
                  className="updateToastMetaRow topUpdateRibbonMeta"
                  aria-label="update info"
                  initial={settings.reducedMotion ? false : { opacity: 0, x: 6 }}
                  animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, x: 4 }}
                  transition={settings.reducedMotion ? { duration: 0.1 } : { ...updateRibbonChildSpring, delay: 0.14 }}
                >
                  <span className="updateVersionPill">version {updatePrompt.version || APP_VERSION}</span>
                  {updatePrompt.status === "available" || updatePrompt.status === "downloaded" || updatePrompt.status === "dev" ? (
                    <span className={`updateSafePill ${updatePrompt.libraryBackedUp ? "ok" : "pending"}`}>
                      {updatePrompt.status === "dev" ? "dev mode" : updatePrompt.libraryBackedUp ? "library safe" : "app status"}
                    </span>
                  ) : null}
                </Motion.div>

                <Motion.div
                  className="updateToastActions topUpdateRibbonActions"
                  initial={settings.reducedMotion ? false : { opacity: 0, x: 8 }}
                  animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, x: 5 }}
                  transition={settings.reducedMotion ? { duration: 0.1 } : { ...updateRibbonChildSpring, delay: 0.18 }}
                >
                  {updatePrompt.status === "available" ? (
                    <>
                      <button className="updateGhostButton" type="button" onClick={openUpdateChangelog}>
                        view release
                      </button>
                      <button className="updateGhostButton" type="button" onClick={skipAvailableUpdate}>
                        skip
                      </button>
                      <button className="updatePrimaryButton" type="button" onClick={askUpdaterToDownload}>
                        download
                      </button>
                    </>
                  ) : null}

                  {updatePrompt.status === "downloaded" ? (
                    <>
                      <button className="updateGhostButton" type="button" onClick={openUpdateChangelog}>
                        view release
                      </button>
                      <button className="updatePrimaryButton" type="button" onClick={askUpdaterToInstall}>
                        restart
                      </button>
                    </>
                  ) : null}

                  {updatePrompt.status === "error" || updatePrompt.status === "latest" || updatePrompt.status === "dev" ? (
                    <button className="updatePrimaryButton" type="button" onClick={manualUpdateCheck}>
                      check again
                    </button>
                  ) : null}

                  {updatePrompt.status !== "downloading" ? (
                    <button className="updateToastClose" type="button" onClick={() => setUpdatePrompt(defaultUpdatePrompt)} aria-label="Dismiss update notice">
                      ×
                    </button>
                  ) : null}
                </Motion.div>
              </Motion.div>

              {updatePrompt.status === "downloading" ? (
                <Motion.div
                  className="updateProgressTrack topUpdateRibbonProgress"
                  aria-label="update progress"
                  initial={settings.reducedMotion ? false : { opacity: 0, scaleX: 0.94 }}
                  animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, scaleX: 1 }}
                  exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, scaleX: 0.96 }}
                  transition={settings.reducedMotion ? { duration: 0.1 } : { ...updateRibbonChildSpring, delay: 0.2 }}
                >
                  <span style={{ width: `${clamp(updatePrompt.percent, 0, 100)}%` }} />
                </Motion.div>
              ) : null}
            </Motion.section>
          </Motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {screensaverVisible ? (
          <Motion.div
            className="screensaverOverlay"
            role="presentation"
            onPointerMove={dismissScreensaverFromActivity}
            onClick={() => setScreensaverVisible(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: settings.reducedMotion ? 0.12 : 0.45, ease: "easeOut" }}
          >
            <div className="screensaverBackdrop" style={{ backgroundImage: `url(${screensaverVisualSource})` }} />
            <div className="screensaverGlow" />
            <Motion.div
              className="screensaverPanel"
              initial={settings.reducedMotion ? false : { opacity: 0, y: 18, scale: 0.982 }}
              animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.99 }}
              transition={settings.reducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 130, damping: 20, mass: 0.8 }}
              style={{ backgroundImage: `url(${screensaverVisualSource})` }}
            >
              <div className="screensaverShade" />
              <div className="screensaverIdleText">am waiting..</div>
            </Motion.div>
          </Motion.div>
        ) : null}
      </AnimatePresence>

      {secretMode !== "none" ? (
        <div className={`secretLayer ${secretMode}`} key={`${secretMode}-${secretBurst}`} aria-hidden="true">
          {secretToast ? <div className="secretRibbon">{secretToast}</div> : null}
          {secretMode === "stars"
            ? starParticleStyles.map((style, index) => (
                <span
                  key={`star-${index}`}
                  className={index % 5 === 0 ? "secretParticle starParticle starParticleLarge" : "secretParticle starParticle"}
                  style={style}
                />
              ))
            : null}
        </div>
      ) : null}



      {isThreeAm && effectiveNotes ? (
        <div className="lateNightNoteLayer" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}

      {appToast ? (
        <div className={`appToast ${appToast.kind}`} key={appToast.id} role="status">
          <span className="appToastDot" />
          <strong>{appToast.message}</strong>
        </div>
      ) : null}

      {importAnimation.active ? (
        <div className={`importOverlay importPhase-${importAnimation.phase}`} role="status" aria-live="polite">
          <div className="importPanel">
            <div className="importScanStage" aria-hidden="true">
              <span className="importScannerLine" />
              <span className="importScannerGlow" />
              <span className="importScannerOrb" />
            </div>

            <div className="importPanelHead">
              <p className="eyebrow">local import</p>
              <h3>{importAnimation.phase === "success" ? importAnimation.message : "scanning your music"}</h3>
              <span>{importAnimation.phase === "error" ? "safe rollback" : importAnimation.message}</span>
            </div>

            <div className="importCounter">
              <strong>{importAnimation.count}</strong>
              <span>{importAnimation.count === 1 ? "song found" : "songs found"}</span>
            </div>

            <div className="importCoverGrid">
              {(importAnimation.preview.length ? importAnimation.preview : Array.from({ length: 10 }, () => null)).map((song, index) => (
                <div
                  className={song ? "importCoverTile" : "importCoverTile importCoverPlaceholder"}
                  key={song ? `${song.id}-${index}` : `import-placeholder-${index}`}
                  style={{ "--tile-delay": `${index * 42}ms` } as CSSProperties}
                >
                  {song ? <Cover song={song} className="importCoverArt" /> : <span className="importCoverSkeleton" />}
                  <small>{song ? prettyTitle(song.title, 4) : "scanning..."}</small>
                </div>
              ))}
            </div>

            <div className="importLogList" aria-hidden="true">
              {(importAnimation.preview.length
                ? importAnimation.preview.slice(0, 5).map((song) => prettyTitle(song.title, 5))
                : ["opening file picker", "reading audio tags", "matching cover art", "building search index", "saving library order"]
              ).map((line, index) => (
                <span key={`${line}-${index}`} style={{ "--log-delay": `${index * 70}ms` } as CSSProperties}>
                  {line}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {!importAnimation.active && (libraryScanBusy || pixelArtBusy) ? (
        <div className="tinyScanner" role="status" aria-live="polite">
          <span className="scannerOrb" />
          <span>
            <strong>{pixelArtBusy ? "updating covers" : "scanning library"}</strong>
            <small>{pixelArtBusy ? "pixel art is being refreshed" : libraryScanMessage}</small>
          </span>
        </div>
      ) : null}

      {onboardingOpen ? (
        <Onboarding
          appVersion={APP_VERSION}
          songsCount={songs.length}
          currentTheme={settings.customThemeEnabled ? "custom" : settings.theme}
          discordEnabled={settings.discordEnabled}
          onChooseTheme={handleOnboardingTheme}
          onSetDiscordEnabled={handleOnboardingDiscord}
          onImportMusic={handleOnboardingImportMusic}
          onOpenDownloads={handleOnboardingDownloads}
          onStartListening={handleOnboardingStartListening}
          onSkip={skipOnboarding}
        />
      ) : null}

      {effectiveSimpleMode ? (
        simpleModeView
      ) : (
        <div className="appShell">
          <aside className="sidebar">
            <nav className="nav navMain" aria-label="main navigation">
              {navItems
                .filter((item) => item.id !== "settings")
                .map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      className={view === item.id ? "navItem active" : "navItem"}
                      onClick={() => changeView(item.id, "nav")}
                      aria-label={`open ${item.label}`}
                    >
                      <span className="navIcon" aria-hidden="true">
                        <Icon className="navLucideIcon" size={22} strokeWidth={2.75} fill="none" />
                      </span>
                      <span className="navText">
                        <strong>{item.label}</strong>
                        <small>{item.hint}</small>
                      </span>
                    </button>
                  );
                })}
            </nav>

            <div className="navDivider" aria-hidden="true" />

            <nav className="nav navUtility" aria-label="settings navigation">
              {navItems
                .filter((item) => item.id === "settings")
                .map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      className={view === item.id ? "navItem active" : "navItem"}
                      onClick={() => changeView(item.id, "nav")}
                      aria-label={`open ${item.label}`}
                    >
                      <span className="navIcon" aria-hidden="true">
                        <Icon className="navLucideIcon" size={22} strokeWidth={2.75} fill="none" />
                      </span>
                      <span className="navText">
                        <strong>{item.label}</strong>
                        <small>{item.hint}</small>
                      </span>
                    </button>
                  );
                })}
            </nav>

            <div className="sidebarBottom">
              <button className="mainAction importMainAction iconTextButton" onClick={importSongs}>
                <FolderPlus className="buttonInlineIcon" size={17} strokeWidth={2.1} aria-hidden="true" />
                import songs
              </button>
            </div>

            <button
              className="sidebarResizeHandle"
              type="button"
              aria-label="resize sidebar"
              title="drag to resize sidebar"
              onPointerDown={startSidebarResize}
            >
              <span />
            </button>
          </aside>

          <section className="content" ref={contentRef}>
            <header className="headerBar">
              <div className="headerText">
                {headerHint ? <p className="eyebrow">{headerHint}</p> : null}

                <h2>
                  {view === "home" && greeting}
                  {view === "library" && "your library"}
                  {view === "playlists" && "playlists"}
                  {view === "liked" && "liked songs"}
                  {view === "covers" && "pixel covers"}
                  {view === "analytics" && "listening analytics"}
                  {view === "downloads" && "downloads"}
                  {view === "settings" && "settings"}
                </h2>
              </div>

              <div className="headerTools compactHeaderTools">
                <div className="searchEasterWrap">
                  <input
                    className="search"
                    value={query}
                    onChange={(event) => handleSearchInput(event.currentTarget.value)}
                    placeholder="search songs, try /stars"
                  />
                </div>
              </div>
            </header>


            <div
              className={`pageTransition pageTransition-${view}`}
              data-view={view}
            >
              {view === "home" && (
              <>
                <section
                  className={`hero heroPremium ambientSurface heroLayoutMotion ${settings.heroExpanded ? "heroExpanded" : "heroCompact"} ${heroTitleClass}`}
                  style={{ ...ambientStyle, "--hero-motion-seed": nowPlayingTransitionKey } as CSSProperties}
                >
                  <div className="heroAmbiencePulse" aria-hidden="true" />
                  <div className="heroCoverGhost" key={`hero-ghost-${nowPlayingTransitionKey}`} aria-hidden="true" />
                  <div className="heroText heroTextClean nowPlayingCopySwap" key={`hero-copy-${nowPlayingTransitionKey}`}>
                    <p className="eyebrow" title={currentNowPlayingLabel}>{currentNowPlayingLabel}</p>

                    <h3 className="heroTitle" title={currentSong ? currentSong.title : "drop in your music"}>
                      {heroDisplayTitle}
                    </h3>
                    <p className="heroArtistLine" title={currentSong ? currentSong.artist || "unknown artist" : "import songs to start listening"}>
                      {heroDisplayArtist}
                    </p>

                    {misideModeActive ? (
                      <div className="misideEggNotice" role="status" aria-live="polite">
                        <span className="misideEggDot" aria-hidden="true" />
                        <span>
                          <strong>mita is listening...</strong>
              
                        </span>
                      </div>
                    ) : null}

                    {playerError ? <div className="warningBox">{playerError}</div> : null}
                    {isThreeAm && settings.volume > 0.8 ? (
                      <div className="warningBox lateNightWarning">volume is above 80% — late night ears deserve mercy.</div>
                    ) : null}
                    <div className="heroQuickActions">
                      <button
                        className="heroTinyButton"
                        type="button"
                        onClick={toggleHeroExpanded}
                        aria-pressed={settings.heroExpanded}
                        title={settings.heroExpanded ? "shrink the now playing banner" : "expand the now playing banner"}
                      >
                        {settings.heroExpanded ? "compact player" : "expand player"}
                      </button>

                      <button
                        className="heroTinyButton"
                        type="button"
                        onClick={openCoversViewWithCurrentSong}
                        title="open pixel cover gallery"
                      >
                        covers
                      </button>
                    </div>

                                      </div>

                  <div className="heroArtWrap nowPlayingArtSwap" key={`hero-art-${nowPlayingTransitionKey}`}>
                    <Cover song={currentSong} className="heroArt" />

                  </div>
                </section>

                <section className="homeShelfStack" aria-label="home music shelves">
                  <section className="homeShelfPanel homeListenPanel">
                    <div className="homeShelfHeader">
                      <div>
                        <p className="eyebrow">local picks</p>
                        <h3>Listen now</h3>
                      </div>
                      <div className="homeShelfActions">
                        <span>{homeListenNowSongs.length} pick{homeListenNowSongs.length === 1 ? "" : "s"}</span>
                        <button
                          className="homeShelfActionButton"
                          type="button"
                          onClick={shuffleLibrarySongsAction}
                          disabled={songs.length < 2}
                        >
                          shuffle songs
                        </button>
                      </div>
                    </div>

                    <div className="homeListenRail">
                      {homeListenNowSongs.length ? (
                        homeListenNowSongs.map((song, index) => {
                          const active = song.id === currentId;
                          return (
                            <button
                              key={song.id}
                              className={`homeListenCard ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""}`}
                              type="button"
                              onClick={() => void selectSong(song.id, true)}
                              title={`play ${song.title}`}
                              style={{ "--card-delay": `${index * 48}ms` } as CSSProperties}
                            >
                              <Cover song={song} className="homeListenCover" />
                              <span className="homeListenCopy">
                                <strong>{prettyTitle(song.title, 5)}</strong>
                                <small>{prettyMeta(song.artist)}</small>
                              </span>
                              <span className="homeListenMeta">{formatTime(song.duration || 0)}</span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="emptyState homeShelfEmpty">
                          <strong>no songs yet</strong>
                          <p>Import songs to start building your local library.</p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="homeShelfPanel homeFreshPanel">
                    <div className="homeShelfHeader">
                      <div>
                        <p className="eyebrow">fresh shelf</p>
                        <h3>recent covers</h3>
                      </div>
                      <button
                        className="homeShelfActionButton quiet"
                        type="button"
                        onClick={() => updateSetting("homeExpanded", !settings.homeExpanded)}
                        aria-pressed={settings.homeExpanded}
                      >
                        {settings.homeExpanded ? "compact library" : "open full shelf"}
                      </button>
                    </div>

                    <div className="homeFreshRail">
                      {homeFreshShelfSongs.length ? (
                        homeFreshShelfSongs.map((song, index) => (
                          <button
                            key={song.id}
                            className={`homeFreshCard ${song.id === currentId ? "active" : ""} ${song.id === currentId && isPlaying ? "playing" : ""}`}
                            type="button"
                            onClick={() => void selectSong(song.id, true)}
                            title={`play ${song.title}`}
                            style={{ "--card-delay": `${index * 42}ms` } as CSSProperties}
                          >
                            <Cover song={song} className="homeFreshCover" />
                            <strong>{prettyTitle(song.title, 4)}</strong>
                            <small>{prettyMeta(song.artist)}</small>
                          </button>
                        ))
                      ) : (
                        <div className="emptyState homeShelfEmpty">
                          <strong>nothing to show yet</strong>
                          <p>your newest covers appear here after import.</p>
                        </div>
                      )}
                    </div>
                  </section>
                </section>

                <section className={homeDashboardClass}>
                  <section className={`panel largePanel homeLibraryPanel ${settings.homeExpanded ? "homeLibraryExpanded" : "homeLibraryCompact"}`}>
                    <div className="panelHead">
                      <div>
                        <p className="eyebrow">library</p>
                        <h3>quick library</h3>
                      </div>
                      <div className="homeLibraryActions">
                        <span>{songs.length} song{songs.length === 1 ? "" : "s"}</span>
                        <button
                          className="expandLibraryButton"
                          type="button"
                          onClick={() => updateSetting("homeExpanded", !settings.homeExpanded)}
                          aria-pressed={settings.homeExpanded}
                          title={settings.homeExpanded ? "make the home library compact" : "expand the home library"}
                        >
                          {settings.homeExpanded ? "compact" : "expand"}
                        </button>
                      </div>
                    </div>

                    {settings.homeExpanded
                      ? renderHomeSongCards(filteredSongs, "homeAlbumGrid")
                      : renderSongRows(filteredSongs, "songList homeSongList")}
                  </section>

                  {showHomeSideCards ? (
                    <aside className="stack">
                      <section className="panel">
                        <p className="eyebrow">analytics</p>
                        <h3>quick stats</h3>

                        <div className="statsGrid">
                          <div className="statCard">
                            <span>most played</span>
                            <strong>{mostPlayed ? prettyTitle(mostPlayed.title, 5) : "none yet"}</strong>
                          </div>

                          <div className="statRowSmall">
                            <div className="statCard">
                              <span>liked</span>
                              <strong>{likedSongs.length}</strong>
                            </div>

                            <div className="statCard">
                              <span>plays</span>
                              <strong>{totalPlays}</strong>
                            </div>
                          </div>

                          <div className="statCard">
                            <span>minutes listened</span>
                            <strong>{totalMinutes}</strong>
                          </div>

                          <div className="miniBars">
                            {(topSongs.length ? topSongs : songs.slice(0, 6)).map((song) => (
                              <div
                                key={song.id}
                                title={`${song.title}: ${song.playCount} plays`}
                                style={{
                                  height: `${Math.max(14, Math.min(100, song.playCount * 18 || 14))}%`
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </section>

                      <section className="panel">
                        <div className="panelHead">
                          <div>
                            <p className="eyebrow">top songs</p>
                            <h3>little chart</h3>
                          </div>
                        </div>

                        <div className="topList">
                          {topSongs.length ? (
                            topSongs.map((song, index) => (
                              <button key={song.id} className="topRow" onClick={() => void selectSong(song.id, true)}>
                                <span>{index + 1}</span>
                                <strong>{prettyTitle(song.title, 5)}</strong>
                                <small>{song.playCount} plays</small>
                              </button>
                            ))
                          ) : (
                            <p className="softText">play some songs and your little chart appears here.</p>
                          )}
                        </div>
                      </section>
                    </aside>
                  ) : null}
                </section>
              </>
            )}

            {(view === "library" || view === "liked") && (
              <section className={`panel fillPanel libraryPanelV025 ${view === "liked" ? "likedPanel likedLibraryPanelV025" : ""}`}>
                <div className="panelHead libraryPanelHead libraryPanelHeadV025">
                  <div className="libraryPanelTitleV025">
                    <p className="eyebrow">{view === "liked" ? "liked" : "library"}</p>
                    <h3>{view === "liked" ? "songs you liked" : "overview"}</h3>
                    <span>
                      {view === "liked"
                        ? "All your favourites in one place."
                        : "Browse, queue, and shuffle from one clean list."}
                    </span>
                  </div>
                  <div className="libraryHeaderActions libraryPanelActionsV025 libraryActionsCleanV026">
                    {view === "library" ? (
                      <button type="button" className="shuffleLibraryButtonV025" onClick={shuffleLibrarySongsAction} disabled={songs.length < 2}>
                        shuffle songs
                      </button>
                    ) : null}
                  </div>
                </div>

                {view === "library" && (
                  <div className="libraryStatsV025" aria-label="library summary">
                    <div>
                      <span>tracks</span>
                      <strong>{songs.length}</strong>
                    </div>
                    <div>
                      <span>albums</span>
                      <strong>{libraryAlbumCount}</strong>
                    </div>
                    <div>
                      <span>artists</span>
                      <strong>{libraryArtistCount}</strong>
                    </div>
                    <div>
                      <span>plays</span>
                      <strong>{totalPlays}</strong>
                    </div>
                  </div>
                )}

                <div className="libraryListHeaderV025">
                  <span>tracks</span>
                  <span>title</span>
                </div>

                <div
                  className="songList fullList libraryFullListV025"
                  onDragOver={handleLibraryAreaDragOver}
                  onDragLeave={handleLibraryAreaDragLeave}
                  onDrop={handleLibraryAreaDrop}
                >
                  {visibleSongs.length ? renderSongRows(visibleSongs, "songList fullList libraryFullListV025") : (
                    <div className="emptyState">
                      {view === "liked" ? "Like a song and it will show up here." : "Import songs to fill your library."}
                    </div>
                  )}
                </div>
              </section>
            )}

            {view === "playlists" && (
              <section className="playlistsPage playlistPageV029">
                <div className="playlistTopGrid">
                  <section className="panel playlistHeroPanel">
                    <div className="playlistHeroCopy">
                      <p className="eyebrow">playlists</p>
                      <h3>{selectedPlaylist ? selectedPlaylist.name : "make your first mix"}</h3>
                      <p>
                        {selectedPlaylist
                          ? `${selectedPlaylistSongs.length} song${selectedPlaylistSongs.length === 1 ? "" : "s"} • ${formatTime(selectedPlaylistDuration)} total`
                          : "Create a playlist, add songs, and keep your local music feeling familiar."}
                      </p>
                    </div>

                    {selectedPlaylist ? renderPlaylistCollage(selectedPlaylistSongs, "playlistHeroCollage playlistCoverCollage") : (
                      <div className="playlistHeroCollage playlistCoverCollage playlistEmptyCollage" aria-hidden="true">
                        <div className="playlistCoverTile empty"><span>♪</span></div>
                        <div className="playlistCoverTile empty"><span>+</span></div>
                        <div className="playlistCoverTile empty"><span>♫</span></div>
                        <div className="playlistCoverTile empty"><span>♪</span></div>
                      </div>
                    )}

                    <div className="playlistHeroActions">
                      <button
                        className="heroMain"
                        type="button"
                        onClick={() => selectedPlaylist && void playPlaylist(selectedPlaylist, false)}
                        disabled={!selectedPlaylist || selectedPlaylist.songIds.length === 0}
                      >
                        play
                      </button>
                      <button
                        className="softButton"
                        type="button"
                        onClick={() => selectedPlaylist && void playPlaylist(selectedPlaylist, true)}
                        disabled={!selectedPlaylist || selectedPlaylist.songIds.length === 0}
                      >
                        shuffle
                      </button>
                      {selectedPlaylist ? (
                        <>
                          <button className="softButton" type="button" onClick={() => startRenamePlaylist(selectedPlaylist)}>
                            rename
                          </button>
                          <button className="softButton" type="button" onClick={() => duplicatePlaylist(selectedPlaylist.id)}>
                            duplicate
                          </button>
                        </>
                      ) : null}
                    </div>
                  </section>

                  <aside className="panel playlistCreatePanel">
                    <p className="eyebrow">new playlist</p>
                    <h3>start a mix</h3>
                    <p className="softText">Night drive, gaming, school, sad songs — whatever fits.</p>
                    <form
                      className="playlistCreateForm"
                      onSubmit={(event) => {
                        event.preventDefault();
                        createPlaylist();
                      }}
                    >
                      <input
                        value={newPlaylistName}
                        onChange={(event) => setNewPlaylistName(event.currentTarget.value)}
                        placeholder="playlist name"
                      />
                      <button className="mainAction" type="submit">new playlist</button>
                    </form>
                  </aside>
                </div>

                <div className="playlistContentGrid">
                  <section className="panel playlistShelfPanel">
                    <div className="panelHead">
                      <div>
                        <p className="eyebrow">your mixes</p>
                        <h3>library shelves</h3>
                      </div>
                    </div>

                    <div className="playlistShelfGrid">
                      {playlistSummaries.length ? playlistSummaries.map(({ playlist, previewSongs, songCount, duration }, index) => (
                        <button
                          key={playlist.id}
                          className={`playlistShelfCard ${selectedPlaylist?.id === playlist.id ? "active" : ""} ${activePlaylistId === playlist.id ? "playing" : ""} ${playlistDragOverPlaylistId === playlist.id ? "dropTarget" : ""}`}
                          style={{ "--playlist-stagger": Math.min(index, 12) } as CSSProperties}
                          type="button"
                          onClick={() => setSelectedPlaylistId(playlist.id)}
                          onDragOver={(event) => handlePlaylistShelfDragOver(event, playlist.id)}
                          onDragLeave={(event) => handlePlaylistShelfDragLeave(event, playlist.id)}
                          onDrop={(event) => handlePlaylistShelfDrop(event, playlist.id)}
                          title="drop a song here to add it"
                        >
                          {renderPlaylistCollage(previewSongs)}
                          <span className="playlistShelfMeta">
                            <strong>{playlist.name}</strong>
                            <small>{songCount} song{songCount === 1 ? "" : "s"} • {formatTime(duration)}</small>
                          </span>
                          <span className="playlistShelfDropHint">{activePlaylistId === playlist.id ? "playing" : "drop song"}</span>
                        </button>
                      )) : (
                        <div className="playlistEmptyState">
                          <strong>No playlists yet</strong>
                          <p>Make one above, then add songs from any song card.</p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="panel playlistTracksPanel">
                    <div className="panelHead playlistTracksHead">
                      <div className="playlistTracksTitleBlock">
                        <p className="eyebrow">playlist</p>
                        {selectedPlaylist && renamingPlaylistId === selectedPlaylist.id ? (
                          <form
                            className="playlistRenameForm"
                            onSubmit={(event) => {
                              event.preventDefault();
                              savePlaylistRename(selectedPlaylist.id);
                            }}
                          >
                            <input
                              value={renamingPlaylistName}
                              onChange={(event) => setRenamingPlaylistName(event.currentTarget.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") cancelRenamePlaylist();
                              }}
                              placeholder="playlist name"
                              autoFocus
                            />
                            <button className="settingsTinyButton" type="submit">save</button>
                            <button className="settingsTinyButton" type="button" onClick={cancelRenamePlaylist}>cancel</button>
                          </form>
                        ) : (
                          <h3>{selectedPlaylist ? selectedPlaylist.name : "nothing selected"}</h3>
                        )}
                      </div>

                      {selectedPlaylist ? (
                        <div className="playlistManageActions">
                          <button className="settingsTinyButton" type="button" onClick={() => startRenamePlaylist(selectedPlaylist)}>rename</button>
                          <button className="settingsTinyButton" type="button" onClick={() => duplicatePlaylist(selectedPlaylist.id)}>duplicate</button>
                          <button className="settingsTinyButton danger" type="button" onClick={() => removePlaylist(selectedPlaylist.id)}>remove</button>
                        </div>
                      ) : null}
                    </div>

                    <VirtualPlaylistTrackList
                      selectedPlaylistId={selectedPlaylist?.id || ""}
                      list={selectedPlaylistSongs}
                      currentId={currentId}
                      isPlaying={isPlaying}
                      draggedSongId={draggedSongId}
                      onSelectSong={selectPlaylistSongAction}
                      onStartSongDrag={startPlaylistSongDragAction}
                      onDropSong={dropPlaylistSongAction}
                      onAppendSong={appendPlaylistSongAction}
                      onDragEnd={endPlaylistSongDragAction}
                      onOpenContextMenu={openPlaylistSongContextMenuAction}
                      onRemoveSong={removePlaylistSongAction}
                    />
                  </section>
                </div>
              </section>
            )}

            {view === "covers" && (
              <CoverStudio
                ambientStyle={ambientStyle ?? undefined}
                pixelArtBusy={pixelArtBusy}
                selectedCoverSongs={selectedCoverSongs}
                currentSong={currentSong}
                coverGalleryMood={coverGalleryMood}
                coverMoodOptions={coverMoodOptions}
                coverMoodCounts={coverMoodCounts}
                coverStats={coverStats}
                filteredCoverGalleryAssets={filteredCoverGalleryAssets}
                coverPickerSongList={coverPickerSongList}
                coverSelectedSongIds={coverSelectedSongIds}
                CoverComponent={Cover}
                prettyTitle={prettyTitle}
                prettyMeta={prettyMeta}
                pixelArtUrl={pixelArtUrl}
                coverMoodName={coverMoodName}
                setCoverGalleryMood={setCoverGalleryMood}
                randomizeSelectedCovers={randomizeSelectedCovers}
                rescanPixelArtFolder={rescanPixelArtFolder}
                selectCurrentSongForCovers={selectCurrentSongForCovers}
                selectVisibleSongsForCovers={selectVisibleSongsForCovers}
                setCoverSelectedSongIds={setCoverSelectedSongIds}
                toggleCoverSongSelection={toggleCoverSongSelection}
                applyCoverAssetToSelection={applyCoverAssetToSelection}
                togglePixelCoverFavorite={togglePixelCoverFavorite}
                togglePixelCoverExcluded={togglePixelCoverExcluded}
              />
            )}

            {view === "analytics" && (
              <section className="analyticsLayout analyticsLocalV030">
                <section className="panel analyticsLocalHero">
                  <div className="analyticsLocalHeroCopy">
                    <p className="eyebrow">local music stats</p>
                    <h3>listening analytics</h3>
                    <p>
                      {songs.length
                        ? `Built from your own library: ${songs.length.toLocaleString()} song${songs.length === 1 ? "" : "s"}, ${totalPlays.toLocaleString()} total play${totalPlays === 1 ? "" : "s"}, and ${totalMinutes.toLocaleString()} minute${totalMinutes === 1 ? "" : "s"} listened.`
                        : "Import songs and localtify will build this from your local library data."}
                    </p>
                  </div>

                  <div className="analyticsLocalHeroStats" aria-label="quick local analytics">
                    <span><strong>{playedPercent}%</strong><small>played</small></span>
                    <span><strong>{likedPercent}%</strong><small>liked</small></span>
                    <span><strong>{libraryHealthLabel}</strong><small>health</small></span>
                  </div>
                </section>

                <section className="analyticsLocalGrid" aria-label="local listening statistics">
                  {analyticsStatCards.map((card) => (
                    <article key={card.label} className={`statCard analyticsLocalCard${card.wide ? " analyticsLocalCardWide" : ""}`}>
                      <span>{card.label}</span>
                      <strong title={card.value}>{card.value}</strong>
                      <small>{card.note}</small>
                    </article>
                  ))}
                </section>

                <section className="analyticsLocalSplit">
                  <section className="panel analyticsLocalPanel">
                    <div className="panelHead analyticsLocalPanelHead">
                      <div>
                        <p className="eyebrow">top artists</p>
                        <h3>artist stats</h3>
                      </div>
                      <span>{topArtists.length ? `${topArtists.length} shown` : "empty"}</span>
                    </div>

                    <div className="analyticsLocalArtistList">
                      {topArtists.length ? (
                        topArtists.map((artist, index) => {
                          const maxArtistPlays = Math.max(1, ...topArtists.map((item) => item.plays || 0));
                          const width = Math.max(5, Math.round(((artist.plays || 0) / maxArtistPlays) * 100));

                          return (
                            <div key={artist.name} className="analyticsLocalArtistRow">
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <div>
                                <strong>{artist.name}</strong>
                                <small>{artist.plays.toLocaleString()} plays • {artist.songs} song{artist.songs === 1 ? "" : "s"}</small>
                              </div>
                              <i aria-hidden="true"><b style={{ width: `${width}%` }} /></i>
                            </div>
                          );
                        })
                      ) : (
                        <p className="softText">artists will show here after you import music.</p>
                      )}
                    </div>
                  </section>

                  <section className="panel analyticsLocalPanel">
                    <div className="panelHead analyticsLocalPanelHead">
                      <div>
                        <p className="eyebrow">recent imports</p>
                        <h3>fresh files</h3>
                      </div>
                      <span>{recentImportWeekCount} this week</span>
                    </div>

                    <div className="analyticsLocalRecentList">
                      {(recentlyAdded.length ? recentlyAdded.slice(0, 6) : songs.slice(0, 6)).map((song) => (
                        <button key={song.id} type="button" className="analyticsLocalRecentRow" onClick={() => void selectSong(song.id, true)}>
                          <Cover song={song} className="analyticsLocalRecentArt" />
                          <div>
                            <strong>{prettyTitle(song.title, 8)}</strong>
                            <small>{prettyMeta(song.artist)} • {formatTime(song.duration)}</small>
                          </div>
                        </button>
                      ))}
                      {!songs.length ? <p className="softText">nothing imported yet.</p> : null}
                    </div>
                  </section>
                </section>

                <section className="panel analyticsLocalPanel analyticsLocalHealthPanel">
                  <div className="panelHead analyticsLocalPanelHead">
                    <div>
                      <p className="eyebrow">library health</p>
                      <h3>local data check</h3>
                    </div>
                    <span>from your database</span>
                  </div>

                  <div className="analyticsLocalHealthGrid">
                    <div><strong>{playedPercent}%</strong><small>played percent</small></div>
                    <div><strong>{likedPercent}%</strong><small>liked percent</small></div>
                    <div><strong>{neverPlayedSongs.length}</strong><small>never played</small></div>
                    <div><strong>{missingFileCount}</strong><small>missing files</small></div>
                    <div><strong>{libraryLengthLabel}</strong><small>library length</small></div>
                    <div><strong>{formatTime(averageSongSeconds)}</strong><small>average length</small></div>
                    <div><strong>{longestSong ? formatTime(longestSong.duration) : "0:00"}</strong><small>longest track</small></div>
                  </div>

                  <p className="softText">These stats stay local and are calculated from your songs, play counts, durations, likes, playlists, and import dates.</p>
                </section>
              </section>
            )}


            {view === "settings" && (
              <section className="settingsPage settingsPageV027">
                <div className="settingsHero panel settingsHeroV027">
                  <div>
                    <p className="eyebrow">localtify controls</p>
                    <h3>settings</h3>
                    <p className="softText">Change appearance, playback, Discord, library, covers, updates, and advanced options.</p>
                  </div>

                </div>

                <div className="settingsLayout settingsPageLayoutV027">
                  {renderSettingsRail("page")}
                  <div className="settingsCategoryContent settingsCategoryContentV027">
                    <AnimatePresence mode="wait" initial={false}>
                      <Motion.div
                        key={`settings-page-${settingsCategory}`}
                        className={`settingsCategoryMotion settingsCategoryMotion-${settingsCategory}`}
                        data-settings-category={settingsCategory}
                        initial={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                        animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                        exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                        transition={settings.reducedMotion ? { duration: 0.1 } : settingsCategorySpring}
                      >
                        {renderSettingsCategoryContent()}
                      </Motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </section>
            )}

            {view === "downloads" && (
              <section className="downloadsLayout downloadsLayoutV031">
                <section className="panel downloadPanel downloadPanelV031">
                  <div className="panelHead downloadHeroHead">
                    <div>
                      <p className="eyebrow">downloads</p>
                      <h3>download music</h3>
                      <p className="softText">Queue links, watch progress, retry failed items, then open finished songs in your library.</p>
                    </div>

                    <div className="downloadHeroActions">
                      <button className="softButton" onClick={() => window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined)}>
                        open folder
                      </button>
                      <button className="softButton" onClick={() => { changeView("settings", "unknown"); setSettingsCategory("downloads"); }}>
                        download settings
                      </button>
                    </div>
                  </div>

                  <div className="downloadNotice downloadNoticeV031">
                    Paste YouTube links one per line. localtify will download audio, convert it, and add it to your library unless auto-add is turned off.
                  </div>

                  <textarea
                    className="downloadTextarea downloadTextareaV031"
                    value={downloadText}
                    onChange={(event) => setDownloadText(event.currentTarget.value)}
                    placeholder={`paste YouTube links here, one per line...\nhttps://youtube.com/watch?v=...\nhttps://youtu.be/...`}
                  />

                  <div className="downloadActions downloadActionsV031">
                    <button className="heroMain" onClick={() => void downloadAudioLinks()} disabled={downloadBusy}>
                      {downloadBusy ? "downloading..." : "start download"}
                    </button>

                    {downloadBusy ? (
                      <button className="heroGhost dangerGhost" onClick={() => void cancelCurrentDownload()}>
                        cancel download
                      </button>
                    ) : (
                      <button className="heroGhost" onClick={() => setDownloadText("")}>clear links</button>
                    )}

                    <button
                      className="heroGhost"
                      onClick={() => {
                        setDownloadResults([]);
                        setDownloadQueue((items) => items.filter((item) => item.status === "queued" || item.status === "downloading" || item.status === "converting"));
                      }}
                      disabled={downloadBusy || (!downloadResults.length && !downloadQueue.some((item) => item.status === "done" || item.status === "failed" || item.status === "cancelled"))}
                    >
                      clear finished
                    </button>
                  </div>

                  {downloadQueue.length ? (
                    <div className="downloadQueuePanel">
                      <div className="panelHead smallPanelHead">
                        <div>
                          <p className="eyebrow">queue</p>
                          <h3>{downloadQueue.length} item{downloadQueue.length === 1 ? "" : "s"}</h3>
                        </div>
                        <span>{downloadBusy ? "working" : "ready"}</span>
                      </div>

                      <div className="downloadQueueList">
                        {downloadQueue.map((item, index) => (
                          <div key={`${item.id}-${index}`} className={`downloadQueueItem ${item.status}`}>
                            <div className="downloadQueueTop">
                              <span className="downloadQueueIndex">{String(index + 1).padStart(2, "0")}</span>
                              <div>
                                <strong>{item.filename || item.title}</strong>
                                <p>{item.message}</p>
                              </div>
                              <small>{item.progress}%</small>
                            </div>

                            <div className="downloadQueueTrack"><i style={{ width: `${clamp(item.progress, 0, 100)}%` }} /></div>

                            <div className="downloadQueueMeta">
                              <span>{item.status}</span>
                              {item.speed ? <span>{item.speed}</span> : null}
                              {item.eta ? <span>ETA {item.eta}</span> : null}
                              {item.error ? <span>{item.error}</span> : null}
                            </div>

                            <div className="downloadQueueActions">
                              {item.status === "failed" ? (
                                <button className="softButton" onClick={() => void retryDownload(item.url)}>retry</button>
                              ) : null}
                              {item.status === "done" ? (
                                <button className="softButton" onClick={() => openDownloadedSongInLibrary(item)}>open in library</button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="converterBox converterBoxV031">
                    <div>
                      <strong>convert local files</strong>
                      <p>Choose mp4, webm, mkv, mov, wav, m4a, flac, or mp3 files. localtify converts and imports them.</p>
                    </div>

                    <button className="heroMain" onClick={convertLocalMedia} disabled={convertBusy}>
                      {convertBusy ? "converting..." : "choose files and convert"}
                    </button>

                    {convertBusy ? (
                      <div className="converterProgress">
                        <div>
                          <span>{convertMessage || "working..."}</span>
                          <strong>{convertProgress}%</strong>
                        </div>

                        <div className="converterTrack">
                          <i style={{ width: `${convertProgress}%` }} />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {downloadResults.length ? (
                    <div className="downloadResults downloadResultsV031">
                      <strong>finished downloads</strong>

                      {downloadResults.map((item, index) => (
                        <div
                          key={`${item.url || item.filename || index}`}
                          className={item.ok ? "downloadResult ok" : "downloadResult bad"}
                        >
                          <span>{item.ok ? "✓" : "!"}</span>

                          <div>
                            <strong>{item.ok ? item.filename || "downloaded audio" : "Download failed — retry?"}</strong>
                            <p>{item.ok ? item.url : item.error || item.url || "unknown error"}</p>
                          </div>

                          {item.ok ? (
                            <button className="softButton" onClick={() => openDownloadedSongInLibrary(item)}>open in library</button>
                          ) : (
                            <button className="softButton" onClick={() => void retryDownload(item.url || "")}>retry</button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              </section>
            )}
            </div>
          </section>

          <footer
            className={`playerBar ambientSurface ${isPlaying ? "playerPlaying" : "playerIdle"} ${draggedSongId ? "songDragActive" : ""} ${queueDropHot ? "queueDropHot" : ""}`}
            style={ambientStyle}
            data-ambient={effectiveAmbient ? "true" : "false"}
            data-cover-sync={effectiveCoverColorSyncMode}
            onDragOver={handlePlayerDragOver}
            onDragLeave={handlePlayerDragLeave}
            onDrop={handlePlayerDrop}
          >
            <button
              className="playerResizeHandle"
              type="button"
              onPointerDown={startPlayerResize}
              aria-label="resize player"
              title="drag up/down to resize the player"
            />

            <div className="playerDropHint" aria-hidden="true">
              drop to play next
            </div>

            <div className="playerLeft">
              <div className="playerArtSwap" key={`player-art-${nowPlayingTransitionKey}`}>
                <Cover song={currentSong} className="smallArt" />
              </div>

              <div className="playerMeta nowPlayingMiniCopySwap" key={`player-copy-${nowPlayingTransitionKey}`}>
                <strong title={currentSong ? currentSong.title : ""}>
                  {currentSong ? prettyTitle(currentSong.title, 7) : "nothing playing"}
                </strong>
                <p>{currentSong ? prettyMeta(currentSong.artist) : "import a song to begin"}</p>
              </div>
            </div>

            <div className="playerCenter">
              <div className="controlRow">
                <button
                  className={isShuffle ? "circleButton active" : "circleButton"}
                  onClick={() => setIsShuffle((value) => !value)}
                  aria-label={isShuffle ? "turn shuffle off" : "turn shuffle on"}
                >
                  <Shuffle className="playerControlIcon" size={15} strokeWidth={2.15} aria-hidden="true" />
                </button>
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

              <div className="progressRow progressResetSweep" key={`progress-${nowPlayingTransitionKey}`}>
                <span ref={(node) => { progressTimeLabelRefs.current[1] = node; }}>{formatTime(displayedTime)}</span>
                <input
                  ref={(node) => { progressInputRefs.current[1] = node; }}
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={displayedProgress}
                  style={progressRangeStyle}
                  aria-label="song progress"
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
                <span ref={(node) => { progressDurationLabelRefs.current[1] = node; }}>{formatTime(currentDuration || currentSong?.duration || 0)}</span>
              </div>
            </div>

            <div className="playerRight">
              <div className="volumeWrap" aria-label="Volume">
                <button
                  type="button"
                  className="volumeIconButton"
                  onClick={() => updateSetting("volume", settings.volume > 0 ? 0 : 0.72, true)}
                  aria-label={settings.volume > 0 ? "mute volume" : "restore volume"}
                  title={settings.volume > 0 ? "Mute volume" : "Restore volume"}
                >
                  {settings.volume > 0 ? (
                    <Volume2 className="playerControlIcon" size={17} strokeWidth={2.2} aria-hidden="true" />
                  ) : (
                    <VolumeX className="playerControlIcon" size={17} strokeWidth={2.2} aria-hidden="true" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={volumeDraft}
                  style={volumeRangeStyle}
                  aria-label="volume level"
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    volumeDraftRef.current = Number(event.currentTarget.value);
                    setIsVolumeDragging(true);
                    previewVolume(event.currentTarget.value, event.currentTarget);
                  }}
                  onInput={(event) => previewVolume(event.currentTarget.value, event.currentTarget)}
                  onChange={(event) => previewVolume(event.currentTarget.value, event.currentTarget)}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                    commitVolume(event.currentTarget.value);
                  }}
                  onPointerCancel={(event) => {
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                    commitVolume(event.currentTarget.value);
                  }}
                  onKeyUp={(event) => commitVolume(event.currentTarget.value)}
                  onBlur={(event) => {
                    if (isVolumeDragging) commitVolume(event.currentTarget.value);
                  }}
                />
              </div>
            </div>
          </footer>
        </div>
      )}

      {settingsOpen ? (
        <div className="modalWrap settingsOverlay" onClick={() => setSettingsOpen(false)}>
          <div
            className="settingsModal cleanSettingsModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settingsTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHead cleanSettingsHead">
              <div><p className="eyebrow">settings</p><h3 id="settingsTitle">make localtify feel right</h3><span>clear controls, simple wording, and no messy long scrolling.</span></div>
              <button className="closeModalButton" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </div>
            <div className="settingsLayout settingsModalLayoutV027">
              {renderSettingsRail("modal")}
              <div className="settingsCategoryContent settingsCategoryContentV027">
                <AnimatePresence mode="wait" initial={false}>
                  <Motion.div
                    key={`settings-modal-${settingsCategory}`}
                    className={`settingsCategoryMotion settingsCategoryMotion-${settingsCategory}`}
                    data-settings-category={settingsCategory}
                    initial={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={settings.reducedMotion ? { duration: 0.1 } : settingsCategorySpring}
                  >
                    {renderSettingsCategoryContent()}
                  </Motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {songContextMenu ? (() => {
        const menuSong = songsById.get(songContextMenu.songId);
        if (!menuSong) return null;

        return (
          <div className="songContextMenuLayer" onClick={() => setSongContextMenu(null)}>
            <div
              className="songContextMenu"
              style={{ left: songContextMenu.x, top: songContextMenu.y }}
              role="menu"
              aria-label="song actions"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="songContextMenuHead">
                <Cover song={menuSong} className="songContextMenuCover" />
                <span>
                  <strong>{prettyTitle(menuSong.title, 6)}</strong>
                  <small>{prettyMeta(menuSong.artist)}</small>
                </span>
              </div>

              <button type="button" role="menuitem" onClick={() => { setSongContextMenu(null); void selectSong(menuSong.id, true); }}>
                <span>▶</span> play now
              </button>
              <button type="button" role="menuitem" onClick={() => { setSongContextMenu(null); queueSong(menuSong.id, true); }}>
                <span>↱</span> play next
              </button>
              <button type="button" role="menuitem" onClick={() => openPlaylistPicker(menuSong)}>
                <span>＋</span> add to playlist
              </button>
              <button type="button" role="menuitem" onClick={() => { setSongContextMenu(null); toggleLike(menuSong.id); }}>
                <span>♥</span> {menuSong.liked ? "unlike" : "like"}
              </button>
              <button type="button" role="menuitem" onClick={() => { setSongContextMenu(null); openEditor(menuSong); }}>
                <span>⋯</span> edit track
              </button>
            </div>
          </div>
        );
      })() : null}

      {whatsNewOpen ? (
        <div className="whatsNewOverlay" onClick={closeWhatsNew}>
          <section className="whatsNewCard" role="dialog" aria-modal="true" aria-labelledby="whatsNewTitle" onClick={(event) => event.stopPropagation()}>
            <button className="whatsNewClose" type="button" onClick={closeWhatsNew} aria-label="Close what's new">×</button>
            <p className="eyebrow">what's new</p>
            <h3 id="whatsNewTitle">localtify {APP_VERSION}</h3>
            <p className="whatsNewSubtext">0.3.5 is mostly a playlist, hero, and smoothness update: playlist playback stays in its lane, the home hero feels more alive, and song changes should look less jumpy.</p>
            <ul>{whatsNewItems.map((item) => <li key={item}>{item}</li>)}</ul>
            <button className="heroMain" type="button" onClick={closeWhatsNew}>got it</button>
          </section>
        </div>
      ) : null}

      {editorSong ? (
        <div className="modalWrap editorModalWrap" onClick={() => setEditorSong(null)}>
          <div className="editorModal editorModalMotion" onClick={(event) => event.stopPropagation()}>
            <div className="modalHead editorModalHead">
              <div>
                <p className="eyebrow">song details</p>
                <h3>edit track</h3>
                <span className="editorHeadSub">change the name, cover, and details for this song.</span>
              </div>
            </div>

            <div className="editorGrid editorGridBetter">
              <aside className="editorCoverBlock editorCoverBlockBetter">
                <div className="editorCoverShell">
                  <Cover song={editorSong} className="editorCover" />
                </div>

                <div className="editorCoverActions">
                  <button className="softButton" disabled={pixelArtBusy} onClick={randomizeCover}>
                    random pixel art
                  </button>
                  <button className="softButton" disabled={pixelArtBusy} onClick={pickCover}>
                    choose image from pc
                  </button>
                </div>

                <div className="editorMiniStats" aria-label="song quick stats">
                  <span>
                    <strong>{formatTime(editorSong.duration || 0)}</strong>
                    <small>duration</small>
                  </span>
                  <span>
                    <strong>{editorSong.playCount || 0}</strong>
                    <small>plays</small>
                  </span>
                </div>
              </aside>

              <div className="editorFields editorFieldsBetter">
                <section className="editorCard editorFormCard">
                  <div className="editorSectionTitle">
                    <strong>metadata</strong>
                    <span>what shows inside the app</span>
                  </div>

                  <div className="editorLabelGrid">
                    <label>
                      <span>title</span>
                      <input value={editTitle} onChange={(event) => setEditTitle(event.currentTarget.value)} />
                    </label>

                    <label>
                      <span>artist</span>
                      <input
                        value={editArtist}
                        onChange={(event) => setEditArtist(event.currentTarget.value)}
                        placeholder="coderpixel / artist name"
                      />
                    </label>

                    <label>
                      <span>album</span>
                      <input value={editAlbum} onChange={(event) => setEditAlbum(event.currentTarget.value)} />
                    </label>
                  </div>
                </section>

                <section className="editorCard editorPlaylistCard">
                  <div className="editorSectionTitle">
                    <strong>playlists</strong>
                    <span>add this song to one of your mixes</span>
                  </div>

                  {playlists.length ? (
                    <div className="editorPlaylistChips">
                      {playlists.map((playlist) => {
                        const added = playlist.songIds.includes(editorSong.id);

                        return (
                          <button
                            key={playlist.id}
                            className={`editorPlaylistChip ${added ? "active" : ""}`}
                            type="button"
                            onClick={() => toggleSongPlaylist(playlist.id, editorSong.id)}
                          >
                            {playlist.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="settingsHintText">No playlists yet. Create one from the playlists page or the + button on a song.</p>
                  )}
                </section>


                <div className="editorActions editorActionsBetter">
                  <button className="softButton" onClick={() => toggleLike(editorSong.id)}>
                    {editorSong.liked ? "unlike" : "like"}
                  </button>

                  <button className="dangerButton" onClick={() => askRemoveSong(editorSong.id)}>
                    remove song
                  </button>

                  <button className="heroMain" onClick={saveEditor}>
                    save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {playlistPickerSong ? (
        <div className="modalWrap playlistPickerWrap" onClick={() => { setPlaylistPickerSong(null); setPlaylistPickerName(""); }}>
          <div className="playlistPickerModal" role="dialog" aria-modal="true" aria-label="Add song to playlist" onClick={(event) => event.stopPropagation()}>
            <div className="modalHead playlistPickerHead">
              <div>
                <p className="eyebrow">add to playlist</p>
                <h3>{prettyTitle(playlistPickerSong.title, 7)}</h3>
                <span className="editorHeadSub">Pick a playlist or make a new one.</span>
              </div>
              <button className="closeModalButton" type="button" onClick={() => { setPlaylistPickerSong(null); setPlaylistPickerName(""); }} aria-label="close">×</button>
            </div>

            <div className="playlistPickerList">
              {playlists.length ? playlists.map((playlist) => {
                const added = playlist.songIds.includes(playlistPickerSong.id);

                return (
                  <button
                    key={playlist.id}
                    className={`playlistPickerItem ${added ? "active" : ""}`}
                    type="button"
                    disabled={added}
                    onClick={() => addSongToPlaylist(playlist.id, playlistPickerSong!.id)}
                  >
                    {renderPlaylistCollage(
                      playlist.songIds.slice(0, 4).map((songId) => songsById.get(songId)).filter((song): song is Song => Boolean(song)),
                      "playlistPickerCollage playlistCoverCollage"
                    )}
                    <span>
                      <strong>{playlist.name}</strong>
                      <small>{added ? "already added" : `${playlist.songIds.length} song${playlist.songIds.length === 1 ? "" : "s"}`}</small>
                    </span>
                    <em>{added ? "added" : "add"}</em>
                  </button>
                );
              }) : (
                <div className="playlistEmptyState">
                  <strong>No playlists yet</strong>
                  <p>Make one below and this song will be added right away.</p>
                </div>
              )}
            </div>

            <form
              className="playlistPickerCreate"
              onSubmit={(event) => {
                event.preventDefault();
                if (!playlistPickerName.trim()) return;
                createPlaylistWithSong(playlistPickerSong!.id, playlistPickerName);
              }}
            >
              <input value={playlistPickerName} onChange={(event) => setPlaylistPickerName(event.currentTarget.value)} placeholder="new playlist name" />
              <button className="mainAction" type="submit" disabled={!playlistPickerName.trim()}>create and add</button>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="modalWrap deleteModalWrap" onClick={() => !deleteBusy && setDeleteTarget(null)}>
          <div className="deleteModal cartoonPop" onClick={(event) => event.stopPropagation()}>
            <div className="deleteFace">:(</div>

            <p className="deleteTiny">remove from localtify</p>

            <h3>
              do you really wanna delete
              <span>"{prettyTitle(deleteTarget.title, 8)}"</span>
              from localtify?
            </h3>

            <p className="deleteSub">
              this only removes it from your localtify library.
              <br />
              your real music file stays safe on your pc.
            </p>

            <div className="deleteActions">
              <button className="heroGhost" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
                no keep it
              </button>

              <button className="dangerButton bigDanger" onClick={() => removeSong(deleteTarget.id)} disabled={deleteBusy}>
                {deleteBusy ? "removing..." : "yes remove it"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <audio
        ref={audioRef}
        preload="auto"
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onPlay={() => {
          pendingPlayRef.current = false;
          setIsPlaying(true);
        }}
        onPause={() => {
          if (!audioRef.current?.ended) {
            setIsPlaying(false);
          }
        }}
        onLoadedMetadata={(event: SyntheticEvent<HTMLAudioElement>) => saveDuration(event.currentTarget.duration)}
        onDurationChange={(event: SyntheticEvent<HTMLAudioElement>) => saveDuration(event.currentTarget.duration)}
        onTimeUpdate={(event: SyntheticEvent<HTMLAudioElement>) => {
          const nextTime = event.currentTarget.currentTime;
          timeRef.current = nextTime;
          tickPlayCountTracker(nextTime);
        }}
        onEnded={() => {
          const endedSong = songRef.current || currentSong;
          markSongCompletedForPlayCount(endedSong);
          if (endedSong?.id) void patchSongLocal(endedSong.id, { playbackPosition: 0 });
          playNext(true, "auto");
        }}
        onError={() => {
          const audio = audioRef.current;

          setPlayerError(getAudioErrorText(audio));
          setStatusText("playback error");
          setIsPlaying(false);

          pendingPlayRef.current = false;
          resetPlayCountTracker();

          stopFade();
          stopProgressLoop();

          window.localitfy.clearDiscordActivity().catch(() => undefined);
        }}
      />
    </main>
  );
}

export default function App() {
  return <MainModeApp />;
}
