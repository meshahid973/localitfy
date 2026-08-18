import type { Song } from "../library/song.types";
import { makeLocalId } from "../../shared/storage/localStorage";
import { cleanSongOrderIds } from "../library/library.utils";
import type { Playlist, PlaylistSummary } from "./playlist.types";

export function buildPlaylistSummary(playlist: Playlist, songsById: ReadonlyMap<string, Song>): PlaylistSummary {
  const songs = playlist.songIds.map((id) => songsById.get(id)).filter((song): song is Song => Boolean(song));
  return { playlist, previewSongs: songs.slice(0, 4), songCount: songs.length, duration: songs.reduce((total, song) => total + Math.max(0, Number(song.duration) || 0), 0) };
}
export function buildPlaylistSummaries(playlists: Playlist[], songs: Song[]) { const byId = new Map(songs.map((song) => [song.id, song])); return playlists.map((playlist) => buildPlaylistSummary(playlist, byId)); }
export function playlistContainsSong(playlist: Playlist, songId: string) { return playlist.songIds.includes(songId); }
export function addSongToPlaylist(playlist: Playlist, songId: string) { return playlist.songIds.includes(songId) ? playlist : { ...playlist, songIds: [...playlist.songIds, songId] }; }
export function removeSongFromPlaylist(playlist: Playlist, songId: string) { return { ...playlist, songIds: playlist.songIds.filter((id) => id !== songId) }; }

export function cleanPlaylistList(value: unknown, validIds?: Set<string>): Playlist[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: Playlist[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const source = item as Partial<Playlist>;
    const id = String(source.id || makeLocalId("playlist")).trim();
    const name = String(source.name || `playlist ${index + 1}`).trim().slice(0, 120) || `playlist ${index + 1}`;
    if (!id || seen.has(id)) return;
    seen.add(id);
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
