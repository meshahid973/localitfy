import type { Song } from "../library/song.types";

export type LocalAlbumEntry = {
  id: string;
  title: string;
  artist: string;
  albumArtist?: string;
  year?: string | null;
  coverSong: Song | null;
  customCoverUrl?: string | null;
  songs: Song[];
  trackCount: number;
  totalDuration: number;
  latestAdded: number;
};

export type AlbumSortMode = "recent" | "title" | "artist" | "year";

export type ManualLocalAlbum = {
  id: string;
  title: string;
  artist: string;
  year?: string;
  coverUrl?: string;
  coverPath?: string;
  coverSource?: string;
  embeddedCoverPath?: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
  sourceType?: "manual" | "folder";
  sourcePath?: string;
  folderCoverPath?: string;
  importedAt?: number;
};
