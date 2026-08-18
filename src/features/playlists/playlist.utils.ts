import type { Song } from "../library/song.types";
import type { Playlist, PlaylistSummary } from "./playlist.types";

export function buildPlaylistSummary(playlist: Playlist, songsById: ReadonlyMap<string, Song>): PlaylistSummary {
  const songs = playlist.songIds.map((id) => songsById.get(id)).filter((song): song is Song => Boolean(song));
  return { playlist, previewSongs: songs.slice(0, 4), songCount: songs.length, duration: songs.reduce((total, song) => total + Math.max(0, Number(song.duration) || 0), 0) };
}
export function buildPlaylistSummaries(playlists: Playlist[], songs: Song[]) { const byId = new Map(songs.map((song) => [song.id, song])); return playlists.map((playlist) => buildPlaylistSummary(playlist, byId)); }
export function playlistContainsSong(playlist: Playlist, songId: string) { return playlist.songIds.includes(songId); }
export function addSongToPlaylist(playlist: Playlist, songId: string) { return playlist.songIds.includes(songId) ? playlist : { ...playlist, songIds: [...playlist.songIds, songId] }; }
export function removeSongFromPlaylist(playlist: Playlist, songId: string) { return { ...playlist, songIds: playlist.songIds.filter((id) => id !== songId) }; }
