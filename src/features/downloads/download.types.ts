export type DownloadStatus = "queued" | "downloading" | "converting" | "importing" | "done" | "failed" | "cancelled";

export type DownloadResult = {
  ok: boolean;
  url?: string;
  filePath?: string;
  filename?: string;
  sizeBytes?: number;
  error?: string;
  source?: "youtube" | "spotify" | string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
  provider?: string;
  providerUrl?: string;
  matchedTitle?: string;
  matchedArtist?: string;
  matchedDurationMs?: number;
  matchScore?: number;
  matchOk?: boolean;
  importedToLibrary?: boolean;
  librarySongId?: string;
  statusLabel?: string;
};

export type DownloadQueueItem = {
  id: string;
  url: string;
  title: string;
  status: DownloadStatus;
  progress: number;
  message: string;
  speed?: string | null;
  eta?: string | null;
  filePath?: string;
  filename?: string;
  error?: string;
  source?: "youtube" | "spotify" | string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
  providerUrl?: string;
  matchScore?: number;
  importedToLibrary?: boolean;
  librarySongId?: string;
  statusLabel?: string;
};

export type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  durationMs?: number;
  albumName?: string;
  coverUrl?: string;
  albumCoverUrl?: string;
  spotifyCoverUrl?: string;
  spotifyUrl?: string;
  isrc?: string;
  downloadStatus?: "ready" | "queued" | "downloading" | "done" | "failed";
  downloadError?: string;
  downloadMessage?: string;
  downloadedFilePath?: string;
  importedToLibrary?: boolean;
  librarySongId?: string;
  matchScore?: number;
  providerUrl?: string;
};
