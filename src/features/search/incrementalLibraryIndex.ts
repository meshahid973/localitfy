import type { Song } from "../library/song.types";
import { splitArtistCredits } from "../artists/artistCredits";
import { buildSongSearchEntryCached } from "./search.utils";
import type { SongSearchEntry } from "./search.utils";

export type LibraryIndex = {
  songsById: Map<string, Song>;
  songIndexById: Map<string, number>;
  searchEntries: SongSearchEntry[];
  artistOccurrences: Map<string, number>;
  albumOccurrences: Map<string, number>;
  artistCount: number;
  albumCount: number;
};

function artistKeys(song: Song): string[] {
  return [...new Set(splitArtistCredits(song.artist).map(name => name.toLocaleLowerCase()))];
}

function albumKey(song: Song): string {
  return String(song.album || "").trim().toLocaleLowerCase();
}

function count(map: Map<string, number>, key: string, delta: number) {
  if (!key) return;
  const next = (map.get(key) || 0) + delta;
  if (next > 0) map.set(key, next);
  else map.delete(key);
}

/**
 * Reuse unchanged songs' normalized search entries and artist/album counts.
 * Order and ID lookups still require one cheap linear scan; the costly search
 * normalization and facet updates run only on changed/added/removed songs.
 */
export function reconcileLibraryIndex(songs: readonly Song[], previous?: LibraryIndex): LibraryIndex {
  const songsById = new Map<string, Song>();
  const songIndexById = new Map<string, number>();
  const searchEntries: SongSearchEntry[] = [];
  const oldSearchById = new Map(previous?.searchEntries.map(entry => [entry.song.id, entry]) || []);
  const artistOccurrences = new Map(previous?.artistOccurrences || []);
  const albumOccurrences = new Map(previous?.albumOccurrences || []);

  for (const [index, song] of songs.entries()) {
    songsById.set(song.id, song);
    songIndexById.set(song.id, index);
    const oldSong = previous?.songsById.get(song.id);
    const oldEntry = oldSearchById.get(song.id);
    const unchanged = oldSong === song && oldEntry?.song === song;
    searchEntries.push(unchanged ? oldEntry : buildSongSearchEntryCached(song));
    if (!unchanged) {
      if (oldSong) {
        for (const key of artistKeys(oldSong)) count(artistOccurrences, key, -1);
        count(albumOccurrences, albumKey(oldSong), -1);
      }
      for (const key of artistKeys(song)) count(artistOccurrences, key, 1);
      count(albumOccurrences, albumKey(song), 1);
    }
  }

  if (previous) {
    for (const [id, oldSong] of previous.songsById) {
      if (songsById.has(id)) continue;
      for (const key of artistKeys(oldSong)) count(artistOccurrences, key, -1);
      count(albumOccurrences, albumKey(oldSong), -1);
    }
  }

  return {
    songsById, songIndexById, searchEntries,
    artistOccurrences, albumOccurrences,
    artistCount: artistOccurrences.size, albumCount: albumOccurrences.size
  };
}

/** Patch one song while preserving all untouched song object identities. */
export function patchLibrarySong(
  songs: readonly Song[], id: string, patch: Partial<Song>, expectedIndex?: number
): Song[] {
  let index = Number.isInteger(expectedIndex) ? Number(expectedIndex) : -1;
  if (index < 0 || index >= songs.length || songs[index].id !== id) {
    index = songs.findIndex(song => song.id === id);
  }
  if (index < 0) return songs as Song[];
  const next = songs.slice();
  next[index] = { ...next[index], ...patch };
  return next;
}

export function replaceLibrarySong(
  songs: readonly Song[], updated: Song, expectedIndex?: number
): Song[] {
  let index = Number.isInteger(expectedIndex) ? Number(expectedIndex) : -1;
  if (index < 0 || index >= songs.length || songs[index].id !== updated.id) {
    index = songs.findIndex(song => song.id === updated.id);
  }
  if (index < 0 || songs[index] === updated) return songs as Song[];
  const next = songs.slice();
  next[index] = updated;
  return next;
}
