import { isPlayableSong } from "../library/library.utils";
import type { Song } from "../library/song.types";
import type { Playlist } from "../playlists/playlist.types";
import type { RepeatMode } from "./player.types";

/** An artist or genre started as a queue. songIds keeps the play order so repeat-all can loop it. */
export type PlaybackSourceRef = { kind: "artist" | "genre"; id: string; label: string };
export type PlaybackSource = PlaybackSourceRef & { songIds: string[] };
export type NowPlayingContext = { kind: PlaybackSourceRef["kind"] | "playlist" | "library"; id: string; label: string };
export type RepeatPreview = { label: string; songs: Song[]; hint: string };

export function playbackSourceRef(kind: PlaybackSourceRef["kind"], name: string, id = name.toLocaleLowerCase()): PlaybackSourceRef {
  return { kind, id, label: `${kind}: ${name}` };
}

function playableSourceIds(source: PlaybackSource, songsById: Map<string, Song>) {
  return source.songIds.filter((songId) => isPlayableSong(songsById.get(songId)));
}

/** With repeat-all, an artist/genre whose queue has run out starts again from its first song. */
export function getSourceLoopRestart(repeatMode: RepeatMode, source: PlaybackSource | null, inPlaylist: boolean, songsById: Map<string, Song>) {
  if (repeatMode !== "all" || !source || inPlaylist) return null;
  const ids = playableSourceIds(source, songsById);
  const song = ids.length ? songsById.get(ids[0]) : null;
  return song ? { song, rest: ids.slice(1) } : null;
}

/**
 * Previous within the source: step back one song (the current song returns to the front of the queue),
 * or wrap to the last song with repeat-all (the queue empties so the loop restarts after it).
 */
export function getSourcePreviousStep(repeatMode: RepeatMode, source: PlaybackSource | null, currentSongId: string, songsById: Map<string, Song>) {
  if (!source) return null;
  const ids = playableSourceIds(source, songsById);
  const index = ids.indexOf(currentSongId);
  if (index === -1) return null;
  const previousIndex = index > 0 ? index - 1 : repeatMode === "all" ? ids.length - 1 : 0;
  const queueChange = previousIndex < index ? "requeue-current" : previousIndex > index ? "clear" : "keep";
  return { songId: ids[previousIndex], queueChange } as const;
}

export function moveQueueItem(queue: string[], from: number, to: number) {
  if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return queue;
  const next = [...queue];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Playlist the song is playing from, else the artist/genre it was started from, else the library. */
export function resolveNowPlayingContext(
  song: Song | null,
  activePlaylist: Playlist | null,
  source: PlaybackSource | null
): NowPlayingContext {
  if (!song) return { kind: "library", id: "", label: "" };
  if (activePlaylist?.songIds.includes(song.id)) {
    return { kind: "playlist", id: activePlaylist.id, label: `playlist: ${activePlaylist.name}` };
  }
  if (source && source.songIds.includes(song.id)) return { kind: source.kind, id: source.id, label: source.label };
  return { kind: "library", id: "", label: "library" };
}

/** Mirrors the repeat-all rules in playNext so the queue can show what plays again. */
export function getRepeatPreview(options: {
  repeatMode: RepeatMode;
  currentSong: Song | null;
  activePlaylist: Playlist | null;
  activePlaylistSongs: Song[];
  isShuffle: boolean;
  source: PlaybackSource | null;
  songsById: Map<string, Song>;
}): RepeatPreview | null {
  const { repeatMode, currentSong, activePlaylist, activePlaylistSongs, isShuffle, source, songsById } = options;
  if (repeatMode !== "all" || !currentSong) return null;
  if (activePlaylist?.songIds.includes(currentSong.id)) {
    const label = `playlist: ${activePlaylist.name}`;
    return isShuffle
      ? { label, songs: [], hint: "shuffle is on, so the playlist keeps playing in random order." }
      : { label, songs: activePlaylistSongs, hint: "" };
  }
  if (source) {
    return { label: source.label, songs: source.songIds.map((songId) => songsById.get(songId)).filter(isPlayableSong), hint: "" };
  }
  return {
    label: "library",
    songs: [],
    hint: isShuffle ? "shuffle keeps picking songs from your whole library." : "after the last song in your library, playback starts again from the top."
  };
}

export function buildQueueEntries(queue: string[], songsById: Map<string, Song>) {
  return queue.flatMap((songId, index) => {
    const song = songsById.get(songId);
    return song ? [{ song, index }] : [];
  });
}

export function repeatButtonTitleFor(repeatMode: RepeatMode, inPlaylist: boolean, source: PlaybackSource | null) {
  if (repeatMode === "one") return "Loop current song is on";
  if (repeatMode === "off") return "Loop is off";
  return `Looping ${inPlaylist ? "this playlist" : source ? `this ${source.kind}` : "your library"}`;
}

/** Normalize queued songs without changing the saved library order. */
export function getPlayableUniqueSongIds(ids: string[], songsById: Map<string, Song>): string[] {
  const seen = new Set<string>();
  return ids.map((id) => songsById.get(id)).filter(isPlayableSong).filter((song) => {
    if (seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  }).map((song) => song.id);
}
