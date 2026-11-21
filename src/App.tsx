import { lazy, startTransition, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, DragEvent, MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";
import { HtmlAudioEngine } from "./features/player/engine/htmlAudioEngine";
import { createPlayerController } from "./features/player/engine/playerController";
import { useNativeMediaSession } from "./features/player/useNativeMediaSession";
import type { ListeningOutcome } from "./features/player/listeningHistory";
import { usePlayerRuntime } from "./features/player";
import { usePlaybackProgressLoop } from "./features/player/usePlayerRuntime";
import { resolveCachedPlaybackUrl } from "./features/player/playbackUrlCache";
import { useSongRadio } from "./features/player/useSongRadio";
import { useNotForMe } from "./features/analysis/notForMe";
import { devPerfStart, devPerfEnd } from "./shared/perf/devPerf";
import type { PlayerEngineSource } from "./features/player/engine/PlayerEngine";
import { useAnalyticsRuntime } from "./features/analytics/useAnalyticsRuntime";
import { useDownloadsRuntime } from "./features/downloads/useDownloadsRuntime";
import { getDownloadPageState } from "./features/downloads/downloadState";
import { downloadStatusLabel, spotifyTrackStatusLabel } from "./features/downloads/download.selectors";
import "./App.css";

import AppShell from "./features/shell/AppShell";
import type { AppShellProps } from "./features/shell/appShell.contract";
import { useAppToast } from "./features/shell/useAppToast";
import { useShellResize } from "./features/shell/useShellResize";
import { useScreensaverController } from "./features/shell/useScreensaverController";
import { useDiagnosticsInfo } from "./features/shell/useDiagnosticsInfo";
import { useFeedbackController } from "./features/feedback";
import { usePlaylistsController } from "./features/playlists";
import { useAppMenuCommands } from "./features/shell/useAppMenuCommands";
import { updateStatusLabel, useUpdatesController } from "./features/updates";
import { useSettingsController } from "./features/settings";
import { useCoversController } from "./features/covers";
import type { VirtualSongRowsProps } from "./features/library/components/SongRows";
import { useLibraryController, useLibraryDerivedState } from "./features/library";
import { subscribeWatchedFoldersChange } from "./features/library/watchedFolderBridge";
import { patchLibrarySong, replaceLibrarySong } from "./features/search/incrementalLibraryIndex";
import { pickRecentlyAdded, pickListenNow } from "./features/home/homeShelfPicks";
import { createMetadataCleanPreview } from "./features/library/metadataCleanPreview";
import {
  getPlayableUniqueSongIds, getRepeatPreview, getSourceLoopRestart, getSourcePreviousStep,
  repeatButtonTitleFor, resolveNowPlayingContext
} from "./features/player/playbackSource";
import type { PlaybackSource, PlaybackSourceRef } from "./features/player/playbackSource";
import { makeShuffledPlayableSongs } from "./features/player/shuffleSongs";
import { useNavigationHistory } from "./features/shell/useNavigationHistory";
import { revealSidebarSettingsPanel } from "./features/shell/sidebarLayout";
import CatBuddy from "./CatBuddy";
import { runLocaltifyIdleTask } from "./app/runtime/idle";
import { useBodyRuntimeClasses } from "./app/runtime/useBodyRuntimeClasses";
import { useAppLifecycleRuntime } from "./app/runtime/useAppLifecycleRuntime";
import { formatAnalyticsDuration, localtifyAnalyticsNumber, localtifyAnalyticsString } from "./features/analytics/formatters";
import { applyVisualCustomizationDefaults, migrateVisualSettings } from "./features/settings/visualCustomization";
import { getLocaltifyPlatformInfo } from "./app/platform";
import {
  FEEDBACK_MESSAGE_MAX_LENGTH,
  shouldOpenFeedbackPromptFromGlobalSearch,
  shouldOpenFeedbackPromptFromSettingsSearch
} from "./features/feedback/feedbackPrompt";
import {
  markOnboardingSeenForThisRelease,
  resetOnboardingForThisRelease,
  shouldOpenOnboardingForThisRelease
} from "./features/onboarding/onboardingRelease";
import {
  INITIAL_LIBRARY_RENDER_LIMIT,
  LIBRARY_RENDER_BATCH_SIZE,
  START_WITH_WINDOWS_DEFAULT_KEY,
  V013_DEFAULTS_KEY,
  screensaverImage
} from "./core/app.constants";
import {
  CODERPIXEL_ARTIST_EASTER_EGG
} from "./features/library/library.constants";
import {
  V013_RELEASE_DEFAULTS,
  coverColorSyncOptions,
  defaultSettings,
  settingsCategoryTabs
} from "./features/settings/settings.constants";
import { themes } from "./features/settings/theme.constants";
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
import { clamp, formatTime } from "./shared/utils/format";
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
  heroTitleDensityClass,
  prettyMeta,
  prettyTitle,
  sanitizeSongList
} from "./features/search";
import {
  normalizeSettingsSearch,
  resolveSettingsCategoryFromSearch,
  settingsTabMatchesSearch
} from "./features/settings/settings.search";
import {
  getAmbientStyle,
  getSongAmbientSource,
  pixelArtUrl,
  useCoverAverageStyle
} from "./features/covers";
import {
  normalizeCoverColorSyncMode,
  normalizeThemeId
} from "./features/settings";
import { buildDiscordPreview, buildDiscordSongSearchUrl } from "./features/discord";
import { cleanPlaylistList } from "./features/playlists";
import type {
  LibraryDropSide,
  LibraryDropTarget,
  Song
} from "./features/library/song.types";
import { getLibraryDropSideInfoForElement, getLibraryDropSideForElement, getLibraryDropSide, getLibraryDropElement } from "./features/library/dragGeometry";
import type { SpotifyTrack } from "./features/downloads/download.types";
import type { Settings, SettingsCategory } from "./features/settings/settings.types";
import type { CoverColorSyncMode, SecretMode, SecretTriggerMode, ThemeId } from "./features/settings/theme.types";
import type { DiscordArtMode } from "./features/discord/discord.types";
import type { Playlist, PlaylistSummary } from "./features/playlists/playlist.types";
import { resolveSimilarSeed, type SimilarSeedRequest } from "./features/analysis/similarSeed";
import type { DuplicatesMergeResult } from "./features/library/duplicates/DuplicatesDialog";
import { keptForRemoved, remapSongIds } from "./features/library/duplicates/duplicatePlan";
import type { View } from "./features/shell/view.types";
import { usePlaybackConnect } from "./features/connect/usePlaybackConnect";
import { useDevToolsShortcut } from "./features/shell/useDevToolsShortcut";

const Onboarding = lazy(() => import("./Onboarding"));
const FeedbackPrompt = lazy(() => import("./features/feedback/FeedbackPromptModal"));
const SettingsCategoryContent = lazy(() => import("./features/settings/SettingsCategoryContent"));


function MainModeApp() {
  const [similarRequest, setSimilarRequest] = useState<SimilarSeedRequest | null>(null);
  const songContextAnchorRef = useRef<HTMLElement | null>(null);

  const {
    listeningHistoryRef, audioRef, playerEngineRef, playerControllerRef, playbackTransitionRef,
    crossfadeIntervalRef, crossfadeAutoStartedRef, crossfadeAutoTargetRef, crossfadeMainPauseGuardRef,
    crossfadeLastStartAtRef, crossfadeHandoffClearTimerRef, crossfadeRecoveryTimerRef, crossfadeHandoffRef, fadeIntervalRef,
    animationFrameRef, progressLoopTimeoutRef,
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
    statusText, setStatusText, playerError, setPlayerError,
    crossfadePreviewSongId, setCrossfadePreviewSongId, nowPlayingTransitionKey, setNowPlayingTransitionKey,
    playQueue, setPlayQueue, setQueueHistory, repeatPlaylist,
    queueDropHot, setQueueDropHot, queueDropHotRef
  } = usePlayerRuntime({ defaultVolume: defaultSettings.volume });

  const startupResumePositionRef = useRef<{ songId: string; time: number } | null>(null);
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
  const activeViewRef = useRef<View>("home");
  const libraryOrderSaveTimerRef = useRef<number | null>(null);
  const lastSavedOrderRef = useRef<string[]>([]);
  const selectSongBurstTimerRef = useRef<number | null>(null);
  const selectSongBurstIntentRef = useRef<{ songId: string; shouldPlay?: boolean } | null>(null);
  const selectSongLastCommitRef = useRef({ key: "", time: 0 });
  const selectSongLastSameSongRef = useRef({ key: "", time: 0 });

  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootLogCopied, setBootLogCopied] = useState(false);
  const [bootRetryKey, setBootRetryKey] = useState(0);
  const [songs, setSongs] = useState<Song[]>([]);
  const { appToast, showAppToast } = useAppToast();
  const {
    settings, setSettings, settingsRef,
    settingsCategory, setSettingsCategory,
    settingsSearch, setSettingsSearch, deferredSettingsSearch,
    themeSettling,
    themeMotionReady, setThemeMotionReady,
    writeSettings,
    saveSettingsSafely, persistSettings, updateSetting, updateSettingsPatch, resetDiscordSettings, resetAppearanceSettings, resetPlayerLayoutSettings, resetLibraryLayoutSettings, resetAllSettingsSafely, updateCoverColorSyncMode,
    themeSettlingTimerRef,
    themePaintIdleTimerRef,
    themeSettlingRef
  } = useSettingsController({
    initialSettings: () => applyVisualCustomizationDefaults(defaultSettings as Settings),
    bootedRef, volumeDraftRef, setStatusText, showAppToast,
    applyLiveVolumePercent, kickThemeSettle
  });
  const [heroMotion, setHeroMotion] = useState<"idle" | "expanding" | "compacting">("idle");
  const [homeEntranceSettled, setHomeEntranceSettled] = useState(false);
  const [view, setView] = useState<View>("home");
  const [isAppBackgrounded, setIsAppBackgrounded] = useState(() => (typeof document === "undefined" ? false : document.hidden));
  const isAppBackgroundedRef = useRef(isAppBackgrounded);
  const {
    diagnosticsCopied, setDiagnosticsCopied,
    performanceStatus, setPerformanceStatus,
    feedbackPromptOpen, setFeedbackPromptOpen,
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
    librarySortMode, setLibrarySortMode,
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

  const {
    updatePrompt,
    setUpdatePrompt,
    whatsNewOpen,
    openUpdateChangelog,
    closeWhatsNew,
    askUpdaterToDownload,
    askUpdaterToInstall,
    manualUpdateCheck,
    clearUpdateNagTimer,
    showUpdateNag,
    showDebugUpdateAvailable,
    lastUpdateCheckedLabel
  } = useUpdatesController({
    ready,
    autoUpdateEnabled: settings.autoUpdateEnabled,
    setStatusText,
    showAppToast
  });
  const {
    isThreeAm,
    screensaverVisible, setScreensaverVisible,
    screensaverPreviewActive, setScreensaverPreviewActive,
    screensaverPreviewTimerRef,
    screensaverIgnoreActivityUntilRef
  } = useScreensaverController({
    currentSongId: currentId,
    isPlaying,
    animeVisuals: settings.animeVisuals,
    animatedBackgrounds: settings.animatedBackgrounds,
    idleEnabled: settings.idleScreensaverEnabled !== false
  });

  const [secretMode, setSecretMode] = useState<SecretMode>("none");
  const [secretToast, setSecretToast] = useState("");
  const [secretBurst, setSecretBurst] = useState(0);
  const [playButtonBurst, setPlayButtonBurst] = useState(0);
  // Where the current queue was started from, so the player bar can link back to it.
  const [playbackSource, setPlaybackSource] = useState<PlaybackSource | null>(null);
  const nav = useNavigationHistory(view, changeView, contentRef);
  const [queuePanelOpen, setQueuePanelOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);


  useBodyRuntimeClasses({
    isAppBackgrounded,
    isAppBackgroundedRef,
    isPlaying
  });

  function resumeAudioContextSafely() {
    void audioEffectRuntimeRef.current?.resume();
  }

  function repairPlaybackAfterAppReturns(reason: "focus" | "visibility" | "background-tick") {
    const audio = audioRef.current;
    const song = songRef.current;
    if (!audio || !song || !playingRef.current) return;

    // Focus is not a transport command. Never reapply gain, pitch or graph
    // parameters, reload a source or interfere with a healthy crossfade.
    resumeAudioContextSafely();
    const state = playbackTransitionRef.current.snapshot();
    if (!audio.paused || audio.ended || audio.error || audio.seeking || pendingPlayRef.current ||
        state.phase !== "playing" || state.sourceId !== song.id || state.targetId ||
        crossfadeHandoffRef.current || crossfadeMainPauseGuardRef.current) return;
    if (reason === "background-tick" && !document.hidden) return;

    pendingPlayRef.current = true;
    const repairGeneration = state.generation;
    void audio.play()
      .then(() => {
        if (audioRef.current !== audio || !playbackTransitionRef.current.isCurrent(repairGeneration, song.id)) {
          if (audioRef.current === audio && playbackTransitionRef.current.snapshot().phase === "paused") audio.pause();
          return;
        }
        pendingPlayRef.current = false;
      })
      .catch(() => {
        if (audioRef.current === audio && playbackTransitionRef.current.isCurrent(repairGeneration, song.id)) pendingPlayRef.current = false;
      });
  }

  useAppLifecycleRuntime({
    isPlaying,
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
      openFeedbackPrompt();
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
    setSettingsCategory(category);
    setEditorSong(null);
    setDeleteTarget(null);
    changeView("settings", "settings");
  }

  function openSidebarSettings() {
    openSettingsPanel("appearance");
    revealSidebarSettingsPanel(settings.reducedMotion);
  }

  function changeView(nextView: View, _source: "nav" | "onboarding" | "settings" | "unknown" = "nav") {
    setLyricsOpen(false);
    // Old runtime callers may still provide the retired album destination.
    if (String(nextView) === "albums") nextView = "library";
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

    startTransition(() => {
      setView(nextView);
    });
  }

  useEffect(() => {
    if (view !== "library" && view !== "liked") return;
    if (libraryRenderLimitRef.current === INITIAL_LIBRARY_RENDER_LIMIT) return;

    libraryRenderLimitRef.current = INITIAL_LIBRARY_RENDER_LIMIT;
    setLibraryRenderLimit(INITIAL_LIBRARY_RENDER_LIMIT);
  }, [view, deferredQuery, settings.denseList]);

  useEffect(() => {
    activeViewRef.current = view;
  }, [view]);

  useEffect(() => {
    return () => {
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
    saveSmartPlaylist,
    listeningCounts,
    createPlaylistWithSong,
    createPlaylistFromSongs,
    removePlaylist,
    startRenamePlaylist,
    cancelRenamePlaylist,
    savePlaylistRename,
    setPlaylistArtwork,
    duplicatePlaylist,
    openPlaylistPicker: openPlaylistPickerCore,
    addSongToPlaylist,
    removeSongFromPlaylist,
    toggleSongPlaylist,
    handlePlaylistSongDrop,
    handlePlaylistSongAppend,
    upsertSpotifyPlaylistFromImport
  } = usePlaylistsController({
    songs,
    bootedRef,
    changeView,
    setStatusText,
    showAppToast
  });
  const {
    retryDownloads,
    downloadText,
    setDownloadText,
    downloadBusy,
    downloadResults,
    downloadQueue,
    downloadFolderLabel,
    convertBusy,
    convertProgress,
    convertMessage,
    downloadsTab,
    setDownloadsTab,
    spotifyUrl,
    setSpotifyUrl,
    spotifyTracks,
    setSpotifyTracks,
    spotifyFetchBusy,
    spotifyFetchError,
    setSpotifyFetchError,
    spotifySelectedIds,
    setSpotifySelectedIds,
    spotifyDownloadBusy,
    spotifyLoggedIn,
    spotifyLoginBusy,
    handleSpotifyLogin,
    handleSpotifyLogout,
    fetchSpotifyTracks,
    clearFailedDownloads,
    clearFinishedDownloads,
    openDownloadedSongInLibrary,
    chooseDownloadFolder,
    cancelCurrentDownload,
    retryDownload,
    retrySpotifyTrack,
    downloadAudioLinks,
    downloadSpotifyTracks,
    convertLocalMedia
  } = useDownloadsRuntime({
    ready, songs, settingsRef, setStatusText, setPlayerError, setSongs, setLibraryScanMessage,
    currentId, setCurrentId, rememberCurrentSong, changeView, updateSetting, showAppToast,
    upsertSpotifyPlaylistFromImport,
    clearPlaybackCaches: () => { playbackUrlCacheRef.current.clear(); playbackUrlPendingRef.current.clear(); }
  });
  const songIdentity = useMemo(() => {
    if (!visualCurrentSong) return "empty";
    return [visualCurrentSong.id, visualCurrentSong.filePath, visualCurrentSong.title, visualCurrentSong.artist, visualCurrentSong.coverUrl]
      .filter(Boolean)
      .join("::");
  }, [visualCurrentSong?.id, visualCurrentSong?.filePath, visualCurrentSong?.title, visualCurrentSong?.artist, visualCurrentSong?.coverUrl]);

  useEffect(() => {
    if (!ready) return;
    const lastOrder = lastSavedOrderRef.current;
    if (lastOrder.length === songs.length && songs.every((song, i) => song.id === lastOrder[i])) return;
    let cancelIdle: (() => void) | undefined;
    libraryOrderSaveTimerRef.current = window.setTimeout(() => {
      libraryOrderSaveTimerRef.current = null;
      cancelIdle = runLocaltifyIdleTask(() => {
        saveLibraryOrder(songs);
        lastSavedOrderRef.current = songs.map(song => song.id);
      }, 1600);
    }, 520);
    return () => {
      if (libraryOrderSaveTimerRef.current !== null) {
        window.clearTimeout(libraryOrderSaveTimerRef.current);
        libraryOrderSaveTimerRef.current = null;
      }
      cancelIdle?.();
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
      const activeView = activeViewRef.current;
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
    return () => {
      if (importOverlayTimerRef.current) {
        window.clearTimeout(importOverlayTimerRef.current);
      }

      if (themeSettlingTimerRef.current) {
        window.clearTimeout(themeSettlingTimerRef.current);
      }

      if (themePaintIdleTimerRef.current !== null) {
        window.clearTimeout(themePaintIdleTimerRef.current);
        themePaintIdleTimerRef.current = null;
      }

      document.body.classList.remove("localitfyThemePainting");
      document.body.classList.remove("isResizingPlayer");
      document.body.classList.remove("isResizingSidebar");
      document.body.classList.remove("localitfyNoSelect");

      if (volumeDraftFrameRef.current !== null) {
        window.cancelAnimationFrame(volumeDraftFrameRef.current);
        volumeDraftFrameRef.current = null;
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

  const effectiveTheme = normalizeThemeId(settings.theme);
  const currentTheme = themes.find(theme => theme.id === effectiveTheme) ?? themes[1];
  useEffect(() => { setThemeMotionReady(true); }, [setThemeMotionReady]);

  const platformInfo = useMemo(() => getLocaltifyPlatformInfo(), []);

  useEffect(() => {
    if (!ready || !window.localitfy?.getPerformanceStatus) return;

    let cancelled = false;

    const cancelIdle = runLocaltifyIdleTask(() => {
      window.localitfy
        .getPerformanceStatus?.()
        .then((status: any) => {
          if (!cancelled && status?.ok) setPerformanceStatus(status);
        })
        .catch(() => undefined);
    }, 1800);

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !window.localitfy?.getFeedbackStatus) return;

    let cancelled = false;

    const cancelIdle = runLocaltifyIdleTask(() => {
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
      cancelIdle();
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
  function beginFastThemePaint() {

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



  useDevToolsShortcut(showAppToast);

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
      ...settingsRef.current,
      heroExpanded: nextExpanded
    };
    settingsRef.current = nextSettings;

    // Keep collection entrance animations from replaying after a hero toggle.
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
    setSettings(nextSettings);

    heroReflowTimerRef.current = window.setTimeout(() => {
      setHeroMotion("idle");
      heroReflowTimerRef.current = null;
    }, nextExpanded ? 860 : 700);

    void saveSettingsSafely(nextSettings, true);
  }

  function toggleHeroExpanded() {
    setHeroExpanded(!settings.heroExpanded);
  }


  const { libraryIndex, filteredSongs, likedSongs, mostPlayed, missingSongsForLibrary, visibleSongs, libraryOrderLocked, songsById, songIndexById, playableSongs } = useLibraryDerivedState({
    songs, deferredQuery, view, libraryFilterMode, librarySortMode, libraryRenderLimit, libraryListLengthRef, libraryRenderLimitRef
  });
  const similarSeed = useMemo(() => resolveSimilarSeed(similarRequest, songsById, songs, playlists), [similarRequest, songsById, songs, playlists]);
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


  const { analyticsAudienceSnapshot } = useAnalyticsRuntime({
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

  const totalPlays = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "total_plays");
  const libraryAlbumCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "album_count");
  const libraryArtistCount = libraryIndex.artistCount;
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
  // Derive from live songs: the worker snapshot lags a round trip behind setSongs.
  // Floor so any missing file keeps the tile below 100%.
  const libraryHealthPercent = songs.length
    ? Math.max(0, Math.floor(((songs.length - effectiveMissingFileCount) / songs.length) * 100))
    : 0;
  const monthImportCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "month_import_count");
  const monthImportSeconds = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "month_import_seconds");
  const monthArtistCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "month_artist_count");
  const yearImportCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "year_import_count");
  const yearImportSeconds = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "year_import_seconds");
  const yearAlbumCount = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "year_album_count");
  const longestSongDuration = localtifyAnalyticsNumber(analyticsAudienceSnapshot, "longest_song_duration");
  const longestSongTitle = localtifyAnalyticsString(analyticsAudienceSnapshot, "longest_song_title", "");

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

  const recentlyAdded = useMemo(() => pickRecentlyAdded(songs, 12), [songs]);

  const homeListenNowSongs = useMemo(() => pickListenNow(songs, currentSong?.id ?? null, new Date()), [currentSong?.id, songs]);

  const homeFreshShelfSongs = useMemo(() => {
    const picked: Song[] = [];
    const seen = new Set<string>();

    for (const song of recentlyAdded) {
      if (!isPlayableSong(song) || seen.has(song.id)) continue;
      seen.add(song.id);
      picked.push(song);
      if (picked.length === 10) break;
    }
    return picked;
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
      }
    ];
  }, [
    monthImportCount,
    monthImportSeconds,
    monthArtistCount,
    yearImportCount,
    yearImportSeconds,
    yearAlbumCount,
    songs.length
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
    libraryHealthLabel,
    effectiveMissingFileCount
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
  const ambientSource = useMemo(() => getSongAmbientSource(visualCurrentSong), [visualCurrentSong]);
  const coverAverageStyle = useCoverAverageStyle(ambientSource, effectiveCoverColorSyncMode !== "off", !isAppBackgrounded);
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
    missingCoverSongs,
    coverStats,
    rescanPixelArtFolder,
    randomizeMissingCoversAction,
    cleanupCoverCacheAction,
    randomizeCoverForSong,
    chooseCoverFromPc,
    randomizeAllCovers,
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
    durationRef.current = currentDuration;
    playingRef.current = isPlaying;
    volumeRef.current = settings.volume;

    if (settings.volume > 0.01) {
      lastNonZeroVolumeRef.current = settings.volume;
    }
  }, [currentSong, currentDuration, isPlaying, settings.volume]);


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

    if (!ready || !isPlaying || !currentSong || !settings.animatedGlow || settings.reducedMotion || isAppBackgrounded || document.hidden) {
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
      if (document.hidden) {
        resetBeatVariables();
        return;
      }

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
  }, [ready, isPlaying, currentSong?.id, isAppBackgrounded, settings.animatedGlow, settings.reducedMotion, settings.volume, settings.playbackSpeed, settings.audioEffectMode, settings.audioEffectAmount, settings.audioReverbAmount, view, settingsCategory, isViewSwitching, isSeeking, isVolumeDragging]);


  function resetPlayCountTracker(outcome: Exclude<ListeningOutcome, "active"> = "interrupted") {
    listeningHistoryRef.current?.finish(outcome);
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
    if (audioRef.current) listeningHistoryRef.current?.sample(audioRef.current);
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

  function markSongCompletedForPlayCount(song: Song | null, outcome: "ended" | "transition" = "ended") {
    if (audioRef.current) listeningHistoryRef.current?.sample(audioRef.current);
    listeningHistoryRef.current?.finish(outcome);
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

    if (secretTimeoutRef.current) {
      window.clearTimeout(secretTimeoutRef.current);
      secretTimeoutRef.current = null;
    }

    setSecretMode(mode);
    setSecretToast(message);
    setSecretBurst((value) => value + 1);

    const duration = 5200;
    secretTimeoutRef.current = window.setTimeout(() => {
      setSecretMode("none");
      setSecretToast("");
      secretTimeoutRef.current = null;
    }, duration);
  }, []);

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
      setFeedbackCategory("bug");
      openFeedbackPrompt();
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
    setReady(false);
    setBootError(null);
    setBootLogCopied(false);

    let cancelPixelArtLoad: (() => void) | undefined;
    devPerfStart("bootstrap:ipc");
    window.localitfy.bootstrap({ includeDiagnostics: false }).then(async (payload) => {
      if (!mounted) return;
      devPerfEnd("bootstrap:ipc", `${payload.songs?.length ?? 0} songs`);


      const storedSettings = payload.settings || {};
      const shouldApplyV013Defaults = window.localStorage.getItem(V013_DEFAULTS_KEY) !== "true";
      const shouldApplyStartWithWindowsDefault = platformInfo.startupSettingSupported && typeof storedSettings.startWithWindows === "undefined";
      const { settings: nextSettings, changed: visualSettingsChanged } = migrateVisualSettings(storedSettings, {
        ...defaultSettings,
        ...(shouldApplyV013Defaults ? V013_RELEASE_DEFAULTS : {})
      }, shouldApplyV013Defaults ? V013_RELEASE_DEFAULTS : undefined);

      // The redesigned desktop opens as an icon rail once. Preserve later explicit
      // choices, and never modify Android navigation or an existing hover layout.
      const sidebarMigrationKey = "localitfy.sidebar-rail-v1";
      const migrateSidebar = platformInfo.id !== "android" && window.localStorage.getItem(sidebarMigrationKey) !== "true";
      if (migrateSidebar && storedSettings.sidebarBehavior === undefined && nextSettings.sidebarBehavior === "fixed") nextSettings.sidebarBehavior = "slim";

      if (shouldApplyStartWithWindowsDefault) {
        nextSettings.startWithWindows = true;
      }

      if (!platformInfo.startupSettingSupported) {
        nextSettings.startWithWindows = false;
      }

      const shouldPersistBootSettings =
        shouldApplyV013Defaults || shouldApplyStartWithWindowsDefault ||
        visualSettingsChanged || (migrateSidebar && nextSettings.sidebarBehavior !== storedSettings.sidebarBehavior);

      if (shouldPersistBootSettings) {
        writeSettings(nextSettings).then(() => {
          if (shouldApplyV013Defaults) window.localStorage.setItem(V013_DEFAULTS_KEY, "true");
          if (shouldApplyStartWithWindowsDefault) window.localStorage.setItem(START_WITH_WINDOWS_DEFAULT_KEY, "true");
          if (migrateSidebar) window.localStorage.setItem(sidebarMigrationKey, "true");
        }).catch(() => showAppToast("Could not save settings migration. It will be retried next time.", "error"));
      } else if (migrateSidebar) {
        window.localStorage.setItem(sidebarMigrationKey, "true");
      }

      const nextSongs = applyLibraryOrder(sanitizeSongList(payload.songs || []));
      const validBootSongIds = new Set(nextSongs.map((song) => song.id));

      const localPlaylists = cleanPlaylistList(readLocalJson<Playlist[]>(PLAYLIST_STORAGE_KEY, []), validBootSongIds);
      const databasePlaylists = cleanPlaylistList(payload.playlists || [], validBootSongIds);
      const initialPlaylists = databasePlaylists.length ? databasePlaylists : localPlaylists;

      const initialSongId =
        nextSettings.rememberLastSong &&
        nextSettings.lastSongId &&
        nextSongs.some((song) => song.id === nextSettings.lastSongId)
          ? nextSettings.lastSongId
          : nextSongs[0]?.id || "";
      const initialSong = nextSongs.find((song) => song.id === initialSongId);
      const savedTime = Number(initialSong?.playbackPosition || 0);
      startupResumePositionRef.current =
        nextSettings.rememberLastSong && nextSettings.rememberPlaybackPosition &&
        initialSong && Number.isFinite(savedTime) && savedTime > 1 &&
        (!initialSong.duration || savedTime < initialSong.duration - 2)
          ? { songId: initialSongId, time: savedTime }
          : null;


      setSongs(nextSongs);
      setPlaylists(initialPlaylists);
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      setCurrentId(initialSongId);
      setReady(true);

      if (!databasePlaylists.length && localPlaylists.length && window.localitfy.savePlaylists) {
        window.localitfy.savePlaylists(localPlaylists).catch(() => undefined);
      }

      cancelPixelArtLoad = runLocaltifyIdleTask(() => {
        if (!mounted) return;
        void loadPixelArtAssets(false)
          .then((assets) => { if (mounted) setPixelArtAssets(assets); })
          .catch(() => undefined);
      }, 1800);
      bootedRef.current = true;
    }).catch((error) => {
      if (!mounted) return;

      const message = error instanceof Error ? error.message : String(error || "Unknown startup error");
      console.error("localtify startup failed", error);
      setBootError(message);
      setReady(false);
    });

    return () => {
      mounted = false;
      cancelPixelArtLoad?.();
    };
  }, [loadPixelArtAssets, bootRetryKey]);
  // Heavy automatic late-night secret effects were removed in V215.
  // Heavy automatic MiSide/joke visual mode was removed in V215.


  // Watched folders: new files were imported in the background, or a library file went missing or came back.
  useEffect(() => subscribeWatchedFoldersChange(window.localitfy, ({ importedCount, songs: next }) => {
    setSongs(applyLibraryOrder(sanitizeSongList(next)));
    if (importedCount) setStatusText(`added ${importedCount} new song${importedCount === 1 ? "" : "s"} from watched folders`);
  }), []);

  function stopPlaybackFromNative() {
    stopCrossfadeAuto();
    playbackTransitionRef.current.requestPause();
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
    const currentVolume = clamp(Number(settingsRef.current.volume) || 0, 0, 1);
    if (currentVolume > 0) lastNonZeroVolumeRef.current = currentVolume;
    const nextVolume = currentVolume > 0 ? 0 : clamp(lastNonZeroVolumeRef.current || defaultSettings.volume, 0, 1);
    void updateSetting("volume", nextVolume, true);
  }

  useEffect(() => {
    const off = window.localitfy.onPlayerCommand((command: any) => {
      if (!command || typeof command !== "object") return;

      if (command.type === "toggle") togglePlay();
      if (command.type === "play") setIsPlaying(true);
      if (command.type === "pause") { stopCrossfadeAuto(); playbackTransitionRef.current.requestPause(); pendingPlayRef.current = false; setIsPlaying(false); }
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


  useNativeMediaSession({
    audioRef,
    song: currentSong,
    isPlaying,
    duration: currentDuration,
    currentTime,
    playbackSpeed: settings.playbackSpeed,
    timeRef,
    onPlay: () => setIsPlaying(true),
    onPause: () => { stopCrossfadeAuto(); playbackTransitionRef.current.requestPause(); pendingPlayRef.current = false; setIsPlaying(false); },
    onStop: stopPlaybackFromNative,
    onPrevious: () => playPrevious(),
    onNext: () => playNext(true),
    onSeek: (seconds) => {
      const duration = durationRef.current || audioRef.current?.duration || 0;
      if (Number.isFinite(duration) && duration > 0) handleSeek(seconds / duration * 100);
    }
  });

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
        toggleMuteFromNative();
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
    (song: Song | null | undefined, options: { force?: boolean } = {}) => resolveCachedPlaybackUrl(song, {
      sourceKey: getSongPlaybackSourceKey(song),
      force: Boolean(options.force),
      cache: playbackUrlCacheRef.current,
      pending: playbackUrlPendingRef.current,
      resolver: window.localitfy?.resolvePlaybackUrl,
      onMissing: (missingSong, sourceKey) => setSongs(oldSongs => {
        const index = oldSongs.findIndex(item => item.id === missingSong.id && getSongPlaybackSourceKey(item) === sourceKey);
        if (index < 0 || oldSongs[index].fileExists === false) return oldSongs;
        const next = oldSongs.slice();
        next[index] = { ...next[index], fileExists: false, url: "" };
        return next;
      })
    }),
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

  usePlaybackProgressLoop({
    enabled: isPlaying && Boolean(currentSong),
    songId: currentSong?.id || "",
    animationFrameRef,
    progressLoopTimeoutRef,
    isBackgrounded: () => isAppBackgroundedRef.current,
    stopProgressLoop,
    onInactive: () => syncProgressDom(timeRef.current || 0, durationRef.current || currentDuration, true),
    onVisible: () => {
      if (!isSeekingRef.current) syncProgressDom(timeRef.current, durationRef.current || currentDuration, true);
    },
    onTick: (clock) => {
      const audio = audioRef.current;
      const backgroundMode = document.hidden || isAppBackgroundedRef.current;
      const busyUi = scrollBusyRef.current || performance.now() < rendererQuietUntilRef.current || Boolean(draggedSongIdRef.current) || themeSettlingRef.current;

      const transition = playbackTransitionRef.current.snapshot();
      if (audio && !audio.paused && transition.sourceId === currentSong?.id &&
          (transition.phase === "playing" || transition.phase === "crossfading")) {
        const nextTime = audio.currentTime || 0;
        const nextDuration = Number.isFinite(audio.duration) ? audio.duration : currentDuration;

        timeRef.current = nextTime;
        if (Number.isFinite(nextDuration) && nextDuration > 0) durationRef.current = nextDuration;

        const uiPaintEveryMs = backgroundMode ? 5000 : busyUi ? 700 : 220;
        if (!backgroundMode && !isSeekingRef.current && clock - lastProgressUiPaintRef.current > uiPaintEveryMs) {
          lastProgressUiPaintRef.current = clock;
          syncProgressDom(nextTime, nextDuration);
        }

        if (!backgroundMode && Number.isFinite(nextDuration) && nextDuration > 0 && Math.abs(nextDuration - currentDuration) > 0.5) {
          setCurrentDuration(nextDuration);
          syncProgressDom(nextTime, nextDuration, true);
        }

        // Store progress without React updates. Only the remembered startup song
        // resumes; regular song selections still begin at 0:00.
        const wallClock = Date.now();
        if (settingsRef.current.rememberPlaybackPosition && currentSong.id &&
            nextTime > 1 && wallClock - positionSaveRef.current >= 5000) {
          positionSaveRef.current = wallClock;
          void window.localitfy.patchSong(currentSong.id, { playbackPosition: Math.floor(nextTime) })
            .catch(() => undefined);
        }

      }
      return backgroundMode ? 1800 : busyUi ? 520 : 180;
    }
  });

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
      setPlayQueue((queue) => queue.filter((songId) => songsById.has(songId)));
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
    if (!playableSongs.length || !currentSong || repeatMode === "one") return null;
    const queuedSong = playQueue.map((songId) => songsById.get(songId)).find(isPlayableSong) ?? null;
    if (queuedSong) return queuedSong;

    const sourceLoop = sourceLoopRestart();
    if (sourceLoop) return sourceLoop.song;

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

  // One cancellable warmup per playback/queue change, not per progress tick.
  useEffect(() => {
    if (!isPlaying || !settings.gaplessPlayback || !currentSong) return;
    const owner = currentSong.id;
    const nextSong = getNextPlayableSongForCache();
    if (!nextSong || nextSong.id === owner || !getSongPlaybackSourceKey(nextSong)) return;
    let cancelled = false;
    let cancelIdle: (() => void) | undefined;
    const allowed = () => !cancelled && playingRef.current && songRef.current?.id === owner &&
      settingsRef.current.gaplessPlayback && !crossfadeAutoStartedRef.current &&
      !crossfadeHandoffRef.current && !crossfadeMainPauseGuardRef.current;
    const timer = window.setTimeout(() => {
      cancelIdle = runLocaltifyIdleTask(() => {
        if (!allowed()) return;
        void resolvePlaybackUrl(nextSong).then(result => {
          if (!allowed() || !result.ok || !result.url || result.fileExists === false) return;
          if (!nextAudioRef.current) {
            nextAudioRef.current = new Audio();
            nextAudioRef.current.crossOrigin = "anonymous";
            nextAudioRef.current.preload = "auto";
          }
          const nextAudio = nextAudioRef.current;
          if (!nextAudio.paused || nextAudio.src === result.url) return;
          nextAudio.src = result.url;
          nextAudio.load();
        }).catch(() => undefined);
      }, 1800);
    }, 650);
    return () => { cancelled = true; window.clearTimeout(timer); cancelIdle?.(); };
  }, [isPlaying, settings.gaplessPlayback, currentSong?.id, playQueue, repeatMode, repeatPlaylist,
    activePlaylist, activePlaylistSongs, playableSongs, songsById, isShuffle, playbackSource, resolvePlaybackUrl]);

  function getAutoCrossfadeSeconds() {
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
    playbackTransitionRef.current.crossfadeCancelled();
    if (crossfadeIntervalRef.current !== null) {
      window.clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }

    if (crossfadeHandoffClearTimerRef.current !== null) {
      window.clearTimeout(crossfadeHandoffClearTimerRef.current);
      crossfadeHandoffClearTimerRef.current = null;
    }

    if (crossfadeRecoveryTimerRef.current !== null) {
      window.clearTimeout(crossfadeRecoveryTimerRef.current);
      crossfadeRecoveryTimerRef.current = null;
    }
    crossfadeAutoStartedRef.current = false;
    crossfadeAutoTargetRef.current = "";
    crossfadeMainPauseGuardRef.current = false;
    crossfadeHandoffRef.current = null;
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

    const sourceLoop = sourceLoopRestart();
    if (sourceLoop) {
      // A one-song loop restarts through the ended handler instead of crossfading into itself.
      return sourceLoop.song.id === currentSong.id
        ? null
        : { song: sourceLoop.song, playlistId: null, kind: "source-loop" as const, rest: sourceLoop.rest };
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
      // The queue can be reordered while the secondary element fades in.
      // Consume the actual incoming track, not an index captured before that edit.
      setPlayQueue((queue) => {
        const index = queue.indexOf(target.song.id);
        return index < 0 ? queue : [...queue.slice(0, index).filter(id => isPlayableSong(songsById.get(id))), ...queue.slice(index + 1)];
      });
    } else if (target.kind === "source-loop") {
      setPlayQueue(target.rest);
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

  async function takeOverMainAudioFromCrossfade(target: ReturnType<typeof getAutoTransitionTarget>, nextAudio: HTMLAudioElement, safeVolume: number, version: number) {
    const audio = audioRef.current;
    if (!audio || !target?.song || !playbackTransitionRef.current.isCurrentCrossfade(target.song.id, version)) return;
    const ownsHandoff = () => playbackTransitionRef.current.isCurrentCrossfade(target.song.id, version);

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
      if (!ownsHandoff()) return;

      commitAutoTransitionTarget(target);

      pendingPlayRef.current = false;
      armPlayCount(target.song.id, Math.max(0, handoffTime));
      listeningHistoryRef.current?.play(target.song.id, handoffTime, target.playlistId ?? null);
      pushQueueHistory(target.song);
      setCurrentId(target.song.id);
      setCrossfadePreviewSongId("");
      void rememberCurrentSong(target.song.id);
      setCurrentTime(Math.max(0, handoffTime));
      timeRef.current = Math.max(0, handoffTime);
      setCurrentDuration(target.song.duration || nextAudio.duration || 0);
      setIsPlaying(true);
      setPlayerError("");
      setStatusText(`crossfading into ${prettyTitle(target.song.title, 5)}`);
      playbackTransitionRef.current.crossfadeFinished(target.song.id);

      const blendMs = 420;
      const blendStart = performance.now();
      const blendGeneration = playbackTransitionRef.current.snapshot().generation;

      const blendTimer = window.setInterval(() => {
          if (!playbackTransitionRef.current.isCurrent(blendGeneration, target.song.id)) {
            window.clearInterval(blendTimer);
            if (crossfadeIntervalRef.current === blendTimer) crossfadeIntervalRef.current = null;
            return;
          }
          const progressValue = clamp((performance.now() - blendStart) / blendMs, 0, 1);
          const eased = 1 - Math.pow(1 - progressValue, 2.6);

          setAudioElementVolume(audio, safeVolume * eased);
          setAudioElementVolume(nextAudio, safeVolume * (1 - eased));

          if (progressValue >= 1) {
            window.clearInterval(blendTimer);
            if (crossfadeIntervalRef.current === blendTimer) crossfadeIntervalRef.current = null;
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
      crossfadeIntervalRef.current = blendTimer;
    } catch {
      if (!ownsHandoff()) return;
      // Keep the already-playing hidden audio alive briefly so users do not hear a hard stop,
      // then let the normal playback state-sync recover.
      commitAutoTransitionTarget(target);
      setCurrentId(target.song.id);
      setCrossfadePreviewSongId("");
      void rememberCurrentSong(target.song.id);
      setIsPlaying(true);
      crossfadeMainPauseGuardRef.current = false;
      playbackTransitionRef.current.crossfadeFinished(target.song.id);

      const recoveryGeneration = playbackTransitionRef.current.snapshot().generation;
      crossfadeRecoveryTimerRef.current = window.setTimeout(() => {
        crossfadeRecoveryTimerRef.current = null;
        if (!playbackTransitionRef.current.isCurrent(recoveryGeneration, target.song.id)) return;
        try {
          nextAudio.pause();
          nextAudio.currentTime = 0;
          setAudioElementVolume(nextAudio, 0);
        } catch {
          // ignore cleanup errors
        }
        clearCrossfadeHandoffSoon(target.song.id);
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

    if (!playbackTransitionRef.current.crossfadeStarted(target.song.id)) return;
    crossfadeAutoStartedRef.current = true;
    crossfadeAutoTargetRef.current = target.song.id;
    crossfadeLastStartAtRef.current = performance.now();

    const version = playbackTransitionRef.current.snapshot().generation;
    const playbackUrl = await resolvePlaybackUrl(target.song);
    if (!crossfadeAutoStartedRef.current || !playbackTransitionRef.current.isCurrentCrossfade(target.song.id, version)) return;

    if (!playbackUrl.ok || !playbackUrl.url || playbackUrl.fileExists === false) {
      crossfadeAutoStartedRef.current = false;
      crossfadeAutoTargetRef.current = "";
      playbackTransitionRef.current.crossfadeCancelled();
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
    // This element may have been created earlier by the preloader. Enforce
    // CORS before loading any URL or reusing it for a crossfade.
    nextAudio.crossOrigin = "anonymous";
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
      if (!crossfadeAutoStartedRef.current || !playbackTransitionRef.current.isCurrentCrossfade(target.song.id, version)) return;

      setCrossfadePreviewSongId(target.song.id);
      stopFade();

      const startTime = performance.now();

      if (crossfadeIntervalRef.current !== null) {
        window.clearInterval(crossfadeIntervalRef.current);
      }

      crossfadeIntervalRef.current = window.setInterval(() => {
        const elapsed = performance.now() - startTime;
        const rawProgress = clamp(elapsed / crossfadeMs, 0, 1);

        // Blend tracks without an abrupt volume spike.
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

          markSongCompletedForPlayCount(current, "transition");
          if (current.id) void patchSongLocal(current.id, { playbackPosition: 0 });

          crossfadeAutoStartedRef.current = false;
          crossfadeAutoTargetRef.current = "";

          void takeOverMainAudioFromCrossfade(target, nextAudio, safeVolume, version);
        }
      }, 16);
    } catch {
      if (!playbackTransitionRef.current.isCurrentCrossfade(target.song.id, version)) return;
      playbackTransitionRef.current.crossfadeCancelled();
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
    if (crossfadeMainPauseGuardRef.current && crossfadeHandoffRef.current?.songId !== currentSong?.id) return;
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
    if (audioRef.current && !audioRef.current.paused) return;
    if (pendingPlayRef.current && ["loading", "ready"].includes(playbackTransitionRef.current.snapshot().phase)) return;
    if (!playbackTransitionRef.current.paused(Boolean(
      crossfadeAutoStartedRef.current || crossfadeMainPauseGuardRef.current || crossfadeHandoffRef.current
    ))) return;
    const audio = audioRef.current;
    if (audio) {
      listeningHistoryRef.current?.pause(audio);
      if (!audio.ended && Number.isFinite(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
        syncProgressDom(audio.currentTime, durationRef.current, true);
      }
    }
    if (!audio?.ended) setIsPlaying(false);
  }

  function handleAudioEnded() {
    if (!playbackTransitionRef.current.ended(Boolean(crossfadeAutoStartedRef.current || crossfadeHandoffRef.current))) return;
    const endedSong = songRef.current || currentSong;
    markSongCompletedForPlayCount(endedSong);

    if (endedSong?.id) {
      void patchSongLocal(endedSong.id, { playbackPosition: 0 });
    }

    if (repeatMode === "one" && restartCurrentSongForRepeatOne()) {
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

    // No animation frames while hidden
    if (safeDuration <= 0 || Math.abs(delta) < 0.002 || document.hidden) {
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
      resetPlayCountTracker("error");
      setIsPlaying(false);
      setPlayerError("this audio file is missing. reimport it on this pc.");
      setStatusText("file missing");
      return false;
    }

    devPerfStart(`playback:${song.id}`);
    const generation = playbackTransitionRef.current.requestPlay(song.id);
    const playbackUrl = await resolvePlaybackUrl(song);
    if (!playbackTransitionRef.current.isCurrent(generation, song.id)) return false;

    if (!playbackUrl.ok || !playbackUrl.url || playbackUrl.fileExists === false) {
      pendingPlayRef.current = false;
      resetPlayCountTracker("error");
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
      if (!playbackTransitionRef.current.isCurrent(generation, song.id)) {
        if (audioRef.current === audio && audio.src === playbackUrl.url
          && playbackTransitionRef.current.snapshot().phase === "paused") audio.pause();
        return false;
      }
      pendingPlayRef.current = false;

      if (!continuingCrossfadePlayback && !settings.reducedMotion && settings.crossfadeEnabled && safeVolume > 0) {
        fadeAudio(safeVolume, Math.max(120, Number(settings.crossfadeSeconds || 1.6) * 1000));
      } else {
        setAudioElementVolume(audio, safeVolume);
      }

      if (handoffActive) {
        clearCrossfadeHandoffSoon(song.id, 650);
      }


      setIsPlaying(true);
      setPlayerError("");
      setStatusText(`playing ${prettyTitle(song.title, 5)}`);
      playbackTransitionRef.current.playing();

      return true;
    } catch {
      if (!playbackTransitionRef.current.isCurrent(generation, song.id)) return false;
      pendingPlayRef.current = false;
      resetPlayCountTracker("error");
      setIsPlaying(false);
      setPlayerError(getAudioErrorText(audio));
      setStatusText(reason === "manual" ? "playback failed" : "audio not ready");

      return false;
    }
  }

  function pauseAudioSmooth() {
    stopCrossfadeAuto();
    playbackTransitionRef.current.requestPause();
    const audio = audioRef.current;
    const playerController = ensurePlayerController();

    pendingPlayRef.current = false;

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

  const {startPlayerResize,startSidebarResize}=useShellResize({
    appRootRef, settingsRef, discordSettingsRef, setSettings, saveSettingsSafely
  });

  async function rememberCurrentSong(id: string) {
    if (!id || !settingsRef.current.rememberLastSong) return;
    await persistSettings({ ...settingsRef.current, lastSongId: id }, true);
  }

  function replaceSong(updated: Song | null) {
    if (!updated) return;

    setSongs((oldSongs) => replaceLibrarySong(oldSongs, updated, songIndexById.get(updated.id)));

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
      if (cacheKey) {
        playbackUrlCacheRef.current.delete(cacheKey);
        playbackUrlPendingRef.current.delete(`${cacheKey}:normal`);
        playbackUrlPendingRef.current.delete(`${cacheKey}:force`);
      }
    }

    const previousSong = songsById.get(id);
    setSongs((oldSongs) => patchLibrarySong(oldSongs, id, patch, songIndexById.get(id)));

    try {
      const updated = await window.localitfy.patchSong(id, patch);
      if (!updated) throw new Error("Song was not saved");
      replaceSong(updated);
    } catch {
      if (previousSong) setSongs((current) => current.map((song) => {
        if (song.id !== id) return song;
        const rollback: Partial<Song> = {};
        for (const key of Object.keys(patch) as (keyof Song)[]) {
          if (Object.is(song[key], patch[key])) (rollback as Record<string, unknown>)[key] = previousSong[key];
        }
        return Object.keys(rollback).length ? { ...song, ...rollback } : song;
      }));
      showAppToast("Could not save song changes", "error");
    }
  }


  function openMetadataCleanPreview(scope: "all" | "selected" = "all") {
    if (!songs.length || libraryScanBusy) return;

    if (scope === "selected" && !coverSelectedSongIds.length) {
      showAppToast("select songs in cover studio first", "info");
      setLibraryScanMessage("select songs in cover studio first");
      return;
    }

    const preview = createMetadataCleanPreview(songs, coverSelectedSongIds, scope);
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

  async function repairMovedSongsAction() {
    if (libraryScanBusy) return;
    setLibraryScanBusy(true);
    try {
      const result = await window.localitfy.repairMovedSongs();
      if (result.canceled) return;
      if (result.ok && result.changedCount > 0 && Array.isArray(result.songs)) {
        setSongs(applyLibraryOrder(sanitizeSongList(result.songs)));
        playbackUrlCacheRef.current.clear();
        playbackUrlPendingRef.current.clear();
      }
      const message = result.message || (result.ok ? "No missing songs relinked." : "Moved-file scan failed.");
      setLibraryScanMessage(message);
      setStatusText(message);
      showAppToast(message, result.ok ? "success" : "error");
    } catch (error) {
      console.warn("[localitfy moved-file repair]", error);
      setLibraryScanMessage("Moved-file scan failed. Your library has not been changed.");
      showAppToast("Moved-file scan failed", "error");
    } finally {
      setLibraryScanBusy(false);
    }
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
    const scope = view === "library" || view === "liked" ? visibleSongs.filter(isPlayableSong) : playableSongs;
    const { shuffled, nextSong, queuedSongIds } = buildShuffleQueue(scope, currentId);

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

  function openPlaylistPicker(song: Song) {
    setSongContextMenu(null);
    openPlaylistPickerCore(song);
  }

  function openSongContextMenu(event: ReactMouseEvent<HTMLElement>, song: Song) {
    songContextAnchorRef.current = event.currentTarget;
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 236;
    const menuHeight = 600;
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
    if (connect.queue([songId], next)) return;
    setPlayQueue((queue) => {
      const cleanedQueue = queue.filter((id) => id !== songId);
      return next ? [songId, ...cleanedQueue] : [...cleanedQueue, songId];
    });
    setStatusText(next ? "queued next" : "added to queue");
  }

  function playQueueItem(index: number) {
    const songId = playQueue[index];
    if (!songId) return;
    setPlayQueue((queue) => queue.slice(index + 1));
    void selectSong(songId, true, { keepPlaylistContext: true, keepSource: true });
  }

  const closeQueuePanel = useCallback(() => setQueuePanelOpen(false), []);
  const closeLyrics = useCallback(() => setLyricsOpen(false), []);
  const getLyricsTime = useCallback(() => audioRef.current?.currentTime ?? timeRef.current, []);
  const getLyricsRate = useCallback(() => audioRef.current?.playbackRate || 1, []);
  const subscribeLyricsClock = useCallback((listener: () => void) => {
    const audio = audioRef.current;
    if (!audio) return () => undefined;
    const events = ["seeked", "seeking", "ratechange", "playing", "pause", "loadedmetadata", "timeupdate"] as const;
    for (const event of events) audio.addEventListener(event, listener);
    return () => { for (const event of events) audio.removeEventListener(event, listener); };
  }, []);

  function revealNowPlaying() {
    nav.revealNowPlaying(nowPlayingContext);
  }

  function playCollectionSongs(songIds: string[], collectionTitle = "collection", source: PlaybackSourceRef | null = null, shuffled = false, startId?: string) {
    const ids = getPlayableUniqueSongIds(songIds, songsById);
    if (!ids.length) {
      setStatusText("collection has no playable songs");
      return;
    }

    const order = shuffled ? makeShuffledPlayableSongs(ids.map((id) => songsById.get(id)).filter(isPlayableSong)).map((song) => song.id) : ids;
    const start = Math.max(0, order.indexOf(startId!));
    setActivePlaylistId(null);
    setPlayQueue(order.slice(start + 1));
    void selectSong(order[start], true, { playlistId: null, source: source ? { ...source, songIds: order } : null });
    setStatusText(`${shuffled ? "shuffling" : "playing"} ${collectionTitle}`);
  }

  function queueCollectionSongs(songIds: string[], collectionTitle = "collection") {
    if (connect.queue(songIds, false)) return;
    const ids = getPlayableUniqueSongIds(songIds, songsById);
    if (!ids.length) {
      setStatusText("collection has no playable songs");
      return;
    }

    setPlayQueue((queue) => {
      const collectionIdSet = new Set(ids);
      const cleanedQueue = queue.filter((songId) => !collectionIdSet.has(songId));
      return [...cleanedQueue, ...ids];
    });
    setStatusText(`queued ${ids.length} track${ids.length === 1 ? "" : "s"} from ${collectionTitle}`);
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
    if (event.button !== 0 || !songId || libraryOrderLocked) return;

    const blockedDragOrigin =
      event.target instanceof HTMLElement
        ? event.target.closest(
            "button, input, textarea, select, a, [role='button'], .iconAction"
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
            "button, input, textarea, select, a, [role='button'], .iconAction"
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
    if (libraryOrderLocked) return;
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
    if (libraryOrderLocked) return;
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
    if (libraryOrderLocked) return;
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
    if (libraryOrderLocked) return;
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
    setPlaybackSource(null);
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

    setPlaybackSource(null);
    setActivePlaylistId(playlist.id);
    setSelectedPlaylistId(playlist.id);
    setPlayQueue(orderedSongs.slice(startIndex + 1).map((song) => song.id));
    await selectSong(songId, shouldPlay, { playlistId: playlist.id });
    setStatusText(`playing ${playlist.name}`);
  }

  async function selectSong(
    songId: string,
    shouldPlay = settings.autoplayOnSelect,
    playbackContext?: { playlistId?: string | null; keepPlaylistContext?: boolean; source?: PlaybackSource | null; keepSource?: boolean }
  ) {
    if (shouldPlay && connect.play(songId)) return;
    const targetSong = songsById.get(songId);
    const sameSong = songId === currentId;
    const audio = audioRef.current;
    if (startupResumePositionRef.current?.songId !== songId) {
      startupResumePositionRef.current = null;
    }

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

    // Drop old collection context on standalone selections.
    if (playbackContext && "source" in playbackContext) {
      setPlaybackSource(playbackContext.source ?? null);
    } else if (!playbackContext?.keepSource && !playbackContext?.keepPlaylistContext) {
      setPlaybackSource(null);
    }

    if (playbackContext?.playlistId !== undefined) {
      setActivePlaylistId(playbackContext.playlistId);
    } else if (!shouldKeepPlaylistContext && activePlaylistId) {
      setActivePlaylistId(null);
    }

    listeningHistoryRef.current?.finish("replaced");

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
    if (connect.toggle()) return;
    if (!currentSong) {
      if (playableSongs[0]) {
        void selectSong(playableSongs[0].id, true);
      }

      return;
    }

    if (isPlaying) {
      stopCrossfadeAuto();
      playbackTransitionRef.current.requestPause();
      pendingPlayRef.current = false;
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

  const sourceLoopRestart = () => getSourceLoopRestart(repeatMode, playbackSource, Boolean(activePlaylist), songsById);

  function playNext(forcePlay = true, trigger: "manual" | "auto" = "manual") {
    if (trigger === "manual") stopCrossfadeAuto();
    if (!playableSongs.length || (trigger === "manual" && connect.skip(1))) return;

    if (trigger === "auto" && repeatMode === "one" && restartCurrentSongForRepeatOne()) {
      return;
    }

    const queuedIndex = playQueue.findIndex((songId) => isPlayableSong(songsById.get(songId)));
    if (queuedIndex !== -1) {
      const queuedSong = songsById.get(playQueue[queuedIndex]);
      setPlayQueue((queue) => queue.slice(queuedIndex + 1));
      if (queuedSong) {
        const queuedBelongsToPlaylist = Boolean(activePlaylist?.songIds.includes(queuedSong.id));
        void selectSong(queuedSong.id, forcePlay, { playlistId: queuedBelongsToPlaylist ? activePlaylist?.id : undefined, keepSource: true });
        return;
      }
    } else if (playQueue.length) {
      setPlayQueue([]);
    }

    const sourceLoop = sourceLoopRestart();
    if (sourceLoop) {
      setPlayQueue(sourceLoop.rest);
      void selectSong(sourceLoop.song.id, forcePlay, { playlistId: null, keepSource: true });
      return;
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
    if (!playableSongs.length || connect.skip(-1)) return;

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

    const sourceStep = currentSong ? getSourcePreviousStep(repeatMode, playbackSource, currentSong.id, songsById) : null;
    if (sourceStep && currentSong) {
      const currentSongId = currentSong.id;
      if (sourceStep.queueChange === "requeue-current") setPlayQueue((queue) => [currentSongId, ...queue.filter((songId) => songId !== currentSongId)]);
      else if (sourceStep.queueChange === "clear") setPlayQueue([]);
      void selectSong(sourceStep.songId, true, { playlistId: null, keepSource: true });
      return;
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
    // Incoming metadata may arrive before React commits the incoming song ID.
    if (crossfadeMainPauseGuardRef.current && crossfadeHandoffRef.current?.songId !== currentSong.id) return;

    const rounded = Math.floor(duration);
    setCurrentDuration(rounded);
    const pending = startupResumePositionRef.current;
    if (pending?.songId === currentSong.id) {
      startupResumePositionRef.current = null;
      const seekTo = Math.min(pending.time, Math.max(0, duration - 2));
      const audio = audioRef.current;
      if (audio && seekTo > 1) {
        try {
          audio.currentTime = seekTo;
          timeRef.current = seekTo;
          setCurrentTime(seekTo);
        } catch { /* Ignore unsupported resume positions. */ }
      }
    }

    if (rounded !== currentSong.duration) {
      void patchSongLocal(currentSong.id, { duration: rounded });
    }
  }

  function handleCanPlay() {
    playbackTransitionRef.current.ready();
    const audio = audioRef.current;
    if (!audio) return;

    if ((pendingPlayRef.current || isPlaying) && audio.paused) {
      void startAudioPlayback("can-play");
    }
  }

  function handlePlaying() {
    if (audioRef.current?.paused) return;
    if (crossfadeMainPauseGuardRef.current && crossfadeHandoffRef.current?.songId !== currentSong?.id) return;
    if (playbackTransitionRef.current.snapshot().phase === "paused") {
      audioRef.current?.pause();
      return;
    }
    playbackTransitionRef.current.playing();
    const song = songRef.current || currentSong;
    if (!song) return;
    devPerfEnd(`playback:${song.id}`, "audio playing");

    pendingPlayRef.current = false;
    setIsPlaying(true);
    if (!crossfadeMainPauseGuardRef.current) {
      listeningHistoryRef.current?.play(song.id, audioRef.current?.currentTime || 0, activePlaylistId);
    }

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
    if (!audio || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(Number(value))) return;

    if (crossfadeAutoStartedRef.current) {
      stopCrossfadeAuto();
      const current = songRef.current;
      const base = clamp(volumeRef.current, 0, 1);
      const memory = settingsRef.current.perSongVolumeMemory ? clamp(Number(current?.customVolume ?? 1), 0, 1) : 1;
      const gain = settingsRef.current.volumeNormalization ? clamp(Number(current?.volumeGain ?? 1), 0.2, 2.4) : 1;
      const restored = clamp(base * memory * gain, 0, 1);
      setAudioElementVolume(audio, restored);
      effectiveVolumeRef.current = restored;
    }
    playbackTransitionRef.current.seekStarted();
    const safePercent = clamp(Number(value), 0, 100);
    const nextTime = (safePercent / 100) * duration;
    const controller = ensurePlayerController();
    if (controller) controller.seekTo(nextTime);
    else audio.currentTime = nextTime;
    timeRef.current = nextTime;
    lastProgressUiPaintRef.current = 0;
    syncProgressDom(nextTime, duration, true);
    setCurrentTime(nextTime);
    playbackTransitionRef.current.seekFinished();

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
    const nextSettings = { ...settingsRef.current, volume: safeVolume };

    settingsRef.current = nextSettings;
    volumeRef.current = safeVolume;
    volumeDraftRef.current = safePercent;
    setVolumeDraft(safePercent);
    applyLiveVolumePercent(safePercent);
    setSettings(nextSettings);

    if (!bootedRef.current) return;

    void saveSettingsSafely(nextSettings, false);
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

  /** Duplicates were folded into kept copies in the database; point app state at the kept songs. */
  function applyDuplicateMerge({ merges, songs: nextSongs }: DuplicatesMergeResult) {
    const keptFor = keptForRemoved(merges);
    if (currentId && keptFor.has(currentId)) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setCurrentId(keptFor.get(currentId) || "");
    }
    setPlayQueue((queue) => remapSongIds(queue, keptFor));
    setQueueHistory((history) => history.map((item) => keptFor.has(item.songId) ? { ...item, songId: keptFor.get(item.songId)! } : item));
    setPlaylists((items) => items.map((item) => ({ ...item, songIds: remapSongIds(item.songIds, keptFor) })));
    setSongs(applyLibraryOrder(sanitizeSongList(nextSongs)));
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

        if (settingsRef.current.rememberLastSong) {
          await persistSettings({ ...settingsRef.current, lastSongId: nextSong?.id || "" });
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

        if (settingsRef.current.rememberLastSong) {
          await persistSettings({ ...settingsRef.current, lastSongId: nextSong?.id || "" });
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

  const selectPlaylistSongAction = useStableCallback((songId: string, playlistId?: string) => {
    void playSongFromPlaylist(playlistId || selectedPlaylist?.id || "", songId, true);
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

  function dismissOnboarding() {
    markOnboardingSeenForThisRelease();

    setOnboardingDevPreview(false);
    setOnboardingOpen(false);
  }

  function skipOnboarding() {
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
        theme: nextTheme
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

  const openFeedbackPrompt = useCallback(() => {
    setFeedbackStatus({ kind: "idle", message: "" });
    setFeedbackPromptOpen(true);
  }, []);

  const closeFeedbackPrompt = useCallback(() => {
    setFeedbackPromptOpen(false);
    setFeedbackSendBusy(false);
    setFeedbackStatus({ kind: "idle", message: "" });
  }, []);

  useEffect(() => {
    if (!ready) return;

    const openFeedbackNow = () => {
      setQuery("");
      setSettingsSearch("");
      setFeedbackCategory("bug");
      openFeedbackPrompt();
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
      setFeedbackStatus({ kind: "success", message: "Sent successfully. Thanks, I will review this." });
      setFeedbackMessage("");

      window.setTimeout(() => {
        setFeedbackPromptOpen(false);
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

  const repeatButtonStateText = repeatMode === "one" ? "1" : "";
  const repeatButtonTitle = repeatButtonTitleFor(repeatMode, Boolean(activePlaylist), playbackSource);
  const repeatButtonAriaLabel = repeatButtonTitle;

  const nowPlayingMotionNonce = Number(nowPlayingTransitionKey.split(":").pop() || "0");
  const nowPlayingSongMotionClass =
    nowPlayingMotionNonce === 0
      ? "nowPlayingSongInitial"
      : nowPlayingMotionNonce % 2 === 0
        ? "nowPlayingSongEven"
        : "nowPlayingSongOdd";


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
          onClick={() => openFeedbackPrompt()}
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
        settings={settings}
        updateSetting={updateSetting}
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
        repairMovedSongsAction={repairMovedSongsAction}
        cleanSelectedMetadataAction={cleanSelectedMetadataAction}
        metadataSelectedCount={coverSelectedSongIds.length}
        metadataCleanPreview={metadataCleanPreview}
        applyMetadataCleanPreviewAction={applyMetadataCleanPreviewAction}
        cancelMetadataCleanPreviewAction={cancelMetadataCleanPreviewAction}
        undoLastMetadataCleanAction={undoLastMetadataCleanAction}
        metadataUndoCount={metadataUndoItems.length}
        rebuildSearchIndexAction={rebuildSearchIndexAction}
        libraryScanMessage={libraryScanMessage}
        changeView={changeView}
        pixelArtAssets={pixelArtAssets}
        pixelArtBusy={pixelArtBusy}
        randomizeAllCovers={randomizeAllCovers}
        rescanPixelArtFolder={rescanPixelArtFolder}
        downloadFolderLabel={downloadFolderLabel}
        chooseDownloadFolder={chooseDownloadFolder}
        APP_VERSION={APP_VERSION}
        updatePrompt={updatePrompt}
        manualUpdateCheck={manualUpdateCheck}
        askUpdaterToInstall={askUpdaterToInstall}
        copyDiagnosticsInfo={copyDiagnosticsInfo}
        diagnosticsCopied={diagnosticsCopied}
        diagnosticsInfo={diagnosticsInfo}
        platformInfo={platformInfo}
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

  useAppMenuCommands({
    changeView, nav,
    openSettings: () => openSettingsPanel(),
    importSongs,
    openFeedback: openFeedbackPrompt,
    checkForUpdates: () => { openSettingsPanel("updates"); return manualUpdateCheck(); }
  });

  const nowPlayingContext = resolveNowPlayingContext(currentSong, activePlaylist, playbackSource);
  const queuePanelAutoNextSong = queuePanelOpen && !playQueue.length && !isShuffle ? getNextPlayableSongForCache() : null;
  // Repeat and shuffle already decide what plays forever, so radio only fills in when playback would run out.
  const songRadioEnabled = settings.songRadio && settings.experimentalMusicAnalysis && repeatMode === "off" && !repeatPlaylist && !isShuffle;
  const radioSongIds = useSongRadio({
    enabled: songRadioEnabled, isPlaying, currentSongId: currentSong?.id || "", queue: playQueue, setQueue: setPlayQueue, songsById,
    continues: songRadioEnabled && !playQueue.length ? Boolean(getAutoTransitionTarget()) : true,
    onRefill: (count) => setStatusText(`radio: queued ${count} similar song${count === 1 ? "" : "s"}`)
  });
  const notForMe = useNotForMe({ settings, updateSettingsPatch, songsById, setQueue: setPlayQueue, radioSongIds, announce: setStatusText });
  const connect = usePlaybackConnect({
    songsById, currentSong, isPlaying, queue: playQueue, isShuffle, repeatMode, contextLabel: nowPlayingContext.label, rate: settings.playbackSpeed,
    getTime: () => timeRef.current, getDuration: () => durationRef.current, togglePlay, next: playNext, previous: playPrevious, playQueueItem,
    seek: (seconds) => handleSeek((seconds / (durationRef.current || 1)) * 100), setQueue: setPlayQueue, setShuffle: setIsShuffle, setRepeat: setRepeatMode,
    start: (songId, time, play) => { startupResumePositionRef.current = { songId, time }; void selectSong(songId, play, { source: null }); },
    onLike: (id, liked) => setSongs((all) => patchLibrarySong(all, id, { liked }, songIndexById.get(id))), toast: showAppToast
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
    failedQueueItems: failedDownloadQueueItems,
    finishedQueueItems: finishedDownloadQueueItems,
    failedResults: failedDownloadResults,
    firstError: firstDownloadError
  } = downloadPageState;
  // Downloads owns its view filters. Never discard failed/cancelled jobs upstream.
  const visibleDownloadQueueItems = downloadQueue;
  const visibleDownloadResults = downloadResults;
  const copyDownloadError = async (errorText?: string) => {
    const text = String(errorText || firstDownloadError || "No download error found.");
    try {
      await navigator.clipboard?.writeText(text);
      setStatusText("download error copied");
    } catch {
      setStatusText(text);
    }
  };
  const retryFailedDownloads = () => retryDownloads(
    [...failedDownloadQueueItems, ...failedDownloadResults],
    item => item.source === "local" ? convertLocalMedia() : retryDownload(item.url || "", item.source === "spotify" ? "spotify" : "youtube", item.spotifyTrackId || "", item.recoveryId)
  );

  const homeSettings = useMemo(() => ({
    heroExpanded: settings.heroExpanded,
    volume: settings.volume,
    homeSectionOrder: settings.homeSectionOrder,
    homeHiddenSections: settings.homeHiddenSections
  }), [settings.heroExpanded, settings.volume, settings.homeSectionOrder, settings.homeHiddenSections]);
  const homeOpenAnalysis = useStableCallback(() => { setSettingsSearch(""); setSettingsCategory("experimental"); changeView("settings"); });
  const homeOpenCovers = useStableCallback(openCoversViewWithCurrentSong);
  const homeOpenMixes = useStableCallback(() => nav.go("playlists"));
  const homePlaySongs = useStableCallback(playCollectionSongs);
  const homeSelectSong = useStableCallback(selectSong);
  const homeShuffle = useStableCallback(shuffleLibrarySongsAction);
  const homeToggleHero = useStableCallback(toggleHeroExpanded);
  const homeUpdateLayout = useStableCallback((patch: Parameters<typeof updateSettingsPatch>[0]) => void updateSettingsPatch(patch));

  const playerVolumeSettings = useMemo(() => ({ volume: settings.volume }), [settings.volume]);
  const playerCommitSeek = useStableCallback(commitSeek);
  const playerCommitVolume = useStableCallback(commitVolume);
  const playerDragLeave = useStableCallback(handlePlayerDragLeave);
  const playerDragOver = useStableCallback(handlePlayerDragOver);
  const playerDrop = useStableCallback(handlePlayerDrop);
  const playerOpenMenu = useStableCallback(openSongContextMenu);
  const playerNext = useStableCallback(playNext);
  const playerPrevious = useStableCallback(playPrevious);
  const playerPreviewSeek = useStableCallback(previewSeek);
  const playerPreviewVolume = useStableCallback(previewVolume);
  const playerToggleLyrics = useStableCallback(() => setLyricsOpen(open => !open));
  const playerReveal = useStableCallback(revealNowPlaying);
  const playerResize = useStableCallback(startPlayerResize);
  const playerStartSeek = useStableCallback(startSeekPreview);
  const playerLike = useStableCallback(toggleLike);
  const playerToggle = useStableCallback(togglePlay);
  const playerToggleQueue = useStableCallback(() => setQueuePanelOpen(open => !open));
  const playerRepeat = useStableCallback(toggleRepeat);
  const playerMute = useStableCallback(toggleMuteFromNative);
  const playerUpdateVolume = useStableCallback((key: "volume", value: number, persist?: boolean) => updateSetting(key, value, persist));
  const playerQueueItem = useStableCallback(playQueueItem);
  const playerLyricsSeek = useStableCallback((seconds: number) => handleSeek((seconds / (durationRef.current || currentDuration || currentSong?.duration || 1)) * 100));
  const playerLyricsSettings = useStableCallback(() => { setLyricsOpen(false); setSettingsSearch(""); setSettingsCategory("experimental"); changeView("settings"); });

  const libraryAreaDragOver = useStableCallback(handleLibraryAreaDragOver);
  const libraryAreaDragLeave = useStableCallback(handleLibraryAreaDragLeave);
  const libraryAreaDrop = useStableCallback(handleLibraryAreaDrop);
  const libraryRowSettings = useMemo(() => ({libraryRowStyle: settings.libraryRowStyle}), [settings.libraryRowStyle]);
  const libraryRows = useMemo<Omit<VirtualSongRowsProps, "list" | "className">>(() => ({
    currentId, isPlaying, draggedSongId, libraryDragOverSongId, libraryDropSide, draggedSongTitle,
    onAreaDragOver: libraryAreaDragOver, onAreaDragLeave: libraryAreaDragLeave, onAreaDrop: libraryAreaDrop,
    onSelectSong: selectSongCardAction, onTogglePlay: togglePlayCardAction, onToggleLike: toggleLikeCardAction,
    onOpenEditor: openEditorCardAction, onOpenPlaylistPicker: openPlaylistPickerCardAction,
    onOpenSongContextMenu: openSongContextMenuCardAction, onStartSongDrag: startSongDragCardAction,
    onPointerStartSongDrag: startPointerSongDragCardAction, registerLibrarySongElement,
    onDragOverSong: dragOverSongCardAction, onDragLeaveSong: dragLeaveSongCardAction,
    onDropSong: dropSongCardAction, onDragEnd: endSongDragCardAction
  }), [currentId, isPlaying, draggedSongId, libraryDragOverSongId, libraryDropSide, draggedSongTitle,
    libraryAreaDragOver, libraryAreaDragLeave, libraryAreaDrop, selectSongCardAction, togglePlayCardAction,
    toggleLikeCardAction, openEditorCardAction, openPlaylistPickerCardAction, openSongContextMenuCardAction,
    startSongDragCardAction, startPointerSongDragCardAction, registerLibrarySongElement, dragOverSongCardAction,
    dragLeaveSongCardAction, dropSongCardAction, endSongDragCardAction]);

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
      effectiveTheme,
      effectiveAmbient,
      effectiveCoverColorSyncMode,
      effectiveNotes,
      statusText,
      draggedSongTitle
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
      appToast,
      importAnimation
    },
    navigation: {
      view,
      changeView,
      importSongs,
      startSidebarResize,
      contentRef,
      updateSidebarLayout: (patch) => void updateSettingsPatch(patch),
      openSidebarSettings,
      history: nav
    },
    home: {
      ambientStyle,
      currentId,
      currentSong: visualCurrentSong,
      heroDisplayArtist,
      heroDisplayTitle,
      heroMotionClass,
      heroTitleClass,
      homeFreshShelfSongs,
      homeListenNowSongs,
      isPlaying,
      isThreeAm,
      nowPlayingSongMotionClass,
      nowPlayingTransitionKey,
      openAnalysisSettings: homeOpenAnalysis,
      openCoversViewWithCurrentSong: homeOpenCovers,
      openDailyMixes: homeOpenMixes,
      openSimilarSongs: setSimilarRequest,
      playableSongCount: playableSongs.length,
      playerError,
      playSongs: homePlaySongs,
      selectSong: homeSelectSong,
      songs,
      settings: homeSettings,
      shuffleLibrarySongsAction: homeShuffle,
      toggleHeroExpanded: homeToggleHero,
      updateHomeLayout: homeUpdateLayout,
    },
    library: {
      changeView,
      deleteBusy,
      handleLibraryAreaDragLeave: libraryAreaDragLeave,
      handleLibraryAreaDragOver: libraryAreaDragOver,
      handleLibraryAreaDrop: libraryAreaDrop,
      handleSearchInput,
      importSongs,
      libraryAlbumCount,
      libraryArtistCount,
      libraryMissingLabel: `${effectiveMissingFileCount || missingSongs.length} missing file${(effectiveMissingFileCount || missingSongs.length) === 1 ? "" : "s"}`,
      librarySortMode,
      missingFileCount: effectiveMissingFileCount,
      query,
      removeMissingSongs,
      rows: libraryRows,
      setLibraryFilterMode,
      setLibrarySortMode,
      setLibraryRowStyle: (style) => void updateSetting("libraryRowStyle", style),
      settings: libraryRowSettings,
      showingMissingFiles: view === "library" && libraryFilterMode === "missing",
      shuffleLibrarySongsAction,
      openSimilarSongs: setSimilarRequest,
      applyDuplicateMerge,
      songs,
      view,
      visibleSongs
    },
    artists: {
      songs
    },
    genres: {
      songs
    },
    playlists: {
      dailyMixes: { songs, savePlaylist: createPlaylistFromSongs,
        openAnalysisSettings: () => { setSettingsSearch(""); setSettingsCategory("experimental"); changeView("settings"); } },
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
      openSimilarSongs: setSimilarRequest,
      playSongs: (ids: string[], label: string) => playCollectionSongs(ids, label),
      selectSong,
      playlistDragOverPlaylistId,
      playlistSummaries,
      removePlaylist,
      removePlaylistSongAction,
      renamingPlaylistId,
      renamingPlaylistName,

      savePlaylistRename,
      setPlaylistArtwork,
      selectPlaylistSongAction,
      selectedPlaylist,
      selectedPlaylistDuration,
      selectedPlaylistSongs,
      setNewPlaylistName,
      setRenamingPlaylistName,
      setSelectedPlaylistId,
      songs,
      startPlaylistSongDragAction,
      startRenamePlaylist,
      saveSmartPlaylist,
      listeningCounts, addSongToPlaylist, notForMe
    },
    covers: {
      applyCoverAssetToSelection,
      coverGalleryMood,
      coverMoodCounts,
      coverPickerSongList,
      coverSelectedSongIds,
      coverStats,
      currentSong: visualCurrentSong,
      filteredCoverGalleryAssets,
      importSongs,
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
      missingCoverSongs,
      cleanupCoverCache: cleanupCoverCacheAction,
      randomizeMissingCovers: randomizeMissingCoversAction
    },
    discover: {
      settings, updateSetting, notForMe, songs, selectLocalSong: (id: string) => void selectSong(id, true),
      sendToDownloads: (tracks: SpotifyTrack[]) => {
        setSpotifyTracks((current) => [...tracks, ...current.filter((track) => !tracks.some((next) => next.id === track.id))]);
        setSpotifySelectedIds(new Set(tracks.map((track) => track.id)));
        setDownloadsTab("spotify");
        changeView("downloads");
      }
    },
    analytics: {
      analyticsRecapCards,
      analyticsStatCards,
      averageSongSeconds,
      importSongs,
      libraryHealthLabel,
      libraryHealthPercent,
      libraryLengthLabel,
      likedPercent,
      longestSong,
      missingFileCount: effectiveMissingFileCount,
      neverPlayedCount,
      playedPercent,
      recentImportWeekCount,
      songs
    },
    settingsView: {
      renderSettingsCategoryContent,
      settingsRail: {
        tabs: visibleSettingsTabs,
        activeCategory: settingsCategory,
        search: settingsSearch,
        resultLabel: settingsSearchResultLabel,
        onSearchChange: handleSettingsSearchInput,
        onCategoryChange: setSettingsCategory
      },
      settingsCategory
    },
    downloads: {
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
      downloadSpotifyTracks,
      downloadStatusLabel,
      downloadText,
      downloadsTab,
      failedDownloadQueueItems,
      fetchSpotifyTracks,
      finishedDownloadQueueItems,
      handleSpotifyLogin,
      handleSpotifyLogout,
      openDownloadedSongInLibrary,
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
      visibleDownloadResults,
      songs
    },
    playerBar: connect.playerBar({
      ambientStyle,
      commitSeek: playerCommitSeek,
      commitVolume: playerCommitVolume,
      currentDuration,
      currentSong: visualCurrentSong,
      displayedProgress,
      displayedTime,
      draggedSongId,
      effectiveAmbient,
      effectiveCoverColorSyncMode,
      handlePlayerDragLeave: playerDragLeave,
      handlePlayerDragOver: playerDragOver,
      handlePlayerDrop: playerDrop,
      isPlaying,
      isSeeking,
      isShuffle,
      isVolumeDragging,
      nowPlayingContextLabel: nowPlayingContext.label,
      nowPlayingSongMotionClass,
      nowPlayingTransitionKey,
      openArtistPage: nav.openArtistPage,
      openSongContextMenu: playerOpenMenu,
      playButtonBurst,
      playNext: playerNext,
      playPrevious: playerPrevious,
      previewSeek: playerPreviewSeek,
      previewVolume: playerPreviewVolume,
      progressDurationLabelRefs,
      progressInputRefs,
      progressRangeStyle,
      progressTimeLabelRefs,
      queueCount: playQueue.length,
      queueDropHot,
      queuePanelOpen,
      lyricsOpen: settings.lyricsEnabled ? lyricsOpen : undefined,
      toggleLyrics: playerToggleLyrics,
      repeatButtonAriaLabel,
      repeatButtonStateText,
      repeatButtonTitle,
      repeatMode,
      revealNowPlaying: playerReveal,
      setIsShuffle,
      setIsVolumeDragging,
      settings: playerVolumeSettings,
      startPlayerResize: playerResize,
      startSeekPreview: playerStartSeek,
      toggleLike: playerLike,
      togglePlay: playerToggle,
      toggleQueuePanel: playerToggleQueue,
      toggleRepeat: playerRepeat,
      toggleMute: playerMute,
      updateSetting: playerUpdateVolume,
      volumeDraft,
      volumeDraftRef,
      volumeRangeStyle
    }),
    modals: {
      songContextMenu: {
        state: songContextMenu,
        songsById,
        onClose: () => setSongContextMenu(null),
        selectSong,
        queueSong,
        openEditor,
        openPlaylistPicker,
        toggleLike,
        askRemoveSong,
        goToArtist: nav.openArtistPage,
        openSimilarSongs: (song: Song) => setSimilarRequest({ kind: "song", songId: song.id }),
        notForMe: settings.experimentalMusicAnalysis ? notForMe : undefined
      },
      similarSongs: {
        seed: similarSeed, songsById, currentId, returnFocusTo: similarRequest?.kind === "song" ? songContextAnchorRef.current : null,
        onClose: () => setSimilarRequest(null),
        openAnalysisSettings: () => { setSimilarRequest(null); setSettingsSearch(""); setSettingsCategory("experimental"); changeView("settings"); },
        selectSong, queueSong, playSongs: playCollectionSongs, queueSongs: queueCollectionSongs
      },
      queuePanel: connect.queuePanel({
        open: queuePanelOpen,
        onClose: closeQueuePanel,
        currentSong: visualCurrentSong,
        contextLabel: nowPlayingContext.label,
        queue: playQueue,
        setQueue: setPlayQueue,
        songsById,
        autoNextSong: queuePanelAutoNextSong,
        radioSongIds,
        repeatMode,
        repeatPreview: queuePanelOpen
          ? getRepeatPreview({ repeatMode, currentSong, activePlaylist, activePlaylistSongs, isShuffle, source: playbackSource, songsById })
          : null,
        playQueueItem: playerQueueItem,
        selectSong: homeSelectSong,
        openSongContextMenu: playerOpenMenu
      }),
      lyrics: connect.lyrics({
        open: lyricsOpen && settings.lyricsEnabled,
        onClose: closeLyrics,
        song: currentSong,
        isPlaying,
        getTime: getLyricsTime,
        getPlaybackRate: getLyricsRate,
        subscribeClock: subscribeLyricsClock,
        seekTo: playerLyricsSeek,
        openSettings: playerLyricsSettings
      }),
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
    collections: { playSongs: playCollectionSongs, queueSongs: queueCollectionSongs, playPlaylist, openSimilar: setSimilarRequest },
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
      handleListeningSeek: () => listeningHistoryRef.current?.discontinuity(audioRef.current?.currentTime || 0),
      handleSeekStart: () => playbackTransitionRef.current.seekStarted(),
      handleSeekComplete: () => playbackTransitionRef.current.seekFinished(),
      onPlaybackError: () => playbackTransitionRef.current.failed(),
      stopFade,
      stopCrossfadeAuto,
      stopProgressLoop
    }
  };

  // Hydrate the persisted library before enabling actions. No splash screen,
  // fake progress, or minimum display time.
  if (!ready) {
    if (!bootError) return null;
    return (
      <main className="appCrashBoundary" aria-label="Localtify startup error">
        <section className="appCrashCard" role="alert">
          <h1>Localtify had trouble starting</h1>
          <pre className="appCrashMessage">{bootError}</pre>
          <div className="appCrashActions">
            <button type="button" className="appCrashPrimary" onClick={retryStartup}>Retry</button>
            <button type="button" onClick={copyStartupLog}>{bootLogCopied ? "Copied error" : "Copy error"}</button>
          </div>
        </section>
      </main>
    );
  }

  if (onboardingOpen || onboardingDevPreview) {
    return (
      <Suspense fallback={<main role="status" aria-label="Loading setup" />}>
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
      </Suspense>
    );
  }

  return (
    <>
      <AppShell {...localtifyAppViewProps} />
      <CatBuddy enabled={settings.catBuddyEnabled === true} reducedMotion={settings.reducedMotion === true} />
      {feedbackPromptOpen ? <Suspense fallback={null}><FeedbackPrompt
        reducedMotion={settings.reducedMotion}
        feedbackCategory={feedbackCategory} setFeedbackCategory={setFeedbackCategory}
        feedbackMessage={feedbackMessage} setFeedbackMessage={setFeedbackMessage}
        feedbackStatus={feedbackStatus} setFeedbackStatus={setFeedbackStatus}
        feedbackSendBusy={feedbackSendBusy}
        closeFeedbackPrompt={closeFeedbackPrompt} submitFeedbackPrompt={submitFeedbackPrompt}
      /></Suspense> : null}
    </>
  );
}

export default function App() {
  return <MainModeApp />;
}
