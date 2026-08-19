import { useDeferredValue, useRef, useState } from "react";
import { INITIAL_LIBRARY_RENDER_LIMIT } from "../../core/app.constants";
import { createImportAnimationState } from "./importState";
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

  return {
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
  };
}
