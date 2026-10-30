/** Songs of one album folder (or one artist's singles when the album is "local files"). */
export type TagAlbumGroup = { key: string; album: string; artist: string; folder: string; songIds: string[]; untaggedIds: string[]; releaseCount: number };

export type TagAudit = { total: number; tagged: number; missing: number; untaggedCount: number; untagged: TagAlbumGroup[]; splitAlbums: TagAlbumGroup[] };

export type ProposedTags = {
  title: string; artist: string; album: string; albumArtist: string; date: string; year: string;
  trackNumber: number; trackTotal: number; discNumber: number; discTotal: number; genre: string;
  releaseType: string; releaseStatus: string; releaseCountry: string; isrc: string;
};

export type TagProposal = {
  songId: string;
  /** Matches TagAlbumGroup.key, so restored proposals land under the right album. */
  groupKey: string;
  confidence: number;
  current: { title: string; artist: string; album: string; genre: string };
  tags: ProposedTags;
  /** Local media URL of the downloaded cover, or "" when the release has none. */
  coverUrl: string;
  musicbrainzUrl: string;
  /** False for formats other than MP3/FLAC: only the library is updated. */
  writable: boolean;
};

export type TagLookupResult = { proposals: TagProposal[]; missed: string[] };

export type TagApplyResult = { applied: number; written: number; failed: { songId: string; title: string; error: string }[] };

/** One recording on one release, from a hand-typed MusicBrainz search. */
export type TagSearchResult = {
  recordingId: string; releaseId: string; score: number; title: string; artist: string; album: string;
  year: string; country: string; releaseType: string; trackCount: number; durationMs: number;
};

/** One release from a hand-typed MusicBrainz album search. */
export type TagAlbumSearchResult = {
  releaseId: string; score: number; title: string; artist: string; year: string; country: string;
  releaseType: string; format: string; trackCount: number; label: string; note: string; status: string;
};

/** Which album to list: an album's songs, a song not in the library yet, or a specific edition. */
export type AlbumTracksRequest = { songIds?: string[]; title?: string; artist?: string; durationMs?: number; releaseId?: string };

/** A release's full track list; songId is the library song that already has the track, or "". */
export type AlbumTracks = {
  release: { id: string; title: string; artist: string; year: string; note: string; releaseType: string };
  coverUrl: string;
  tracks: { id: string; recordingId: string; disc: number; position: number; title: string; artist: string; durationMs: number; songId: string }[];
  editions: { id: string; title: string; note: string; year: string; country: string; format: string; trackCount: number }[];
};
