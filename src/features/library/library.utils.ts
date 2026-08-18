import type { Song, LibraryDropSide } from "./song.types";
import { makeLocalId, readLocalJson, writeLocalJson } from "../../shared/storage/localStorage";
import { CODERPIXEL_ARTIST_CHANCE, CODERPIXEL_ARTIST_EASTER_EGG, LIBRARY_ORDER_STORAGE_KEY } from "./library.constants";

export function getSongPlaybackSourceKey(song: Pick<Song, "id" | "filePath" | "url"> | null | undefined) { return String(song?.filePath || song?.url || song?.id || "").trim().toLowerCase(); }
export function isPlayableSong(song: Song | null | undefined): song is Song { return !!song && Boolean(song.filePath || song.url) && song.fileExists !== false; }
export function stableSongSourceKey(song: Pick<Song, "filePath" | "url">) { return String(song.filePath || song.url || "").trim().toLowerCase(); }
export function maybeApplyCoderpixelArtist(importedSongs: Song[], previousSongIds: Set<string>, previousSongSources: Set<string>) {
  const changedSongs: Song[] = [];
  const songs = importedSongs.map((song) => { const sourceKey = stableSongSourceKey(song); const isNewSong = !previousSongIds.has(song.id) && (!sourceKey || !previousSongSources.has(sourceKey)); if (!isNewSong || Math.random() >= CODERPIXEL_ARTIST_CHANCE) return song; const updatedSong = { ...song, artist: CODERPIXEL_ARTIST_EASTER_EGG }; changedSongs.push(updatedSong); return updatedSong; });
  return { songs, changedSongs };
}
export function cleanSongOrderIds(value: unknown, validIds?: Set<string>) { if (!Array.isArray(value)) return []; const seen = new Set<string>(); const output: string[] = []; value.forEach((item) => { const id = String(item || "").trim(); if (!id || seen.has(id) || (validIds && !validIds.has(id))) return; seen.add(id); output.push(id); }); return output; }
export function applyLibraryOrder(list: Song[]) { const orderIds = cleanSongOrderIds(readLocalJson<string[]>(LIBRARY_ORDER_STORAGE_KEY, []), new Set(list.map((song) => song.id))); if (!orderIds.length) return list; const songById = new Map(list.map((song) => [song.id, song])); const used = new Set<string>(); const ordered: Song[] = []; orderIds.forEach((id) => { const song = songById.get(id); if (!song || used.has(id)) return; used.add(id); ordered.push(song); }); list.forEach((song) => { if (!used.has(song.id)) ordered.push(song); }); return ordered; }
export function saveLibraryOrder(list: Song[]) { writeLocalJson(LIBRARY_ORDER_STORAGE_KEY, list.map((song) => song.id)); }
export function reorderSongList(list: Song[], draggedId: string, targetId: string, side: LibraryDropSide) { if (!draggedId || !targetId || draggedId === targetId) return list; const dragged = list.find((song) => song.id === draggedId); if (!dragged) return list; const next = list.filter((song) => song.id !== draggedId); const target = next.findIndex((song) => song.id === targetId); if (target === -1) return list; next.splice(side === "after" ? target + 1 : target, 0, dragged); return next; }
export function reorderIdList(list: string[], draggedId: string, targetId: string, side: LibraryDropSide) { if (!draggedId || !targetId || draggedId === targetId) return list; const next = list.filter((id) => id !== draggedId); const target = next.findIndex((id) => id === targetId); if (target === -1) return list; next.splice(side === "after" ? target + 1 : target, 0, draggedId); return next; }
export function insertIdNearTarget(list: string[], draggedId: string, targetId: string, side: LibraryDropSide) { if (!draggedId || !targetId) return list; const next = list.filter((id) => id !== draggedId); const target = next.findIndex((id) => id === targetId); if (target === -1) return next.includes(draggedId) ? next : [...next, draggedId]; next.splice(side === "after" ? target + 1 : target, 0, draggedId); return next; }
export { makeLocalId, readLocalJson, writeLocalJson };
