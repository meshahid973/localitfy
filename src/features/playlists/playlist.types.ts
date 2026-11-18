import type { Song } from "../library/song.types";
import type { SmartRules } from "./smartPlaylist";

export type Playlist = {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
  coverArtwork?: string;
  /** Smart playlists fill `songIds` from these rules instead of by hand. */
  rules?: SmartRules;
};

export type PlaylistSummary = {
  playlist: Playlist;
  previewSongs: Song[];
  songCount: number;
  duration: number;
};
