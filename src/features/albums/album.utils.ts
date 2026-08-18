import type { Song } from "../library/song.types";
import { isPlayableSong } from "../library/library.utils";
import { prettyMeta } from "../search/search.utils";
import { getRendererSafeImageUrl } from "../covers/cover.ambient";
import type { AlbumSortMode, LocalAlbumEntry } from "./album.types";

const UNKNOWN_ALBUM_NAMES = new Set(["", "local files", "unknown", "unknown album", "untitled", "untitled album", "downloads", "downloaded music"]);
export function normalizeAlbumValue(value: unknown) { return String(value || "").trim().replace(/\s+/g, " "); }
export function albumKeyPart(value: unknown) { return normalizeAlbumValue(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown"; }
export function isUsefulAlbumName(value: unknown) { const normalized = normalizeAlbumValue(value).toLowerCase(); return normalized.length > 0 && !UNKNOWN_ALBUM_NAMES.has(normalized); }
export function getAlbumArtist(song: Song) { return normalizeAlbumValue((song as Song & { albumArtist?: string }).albumArtist || song.artist || "unknown artist") || "unknown artist"; }
export function getAlbumYear(song: Song) { const raw = String((song as Song & { year?: string | number; date?: string }).year || (song as Song & { date?: string }).date || "").trim(); return raw.match(/(?:19|20)\d{2}/)?.[0] ?? null; }
export function getSongAddedTime(song: Song) { const added = Date.parse(String(song.dateAdded || "")); return Number.isFinite(added) ? added : 0; }
export function pickAlbumCoverSong(songs: Song[]) { return songs.find((song) => Boolean(getRendererSafeImageUrl(song.coverUrl) || getRendererSafeImageUrl(song.coverPath))) || songs[0] || null; }

export function buildLocalAlbumEntries(inputSongs: Song[]): LocalAlbumEntry[] {
  const groups = new Map<string, LocalAlbumEntry>();
  for (const song of inputSongs) {
    if (!isPlayableSong(song) || !isUsefulAlbumName(song.album)) continue;
    const title = normalizeAlbumValue(song.album), albumArtist = getAlbumArtist(song), key = `${albumKeyPart(title)}__${albumKeyPart(albumArtist)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.songs.push(song); existing.trackCount += 1; existing.totalDuration += Math.max(0, Number(song.duration) || 0); existing.latestAdded = Math.max(existing.latestAdded, getSongAddedTime(song));
      if (!existing.year) existing.year = getAlbumYear(song); existing.coverSong = pickAlbumCoverSong(existing.songs); continue;
    }
    groups.set(key, { id:key, title, artist:prettyMeta(albumArtist), albumArtist, year:getAlbumYear(song), coverSong:song, songs:[song], trackCount:1, totalDuration:Math.max(0,Number(song.duration)||0), latestAdded:getSongAddedTime(song) });
  }
  return [...groups.values()].map((album) => ({ ...album, coverSong: pickAlbumCoverSong(album.songs), songs:[...album.songs].sort((a,b) => { const ta=Number((a as Song&{track?:number;trackNumber?:number}).track || (a as Song&{trackNumber?:number}).trackNumber || 0), tb=Number((b as Song&{track?:number;trackNumber?:number}).track || (b as Song&{trackNumber?:number}).trackNumber || 0); if(Number.isFinite(ta)&&Number.isFinite(tb)&&ta!==tb)return ta-tb; return getSongAddedTime(a)-getSongAddedTime(b); }) })).sort((a,b)=>b.latestAdded-a.latestAdded||a.title.localeCompare(b.title));
}

export function filterAndSortAlbums(albums: LocalAlbumEntry[], query: string, sortMode: AlbumSortMode | string) {
  const clean = normalizeAlbumValue(query).toLowerCase();
  const filtered = clean ? albums.filter((album) => `${album.title} ${album.artist} ${album.year || ""}`.toLowerCase().includes(clean)) : albums;
  return [...filtered].sort((a,b) => sortMode === "title" ? a.title.localeCompare(b.title)||a.artist.localeCompare(b.artist) : sortMode === "artist" ? a.artist.localeCompare(b.artist)||a.title.localeCompare(b.title) : sortMode === "year" ? String(b.year||"0000").localeCompare(String(a.year||"0000"))||a.title.localeCompare(b.title) : b.latestAdded-a.latestAdded||a.title.localeCompare(b.title));
}
export function albumTrackIds(album: LocalAlbumEntry | null) { return album?.songs.map((song) => song.id).filter(Boolean) ?? []; }
