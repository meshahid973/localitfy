import type { Song } from "../library/song.types";

const DAY_MS = 24 * 60 * 60 * 1000;
const REDISCOVER_AFTER_DAYS = 30;
const REDISCOVER_MIN_PLAYS = 3;

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

/** Bounded top-K import selection, preserving stable order on equal dates. */
export function pickRecentlyAdded(songs: readonly Song[], limit = 12): Song[] {
  return takeBest(songs, limit, song => playable(song) ? ({ value: song, primary: time(song.dateAdded), secondary: 0 }) : null);
}

export function pickRecentlyPlayed(songs: readonly Song[], limit = 10): Song[] {
  return takeBest(songs, limit, (song) => {
    if (!playable(song)) return null;
    const last = time(song.lastPlayed);
    return last > 0 ? { value: song, primary: last, secondary: 0 } : null;
  });
}

export function pickMostPlayedSongs(songs: readonly Song[], limit = 12): Song[] {
  return takeBest(songs, limit, (song) => {
    const plays = Number(song.playCount);
    return playable(song) && Number.isFinite(plays) && plays > 0
      ? { value: song, primary: plays, secondary: time(song.lastPlayed) }
      : null;
  });
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

/** Keep one image per distinct cover, in mix order, without changing its songs. */
export function pickHomeMixArtwork(songs: readonly Song[]): Song[] {
  const seen = new Set<string>();
  const artwork: Song[] = [];
  const fallback: Song[] = [];
  for (const song of songs) {
    const source = song.coverThumbUrl || song.coverThumbnailUrl || song.thumbnailUrl || song.coverUrl || song.coverPath || song.coverFullUrl;
    const key = source ? "cover:" + source : "song:" + song.id;
    if (seen.has(key)) continue;
    seen.add(key);
    if (source) artwork.push(song);
    else if (fallback.length < 4) fallback.push(song);
    if (artwork.length === 4) break;
  }
  return [...artwork, ...fallback.slice(0, 4 - artwork.length)];
}

/** Rank local listening evidence with bounded candidate selection. Avoid artist
 * monopolies when alternatives exist, and use only existing playable tracks. */
export function pickListenNow(songs: readonly Song[], currentId: string | null, now: Date, limit = 8): Song[] {
  const count = Math.max(0, Math.min(32, Math.floor(limit) || 0));
  if (!count) return [];
  const seen = new Set<string>();
  const ranked = takeBest(songs, count * 4, song => {
    if (!playable(song) || seen.has(song.id)) return null;
    seen.add(song.id);
    const plays = Math.max(0, Number(song.playCount) || 0);
    const last = time(song.lastPlayed);
    const age = last ? Math.max(0, (now.getTime() - last) / DAY_MS) : Infinity;
    const recent = last ? 5 * Math.exp(-age / 14) : 0;
    const added = time(song.dateAdded);
    const freshness = added ? Math.max(0, 1 - Math.max(0, now.getTime() - added) / (30 * DAY_MS)) : 0;
    return { value: song, primary: (song.id === currentId ? 1000 : 0) + (song.liked ? 3 : 0) +
      Math.log1p(plays) * 1.7 + recent + freshness, secondary: last || added };
  });
  const selected: Song[] = [], deferred: Song[] = [];
  const artists = new Map<string, number>();
  for (const song of ranked) {
    const artist = (song.artist || "").trim().toLowerCase();
    if (artist && artist !== "unknown artist" && (artists.get(artist) || 0) >= 2) { deferred.push(song); continue; }
    if (artist) artists.set(artist, (artists.get(artist) || 0) + 1);
    selected.push(song);
    if (selected.length === count) return selected;
  }
  return [...selected, ...deferred].slice(0, count);
}

/** Suppress repeated recommendation cards, not factual history/favorites.
 * Refill from the ranked alternatives and retain sparse-library usefulness. */
export function diversifyHomeRecommendations(candidates: readonly Song[], excluded: readonly Song[], limit = 10): Song[] {
  const seen = new Set<string>();
  const avoid = new Set(excluded.map(song => song.id));
  const preferred: Song[] = [], fallback: Song[] = [];
  for (const song of candidates) {
    if (!playable(song) || seen.has(song.id)) continue;
    seen.add(song.id);
    (avoid.has(song.id) ? fallback : preferred).push(song);
  }
  return [...preferred, ...fallback].slice(0, limit);
}
