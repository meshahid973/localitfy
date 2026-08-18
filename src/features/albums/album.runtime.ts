import type { Song } from "../library/song.types";
import type { LocalAlbumEntry, ManualLocalAlbum } from "./album.types";
import { isPlayableSong } from "../library/library.utils";
import { makeLocalId } from "../../shared/storage/localStorage";
import { prettyMeta } from "../search/search.utils";
import { getCardCoverUrl } from "../covers/Cover";
import { getRendererSafeImageUrl } from "../covers/cover.ambient";


const UNKNOWN_ALBUM_NAMES = new Set([
  "",
  "local files",
  "unknown",
  "unknown album",
  "untitled",
  "untitled album",
  "downloads",
  "downloaded music"
]);

export function normalizeAlbumValue(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function albumKeyPart(value: unknown) {
  return normalizeAlbumValue(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

export function isUsefulAlbumName(value: unknown) {
  const normalized = normalizeAlbumValue(value).toLowerCase();
  return normalized.length > 0 && !UNKNOWN_ALBUM_NAMES.has(normalized);
}

export function getAlbumArtist(song: Song) {
  return normalizeAlbumValue((song as any).albumArtist || song.artist || "unknown artist") || "unknown artist";
}

export function getAlbumYear(song: Song) {
  const raw = String((song as any).year || (song as any).date || "").trim();
  const match = raw.match(/(?:19|20)\d{2}/);
  return match?.[0] ?? null;
}

export function getSongAddedTime(song: Song) {
  const addedAt = Date.parse(String(song.dateAdded || ""));
  return Number.isFinite(addedAt) ? addedAt : 0;
}

export function pickAlbumCoverSong(songs: Song[]) {
  return songs.find((song) => Boolean(getCardCoverUrl(song) || getRendererSafeImageUrl(song.coverPath))) || songs[0] || null;
}

export function makeAlbumCoverSong(coverUrl: string, title: string, artist: string, seedSong?: Song | null): Song {
  const safeCoverUrl = getRendererSafeImageUrl(coverUrl);
  const base = seedSong || null;

  return {
    id: `album-cover-${albumKeyPart(title)}-${albumKeyPart(artist)}-${safeCoverUrl.slice(0, 24)}`,
    title: title || base?.title || "custom album",
    artist: artist || base?.artist || "local album",
    album: title || base?.album || "custom album",
    filePath: base?.filePath || "",
    url: base?.url || "",
    fileExists: true,
    coverPath: null,
    coverUrl: safeCoverUrl,
    liked: false,
    playCount: 0,
    duration: 0,
    dateAdded: base?.dateAdded || new Date().toISOString()
  } as Song;
}

export function normalizeStoredPathForCompare(value: unknown) {
  return String(value || "").trim().replace(/\\/g, "/").toLowerCase();
}

export function pickManualAlbumCoverSong(album: ManualLocalAlbum, albumSongs: Song[]) {
  const storedCoverPath = normalizeStoredPathForCompare(album.coverPath || album.folderCoverPath || album.embeddedCoverPath || "");
  const preferredByPath = storedCoverPath
    ? albumSongs.find((song) => normalizeStoredPathForCompare(song.coverPath) === storedCoverPath)
    : null;

  if (preferredByPath) return preferredByPath;

  const preferredBySource = albumSongs.find((song) =>
    ["custom", "folder", "embedded"].includes(String((song as any).coverSource || "")) &&
    Boolean(getCardCoverUrl(song) || getRendererSafeImageUrl(song.coverPath))
  );

  if (preferredBySource) return preferredBySource;

  const safeCoverUrl = getRendererSafeImageUrl(album.coverUrl);
  if (safeCoverUrl) return makeAlbumCoverSong(safeCoverUrl, album.title, album.artist, albumSongs[0] || null);

  return pickAlbumCoverSong(albumSongs);
}

export function resizeAlbumCoverFile(file: File, size = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not prepare cover canvas.");

        const sourceSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
        const sourceX = ((image.naturalWidth || image.width) - sourceSize) / 2;
        const sourceY = ((image.naturalHeight || image.height) - sourceSize) / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

        let dataUrl = canvas.toDataURL("image/webp", 0.84);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.86);
        }

        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that image."));
    };

    image.src = objectUrl;
  });
}

export function buildLocalAlbumEntries(inputSongs: Song[]): LocalAlbumEntry[] {
  const groups = new Map<string, LocalAlbumEntry>();

  inputSongs.forEach((song) => {
    if (!isPlayableSong(song) || !isUsefulAlbumName(song.album)) return;

    const title = normalizeAlbumValue(song.album);
    const albumArtist = getAlbumArtist(song);
    const key = `${albumKeyPart(title)}__${albumKeyPart(albumArtist)}`;
    const existing = groups.get(key);

    if (existing) {
      existing.songs.push(song);
      existing.trackCount += 1;
      existing.totalDuration += Math.max(0, Number(song.duration) || 0);
      existing.latestAdded = Math.max(existing.latestAdded, getSongAddedTime(song));
      if (!existing.year) existing.year = getAlbumYear(song);
      if (!existing.coverSong || getRendererSafeImageUrl(song.coverUrl) || getRendererSafeImageUrl(song.coverPath)) {
        existing.coverSong = pickAlbumCoverSong(existing.songs);
      }
      return;
    }

    groups.set(key, {
      id: key,
      title,
      artist: prettyMeta(albumArtist),
      albumArtist,
      year: getAlbumYear(song),
      coverSong: song,
      songs: [song],
      trackCount: 1,
      totalDuration: Math.max(0, Number(song.duration) || 0),
      latestAdded: getSongAddedTime(song)
    });
  });

  return [...groups.values()].map((album) => ({
    ...album,
    coverSong: pickAlbumCoverSong(album.songs),
    songs: [...album.songs].sort((a, b) => {
      const trackA = Number((a as any).track || (a as any).trackNumber || 0);
      const trackB = Number((b as any).track || (b as any).trackNumber || 0);
      if (Number.isFinite(trackA) && Number.isFinite(trackB) && trackA !== trackB) return trackA - trackB;
      return getSongAddedTime(a) - getSongAddedTime(b);
    })
  })).sort((a, b) => b.latestAdded - a.latestAdded || a.title.localeCompare(b.title));
}

export function filterAndSortAlbums(albums: LocalAlbumEntry[], query: string, sortMode: string) {
  const cleanedQuery = normalizeAlbumValue(query).toLowerCase();
  const filtered = cleanedQuery
    ? albums.filter((album) => `${album.title} ${album.artist} ${album.year || ""}`.toLowerCase().includes(cleanedQuery))
    : albums;

  return [...filtered].sort((a, b) => {
    if (sortMode === "title") return a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist);
    if (sortMode === "artist") return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
    if (sortMode === "year") return String(b.year || "0000").localeCompare(String(a.year || "0000")) || a.title.localeCompare(b.title);
    return b.latestAdded - a.latestAdded || a.title.localeCompare(b.title);
  });
}

export function albumTrackIds(album: LocalAlbumEntry | null) {
  return album?.songs.map((song) => song.id).filter(Boolean) ?? [];
}


export const MANUAL_LOCAL_ALBUMS_STORAGE_KEY = "localitfy.manualAlbums.v1";

export function cleanManualAlbumTitle(value: unknown) {
  return normalizeAlbumValue(value).slice(0, 90);
}

export function cleanManualAlbumArtist(value: unknown) {
  return normalizeAlbumValue(value).slice(0, 90);
}

export function cleanManualAlbumYear(value: unknown) {
  const match = String(value || "").match(/(?:19|20)\d{2}/);
  return match?.[0] ?? "";
}

export function normalizeManualLocalAlbums(value: unknown): ManualLocalAlbum[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const raw = item && typeof item === "object" ? item as any : null;
      if (!raw) return null;

      const title = cleanManualAlbumTitle(raw.title || raw.name);
      const artist = cleanManualAlbumArtist(raw.artist || raw.albumArtist || "local album");
      const songIds: string[] = Array.isArray(raw.songIds)
        ? [...new Set<string>(raw.songIds.map((id: unknown) => String(id || "").trim()).filter((id: string) => Boolean(id)))]
        : [];
      const coverUrl = getRendererSafeImageUrl(raw.coverUrl || raw.coverDataUrl || raw.customCoverUrl || "");

      if (!title || !songIds.length) return null;

      const createdAt = Number(raw.createdAt) || Date.now();
      const updatedAt = Number(raw.updatedAt) || createdAt;

      return {
        id: String(raw.id || makeLocalId("album")).trim() || makeLocalId("album"),
        title,
        artist: artist || "local album",
        year: cleanManualAlbumYear(raw.year),
        coverUrl,
        coverPath: String(raw.coverPath || ""),
        coverSource: String(raw.coverSource || ""),
        embeddedCoverPath: String(raw.embeddedCoverPath || ""),
        songIds,
        createdAt,
        updatedAt,
        sourceType: raw.sourceType === "folder" ? "folder" : "manual",
        sourcePath: typeof raw.sourcePath === "string" ? raw.sourcePath : "",
        folderCoverPath: typeof raw.folderCoverPath === "string" ? raw.folderCoverPath : "",
        importedAt: Number(raw.importedAt) || 0
      } satisfies ManualLocalAlbum;
    })
    .filter(Boolean) as ManualLocalAlbum[];
}

export function normalizeFolderAlbumPathKey(value: unknown) {
  return String(value || "")
    .replace(/\\+/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .trim()
    .toLowerCase();
}

export function folderAlbumPathContains(parentPath: unknown, childPath: unknown) {
  const parent = normalizeFolderAlbumPathKey(parentPath);
  const child = normalizeFolderAlbumPathKey(childPath);
  return Boolean(parent && child && (child === parent || child.startsWith(`${parent}/`)));
}

export function buildManualAlbumSongIdSet(manualAlbums: ManualLocalAlbum[]) {
  const ids = new Set<string>();

  manualAlbums.forEach((album) => {
    if (!Array.isArray(album.songIds)) return;
    album.songIds.forEach((songId) => {
      const cleaned = String(songId || "").trim();
      if (cleaned) ids.add(cleaned);
    });
  });

  return ids;
}

export function buildManualAlbumEntries(manualAlbums: ManualLocalAlbum[], songsById: Map<string, Song>): LocalAlbumEntry[] {
  return manualAlbums
    .map((album) => {
      const albumSongs = album.songIds
        .map((songId) => songsById.get(songId))
        .filter(isPlayableSong);

      if (!albumSongs.length) return null;

      const latestAdded = Math.max(album.updatedAt || 0, ...albumSongs.map(getSongAddedTime));

      const customCoverUrl = getRendererSafeImageUrl(album.coverUrl);

      return {
        id: `manual_${album.id}`,
        title: album.title,
        artist: album.artist || "local album",
        albumArtist: album.artist || "local album",
        year: album.year || null,
        customCoverUrl: customCoverUrl || null,
        coverSong: pickManualAlbumCoverSong(album, albumSongs),
        songs: albumSongs,
        trackCount: albumSongs.length,
        totalDuration: albumSongs.reduce((total, song) => total + Math.max(0, Number(song.duration) || 0), 0),
        latestAdded,
        source: "manual",
        sourceType: album.sourceType === "folder" ? "folder" : "manual",
        sourcePath: album.sourcePath || "",
        folderCoverPath: album.folderCoverPath || "",
        importedAt: album.importedAt || 0,
        manualAlbumId: album.id,
        createdAt: album.createdAt,
        updatedAt: album.updatedAt
      } as LocalAlbumEntry & { source: "manual"; sourceType?: "manual" | "folder"; sourcePath?: string; folderCoverPath?: string; importedAt?: number; manualAlbumId: string; createdAt: number; updatedAt: number };
    })
    .filter(Boolean) as LocalAlbumEntry[];
}

export function albumSongSearchMatches(song: Song, query: string) {
  const cleaned = normalizeAlbumValue(query).toLowerCase();
  if (!cleaned) return true;
  return `${song.title} ${song.artist} ${song.album || ""}`.toLowerCase().includes(cleaned);
}

export function uniquePlayableSongIds(songIds: string[], songsById: Map<string, Song>) {
  const seen = new Set<string>();
  return songIds.filter((songId) => {
    const song = songsById.get(songId);
    if (!isPlayableSong(song) || seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
}

export function uniqueCleanArtistsFromSongs(inputSongs: Song[]) {
  const seen = new Set<string>();
  return inputSongs
    .map((song) => prettyMeta(song.artist || ""))
    .map((artist) => artist.trim())
    .filter((artist) => artist && artist.toLowerCase() !== "unknown artist")
    .filter((artist) => {
      const key = artist.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function suggestAlbumArtistFromSongs(inputSongs: Song[]) {
  const artists = uniqueCleanArtistsFromSongs(inputSongs);
  if (artists.length === 0) return "local album";
  if (artists.length === 1) return artists[0];
  return "various artists";
}
