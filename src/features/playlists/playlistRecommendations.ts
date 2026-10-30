import { splitArtistCredits } from "../artists/artistCredits";
import type { Song } from "../library/song.types";
import type { Playlist } from "./playlist.types";

/** Songs shown at once under a playlist, as in Spotify's "Recommended songs". */
export const RECOMMENDATION_PAGE = 10;
export const MAX_AUDIO_RECOMMENDATION_SEEDS = 2000;
/** Evenly sample long playlists to stay within the native similarity service's 2,000-seed limit. */
export function audioRecommendationSeeds(songs: readonly Song[]) {
  const count = Math.min(songs.length, MAX_AUDIO_RECOMMENDATION_SEEDS);
  return Array.from({ length: count }, (_, index) => songs[Math.floor(index * songs.length / count)].id);
}
const PER_ARTIST = 3;

export const artistKey = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
export const songArtistKeys = (song: Song) => splitArtistCredits(song.artist).map(artistKey).filter((key) => key !== "unknown artist");

// Same tags as genreTags/genreTokens in electron/analysis/listening-signals.cjs: "dance-pop; electronic" becomes
// {dance pop, electronic}, and words of multi-word tags count half so related genres overlap.
export function genreTagKeys(value: unknown) {
  const keys = new Set<string>();
  for (const part of String(value || "").split(/[;,/|]/)) {
    const key = part.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    if (key && key.length <= 60) keys.add(key);
  }
  return keys;
}
function genreTokens(value: unknown) {
  const tokens = new Map<string, number>();
  for (const key of genreTagKeys(value)) {
    tokens.set(key, 1);
    const words = key.split(" ");
    if (words.length > 1) for (const word of words) if (word.length > 1 && !tokens.has(word)) tokens.set(word, .5);
  }
  return tokens;
}
function cosine(a: Map<string, number>, b: Map<string, number>) {
  if (!a.size || !b.size) return 0;
  let shared = 0; let normA = 0; let normB = 0;
  for (const [token, weight] of a) { normA += weight * weight; shared += weight * (b.get(token) || 0); }
  for (const weight of b.values()) normB += weight * weight;
  return shared / Math.sqrt(normA * normB);
}

const playable = (song: Song | undefined): song is Song => !!song && song.fileExists !== false;

/**
 * Library-only relatedness to a group of seed songs, for when there is no audio analysis: shared artists, genre
 * tags, albums, and other playlists the seeds appear in. Returns positive scores only; seeds are left out.
 */
export function relatedSongScores(seeds: readonly Song[], songs: readonly Song[], playlists: readonly Playlist[] = []) {
  const seedIds = new Set(seeds.map((song) => song.id));
  const artists = new Map<string, number>();
  const albums = new Map<string, number>();
  const genre = new Map<string, number>();
  for (const song of seeds) {
    const keys = songArtistKeys(song);
    for (const key of keys) artists.set(key, (artists.get(key) || 0) + 1 / keys.length);
    const album = `${artistKey(song.album || "")}\u0000${keys[0] || ""}`;
    albums.set(album, (albums.get(album) || 0) + 1);
    for (const [token, weight] of genreTokens(song.genre)) genre.set(token, (genre.get(token) || 0) + weight);
  }
  // Songs that share a playlist with the seeds; a large playlist says less about each of its songs.
  const together = new Map<string, number>();
  for (const playlist of playlists) {
    if (playlist.rules || !playlist.songIds.length) continue;
    const overlap = playlist.songIds.filter((id) => seedIds.has(id)).length;
    if (!overlap || overlap === playlist.songIds.length) continue;
    const weight = overlap / playlist.songIds.length;
    for (const id of playlist.songIds) if (!seedIds.has(id)) together.set(id, (together.get(id) || 0) + weight);
  }
  const count = Math.max(1, seeds.length);
  const scores = new Map<string, number>();
  for (const song of songs) {
    if (seedIds.has(song.id) || !playable(song)) continue;
    const keys = songArtistKeys(song);
    const artist = Math.min(1, Math.max(0, ...keys.map((key) => (artists.get(key) || 0) / count)) * 3);
    const genreMatch = cosine(genre, genreTokens(song.genre));
    const album = (albums.get(`${artistKey(song.album || "")}\u0000${keys[0] || ""}`) || 0) / count;
    const shared = Math.min(1, together.get(song.id) || 0);
    if (!artist && genreMatch < .25 && !shared) continue;
    const score = .9 * artist + genreMatch + .3 * Math.min(1, album * 3) + .7 * shared
      + (song.liked ? .05 : 0) + .02 * Math.log1p(song.playCount || 0);
    scores.set(song.id, score);
  }
  return scores;
}

/** Ranked song IDs from scores, best first, with ties broken by ID so the order is stable. */
export function rankScores(scores: Map<string, number>) {
  return [...scores].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id);
}

/**
 * The next page of recommendations from a ranked pool: songs not in the playlist and not shown before,
 * at most a few per artist so one artist can't fill the list while others are available.
 */
export function pickRecommendations(pool: readonly string[], songsById: Map<string, Song>, exclude: ReadonlySet<string>,
  size = RECOMMENDATION_PAGE) {
  const picked: string[] = [];
  const perArtist = new Map<string, number>();
  // Past the cap only when other artists can't fill the page.
  for (const capped of [true, false]) {
    for (const id of pool) {
      if (picked.length >= size) break;
      const song = songsById.get(id);
      if (exclude.has(id) || !playable(song) || picked.includes(id)) continue;
      const lead = songArtistKeys(song)[0] || "";
      if (capped && (perArtist.get(lead) || 0) >= PER_ARTIST) continue;
      perArtist.set(lead, (perArtist.get(lead) || 0) + 1);
      picked.push(id);
    }
  }
  return picked;
}
