import { isPlayableSong } from "../library/library.utils";
import type { Song } from "../library/song.types";
import type { Playlist } from "../playlists/playlist.types";
import type { RepeatMode } from "./player.types";

/** Preserve the original queue > source loop > playlist > library priority. */
export type AutoTransitionInputs = {
  playableSongs: Song[];
  currentSong: Song | null;
  repeatMode: RepeatMode;
  playQueue: string[];
  songsById: Map<string, Song>;
  activePlaylist: Playlist | null;
  activePlaylistSongs: Song[];
  isShuffle: boolean;
  repeatPlaylist: boolean;
  currentId: string;
  sourceLoopRestart: () => { song: Song; rest: string[] } | null;
  currentIndex: () => number;
  buildShuffleQueue: (songs: Song[], avoidFirstSongId?: string) => { nextSong: Song | null };
};

export function resolveAutoTransitionTarget({
  playableSongs, currentSong, repeatMode, playQueue, songsById,
  activePlaylist, activePlaylistSongs, isShuffle, repeatPlaylist, currentId,
  sourceLoopRestart, currentIndex, buildShuffleQueue
}: AutoTransitionInputs) {
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

