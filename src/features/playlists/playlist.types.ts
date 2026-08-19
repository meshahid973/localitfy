import type { Song } from "../library/song.types";

export type Playlist = {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
};

export type PlaylistSummary = {
  playlist: Playlist;
  previewSongs: Song[];
  songCount: number;
  duration: number;
};
