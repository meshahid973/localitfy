// @ts-nocheck
import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import type { CSSProperties, PointerEvent, DragEvent, MouseEvent as ReactMouseEvent, SyntheticEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import UpdateIsland from "./app/UpdateIsland";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FastAverageColor } from "fast-average-color";

const EMPTY_STATE_IMAGE_SRC = new URL("./assets/empty-state.png", import.meta.url).href;

function WindowMinimizeIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" focusable="false">
      <path d="M2.25 6.25h7.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function WindowMaximizeIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" focusable="false">
      <rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.45" />
    </svg>
  );
}

function WindowCloseIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" focusable="false">
      <path d="M3 3l6 6M9 3L3 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlayingBarsIcon() {
  return (
    <svg className="inlineGlyphIcon playingBarsIcon" aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" focusable="false">
      <rect x="2.2" y="5.4" width="2" height="5.6" rx="1" fill="currentColor" />
      <rect x="6" y="2.4" width="2" height="8.6" rx="1" fill="currentColor" />
      <rect x="9.8" y="4" width="2" height="7" rx="1" fill="currentColor" />
    </svg>
  );
}

function EmptyCoverIcon() {
  return (
    <svg className="inlineGlyphIcon emptyCoverIcon" aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" focusable="false">
      <path d="M4.2 13.2V5.7c0-.92.67-1.7 1.58-1.84l6.6-1.02c.76-.12 1.45.47 1.45 1.24v7.42" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="13" r="2" fill="none" stroke="currentColor" strokeWidth="1.55" />
      <circle cx="12.8" cy="11.6" r="2" fill="none" stroke="currentColor" strokeWidth="1.55" />
    </svg>
  );
}

function CheckMiniIcon() {
  return (
    <svg className="inlineGlyphIcon checkMiniIcon" aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" focusable="false">
      <path d="M3 7.2l2.55 2.45L11.2 4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusMiniIcon() {
  return (
    <svg className="inlineGlyphIcon plusMiniIcon" aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" focusable="false">
      <path d="M7 2.8v8.4M2.8 7h8.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AlertMiniIcon() {
  return (
    <svg className="inlineGlyphIcon alertMiniIcon" aria-hidden="true" width="15" height="15" viewBox="0 0 15 15" focusable="false">
      <path d="M7.5 2.2l5.35 9.55H2.15L7.5 2.2z" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M7.5 5.65v2.55M7.5 10.65h.01" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function InfoMiniIcon() {
  return (
    <svg className="inlineGlyphIcon infoMiniIcon" aria-hidden="true" width="15" height="15" viewBox="0 0 15 15" focusable="false">
      <circle cx="7.5" cy="7.5" r="5.7" fill="none" stroke="currentColor" strokeWidth="1.45" />
      <path d="M7.5 6.7v3.45M7.5 4.7h.01" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  );
}

function SuccessMiniIcon() {
  return <CheckMiniIcon />;
}

function LocaltifyStateToneIcon({ tone }: { tone: string }) {
  if (tone === "error" || tone === "warning") return <AlertMiniIcon />;
  if (tone === "success") return <SuccessMiniIcon />;
  return <InfoMiniIcon />;
}

function UpdateStatusIcon({ status }: { status: string }) {
  if (status === "error") return <AlertMiniIcon />;
  if (status === "downloaded") return <CheckMiniIcon />;
  return (
    <svg className="inlineGlyphIcon updateMiniIcon" aria-hidden="true" width="15" height="15" viewBox="0 0 15 15" focusable="false">
      <path d="M7.5 2.2v7.1M4.9 6.8l2.6 2.6 2.6-2.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.4 12.2h8.2" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  );
}

function ResultStatusIcon({ failed, imported }: { failed: boolean; imported: boolean }) {
  if (failed) return <AlertMiniIcon />;
  if (imported) return <CheckMiniIcon />;
  return <InfoMiniIcon />;
}


function MetaDividerDot() {
  return <span className="metaDividerDot" aria-hidden="true" />;
}


import {
  BarChart3,
  Disc3,
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
  Pencil,
  Plus,
  Trash2,
  X,
  Save,
  HeartOff,
  ImagePlus,
  GripVertical
} from "lucide-react";

const Onboarding = lazy(() => import("./Onboarding"));
const CoverStudio = lazy(() => import("./cover"));

export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  filePath: string;
  // Runtime-only. Do not trust old saved URLs from the database.
  url: string;
  fileExists?: boolean;
  coverPath?: string | null;
  coverUrl?: string | null;
  coverThumbUrl?: string | null;
  coverThumbnailUrl?: string | null;
  thumbnailUrl?: string | null;
  coverFullUrl?: string | null;
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
  sourceType?: "local" | "youtube" | "spotify" | string;
  sourceTrackId?: string | null;
  sourceUrl?: string | null;
  sourceProvider?: string | null;
  sourceProviderUrl?: string | null;
  sourceMatchScore?: number;
};

export type PlaybackUrlResult = {
  ok: boolean;
  url?: string;
  filePath?: string;
  fileExists?: boolean;
  exists?: boolean;
  sizeBytes?: number;
  mtimeMs?: number;
  cacheTtlMs?: number;
  error?: string;
};

export type PlaybackUrlCacheEntry = {
  url: string;
  checkedAt: number;
  fileExists: boolean;
  sizeBytes?: number;
  mtimeMs?: number;
};

export const PLAYBACK_URL_CACHE_TTL_MS = 20 * 60 * 1000;

export function getSongPlaybackSourceKey(song: Pick<Song, "id" | "filePath" | "url"> | null | undefined) {
  return String(song?.filePath || song?.url || song?.id || "").trim().toLowerCase();
}

export function isPlayableSong(song: Song | null | undefined): song is Song {
  return !!song && Boolean(song.filePath || song.url) && song.fileExists !== false;
}

export type View = "home" | "library" | "albums" | "playlists" | "liked" | "covers" | "analytics" | "downloads" | "settings";
export type CoverMood = "all" | "favorites" | "leastUsed" | "cute" | "space" | "dark" | "cozy" | "energy";

export type SettingsCategory = "appearance" | "playback" | "discord" | "library" | "downloads" | "covers" | "updates" | "about" | "advanced" | "metadata";

export const settingsCategoryTabs: {
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
    keywords: "appearance theme themes color colors accent custom dark light layout spacing corners density ambience glow sidebar cat pet mascot buddy"
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

export function normalizeSettingsSearch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveSettingsCategoryFromSearch(value: string): SettingsCategory | null {
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

export function settingsTabMatchesSearch(tab: (typeof settingsCategoryTabs)[number], value: string) {
  const query = normalizeSettingsSearch(value);
  if (!query) return true;

  const haystack = `${tab.id} ${tab.label} ${tab.description} ${tab.keywords}`.toLowerCase();
  return haystack.includes(query) || query.split(" ").every((part) => haystack.includes(part));
}

export const navItems: Array<{
  id: View;
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  { id: "home", label: "home", hint: "now playing", icon: Home },
  { id: "library", label: "library", hint: "all songs", icon: LibraryBig },
  { id: "albums", label: "albums", hint: "local albums", icon: Disc3 },
  { id: "playlists", label: "playlists", hint: "your mixes", icon: ListMusic },
  { id: "liked", label: "liked", hint: "favorites", icon: Heart },
  { id: "covers", label: "covers", hint: "pixel art", icon: Images },
  { id: "analytics", label: "analytics", hint: "stats", icon: BarChart3 },
  { id: "downloads", label: "downloads", hint: "imports", icon: Download },
  { id: "settings", label: "settings", hint: "controls", icon: SettingsIcon }
];

export const sidebarNavGroups: Array<{
  id: "library" | "tools" | "app";
  label: string;
  itemIds: View[];
}> = [
  { id: "library", label: "library", itemIds: ["home", "library", "liked", "albums", "playlists"] },
  { id: "tools", label: "tools", itemIds: ["downloads", "covers", "analytics"] },
  { id: "app", label: "app", itemIds: ["settings"] }
];

export const coverMoodOptions: Array<{
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

export const coverColorSyncOptions: Array<{
  id: CoverColorSyncMode;
  label: string;
  note: string;
}> = [
  { id: "off", label: "off", note: "no cover tint, fastest look" },
  { id: "subtle", label: "subtle", note: "tiny cover color around the app" },
  { id: "normal", label: "normal", note: "balanced cover tint for daily use" },
  { id: "strong", label: "strong", note: "bigger cover mood and player glow" }
];

export type ImportAnimationPhase = "idle" | "picking" | "scanning" | "success" | "error";

export type ImportAnimationState = {
  active: boolean;
  phase: ImportAnimationPhase;
  message: string;
  count: number;
  total: number;
  preview: Song[];
};

export function createImportAnimationState(patch: Partial<ImportAnimationState> = {}): ImportAnimationState {
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


export type Playlist = {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
};

export type PlaylistSummary = {
  playlist: Playlist;
  previewSongs: Song[];
  songCount: number;
  duration: number;
};

export type QueueHistoryItem = {
  id: string;
  songId: string;
  title: string;
  artist: string;
  playedAt: number;
};

export type SongContextMenuState = {
  songId: string;
  x: number;
  y: number;
};

export const PLAYLIST_STORAGE_KEY = "localitfy.playlists.v1";
export const QUEUE_STORAGE_KEY = "localitfy.queue.v1";
export const QUEUE_HISTORY_STORAGE_KEY = "localitfy.queueHistory.v1";
export const REPEAT_PLAYLIST_STORAGE_KEY = "localitfy.repeatPlaylist.v1";
export const LIBRARY_ORDER_STORAGE_KEY = "localitfy.libraryOrder.v1";
export const ONBOARDING_STORAGE_KEY = "localitfy.onboarding.v1";

export const CODERPIXEL_ARTIST_EASTER_EGG = "all hail coderpixel";
export const CODERPIXEL_ARTIST_CHANCE = 0;

export function stableSongSourceKey(song: Pick<Song, "filePath" | "url">) {
  return String(song.filePath || song.url || "").trim().toLowerCase();
}

export function maybeApplyCoderpixelArtist(
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

export function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readLocalJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalJson<T>(key: string, value: T) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // storage failures should never break playback
  }
}

export type LibraryDropSide = "before" | "after";
export type LibraryDropTarget = { songId: string; side: LibraryDropSide; pull: number };

export function cleanSongOrderIds(value: unknown, validIds?: Set<string>) {
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

export function cleanPlaylistList(value: unknown, validIds?: Set<string>): Playlist[] {
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

export function applyLibraryOrder(list: Song[]) {
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

export function saveLibraryOrder(list: Song[]) {
  writeLocalJson(
    LIBRARY_ORDER_STORAGE_KEY,
    list.map((song) => song.id)
  );
}

export function reorderSongList(list: Song[], draggedId: string, targetId: string, side: LibraryDropSide) {
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

export function reorderIdList(list: string[], draggedId: string, targetId: string, side: LibraryDropSide) {
  if (!draggedId || !targetId || draggedId === targetId) return list;

  const withoutDragged = list.filter((id) => id !== draggedId);
  const targetIndex = withoutDragged.findIndex((id) => id === targetId);
  if (targetIndex === -1) return list;

  const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
  const next = [...withoutDragged];
  next.splice(insertIndex, 0, draggedId);

  return next;
}

export function insertIdNearTarget(list: string[], draggedId: string, targetId: string, side: LibraryDropSide) {
  if (!draggedId || !targetId) return list;

  const withoutDragged = list.filter((id) => id !== draggedId);
  const targetIndex = withoutDragged.findIndex((id) => id === targetId);
  if (targetIndex === -1) return withoutDragged.includes(draggedId) ? withoutDragged : [...withoutDragged, draggedId];

  const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
  const next = [...withoutDragged];
  next.splice(insertIndex, 0, draggedId);

  return next;
}
export type ThemeId =
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
export type DiscordArtMode = "albumCover" | "randomPixel" | "logo" | "none";
export type DiscordActivityStyle = "clean" | "cute" | "detailed" | "minimal" | "meme";
export type DiscordTitleCleanup = "off" | "light" | "heavy";
export type DiscordSecondLine = "artist" | "album" | "timeLeft" | "playCount" | "appName";
export type SecretMode = "none" | "stars" | "yukari";
export type SecretTriggerMode = Exclude<SecretMode, "none">;
export type CoverColorSyncMode = "off" | "subtle" | "normal" | "strong";

export type Settings = {
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
  catBuddyEnabled: boolean;
  showHeroBadge: boolean;
  simpleMode: boolean;
  lastSongId: string;

  homeBannerType: "dynamic" | "albumCover" | "cleanBlack" | "none";
  mediaCardBackground: "solid" | "glassy" | "oledFlat";
  homeLayoutMode: "compact" | "balanced" | "bigHero";
  libraryRowStyle: "compactRows" | "comfyRows" | "coverCards" | "listOnly";
  sidebarBehavior: "fixed" | "slim" | "hover";
  playerBackgroundStyle: "flat" | "coverBlur" | "oledBlack";
  starsIntensity: "off";
  blurEffects: "normal";

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

export type CustomThemeColorKey =
  | "customThemeColor"
  | "customThemeColor2"
  | "customThemeBackground"
  | "customThemeSurface"
  | "customThemeText"
  | "customThemeHighlight"
  | "customThemeProgress";

export type CustomThemeColorPatch = Pick<Settings, CustomThemeColorKey>;

export type CustomThemePreset = {
  id: string;
  name: string;
  note: string;
  colors: CustomThemeColorPatch;
  custom?: boolean;
  createdAt?: number;
};


export type DownloadResult = {
  ok: boolean;
  url?: string;
  filePath?: string;
  filename?: string;
  sizeBytes?: number;
  error?: string;
  source?: "youtube" | "spotify" | string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
  provider?: string;
  providerUrl?: string;
  matchedTitle?: string;
  matchedArtist?: string;
  matchedDurationMs?: number;
  matchScore?: number;
  matchOk?: boolean;
  importedToLibrary?: boolean;
  librarySongId?: string;
  statusLabel?: string;
};

export type DownloadQueueItem = {
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
  source?: "youtube" | "spotify" | string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
  providerUrl?: string;
  matchScore?: number;
  importedToLibrary?: boolean;
  librarySongId?: string;
  statusLabel?: string;
};

export type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  durationMs?: number;
  albumName?: string;
  coverUrl?: string;
  albumCoverUrl?: string;
  spotifyCoverUrl?: string;
  spotifyUrl?: string;
  isrc?: string;
  downloadStatus?: "ready" | "queued" | "downloading" | "done" | "failed";
  downloadError?: string;
  downloadMessage?: string;
  downloadedFilePath?: string;
  importedToLibrary?: boolean;
  librarySongId?: string;
  matchScore?: number;
  providerUrl?: string;
};

export type AutoUpdateEvent = {
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

export type UpdatePromptState = {
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

export const defaultUpdatePrompt: UpdatePromptState = {
  visible: false,
  status: "idle",
  version: "",
  percent: 0,
  message: "",
  error: ""
};

export function friendlyUpdateError(error?: unknown) {
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

export function updateStatusLabel(status: UpdatePromptState["status"]) {
  if (status === "checking") return "checking";
  if (status === "available") return "update available";
  if (status === "downloading") return "downloading";
  if (status === "downloaded") return "ready to restart";
  if (status === "latest") return "up to date";
  if (status === "error") return "check failed";
  if (status === "dev") return "installed app only";
  return "ready";
}

export const UPDATE_LEAVE_ALONE_PREFIX = "localitfy.updateLeaveAloneVersion.";

export function updateLeaveAloneKey(version: string) {
  return `${UPDATE_LEAVE_ALONE_PREFIX}${version || "latest"}`;
}

export function updateWasLeftAlone(version: string) {
  if (!version) return false;
  try {
    return window.localStorage.getItem(updateLeaveAloneKey(version)) === "1";
  } catch {
    return false;
  }
}



export function updateRibbonTitle(prompt: UpdatePromptState) {
  const version = prompt.version || APP_VERSION;

  if (prompt.status === "available") return `new update · Localtify ${version} is ready`;
  if (prompt.status === "downloaded") return `update ready · restart to install ${version}`;
  if (prompt.status === "downloading") return `downloading update · ${Math.round(clamp(prompt.percent, 0, 100))}%`;
  if (prompt.status === "latest") return "Localtify is up to date.";
  if (prompt.status === "error") return "Update check failed.";
  if (prompt.status === "dev") return "installed app required · auto update only works in the packaged app.";
  if (prompt.status === "checking") return "Checking for updates...";
  return "Localtify update";
}

export const settingsCategorySpring = { type: "spring", stiffness: 430, damping: 36, mass: 0.68 } as const;
export const updateRibbonEnterSpring = { type: "spring", stiffness: 500, damping: 35, mass: 0.58 } as const;
export const updateRibbonChildSpring = { type: "spring", stiffness: 520, damping: 34, mass: 0.55 } as const;


export const APP_VERSION = "0.4.0";
export const localtifyLogo = new URL("./assets/logo.png", import.meta.url).href;
export const loadingScreenGif = new URL("./assets/loading-screen.gif", import.meta.url).href;
export const screensaverImage = new URL("./assets/screensaver.jpg", import.meta.url).href;
export const yukariUpdateImage = new URL("./assets/yukari.png", import.meta.url).href;
export const BOOT_MIN_VISIBLE_MS = 650;
export const BOOT_STEPS = [
  { label: "settings", detail: "theme, volume, Discord, and app preferences" },
  { label: "library", detail: "songs, folders, durations, and saved order" },
  { label: "playlists", detail: "mixes, song order, covers, and totals" },
  { label: "covers", detail: "pixel art, album art, and ambience colors" },
  { label: "player", detail: "queue, last song, progress, and audio state" },
  { label: "interface", detail: "home, settings, animations, and shortcuts" }
] as const;
export const INITIAL_LIBRARY_RENDER_LIMIT = 42;
export const LIBRARY_RENDER_BATCH_SIZE = 48;
export const HOME_GRID_RENDER_LIMIT = 42;
export const CUSTOM_THEME_COMMIT_DELAY_MS = 680;
export const WHATS_NEW_SEEN_KEY = "localitfy.whatsNewSeenVersion";

export type AppToastKind = "info" | "success" | "work" | "error";

export function cleanToastCopy(message: string, kind: AppToastKind) {
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
    .replace(/\s*[��-]\s*check (?:the )?(?:terminal|console).*$/i, "")
    .replace(/\s*safely\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

export const whatsNewItems = [
  "0.3.9 polishes Albums V2 so custom albums, album shelves, detail pages, and cover actions feel built in",
  "Downloads, missing-file recovery, playback stability, and metadata cleanup were tightened for daily use",
  "Settings, onboarding, sidebar behavior, cover tools, and theme editing were cleaned up without redesigning the whole app",
  "Linux now has clearer AppImage install copy and is treated as an official 0.3.9 release target",
  "The release focuses on stability, lower UI lag, fewer CSS conflicts, and making the 0.3.7 foundation feel finished"
];
export const V013_DEFAULTS_KEY = "localitfy.v013.defaultsApplied";
export const START_WITH_WINDOWS_DEFAULT_KEY = "localitfy.v029.startWithWindowsDefaultApplied";
export const ARCADE_GHOST_UNLOCKED_KEY = "localitfy.secret.arcadeGhostUnlocked";
export const PIXEL_COVER_FAVORITES_STORAGE_KEY = "localitfy.pixelCoverFavorites";
export const PIXEL_COVER_EXCLUDED_STORAGE_KEY = "localitfy.pixelCoverExcluded";
export const CUSTOM_THEME_LIBRARY_STORAGE_KEY = "localitfy.customThemeLibrary.v1";

export const V013_RELEASE_DEFAULTS: Partial<Settings> = {
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
  catBuddyEnabled: false,
  showHeroBadge: true,
  simpleMode: false,
};


export const themes = [
  { id: "mint", name: "mint berry", note: "black and fresh", mood: "clean + calm", emoji: "??" },
  { id: "bubblegum", name: "bubblegum", note: "pink blue pop", mood: "cute UI", emoji: "??" },
  { id: "berry", name: "berry", note: "deep purple glow", mood: "soft night", emoji: "??" },
  { id: "midnight", name: "midnight", note: "deep blue OLED", mood: "late night", emoji: "??" },
  { id: "mono", name: "mono", note: "clean white", mood: "simple focus", emoji: "?" },
  { id: "stars", name: "stars", note: "drifting sparkle field", mood: "sparkly night", emoji: "?" },
] as const;

export const THEME_ID_SET = new Set<string>(themes.map((theme) => theme.id));
export const RETIRED_ANIMATED_THEME_IDS = new Set(["vaporGlass", "nightTrain"]);

export function isRetiredAnimatedThemeId(value: unknown) {
  return RETIRED_ANIMATED_THEME_IDS.has(String(value || ""));
}

export function isThemeId(value: string): value is ThemeId {
  return THEME_ID_SET.has(value);
}

export function normalizeThemeId(value: unknown, fallback: ThemeId = "mint"): ThemeId {
  const rawTheme = String(value || "").trim();

  if (isRetiredAnimatedThemeId(rawTheme)) return "stars";
  if (rawTheme === "oled") return "mint";

  return isThemeId(rawTheme) ? rawTheme : fallback;
}

export const THEME_SWATCH_COLORS: Record<ThemeId, string> = {
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

export const discordStyleOptions: Array<{
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

export const discordArtModeOptions: Array<{
  id: DiscordArtMode;
  name: string;
  note: string;
}> = [
  { id: "randomPixel", name: "Pixel shuffle", note: "Use a random pixel art image for each song." },
  { id: "albumCover", name: "Song cover", note: "Use the current song cover when possible." },
  { id: "logo", name: "Logo only", note: "Use the localtify logo." },
  { id: "none", name: "No large image", note: "Show no large image." }
];

export const discordCleanupOptions: Array<{
  id: DiscordTitleCleanup;
  name: string;
  note: string;
}> = [
  { id: "off", name: "Off", note: "keep original" },
  { id: "light", name: "Light", note: "clean filename only" },
  { id: "heavy", name: "Heavy", note: "remove audio junk" }
];

export const discordSecondLineOptions: Array<{
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


export type PixelArtAsset = {
  file: string;
  label: string;
  discordKey: string;
};

export type RuntimePixelArtAsset = PixelArtAsset & {
  path?: string;
  url?: string;
};

export type PixelArtBridgeAsset = {
  name?: string;
  key?: string;
  path?: string;
  url?: string;
};

export const LOCALITFY_DOWNLOAD_URL = "https://github.com/meshahid973/localitfy/releases/latest";

export function buildDiscordSongSearchUrl(title: string, artist: string) {
  const query = [artist, title]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!query) return LOCALITFY_DOWNLOAD_URL;

  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export const DISCORD_HASH_ASSET_KEYS = [
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

export const DISCORD_NAMED_ASSET_KEYS = [
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

export const DISCORD_ASSET_KEYS = [...DISCORD_NAMED_ASSET_KEYS, ...DISCORD_HASH_ASSET_KEYS] as const;

export const discordKeyFromFileName = (file: string) => {
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

export const DISCORD_LOGO_ASSET = "earthglow";

export const PIXEL_ART_LIBRARY: PixelArtAsset[] = [
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

export function normalizePixelArtFileName(asset: PixelArtBridgeAsset, index: number) {
  const pathName = String(asset.path || "").split(/[\\/]/).pop() || "";
  const name = String(asset.name || asset.key || "pixel").trim();
  return pathName || `${name || `pixel-${index + 1}`}.jpg`;
}

export const pixelArtUrl = (file: string) => {
  const encoded = encodeURIComponent(file);
  if (typeof window !== "undefined" && window.location?.href) {
    try {
      // Use a relative URL so packaged file:// builds look beside dist/index.html,
      // while dev still resolves to http://localhost:5173/pixelart/...
      return new URL(`pixelart/${encoded}`, window.location.href).toString();
    } catch {
      return `pixelart/${encoded}`;
    }
  }
  return `pixelart/${encoded}`;
};

export const DEFAULT_RUNTIME_PIXEL_ART_ASSETS: RuntimePixelArtAsset[] = PIXEL_ART_LIBRARY.map((asset) => ({
  ...asset,
  url: pixelArtUrl(asset.file)
}));

export const PIXEL_ART_CACHE_TTL_MS = 30 * 60 * 1000;

export let runtimePixelArtAssetsCache: RuntimePixelArtAsset[] = DEFAULT_RUNTIME_PIXEL_ART_ASSETS;

export function getCachedRuntimePixelArtAssets() {
  return runtimePixelArtAssetsCache.length ? runtimePixelArtAssetsCache : DEFAULT_RUNTIME_PIXEL_ART_ASSETS;
}

export function buildRuntimePixelArtAssets(assets?: PixelArtBridgeAsset[]): RuntimePixelArtAsset[] {
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

  const finalAssets = runtimeAssets.length ? runtimeAssets : DEFAULT_RUNTIME_PIXEL_ART_ASSETS;
  runtimePixelArtAssetsCache = finalAssets;
  return finalAssets;
}

export const stableHash = (input: string) => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};


export const seededUnit = (seed: number, salt: number) => {
  const raw = Math.sin((seed + salt * 1009) * 12.9898) * 43758.5453123;
  return raw - Math.floor(raw);
};

export function buildRandomStarLayer(seedKey: string, count: number, palette: string[], minSize = 0.85, maxSize = 1.75) {
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

export function buildAnimatedThemeVisualStyle(theme: ThemeId, seedKey: string) {
  if (theme !== "stars") return {} as CSSProperties;

  const seed = stableHash(`${seedKey}:stars:v142`);
  const driftDuration = 72 + seededUnit(seed, 1) * 24;
  const sparkleDuration = 3.4 + seededUnit(seed, 2) * 1.8;
  const shimmerDuration = 8.8 + seededUnit(seed, 3) * 2.2;
  const sweepDuration = 22 + seededUnit(seed, 4) * 8;

  return {
    "--localtify-stars-field-a": buildRandomStarLayer(`${seedKey}:stars:v142:slow`, 42, ["255, 255, 255", "215, 213, 255", "143, 220, 255"], 0.7, 2.05),
    "--localtify-stars-field-b": buildRandomStarLayer(`${seedKey}:stars:v142:sparkle`, 24, ["255, 255, 255", "255, 167, 248", "148, 234, 255"], 0.85, 2.55),
    "--localtify-stars-field-c": buildRandomStarLayer(`${seedKey}:stars:v142:tiny`, 34, ["255, 255, 255", "190, 176, 255", "134, 241, 255"], 0.42, 1.2),
    "--localtify-stars-drift-duration": `${driftDuration.toFixed(2)}s`,
    "--localtify-stars-sparkle-duration": `${sparkleDuration.toFixed(2)}s`,
    "--localtify-stars-shimmer-duration": `${shimmerDuration.toFixed(2)}s`,
    "--localtify-stars-sweep-duration": `${sweepDuration.toFixed(2)}s`,
    "--localtify-stars-drift-x": `${(3.2 + seededUnit(seed, 5) * 3.4).toFixed(2)}vw`,
    "--localtify-stars-drift-y": `${(1.4 + seededUnit(seed, 6) * 2.2).toFixed(2)}vh`
  } as CSSProperties;
}


export const songSignature = (song?: Song | null) => {
  if (!song) return "localitfy-idle";
  return [song.id, song.title, song.artist, song.album, song.duration, song.filePath]
    .filter(Boolean)
    .join("::")
    .toLowerCase();
};

export const pixelArtForSong = (song?: Song | null): RuntimePixelArtAsset => {
  const pool = getCachedRuntimePixelArtAssets();
  const index = stableHash(songSignature(song)) % Math.max(1, pool.length);
  return pool[index] || DEFAULT_RUNTIME_PIXEL_ART_ASSETS[0];
};

export const nextPixelArtForSong = (song?: Song | null): RuntimePixelArtAsset => {
  const pool = getCachedRuntimePixelArtAssets();
  const index = (stableHash(`${songSignature(song)}::next`) + 7) % Math.max(1, pool.length);
  return pool[index] || DEFAULT_RUNTIME_PIXEL_ART_ASSETS[0];
};

export function runtimePixelArtImageUrl(asset?: RuntimePixelArtAsset | PixelArtAsset | null) {
  if (!asset) return "";
  const runtime = asset as RuntimePixelArtAsset;
  return String(runtime.url || (runtime.file ? pixelArtUrl(runtime.file) : "")).trim();
}


export function cleanStringList(value: unknown) {
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

export function getPixelArtAssetKey(asset: RuntimePixelArtAsset) {
  return String(asset.path || asset.url || (asset.file ? pixelArtUrl(asset.file) : asset.label) || "").trim();
}

export function getSongCoverUsageKeys(song: Song) {
  return cleanStringList([
    song.coverPath,
    song.coverUrl,
    song.coverUrl ? song.coverUrl.split(/[\\/]/).pop() : "",
    song.coverPath ? song.coverPath.split(/[\\/]/).pop() : ""
  ]);
}

export function getPixelAssetMoodTags(asset: RuntimePixelArtAsset): CoverMood[] {
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

export function coverMoodName(mood: CoverMood) {
  return coverMoodOptions.find((option) => option.id === mood)?.label || mood;
}


export const defaultSettings: Settings = {
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
  catBuddyEnabled: false,
  showHeroBadge: true,
  simpleMode: false,
  lastSongId: "",

  homeBannerType: "dynamic",
  mediaCardBackground: "glassy",
  homeLayoutMode: "balanced",
  libraryRowStyle: "comfyRows",
  sidebarBehavior: "fixed",
  playerBackgroundStyle: "coverBlur",
  homeHeroCoverBrightness: 1,
  starsIntensity: "off",
  blurEffects: "normal",

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

export function normalizeUiText(text: string) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF\u2060\u034F]/g, "")
    .replace(/\p{Cf}/gu, "");
}

export function lower(text: string) {
  return normalizeUiText(text).toLowerCase();
}

export function normalizeHexColor(value: string, fallback = "#8dffce") {
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

export function normalizeHexInputDraft(value: string) {
  const raw = String(value || "").trim().replace(/[^0-9a-f#]/gi, "");
  const withoutHashes = raw.replace(/#/g, "").slice(0, 6);
  return `#${withoutHashes}`;
}

export function isCompleteHexColorInput(value: string) {
  const raw = String(value || "").trim();
  return /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw);
}

export function normalizeCoverColorSyncMode(value: unknown): CoverColorSyncMode {
  const safeValue = String(value || "normal").trim() as CoverColorSyncMode;
  return coverColorSyncOptions.some((option) => option.id === safeValue) ? safeValue : "normal";
}

export function hexToRgbParts(value: string, fallback = "#8dffce") {
  const hex = normalizeHexColor(value, fallback).slice(1);
  const number = Number.parseInt(hex, 16);

  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255
  };
}

export function hexToRgbString(value: string, fallback = "#8dffce") {
  const { r, g, b } = hexToRgbParts(value, fallback);
  return `${r}, ${g}, ${b}`;
}

export function hexToRgbaString(value: string, fallback = "#8dffce", alpha = 1) {
  return `rgba(${hexToRgbString(value, fallback)}, ${alpha})`;
}

export type ThemeVisualPalette = {
  accent: string;
  accent2: string;
  background: string;
  surface: string;
  text: string;
  highlight: string;
  progress?: string;
};

export const THEME_PRESET_COLORS: Record<ThemeId, ThemeVisualPalette> = {
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

export function makeThemePresetStyle(themeId: ThemeId): CSSProperties {
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


export function makeCustomThemeColors(input: Partial<Record<CustomThemeColorKey, string>> = {}): CustomThemeColorPatch {
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

export function getCustomThemeColorPatch(source: Partial<Settings>): CustomThemeColorPatch {
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

export const BUILT_IN_CUSTOM_THEME_PRESETS: CustomThemePreset[] = [
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
    id: "dracula",
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

export function cleanCustomThemePreset(value: unknown): CustomThemePreset | null {
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

export function readSavedCustomThemePresets() {
  const raw = readLocalJson<unknown[]>(CUSTOM_THEME_LIBRARY_STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => cleanCustomThemePreset(item))
    .filter(Boolean) as CustomThemePreset[];
}

export function writeSavedCustomThemePresets(presets: CustomThemePreset[]) {
  writeLocalJson(CUSTOM_THEME_LIBRARY_STORAGE_KEY, presets.slice(0, 24));
}

export function randomThemeHex() {
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

export function collapseSpaces(text: string) {
  return normalizeUiText(text).replace(/\s+/g, " ").trim();
}

export function removeUrlNoise(text: string) {
  return collapseSpaces(
    text
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/www\.\S+/gi, " ")
      .replace(/(?:youtube|youtu\.be|soundcloud|spotify|bandcamp|tiktok|instagram|discord)\S*/gi, " ")
  );
}

export function stripAudioExtension(fileName = "") {
  return normalizeUiText(fileName)
    .replace(/\.(mp3|flac|wav|m4a|aac|ogg|opus|webm|mp4|aiff|alac)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripTrackNumber(text: string) {
  return collapseSpaces(
    text
      .replace(/^\s*(?:track\s*)?\d{1,3}\s*[.\-_)]+\s*/i, "")
      .replace(/^\s*cd\s*\d+\s*[.\-_)]+\s*/i, "")
  );
}

export function stripDuplicateCopySuffix(text: string) {
  let next = text;
  for (let index = 0; index < 5; index += 1) {
    const cleaned = next
      .replace(/\s*\((?:copy|duplicate|\d+)\)\s*$/gi, "")
      .replace(/\s*\[(?:copy|duplicate|\d+)\]\s*$/gi, "")
      .replace(/\s+-\s+copy\s*$/gi, "")
      .replace(/\s+copy\s*$/gi, "")
      .trim();

    if (cleaned === next) break;
    next = cleaned;
  }

  return next;
}

export function removeBracketNoise(text: string, strength: DiscordTitleCleanup = "heavy") {
  const noiseWords =
    strength === "light"
      ? "official|audio|video|lyrics?|lyric video|visualizer|hq|hd|4k|320kbps"
      : "official|audio|video|lyrics?|lyric video|visualizer|hq|hd|4k|320kbps|slowed|reverb|slowed and reverb|sped up|nightcore|bass boosted|extended|remaster(?:ed)?|clean|edit|loop|tik ?tok|full song";

  const noisePattern = new RegExp(`\\s*[\\[(][^\\])]*(?:${noiseWords})[^\\])]*[\\])]`, "gi");
  return text.replace(noisePattern, " ");
}

export function removeLooseNoiseWords(text: string, strength: DiscordTitleCleanup = "heavy") {
  if (strength !== "heavy") return collapseSpaces(text);

  return collapseSpaces(
    text
      .replace(/\b(?:official\s+music\s+video|official\s+video|official\s+audio|lyric\s+video|lyrics?\s+video)\b/gi, " ")
      .replace(/\b(?:visualizer|hq|hd|4k|320kbps|full\s+song)\b/gi, " ")
      .replace(/\b(?:slowed\s*(?:and|&)?\s*reverb|slowedandreverb|slowedreverb|sped\s*up|bass\s*boosted|nightcore|remaster(?:ed)?|extended\s+mix)\b/gi, " ")
      .replace(/\b(?:from\s+tiktok|tiktok\s+version|youtube\s+rip)\b/gi, " ")
  );
}

export function cleanupSongTitle(rawTitle: string, strength: DiscordTitleCleanup = "heavy") {
  let text = removeUrlNoise(normalizeUiText(rawTitle || "untitled"));

  text = stripAudioExtension(text)
    .replace(/[_]+/g, " ")
    .replace(/[��-]+/g, " - ")
    .replace(/[��]/g, '"')
    .replace(/[��]/g, "'");

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
    .replace(/\s+[��-]\s*$/g, " ");

  return collapseSpaces(text) || "untitled";
}

export function shortenWords(text: string, maxWords = 7) {
  const words = collapseSpaces(text).split(" ").filter(Boolean);
  if (!words.length) return "untitled";
  return words.slice(0, maxWords).join(" ");
}

export function prettyTitle(rawTitle: string, maxWords = 7) {
  return lower(shortenWords(cleanupSongTitle(rawTitle, "heavy"), maxWords));
}

export function heroTitleDensityClass(title: string) {
  const clean = collapseSpaces(title || "");
  const letters = clean.replace(/[^a-z0-9]/gi, "");

  if (letters.length <= 5) return "heroTitleTiny";
  if (letters.length <= 11) return "heroTitleShort";
  if (letters.length >= 32) return "heroTitleLong";

  return "heroTitleNormal";
}

export function previewTitle(rawTitle: string, cleanup: DiscordTitleCleanup, maxWords = 7) {
  if (cleanup === "off") {
    return lower(shortenWords(collapseSpaces(rawTitle || "local song"), maxWords));
  }

  if (cleanup === "light") {
    return lower(shortenWords(cleanupSongTitle(rawTitle || "local song", "light"), maxWords));
  }

  return lower(shortenWords(cleanupSongTitle(rawTitle, "heavy"), maxWords));
}

export function compactSongKey(text: string) {
  return lower(cleanupSongTitle(text || "", "heavy"))
    .replace(/\b(official|audio|lyrics|lyric|video|visualizer|remix|remastered|slowed|reverb|sped|nightcore|lofi)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type SongSearchEntry = {
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

export type SearchQueryInfo = {
  raw: string;
  clean: string;
  compact: string;
  terms: string[];
};

export function normalizeSearchText(value: unknown) {
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

export function splitSearchTerms(query: string) {
  return normalizeSearchText(query).split(" ").filter(Boolean).slice(0, 14);
}

export function prepareSearchQuery(query: string): SearchQueryInfo {
  const clean = normalizeSearchText(query);

  return {
    raw: query,
    clean,
    compact: compactSongKey(clean),
    terms: clean ? splitSearchTerms(clean) : []
  };
}

export function fileNameFromPath(filePath = "") {
  return String(filePath || "").split(/[\\/]/).pop() || "";
}

export function cleanMetadataField(value: unknown, fallback: string) {
  const raw = removeUrlNoise(String(value ?? ""));
  const cleaned = cleanupSongTitle(raw, "light")
    .replace(/\b(?:unknown|n\/a|null|undefined)\b$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return lower(cleaned || fallback);
}

export function looksUnknownMeta(value: unknown) {
  const text = normalizeSearchText(value);
  return !text || text === "unknown" || text === "unknown artist" || text === "unknown album" || text === "n a" || text === "na" || text === "null" || text === "undefined";
}

export type SmartSongMetadata = {
  title: string;
  artist: string;
  album: string;
};

export function cleanArtistName(value: unknown) {
  return cleanMetadataField(value, "unknown artist")
    .replace(/^by\s+/i, "")
    .replace(/\s+(?:official|topic|vevo)$/i, "")
    .trim() || "unknown artist";
}

export function cleanTrackName(value: unknown, fallback = "untitled") {
  return cleanMetadataField(value, fallback)
    .replace(/^[-��|/]+\s*/, "")
    .replace(/\s*[-��|/]+$/, "")
    .trim() || fallback;
}

export function scoreArtistGuess(text: string) {
  const clean = normalizeSearchText(text);
  let score = 0;
  if (/\b(feat|ft|prod|records|music|official|topic|vevo)\b/i.test(clean)) score += 2;
  if (clean.split(" ").length <= 5) score += 1;
  if (/^[a-z0-9 ._&'!]+$/i.test(text)) score += 1;
  return score;
}

export function splitArtistTitleCandidate(value: string) {
  const base = cleanupSongTitle(stripAudioExtension(value), "light");
  const separators = [" - ", " � ", " � ", " | ", " / ", " ~ "];

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

export function smartSongMetadata(song: Partial<Song> & Record<string, any>, index: number): SmartSongMetadata {
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

export function safeNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

export function sanitizeSongRecord(song: Partial<Song> & Record<string, any>, index: number): Song {
  const metadata = smartSongMetadata(song, index);
  const sourcePath = String(song.filePath || song.path || "");
  const rawRuntimeUrl = String(song.playbackUrl || song.url || "");
  // If a real file path exists, discard backend/database URLs here.
  // Playback URLs are generated lazily by the main process from filePath.
  const sourceUrl = sourcePath ? "" : rawRuntimeUrl;
  const backendFileExists =
    typeof song.fileExists === "boolean"
      ? song.fileExists
      : typeof song.exists === "boolean"
        ? song.exists
        : undefined;

  return {
    id: String(song.id || makeLocalId("song")),
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    filePath: sourcePath,
    url: sourceUrl,
    fileExists: backendFileExists,
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

export function sanitizeSongList(input: unknown): Song[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Partial<Song> & Record<string, any> => Boolean(item && typeof item === "object"))
    .map((song, index) => sanitizeSongRecord(song, index));
}

export function getMetadataRepairPatch(song: Song): Partial<Song> {
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

export function buildSongSearchEntry(song: Song): SongSearchEntry {
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

export function scoreSongSearch(entry: SongSearchEntry, search: SearchQueryInfo) {
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

export function rankSongsForSearch(entries: SongSearchEntry[], query: string) {
  const search = prepareSearchQuery(query);
  if (!search.clean) return entries.map((entry) => entry.song);

  return entries
    .map((entry, index) => ({ entry, index, score: scoreSongSearch(entry, search) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.entry.song);
}

export function prettyMeta(text: string) {
  const value = lower(collapseSpaces(text));
  return value || "unknown artist";
}

function displaySongWordCountV444(value: string) {
  return collapseSpaces(value).split(/\s+/).filter(Boolean).length;
}

function looksLikeArtistInTitleSlotV444(title: string) {
  const value = lower(collapseSpaces(title));
  if (!value || value === "unknown artist") return false;

  return /^(dj|mc|lil|yung|young|mr|mrs|ms|dr)\b/.test(value)
    || (/^[a-z0-9_.]+(?:\s+[a-z0-9_.]+)?$/i.test(value) && displaySongWordCountV444(value) <= 2);
}

function looksLikeSongInArtistSlotV444(artist: string) {
  const value = lower(collapseSpaces(artist));
  if (!value || value === "unknown artist" || value === "unknown") return false;

  return displaySongWordCountV444(value) >= 3
    || /\b(the|you|your|me|my|love|said|hero|night|ost|collection|theme|song|slowed|remix|edit)\b/.test(value);
}

function shouldSwapDisplayTitleArtistV444(song: Pick<Song, "title" | "artist">) {
  const rawTitle = collapseSpaces(song.title || "");
  const rawArtist = collapseSpaces(song.artist || "");
  if (!rawTitle || !rawArtist) return false;

  const cleanArtist = lower(rawArtist);
  if (cleanArtist === "unknown" || cleanArtist === "unknown artist") return false;

  return looksLikeArtistInTitleSlotV444(rawTitle) && looksLikeSongInArtistSlotV444(rawArtist);
}

function displaySongTitleV444(song: Pick<Song, "title" | "artist">, maxWords = 7) {
  return shouldSwapDisplayTitleArtistV444(song)
    ? prettyTitle(song.artist, maxWords)
    : prettyTitle(song.title, maxWords);
}

function displaySongArtistV444(song: Pick<Song, "title" | "artist">) {
  return shouldSwapDisplayTitleArtistV444(song)
    ? prettyMeta(song.title)
    : prettyMeta(song.artist);
}

function displaySongPickerSublineV444(song: Pick<Song, "title" | "artist">) {
  const artist = displaySongArtistV444(song);
  if (!artist || artist === "unknown artist") return "Pick a playlist or make a new one.";
  return `${artist} � Pick a playlist or make a new one.`;
}

export function discordArtist(text: string) {
  const value = prettyMeta(text);
  if (!value || value === "unknown" || value === "unknown artist") return "coderpixel :p";
  return value;
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getGreeting(hour: number) {
  if (hour < 5) return "good night";
  if (hour < 12) return "good morning";
  if (hour < 17) return "good afternoon";
  if (hour < 22) return "good evening";
  return "late night vibes";
}

export function toCssUrl(value?: string | null): string {
  if (!value) return "none";
  return `url(${JSON.stringify(value)})`;
}

export function getAmbientStyle(coverUrl?: string | null): CSSProperties | undefined {
  if (!coverUrl) return undefined;

  return {
    "--cover-url": toCssUrl(coverUrl),
    "--cover-art-url": toCssUrl(coverUrl)
  } as CSSProperties;
}


export function isRendererSafeImageUrl(value?: string | null) {
  if (!value) return false;
  return /^(?:data:image\/|blob:|https?:\/\/|localtify-media:\/\/|\/|pixelart\/)/i.test(String(value).trim());
}

export function getRendererSafeImageUrl(value?: string | null) {
  const source = String(value || "").trim();
  return isRendererSafeImageUrl(source) ? source : "";
}

export function getSongAmbientSource(song?: Song | null) {
  if (!song) return "";

  const directCover = getRendererSafeImageUrl(song.coverUrl);
  if (directCover) return directCover;

  const savedCover = getRendererSafeImageUrl(song.coverPath);
  if (savedCover) return savedCover;

  const stableFallback = pixelArtForSong(song);
  return runtimePixelArtImageUrl(stableFallback);
}


export type CoverAverageStyle = CSSProperties & {
  "--cover-rgb"?: string;
  "--player-ambient-rgb"?: string;
  "--active-cover-rgb"?: string;
  "--cover-average"?: string;
};

export const coverAverageColorCache = new Map<string, CoverAverageStyle>();
export const fastAverageColor = typeof window !== "undefined" ? new FastAverageColor() : null;

export function buildCoverAverageStyle(hex: string): CoverAverageStyle {
  const safeHex = normalizeHexColor(hex, "#8dffce");
  const rgb = hexToRgbString(safeHex, "#8dffce");

  return {
    "--cover-rgb": rgb,
    "--player-ambient-rgb": rgb,
    "--active-cover-rgb": rgb,
    "--cover-average": safeHex
  } as CoverAverageStyle;
}

export function useCoverAverageStyle(source: string, enabled: boolean) {
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

type CoverImagePriority = "auto" | "high" | "low";

export 
type LocaltifyStateCardTone = "info" | "warning" | "error" | "success";

function LocaltifyStateCard({
  tone = "info",
  eyebrow,
  title,
  message,
  detail,
  actions,
  centered = false,
  cute = false,
  badge = "♪"
}: {
  tone?: LocaltifyStateCardTone;
  eyebrow: string;
  title: string;
  message: string;
  detail?: string;
  actions?: ReactNode;
  centered?: boolean;
  cute?: boolean;
  badge?: string;
}) {
  return (
    <div className={`localtifyStateCardV373 ${tone}${centered ? " localtifyStateCardCenteredV466" : ""}${cute ? " localtifyStateCardCuteV466" : ""}`}>
      {cute ? (
        <>
          <div className="localtifyEmptyArtV466" aria-hidden="true">
            <span className="localtifyEmptyImageShellV466">
              <img src={EMPTY_STATE_IMAGE_SRC} alt="" draggable={false} />
            </span>
          </div>
          <p className="localtifyEmptyCaptionV467">my team couldn't find anything here!!</p>
          {actions ? <div className="localtifyStateActionsV373 localtifyEmptyActionsV467">{actions}</div> : null}
        </>
      ) : (
        <>
          <span className="localtifyStateIconV373" aria-hidden="true">
            <LocaltifyStateToneIcon tone={tone} />
          </span>

          <div className="localtifyStateCopyV373">
            <p className="eyebrow">{eyebrow}</p>
            <strong>{title}</strong>
            <span>{message}</span>
            {detail ? <small>{detail}</small> : null}
            {actions ? <div className="localtifyStateActionsV373">{actions}</div> : null}
          </div>
        </>
      )}
    </div>
  );
}

function getCardCoverUrl(song?: Song | null) {
  return getRendererSafeImageUrl(song?.coverThumbUrl || song?.coverThumbnailUrl || song?.thumbnailUrl || song?.coverUrl || song?.coverPath || "");
}

function getFullCoverUrl(song?: Song | null) {
  return getRendererSafeImageUrl(song?.coverFullUrl || song?.coverUrl || song?.coverPath || "");
}


function getCardCoverCssUrl(song?: Song | null) {
  const coverUrl = getCardCoverUrl(song);
  if (!coverUrl) return "none";
  return `url("${coverUrl.replace(/["\\]/g, "\\$&")}")`;
}

export function Cover({ song, className, priority = "auto" }: { song: Song | null; className: string; priority?: CoverImagePriority }) {
  const [failedSources, setFailedSources] = useState<Record<string, boolean>>({});
  const [imageReady, setImageReady] = useState(false);
  const isImmediateCover = priority === "high" || (priority === "auto" && /\b(heroArt|smallArt|importCoverArt|editorCover)\b/.test(className));
  const coverLoadingMode = isImmediateCover ? "eager" : "lazy";
  const coverFetchPriority = isImmediateCover ? "high" : "low";
  const coverIntrinsicSize = isImmediateCover ? 512 : 260;

  const directCover = isImmediateCover ? getFullCoverUrl(song) : getCardCoverUrl(song);
  const savedCover = String(song?.coverPath || "").trim();
  const savedCoverSrc = getRendererSafeImageUrl(savedCover);
  const fallbackAsset = song ? pixelArtForSong(song) : null;
  const backupFallbackAsset = song ? nextPixelArtForSong(song) : null;
  const fallbackSrc = runtimePixelArtImageUrl(fallbackAsset);
  const backupFallbackSrc = runtimePixelArtImageUrl(backupFallbackAsset);

  const sourceCandidates = [directCover, savedCoverSrc, fallbackSrc, backupFallbackSrc]
    .map((source) => source.trim())
    .filter(Boolean);
  const coverSrc = sourceCandidates.find((source) => !failedSources[source]) || "";
  const hasCover = Boolean(coverSrc);
  const fallback = song ? prettyTitle(song.title, 1).slice(0, 1) || "?" : "?";
  const style = hasCover ? ({ "--cover-art-url": toCssUrl(coverSrc), "--cover-url": toCssUrl(coverSrc) } as CSSProperties) : undefined;

  useEffect(() => {
    setFailedSources({});
    setImageReady(false);
  }, [song?.id, song?.coverUrl, song?.coverThumbUrl, song?.coverThumbnailUrl, song?.thumbnailUrl, song?.coverPath]);

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
          width={coverIntrinsicSize}
          height={coverIntrinsicSize}
          draggable={false}
          loading={coverLoadingMode}
          decoding="async"
          fetchPriority={coverFetchPriority}
          referrerPolicy="no-referrer"
          onLoad={() => setImageReady(true)}
          onError={() => {
            setImageReady(false);
            setFailedSources((old) => ({ ...old, [coverSrc]: true }));
          }}
        />
      ) : null}
    </div>
  );
}


export type LocalAlbumEntry = {
  id: string;
  title: string;
  artist: string;
  albumArtist?: string;
  year?: string | null;
  coverSong: Song | null;
  customCoverUrl?: string | null;
  songs: Song[];
  trackCount: number;
  totalDuration: number;
  latestAdded: number;
};

const UNKNOWN_ALBUM_NAMES = new Set([
  "",
  "local files",
  "unknown",
  "unknown album",
  "untitled",
  "untitled album",
  "downloads",
  "downloaded music"
]);

function normalizeAlbumValue(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function albumKeyPart(value: unknown) {
  return normalizeAlbumValue(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function isUsefulAlbumName(value: unknown) {
  const normalized = normalizeAlbumValue(value).toLowerCase();
  return normalized.length > 0 && !UNKNOWN_ALBUM_NAMES.has(normalized);
}

function getAlbumArtist(song: Song) {
  return normalizeAlbumValue((song as any).albumArtist || song.artist || "unknown artist") || "unknown artist";
}

function getAlbumYear(song: Song) {
  const raw = String((song as any).year || (song as any).date || "").trim();
  const match = raw.match(/(?:19|20)\d{2}/);
  return match?.[0] ?? null;
}

function getSongAddedTime(song: Song) {
  const addedAt = Date.parse(String(song.dateAdded || ""));
  return Number.isFinite(addedAt) ? addedAt : 0;
}

function pickAlbumCoverSong(songs: Song[]) {
  return songs.find((song) => Boolean(getCardCoverUrl(song) || getRendererSafeImageUrl(song.coverPath))) || songs[0] || null;
}

function makeAlbumCoverSong(coverUrl: string, title: string, artist: string, seedSong?: Song | null): Song {
  const safeCoverUrl = getRendererSafeImageUrl(coverUrl);
  const base = seedSong || null;

  return {
    id: `album-cover-${albumKeyPart(title)}-${albumKeyPart(artist)}-${safeCoverUrl.slice(0, 24)}`,
    title: title || base?.title || "custom album",
    artist: artist || base?.artist || "local album",
    album: title || base?.album || "custom album",
    filePath: base?.filePath || "",
    url: base?.url || "",
    fileExists: true,
    coverPath: null,
    coverUrl: safeCoverUrl,
    liked: false,
    playCount: 0,
    duration: 0,
    dateAdded: base?.dateAdded || new Date().toISOString()
  } as Song;
}

function normalizeStoredPathForCompare(value: unknown) {
  return String(value || "").trim().replace(/\\/g, "/").toLowerCase();
}

function pickManualAlbumCoverSong(album: ManualLocalAlbum, albumSongs: Song[]) {
  const storedCoverPath = normalizeStoredPathForCompare(album.coverPath || album.folderCoverPath || album.embeddedCoverPath || "");
  const preferredByPath = storedCoverPath
    ? albumSongs.find((song) => normalizeStoredPathForCompare(song.coverPath) === storedCoverPath)
    : null;

  if (preferredByPath) return preferredByPath;

  const preferredBySource = albumSongs.find((song) =>
    ["custom", "folder", "embedded"].includes(String((song as any).coverSource || "")) &&
    Boolean(getCardCoverUrl(song) || getRendererSafeImageUrl(song.coverPath))
  );

  if (preferredBySource) return preferredBySource;

  const safeCoverUrl = getRendererSafeImageUrl(album.coverUrl);
  if (safeCoverUrl) return makeAlbumCoverSong(safeCoverUrl, album.title, album.artist, albumSongs[0] || null);

  return pickAlbumCoverSong(albumSongs);
}

function resizeAlbumCoverFile(file: File, size = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not prepare cover canvas.");

        const sourceSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
        const sourceX = ((image.naturalWidth || image.width) - sourceSize) / 2;
        const sourceY = ((image.naturalHeight || image.height) - sourceSize) / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

        let dataUrl = canvas.toDataURL("image/webp", 0.84);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.86);
        }

        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that image."));
    };

    image.src = objectUrl;
  });
}

export function buildLocalAlbumEntries(inputSongs: Song[]): LocalAlbumEntry[] {
  const groups = new Map<string, LocalAlbumEntry>();

  inputSongs.forEach((song) => {
    if (!isPlayableSong(song) || !isUsefulAlbumName(song.album)) return;

    const title = normalizeAlbumValue(song.album);
    const albumArtist = getAlbumArtist(song);
    const key = `${albumKeyPart(title)}__${albumKeyPart(albumArtist)}`;
    const existing = groups.get(key);

    if (existing) {
      existing.songs.push(song);
      existing.trackCount += 1;
      existing.totalDuration += Math.max(0, Number(song.duration) || 0);
      existing.latestAdded = Math.max(existing.latestAdded, getSongAddedTime(song));
      if (!existing.year) existing.year = getAlbumYear(song);
      if (!existing.coverSong || getRendererSafeImageUrl(song.coverUrl) || getRendererSafeImageUrl(song.coverPath)) {
        existing.coverSong = pickAlbumCoverSong(existing.songs);
      }
      return;
    }

    groups.set(key, {
      id: key,
      title,
      artist: prettyMeta(albumArtist),
      albumArtist,
      year: getAlbumYear(song),
      coverSong: song,
      songs: [song],
      trackCount: 1,
      totalDuration: Math.max(0, Number(song.duration) || 0),
      latestAdded: getSongAddedTime(song)
    });
  });

  return [...groups.values()].map((album) => ({
    ...album,
    coverSong: pickAlbumCoverSong(album.songs),
    songs: [...album.songs].sort((a, b) => {
      const trackA = Number((a as any).track || (a as any).trackNumber || 0);
      const trackB = Number((b as any).track || (b as any).trackNumber || 0);
      if (Number.isFinite(trackA) && Number.isFinite(trackB) && trackA !== trackB) return trackA - trackB;
      return getSongAddedTime(a) - getSongAddedTime(b);
    })
  })).sort((a, b) => b.latestAdded - a.latestAdded || a.title.localeCompare(b.title));
}

function filterAndSortAlbums(albums: LocalAlbumEntry[], query: string, sortMode: string) {
  const cleanedQuery = normalizeAlbumValue(query).toLowerCase();
  const filtered = cleanedQuery
    ? albums.filter((album) => `${album.title} ${album.artist} ${album.year || ""}`.toLowerCase().includes(cleanedQuery))
    : albums;

  return [...filtered].sort((a, b) => {
    if (sortMode === "title") return a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist);
    if (sortMode === "artist") return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
    if (sortMode === "year") return String(b.year || "0000").localeCompare(String(a.year || "0000")) || a.title.localeCompare(b.title);
    return b.latestAdded - a.latestAdded || a.title.localeCompare(b.title);
  });
}

function albumTrackIds(album: LocalAlbumEntry | null) {
  return album?.songs.map((song) => song.id).filter(Boolean) ?? [];
}

type ManualLocalAlbum = {
  id: string;
  title: string;
  artist: string;
  year?: string;
  coverUrl?: string;
  coverPath?: string;
  coverSource?: string;
  embeddedCoverPath?: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
  sourceType?: "manual" | "folder";
  sourcePath?: string;
  folderCoverPath?: string;
  importedAt?: number;
};

const MANUAL_LOCAL_ALBUMS_STORAGE_KEY = "localitfy.manualAlbums.v1";

function cleanManualAlbumTitle(value: unknown) {
  return normalizeAlbumValue(value).slice(0, 90);
}

function cleanManualAlbumArtist(value: unknown) {
  return normalizeAlbumValue(value).slice(0, 90);
}

function cleanManualAlbumYear(value: unknown) {
  const match = String(value || "").match(/(?:19|20)\d{2}/);
  return match?.[0] ?? "";
}

function normalizeManualLocalAlbums(value: unknown): ManualLocalAlbum[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const raw = item && typeof item === "object" ? item as any : null;
      if (!raw) return null;

      const title = cleanManualAlbumTitle(raw.title || raw.name);
      const artist = cleanManualAlbumArtist(raw.artist || raw.albumArtist || "local album");
      const songIds = Array.isArray(raw.songIds)
        ? [...new Set(raw.songIds.map((id: unknown) => String(id || "").trim()).filter(Boolean))]
        : [];
      const coverUrl = getRendererSafeImageUrl(raw.coverUrl || raw.coverDataUrl || raw.customCoverUrl || "");

      if (!title || !songIds.length) return null;

      const createdAt = Number(raw.createdAt) || Date.now();
      const updatedAt = Number(raw.updatedAt) || createdAt;

      return {
        id: String(raw.id || makeLocalId("album")).trim() || makeLocalId("album"),
        title,
        artist: artist || "local album",
        year: cleanManualAlbumYear(raw.year),
        coverUrl,
        coverPath: String(raw.coverPath || ""),
        coverSource: String(raw.coverSource || ""),
        embeddedCoverPath: String(raw.embeddedCoverPath || ""),
        songIds,
        createdAt,
        updatedAt,
        sourceType: raw.sourceType === "folder" ? "folder" : "manual",
        sourcePath: typeof raw.sourcePath === "string" ? raw.sourcePath : "",
        folderCoverPath: typeof raw.folderCoverPath === "string" ? raw.folderCoverPath : "",
        importedAt: Number(raw.importedAt) || 0
      } satisfies ManualLocalAlbum;
    })
    .filter(Boolean) as ManualLocalAlbum[];
}

function buildManualAlbumSongIdSet(manualAlbums: ManualLocalAlbum[]) {
  const ids = new Set<string>();

  manualAlbums.forEach((album) => {
    if (!Array.isArray(album.songIds)) return;
    album.songIds.forEach((songId) => {
      const cleaned = String(songId || "").trim();
      if (cleaned) ids.add(cleaned);
    });
  });

  return ids;
}

function buildManualAlbumEntries(manualAlbums: ManualLocalAlbum[], songsById: Map<string, Song>): LocalAlbumEntry[] {
  return manualAlbums
    .map((album) => {
      const albumSongs = album.songIds
        .map((songId) => songsById.get(songId))
        .filter(isPlayableSong);

      if (!albumSongs.length) return null;

      const latestAdded = Math.max(album.updatedAt || 0, ...albumSongs.map(getSongAddedTime));

      const customCoverUrl = getRendererSafeImageUrl(album.coverUrl);

      return {
        id: `manual_${album.id}`,
        title: album.title,
        artist: album.artist || "local album",
        albumArtist: album.artist || "local album",
        year: album.year || null,
        customCoverUrl: customCoverUrl || null,
        coverSong: pickManualAlbumCoverSong(album, albumSongs),
        songs: albumSongs,
        trackCount: albumSongs.length,
        totalDuration: albumSongs.reduce((total, song) => total + Math.max(0, Number(song.duration) || 0), 0),
        latestAdded,
        source: "manual",
        sourceType: album.sourceType === "folder" ? "folder" : "manual",
        sourcePath: album.sourcePath || "",
        folderCoverPath: album.folderCoverPath || "",
        importedAt: album.importedAt || 0,
        manualAlbumId: album.id,
        createdAt: album.createdAt,
        updatedAt: album.updatedAt
      } as LocalAlbumEntry & { source: "manual"; sourceType?: "manual" | "folder"; sourcePath?: string; folderCoverPath?: string; importedAt?: number; manualAlbumId: string; createdAt: number; updatedAt: number };
    })
    .filter(Boolean) as LocalAlbumEntry[];
}

function albumSongSearchMatches(song: Song, query: string) {
  const cleaned = normalizeAlbumValue(query).toLowerCase();
  if (!cleaned) return true;
  return `${song.title} ${song.artist} ${song.album || ""}`.toLowerCase().includes(cleaned);
}

function uniquePlayableSongIds(songIds: string[], songsById: Map<string, Song>) {
  const seen = new Set<string>();
  return songIds.filter((songId) => {
    const song = songsById.get(songId);
    if (!isPlayableSong(song) || seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
}

function uniqueCleanArtistsFromSongs(inputSongs: Song[]) {
  const seen = new Set<string>();
  return inputSongs
    .map((song) => prettyMeta(song.artist || ""))
    .map((artist) => artist.trim())
    .filter((artist) => artist && artist.toLowerCase() !== "unknown artist")
    .filter((artist) => {
      const key = artist.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function suggestAlbumArtistFromSongs(inputSongs: Song[]) {
  const artists = uniqueCleanArtistsFromSongs(inputSongs);
  if (artists.length === 0) return "local album";
  if (artists.length === 1) return artists[0];
  return "various artists";
}


export type SongInteractionHandlers = {
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

export type SongRowItemProps = SongInteractionHandlers & {
  song: Song;
  index: number;
  active: boolean;
  isPlaying: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  libraryDropSide: LibraryDropSide;
  draggedSongTitle: string;
};


const LIKE_BURST_PARTICLES_V443 = [
  { rotate: 0, color: "#fe5064", size: "5px", translateY: "-28px", delay: "0s" },
  { rotate: 36, color: "#8eb539", size: "4px", translateY: "-27px", delay: "0.06s" },
  { rotate: 72, color: "#3e9be7", size: "3px", translateY: "-26px", delay: "0.12s" },
  { rotate: 108, color: "#f5ce50", size: "5px", translateY: "-28px", delay: "0s" },
  { rotate: 144, color: "#fe5064", size: "4px", translateY: "-27px", delay: "0.06s" },
  { rotate: 180, color: "#8eb539", size: "3px", translateY: "-26px", delay: "0.12s" },
  { rotate: 216, color: "#3e9be7", size: "5px", translateY: "-28px", delay: "0s" },
  { rotate: 252, color: "#f5ce50", size: "4px", translateY: "-27px", delay: "0.06s" },
  { rotate: 288, color: "#fe5064", size: "3px", translateY: "-26px", delay: "0.12s" },
  { rotate: 324, color: "#8eb539", size: "5px", translateY: "-28px", delay: "0s" }
];

function LikeHeartAnimationV443({ liked }: { liked: boolean }) {
  return (
    <span className="likeHeartAnimationV443" aria-hidden="true" data-liked={liked ? "true" : "false"}>
      <span className="likeHeartShellV443">
        <span className="likeBurstRingV443" />
        {LIKE_BURST_PARTICLES_V443.map((particle) => (
          <span
            key={particle.rotate}
            className="likeBurstParticleV443"
            style={{
              "--rotate": `${particle.rotate}deg`,
              "--particle-color": particle.color,
              "--particle-size": particle.size,
              "--particle-translate-y": particle.translateY,
              "--particle-delay": particle.delay
            } as CSSProperties}
          />
        ))}
        <span className="likeHeartFillV443" />
      </span>
    </span>
  );
}

export const SongRowItem = memo(function SongRowItem({
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
  onOpenPlaylistPicker,
  onOpenSongContextMenu,
  onStartSongDrag,
  onDragOverSong,
  onDragLeaveSong,
  onDropSong,
  onDragEnd
}: SongRowItemProps) {
  const isMissingFile = song.fileExists === false;

  return (
    <article
      className={`songRow ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""} ${isDragging ? "songDragging" : ""} ${isDropTarget ? "songDropTarget" : ""} ${isMissingFile ? "songMissingFileV039" : ""}`}
      data-library-song-id={song.id}
      data-file-exists={isMissingFile ? "false" : "true"}
      data-drop-side={isDropTarget ? libraryDropSide : undefined}
      draggable
      onDragStart={(event) => onStartSongDrag(event, song.id)}
      onDragOver={(event) => onDragOverSong(event, song.id)}
      onDragLeave={(event) => onDragLeaveSong(event, song.id)}
      onDrop={(event) => onDropSong(event, song.id)}
      onDragEnd={onDragEnd}
      onContextMenu={(event) => onOpenSongContextMenu?.(event, song)}
      aria-grabbed={isDragging}
      title={isMissingFile ? "This song is still in Localtify, but the local audio file is missing." : draggedSongTitle ? `dragging ${draggedSongTitle}` : "drag onto another song to reorder, or drop on the bottom player to play next"}
      style={{ "--stagger": `${Math.min(index, 20) * 18}ms` } as CSSProperties}
    >
      <button className="songButton" onClick={() => onSelectSong(song.id, true)}>
        <span className="songIndex">{active && isPlaying ? <PlayingBarsIcon /> : index + 1}</span>

        <Cover song={song} className="songArt" />

        <span className="songMeta">
          <strong title={displaySongTitleV444(song, 12)}>{displaySongTitleV444(song, 7)}</strong>
          <small>{isMissingFile ? "missing local file · reimport or relink" : displaySongArtistV444(song)}</small>
        </span>
      </button>

      <span className="songInfo songDurationInfo">{isMissingFile ? "missing" : formatTime(song.duration)}</span>

      <button
        className={`iconAction likeActionV443 noActionHoverV444 ${song.liked ? "liked likeActionActiveV443" : ""}`}
        onClick={() => onToggleLike(song.id)}
        aria-label={song.liked ? "unlike song" : "like song"}
        aria-pressed={song.liked}
        title={song.liked ? "unlike" : "like"}
      >
        <LikeHeartAnimationV443 liked={song.liked} />
      </button>

      <button
        className="iconAction playlistAddAction noActionHoverV444"
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

    </article>
  );
});

export type HomeAlbumCardItemProps = SongInteractionHandlers & {
  song: Song;
  index: number;
  active: boolean;
  isPlaying: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  libraryDropSide: LibraryDropSide;
  draggedSongTitle: string;
};

export const HomeAlbumCardItem = memo(function HomeAlbumCardItem({
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
  const cardCoverCssUrl = getCardCoverCssUrl(song);

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
      style={{
        "--stagger": `${Math.min(index, 28) * 16}ms`,
        "--library-card-cover": cardCoverCssUrl
      } as CSSProperties}
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
          className={`iconAction likeActionV443 noActionHoverV444 ${song.liked ? "liked likeActionActiveV443" : ""}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLike(song.id);
          }}
          aria-label={song.liked ? "unlike song" : "like song"}
          aria-pressed={song.liked}
          title={song.liked ? "unlike" : "like"}
        >
          <LikeHeartAnimationV443 liked={song.liked} />
        </button>

        <button
          className="iconAction playlistAddAction noActionHoverV444"
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
      </div>
    </article>
  );
});


export type VirtualSongRowsProps = SongInteractionHandlers & {
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

export const VirtualSongRows = memo(function VirtualSongRows({
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
    overscan: 5,
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

export type VirtualHomeSongCardsProps = SongInteractionHandlers & {
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

export const VirtualHomeSongCards = memo(function VirtualHomeSongCards({
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
    overscan: 2,
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

export function readPlaylistDraggedSongId(event: DragEvent<HTMLElement>, fallbackSongId = "") {
  return (
    event.dataTransfer.getData("text/localitfy-song-id") ||
    event.dataTransfer.getData("text/plain") ||
    fallbackSongId
  );
}

export function getPlaylistDropSide(event: DragEvent<HTMLElement>): LibraryDropSide {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerY = rect.top + rect.height / 2;
  return event.clientY < centerY ? "before" : "after";
}

export type VirtualPlaylistTrackListProps = {
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

export const VirtualPlaylistTrackList = memo(function VirtualPlaylistTrackList({
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
    overscan: 5,
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
              <span className="playlistTrackGrip"><GripVertical size={14} strokeWidth={2.25} /></span>
              <button className="playlistTrackMain" type="button" onClick={() => onSelectSong(song.id)}>
                <span className="playlistTrackIndex">{active && isPlaying ? <PlayingBarsIcon /> : virtualRow.index + 1}</span>
                <Cover song={song} className="playlistTrackCover" />
                <span className="playlistTrackText">
                  <strong>{displaySongTitleV444(song, 7)}</strong>
                  <small>{displaySongArtistV444(song)}</small>
                </span>
              </button>
              <span className="playlistTrackDuration">{formatTime(song.duration)}</span>
              <button className="iconAction iconActionSvg" type="button" onClick={() => onRemoveSong(selectedPlaylistId, song.id)} aria-label="remove from playlist">
                <X size={16} strokeWidth={2.5} />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
});

export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args: Parameters<T>) => callbackRef.current(...args)) as T, []);
}


export function TitleBar({ mini = false, children }: { mini?: boolean; children?: ReactNode }) {
  function handleTitleDoubleClick() {
    if (!mini) window.localitfy.toggleMaximizeWindow();
  }

  return (
    <header className={mini ? "titleBar miniTitleBar" : "titleBar"}>
      <div className="titleDrag" onDoubleClick={handleTitleDoubleClick} title="drag to move localtify">
        <img className="titleLogo titleLogoImage" src={localtifyLogo} alt="" width={22} height={22} loading="eager" decoding="async" fetchPriority="high" draggable={false} aria-hidden="true" />
        <span>localtify</span>
      </div>

      {!mini && children ? (
        <div className="titleBarUpdateSlot" aria-label="localtify update notice">
          {children}
        </div>
      ) : null}

      <div className="windowButtons">
        <button type="button" onClick={() => window.localitfy.minimizeWindow()} aria-label="Minimize window"><WindowMinimizeIcon /></button>
        {!mini ? (
          <button type="button" className="maxWin" onClick={() => window.localitfy.toggleMaximizeWindow()} aria-label="Maximize or restore window">
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" focusable="false">
              <rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        ) : null}
        <button type="button" className="closeWin" onClick={() => window.localitfy.closeWindow()} aria-label="Close window"><WindowCloseIcon /></button>
      </div>
    </header>
  );
}


export function buildDiscordPreview({
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

  if (song.liked) moodTitle = `? ${title}`;
  else if (mostPlayed && mostPlayed.id === song.id) moodTitle = `on repeat � ${title}`;
  else if ((song.playCount || 0) <= 0) moodTitle = `discovering � ${title}`;

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
      details: `paused � ${title}`,
      state: timeLeft
    };
  }

  if (settings.discordActivityStyle === "cute") {
    return {
      badge: "PLAYING",
      details: `vibing to ${moodTitle} ?`,
      state: `${getSecondLine()} � localtify`
    };
  }

  if (settings.discordActivityStyle === "detailed") {
    return {
      badge: "PLAYING",
      details: moodTitle,
      state: `${artist} � ${album} � ${timeLeft}`
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
    details: `? ${moodTitle}`,
    state: getSecondLine()
  };
}

export type LocaltifyAppViewProps = Record<string, any>;

export default function LocaltifyAppView(props: LocaltifyAppViewProps) {
  const {
    appRootRef,
    settings,
    platformInfo,
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
    currentSong,
    heroDisplayTitle,
    heroDisplayArtist,
    playerError,
    toggleHeroExpanded,
    openCoversViewWithCurrentSong,
    homeListenNowSongs,
    shuffleLibrarySongsAction,
    playableSongCount,
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
    topArtists,
    recentImportWeekCount,
    recentlyAdded,
    neverPlayedSongs,
    missingFileCount,
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
    removeMissingSongs,
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

  } = props;

  useEffect(() => {
    const body = document.body;
    body.classList.toggle("localtifyEditorModalOpen", Boolean(editorSong));

    return () => {
      body.classList.remove("localtifyEditorModalOpen");
    };
  }, [editorSong]);

  function downloadStatusLabel(status: string) {
    if (status === "done") return "done";
    if (status === "failed") return "failed";
    if (status === "cancelled") return "cancelled";
    if (status === "converting") return "converting";
    if (status === "downloading") return "downloading";
    return "queued";
  }

  function spotifyTrackStatusLabel(track: any, selected: boolean) {
    if (track.downloadStatus === "done") return track.importedToLibrary === false ? "downloaded" : "done";
    if (track.downloadStatus === "failed") return "failed";
    if (track.downloadStatus === "queued") return "queued";
    if (track.downloadStatus === "downloading") return "downloading";
    return selected ? "ready" : "not selected";
  }

  const safeMissingSongs = Array.isArray(missingSongs) ? missingSongs : [];
  const showingMissingFiles = view === "library" && libraryFilterMode === "missing";
  const libraryMissingLabel = `${missingFileCount || safeMissingSongs.length} missing file${(missingFileCount || safeMissingSongs.length) === 1 ? "" : "s"}`;

  const [albumSearch, setAlbumSearch] = useState("");
  const [albumSortMode, setAlbumSortMode] = useState("recent");
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [manualAlbums, setManualAlbums] = useState<ManualLocalAlbum[]>(() =>
    normalizeManualLocalAlbums(readLocalJson(MANUAL_LOCAL_ALBUMS_STORAGE_KEY, []))
  );
  const [albumBuilderOpen, setAlbumBuilderOpen] = useState(false);
  const [albumBuilderMode, setAlbumBuilderMode] = useState<"create" | "edit">("create");
  const albumBuilderSectionRef = useRef<HTMLElement | null>(null);
  const [albumEditingManualId, setAlbumEditingManualId] = useState("");
  const [albumDraftTitle, setAlbumDraftTitle] = useState("");
  const [albumDraftArtist, setAlbumDraftArtist] = useState("");
  const [albumDraftYear, setAlbumDraftYear] = useState("");
  const [albumDraftCoverUrl, setAlbumDraftCoverUrl] = useState("");
  const [albumDraftSearch, setAlbumDraftSearch] = useState("");
  const [albumDraftSongIds, setAlbumDraftSongIds] = useState<string[]>([]);
  const [albumFolderImportPreview, setAlbumFolderImportPreview] = useState<any | null>(null);
  const [albumFolderImportBusy, setAlbumFolderImportBusy] = useState(false);
  const [albumFolderImportMessage, setAlbumFolderImportMessage] = useState("");
  const [albumFolderImportProgress, setAlbumFolderImportProgress] = useState<any | null>(null);
  const albumCoverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    writeLocalJson(MANUAL_LOCAL_ALBUMS_STORAGE_KEY, manualAlbums);
  }, [manualAlbums]);

  useEffect(() => {
    if (!window.localitfy?.onAlbumFolderImportProgress) return;

    return window.localitfy.onAlbumFolderImportProgress((payload: any) => {
      if (!payload || typeof payload !== "object") return;
      setAlbumFolderImportProgress(payload);
      if (payload.message) setAlbumFolderImportMessage(String(payload.message));
    });
  }, []);

  const manualAlbumEntries = useMemo(() => buildManualAlbumEntries(manualAlbums, songsById), [manualAlbums, songsById]);
  const manualAlbumSongIds = useMemo(() => buildManualAlbumSongIdSet(manualAlbums), [manualAlbums]);
  const metadataAlbums = useMemo(() => {
    const unclaimedSongs = songs.filter((song) => !manualAlbumSongIds.has(song.id));
    return buildLocalAlbumEntries(unclaimedSongs);
  }, [songs, manualAlbumSongIds]);
  const localAlbums = useMemo(() => [...manualAlbumEntries, ...metadataAlbums], [manualAlbumEntries, metadataAlbums]);
  const visibleAlbums = useMemo(
    () => filterAndSortAlbums(localAlbums, albumSearch, albumSortMode),
    [localAlbums, albumSearch, albumSortMode]
  );
  const selectedAlbum = useMemo(() => {
    return localAlbums.find((album) => album.id === selectedAlbumId) || visibleAlbums[0] || localAlbums[0] || null;
  }, [localAlbums, selectedAlbumId, visibleAlbums]);

  useEffect(() => {
    if (view !== "albums") return;
    if (selectedAlbumId && localAlbums.some((album) => album.id === selectedAlbumId)) return;
    setSelectedAlbumId(visibleAlbums[0]?.id || localAlbums[0]?.id || "");
  }, [view, selectedAlbumId, localAlbums, visibleAlbums]);

  const selectedAlbumIds = albumTrackIds(selectedAlbum);
  const selectedAlbumIsManual = Boolean((selectedAlbum as any)?.source === "manual" && (selectedAlbum as any)?.manualAlbumId);
  const selectedAlbumIsFolder = Boolean(selectedAlbumIsManual && (selectedAlbum as any)?.sourceType === "folder");
  const albumDraftSelectedSongs = useMemo(() => albumDraftSongIds.map((songId) => songsById.get(songId)).filter(isPlayableSong), [albumDraftSongIds, songsById]);
  const albumDraftArtistNames = useMemo(() => uniqueCleanArtistsFromSongs(albumDraftSelectedSongs), [albumDraftSelectedSongs]);
  const albumDraftArtistSuggestion = useMemo(() => suggestAlbumArtistFromSongs(albumDraftSelectedSongs), [albumDraftSelectedSongs]);
  const albumDraftHasVariousArtists = albumDraftArtistNames.length > 1;
  const albumDraftArtistPreview = albumDraftArtistNames.length
    ? albumDraftArtistNames.slice(0, 3).join(" + ") + (albumDraftArtistNames.length > 3 ? ` + ${albumDraftArtistNames.length - 3} more` : "")
    : "pick songs to read artists";
  const albumDraftPreviewCoverSong = useMemo(() => {
    const safeCover = getRendererSafeImageUrl(albumDraftCoverUrl);
    const seedSong = albumDraftSelectedSongs[0] || null;
    if (safeCover) return makeAlbumCoverSong(safeCover, albumDraftTitle || "new album", albumDraftArtist || "local album", seedSong);
    return seedSong || null;
  }, [albumDraftArtist, albumDraftCoverUrl, albumDraftSelectedSongs, albumDraftTitle]);
  const albumDraftSearchResults = useMemo(() => {
    const selected = new Set(albumDraftSongIds);
    return songs
      .filter(isPlayableSong)
      .filter((song) => albumSongSearchMatches(song, albumDraftSearch))
      .sort((a, b) => {
        const selectedA = selected.has(a.id) ? 0 : 1;
        const selectedB = selected.has(b.id) ? 0 : 1;
        if (selectedA !== selectedB) return selectedA - selectedB;
        return prettyTitle(a.title, 20).localeCompare(prettyTitle(b.title, 20));
      })
      .slice(0, 80);
  }, [songs, albumDraftSearch, albumDraftSongIds]);

  function scrollAlbumBuilderIntoView() {
    window.requestAnimationFrame(() => {
      albumBuilderSectionRef.current?.scrollIntoView({
        behavior: settings.reducedMotion ? "auto" : "smooth",
        block: "start"
      });
    });
  }

  function resetAlbumBuilderDraft() {
    setAlbumBuilderMode("create");
    setAlbumEditingManualId("");
    setAlbumDraftTitle("");
    setAlbumDraftArtist("");
    setAlbumDraftYear("");
    setAlbumDraftCoverUrl("");
    setAlbumDraftSearch("");
    setAlbumDraftSongIds([]);
  }


  async function scanAlbumFolderImport(mode: "single" | "library") {
    if (albumFolderImportBusy) return;

    if (!window.localitfy?.scanAlbumFolder) {
      const message = "album folder import bridge missing � restart Localtify after replacing electron/preload.cjs and electron/main.cjs";
      setAlbumFolderImportMessage(message);
      setAlbumFolderImportProgress({ type: "error", mode, message });
      setStatusText?.("album import bridge missing");
      return;
    }

    setAlbumFolderImportBusy(true);
    setAlbumFolderImportPreview(null);
    setAlbumFolderImportProgress({
      type: "picking",
      mode,
      index: 0,
      total: 1,
      message: mode === "library" ? "Choose a parent folder that contains album folders." : "Choose one album folder."
    });
    setAlbumFolderImportMessage(mode === "library" ? "Choose a parent folder that contains album folders." : "Choose one album folder.");
    setStatusText?.(mode === "library" ? "opening album library picker..." : "opening album folder picker...");
    setLibraryScanBusy?.(true);
    setLibraryScanMessage?.("album folder scan starting...");

    try {
      const result = await window.localitfy.scanAlbumFolder({ mode });

      if (!result || result.canceled) {
        setAlbumFolderImportPreview(null);
        setAlbumFolderImportProgress(null);
        setAlbumFolderImportMessage("folder picker cancelled");
        setStatusText?.("album import cancelled");
        setLibraryScanMessage?.("album import cancelled");
        return;
      }

      if (!result.ok) {
        setAlbumFolderImportPreview(null);
        setAlbumFolderImportProgress({ type: "error", mode, message: result.error || "album folder scan failed" });
        setAlbumFolderImportMessage(result.error || "album folder scan failed");
        setStatusText?.("album scan failed");
        return;
      }

      setAlbumFolderImportPreview(result);
      setAlbumFolderImportProgress({
        type: "scan-done",
        mode,
        index: result.albums?.length || 0,
        total: result.albums?.length || 0,
        message: result.message || `Found ${result.albums?.length || 0} album folders.`
      });
      setAlbumFolderImportMessage(result.message || (result.albums?.length ? `Found ${result.albums.length} album folders.` : "No album folders found in that folder."));
      setStatusText?.(result.message || "album folders ready to import");
      setLibraryScanMessage?.(`${result.albums?.length || 0} album folder${(result.albums?.length || 0) === 1 ? "" : "s"} ready`);
    } catch (error: any) {
      console.error("[localtify album folder scan]", error);
      setAlbumFolderImportPreview(null);
      setAlbumFolderImportProgress({ type: "error", mode, message: error?.message || "album folder scan failed" });
      setAlbumFolderImportMessage(error?.message || "album folder scan failed");
      setStatusText?.("album scan failed");
    } finally {
      setAlbumFolderImportBusy(false);
      setLibraryScanBusy?.(false);
    }
  }


  function cancelAlbumFolderImportPreview() {
    setAlbumFolderImportPreview(null);
    setAlbumFolderImportProgress(null);
    setAlbumFolderImportMessage("");
    setStatusText?.("album import preview cleared");
  }

  async function commitAlbumFolderImportPreview() {
    const scanId = albumFolderImportPreview?.scanId;
    if (!scanId || !window.localitfy?.importAlbumFolder || albumFolderImportBusy) return;

    setAlbumFolderImportBusy(true);
    setAlbumFolderImportProgress({
      type: "import-start",
      index: 0,
      total: albumFolderImportPreview?.trackCount || 1,
      message: "Adding album tracks to the library..."
    });
    setAlbumFolderImportMessage("Adding album tracks to the library...");
    setStatusText?.("importing album folder...");
    setLibraryScanBusy?.(true);
    setLibraryScanMessage?.("adding album folder tracks to library...");

    try {
      const result = await window.localitfy.importAlbumFolder({ scanId });

      if (!result?.ok) {
        setAlbumFolderImportProgress({ type: "error", message: result?.error || "album folder import failed" });
        setAlbumFolderImportMessage(result?.error || "album folder import failed");
        setStatusText?.("album import failed");
        return;
      }

      if (Array.isArray(result.songs)) {
        setSongs?.(result.songs);
        saveLibraryOrder(result.songs);
      }

      const importedAlbums = Array.isArray(result.albums) ? result.albums : [];
      const now = Date.now();

      if (importedAlbums.length) {
        const nextFolderAlbums: ManualLocalAlbum[] = importedAlbums.map((album: any) => ({
          id: String(album.manualAlbumId || album.id || makeLocalId("album")),
          title: cleanManualAlbumTitle(album.title || "local album"),
          artist: cleanManualAlbumArtist(album.artist || "local album"),
          year: cleanManualAlbumYear(album.year),
          coverUrl: getRendererSafeImageUrl(album.coverUrl || ""),
          coverPath: String(album.coverPath || ""),
          coverSource: String(album.coverSource || ""),
          embeddedCoverPath: String(album.embeddedCoverPath || ""),
          songIds: Array.isArray(album.songIds) ? [...new Set(album.songIds.map((id: unknown) => String(id || "").trim()).filter(Boolean))] : [],
          createdAt: Number(album.createdAt) || now,
          updatedAt: Number(album.updatedAt) || now,
          sourceType: "folder",
          sourcePath: String(album.sourcePath || ""),
          folderCoverPath: String(album.folderCoverPath || ""),
          importedAt: Number(album.importedAt) || now
        })).filter((album) => album.title && album.songIds.length);

        setManualAlbums((items) => {
          const incomingSourcePaths = new Set(nextFolderAlbums.map((album) => album.sourcePath).filter(Boolean));
          const incomingIds = new Set(nextFolderAlbums.map((album) => album.id));
          const kept = items.filter((album) => {
            if (incomingIds.has(album.id)) return false;
            if (album.sourceType === "folder" && album.sourcePath && incomingSourcePaths.has(album.sourcePath)) return false;
            return true;
          });

          return [...nextFolderAlbums, ...kept];
        });

        setSelectedAlbumId(`manual_${nextFolderAlbums[0]?.id || ""}`);
      }

      setAlbumFolderImportPreview(null);
      setAlbumFolderImportProgress({
        type: "import-done",
        index: importedAlbums.length,
        total: importedAlbums.length,
        changedCount: result.changedCount || 0,
        message: result.message || "album folder imported"
      });
      const repairText = result.repairedExistingCount
        ? ` repaired ${result.repairedExistingCount} existing track${result.repairedExistingCount === 1 ? "" : "s"}`
        : "";
      setAlbumFolderImportMessage(result.message || `album folder imported${repairText}`);
      setStatusText?.(result.message || `album folder imported${repairText}`);
      setLibraryScanMessage?.(`${importedAlbums.length} folder album${importedAlbums.length === 1 ? "" : "s"} imported`);
    } catch (error: any) {
      console.error("[localtify album folder import]", error);
      setAlbumFolderImportProgress({ type: "error", message: error?.message || "album folder import failed" });
      setAlbumFolderImportMessage(error?.message || "album folder import failed");
      setStatusText?.("album import failed");
    } finally {
      setAlbumFolderImportBusy(false);
      setLibraryScanBusy?.(false);
    }
  }


  function openCreateAlbumBuilder(seedSong?: Song | null) {
    setAlbumBuilderMode("create");
    setAlbumEditingManualId("");
    setAlbumDraftTitle(seedSong?.album && isUsefulAlbumName(seedSong.album) ? normalizeAlbumValue(seedSong.album) : "");
    setAlbumDraftArtist(seedSong?.artist ? prettyMeta(seedSong.artist) : "");
    setAlbumDraftYear(seedSong ? getAlbumYear(seedSong) || "" : "");
    setAlbumDraftCoverUrl("");
    setAlbumDraftSearch("");
    setAlbumDraftSongIds(seedSong ? [seedSong.id] : []);
    setAlbumBuilderOpen(true);
    setStatusText?.("album builder opened");
    scrollAlbumBuilderIntoView();
  }

  function openEditAlbumBuilder(album: LocalAlbumEntry | null) {
    if (!album || (album as any).source !== "manual") return;
    const manualId = String((album as any).manualAlbumId || "");
    const manual = manualAlbums.find((item) => item.id === manualId);
    if (!manual) return;

    setAlbumBuilderMode("edit");
    setAlbumEditingManualId(manual.id);
    setAlbumDraftTitle(manual.title);
    setAlbumDraftArtist(manual.artist);
    setAlbumDraftYear(manual.year || "");
    setAlbumDraftCoverUrl(getRendererSafeImageUrl(manual.coverUrl));
    setAlbumDraftSearch("");
    setAlbumDraftSongIds(uniquePlayableSongIds(manual.songIds, songsById));
    setAlbumBuilderOpen(true);
    setStatusText?.("album editor opened");
    scrollAlbumBuilderIntoView();
  }

  function closeAlbumBuilder() {
    setAlbumBuilderOpen(false);
    resetAlbumBuilderDraft();
  }

  function toggleAlbumDraftSong(songId: string) {
    setAlbumDraftSongIds((ids) => ids.includes(songId) ? ids.filter((id) => id !== songId) : [...ids, songId]);
  }

  function openAlbumCoverPicker() {
    albumCoverInputRef.current?.click();
  }

  async function handleAlbumCoverFile(event: any) {
    const file = event.currentTarget.files?.[0] || null;
    event.currentTarget.value = "";
    if (!file) return;

    try {
      setStatusText?.("preparing album cover...");
      const coverUrl = await resizeAlbumCoverFile(file);
      setAlbumDraftCoverUrl(coverUrl);
      setStatusText?.("album cover selected");
    } catch (error) {
      console.error("[localitfy album cover picker]", error);
      setStatusText?.("album cover failed");
    }
  }

  function clearAlbumDraftCover() {
    setAlbumDraftCoverUrl("");
    setStatusText?.("album cover reset");
  }

  function saveManualAlbumFromDraft() {
    const songIds = uniquePlayableSongIds(albumDraftSongIds, songsById);
    if (!songIds.length) return;

    const firstSong = songsById.get(songIds[0]);
    const title = cleanManualAlbumTitle(albumDraftTitle || firstSong?.album || firstSong?.title || "new album") || "new album";
    const artist = cleanManualAlbumArtist(albumDraftArtist || albumDraftArtistSuggestion || firstSong?.artist || "local album") || "local album";
    const year = cleanManualAlbumYear(albumDraftYear);
    const now = Date.now();

    if (albumBuilderMode === "edit" && albumEditingManualId) {
      setManualAlbums((items) => items.map((item) => item.id === albumEditingManualId
        ? { ...item, title, artist, year, coverUrl: getRendererSafeImageUrl(albumDraftCoverUrl), songIds, updatedAt: now }
        : item
      ));
      setSelectedAlbumId(`manual_${albumEditingManualId}`);
    } else {
      const id = makeLocalId("album");
      setManualAlbums((items) => [{ id, title, artist, year, coverUrl: getRendererSafeImageUrl(albumDraftCoverUrl), songIds, createdAt: now, updatedAt: now, sourceType: "manual" }, ...items]);
      setSelectedAlbumId(`manual_${id}`);
    }

    closeAlbumBuilder();
  }

  function deleteManualAlbum(album: LocalAlbumEntry | null) {
    if (!album || (album as any).source !== "manual") return;
    const manualId = String((album as any).manualAlbumId || "");
    if (!manualId) return;
    setManualAlbums((items) => items.filter((item) => item.id !== manualId));
    setSelectedAlbumId("");
    if (albumEditingManualId === manualId) closeAlbumBuilder();
  }

  const homeHeroCoverBrightness = clamp(Number(settings.homeHeroCoverBrightness ?? 1), 0.65, 1.55);
  const homeHeroCoverContrast = clamp(1.02 + (homeHeroCoverBrightness - 1) * 0.08, 0.98, 1.08);
  const homeHeroCoverSaturation = clamp(1.04 + (homeHeroCoverBrightness - 1) * 0.14, 1, 1.14);
  const homeHeroCoverGlowBrightness = clamp(0.72 + (homeHeroCoverBrightness - 1) * 0.34, 0.62, 0.92);
  const platformId = String((platformInfo as any)?.id || "unknown").toLowerCase();

  return (
    <main
      ref={appRootRef}
      className={`app ${settings.animatedGlow ? "animatedGlow" : ""} ${
        settings.compactPlayer ? "compactPlayer" : ""
      } ${settings.denseList ? "denseList" : ""} ${settings.quickLibraryMoreBlur !== false ? "moreQuickLibraryBlur" : "lessQuickLibraryBlur"} ${themeMotionReady ? "themeMotionReady" : "themeMotionBooting"} animatedBackgrounds ${settings.reducedMotion ? "reducedMotion" : ""} ${showTopUpdateRibbon ? "updateRibbonVisible" : ""} ${isViewSwitching ? "viewSwitching" : ""} ${heroMotionAppClass} ${homeEntranceSettledClass} ${isSeeking || isVolumeDragging ? "playerScrubbing" : ""} ${isAppBackgrounded ? "appBackgrounded" : ""} ${scrollBusyRef.current ? "isScrolling" : ""} ${themeSettling ? "themeSettling" : ""} ${draggedSongId ? "songDragActive" : ""} ${isPlaying ? "appAudioPlaying" : "appAudioIdle"} ${
        secretMode !== "none" ? `secretActive secret-${secretMode}` : ""
      }`}
      style={
        {
          "--player-size": `${clamp(Number(settings.playerSize || 108), 74, 168)}px`,
          "--sidebar-width": `${clamp(Number(settings.sidebarWidth || 249), 184, 340)}px`,
          "--home-hero-cover-brightness": String(homeHeroCoverBrightness),
          "--home-hero-cover-contrast": String(homeHeroCoverContrast),
          "--home-hero-cover-saturation": String(homeHeroCoverSaturation),
          "--home-hero-cover-glow-brightness": String(homeHeroCoverGlowBrightness),
          ...themePresetStyle,
          ...animatedThemeVisualStyle,
          ...customThemeStyle
        } as CSSProperties
      }
      data-platform={platformId}
      data-linux={platformId === "linux" ? "on" : "off"}
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
      data-home-banner={settings.homeBannerType || "dynamic"}
      data-blur-effects="normal"
      data-card-background={settings.mediaCardBackground || "glassy"}
      data-home-layout={settings.homeLayoutMode || "balanced"}
      data-library-row-style={settings.libraryRowStyle || "comfyRows"}
      data-stars-intensity={settings.starsIntensity || "off"}
      data-sidebar-behavior={settings.sidebarBehavior || "fixed"}
      data-player-background={settings.playerBackgroundStyle || "coverBlur"}
      data-hero-expanded={settings.heroExpanded ? "on" : "off"}
      data-hero-motion={heroMotion}
      data-status={statusText}
      data-app-version={APP_VERSION}
      data-secret-mode={secretMode}
      data-late-night={isThreeAm ? "on" : "off"}
      data-playing={isPlaying ? "on" : "off"}
      data-app-backgrounded={isAppBackgrounded ? "on" : "off"}
      data-motion-level={settings.reducedMotion ? "reduced" : "smooth"}
      data-drag-title={draggedSongTitle}
    >
      {showStarBackdrop ? (
        <div className="localtifyStarsBackdrop" aria-hidden="true">
          <div className="localtifyStarsLayer localtifyStarsLayerA" />
          <div className="localtifyStarsLayer localtifyStarsLayerB" />
          <div className="localtifyStarsLayer localtifyStarsLayerC" />
        </div>
      ) : null}

      <TitleBar>
        <UpdateIsland
          show={showTopUpdateRibbon}
          updatePrompt={updatePrompt}
          appVersion={APP_VERSION}
          reducedMotion={settings.reducedMotion}
          yukariUpdateImage={yukariUpdateImage}
          enterSpring={updateRibbonEnterSpring}
          childSpring={updateRibbonChildSpring}
          titleForPrompt={updateRibbonTitle}
          StatusIcon={UpdateStatusIcon}
          CloseIcon={WindowCloseIcon}
          onDownload={askUpdaterToDownload}
          onInstall={askUpdaterToInstall}
          onCheckAgain={manualUpdateCheck}
          onDismiss={() => setUpdatePrompt(defaultUpdatePrompt)}
        />
      </TitleBar>

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
          {secretMode === "yukari" ? <img className="yukariSecretPeek" src={yukariUpdateImage} alt="" width={260} height={260} loading="lazy" decoding="async" fetchPriority="low" draggable={false} aria-hidden="true" /> : null}
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
        <Suspense fallback={null}>
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
        </Suspense>
      ) : null}

      {effectiveSimpleMode ? (
        simpleModeView
      ) : (
        <div className="appShell">
          <aside className="sidebar">
            <div className="sidebarNavGroupsV467" aria-label="localtify navigation groups">
              {sidebarNavGroups.map((group, groupIndex) => {
                const groupItems = group.itemIds
                  .map((itemId) => navItems.find((item) => item.id === itemId))
                  .filter(Boolean);

                return (
                  <div key={group.id} className={`sidebarNavGroupV467 sidebarNavGroup-${group.id}`}>
                    <p className="sidebarGroupLabelV467">{group.label}</p>

                    <nav
                      className={`nav navGroupedV467 ${group.id === "app" ? "navUtility" : "navMain"}`}
                      aria-label={`${group.label} navigation`}
                    >
                      {groupItems.map((item) => {
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.id}
                            className={`navItem navItemAnimatedV468 nav-${item.id} ${view === item.id ? "active" : ""}`}
                            data-nav-id={item.id}
                            data-nav-group={group.id}
                            onClick={() => changeView(item.id, "nav")}
                            aria-label={`open ${item.label}`}
                          >
                            <span className="navDiscordPillV468" aria-hidden="true" />
                            <span className={`navIcon navIcon-${item.id}`} aria-hidden="true">
                              <span className="navIconMotionV468">
                                <Icon className="navLucideIcon" size={22} strokeWidth={2.75} fill="none" />
                              </span>
                            </span>
                            <span className="navText">
                              <strong>{item.label}</strong>
                              <small>{item.hint}</small>
                            </span>
                          </button>
                        );
                      })}
                    </nav>

                    {groupIndex < sidebarNavGroups.length - 1 ? <div className="navDivider" aria-hidden="true" /> : null}
                  </div>
                );
              })}
            </div>

            <div className="sidebarBottom">
              <button className="mainAction importMainAction iconTextButton" onClick={importSongs} aria-label="Import music">
                <FolderPlus className="buttonInlineIcon" size={17} strokeWidth={2.1} aria-hidden="true" />
                <span className="buttonLabel">import music</span>
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
                  {view === "albums" && "albums"}
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
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      const command = nextValue.trim().toLowerCase();

                      if (command === "/feedback" || command === "feedback") {
                        event.currentTarget.value = "";
                        window.dispatchEvent(new CustomEvent("localtify:open-feedback"));
                        return;
                      }

                      handleSearchInput(nextValue);
                    }}
                    placeholder="search songs, try /feedback"
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
                  className={`hero heroPremium ambientSurface heroLayoutMotion ${settings.heroExpanded ? "heroExpanded" : "heroCompact"} ${heroMotionClass} ${heroTitleClass}`}
                  style={{ ...ambientStyle, "--hero-motion-seed": nowPlayingTransitionKey } as CSSProperties}
                >
                  <div className="heroAmbiencePulse" aria-hidden="true" />
                  <div className={`heroCoverGhost ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey} aria-hidden="true" />
                  <div className={`heroText heroTextClean nowPlayingCopySwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
                    <p className={`eyebrow nowPlayingEyebrowSwap ${nowPlayingSongMotionClass}`} title={currentNowPlayingLabel}>{currentNowPlayingLabel}</p>

                    <h3 className={`heroTitle nowPlayingTitleSwap ${nowPlayingSongMotionClass}`} title={currentSong ? currentSong.title : "drop in your music"}>
                      {heroDisplayTitle}
                    </h3>
                    <p className={`heroArtistLine nowPlayingArtistSwap ${nowPlayingSongMotionClass}`} title={currentSong ? currentSong.artist || "unknown artist" : "import songs to start listening"}>
                      {heroDisplayArtist}
                    </p>

                    {playerError ? <div className="warningBox">{playerError}</div> : null}
                    {isThreeAm && settings.volume > 0.8 ? (
                      <div className="warningBox lateNightWarning">volume is above 80% � late night ears deserve mercy.</div>
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

                  <div className={`heroArtWrap nowPlayingArtSwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
                    <Cover song={currentSong} className="heroArt" priority="high" />

                  </div>
                </section>

                <section className={`homeShelfStack ${heroMotionClass}`} aria-label="home music shelves">
                  <section className="homeShelfPanel homeListenPanel">
                    <div className="homeShelfHeader">
                      <div>
                        <p className="eyebrow">local picks</p>
                        <h3>Listen now</h3>
                      </div>
                      <div className="homeShelfActions">
                        <span>{playableSongCount || 0} playable</span>
                        <button
                          className="homeShelfActionButton"
                          type="button"
                          onClick={shuffleLibrarySongsAction}
                          disabled={(playableSongCount || 0) < 2}
                          title="Shuffle the whole library and fill the queue"
                        >
                          shuffle library
                        </button>
                      </div>
                    </div>

                    <div className="homeListenRail">
                      {homeListenNowSongs.length ? (
                        homeListenNowSongs.map((song, index) => {
                          const active = song.id === currentId;
                          const listenAmbienceSource = getSongAmbientSource(song);
                          const listenAmbienceStyle = getAmbientStyle(listenAmbienceSource) ?? {};

                          return (
                            <button
                              key={song.id}
                              className={`homeListenCard ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""}`}
                              data-cover-ambience={listenAmbienceSource ? "on" : "off"}
                              type="button"
                              onClick={() => void selectSong(song.id, true)}
                              title={`play ${song.title}`}
                              style={{
                                "--card-delay": `${index * 48}ms`,
                                ...listenAmbienceStyle
                              } as CSSProperties}
                            >
                              {listenAmbienceSource ? (
                                <span className="homeListenBackground" aria-hidden="true">
                                  <img
                                    className="homeListenBackgroundImage"
                                    src={listenAmbienceSource}
                                    alt=""
                                    width={520}
                                    height={164}
                                    loading="lazy"
                                    decoding="async"
                                    fetchPriority="low"
                                    referrerPolicy="no-referrer"
                                    draggable={false}
                                  />
                                </span>
                              ) : null}

                              <span className="homeListenForeground">
                                <Cover song={song} className="homeListenCover" />
                                <span className="homeListenCopy">
                                  <strong className="homeListenTitle">{prettyTitle(song.title, 5)}</strong>
                                  <small className="homeListenArtist">{prettyMeta(song.artist)}</small>
                                </span>
                                <span className="homeListenMeta">{formatTime(song.duration || 0)}</span>
                              </span>
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
                          title={settings.homeExpanded ? "compact quick library" : "expand quick library"}
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
                        : "Browse queue and shuffle from one clean list."}
                    </span>
                  </div>
                  <div className="libraryHeaderActions libraryPanelActionsV025 libraryActionsCleanV026">
                    {view === "library" ? (
                      <button type="button" className="shuffleLibraryButtonV025" onClick={shuffleLibrarySongsAction} disabled={songs.length < 2}>
                        shuffle library
                      </button>
                    ) : null}
                  </div>
                </div>

                {view === "library" && (
                  <>
                    <div className="libraryQuickMetaV039" aria-label="library summary">
                      <span><strong>{songs.length}</strong> tracks</span>
                      <span><strong>{libraryAlbumCount}</strong> albums</span>
                      <span><strong>{libraryArtistCount}</strong> artists</span>
                      <span className={missingFileCount ? "is-warning" : ""}><strong>{missingFileCount}</strong> missing</span>
                    </div>

                    {missingFileCount > 0 ? (
                      <div className="libraryMissingStripV039" role="status" aria-live="polite">
                        <div>
                          <strong>{libraryMissingLabel}</strong>
                          <span>saved in Localtify, but the audio file is not on this PC.</span>
                        </div>
                        <div className="libraryMissingActionsV039">
                          <button
                            type="button"
                            className={showingMissingFiles ? "active" : ""}
                            onClick={() => setLibraryFilterMode?.("missing")}
                          >
                            show missing
                          </button>
                          <button
                            type="button"
                            onClick={() => setLibraryFilterMode?.("all")}
                          >
                            show all
                          </button>
                          <button type="button" onClick={importSongs}>
                            reimport
                          </button>
                          <button
                            type="button"
                            className="dangerGhostV039"
                            onClick={() => void removeMissingSongs?.()}
                            disabled={deleteBusy}
                            title="Remove missing song records from Localtify. This does not delete real audio files."
                          >
                            remove missing
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                <div className="libraryListHeaderV025">
                  <span>{showingMissingFiles ? `missing files (${visibleSongs.length})` : "tracks"}</span>
                  <span>{showingMissingFiles ? "repair" : "title"}</span>
                </div>

                {visibleSongs.length ? (
                  settings.libraryRowStyle === "coverCards" ? (
                    <div className="libraryCoverCardShellV321">
                      {renderHomeSongCards(visibleSongs, "homeAlbumGrid simpleAlbumGrid libraryCoverCardsGridV321")}
                    </div>
                  ) : (
                    <div
                      className="songList fullList libraryFullListV025"
                      onDragOver={handleLibraryAreaDragOver}
                      onDragLeave={handleLibraryAreaDragLeave}
                      onDrop={handleLibraryAreaDrop}
                    >
                      {renderSongRows(visibleSongs, "songList fullList libraryFullListV025")}
                    </div>
                  )
                ) : (
                  <div className="songList fullList libraryFullListV025 emptyStateCenterV466">
                    <LocaltifyStateCard
                      centered
                      cute
                      badge={showingMissingFiles ? "✓" : view === "liked" ? "♡" : query.trim() ? "⌕" : "♪"}
                      tone={showingMissingFiles ? "success" : view === "liked" || query.trim() ? "info" : "warning"}
                      eyebrow={showingMissingFiles ? "file check" : view === "liked" ? "liked songs" : query.trim() ? "search" : "library"}
                      title={showingMissingFiles ? "All files are cozy" : view === "liked" ? "No liked songs yet" : query.trim() ? "No songs found" : "No songs yet"}
                      message={showingMissingFiles ? "Every song Localtify knows about is available on this PC right now." : view === "liked" ? "Tap the heart on any song you enjoy and it will show up here." : query.trim() ? "Nothing matched that search. Try a softer title, artist, album, or file name." : "Drop your music here and I’ll keep it cozy."}
                      detail={showingMissingFiles ? "Switch back to all tracks to continue browsing your library." : view === "liked" ? "This is only your local library. Nothing is uploaded anywhere." : query.trim() ? "Your library is still here, the search just got too specific." : "Import a few songs and Localtify will build your shelves, albums, covers, and playlists from them."}
                      actions={showingMissingFiles ? (
                        <button className="softButton" type="button" onClick={() => setLibraryFilterMode?.("all")}>show all tracks</button>
                      ) : view === "liked" ? (
                        <button className="softButton" type="button" onClick={() => changeView("library", "empty-liked")}>browse library</button>
                      ) : query.trim() ? (
                        <button className="softButton" type="button" onClick={() => handleSearchInput("")}>clear search</button>
                      ) : (
                        <button className="mainAction" type="button" onClick={importSongs}>import songs</button>
                      )}
                    />
                  </div>
                )}
              </section>
            )}


            {view === "albums" && (
              <section className="albumsPageV318">
                <section className="albumsHeroPanelV318">
                  <div className="albumsHeroArtClusterV318" aria-hidden="true">
                    {(selectedAlbum?.songs || localAlbums[0]?.songs || songs).slice(0, 4).map((song, index) => (
                      <Cover key={`${song.id}-${index}`} song={song} className={`albumsHeroMiniCoverV318 cover${index + 1}`} />
                    ))}
                  </div>
                  <div className="albumsHeroCopyV318">
                    <p className="eyebrow">local albums</p>
                    <h3>your albums your way</h3>
                    <p>
                      group albums from file tags, build your own, or import real album folders from disk.
                    </p>
                    <div className="albumsHeroActionsV318">
                      <button className="mainAction" type="button" onClick={() => openCreateAlbumBuilder(currentSong || songs[0] || null)}>add album</button>
                      <button className="heroGhost" type="button" onClick={() => void scanAlbumFolderImport("single")} disabled={albumFolderImportBusy}>import album folder</button>
                      <button className="heroGhost" type="button" onClick={() => void scanAlbumFolderImport("library")} disabled={albumFolderImportBusy}>import album library</button>
                    </div>
                  </div>
                  <div className="albumsHeroStatsV318" aria-label="album summary">
                    <span><strong>{localAlbums.length}</strong><small>albums</small></span>
                    <span><strong>{manualAlbumEntries.length}</strong><small>made by you</small></span>
                    <span><strong>{metadataAlbums.length}</strong><small>from tags</small></span>
                  </div>
                </section>

                {(albumFolderImportBusy || albumFolderImportPreview || albumFolderImportMessage) ? (
                  <section className={`albumFolderImportPanelV309 ${albumFolderImportPreview?.albums?.length ? "hasPreview" : ""}`}>
                    <div className="albumFolderImportHeaderV309">
                      <div>
                        <p className="eyebrow">folder album import</p>
                        <h3>{albumFolderImportBusy ? "Scanning your folder" : albumFolderImportPreview?.albums?.length ? "Ready to import" : "Album folder importer"}</h3>
                        <p>{albumFolderImportMessage || "Choose one album folder, or choose a parent folder that contains separate album folders."}</p>
                      </div>

                      <div className="albumFolderImportActionsV309">
                        <button className="heroGhost" type="button" onClick={() => void scanAlbumFolderImport("single")} disabled={albumFolderImportBusy}>import one album</button>
                        <button className="heroGhost" type="button" onClick={() => void scanAlbumFolderImport("library")} disabled={albumFolderImportBusy}>import album library</button>
                        {(albumFolderImportPreview || albumFolderImportMessage) && !albumFolderImportBusy ? (
                          <button className="heroGhost" type="button" onClick={cancelAlbumFolderImportPreview}>clear</button>
                        ) : null}
                      </div>
                    </div>

                    {albumFolderImportProgress ? (
                      <div className="albumFolderProgressV309" role="status" aria-live="polite">
                        <span>
                          <i style={{ width: `${albumFolderImportProgress.total ? Math.min(100, Math.max(5, ((albumFolderImportProgress.index || 0) / albumFolderImportProgress.total) * 100)) : albumFolderImportBusy ? 42 : 100}%` }} />
                        </span>
                        <small>{albumFolderImportProgress.message || albumFolderImportMessage}</small>
                      </div>
                    ) : null}

                    {albumFolderImportPreview?.albums?.length ? (
                      <>
                        <div className="albumFolderImportSummaryV309">
                          <span><strong>{albumFolderImportPreview.albumCount || albumFolderImportPreview.albums.length}</strong><small>albums found</small></span>
                          <span><strong>{albumFolderImportPreview.trackCount || 0}</strong><small>tracks</small></span>
                          <span><strong>{albumFolderImportPreview.duplicateCount || 0}</strong><small>already in library</small></span>
                        </div>

                        <div className="albumFolderPreviewGridV309">
                          {albumFolderImportPreview.albums.slice(0, 10).map((album: any) => (
                            <article key={album.id || album.sourcePath} className="albumFolderPreviewCardV309">
                              <div className="albumFolderPreviewCoverV309">
                                {album.coverUrl ? <img src={album.coverUrl} alt="" width={96} height={96} loading="lazy" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" draggable={false} /> : <span><EmptyCoverIcon /></span>}
                              </div>
                              <div className="albumFolderPreviewCopyV309">
                                <strong title={album.title}>{album.title}</strong>
                                <small title={album.artist}>{album.artist}</small>
                                <em>{album.trackCount} track{album.trackCount === 1 ? "" : "s"}{album.duplicateCount ? ` � ${album.duplicateCount} already added` : ""}</em>
                                {album.sourcePath ? <b title={album.sourcePath}>{album.sourcePath}</b> : null}
                                {album.warnings?.length ? (
                                  <ul>
                                    {album.warnings.slice(0, 3).map((warning: string) => <li key={warning}>{warning}</li>)}
                                  </ul>
                                ) : null}
                              </div>
                            </article>
                          ))}
                        </div>

                        <div className="albumFolderImportFooterV309">
                          <button className="mainAction" type="button" onClick={() => void commitAlbumFolderImportPreview()} disabled={albumFolderImportBusy}>
                            {albumFolderImportBusy ? "importing..." : "import albums"}
                          </button>
                          <button className="heroGhost" type="button" onClick={cancelAlbumFolderImportPreview} disabled={albumFolderImportBusy}>cancel</button>
                        </div>
                      </>
                    ) : !albumFolderImportBusy && albumFolderImportPreview ? (
                      <div className="albumFolderEmptyV309">
                        <strong>No album folders found</strong>
                        <p>Pick a folder that contains audio files, or choose a parent folder where each album has its own subfolder.</p>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <section className="albumsShelfPanelV318">
                  <div className="albumsToolbarV318">
                    <div>
                      <p className="eyebrow">browse</p>
                      <h3>album shelf</h3>
                    </div>
                    <div className="albumsControlsV318">
                      <input
                        value={albumSearch}
                        onChange={(event) => setAlbumSearch(event.currentTarget.value)}
                        placeholder="search albums or artists"
                        aria-label="search albums"
                      />
                      <select value={albumSortMode} onChange={(event) => setAlbumSortMode(event.currentTarget.value)} aria-label="sort albums">
                        <option value="recent">recently added</option>
                        <option value="title">title</option>
                        <option value="artist">artist</option>
                        <option value="year">year</option>
                      </select>
                    </div>
                  </div>

                  {visibleAlbums.length ? (
                    <div className="albumsGridV318">
                      {visibleAlbums.map((album, index) => {
                        const isManual = (album as any).source === "manual";
                        return (
                          <button
                            key={album.id}
                            type="button"
                            className={`albumCardV318 ${selectedAlbum?.id === album.id ? "active" : ""}`}
                            onClick={() => setSelectedAlbumId(album.id)}
                            style={{ "--album-card-delay": `${Math.min(index, 18) * 14}ms` } as CSSProperties}
                          >
                            <Cover song={album.coverSong} className="albumCardCoverV318" />
                            <span className="albumCardSheenV318" aria-hidden="true" />
                            <span className="albumCardMetaV318">
                              <small>{isManual ? ((album as any).sourceType === "folder" ? "folder album" : "your album") : "from file tags"}</small>
                              <strong title={album.title}>{prettyTitle(album.title, 6)}</strong>
                              <em title={album.artist}>{prettyMeta(album.artist)}</em>
                              <b>{album.trackCount} track{album.trackCount === 1 ? "" : "s"}{album.year ? ` ${album.year}` : ""}</b>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="albumsEmptyStateV318 albumsEmptyStateV373 emptyStateCenterV466">
                      <LocaltifyStateCard
                        centered
                        cute
                        badge="▣"
                        tone="info"
                        eyebrow="albums"
                        title="No albums yet"
                        message="Give Localtify an album folder and it’ll make the shelf feel tidy."
                        detail="Best folder shape: Album name → tracks → cover.jpg or folder.png."
                        actions={
                          <>
                            <button className="mainAction" type="button" onClick={() => void scanAlbumFolderImport("single")} disabled={albumFolderImportBusy}>
                              import album folder
                            </button>
                            <button className="softButton" type="button" onClick={() => void scanAlbumFolderImport("library")} disabled={albumFolderImportBusy}>
                              import album library
                            </button>
                            <button className="heroGhost" type="button" onClick={() => openCreateAlbumBuilder(currentSong || songs[0] || null)}>
                              create manually
                            </button>
                          </>
                        }
                      />
                    </div>
                  )}
                </section>

                <section className="albumDetailPanelV318">
                  {selectedAlbum ? (
                    <>
                      <div className="albumDetailHeroV318" style={{ "--album-hero-cover": selectedAlbum.coverSong ? toCssUrl(getSongAmbientSource(selectedAlbum.coverSong)) : "none" } as CSSProperties}>
                        <Cover song={selectedAlbum.coverSong} className="albumDetailCoverV318" />
                        <div className="albumDetailCopyV318">
                          <p className="eyebrow">{selectedAlbumIsFolder ? "folder album" : selectedAlbumIsManual ? "custom album" : "album"}</p>
                          <h3 title={selectedAlbum.title}>{selectedAlbum.title}</h3>
                          <p>{selectedAlbum.artist}</p>
                          <div className="albumMetaPillsV318">
                            <span>{selectedAlbum.trackCount} track{selectedAlbum.trackCount === 1 ? "" : "s"}</span>
                            <span>{formatTime(selectedAlbum.totalDuration)}</span>
                            {selectedAlbum.year ? <span>{selectedAlbum.year}</span> : null}
                            {selectedAlbumIsFolder && (selectedAlbum as any).sourcePath ? <span title={(selectedAlbum as any).sourcePath}>folder import</span> : null}
                          </div>
                          <div className="albumActionRowV318">
                            <button className="mainAction" type="button" onClick={() => playAlbumSongs?.(selectedAlbumIds, selectedAlbum.title)} disabled={!selectedAlbumIds.length || !playAlbumSongs}>play</button>
                            <button className="heroGhost" type="button" onClick={() => shuffleAlbumSongs?.(selectedAlbumIds, selectedAlbum.title)} disabled={selectedAlbumIds.length < 2 || !shuffleAlbumSongs}>shuffle</button>
                            <button className="heroGhost" type="button" onClick={() => queueAlbumSongs?.(selectedAlbumIds, selectedAlbum.title)} disabled={!selectedAlbumIds.length || !queueAlbumSongs}>queue</button>
                            {selectedAlbumIsManual ? <button className="heroGhost" type="button" onClick={() => openEditAlbumBuilder(selectedAlbum)}>edit</button> : null}
                          </div>
                        </div>
                      </div>

                      <div className="albumTrackListV318">
                        {selectedAlbum.songs.map((song, index) => {
                          const active = song.id === currentId;
                          return (
                            <article key={song.id} className={`albumTrackRowV318 ${active ? "active" : ""}`}>
                              <button type="button" className="albumTrackMainV318" onClick={() => void selectSong(song.id, true)}>
                                <span>{String(index + 1).padStart(2, "0")}</span>
                                <Cover song={song} className="albumTrackCoverV318" />
                                <span>
                                  <strong title={song.title}>{prettyTitle(song.title, 10)}</strong>
                                  <small>{prettyMeta(song.artist)}</small>
                                </span>
                              </button>
                              <span className="albumTrackDurationV318">{formatTime(song.duration)}</span>
                              <button className={`iconAction likeActionV443 noActionHoverV444 ${song.liked ? "liked likeActionActiveV443" : ""}`} type="button" onClick={() => toggleLike(song.id)} aria-label={song.liked ? "unlike song" : "like song"} aria-pressed={song.liked}>
                                <LikeHeartAnimationV443 liked={song.liked} />
                              </button>
                              <button className="iconAction" type="button" onClick={() => openPlaylistPicker(song)} aria-label="add to playlist">+</button>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="albumsEmptyStateV318 albumDetailEmptyV318">
                      <LocaltifyStateCard
                        tone="info"
                        eyebrow="album detail"
                        title="Choose an album"
                        message={visibleAlbums.length ? "Pick an album from the shelf and its tracks will appear here." : "Once you import an album folder, this panel will show the track list, duration, and quick actions."}
                      />
                    </div>
                  )}
                </section>

                <section ref={albumBuilderSectionRef} className={`albumBuilderPanelV318 ${albumBuilderOpen ? "open" : ""}`}>
                  <div className="albumBuilderHeaderV318">
                    <div>
                      <p className="eyebrow">{albumBuilderMode === "edit" ? "edit custom album" : "create"}</p>
                      <h3>{albumBuilderMode === "edit" ? "edit album" : "add local album"}</h3>
                    </div>
                    <button className="heroGhost" type="button" onClick={albumBuilderOpen ? closeAlbumBuilder : () => openCreateAlbumBuilder(currentSong || songs[0] || null)}>
                      {albumBuilderOpen ? "close" : "open builder"}
                    </button>
                  </div>

                  {albumBuilderOpen ? (
                    <div className="albumBuilderBodyV318">
                      <div className="albumBuilderFieldsV318">
                        <div className="albumBuilderCoverPickerV319">
                          <Cover song={albumDraftPreviewCoverSong} className="albumBuilderCoverPreviewV319" />
                          <div className="albumBuilderCoverCopyV319">
                            <strong>album cover</strong>
                            <span>{albumDraftCoverUrl ? "cover ready" : albumDraftPreviewCoverSong ? "using a song cover" : "choose a cover image"}</span>
                            <div className="albumBuilderCoverActionsV319">
                              <button className="heroGhost" type="button" onClick={openAlbumCoverPicker}>choose image</button>
                              {albumDraftCoverUrl ? <button className="heroGhost" type="button" onClick={clearAlbumDraftCover}>use song cover</button> : null}
                            </div>
                          </div>
                          <input
                            ref={albumCoverInputRef}
                            className="albumCoverFileInputV319"
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                            onChange={handleAlbumCoverFile}
                          />
                        </div>
                        <label>
                          <span>album title</span>
                          <input value={albumDraftTitle} onChange={(event) => setAlbumDraftTitle(event.currentTarget.value)} placeholder="album name" />
                        </label>
                        <label>
                          <span>album artist</span>
                          <input value={albumDraftArtist} onChange={(event) => setAlbumDraftArtist(event.currentTarget.value)} placeholder={albumDraftHasVariousArtists ? "various artists" : "artist name"} />
                          <div className="albumBuilderArtistToolsV320">
                            <small>{albumDraftArtistPreview}</small>
                            {albumDraftArtistNames.length ? (
                              <button className="heroGhost" type="button" onClick={() => setAlbumDraftArtist(albumDraftArtistSuggestion)}>
                                use suggestion
                              </button>
                            ) : null}
                          </div>
                        </label>
                        <label>
                          <span>year</span>
                          <input value={albumDraftYear} onChange={(event) => setAlbumDraftYear(event.currentTarget.value)} placeholder="optional" inputMode="numeric" />
                        </label>
                      </div>

                      <div className="albumBuilderPickerV318">
                        <div className="albumBuilderSearchRowV318">
                          <input value={albumDraftSearch} onChange={(event) => setAlbumDraftSearch(event.currentTarget.value)} placeholder="search songs" />
                          <span>{albumDraftSongIds.length} selected</span>
                        </div>
                        <div className="albumBuilderSongGridV318">
                          {albumDraftSearchResults.map((song) => {
                            const selected = albumDraftSongIds.includes(song.id);
                            return (
                              <button key={song.id} type="button" className={selected ? "selected" : ""} onClick={() => toggleAlbumDraftSong(song.id)}>
                                <Cover song={song} className="albumBuilderSongCoverV318" />
                                <span>
                                  <strong>{prettyTitle(song.title, 8)}</strong>
                                  <small>{prettyMeta(song.artist)}</small>
                                </span>
                                <b>{selected ? <CheckMiniIcon /> : <PlusMiniIcon />}</b>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="albumBuilderFooterV318">
                        <div className="albumBuilderPreviewV318">
                          <Cover song={albumDraftPreviewCoverSong} className="albumBuilderPreviewCoverV318" />
                          <span>{albumDraftSongIds.length ? `${albumDraftSongIds.length} selected cover fits square` : "choose songs for this album"}</span>
                        </div>
                        <div className="albumBuilderActionsV318">
                          {albumBuilderMode === "edit" && selectedAlbumIsManual ? <button className="heroGhost danger" type="button" onClick={() => deleteManualAlbum(selectedAlbum)}>delete</button> : null}
                          <button className="mainAction" type="button" onClick={saveManualAlbumFromDraft} disabled={!albumDraftSongIds.length}>{albumBuilderMode === "edit" ? "save album" : "create album"}</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="albumBuilderClosedTextV318">build albums from any songs in your library.</p>
                  )}
                </section>
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
                        {selectedPlaylist ? (
                          <>
                            {selectedPlaylistSongs.length} song{selectedPlaylistSongs.length === 1 ? "" : "s"}
                            <MetaDividerDot />
                            {formatTime(selectedPlaylistDuration)} total
                          </>
                        ) : (
                          "Create a playlist, add songs, and keep your local music feeling familiar."
                        )}
                      </p>
                    </div>

                    {selectedPlaylist ? renderPlaylistCollage(selectedPlaylistSongs, "playlistHeroCollage playlistCoverCollage") : (
                      <div className="playlistHeroCollage playlistCoverCollage playlistEmptyCollage" aria-hidden="true">
                        <div className="playlistCoverTile empty"><span><EmptyCoverIcon /></span></div>
                        <div className="playlistCoverTile empty"><span><PlusMiniIcon /></span></div>
                        <div className="playlistCoverTile empty"><span><EmptyCoverIcon /></span></div>
                        <div className="playlistCoverTile empty"><span><EmptyCoverIcon /></span></div>
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
                    <p className="softText">Night drive, gaming, school, sad songs � whatever fits.</p>
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
                            <small>{songCount} song{songCount === 1 ? "" : "s"}<MetaDividerDot />{formatTime(duration)}</small>
                          </span>
                          <span className="playlistShelfDropHint">{activePlaylistId === playlist.id ? "playing" : "drop song"}</span>
                        </button>
                      )) : (
                        <LocaltifyStateCard
                          centered
                          cute
                          badge="♫"
                          tone={songs.length ? "info" : "warning"}
                          eyebrow="playlists"
                          title="No playlists yet"
                          message={songs.length ? "Create a tiny mix and give your favorite songs a cozy corner." : "Import songs first, then make a playlist for gaming, studying, edits, or night drives."}
                          detail={songs.length ? "Tip: you can also drag songs into a playlist card." : "Playlists are local and private."}
                          actions={songs.length ? (
                            <button className="mainAction" type="button" onClick={() => {
                              if (!newPlaylistName.trim()) setNewPlaylistName("my mix");
                              window.setTimeout(() => createPlaylist(), 0);
                            }}>
                              create playlist
                            </button>
                          ) : (
                            <button className="mainAction" type="button" onClick={importSongs}>import songs</button>
                          )}
                        />
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
              <>
              {!songs.length ? (
                <LocaltifyStateCard
                  centered
                  cute
                  badge="✦"
                  tone="info"
                  eyebrow="covers"
                  title="Covers need songs first"
                  message="Import music, then the cover studio can dress every track up properly."
                  detail="Your empty-state art will show here too, so the page still feels cute before the library exists."
                  actions={<button className="mainAction" type="button" onClick={importSongs}>import songs</button>}
                />
              ) : !filteredCoverGalleryAssets.length && !pixelArtBusy ? (
                <LocaltifyStateCard
                  centered
                  cute
                  badge="☁"
                  tone="warning"
                  eyebrow="covers"
                  title="No pixel covers found"
                  message="The cover shelf is empty right now, but your songs are safe."
                  detail="Rescan covers or add image files to your pixelart folder. Songs will keep using their existing covers."
                  actions={<button className="mainAction" type="button" onClick={() => void rescanPixelArtFolder()}>rescan covers</button>}
                />
              ) : null}

              <Suspense
                fallback={
                  <section className="panel coverStudioLoading" role="status" aria-live="polite">
                    <div className="panelHead">
                      <div>
                        <p className="eyebrow">covers</p>
                        <h3>loading cover studio</h3>
                        <p className="softText">cover tools load only when you open them now.</p>
                      </div>
                    </div>
                  </section>
                }
              >
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
              </Suspense>
              </>
            )}

            {view === "analytics" && (
              <section className="analyticsStudioV339" aria-label="lightweight listening recap">
                <section className="analyticsHeroV339">
                  <div className="analyticsHeroCopyV339">
                    <p className="eyebrow">local recap</p>
                    <h3>your listening, cleaned up</h3>
                    <p>
                      {songs.length
                        ? "Fast recap cards from your real local library data: imports, plays, listening time, file health, and library length without heavy charts."
                        : "Import songs and localtify will build a lightweight recap here."}
                    </p>
                  </div>

                  <div className="analyticsHeroMeterV339" aria-label="library readiness">
                    <span style={{ "--meter": `${playedPercent}%` } as CSSProperties}>
                      <strong>{playedPercent}%</strong>
                      <small>played</small>
                    </span>
                    <span style={{ "--meter": `${likedPercent}%` } as CSSProperties}>
                      <strong>{likedPercent}%</strong>
                      <small>liked</small>
                    </span>
                    <span style={{ "--meter": `${libraryHealthLabel === "healthy" ? 100 : Math.max(0, 100 - missingFileCount * 8)}%` } as CSSProperties}>
                      <strong>{libraryHealthLabel}</strong>
                      <small>health</small>
                    </span>
                  </div>
                </section>

                {!songs.length ? (
                  <LocaltifyStateCard
                    tone="info"
                    eyebrow="analytics"
                    title="Play songs first"
                    message="Your monthly and yearly recap appears after Localtify has songs and play history to read."
                    detail="Localtify only uses your local library data: play counts, durations, imports, liked songs, and missing-file checks."
                    actions={<button className="mainAction" type="button" onClick={importSongs}>import songs</button>}
                  />
                ) : missingFileCount ? (
                  <LocaltifyStateCard
                    tone="warning"
                    eyebrow="library warning"
                    title="Some songs need attention"
                    message={`${missingFileCount} file${missingFileCount === 1 ? "" : "s"} could not be found on disk. Analytics still works, but those songs may not play until repaired.`}
                    detail="This usually happens when a file was moved, renamed, or deleted outside Localtify."
                  />
                ) : null}

                <section className="analyticsRecapGridV339" aria-label="recap cards">
                  {(analyticsRecapCards || []).map((card, index) => {
                    const progress =
                      typeof card.progress === "number"
                        ? Math.min(100, Math.max(songs.length ? 4 : 0, card.progress))
                        : index === 0
                          ? Math.min(100, Math.max(4, recentImportWeekCount * 12))
                          : index === 1
                            ? Math.min(100, Math.max(4, songs.length ? 64 : 4))
                            : Math.min(100, Math.max(4, playedPercent));

                    return (
                      <article
                        key={card.label}
                        className={`analyticsRecapCardV339 recap-${index}`}
                        style={{ "--recap-progress": `${progress}%` } as CSSProperties}
                      >
                        <span>{card.label}</span>
                        <strong title={card.value}>{card.value}</strong>
                        <small>{card.note}</small>
                        <em>{card.meta}</em>
                        <i aria-hidden="true" />
                      </article>
                    );
                  })}
                </section>

                <section className="analyticsSnapshotV339" aria-label="quick stats">
                  {analyticsStatCards.map((card) => (
                    <article key={card.label} className="analyticsSnapshotCardV339">
                      <span>{card.label}</span>
                      <strong title={card.value}>{card.value}</strong>
                      <small>{card.note}</small>
                    </article>
                  ))}
                </section>

                <section className="analyticsMiniBoardV339" aria-label="recap helper">
                  <div className="analyticsMiniCardV339">
                    <span>this week</span>
                    <strong>{recentImportWeekCount.toLocaleString()}</strong>
                    <small>new import{recentImportWeekCount === 1 ? "" : "s"}</small>
                  </div>

                  <div className="analyticsMiniCardV339">
                    <span>library length</span>
                    <strong>{libraryLengthLabel}</strong>
                    <small>{averageSongSeconds ? `${formatTime(averageSongSeconds)} average track` : "import songs to calculate"}</small>
                  </div>

                  <div className="analyticsMiniCardV339">
                    <span>needs attention</span>
                    <strong>{(missingFileCount + neverPlayedSongs.length).toLocaleString()}</strong>
                    <small>{missingFileCount ? `${missingFileCount} missing file${missingFileCount === 1 ? "" : "s"}` : `${neverPlayedSongs.length} never played`}</small>
                  </div>

                  <div className="analyticsMiniCardV339">
                    <span>longest track</span>
                    <strong>{longestSong ? formatTime(longestSong.duration || 0) : "�"}</strong>
                    <small>{longestSong ? prettyTitle(longestSong.title, 5) : "no songs yet"}</small>
                  </div>
                </section>

                <section className="analyticsSharePanelV339">
                  <div>
                    <p className="eyebrow">recap ready</p>
                    <h3>built for monthly or yearly posts</h3>
                    <p>
                      Use the recap cards above for a clean localtify wrapped-style summary. These numbers come from local song metadata and saved play counts, so they stay lightweight and private.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="softButton analyticsShareButtonV339"
                    onClick={() => navigator.clipboard?.writeText?.(`localtify recap: ${analyticsRecapCards.map((card) => `${card.label}: ${card.value}`).join(" � ")}`)}
                    disabled={!songs.length}
                  >
                    copy recap line
                  </button>
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
                      <p className="softText">Paste a YouTube or Spotify link. Localtify keeps the rest quiet.</p>
                    </div>

                    <div className="downloadHeroActions downloadHeroActionsCompactV475">
                      <button className="softButton" onClick={() => window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined)}>
                        folder
                      </button>
                      <button className="softButton" onClick={() => { changeView("settings", "unknown"); setSettingsCategory("downloads"); }}>
                        settings
                      </button>
                    </div>
                  </div>

                  {/* -- Source tabs -------------------------------- */}
                  <div className="downloadTabStrip">
                    <button
                      className={downloadsTab === "youtube" ? "downloadTab active" : "downloadTab"}
                      onClick={() => setDownloadsTab("youtube")}
                    >
                      YouTube
                    </button>
                    <button
                      className={downloadsTab === "spotify" ? "downloadTab active spotifyTab" : "downloadTab"}
                      onClick={() => setDownloadsTab("spotify")}
                    >
                      <span className="spotifyTabDot" aria-hidden="true" />
                      Spotify
                    </button>
                  </div>

                  {/* -- YouTube tab --------------------------------- */}
                  {downloadsTab === "youtube" && (
                    <>
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

                       </div>
                    </>
                  )}

                  {/* -- Spotify tab --------------------------------- */}
                  {downloadsTab === "spotify" && (
                    <>
                      {/* -- Auth status card -- */}
                      <div className={`spotifyAuthCard${spotifyLoggedIn ? " loggedIn" : ""}`}>
                        <div className="spotifyAuthLeft">
                          <span className="spotifyAuthDot" aria-hidden="true" />
                          <div>
                            <strong>{spotifyLoggedIn ? "Spotify connected" : "Spotify import"}</strong>
                            <p>Paste a public Spotify link and choose what to fetch.</p>
                          </div>
                        </div>
                        <div className="spotifyAuthActions">
                          <button
                            className="heroMain spotifyAuthBtn"
                            onClick={() => void handleSpotifyLogin()}
                            disabled={spotifyLoginBusy}
                          >
                            {spotifyLoginBusy ? "opening..." : spotifyLoggedIn ? "reconnect" : "connect spotify"}
                          </button>
                          {spotifyLoggedIn ? (
                            <button
                              className="softButton spotifyAuthBtn"
                              onClick={() => void handleSpotifyLogout()}
                              disabled={spotifyLoginBusy}
                            >
                              disconnect
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* -- URL fetch -- */}
                       <div className="spotifyUrlRow">
                        <input
                          type="url"
                          className="downloadTextarea downloadTextareaV031 spotifyUrlInput"
                          value={spotifyUrl}
                          onChange={(e) => { setSpotifyUrl(e.currentTarget.value); setSpotifyFetchError(""); }}
                          placeholder="paste spotify playlist, album, or track link"
                          disabled={spotifyFetchBusy || spotifyDownloadBusy}
                          onKeyDown={(e) => { if (e.key === "Enter" && spotifyUrl.trim()) void fetchSpotifyTracks(); }}
                        />
                        <button
                          className="heroMain spotifyFetchButton"
                          onClick={() => void fetchSpotifyTracks()}
                          disabled={spotifyFetchBusy || spotifyDownloadBusy || !spotifyUrl.trim()}
                        >
                          {spotifyFetchBusy ? "fetching..." : "fetch"}
                        </button>
                      </div>

                      {spotifyFetchError ? (
                        <div className="spotifyError spotifyErrorV326">
                          <strong>Spotify needs attention</strong>
                          <span>{spotifyFetchError}</span>
                        </div>
                      ) : null}

                      {/* -- Track list -- */}
                      {spotifyTracks.length > 0 && (
                        <div className="spotifyTrackList">
                          <div className="spotifyTrackListHead">
                            <strong>{spotifyTracks.length} track{spotifyTracks.length !== 1 ? "s" : ""} found</strong>
                            <div className="spotifySelectActions">
                              <button
                                className="softButton"
                                onClick={() => setSpotifySelectedIds(new Set(spotifyTracks.map((t) => t.id)))}
                                disabled={spotifyDownloadBusy}
                              >
                                all
                              </button>
                              <button
                                className="softButton"
                                onClick={() => setSpotifySelectedIds(new Set())}
                                disabled={spotifyDownloadBusy}
                              >
                                none
                              </button>
                            </div>
                          </div>

                          <div className="spotifyTrackItems">
                            {spotifyTracks.map((track, i) => {
                              const selected = spotifySelectedIds.has(track.id);
                              const statusLabel = spotifyTrackStatusLabel(track, selected);
                              const failed = track.downloadStatus === "failed";
                              const done = track.downloadStatus === "done";
                              const coverUrl = track.coverUrl || track.spotifyCoverUrl || track.albumCoverUrl;

                              return (
                                <button
                                  key={track.id}
                                  className={`spotifyTrackItem spotifyTrackItemV326${selected ? " selected" : ""}${failed ? " failed" : ""}${done ? " done" : ""}`}
                                  type="button"
                                  disabled={spotifyDownloadBusy}
                                  onClick={() => {
                                    setSpotifySelectedIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(track.id)) next.delete(track.id);
                                      else next.add(track.id);
                                      return next;
                                    });
                                  }}
                                >
                                  {coverUrl ? (
                                    <span className="spotifyTrackArt" aria-hidden="true">
                                      <img src={coverUrl} alt="" width={56} height={56} loading="lazy" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" draggable={false} />
                                    </span>
                                  ) : (
                                    <span className="spotifyTrackIndex">{String(i + 1).padStart(2, "0")}</span>
                                  )}
                                  <div className="spotifyTrackMeta">
                                    <div className="spotifyTrackTitleLine">
                                      <strong>{track.title}</strong>
                                      <span className="spotifySourceBadge">Spotify</span>
                                      <span className={`spotifyTrackStatus ${statusLabel.replace(/\s+/g, "-")}`}>{statusLabel}</span>
                                    </div>
                                    <p>{track.artist || "artist will be matched during download"}{track.albumName ? ` � ${track.albumName}` : ""}</p>
                                    {track.downloadMessage ? <small>{track.downloadMessage}</small> : null}
                                    {track.downloadError ? <small className="spotifyTrackError">{track.downloadError}</small> : null}
                                  </div>
                                  <span className="spotifyTrackCheck" aria-hidden="true">{selected ? <CheckMiniIcon /> : null}</span>
                                  {failed ? (
                                    <span
                                      className="spotifyRetryButton"
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void retrySpotifyTrack?.(track);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          void retrySpotifyTrack?.(track);
                                        }
                                      }}
                                    >
                                      retry
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>

                          <div className="downloadActions downloadActionsV031 spotifyDownloadRow">
                            <button
                              className="heroMain spotifyDownloadButton"
                              onClick={() => void downloadSpotifyTracks()}
                              disabled={spotifyDownloadBusy || !spotifySelectedIds.size}
                            >
                              {spotifyDownloadBusy
                                ? "downloading..."
                                : `download ${spotifySelectedIds.size} track${spotifySelectedIds.size !== 1 ? "s" : ""}`}
                            </button>
                            {spotifyDownloadBusy ? (
                              <button className="heroGhost dangerGhost" onClick={() => void cancelCurrentDownload()}>
                                cancel
                              </button>
                            ) : (
                              <button
                                className="heroGhost"
                                onClick={() => {
                                  setSpotifyTracks([]);
                                  setSpotifySelectedIds(new Set());
                                  setSpotifyUrl("");
                                  setSpotifyFetchError("");
                                }}
                              >
                                clear
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* -- Shared: queue, converter, results ----------- */}
                  {downloadQueue.length ? (
                    <div className="downloadQueuePanel">
                      <div className="panelHead smallPanelHead">
                        <div>
                          <p className="eyebrow">queue</p>
                          <h3>{downloadQueue.length} item{downloadQueue.length === 1 ? "" : "s"}</h3>
                        </div>
                        <div className="downloadQueueHeaderActions">
                          <span>{downloadBusy ? "working" : "ready"}</span>
                          <button
                            className="softButton tinyDownloadAction"
                            onClick={() => clearFinishedDownloads?.()}
                            disabled={downloadBusy || !downloadQueue.some((item) => item.status === "done")}
                          >
                            clear done
                          </button>
                          <button
                            className="softButton tinyDownloadAction"
                            onClick={() => clearFailedDownloads?.()}
                            disabled={downloadBusy || !downloadQueue.some((item) => item.status === "failed" || item.status === "cancelled")}
                          >
                            clear failed
                          </button>
                        </div>
                      </div>

                      <div className="downloadQueueList">
                        {downloadQueue.map((item, index) => {
                          const done = item.status === "done";
                          const failed = item.status === "failed" || item.status === "cancelled";
                          const downloadedNotImported = done && item.importedToLibrary === false;
                          const sourceLabel = item.source === "spotify" ? "Spotify" : "YouTube";

                          return (
                            <div
                              key={`${item.id}-${index}`}
                              className={`downloadQueueItem downloadQueueItemV338 ${item.status}${done ? " compactDone" : ""}${downloadedNotImported ? " notImported" : ""}`}
                            >
                              <div className="downloadQueueTop">
                                <span className="downloadQueueIndex">{String(index + 1).padStart(2, "0")}</span>
                                <div>
                                  <strong>{item.filename || item.title}</strong>
                                  <p>{item.message || downloadStatusLabel(item.status)}</p>
                                </div>
                                <small>{done ? "100%" : `${item.progress}%`}</small>
                              </div>

                              {!done || downloadedNotImported ? (
                                <div className="downloadQueueTrack"><i style={{ width: `${clamp(item.progress, 0, 100)}%` }} /></div>
                              ) : null}

                              <div className="downloadQueueMeta">
                                <span className="downloadSourceBadgeV338">{sourceLabel}</span>
                                <span>{item.statusLabel || downloadStatusLabel(item.status)}</span>
                                {item.speed ? <span>{item.speed}</span> : null}
                                {item.eta ? <span>ETA {item.eta}</span> : null}
                                {downloadedNotImported ? <span className="downloadWarnBadgeV338">downloaded, not imported</span> : null}
                                {item.error ? <span className="downloadErrorBadgeV338">{item.error}</span> : null}
                              </div>

                              <div className="downloadQueueActions">
                                {failed ? (
                                  <button className="softButton" onClick={() => void retryDownload(item.url, item.source === "spotify" ? "spotify" : "youtube", item.spotifyTrackId || "")}>retry</button>
                                ) : null}
                                {done && item.importedToLibrary !== false ? (
                                  <button className="softButton" onClick={() => openDownloadedSongInLibrary(item)}>open in library</button>
                                ) : null}
                                {downloadedNotImported ? (
                                  <button className="softButton" onClick={() => window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined)}>open folder</button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {!downloadQueue.length && !downloadResults.length && !downloadBusy && !spotifyDownloadBusy ? (
                    <LocaltifyStateCard
                      centered
                      cute
                      badge="↓"
                      tone="info"
                      eyebrow="downloads"
                      title="No downloads yet"
                      message="Paste a link and Localtify will bring the audio home."
                      detail="YouTube links go in the YouTube tab. Spotify playlists, albums, or tracks go in the Spotify tab."
                      actions={
                        <>
                          <button className="mainAction" type="button" onClick={() => setDownloadsTab("youtube")}>YouTube download</button>
                          <button className="softButton" type="button" onClick={() => setDownloadsTab("spotify")}>Spotify import</button>
                          <button className="heroGhost" type="button" onClick={convertLocalMedia}>convert local files</button>
                        </>
                      }
                    />
                  ) : null}

                  <div className="converterBox converterBoxV031">
                    <div>
                      <strong>convert local files</strong>
                      <p>Turn local video/audio files into library tracks.</p>
                    </div>

                    <button className="heroMain" onClick={convertLocalMedia} disabled={convertBusy}>
                      {convertBusy ? "converting..." : "choose files"}
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

                      {downloadResults.map((item: any, index) => {
                        const imported = item.importedToLibrary !== false;
                        const failed = !item.ok;
                        return (
                          <div
                            key={`${item.url || item.filename || index}`}
                            className={failed ? "downloadResult bad downloadResultV326" : imported ? "downloadResult ok downloadResultV326" : "downloadResult warn downloadResultV326"}
                          >
                            <span><ResultStatusIcon failed={failed} imported={imported} /></span>

                            <div>
                              <strong>{failed ? "Download failed" : imported ? "Added to library" : "Downloaded, not imported"}</strong>
                              <p>
                                {failed
                                  ? item.error || item.url || "unknown error"
                                  : imported
                                    ? item.filename || item.url || "downloaded audio"
                                    : "The file downloaded, but Localtify did not find it in the library. Check auto-add and the downloads folder."}
                              </p>
                              {!failed && imported ? <small className="downloadResultAddedV338">added to library</small> : null}
                              {!failed && !imported ? <small className="downloadResultWarnV338">downloaded, not imported</small> : null}
                            </div>

                            {failed ? (
                              <button className="softButton" onClick={() => void retryDownload(item.url || "", item.source === "spotify" ? "spotify" : "youtube", item.spotifyTrackId || "")}>retry</button>
                            ) : imported ? (
                              <button className="softButton" onClick={() => openDownloadedSongInLibrary(item)}>open in library</button>
                            ) : (
                              <button className="softButton" onClick={() => window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined)}>open folder</button>
                            )}
                          </div>
                        );
                      })}
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
              <div className={`playerArtSwap nowPlayingPlayerArtSwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
                <Cover song={currentSong} className="smallArt" priority="high" />
              </div>

              <div className={`playerMeta nowPlayingMiniCopySwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
                <strong className={`nowPlayingMiniTitleSwap ${nowPlayingSongMotionClass}`} title={currentSong ? currentSong.title : ""}>
                  {currentSong ? prettyTitle(currentSong.title, 7) : "nothing playing"}
                </strong>
                <p className={`nowPlayingMiniArtistSwap ${nowPlayingSongMotionClass}`}>{currentSong ? prettyMeta(currentSong.artist) : "import a song to begin"}</p>
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
              <button className="closeModalButton" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} strokeWidth={2.4} /></button>
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
                <span className="songContextMenuIcon"><Play size={13} strokeWidth={3} /></span> play now
              </button>
              <button type="button" role="menuitem" onClick={() => { setSongContextMenu(null); queueSong(menuSong.id, true); }}>
                <span className="songContextMenuIcon"><SkipForward size={13} strokeWidth={3} /></span> play next
              </button>
              <button type="button" role="menuitem" onClick={() => { setSongContextMenu(null); openEditor(menuSong); }}>
                <span className="songContextMenuIcon"><Pencil size={13} strokeWidth={3} /></span> edit song data
              </button>
              <div className="songContextMenuDivider" aria-hidden="true" />
              <button type="button" role="menuitem" onClick={() => { setSongContextMenu(null); openPlaylistPicker(menuSong); }}>
                <span className="songContextMenuIcon"><Plus size={13} strokeWidth={3} /></span> add to playlist
              </button>
              <button type="button" role="menuitem" onClick={() => { setSongContextMenu(null); toggleLike(menuSong.id); }}>
                <span className="songContextMenuIcon"><Heart size={13} strokeWidth={3} /></span> {menuSong.liked ? "unlike" : "like"}
              </button>
              <button className="dangerMenuItem" type="button" role="menuitem" onClick={() => { setSongContextMenu(null); askRemoveSong(menuSong.id); }}>
                <span className="songContextMenuIcon"><Trash2 size={13} strokeWidth={3} /></span> remove from library
              </button>
            </div>
          </div>
        );
      })() : null}

      {whatsNewOpen ? (
        <div className="whatsNewOverlay" onClick={closeWhatsNew}>
          <section className="whatsNewCard" role="dialog" aria-modal="true" aria-labelledby="whatsNewTitle" onClick={(event) => event.stopPropagation()}>
            <button className="whatsNewClose" type="button" onClick={closeWhatsNew} aria-label="Close what's new"><X size={18} strokeWidth={2.4} /></button>
            <p className="eyebrow">what's new</p>
            <h3 id="whatsNewTitle">localtify {APP_VERSION}</h3>
            <p className="whatsNewSubtext">0.3.5 is a smoothness pass: CSS ownership is cleaner, hero expansion no longer replays the home page, proximity stays responsive, audio glow is scoped, and blur/ambience/motion stay enabled.</p>
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
              <div className="editorHeaderActions">
                <button className="closeModalButton editorCloseButton" type="button" onClick={() => setEditorSong(null)} aria-label="Close edit track dialog">
                  <X size={18} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            <div className="editorGrid editorGridBetter">
              <aside className="editorCoverBlock editorCoverBlockBetter">
                <div className="editorCoverShell">
                  <Cover song={editorSong} className="editorCover" />
                </div>

                <div className="editorCoverActions editorCoverActionsBetterV039">
                  <button className="softButton editorIconButton" disabled={pixelArtBusy} onClick={randomizeCover}>
                    <Shuffle size={15} strokeWidth={2.4} />
                    <span>random pixel art</span>
                  </button>
                  <button className="softButton editorIconButton" disabled={pixelArtBusy} onClick={pickCover}>
                    <ImagePlus size={15} strokeWidth={2.4} />
                    <span>choose image from pc</span>
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
                  <button className="softButton editorIconButton" onClick={() => toggleLike(editorSong.id)}>
                    {editorSong.liked ? <HeartOff size={15} strokeWidth={2.4} /> : <Heart size={15} strokeWidth={2.4} />}
                    <span>{editorSong.liked ? "unlike" : "like"}</span>
                  </button>

                  <button className="dangerButton editorIconButton" onClick={() => askRemoveSong(editorSong.id)}>
                    <Trash2 size={15} strokeWidth={2.4} />
                    <span>remove song</span>
                  </button>

                  <button className="heroMain editorIconButton" onClick={saveEditor}>
                    <Save size={15} strokeWidth={2.4} />
                    <span>save changes</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {playlistPickerSong ? (
        <div className="modalWrap playlistPickerWrap" onClick={() => { setPlaylistPickerSong(null); setPlaylistPickerName(""); }}>
          <div className="playlistPickerModal playlistPickerModalV444" role="dialog" aria-modal="true" aria-label="Add song to playlist" onClick={(event) => event.stopPropagation()}>
            <div className="modalHead playlistPickerHead">
              <div>
                <p className="eyebrow">add to playlist</p>
                <h3>{displaySongTitleV444(playlistPickerSong, 9)}</h3>
                <span className="editorHeadSub">{displaySongPickerSublineV444(playlistPickerSong)}</span>
              </div>
              <button className="closeModalButton" type="button" onClick={() => { setPlaylistPickerSong(null); setPlaylistPickerName(""); }} aria-label="close"><X size={18} strokeWidth={2.4} /></button>
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
        crossOrigin="anonymous"
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onPlay={() => {
          pendingPlayRef.current = false;
          setIsPlaying(true);
        }}
        onPause={() => {
          if (typeof handleAudioPause === "function") {
            handleAudioPause();
            return;
          }

          if (!audioRef.current?.ended) {
            setIsPlaying(false);
          }
        }}
        onLoadedMetadata={(event: SyntheticEvent<HTMLAudioElement>) => saveDuration(event.currentTarget.duration)}
        onDurationChange={(event: SyntheticEvent<HTMLAudioElement>) => saveDuration(event.currentTarget.duration)}
        onTimeUpdate={(event: SyntheticEvent<HTMLAudioElement>) => {
          if (typeof handleAudioTimeUpdate === "function") {
            handleAudioTimeUpdate(event);
            return;
          }

          const nextTime = event.currentTarget.currentTime;
          timeRef.current = nextTime;
          tickPlayCountTracker(nextTime);
        }}
        onEnded={() => {
          if (typeof handleAudioEnded === "function") {
            handleAudioEnded();
            return;
          }

          const endedSong = songRef.current || currentSong;
          markSongCompletedForPlayCount(endedSong);
          if (endedSong?.id) void patchSongLocal(endedSong.id, { playbackPosition: 0 });
          playNext(true, "auto");
        }}
        onError={() => {
          const audio = audioRef.current;
          const failedSong = songRef.current || currentSong;
          const failedCacheKey = getSongPlaybackSourceKey(failedSong);
          if (failedCacheKey) playbackUrlCacheRef.current.delete(failedCacheKey);

          setPlayerError(getAudioErrorText(audio));
          setStatusText("playback error");
          setIsPlaying(false);

          pendingPlayRef.current = false;
          resetPlayCountTracker();

          stopFade();
          if (typeof stopCrossfadeAuto === "function") stopCrossfadeAuto();
          stopProgressLoop();

          window.localitfy.clearDiscordActivity().catch(() => undefined);
        }}
      />
    </main>
  );
}


