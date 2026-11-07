import type { Song } from "../library/song.types";
import { splitArtistCredits } from "../artists/artistCredits";
import { splitGenreCredits } from "./genreCredits";

export type GenreEntry = {
  id: string;
  name: string;
  songs: Song[];
  artistCount: number;
  playCount: number;
  /** Newest dateAdded among the genre's songs, in ms (0 when unknown). */
  addedAt: number;
  coverSong: Song;
};

export type GenreSortMode = "tracks" | "artists" | "plays" | "recent" | "name";
export type GenreMinTracks = "1" | "2" | "3" | "5" | "10" | "25";

export const GENRE_SORT_ITEMS: readonly { value: GenreSortMode; label: string }[] = [
  { value: "tracks", label: "most tracks" },
  { value: "artists", label: "most artists" },
  { value: "plays", label: "most played" },
  { value: "recent", label: "recently added" },
  { value: "name", label: "name A–Z" }
];

export const GENRE_MIN_TRACKS: readonly GenreMinTracks[] = ["1", "2", "3", "5", "10", "25"];

const byName = (a: GenreEntry, b: GenreEntry) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

function timeOf(value: string | null | undefined) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : 0;
}

export function buildGenres(songs: Song[]): GenreEntry[] {
  const groups = new Map<string, { name: string; songs: Song[] }>();
  for (const song of songs) {
    for (const name of splitGenreCredits(song.genre)) {
      const id = name.toLocaleLowerCase();
      const group = groups.get(id) || { name, songs: [] };
      group.songs.push(song);
      groups.set(id, group);
    }
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      ...group,
      artistCount: new Set(
        group.songs.flatMap((song) => splitArtistCredits(song.artist)).map((name) => name.toLocaleLowerCase())
      ).size,
      playCount: group.songs.reduce((total, song) => total + (song.playCount || 0), 0),
      addedAt: group.songs.reduce((latest, song) => Math.max(latest, timeOf(song.dateAdded)), 0),
      coverSong: group.songs.find((song) => Boolean(song.coverUrl || song.coverPath || song.coverThumbnailUrl)) || group.songs[0]
    }))
    .sort(byName);
}

/** How many genres each minimum-track option keeps. */
export function countGenresByMinTracks(genres: GenreEntry[]): Record<GenreMinTracks, number> {
  const counts = {} as Record<GenreMinTracks, number>;
  for (const min of GENRE_MIN_TRACKS) counts[min] = genres.filter((genre) => genre.songs.length >= Number(min)).length;
  return counts;
}

/** Search, drop genres below the minimum track count, then sort. Ties fall back to name. */
export function filterAndSortGenres(genres: GenreEntry[], query: string, sortMode: GenreSortMode, minTracks: GenreMinTracks): GenreEntry[] {
  const min = Number(minTracks) || 1;
  const sized = min > 1 ? genres.filter((genre) => genre.songs.length >= min) : genres;
  const needle = query.trim().toLocaleLowerCase();
  let matches = sized;
  if (needle) {
    const exactMatches = sized.filter((genre) => genre.name.toLocaleLowerCase() === needle);
    matches = exactMatches.length ? exactMatches : sized.filter((genre) => genre.name.toLocaleLowerCase().includes(needle));
  }

  // buildGenres already returns name order.
  if (sortMode === "name") return matches;
  const key: (genre: GenreEntry) => number =
    sortMode === "artists" ? (genre) => genre.artistCount
    : sortMode === "plays" ? (genre) => genre.playCount
    : sortMode === "recent" ? (genre) => genre.addedAt
    : (genre) => genre.songs.length;
  return [...matches].sort((a, b) => key(b) - key(a) || b.songs.length - a.songs.length || byName(a, b));
}
