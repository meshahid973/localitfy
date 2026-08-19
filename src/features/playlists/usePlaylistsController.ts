import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { AppToastKind, View } from "../shell/view.types";
import type { LibraryDropSide, Song } from "../library/song.types";
import { insertIdNearTarget, reorderIdList } from "../library/library.utils";
import { prettyTitle } from "../search/search.utils";
import { makeLocalId, readLocalJson, writeLocalJson } from "../../shared/storage/localStorage";
import { PLAYLIST_STORAGE_KEY } from "./playlist.constants";
import type { Playlist } from "./playlist.types";
import { cleanPlaylistList } from "./playlist.utils";

export type PlaylistsControllerOptions = {
  songs: Song[];
  bootedRef: RefObject<boolean>;
  changeView: (view: View, source?: "nav" | "onboarding" | "settings" | "unknown") => void;
  setStatusText: Dispatch<SetStateAction<string>>;
  showAppToast: (message: string, kind?: AppToastKind) => void;
};

export function usePlaylistsController({
  songs,
  bootedRef,
  changeView,
  setStatusText,
  showAppToast
}: PlaylistsControllerOptions) {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => readLocalJson<Playlist[]>(PLAYLIST_STORAGE_KEY, []));
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [playlistPickerName, setPlaylistPickerName] = useState("");
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistPickerSong, setPlaylistPickerSong] = useState<Song | null>(null);
  const [playlistDragOverPlaylistId, setPlaylistDragOverPlaylistId] = useState("");
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<string | null>(null);
  const [renamingPlaylistName, setRenamingPlaylistName] = useState("");
  const playlistSaveTimerRef = useRef<number | null>(null);
  const songsById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);

  useEffect(() => {
    if (!bootedRef.current) return;
    const validSongIds = new Set(songs.map((song) => song.id));
    setPlaylists((items) => {
      const next = cleanPlaylistList(items, validSongIds);
      const unchanged = next.length === items.length && next.every((playlist, index) => {
        const current = items[index];
        return current?.id === playlist.id &&
          current.name === playlist.name &&
          current.createdAt === playlist.createdAt &&
          current.songIds.length === playlist.songIds.length &&
          current.songIds.every((songId, songIndex) => songId === playlist.songIds[songIndex]);
      });
      return unchanged ? items : next;
    });
  }, [songs, bootedRef]);

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
  }, [playlists, bootedRef]);

  useEffect(() => {
    return () => {
      if (playlistSaveTimerRef.current !== null) {
        window.clearTimeout(playlistSaveTimerRef.current);
      }
    };
  }, []);

  const normalizePlaylistName = useCallback((sourceName: string, fallbackName: string) => {
    return (sourceName.trim() || fallbackName).slice(0, 120);
  }, []);

  const addSongToPlaylist = useCallback((playlistId: string, songId: string) => {
    const song = songsById.get(songId);
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!song || !playlist) return;

    if (playlist.songIds.includes(songId)) {
      setStatusText("song is already in that playlist");
      return;
    }

    setPlaylists((items) => items.map((item) =>
      item.id === playlistId ? { ...item, songIds: [...item.songIds, songId] } : item
    ));
    setSelectedPlaylistId(playlistId);
    setStatusText(`added ${prettyTitle(song.title, 4)} to ${playlist.name}`);
    showAppToast("added to playlist", "success");

    if (playlistPickerSong?.id === songId) {
      setPlaylistPickerSong(null);
      setPlaylistPickerName("");
    }
  }, [playlistPickerSong?.id, playlists, setStatusText, showAppToast, songsById]);

  const createPlaylist = useCallback((forcedName?: string) => {
    const sourceName = typeof forcedName === "string" ? forcedName : newPlaylistName;
    const name = normalizePlaylistName(sourceName, `playlist ${playlists.length + 1}`);
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
  }, [newPlaylistName, normalizePlaylistName, playlists, setStatusText, showAppToast]);

  const createPlaylistWithSong = useCallback((songId: string, forcedName: string) => {
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

    const playlist: Playlist = { id: makeLocalId("playlist"), name, songIds: [songId], createdAt: Date.now() };
    setPlaylists((items) => [playlist, ...items]);
    setSelectedPlaylistId(playlist.id);
    setPlaylistPickerSong(null);
    setPlaylistPickerName("");
    setStatusText(`added to ${name}`);
    showAppToast(`added to ${name}`, "success");
    return playlist.id;
  }, [addSongToPlaylist, normalizePlaylistName, playlists, setStatusText, showAppToast, songsById]);

  const removePlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return;
    if (!window.confirm(`Delete "${playlist.name}"? Songs stay in your library.`)) return;

    setPlaylists((items) => items.filter((item) => item.id !== playlistId));
    setSelectedPlaylistId((id) => (id === playlistId ? null : id));
    setActivePlaylistId((id) => (id === playlistId ? null : id));
    if (renamingPlaylistId === playlistId) {
      setRenamingPlaylistId(null);
      setRenamingPlaylistName("");
    }
    setStatusText(`removed ${playlist.name}`);
    showAppToast("playlist deleted", "success");
  }, [playlists, renamingPlaylistId, setStatusText, showAppToast]);

  const startRenamePlaylist = useCallback((playlist: Playlist) => {
    setRenamingPlaylistId(playlist.id);
    setRenamingPlaylistName(playlist.name);
    setSelectedPlaylistId(playlist.id);
  }, []);

  const cancelRenamePlaylist = useCallback(() => {
    setRenamingPlaylistId(null);
    setRenamingPlaylistName("");
  }, []);

  const savePlaylistRename = useCallback((playlistId: string) => {
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

    setPlaylists((items) => items.map((playlist) =>
      playlist.id === playlistId ? { ...playlist, name: nextName } : playlist
    ));
    setRenamingPlaylistId(null);
    setRenamingPlaylistName("");
    setStatusText(`renamed playlist to ${nextName}`);
    showAppToast("playlist renamed", "success");
  }, [playlists, renamingPlaylistName, setStatusText, showAppToast]);

  const duplicatePlaylist = useCallback((playlistId: string) => {
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

    const copy: Playlist = { id: makeLocalId("playlist"), name, songIds: [...source.songIds], createdAt: Date.now() };
    setPlaylists((items) => [copy, ...items]);
    setSelectedPlaylistId(copy.id);
    setStatusText(`duplicated ${source.name}`);
    showAppToast("playlist duplicated", "success");
  }, [playlists, setStatusText, showAppToast]);

  const openPlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    changeView("playlists", "unknown");
  }, [changeView]);

  const openPlaylistPicker = useCallback((song: Song) => {
    setPlaylistPickerName("");
    setPlaylistPickerSong(song);
  }, []);

  const removeSongFromPlaylist = useCallback((playlistId: string, songId: string) => {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return;
    setPlaylists((items) => items.map((item) =>
      item.id === playlistId ? { ...item, songIds: item.songIds.filter((id) => id !== songId) } : item
    ));
    setStatusText(`removed from ${playlist.name}`);
    showAppToast("removed from playlist", "success");
  }, [playlists, setStatusText, showAppToast]);

  const toggleSongPlaylist = useCallback((playlistId: string, songId: string) => {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return;
    if (playlist.songIds.includes(songId)) removeSongFromPlaylist(playlistId, songId);
    else addSongToPlaylist(playlistId, songId);
  }, [addSongToPlaylist, playlists, removeSongFromPlaylist]);

  const handlePlaylistSongDrop = useCallback((
    playlistId: string,
    songId: string,
    targetSongId: string,
    side: LibraryDropSide
  ) => {
    if (!playlistId || !songId || !targetSongId || !songsById.has(songId) || songId === targetSongId) return;
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return;
    const nextIds = playlist.songIds.includes(songId)
      ? reorderIdList(playlist.songIds, songId, targetSongId, side)
      : insertIdNearTarget(playlist.songIds, songId, targetSongId, side);
    if (nextIds.length === playlist.songIds.length && nextIds.every((id, index) => id === playlist.songIds[index])) return;

    setPlaylists((items) => items.map((item) =>
      item.id === playlistId ? { ...item, songIds: nextIds } : item
    ));
    setSelectedPlaylistId(playlistId);
    const reordering = playlist.songIds.includes(songId);
    setStatusText(reordering ? "playlist order updated" : `added to ${playlist.name}`);
    showAppToast(reordering ? "playlist order updated" : "added to playlist", "success");
  }, [playlists, setStatusText, showAppToast, songsById]);

  const handlePlaylistSongAppend = useCallback((playlistId: string, songId: string) => {
    if (!playlistId || !songId || !songsById.has(songId)) return;
    addSongToPlaylist(playlistId, songId);
  }, [addSongToPlaylist, songsById]);

  return {
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
    openPlaylistPicker,
    addSongToPlaylist,
    removeSongFromPlaylist,
    toggleSongPlaylist,
    handlePlaylistSongDrop,
    handlePlaylistSongAppend,
    normalizePlaylistName
  };
}
