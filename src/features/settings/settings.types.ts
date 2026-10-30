import type { DiscordActivityStyle, DiscordArtMode, DiscordSecondLine, DiscordTitleCleanup } from "../discord/discord.types";
import type { CoverColorSyncMode, ThemeId } from "./theme.types";

export type SettingsCategory = "appearance" | "playback" | "discord" | "library" | "downloads" | "covers" | "updates" | "about" | "advanced" | "metadata" | "experimental";
export type AudioEffectMode = "normal" | "nightcore" | "daycore";

export type Settings = {
  experimentalMusicAnalysis: boolean;
  analysisOnBattery: boolean;
  listeningHistoryEnabled: boolean;
  lyricsEnabled: boolean;
  lyricsOnlineLookup: boolean;
  musicbrainzTagging: boolean;
  musicbrainzWriteFiles: boolean;
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
  heroExpanded: boolean;
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
  idleScreensaverEnabled: boolean;
  showHeroBadge: boolean;
  simpleMode: boolean;
  lastSongId: string;
  homeBannerType: "dynamic" | "albumCover" | "cleanBlack" | "none";
  mediaCardBackground: "solid" | "glassy" | "oledFlat";
  homeLayoutMode: "compact" | "balanced" | "bigHero";
  libraryRowStyle: "compactRows" | "comfyRows" | "coverCards" | "listOnly";
  sidebarBehavior: "fixed" | "slim" | "hover";
  /** Saved tab order per customizable sidebar section; unknown or missing tabs fall back to the default order. */
  sidebarNavOrder: Partial<Record<"library" | "tools", string[]>>;
  sidebarHiddenNav: string[];
  /** Saved Home section order; unknown or missing sections fall back to the default order. */
  homeSectionOrder: string[];
  homeHiddenSections: string[];
  playerBackgroundStyle: "flat" | "coverBlur" | "oledBlack";
  /** Present in the persisted runtime defaults even though the old monolith type omitted it. */
  homeHeroCoverBrightness: number;
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
  /** When the queue runs out, keep playing songs that sound similar (needs music analysis). */
  songRadio: boolean;
  /** Song IDs and artist names left out of daily mixes, similar songs and song radio. */
  notForMeSongs: string[];
  notForMeArtists: string[];
  /** Discover sends artist names and song titles to Last.fm, so it stays off until turned on. */
  discoverEnabled: boolean;
  lastfmApiKey: string;
  volumeNormalization: boolean;
  perSongVolumeMemory: boolean;
  sleepTimerMinutes: number;
  playbackSpeed: number;
  audioEffectMode: AudioEffectMode;
  audioEffectAmount: number;
  audioReverbAmount: number;
  rememberPlaybackPosition: boolean;
  skipSilence: boolean;
  minimizeToTray: boolean;
  startWithWindows: boolean;
  downloadQuality: "best" | "320" | "256" | "192";
  downloadFormat: "mp3" | "flac" | "wav";
  /** Save YouTube's original audio stream (.opus/.m4a) instead of converting it. */
  downloadKeepOriginal: boolean;
  downloadAutoAdd: boolean;
  downloadCleanTitle: boolean;
  downloadFolder: string;
  /** Folders whose new audio files are imported automatically. */
  watchedFolders: string[];
};

export type CustomThemeColorKey =
  | "customThemeColor" | "customThemeColor2" | "customThemeBackground" | "customThemeSurface"
  | "customThemeText" | "customThemeHighlight" | "customThemeProgress";

export type CustomThemeColorPatch = Pick<Settings, CustomThemeColorKey>;
export type CustomThemePreset = {
  id: string;
  name: string;
  note: string;
  colors: CustomThemeColorPatch;
  custom?: boolean;
  createdAt?: number;
};
