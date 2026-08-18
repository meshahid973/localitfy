import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import type { CSSProperties, SyntheticEvent } from "react";
import { FolderPlus, Heart, HeartOff, ImagePlus, Pencil, Play, Plus, Save, Shuffle, SkipForward, Trash2, X } from "lucide-react";
import UpdateIsland from "../../app/UpdateIsland";
import TitleBar from "./TitleBar";
import HomeView from "../home/HomeView";
import LibraryView from "../library/LibraryView";
import AlbumsView from "../albums/AlbumsView";
import PlaylistsView from "../playlists/PlaylistsView";
import CoversView from "../covers/CoversView";
import AnalyticsView from "../analytics/AnalyticsView";
import SettingsView from "../settings/SettingsView";
import DownloadsView from "../downloads/DownloadsView";
import PlayerBar from "../player/components/PlayerBar";
import Onboarding from "../../Onboarding";
import { Cover } from "../covers/Cover";
import { displaySongPickerSublineV444, displaySongTitleV444 } from "../library/components/SongRows";
import { MascotStateArt, UpdateStatusIcon, WindowCloseIcon, mascotStateForToast } from "../../shared/ui/LocaltifyViewUi";
import type { LocaltifyStateCardTone, MascotStateKey } from "../../shared/ui/LocaltifyViewUi";
import type { Song } from "../library/song.types";
import type { LocalAlbumEntry, ManualLocalAlbum } from "../albums/album.types";
import {
  MANUAL_LOCAL_ALBUMS_STORAGE_KEY, albumSongSearchMatches, albumTrackIds, buildLocalAlbumEntries, buildManualAlbumEntries,
  buildManualAlbumSongIdSet, cleanManualAlbumArtist, cleanManualAlbumTitle, cleanManualAlbumYear, filterAndSortAlbums,
  folderAlbumPathContains, getAlbumYear, isUsefulAlbumName, makeAlbumCoverSong, normalizeAlbumValue, normalizeFolderAlbumPathKey,
  normalizeManualLocalAlbums, resizeAlbumCoverFile, suggestAlbumArtistFromSongs, uniqueCleanArtistsFromSongs, uniquePlayableSongIds
} from "../albums/album.runtime";
import { getSongPlaybackSourceKey, isPlayableSong, saveLibraryOrder } from "../library";
import { makeLocalId, readLocalJson, writeLocalJson } from "../../shared/storage/localStorage";
import { clamp, formatTime } from "../../shared/utils/format";
import { getRendererSafeImageUrl } from "../covers/cover.ambient";
import { prettyMeta, prettyTitle } from "../search";
import { navItems, sidebarNavGroups } from "./navigation.constants";
import { settingsCategorySpring } from "../settings/settings.constants";
import {
  APP_VERSION, defaultUpdatePrompt, updateRibbonChildSpring, updateRibbonEnterSpring, whatsNewItems
} from "../updates/update.constants";
import { updateRibbonTitle } from "../updates/update.utils";
import { yukariUpdateImage } from "../../core/app.constants";

export type AppShellProps = Record<string, any>;

export default function AppShell(props: AppShellProps) {
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
    libraryScanBusy,
    pixelArtBusy,
    libraryScanMessage,
    onboardingOpen,
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
    recentImportWeekCount,
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
    handleSpotifyLogin,
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
  const [albumDeleteConfirmArmed, setAlbumDeleteConfirmArmed] = useState(false);
  const albumDeleteConfirmTimerRef = useRef<number | null>(null);
  const albumCoverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    writeLocalJson(MANUAL_LOCAL_ALBUMS_STORAGE_KEY, manualAlbums);
  }, [manualAlbums]);

  useEffect(() => {
    return () => {
      if (albumDeleteConfirmTimerRef.current !== null) {
        window.clearTimeout(albumDeleteConfirmTimerRef.current);
        albumDeleteConfirmTimerRef.current = null;
      }
    };
  }, []);

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
    setAlbumDeleteConfirmArmed(false);
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
          songIds: Array.isArray(album.songIds) ? [...new Set<string>(album.songIds.map((id: unknown) => String(id || "").trim()).filter((id: string) => Boolean(id)))] : [],
          createdAt: Number(album.createdAt) || now,
          updatedAt: Number(album.updatedAt) || now,
          sourceType: "folder" as const,
          sourcePath: String(album.sourcePath || ""),
          folderCoverPath: String(album.folderCoverPath || ""),
          importedAt: Number(album.importedAt) || now
        })).filter((album) => album.title && album.songIds.length);

        setManualAlbums((items) => {
          const incomingSourcePaths = new Set(nextFolderAlbums.map((album) => normalizeFolderAlbumPathKey(album.sourcePath)).filter(Boolean));
          const incomingIds = new Set(nextFolderAlbums.map((album) => album.id));
          const importRootPath = String(result.rootPath || albumFolderImportPreview?.rootPath || "");

          const kept = items.filter((album) => {
            if (incomingIds.has(album.id)) return false;

            if (album.sourceType === "folder" && album.sourcePath) {
              const albumSourceKey = normalizeFolderAlbumPathKey(album.sourcePath);
              if (incomingSourcePaths.has(albumSourceKey)) return false;

              // If a user previously imported the parent folder as one giant
              // album, remove that stale folder album when the proper library
              // import creates child album folders.
              if (folderAlbumPathContains(importRootPath, album.sourcePath)) return false;
              if (nextFolderAlbums.some((incoming) => folderAlbumPathContains(album.sourcePath, incoming.sourcePath))) return false;
              if (nextFolderAlbums.some((incoming) => folderAlbumPathContains(incoming.sourcePath, album.sourcePath))) return false;
            }

            return true;
          });

          return [...nextFolderAlbums, ...kept];
        });

        setSelectedAlbumId(`manual_${nextFolderAlbums[0]?.id || ""}`);
      }

      setAlbumFolderImportPreview(null);
      const skippedDuplicates = Number(result.duplicateCount ?? albumFolderImportPreview?.duplicateCount ?? 0) || 0;
      const importSummary = `imported ${importedAlbums.length} album${importedAlbums.length === 1 ? "" : "s"} • skipped ${skippedDuplicates} duplicate${skippedDuplicates === 1 ? "" : "s"}`;
      setAlbumFolderImportProgress({
        type: "import-done",
        index: importedAlbums.length,
        total: importedAlbums.length,
        changedCount: result.changedCount || 0,
        duplicateCount: skippedDuplicates,
        message: result.message || importSummary
      });
      const repairText = result.repairedExistingCount
        ? ` • repaired ${result.repairedExistingCount} track${result.repairedExistingCount === 1 ? "" : "s"}`
        : "";
      setAlbumFolderImportMessage(result.message || `${importSummary}${repairText}`);
      setStatusText?.(result.message || `${importSummary}${repairText}`);
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

  async function clearAlbumTagFromSongs(targetSongs: Song[], label = "album") {
    const safeSongs = targetSongs.filter((song) => song?.id && String(song.album || "").trim());

    if (!safeSongs.length) {
      setStatusText?.(`${label} already clear`);
      return;
    }

    setStatusText?.(`clearing ${safeSongs.length} album tag${safeSongs.length === 1 ? "" : "s"}...`);

    for (let index = 0; index < safeSongs.length; index += 1) {
      const song = safeSongs[index];
      await patchSongLocal(song.id, { album: "" });
      if (index > 0 && index % 12 === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }

    setStatusText?.(`cleared ${safeSongs.length} album tag${safeSongs.length === 1 ? "" : "s"}`);
  }

  async function deleteSelectedAlbum() {
    if (!selectedAlbum) return;

    if (selectedAlbumIsManual) {
      deleteManualAlbum(selectedAlbum);
      setStatusText?.("album deleted");
      setLibraryScanMessage?.("album deleted");
      return;
    }

    await clearAlbumTagFromSongs(selectedAlbum.songs || [], selectedAlbum.title || "album");
    setSelectedAlbumId("");
  }

  function armDeleteAllAlbums() {
    const albumCount = localAlbums.length;

    if (!albumCount) {
      setStatusText?.("no albums to clear");
      return;
    }

    setAlbumDeleteConfirmArmed(true);
    setStatusText?.(`sure? click again to clear ${albumCount} album${albumCount === 1 ? "" : "s"}`);

    if (albumDeleteConfirmTimerRef.current !== null) {
      window.clearTimeout(albumDeleteConfirmTimerRef.current);
    }

    albumDeleteConfirmTimerRef.current = window.setTimeout(() => {
      setAlbumDeleteConfirmArmed(false);
      albumDeleteConfirmTimerRef.current = null;
    }, 4200);
  }

  async function deleteAllAlbums() {
    const manualCount = manualAlbums.length;
    const metadataCount = metadataAlbums.length;
    const albumCount = manualCount + metadataCount;
    const taggedSongs = songs.filter((song) => String(song.album || "").trim());

    if (!albumDeleteConfirmArmed) {
      armDeleteAllAlbums();
      return;
    }

    if (albumDeleteConfirmTimerRef.current !== null) {
      window.clearTimeout(albumDeleteConfirmTimerRef.current);
      albumDeleteConfirmTimerRef.current = null;
    }

    setAlbumDeleteConfirmArmed(false);
    setManualAlbums([]);
    setSelectedAlbumId("");
    closeAlbumBuilder();

    if (taggedSongs.length) {
      await clearAlbumTagFromSongs(taggedSongs, "all albums");
    }

    setStatusText?.(`cleared ${albumCount} album${albumCount === 1 ? "" : "s"}`);
    setLibraryScanMessage?.(`cleared ${albumCount} album${albumCount === 1 ? "" : "s"}`);
  }

  const homeHeroCoverBrightness = clamp(Number(settings.homeHeroCoverBrightness ?? 1), 0.65, 1.55);
  const homeHeroCoverContrast = clamp(1.02 + (homeHeroCoverBrightness - 1) * 0.08, 0.98, 1.08);
  const homeHeroCoverSaturation = clamp(1.04 + (homeHeroCoverBrightness - 1) * 0.14, 1, 1.14);
  const homeHeroCoverGlowBrightness = clamp(0.72 + (homeHeroCoverBrightness - 1) * 0.34, 0.62, 0.92);
  const platformId = String((platformInfo as any)?.id || "unknown").toLowerCase();
  const mascotDebugMode =
    typeof window !== "undefined" &&
    window.localStorage.getItem("localtify:mascotDebug") === "1";
  const downloadWorking =
    Boolean(downloadBusy || spotifyDownloadBusy || convertBusy) ||
    downloadQueue.some((item: any) => ["queued", "working", "downloading", "fetching", "converting"].includes(String(item.status || "").toLowerCase()));
  const downloadHasFailure =
    downloadQueue.some((item: any) => ["failed", "cancelled", "error"].includes(String(item.status || "").toLowerCase())) ||
    downloadResults.some((item: any) => item && item.ok === false);
  const downloadHasSuccess =
    downloadQueue.some((item: any) => String(item.status || "").toLowerCase() === "done" && item.importedToLibrary !== false) ||
    downloadResults.some((item: any) => item && item.ok !== false && item.importedToLibrary !== false);
  const downloadMascotState: MascotStateKey = downloadWorking
    ? "loading"
    : downloadHasFailure
      ? "error"
      : downloadHasSuccess
        ? "happy"
        : "info";
  const downloadMascotTone: LocaltifyStateCardTone = downloadHasFailure ? "error" : downloadHasSuccess ? "success" : "info";
  const downloadMascotTitle = downloadWorking
    ? "working on your downloads"
    : downloadHasFailure
      ? "download needs attention"
      : downloadHasSuccess
        ? "download finished"
        : "need help downloading?";
  const downloadMascotMessage = downloadWorking
    ? "Keep this open and I’ll show progress here while Localtify downloads, converts, and imports."
    : downloadHasFailure
      ? "Something failed safely. Use retry failed, copy the error, or open the folder to inspect the file."
      : downloadHasSuccess
        ? "Nice, the latest finished files are ready below. Open them in your library or clear finished items."
        : "Paste a YouTube link, fetch Spotify tracks, or convert local files. Nothing touches the database until something is imported.";
  const failedDownloadQueueItems = downloadQueue.filter((item: any) => ["failed", "cancelled", "error"].includes(String(item.status || "").toLowerCase()));
  const finishedDownloadQueueItems = downloadQueue.filter((item: any) => String(item.status || "").toLowerCase() === "done");
  const failedDownloadResults = downloadResults.filter((item: any) => item && item.ok === false);
  const visibleDownloadQueueItems = downloadQueue.filter((item: any) => !["failed", "cancelled", "error"].includes(String(item.status || "").toLowerCase()));
  const visibleDownloadResults = downloadResults.filter((item: any) => !(item && item.ok === false));
  const firstDownloadError = failedDownloadQueueItems[0]?.error || failedDownloadResults[0]?.error || spotifyFetchError || "";
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
    failedDownloadQueueItems.forEach((item: any) => {
      void retryDownload(item.url || "", item.source === "spotify" ? "spotify" : "youtube", item.spotifyTrackId || "");
    });
    failedDownloadResults.forEach((item: any) => {
      void retryDownload(item.url || "", item.source === "spotify" ? "spotify" : "youtube", item.spotifyTrackId || "");
    });
  };

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
        <div className={`appToast ${appToast.kind} appToastMascotHostV496`} key={appToast.id} role="status">
          <MascotStateArt state={mascotStateForToast(appToast.kind)} className="appToastMascotV496" />
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

            <div className="importPanelHead importPanelHeadMascotV496">
              <MascotStateArt
                state={importAnimation.phase === "success" ? "happy" : importAnimation.phase === "error" ? "error" : "loading"}
                className="importMascotV496"
              />
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
        <div className="tinyScanner tinyScannerMascotHostV496" role="status" aria-live="polite">
          <MascotStateArt state="loading" className="tinyScannerMascotV496" />
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

            {mascotDebugMode ? (
              <section className="mascotDebugPanelV498" aria-label="Mascot state debug gallery">
                <div className="panelHead mascotDebugHeadV498">
                  <div>
                    <p className="eyebrow">mascot debug</p>
                    <h3>all mascot states</h3>
                  </div>
                  <button
                    className="softButton"
                    type="button"
                    onClick={() => {
                      window.localStorage.removeItem("localtify:mascotDebug");
                      window.location.reload();
                    }}
                  >
                    hide
                  </button>
                </div>

                <div className="mascotDebugGridV498">
                  {(["empty", "happy", "question", "info", "warning", "danger", "error", "loading"] as MascotStateKey[]).map((state) => (
                    <div className="mascotDebugCardV498" key={state}>
                      <MascotStateArt state={state} />
                      <strong>{state}</strong>
                      <small>{state}-state.png</small>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div
              className={`pageTransition pageTransition-${view}`}
              data-view={view}
            >
              {view === "home" ? <HomeView {...{ ambientStyle, currentId, currentNowPlayingLabel, currentSong, filteredSongs, heroDisplayArtist, heroDisplayTitle, heroMotionClass, heroTitleClass, homeDashboardClass, homeFreshShelfSongs, homeListenNowSongs, isPlaying, isThreeAm, likedSongs, mostPlayed, now, nowPlayingSongMotionClass, nowPlayingTransitionKey, openCoversViewWithCurrentSong, playableSongCount, playerError, renderHomeSongCards, renderSongRows, selectSong, settings, showHomeSideCards, shuffleLibrarySongsAction, songs, toggleHeroExpanded, topSongs, totalMinutes, totalPlays, updateSetting }} /> : null}

            {(view === "library" || view === "liked") ? <LibraryView {...{ changeView, deleteBusy, handleLibraryAreaDragLeave, handleLibraryAreaDragOver, handleLibraryAreaDrop, handleSearchInput, importSongs, libraryAlbumCount, libraryArtistCount, libraryMissingLabel, missingFileCount, now, playlists, query, removeMissingSongs, renderHomeSongCards, renderSongRows, setLibraryFilterMode, settings, showingMissingFiles, shuffleLibrarySongsAction, songs, view, visibleSongs }} /> : null}


            {view === "albums" ? <AlbumsView {...{ albumBuilderOpen, albumBuilderMode, albumDeleteConfirmArmed, albumDraftArtist, albumDraftArtistNames, albumDraftArtistPreview, albumDraftArtistSuggestion, albumDraftCoverUrl, albumDraftHasVariousArtists, albumDraftPreviewCoverSong, albumDraftSearch, albumDraftSearchResults, albumDraftSongIds, albumDraftTitle, albumDraftYear, albumFolderImportBusy, albumFolderImportMessage, albumFolderImportPreview, albumFolderImportProgress, albumSearch, albumSortMode, manualAlbums, setAlbumDraftArtist, setAlbumDraftSearch, setAlbumDraftTitle, setAlbumDraftYear, setAlbumSearch, setAlbumSortMode, setSelectedAlbumId, albumBuilderSectionRef, albumCoverInputRef, cancelAlbumFolderImportPreview, clearAlbumDraftCover, closeAlbumBuilder, commitAlbumFolderImportPreview, currentId, currentSong, deleteAllAlbums, deleteManualAlbum, deleteSelectedAlbum, handleAlbumCoverFile, localAlbums, manualAlbumEntries, metadataAlbums, openAlbumCoverPicker, openCreateAlbumBuilder, openEditAlbumBuilder, openPlaylistPicker, playAlbumSongs, queueAlbumSongs, ready, saveManualAlbumFromDraft, scanAlbumFolderImport, selectSong, selectedAlbum, selectedAlbumIds, selectedAlbumIsFolder, selectedAlbumIsManual, shuffleAlbumSongs, songs, toggleAlbumDraftSong, toggleLike, visibleAlbums }} /> : null}

            {view === "playlists" ? <PlaylistsView {...{ activePlaylistId, appendPlaylistSongAction, cancelRenamePlaylist, createPlaylist, currentId, draggedSongId, dropPlaylistSongAction, duplicatePlaylist, endPlaylistSongDragAction, handlePlaylistShelfDragLeave, handlePlaylistShelfDragOver, handlePlaylistShelfDrop, importSongs, isPlaying, newPlaylistName, openPlaylistSongContextMenuAction, playPlaylist, playlistDragOverPlaylistId, playlistSummaries, playlists, removePlaylist, removePlaylistSongAction, renamingPlaylistId, renamingPlaylistName, renderPlaylistCollage, savePlaylistRename, selectPlaylistSongAction, selectedPlaylist, selectedPlaylistDuration, selectedPlaylistId, selectedPlaylistSongs, setNewPlaylistName, setRenamingPlaylistName, setSelectedPlaylistId, songs, startPlaylistSongDragAction, startRenamePlaylist }} /> : null}

            {view === "covers" ? <CoversView {...{ ambientStyle, applyCoverAssetToSelection, coverGalleryMood, coverMoodCounts, coverPickerSongList, coverSelectedSongIds, coverStats, currentSong, filteredCoverGalleryAssets, importSongs, now, pixelArtBusy, randomizeSelectedCovers, rescanPixelArtFolder, selectCurrentSongForCovers, selectVisibleSongsForCovers, selectedCoverSongs, setCoverGalleryMood, setCoverSelectedSongIds, songs, toggleCoverSongSelection, togglePixelCoverExcluded, togglePixelCoverFavorite }} /> : null}

            {view === "analytics" ? <AnalyticsView {...{ analyticsRecapCards, analyticsStatCards, averageSongSeconds, importSongs, libraryHealthLabel, libraryLengthLabel, likedPercent, longestSong, missingFileCount, neverPlayedSongs, playedPercent, ready, recentImportWeekCount, songs }} /> : null}


            {view === "settings" ? <SettingsView {...{ renderSettingsCategoryContent, renderSettingsRail, settings, settingsCategory }} /> : null}

            {view === "downloads" ? <DownloadsView {...{ downloadMascotState, downloadMascotTone, cancelCurrentDownload, changeView, clearFailedDownloads, clearFinishedDownloads, convertBusy, convertLocalMedia, convertMessage, convertProgress, copyDownloadError, downloadAudioLinks, downloadBusy, downloadHasFailure, downloadMascotMessage, downloadMascotTitle, downloadResults, downloadSpotifyTracks, downloadStatusLabel, downloadText, downloadsTab, failedDownloadQueueItems, failedDownloadResults, fetchSpotifyTracks, finishedDownloadQueueItems, handleSpotifyLogin, handleSpotifyLogout, openDownloadedSongInLibrary, playlists, progress, ready, retryDownload, retryFailedDownloads, retrySpotifyTrack, setDownloadText, setDownloadsTab, setSettingsCategory, setSpotifyFetchError, setSpotifySelectedIds, setSpotifyTracks, setSpotifyUrl, settings, spotifyDownloadBusy, spotifyFetchBusy, spotifyFetchError, spotifyLoggedIn, spotifyLoginBusy, spotifySelectedIds, spotifyTrackStatusLabel, spotifyTracks, spotifyUrl, visibleDownloadQueueItems, visibleDownloadResults }} /> : null}
            </div>
          </section>

<PlayerBar {...{ ambientStyle, commitSeek, commitVolume, currentDuration, currentSong, displayedProgress, displayedTime, draggedSongId, effectiveAmbient, effectiveCoverColorSyncMode, handlePlayerDragLeave, handlePlayerDragOver, handlePlayerDrop, isPlaying, isSeeking, isShuffle, isVolumeDragging, nowPlayingSongMotionClass, nowPlayingTransitionKey, playButtonBurst, playNext, playPrevious, previewSeek, previewVolume, progressDurationLabelRefs, progressInputRefs, progressRangeStyle, progressTimeLabelRefs, queueDropHot, repeatButtonAriaLabel, repeatButtonStateText, repeatButtonTitle, repeatMode, setIsShuffle, setIsVolumeDragging, settings, startPlayerResize, startSeekPreview, togglePlay, toggleRepeat, updateSetting, volumeDraft, volumeDraftRef, volumeRangeStyle }} />
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
            <p className="whatsNewSubtext">0.4.1 is a fast hotfix focused on the album importer freeze, nested-folder scanning, cover accuracy, and keeping the app responsive after the 0.4.0 release.</p>
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
                <div className="playlistEmptyState playlistMascotEmptyV496">
                  <MascotStateArt state="question" className="playlistEmptyMascotV496" />
                  <span className="mascotEmptyCopyV496">
                    <strong>No playlists yet</strong>
                    <p>Make one below and this song will be added right away.</p>
                  </span>
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
