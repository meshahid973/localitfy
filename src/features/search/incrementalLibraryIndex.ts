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
  sourceSongs: readonly Song[];
};

// One immutable patch tells reconciliation which position changed. Weak keys
// avoid retaining entire previous libraries once React releases their arrays.
const edits = new WeakMap<readonly Song[], {before: readonly Song[]; index: number}>();

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
  // A known single-song patch preserves the order and all other identities
  // by construction. Fall back to the full validation for arbitrary arrays.
  const edit = previous && edits.get(songs);
  const editedIndex = edit && previous?.sourceSongs === edit.before &&
    previous.searchEntries.length === songs.length &&
    previous.songIndexById.size === songs.length &&
    previous.searchEntries[edit.index]?.song.id === songs[edit.index]?.id
    ? edit.index : -1;
  const stableOrder = previous && (editedIndex >= 0 ||
    (previous.searchEntries.length === songs.length &&
     previous.songIndexById.size === songs.length &&
     songs.every((song, i) => previous.searchEntries[i].song.id === song.id)));
  let songsById = stableOrder ? previous.songsById : new Map<string, Song>();
  const songIndexById = stableOrder ? previous.songIndexById : new Map<string, number>();
  let searchEntries = stableOrder ? previous.searchEntries : new Array<SongSearchEntry>(songs.length);
  // Preserve immutable facet snapshots when only playback/likes/title change.
  // Copy on the first actual artist/album change, not on every library update.
  let artistOccurrences = previous?.artistOccurrences || new Map<string, number>();
  let albumOccurrences = previous?.albumOccurrences || new Map<string, number>();
  const artistWrite = () => {
    if (previous && artistOccurrences === previous.artistOccurrences) artistOccurrences = new Map(artistOccurrences);
    return artistOccurrences;
  };
  const albumWrite = () => {
    if (previous && albumOccurrences === previous.albumOccurrences) albumOccurrences = new Map(albumOccurrences);
    return albumOccurrences;
  };

  const workLength = editedIndex >= 0 ? 1 : songs.length;
  for (let offset = 0; offset < workLength; offset++) {
    const index = editedIndex >= 0 ? editedIndex : offset;
    const song = songs[index];
    const oldIndex = stableOrder ? index : previous?.songIndexById.get(song.id);
    const oldEntry = oldIndex === undefined ? undefined : previous?.searchEntries[oldIndex];
    const oldSong = stableOrder ? oldEntry?.song : previous?.songsById.get(song.id);
    const unchanged = oldSong === song && oldEntry?.song === song;
    if (stableOrder) {
      if (unchanged) continue;
      if (songsById === previous.songsById) songsById = new Map(songsById);
      if (searchEntries === previous.searchEntries) searchEntries = searchEntries.slice();
      songsById.set(song.id, song);
    } else {
      songsById.set(song.id, song);
      songIndexById.set(song.id, index);
    }
    searchEntries[index] = unchanged ? oldEntry : buildSongSearchEntryCached(song, oldEntry);
    if (!oldSong || oldSong.artist !== song.artist) {
      if (oldSong) for (const key of artistKeys(oldSong)) count(artistWrite(), key, -1);
      for (const key of artistKeys(song)) count(artistWrite(), key, 1);
    }
    if (!oldSong || oldSong.album !== song.album) {
      if (oldSong) count(albumWrite(), albumKey(oldSong), -1);
      count(albumWrite(), albumKey(song), 1);
    }
  }

  if (previous && !stableOrder) {
    for (const [id, oldSong] of previous.songsById) {
      if (songsById.has(id)) continue;
      for (const key of artistKeys(oldSong)) count(artistWrite(), key, -1);
      count(albumWrite(), albumKey(oldSong), -1);
    }
  }

  if (stableOrder && searchEntries === previous.searchEntries) return previous;
  return {
    songsById, songIndexById, searchEntries,
    artistOccurrences, albumOccurrences,
    artistCount: artistOccurrences.size, albumCount: albumOccurrences.size,
    sourceSongs: songs
  };
}

/** Trust the index hint only if it still names this song after sorting/filtering. */
function resolveSongIndex(songs: readonly Song[], id: string, expectedIndex?: number): number {
  const index = Number.isInteger(expectedIndex) ? Number(expectedIndex) : -1;
  return index >= 0 && index < songs.length && songs[index].id === id
    ? index : songs.findIndex(song => song.id === id);
}

/** Patch one song while preserving all untouched song object identities. */
export function patchLibrarySong(
  songs: readonly Song[], id: string, patch: Partial<Song>, expectedIndex?: number
): Song[] {
  const index = resolveSongIndex(songs, id, expectedIndex);
  if (index < 0) return songs as Song[];
  const keys = Object.keys(patch) as (keyof Song)[];
  if (keys.every(key => Object.prototype.hasOwnProperty.call(songs[index], key) && Object.is(songs[index][key], patch[key]))) return songs as Song[];
  const next = songs.slice();
  next[index] = { ...next[index], ...patch };
  edits.set(next, {before:songs,index});
  return next;
}

export function replaceLibrarySong(
  songs: readonly Song[], updated: Song, expectedIndex?: number
): Song[] {
  const index = resolveSongIndex(songs, updated.id, expectedIndex);
  if (index < 0 || songs[index] === updated) return songs as Song[];
  const previous = songs[index];
  const keys = Object.keys(updated) as (keyof Song)[];
  if (keys.length === Object.keys(previous).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(previous, key) && Object.is(previous[key], updated[key]))) return songs as Song[];
  const next = songs.slice();
  next[index] = updated;
  edits.set(next, {before:songs,index});
  return next;
}
