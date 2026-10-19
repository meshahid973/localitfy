import type { Song } from "../library/song.types";
import type { LocalAlbumEntry } from "../albums/album.types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const REDISCOVER_AFTER_DAYS = 30;
export const REDISCOVER_MIN_PLAYS = 3;

function playable(song: Song | null | undefined): song is Song {
  return !!song && Boolean(song.filePath || song.url) && song.fileExists !== false;
}

function time(value: unknown) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

export function localDayKey(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type Ranked<T> = { value: T; primary: number; secondary: number };

/**
 * Home displays at most a small shelf of results. Keep a stable top-K list
 * rather than allocating and sorting the entire library on each update.
 * Ties retain the input order, matching stable Array.sort.
 */
function takeBest<T>(
  values: readonly T[],
  limit: number,
  rank: (value: T) => Ranked<T> | null
): T[] {
  const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  if (!count) return [];

  const best: Ranked<T>[] = [];
  for (const value of values) {
    const entry = rank(value);
    if (!entry) continue;
    if (best.length === count) {
      const last = best[count - 1];
      if (entry.primary < last.primary ||
        (entry.primary === last.primary && entry.secondary <= last.secondary)) continue;
    }

    let index = 0;
    while (index < best.length && (
      best[index].primary > entry.primary ||
      (best[index].primary === entry.primary && best[index].secondary >= entry.secondary)
    )) index += 1;

    best.splice(index, 0, entry);
    if (best.length > count) best.pop();
  }
  return best.map((entry) => entry.value);
}

export function pickRecentlyPlayed(songs: readonly Song[], limit = 10): Song[] {
  return takeBest(songs, limit, (song) => {
    if (!playable(song)) return null;
    const last = time(song.lastPlayed);
    return last > 0 ? { value: song, primary: last, secondary: 0 } : null;
  });
}

export function pickNewAlbums(albums: readonly LocalAlbumEntry[], limit = 10): LocalAlbumEntry[] {
  return takeBest(albums, limit, (album) => album.songs.some(playable)
    ? { value: album, primary: album.latestAdded || 0, secondary: 0 }
    : null);
}

export function pickLikedSongs(songs: readonly Song[], limit = 10): Song[] {
  return takeBest(songs, limit, (song) => song.liked && playable(song)
    ? { value: song, primary: song.playCount || 0, secondary: 0 }
    : null);
}

export function pickRediscover(songs: readonly Song[], now: Date, limit = 10): Song[] {
  const cutoff = now.getTime() - REDISCOVER_AFTER_DAYS * DAY_MS;
  return takeBest(songs, limit, (song) => {
    if (!playable(song) || (song.playCount || 0) < REDISCOVER_MIN_PLAYS) return null;
    const last = time(song.lastPlayed);
    return last > 0 && last < cutoff
      ? { value: song, primary: song.playCount || 0, secondary: -last }
      : null;
  });
}

export function pickNotPlayedYet(songs: readonly Song[], now: Date, limit = 10): Song[] {
  const day = localDayKey(now);
  return takeBest(songs, limit, (song) => playable(song) && !(song.playCount || 0)
    ? { value: song, primary: -hash(`${day}:${song.id}`), secondary: 0 }
    : null);
}
