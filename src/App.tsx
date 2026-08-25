/* localtify 0.4.1 V395 playback settings cleanup + faster volume changes. */
/* localtify 0.4.1 V396 audio engine stability pass. */
/* localtify 0.4.1 V419 background-audio and settings-save stability. */
/* localtify 0.4.1 V418 missing-file recovery actions. */
/* localtify 0.4.1 V425 cover tools + metadata cleaner preview. */
/* localtify 0.4.1 V423 like system + quick library modes. */
/* localtify 0.4.1 V417 metadata cleaner stability pass. */
/* localtify 0.4.1 V415 shuffle queue + context delete. */
import { lazy, startTransition, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import type { CSSProperties, PointerEvent, DragEvent, MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";
import {
  FolderPlus,
  Images,
  SkipBack,
  SkipForward,
  Repeat2,
  X,
  Send
} from "lucide-react";
import { useProximityMotion } from "./useProximityMotion";
import { HtmlAudioEngine } from "./player/htmlAudioEngine";
import { createPlayerController } from "./player/playerController";
import { usePlayerRuntime } from "./features/player";
import type { PlayerEngineSource } from "./player/PlayerEngine";
import {
  initLocalitfyAnalytics,
  trackAcquisitionSource,
  trackAppActive,
  trackAppBackgrounded,
  trackAppForegrounded,
  trackAppLaunched,
  trackAppSessionEnded,
  trackAppView,
  trackSettingsOpened,
  trackThemeChanged,
  trackSongsImported,
  trackImportFailed,
  trackLibrarySnapshot,
  trackLibraryViewChanged,
  trackDownloadsOpened,
  trackDiscordToggled,
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  trackError
} from "./analytics";
import { useAnalyticsRuntime } from "./features/analytics/useAnalyticsRuntime";
import {
  enrichDownloadResultsWithLibraryMatches,
  friendlyDownloadError,
  makeQueuedDownloads,
  parseDownloadUrls,
  useDownloadsRuntime
} from "./features/downloads/useDownloadsRuntime";
import { getDownloadPageState } from "./features/downloads/downloadState";
import { downloadStatusLabel, spotifyTrackStatusLabel } from "./features/downloads/download.selectors";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./styles/tokens.css";
import "./features/shell/app-core.css";
import "./App.css";
import "./features/settings/themes.css";
import "./features/settings/settings.css";
import "./features/home/home.css";
import "./features/shell/motion.css";
import "./features/onboarding/onboarding.css";
import "./features/player/player.css";
import "./features/shell/effects.css";

import AppShell from "./features/shell/AppShell";
import type { AppShellProps } from "./features/shell/appShell.contract";
import { useAppToast } from "./features/shell/useAppToast";
import { useScreensaverController } from "./features/shell/useScreensaverController";
import { useDiagnosticsInfo } from "./features/shell/useDiagnosticsInfo";
import { useFeedbackController } from "./features/feedback";
import { usePlaylistsController } from "./features/playlists";
import { useAlbumsController } from "./features/albums/useAlbumsController";
import { updateStatusLabel, useUpdatesController } from "./features/updates";
import { useSettingsController } from "./features/settings";
import { Cover } from "./features/covers/Cover";
import { useCoversController } from "./features/covers";
import { VirtualHomeSongCards, VirtualSongRows } from "./features/library/components/SongRows";
import { useLibraryController } from "./features/library";
import Onboarding from "./Onboarding";
import CatBuddy from "./CatBuddy";
import { PlayerPlayPauseMorphIcon } from "./features/player/PlayerPlayPauseMorphIcon";
import { runLocaltifyIdleTask } from "./app/runtime/idle";
import { useBodyRuntimeClasses } from "./app/runtime/useBodyRuntimeClasses";
import { useAppLifecycleRuntime } from "./app/runtime/useAppLifecycleRuntime";
import { formatAnalyticsDuration, localtifyAnalyticsNumber, localtifyAnalyticsString } from "./features/analytics/formatters";
import { applyVisualCustomizationDefaults, VISUAL_CUSTOMIZATION_DEFAULTS } from "./features/settings/visualCustomization";
import { getLocaltifyPlatformInfo } from "./app/platform";
import {
  FEEDBACK_CATEGORY_OPTIONS,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_PROMPT_COPY,
  FEEDBACK_PROMPT_DELAY_MS,
  FEEDBACK_PROMPT_RETRY_DELAY_MS,
  FEEDBACK_PROMPT_SEEN_KEY,
  LOCALTIFY_041_WHATS_NEW_ITEMS,
  shouldOpenFeedbackPromptFromGlobalSearch,
  shouldOpenFeedbackPromptFromSettingsSearch
} from "./features/feedback/feedbackPrompt";
import {
  markOnboardingSeenForThisRelease,
  resetOnboardingForThisRelease,
  shouldOpenOnboardingForThisRelease
} from "./features/onboarding/onboardingRelease";
import {
  restoreCustomThemeAfterUpdate,
  writeCustomThemeBackupPatch
} from "./features/settings/customThemePersistence";
import {
  BOOT_MIN_VISIBLE_MS,
  BOOT_STEPS,
  CUSTOM_THEME_COMMIT_DELAY_MS,
  HOME_GRID_RENDER_LIMIT,
  INITIAL_LIBRARY_RENDER_LIMIT,
  LIBRARY_RENDER_BATCH_SIZE,
  START_WITH_WINDOWS_DEFAULT_KEY,
  V013_DEFAULTS_KEY,
  loadingScreenGif,
  localtifyLogo,
  screensaverImage
} from "./core/app.constants";
import {
  CODERPIXEL_ARTIST_EASTER_EGG,
  PLAYBACK_URL_CACHE_TTL_MS
} from "./features/library/library.constants";
import {
  V013_RELEASE_DEFAULTS,
  coverColorSyncOptions,
  defaultSettings,
  settingsCategoryTabs
} from "./features/settings/settings.constants";
import { THEME_SWATCH_COLORS, themes } from "./features/settings/theme.constants";
import { BUILT_IN_CUSTOM_THEME_PRESETS } from "./features/settings/customTheme";
import { APP_VERSION } from "./features/updates/update.constants";
import {
  DISCORD_ASSET_KEYS,
  DISCORD_LOGO_ASSET,
  LOCALITFY_DOWNLOAD_URL,
  LOCALITFY_SOURCE_URL,
  discordArtModeOptions,
  discordCleanupOptions,
  discordSecondLineOptions,
  discordStyleOptions
} from "./features/discord/discord.constants";
import { PLAYLIST_STORAGE_KEY } from "./features/playlists/playlist.constants";
import { clamp, collapseSpaces, formatTime, getGreeting } from "./shared/utils/format";
import { useStableCallback } from "./shared/hooks/useStableCallback";
import { makeLocalId, readLocalJson } from "./shared/storage/localStorage";
import {
  applyLibraryOrder,
  createImportAnimationState,
  getSongPlaybackSourceKey,
  isPlayableSong,
  maybeApplyCoderpixelArtist,
  reorderSongList,
  saveLibraryOrder,
  stableSongSourceKey
} from "./features/library";
import {
  buildSongSearchEntry,
  getMetadataRepairPatch,
  heroTitleDensityClass,
  prettyMeta,
  prettyTitle,
  rankSongsForSearch,
  sanitizeSongList
} from "./features/search";
import {
  normalizeSettingsSearch,
  resolveSettingsCategoryFromSearch,
  settingsTabMatchesSearch
} from "./features/settings/settings.search";
import {
  getAmbientStyle,
  getRendererSafeImageUrl,
  getSongAmbientSource,
  pixelArtUrl,
  useCoverAverageStyle
} from "./features/covers";
import {
  buildAnimatedThemeVisualStyle,
  getCustomThemeColorPatch,
  hexToRgbString,
  hexToRgbaString,
  makeCustomThemeColors,
  makeThemePresetStyle,
  normalizeCoverColorSyncMode,
  normalizeHexColor,
  normalizeHexInputDraft,
  normalizeThemeId,
  randomThemeHex,
  writeSavedCustomThemePresets
} from "./features/settings";
import { buildDiscordPreview, buildDiscordSongSearchUrl } from "./features/discord";
import { cleanPlaylistList } from "./features/playlists";
import type {
  LibraryDropSide,
  LibraryDropTarget,
  MetadataCleanPreview,
  PlaybackUrlCacheEntry,
  PlaybackUrlResult,
  Song
} from "./features/library/song.types";
import type { DownloadQueueItem, DownloadResult, SpotifyTrack } from "./features/downloads/download.types";
import type { Settings, SettingsCategory, CustomThemeColorKey, CustomThemePreset } from "./features/settings/settings.types";
import type { CoverColorSyncMode, SecretMode, SecretTriggerMode, ThemeId } from "./features/settings/theme.types";
import type { DiscordArtMode } from "./features/discord/discord.types";
import type { Playlist, PlaylistSummary } from "./features/playlists/playlist.types";
import type { View } from "./features/shell/view.types";

const SettingsCategoryContent = lazy(() => import("./SettingsCategoryContent"));


function MainModeApp() {

  const {
    audioRef, playerEngineRef, playerControllerRef,
    crossfadeIntervalRef, crossfadeAutoStartedRef, crossfadeAutoTargetRef, crossfadeMainPauseGuardRef,
    crossfadeLastStartAtRef, crossfadeHandoffClearTimerRef, crossfadeHandoffRef, fadeIntervalRef,
    animationFrameRef, progressLoopTimeoutRef, backgroundAudioRepairTimerRef, playerResizeFrameRef,
    pendingPlayRef, countPlayRef, playCountSongIdRef, playCountListenedRef, playCountLastTimeRef,
    sleepTimerRef, positionSaveRef, nextAudioRef, playbackUrlCacheRef, playbackUrlPendingRef,
    lastQueueHistoryRef, songRef, timeRef, durationRef, playingRef, volumeRef, effectiveVolumeRef, lastNonZeroVolumeRef,
    beatFrameRef, beatFrameTimerRef, audioEffectRuntimeRef,
    beatSmoothRef, beatReactiveTargetCacheRef, beatLastPaintSignatureRef,
    progressDomSignatureRef, isVolumeDragging, setIsVolumeDragging, volumeDraft, setVolumeDraft,
    volumeDraftRef, volumeDraftFrameRef, liveVolumeFrameRef, liveVolumePendingPercentRef, fadeFrameRef,
    currentId, setCurrentId, isPlaying, setIsPlaying, isShuffle, setIsShuffle, repeatMode, setRepeatMode,
    currentTime, setCurrentTime, currentDuration, setCurrentDuration, isSeeking, setIsSeeking,
    seekDraftPercent, setSeekDraftPercent, seekDraftPercentRef, isSeekingRef, seekDraftFrameRef,
    progressInputRefs, progressTimeLabelRefs, progressDurationLabelRefs, lastProgressUiPaintRef,
    lastProgressStatePaintRef, statusText, setStatusText, playerError, setPlayerError,
    crossfadePreviewSongId, setCrossfadePreviewSongId, nowPlayingTransitionKey, setNowPlayingTransitionKey,
    playQueue, setPlayQueue, setQueueHistory, repeatPlaylist, setRepeatPlaylist,
    queueDropHot, setQueueDropHot, queueDropHotRef
  } = usePlayerRuntime({ defaultVolume: defaultSettings.volume });

  const saveSettingsSerialRef = useRef(0);
  const sidebarResizeFrameRef = useRef<number | null>(null);
  const bootedRef = useRef(false);
  const importOverlayTimerRef = useRef<number | null>(null);
  const secretBufferRef = useRef("");
  const secretTimeoutRef = useRef<number | null>(null);
  const playButtonBurstTimerRef = useRef<number | null>(null);

  const discordAssetBySongRef = useRef<Record<string, string>>({});
  const lastDiscordAssetKeyRef = useRef<string>("");
  const discordLastPayloadKeyRef = useRef<string>("");
  const contentRef = useRef<HTMLElement | null>(null);
  const scrollBusyRef = useRef(false);
  const scrollBusyFrameRef = useRef<number | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const rendererQuietUntilRef = useRef(0);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const viewSwitchTimerRef = useRef<number | null>(null);
  const heroReflowTimerRef = useRef<number | null>(null);
  const heroCoverMotionTimerRef = useRef<number | null>(null);
  const appRootRef = useRef<HTMLElement | null>(null);
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
  const {
    settings, setSettings, settingsRef,
    settingsOpen, setSettingsOpen,
    settingsCategory, setSettingsCategory,
    settingsSearch, setSettingsSearch, deferredSettingsSearch,
    customThemeName, setCustomThemeName,
    customThemeHexDrafts, setCustomThemeHexDrafts,
    savedCustomThemes, setSavedCustomThemes,
    themeSettling,
    themeMotionReady, setThemeMotionReady,
    saveSettingsTimerRef,
    themeSettlingTimerRef,
    customThemeCommitTimerRef,
    customThemeQuietCommitTimerRef,
    customThemeQuietPatchRef,
    customThemePreviewFrameRef,
    themePaintIdleTimerRef,
    customThemeLivePatchRef,
    pendingCustomThemePreviewPatchRef,
    themeSettlingRef
  } = useSettingsController({
    initialSettings: () => applyVisualCustomizationDefaults(defaultSettings as Settings)
  });
  const [heroMotion, setHeroMotion] = useState<"idle" | "expanding" | "compacting">("idle");
  const [homeEntranceSettled, setHomeEntranceSettled] = useState(false);
  const [view, setView] = useState<View>("home");
  const [isAppBackgrounded, setIsAppBackgrounded] = useState(() => (typeof document === "undefined" ? false : document.hidden));
  const isAppBackgroundedRef = useRef(isAppBackgrounded);
  const {
    diagnosticsCopied, setDiagnosticsCopied,
    performanceStatus, setPerformanceStatus,
    feedbackPromptBlockersRef,
    feedbackPromptOpen, setFeedbackPromptOpen,
    feedbackPromptManualOpen, setFeedbackPromptManualOpen,
    feedbackCategory, setFeedbackCategory,
    feedbackMessage, setFeedbackMessage,
    feedbackSendBusy, setFeedbackSendBusy,
    feedbackStatus, setFeedbackStatus,
    feedbackConfigStatus, setFeedbackConfigStatus,
    feedbackLastSentAtRef
  } = useFeedbackController();
  const [isViewSwitching, setIsViewSwitching] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => shouldOpenOnboardingForThisRelease());
  const [onboardingDevPreview, setOnboardingDevPreview] = useState(false);
  const {
    editorSong, setEditorSong,
    deleteTarget, setDeleteTarget,
    deleteBusy, setDeleteBusy,
    editTitle, setEditTitle,
    editArtist, setEditArtist,
    editAlbum, setEditAlbum,
    query, setQuery, deferredQuery,
    libraryFilterMode, setLibraryFilterMode,
    libraryRenderLimit, setLibraryRenderLimit,
    libraryRenderLimitRef, libraryListLengthRef,
    songContextMenu, setSongContextMenu,
    libraryScanBusy, setLibraryScanBusy,
    libraryScanMessage, setLibraryScanMessage,
    metadataCleanPreview, setMetadataCleanPreview,
    metadataUndoItems, setMetadataUndoItems,
    importAnimation, setImportAnimation,
    draggedSongId, setDraggedSongId,
    draggedSongTitle, setDraggedSongTitle,
    libraryDragOverSongId, setLibraryDragOverSongId,
    libraryDropSide, setLibraryDropSide,
    draggedSongIdRef, libraryDragOverSongIdRef, libraryDropSideRef,
    libraryDropPullRef, libraryDropVisualSongIdRef, libraryDropVisualSideRef,
    librarySongElementRefs, pointerLibraryDragRef, pointerLibraryDragFrameRef
  } = useLibraryController();

  const { appToast, showAppToast } = useAppToast();
  const {
    updatePrompt,
    setUpdatePrompt,
    whatsNewOpen,
    setWhatsNewOpen,
    openUpdateChangelog,
    closeWhatsNew,
    askUpdaterToDownload,
    askUpdaterToInstall,
    manualUpdateCheck,
    skipAvailableUpdate,
    clearUpdateNagTimer,
    showUpdateNag,
    showDebugUpdateAvailable,
    lastUpdateCheckedLabel
  } = useUpdatesController({
    ready,
    autoUpdateEnabled: settings.autoUpdateEnabled,
    analyticsViewRef,
    setStatusText,
    showAppToast
  });
  const {
    now, setNow,
    screensaverVisible, setScreensaverVisible,
    screensaverPreviewActive, setScreensaverPreviewActive,
    screensaverPreviewTimerRef,
    screensaverIgnoreActivityUntilRef
  } = useScreensaverController({
    currentSongId: currentId,
    isPlaying,
    animeVisuals: settings.animeVisuals,
    animatedBackgrounds: settings.animatedBackgrounds
  });

  const {
    downloadText, setDownloadText,
    downloadBusy, setDownloadBusy,
    downloadResults, setDownloadResults,
    downloadQueue, setDownloadQueue,
    downloadFolderLabel, setDownloadFolderLabel,
    convertBusy, setConvertBusy,
    convertProgress, setConvertProgress,
    convertMessage, setConvertMessage,
    downloadsTab, setDownloadsTab,
    spotifyUrl, setSpotifyUrl,
    spotifyTracks, setSpotifyTracks,
    spotifySourceName,
    spotifySourceType,
    spotifyFetchBusy,
    spotifyFetchError, setSpotifyFetchError,
    spotifySelectedIds, setSpotifySelectedIds,
    spotifyDownloadBusy, setSpotifyDownloadBusy,
    spotifyLoggedIn,
    spotifyLoginBusy,
    handleSpotifyLogin,
    handleSpotifyLogout,
    fetchSpotifyTracks,
    syncDownloadFilesToQueue
  } = useDownloadsRuntime({ ready, songs, setStatusText, setPlayerError });

  const [secretMode, setSecretMode] = useState<SecretMode>("none");
  const [secretToast, setSecretToast] = useState("");
  const [secretBurst, setSecretBurst] = useState(0);
  const [playButtonBurst, setPlayButtonBurst] = useState(0);
  const arcadeGhostUnlocked = false;

  const isThreeAm = now.getHours() === 3;
  const greeting = isThreeAm ? "late night local files" : getGreeting(now.getHours());

  useBodyRuntimeClasses({
    isAppBackgrounded,
    isAppBackgroundedRef,
    isPlaying,
    wantsMoreBlur: settings.quickLibraryMoreBlur !== false
  });

  function resumeAudioContextSafely() {
    void audioEffectRuntimeRef.current?.resume();
  }

  function repairPlaybackAfterAppReturns(reason: "focus" | "visibility" | "background-tick") {
    const audio = audioRef.current;
    if (!audio) return;

    resumeAudioContextSafely();

    if (!playingRef.current && !pendingPlayRef.current) return;
    if (!songRef.current) return;

    applyPlaybackRateSettings(audio);
    const repairedVolume = getTargetAudioVolume(songRef.current);
    setAudioElementVolume(audio, repairedVolume);
    effectiveVolumeRef.current = repairedVolume;
    syncAudioEffectGraph(audio);

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

  useAppLifecycleRuntime({
    appVersion: APP_VERSION,
    analytics: {
      init: initLocalitfyAnalytics,
      appLaunched: trackAppLaunched,
      appSessionEnded: trackAppSessionEnded,
      appActive: trackAppActive,
      appBackgrounded: trackAppBackgrounded,
      appForegrounded: trackAppForegrounded,
      acquisitionSource: trackAcquisitionSource,
      error: trackError
    },
    analyticsViewRef,
    appRootRef,
    playingRef,
    setIsAppBackgrounded,
    repairPlaybackAfterAppReturns
  });

  // V313: onboarding is now a true first-run mini-app.
  // Do not auto-close it just because songs exist; import completion is handled inside Onboarding.

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

  const heroDisplayTitle = visualCurrentSong ? prettyTitle(visualCurrentSong.title, 9) : "drop in your music";
  const heroDisplayArtist = visualCurrentSong ? prettyMeta(visualCurrentSong.artist) : "import songs to start listening";
  const heroTitleClass = heroTitleDensityClass(heroDisplayTitle);

  const songIdentityRef = useRef<string | null>(null);
  const songTransitionCounterRef = useRef(0);
  const {
    playlists,
    setPlaylists,
    newPlaylistName,
    setNewPlaylistName,
    playlistPickerName,
    setPlaylistPickerName,
    activePlaylistId,
    setActivePlaylistId,
    selectedPlaylistId,
    setSelectedPlaylistId,
    playlistPickerSong,
    setPlaylistPickerSong,
    playlistDragOverPlaylistId,
    setPlaylistDragOverPlaylistId,
    renamingPlaylistId,
    renamingPlaylistName,
    setRenamingPlaylistName,
    createPlaylist,
    createPlaylistWithSong,
    removePlaylist,
    startRenamePlaylist,
    cancelRenamePlaylist,
    savePlaylistRename,
    duplicatePlaylist,
    openPlaylist,
    openPlaylistPicker: openPlaylistPickerCore,
    addSongToPlaylist,
    removeSongFromPlaylist,
    toggleSongPlaylist,
    handlePlaylistSongDrop,
    handlePlaylistSongAppend,
    normalizePlaylistName
  } = usePlaylistsController({
    songs,
    bootedRef,
    changeView,
    setStatusText,
    showAppToast
  });
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

  const { diagnosticsInfo, copyDiagnosticsInfo } = useDiagnosticsInfo({
    currentThemeName: currentTheme.name,
    downloadFolderLabel,
    performanceStatus,
    feedbackConfigStatus,
    platformInfo,
    playlistCount: playlists.length,
    settings,
    songs,
    updatePrompt,
    lastUpdateCheckedLabel,
    setDiagnosticsCopied
  });

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
        writeCustomThemeBackupPatch(nextSettings);
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


  const { analyticsAudienceSnapshot, analyticsAudienceSnapshotReady } = useAnalyticsRuntime({
    ready,
    view,
    songs,
    likedCount: likedSongs.length,
    playlists,
    settings,
    isShuffle,
    repeatMode,
    downloadResultCount: downloadResults.length
  });

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
      syncProgressDom(timeRef.current || currentTime, currentDuration || currentSong?.duration || 0, true);
    }
  }, [currentSong?.id, currentDuration, currentSong?.duration, syncProgressDom]);

  const {
    pixelArtAssets,
    setPixelArtAssets,
    pixelArtBusy,
    pixelArtPool,
    loadPixelArtAssets,
    getRuntimePixelArtForSong,
    coverGalleryMood,
    setCoverGalleryMood,
    coverSelectedSongIds,
    setCoverSelectedSongIds,
    coverMoodCounts,
    filteredCoverGalleryAssets,
    selectedCoverSongs,
    coverPickerSongList,
    coverStats,
    rescanPixelArtFolder,
    randomizeCoverForSong,
    chooseCoverFromPc,
    randomizeAllCovers,
    togglePixelCoverFavorite,
    togglePixelCoverExcluded,
    toggleCoverSongSelection,
    selectCurrentSongForCovers,
    selectVisibleSongsForCovers,
    applyCoverAssetToSelection,
    randomizeSelectedCovers
  } = useCoversController({
    songs,
    songsById,
    filteredSongs,
    query,
    currentSong,
    view,
    settingsCategory,
    replaceSong,
    commitSongs: commitSongsWithEditor,
    setStatusText,
    showAppToast,
    onCoverAssetsChanged: () => {
      discordAssetBySongRef.current = {};
    }
  });

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
      return getAudioEffectRuntime().ensureAnalyser(audio, getAudioEffectInput());
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

    void audioEffectRuntimeRef.current?.resume();

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
        const analyserSnapshot = ensureAnalyser();
        const analyser = analyserSnapshot?.analyser ?? null;
        const data = analyserSnapshot?.data ?? null;
        const audio = audioRef.current;
        const time = Number.isFinite(audio?.currentTime || 0) ? audio?.currentTime || 0 : 0;
        const safeVolume = clamp(effectiveVolumeRef.current || volumeRef.current || settings.volume || 0.75, 0.16, 1);

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
  }, [ready, isPlaying, currentSong?.id, settings.animatedGlow, settings.reducedMotion, settings.volume, settings.playbackSpeed, settings.audioEffectMode, settings.audioEffectAmount, settings.audioReverbAmount, view, settingsCategory, isViewSwitching, isSeeking, isVolumeDragging]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
      openUpdateChangelog();
      setQuery("");
      showAppToast("what's new opened", "success");
      return;
    }

    if (command === "popup1" || command === "/popup1") {
      showDebugUpdateAvailable();
      setQuery("");
      return;
    }

    if (command === "popup2" || command === "/popup2") {
      clearUpdateNagTimer();
      showUpdateNag(1, updatePrompt.version || "test");
      setQuery("");
      return;
    }

    if (command === "popup3" || command === "/popup3") {
      clearUpdateNagTimer();
      showUpdateNag(2, updatePrompt.version || "test");
      setQuery("");
      return;
    }

    if (command === "popup4" || command === "/popup4") {
      clearUpdateNagTimer();
      showUpdateNag(3, updatePrompt.version || "test");
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

      const didRestoreCustomThemeAfterUpdate = restoreCustomThemeAfterUpdate(nextSettings, storedSettings);

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
        didRestoreCustomThemeAfterUpdate ||
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
        .catch(() => undefined);
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

  function getAudioEffectRuntime() {
    const runtime = audioEffectRuntimeRef.current;
    if (!runtime) throw new Error("player audio effect runtime unavailable");
    return runtime;
  }

  function getAudioEffectInput() {
    return {
      mode: settings.audioEffectMode,
      baseRate: settings.playbackSpeed,
      effectAmount: settings.audioEffectAmount,
      reverbAmount: settings.audioReverbAmount
    };
  }

  function disposeAudioEngine() {
    audioEffectRuntimeRef.current?.dispose();
    audioEffectRuntimeRef.current = null;
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

  function applyPlaybackRateSettings(audio: HTMLAudioElement | null | undefined) {
    if (!audio) return;
    getAudioEffectRuntime().apply(audio, getAudioEffectInput());
  }

  function syncAudioEffectGraph(audio: HTMLAudioElement | null | undefined) {
    if (!audio || audio !== audioRef.current) return;
    getAudioEffectRuntime().apply(audio, getAudioEffectInput());
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
      syncAudioEffectGraph(audio);
      audio.preload = settings.gaplessPlayback ? "auto" : "metadata";
      effectiveVolumeRef.current = safeVolume;
      return safeVolume;
    },
    [
      getTargetAudioVolume,
      settings.playbackSpeed,
      settings.gaplessPlayback,
      settings.audioEffectMode,
      settings.audioEffectAmount,
      settings.audioReverbAmount
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

        const uiPaintEveryMs = backgroundMode ? 5000 : busyUi ? 700 : 220;
        if (!backgroundMode && !isSeekingRef.current && clock - lastProgressUiPaintRef.current > uiPaintEveryMs) {
          lastProgressUiPaintRef.current = clock;
          syncProgressDom(nextTime, nextDuration);
        }

        // Keep playback progress out of React's hot path. The DOM progress gets
        // painted directly; React state only changes for actual duration changes,
        // manual seeks, song switches, or hard resets.
        if (!isSeekingRef.current && clock - lastProgressStatePaintRef.current > 20000) {
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
          window.setTimeout(() => runLocaltifyIdleTask(() => primeNextAudioCache(), 2200), 900);
        }
      }

      scheduleProgressTick(backgroundMode ? 1800 : busyUi ? 520 : 180);
    };

    scheduleProgressTick(140);

    return () => stopProgressLoop();
  }, [isPlaying, currentSong?.id, currentDuration, settings.gaplessPlayback, syncProgressDom]);

  const discordSettingsRef = useRef(settings);

  useEffect(() => {
    discordSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!ready) return;

    if (!settings.discordEnabled) {
      discordLastPayloadKeyRef.current = "";
      window.localitfy.clearDiscordActivity().catch(() => undefined);
      return;
    }

    let alive = true;

    const sendActivity = () => {
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
        chosenDiscordAsset
      ].join("|");

      if (payloadKey === discordLastPayloadKeyRef.current) return;
      discordLastPayloadKeyRef.current = payloadKey;

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
          discordGithubUrl: LOCALITFY_SOURCE_URL,
          discordOpenLabel: discordPrimaryLabel,
          discordGithubLabel: "Get localtify",
          discordButtonLabels: [discordPrimaryLabel, "Get localtify"],
          discordButtonRetry: true,
          discordActivityName: "localtify",
          discordActivityType: "listening",
          discordSmallImageMode: "player"
        })
        .catch(() => {
          if (discordLastPayloadKeyRef.current === payloadKey) {
            discordLastPayloadKeyRef.current = "";
          }
        });
    };

    sendActivity();

    const discordRefreshEveryMs = isAppBackgrounded ? 45000 : 15000;
    const timer = window.setInterval(sendActivity, discordRefreshEveryMs);

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
          effectiveVolumeRef.current = handoffVolume;

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
      // Single-song loop must not use hidden crossfade/preload audio.
      // The ended handler restarts the same track directly, which prevents
      // repeat-one from accidentally advancing to another song.
      return null;
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
    } else if (playQueue.length) {
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
    if (!target?.song || target.song.id === current.id) return;

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
        repeatMode !== "one" &&
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
    const endedSong = songRef.current || currentSong;
    markSongCompletedForPlayCount(endedSong);

    if (endedSong?.id) {
      void patchSongLocal(endedSong.id, { playbackPosition: 0 });
    }

    if (repeatMode === "one" && restartCurrentSongForRepeatOne()) {
      return;
    }

    if (crossfadeAutoStartedRef.current || crossfadeHandoffRef.current) {
      // The hidden next audio is already taking over. Do not double-skip.
      return;
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
      effectiveVolumeRef.current = safeTarget;
      if (onDone) onDone();
      return;
    }

    const startTime = performance.now();

    const step = () => {
      const progressValue = clamp((performance.now() - startTime) / safeDuration, 0, 1);
      const eased = 1 - Math.pow(1 - progressValue, 2.2);
      const nextVolume = clamp(startVolume + delta * eased, 0, 1);

      setAudioElementVolume(audio, nextVolume);
      effectiveVolumeRef.current = nextVolume;

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
      effectiveVolumeRef.current = safeVolume;

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

    writeCustomThemeBackupPatch(next);
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
        writeCustomThemeBackupPatch(nextSettings);
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

  function commitSongsWithEditor(nextSongs: Song[]) {
    setSongs(nextSongs);
    if (editorSong) {
      setEditorSong(nextSongs.find((song) => song.id === editorSong.id) || editorSong);
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


  function buildMetadataCleanPreview(scope: "all" | "selected" = "all"): MetadataCleanPreview {
    const selectedIds = new Set(coverSelectedSongIds);
    const targetSongs = scope === "selected" && selectedIds.size
      ? songs.filter((song) => selectedIds.has(song.id))
      : songs;

    const items = targetSongs.map((song) => {
      const repair = getMetadataRepairPatch(song);
      const patch: Partial<Pick<Song, "title" | "artist" | "album">> = {};
      if (typeof repair.title === "string" && repair.title !== song.title) patch.title = repair.title;
      if (typeof repair.artist === "string" && repair.artist !== song.artist) patch.artist = repair.artist;
      if (typeof repair.album === "string" && repair.album !== song.album) patch.album = repair.album;
      const fields = Object.keys(patch);

      return {
        id: song.id,
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

  // Spotify import/download orchestration stays here until playlist/library side effects are isolated.
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
        const message = "Spotify downloading is unavailable in this build.";
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
            .map((item: DownloadResult): [string, DownloadResult] => [String(item.spotifyTrackId || "").trim(), item])
            .filter(([id]) => Boolean(id))
        );
        const rawDownloadsBySpotifyId = new Map(
          downloads
            .map((item: DownloadResult): [string, DownloadResult] => [String(item.spotifyTrackId || "").trim(), item])
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

  function openPlaylistPicker(song: Song) {
    setSongContextMenu(null);
    openPlaylistPickerCore(song);
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

  function restartCurrentSongForRepeatOne() {
    const song = songRef.current || currentSong;
    const audio = audioRef.current;

    if (!song) return false;

    stopCrossfadeAuto();
    crossfadeHandoffRef.current = null;
    crossfadeMainPauseGuardRef.current = false;

    try {
      const controller = ensurePlayerController();
      if (controller) controller.seekTo(0);
      else if (audio) audio.currentTime = 0;
    } catch {
      try {
        if (audio) audio.currentTime = 0;
      } catch {
        // ignore seek errors
      }
    }

    timeRef.current = 0;
    setCurrentTime(0);
    pendingPlayRef.current = true;
    setIsPlaying(true);
    setStatusText(`looping ${prettyTitle(song.title, 5)}`);

    if (audio) {
      void audio.play()
        .then(() => {
          pendingPlayRef.current = false;
          playingRef.current = true;
          setIsPlaying(true);
        })
        .catch(() => {
          void selectSong(song.id, true, currentPlaybackPlaylist ? { playlistId: currentPlaybackPlaylist.id } : undefined);
        });
    } else {
      void selectSong(song.id, true, currentPlaybackPlaylist ? { playlistId: currentPlaybackPlaylist.id } : undefined);
    }

    return true;
  }

  function playNext(forcePlay = true, trigger: "manual" | "auto" = "manual") {
    if (trigger === "manual") stopCrossfadeAuto();
    if (!playableSongs.length) return;

    if (trigger === "auto" && repeatMode === "one" && restartCurrentSongForRepeatOne()) {
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
      effectiveVolumeRef.current = safeVolume;

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

    volumeRef.current = safeVolume;
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
      importBusy: Boolean(importAnimation?.active) || libraryScanBusy,
      downloadBusy,
      spotifyDownloadBusy,
      libraryScanBusy
    };
  }, [
    deleteTarget,
    downloadBusy,
    editorSong,
    importAnimation?.active,
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
          updateStatus: updatePrompt.visible ? updateStatusLabel(updatePrompt.status) : "not visible",
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
              <PlayerPlayPauseMorphIcon playing={isPlaying} />
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
        setSettingsCategory={(value: string) => setSettingsCategory(value as SettingsCategory)}
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
        whatsNewItems={LOCALTIFY_041_WHATS_NEW_ITEMS}
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

  const albumsController = useAlbumsController({
    view,
    reducedMotion: settings.reducedMotion,
    songs,
    songsById,
    setSongs,
    setLibraryScanBusy,
    setLibraryScanMessage,
    setStatusText,
    patchSongLocal
  });

  const downloadPageState = getDownloadPageState({
    downloadBusy,
    spotifyDownloadBusy,
    convertBusy,
    downloadQueue,
    downloadResults,
    spotifyFetchError
  });
  const {
    mascotState: downloadMascotState,
    tone: downloadMascotTone,
    title: downloadMascotTitle,
    message: downloadMascotMessage,
    hasFailed: downloadHasFailure,
    failedQueueItems: failedDownloadQueueItems,
    finishedQueueItems: finishedDownloadQueueItems,
    failedResults: failedDownloadResults,
    firstError: firstDownloadError
  } = downloadPageState;
  const visibleDownloadQueueItems = downloadQueue.filter(
    (item: DownloadQueueItem) => !["failed", "cancelled", "error"].includes(String(item.status || "").toLowerCase())
  );
  const visibleDownloadResults = downloadResults.filter((item: DownloadResult) => item?.ok !== false);
  const copyDownloadError = async (errorText?: string) => {
    const text = String(errorText || firstDownloadError || "No download error found.");
    try {
      await navigator.clipboard?.writeText(text);
      setStatusText("download error copied");
    } catch {
      setStatusText(text);
    }
  };
  const retryFailedDownloads = () => {
    failedDownloadQueueItems.forEach((item: DownloadQueueItem) => {
      void retryDownload(item.url || "", item.source === "spotify" ? "spotify" : "youtube", item.spotifyTrackId || "");
    });
    failedDownloadResults.forEach((item: DownloadResult) => {
      void retryDownload(item.url || "", item.source === "spotify" ? "spotify" : "youtube", item.spotifyTrackId || "");
    });
  };

  const localtifyAppViewProps: AppShellProps = {
    frame: {
      appRootRef,
      settings,
      platformInfo,
      themeMotionReady,
      showTopUpdateRibbon,
      isViewSwitching,
      heroMotion,
      heroMotionAppClass,
      homeEntranceSettledClass,
      isAppBackgrounded,
      scrollBusyRef,
      themeSettling,
      themePresetStyle,
      animatedThemeVisualStyle,
      customThemeStyle,
      effectiveTheme,
      effectiveAmbient,
      effectiveCoverColorSyncMode,
      effectiveNotes,
      statusText,
      draggedSongTitle,
      showStarBackdrop
    },
    updates: {
      updatePrompt,
      askUpdaterToDownload,
      askUpdaterToInstall,
      manualUpdateCheck,
      setUpdatePrompt,
      progress
    },
    screensaver: {
      previewActive: screensaverPreviewActive,
      visible: screensaverVisible,
      dismissFromActivity: dismissScreensaverFromActivity,
      setVisible: setScreensaverVisible,
      visualSource: screensaverVisualSource
    },
    effects: {
      secretMode,
      secretBurst,
      secretToast,
      starParticleStyles,
      appToast,
      importAnimation,
      libraryScanBusy,
      pixelArtBusy,
      libraryScanMessage
    },
    onboarding: {
      open: onboardingOpen,
      songsCount: songs.length,
      currentTheme: settings.customThemeEnabled ? "custom" : settings.theme,
      discordEnabled: settings.discordEnabled,
      onChooseTheme: handleOnboardingTheme,
      onSetDiscordEnabled: handleOnboardingDiscord,
      onImportMusic: handleOnboardingImportMusic,
      onOpenDownloads: handleOnboardingDownloads,
      onStartListening: handleOnboardingStartListening,
      onSkip: skipOnboarding
    },
    navigation: {
      effectiveSimpleMode,
      simpleModeView,
      view,
      changeView,
      importSongs,
      startSidebarResize,
      contentRef,
      headerHint,
      greeting,
      query,
      handleSearchInput
    },
    home: {
      ambientStyle,
      currentId,
      currentNowPlayingLabel,
      currentSong: visualCurrentSong,
      filteredSongs,
      heroDisplayArtist,
      heroDisplayTitle,
      heroMotionClass,
      heroTitleClass,
      homeDashboardClass,
      homeFreshShelfSongs,
      homeListenNowSongs,
      isPlaying,
      isThreeAm,
      likedSongs,
      mostPlayed,
      now,
      nowPlayingSongMotionClass,
      nowPlayingTransitionKey,
      openCoversViewWithCurrentSong,
      playableSongCount: playableSongs.length,
      playerError,
      renderHomeSongCards,
      renderSongRows,
      selectSong,
      settings,
      showHomeSideCards,
      shuffleLibrarySongsAction,
      songs,
      toggleHeroExpanded,
      topSongs,
      totalMinutes,
      totalPlays,
      updateSetting
    },
    library: {
      changeView,
      deleteBusy,
      handleLibraryAreaDragLeave,
      handleLibraryAreaDragOver,
      handleLibraryAreaDrop,
      handleSearchInput,
      importSongs,
      libraryAlbumCount,
      libraryArtistCount,
      libraryMissingLabel: `${effectiveMissingFileCount || missingSongs.length} missing file${(effectiveMissingFileCount || missingSongs.length) === 1 ? "" : "s"}`,
      missingFileCount: effectiveMissingFileCount,
      now,
      playlists,
      query,
      removeMissingSongs,
      renderHomeSongCards,
      renderSongRows,
      setLibraryFilterMode,
      settings,
      showingMissingFiles: view === "library" && libraryFilterMode === "missing",
      shuffleLibrarySongsAction,
      songs,
      view,
      visibleSongs
    },
    albums: {
      ...albumsController,
      currentId,
      currentSong: visualCurrentSong,
      openPlaylistPicker,
      playAlbumSongs,
      queueAlbumSongs,
      ready,
      selectSong,
      shuffleAlbumSongs,
      songs,
      toggleLike
    },
    playlists: {
      activePlaylistId,
      appendPlaylistSongAction,
      cancelRenamePlaylist,
      createPlaylist,
      currentId,
      draggedSongId,
      dropPlaylistSongAction,
      duplicatePlaylist,
      endPlaylistSongDragAction,
      handlePlaylistShelfDragLeave,
      handlePlaylistShelfDragOver,
      handlePlaylistShelfDrop,
      importSongs,
      isPlaying,
      newPlaylistName,
      openPlaylistSongContextMenuAction,
      playPlaylist,
      playlistDragOverPlaylistId,
      playlistSummaries,
      playlists,
      removePlaylist,
      removePlaylistSongAction,
      renamingPlaylistId,
      renamingPlaylistName,
      renderPlaylistCollage,
      savePlaylistRename,
      selectPlaylistSongAction,
      selectedPlaylist,
      selectedPlaylistDuration,
      selectedPlaylistId,
      selectedPlaylistSongs,
      setNewPlaylistName,
      setRenamingPlaylistName,
      setSelectedPlaylistId,
      songs,
      startPlaylistSongDragAction,
      startRenamePlaylist
    },
    covers: {
      ambientStyle,
      applyCoverAssetToSelection,
      coverGalleryMood,
      coverMoodCounts,
      coverPickerSongList,
      coverSelectedSongIds,
      coverStats,
      currentSong: visualCurrentSong,
      filteredCoverGalleryAssets,
      importSongs,
      now,
      pixelArtBusy,
      randomizeSelectedCovers,
      rescanPixelArtFolder,
      selectCurrentSongForCovers,
      selectVisibleSongsForCovers,
      selectedCoverSongs,
      setCoverGalleryMood,
      setCoverSelectedSongIds,
      songs,
      toggleCoverSongSelection,
      togglePixelCoverExcluded,
      togglePixelCoverFavorite
    },
    analytics: {
      analyticsRecapCards,
      analyticsStatCards,
      averageSongSeconds,
      importSongs,
      libraryHealthLabel,
      libraryLengthLabel,
      likedPercent,
      longestSong,
      missingFileCount: effectiveMissingFileCount,
      neverPlayedSongs,
      playedPercent,
      ready,
      recentImportWeekCount,
      songs
    },
    settingsView: {
      renderSettingsCategoryContent,
      renderSettingsRail,
      settings,
      settingsCategory
    },
    downloads: {
      downloadMascotState,
      downloadMascotTone,
      cancelCurrentDownload,
      changeView,
      clearFailedDownloads,
      clearFinishedDownloads,
      convertBusy,
      convertLocalMedia,
      convertMessage,
      convertProgress,
      copyDownloadError,
      downloadAudioLinks,
      downloadBusy,
      downloadHasFailure,
      downloadMascotMessage,
      downloadMascotTitle,
      downloadResults,
      downloadSpotifyTracks,
      downloadStatusLabel,
      downloadText,
      downloadsTab,
      failedDownloadQueueItems,
      failedDownloadResults,
      fetchSpotifyTracks,
      finishedDownloadQueueItems,
      handleSpotifyLogin,
      handleSpotifyLogout,
      openDownloadedSongInLibrary,
      playlists,
      progress,
      ready,
      retryDownload,
      retryFailedDownloads,
      retrySpotifyTrack,
      setDownloadText,
      setDownloadsTab,
      setSettingsCategory,
      setSpotifyFetchError,
      setSpotifySelectedIds,
      setSpotifyTracks,
      setSpotifyUrl,
      settings,
      spotifyDownloadBusy,
      spotifyFetchBusy,
      spotifyFetchError,
      spotifyLoggedIn,
      spotifyLoginBusy,
      spotifySelectedIds,
      spotifyTrackStatusLabel,
      spotifyTracks,
      spotifyUrl,
      visibleDownloadQueueItems,
      visibleDownloadResults
    },
    playerBar: {
      ambientStyle,
      commitSeek,
      commitVolume,
      currentDuration,
      currentSong: visualCurrentSong,
      displayedProgress,
      displayedTime,
      draggedSongId,
      effectiveAmbient,
      effectiveCoverColorSyncMode,
      handlePlayerDragLeave,
      handlePlayerDragOver,
      handlePlayerDrop,
      isPlaying,
      isSeeking,
      isShuffle,
      isVolumeDragging,
      nowPlayingSongMotionClass,
      nowPlayingTransitionKey,
      playButtonBurst,
      playNext,
      playPrevious,
      previewSeek,
      previewVolume,
      progressDurationLabelRefs,
      progressInputRefs,
      progressRangeStyle,
      progressTimeLabelRefs,
      queueDropHot,
      repeatButtonAriaLabel,
      repeatButtonStateText,
      repeatButtonTitle,
      repeatMode,
      setIsShuffle,
      setIsVolumeDragging,
      settings,
      startPlayerResize,
      startSeekPreview,
      togglePlay,
      toggleRepeat,
      updateSetting,
      volumeDraft,
      volumeDraftRef,
      volumeRangeStyle
    },
    modals: {
      settings: {
        open: Boolean(settingsOpen),
        onClose: () => setSettingsOpen(false),
        settingsCategory,
        reducedMotion: Boolean(settings.reducedMotion),
        renderSettingsRail,
        renderSettingsCategoryContent
      },
      songContextMenu: {
        state: songContextMenu,
        songsById,
        onClose: () => setSongContextMenu(null),
        selectSong,
        queueSong,
        openEditor,
        openPlaylistPicker,
        toggleLike,
        askRemoveSong
      },
      whatsNew: {
        open: Boolean(whatsNewOpen),
        onClose: closeWhatsNew
      },
      songEditor: {
        song: editorSong,
        onClose: () => setEditorSong(null),
        pixelArtBusy: Boolean(pixelArtBusy),
        randomizeCover,
        pickCover,
        editTitle,
        setEditTitle,
        editArtist,
        setEditArtist,
        editAlbum,
        setEditAlbum,
        playlists,
        toggleSongPlaylist,
        toggleLike,
        askRemoveSong,
        saveEditor
      },
      playlistPicker: {
        song: playlistPickerSong,
        name: playlistPickerName,
        setName: setPlaylistPickerName,
        onClose: () => { setPlaylistPickerSong(null); setPlaylistPickerName(""); },
        playlists,
        songsById,
        renderPlaylistCollage,
        addSongToPlaylist,
        createPlaylistWithSong
      },
      deleteSong: {
        song: deleteTarget,
        busy: Boolean(deleteBusy),
        onClose: () => setDeleteTarget(null),
        removeSong
      }
    },
    playbackAudio: {
      audioRef,
      currentSong: visualCurrentSong,
      songRef,
      pendingPlayRef,
      playbackUrlCacheRef,
      timeRef,
      handleCanPlay,
      handlePlaying,
      handleAudioPause,
      handleAudioTimeUpdate,
      handleAudioEnded,
      setIsPlaying,
      saveDuration,
      tickPlayCountTracker,
      markSongCompletedForPlayCount,
      patchSongLocal,
      playNext,
      setPlayerError,
      getAudioErrorText,
      setStatusText,
      resetPlayCountTracker,
      stopFade,
      stopCrossfadeAuto,
      stopProgressLoop
    }
  };

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

  return (
    <>
      <AppShell {...localtifyAppViewProps} />
      <CatBuddy enabled={settings.catBuddyEnabled === true} reducedMotion={settings.reducedMotion === true} />
      {renderFeedbackPrompt()}
    </>
  );
}

export default function App() {
  return <MainModeApp />;
}
