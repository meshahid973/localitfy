import { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "../library/song.types";
import type { LocalAlbumEntry, ManualLocalAlbum } from "./album.types";
import {
  MANUAL_LOCAL_ALBUMS_STORAGE_KEY, albumSongSearchMatches, albumTrackIds, buildLocalAlbumEntries, buildManualAlbumEntries,
  buildManualAlbumSongIdSet, cleanManualAlbumArtist, cleanManualAlbumTitle, cleanManualAlbumYear, filterAndSortAlbums,
  folderAlbumPathContains, getAlbumYear, isUsefulAlbumName, makeAlbumCoverSong, normalizeAlbumValue, normalizeFolderAlbumPathKey,
  normalizeManualLocalAlbums, resizeAlbumCoverFile, suggestAlbumArtistFromSongs, uniqueCleanArtistsFromSongs, uniquePlayableSongIds
} from "./album.runtime";
import { isPlayableSong, saveLibraryOrder } from "../library";
import { makeLocalId, readLocalJson, writeLocalJson } from "../../shared/storage/localStorage";
import { getRendererSafeImageUrl } from "../covers/cover.ambient";
import { prettyMeta, prettyTitle } from "../search";

export type AlbumsControllerOptions = {
  view: string;
  reducedMotion?: boolean;
  songs: Song[];
  songsById: Map<string, Song>;
  setSongs?: (songs: Song[]) => void;
  setLibraryScanBusy?: (busy: boolean) => void;
  setLibraryScanMessage?: (message: string) => void;
  setStatusText?: (message: string) => void;
  patchSongLocal: (songId: string, patch: Partial<Song>) => Promise<unknown> | unknown;
};

export function useAlbumsController({
  view,
  reducedMotion = false,
  songs,
  songsById,
  setSongs,
  setLibraryScanBusy,
  setLibraryScanMessage,
  setStatusText,
  patchSongLocal
}: AlbumsControllerOptions) {
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
        behavior: reducedMotion ? "auto" : "smooth",
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
      const message = "album folder import bridge missing — restart Localtify after replacing electron/preload.cjs and electron/main.cjs";
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

  return {
    albumSearch, setAlbumSearch,
    albumSortMode, setAlbumSortMode,
    setSelectedAlbumId,
    manualAlbums,
    albumBuilderOpen, albumBuilderMode, albumBuilderSectionRef,
    albumDraftTitle, setAlbumDraftTitle,
    albumDraftArtist, setAlbumDraftArtist,
    albumDraftYear, setAlbumDraftYear,
    albumDraftCoverUrl,
    albumDraftSearch, setAlbumDraftSearch,
    albumDraftSongIds,
    albumFolderImportPreview, albumFolderImportBusy, albumFolderImportMessage, albumFolderImportProgress,
    albumDeleteConfirmArmed, albumCoverInputRef,
    manualAlbumEntries, metadataAlbums, localAlbums, visibleAlbums, selectedAlbum, selectedAlbumIds,
    selectedAlbumIsManual, selectedAlbumIsFolder,
    albumDraftArtistNames, albumDraftArtistSuggestion, albumDraftHasVariousArtists, albumDraftArtistPreview,
    albumDraftPreviewCoverSong, albumDraftSearchResults,
    scanAlbumFolderImport, cancelAlbumFolderImportPreview, commitAlbumFolderImportPreview,
    openCreateAlbumBuilder, openEditAlbumBuilder, closeAlbumBuilder, toggleAlbumDraftSong,
    openAlbumCoverPicker, handleAlbumCoverFile, clearAlbumDraftCover, saveManualAlbumFromDraft,
    deleteManualAlbum, deleteSelectedAlbum, deleteAllAlbums
  };
}
