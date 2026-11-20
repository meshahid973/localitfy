import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { INITIAL_LIBRARY_RENDER_LIMIT } from "../../core/app.constants";
import { createImportAnimationState } from "./importState";
import { sortLibrarySongs, topPlayedSongs, type LibrarySortMode } from "./librarySort";
import { stableSongSourceKey, isPlayableSong } from "./library.utils";
import { reconcileLibraryIndex } from "../search/incrementalLibraryIndex";
import { rankSongsForSearch } from "../search/search.utils";
import { measureDevTime } from "../../shared/perf/devPerf";
import type { ImportAnimationState, LibraryDropSide, MetadataCleanPreview, MetadataUndoItem, Song, SongContextMenuState } from "./song.types";

export function useLibraryController() {
  const [editorSong, setEditorSong] = useState<Song | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editAlbum, setEditAlbum] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [libraryFilterMode, setLibraryFilterMode] = useState<"all" | "missing">("all");
  const [librarySortMode, setLibrarySortMode] = useState<LibrarySortMode>("library");
  const [libraryRenderLimit, setLibraryRenderLimit] = useState(INITIAL_LIBRARY_RENDER_LIMIT);
  const libraryRenderLimitRef = useRef(INITIAL_LIBRARY_RENDER_LIMIT);
  const libraryListLengthRef = useRef(0);
  const [songContextMenu, setSongContextMenu] = useState<SongContextMenuState | null>(null);
  const [libraryScanBusy, setLibraryScanBusy] = useState(false);
  const [libraryScanMessage, setLibraryScanMessage] = useState("instant search index ready");
  const [metadataCleanPreview, setMetadataCleanPreview] = useState<MetadataCleanPreview | null>(null);
  const [metadataUndoItems, setMetadataUndoItems] = useState<MetadataUndoItem[]>([]);
  const [importAnimation, setImportAnimation] = useState<ImportAnimationState>(() => createImportAnimationState());
  const [draggedSongId, setDraggedSongId] = useState("");
  const [draggedSongTitle, setDraggedSongTitle] = useState("");
  const [libraryDragOverSongId, setLibraryDragOverSongId] = useState("");
  const [libraryDropSide, setLibraryDropSide] = useState<LibraryDropSide>("after");
  const draggedSongIdRef = useRef("");
  const libraryDragOverSongIdRef = useRef("");
  const libraryDropSideRef = useRef<LibraryDropSide>("after");
  const libraryDropPullRef = useRef(0);
  const libraryDropVisualSongIdRef = useRef("");
  const libraryDropVisualSideRef = useRef<LibraryDropSide>("after");
  const [librarySongElements] = useState(() => new Map<string, HTMLElement>());
  const librarySongElementRefs = useRef(librarySongElements);
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

  return {
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
  };
}

/** Library-owned index, selectors and render-limit synchronization. */
export function useLibraryDerivedState({songs,deferredQuery,view,libraryFilterMode,librarySortMode,libraryRenderLimit,libraryListLengthRef,libraryRenderLimitRef}: {
  songs: Song[]; deferredQuery: string; view: string; libraryFilterMode: "all"|"missing"; librarySortMode: LibrarySortMode;
  libraryRenderLimit: number; libraryListLengthRef: {current:number}; libraryRenderLimitRef: {current:number};
}) {
  const libraryIndexRef = useRef<ReturnType<typeof reconcileLibraryIndex> | null>(null);
  const libraryIndex = useMemo(() => {
    const next = measureDevTime("library:index", () => reconcileLibraryIndex(songs, libraryIndexRef.current ?? undefined));
    libraryIndexRef.current = next;
    return next;
  }, [songs]);
  const librarySearchIndex = libraryIndex.searchEntries;

  const filteredSongs = useMemo(() => {
    if (!deferredQuery.trim()) return songs;
    return rankSongsForSearch(librarySearchIndex, deferredQuery);
  }, [librarySearchIndex, deferredQuery, songs]);

  const {likedSongs, missingSongsForLibrary, playableSongs} = useMemo(() => {
    const likedSongs: Song[] = [], missingSongsForLibrary: Song[] = [], playableSongs: Song[] = [];
    const seen = new Set<string>();
    for (const song of songs) {
      if (song.fileExists === false) missingSongsForLibrary.push(song);
      if (isPlayableSong(song)) playableSongs.push(song);
      if (!song.liked) continue;
      const key = String(song.id || stableSongSourceKey(song) || `${song.title}|${song.artist}|${song.duration}`).trim();
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      likedSongs.push(song);
    }
    return {likedSongs,missingSongsForLibrary,playableSongs};
  }, [songs]);
  const mostPlayed = useMemo(() => topPlayedSongs(songs, 6)[0] ?? null, [songs]);
  const likedSongIds = useMemo(() => new Set(likedSongs.map(song => song.id)), [likedSongs]);
  const unsortedVisibleSongs = useMemo(() => {
    if (view === "liked") return deferredQuery.trim() ? filteredSongs.filter(song => likedSongIds.has(song.id)) : likedSongs;
    if (view === "library" && libraryFilterMode === "missing") return deferredQuery.trim() ? filteredSongs.filter(song => song.fileExists === false) : missingSongsForLibrary;
    return filteredSongs;
  }, [view, libraryFilterMode, deferredQuery, filteredSongs, likedSongIds, likedSongs, missingSongsForLibrary]);
  const visibleSongs = useMemo(
    () => sortLibrarySongs(unsortedVisibleSongs, librarySortMode),
    [unsortedVisibleSongs, librarySortMode]
  );
  const libraryOrderLocked = librarySortMode !== "library" && (view === "library" || view === "liked");

  useEffect(() => {
    libraryListLengthRef.current = visibleSongs.length;
  }, [visibleSongs.length]);

  useEffect(() => {
    libraryRenderLimitRef.current = libraryRenderLimit;
  }, [libraryRenderLimit]);

  const songsById = libraryIndex.songsById;
  const songIndexById = libraryIndex.songIndexById;
  return {libraryIndex, filteredSongs, likedSongs, mostPlayed, missingSongsForLibrary, visibleSongs, libraryOrderLocked, songsById, songIndexById, playableSongs};
}
