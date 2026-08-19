export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  filePath: string;
  /** Runtime-only playback URL. Persisted URLs must not be trusted across runs. */
  url: string;
  fileExists?: boolean;
  coverPath?: string | null;
  coverUrl?: string | null;
  coverThumbUrl?: string | null;
  coverThumbnailUrl?: string | null;
  thumbnailUrl?: string | null;
  coverFullUrl?: string | null;
  liked: boolean;
  playCount: number;
  duration: number;
  dateAdded: string;
  lastPlayed?: string | null;
  volumeGain?: number;
  playbackPosition?: number;
  customVolume?: number;
  fileSizeBytes?: number;
  sizeBytes?: number;
  bitrate?: number;
  sampleRate?: number;
  sourceType?: "local" | "youtube" | "spotify" | string;
  sourceTrackId?: string | null;
  sourceUrl?: string | null;
  sourceProvider?: string | null;
  sourceProviderUrl?: string | null;
  sourceMatchScore?: number;
};

export type PlaybackUrlResult = {
  ok: boolean;
  url?: string;
  filePath?: string;
  fileExists?: boolean;
  exists?: boolean;
  sizeBytes?: number;
  mtimeMs?: number;
  cacheTtlMs?: number;
  error?: string;
};

export type PlaybackUrlCacheEntry = {
  url: string;
  checkedAt: number;
  fileExists: boolean;
  sizeBytes?: number;
  mtimeMs?: number;
};

export type ImportAnimationPhase = "idle" | "picking" | "scanning" | "success" | "error";
export type ImportAnimationState = {
  active: boolean;
  phase: ImportAnimationPhase;
  message: string;
  count: number;
  total: number;
  preview: Song[];
};

export type MetadataCleanPatch = Partial<Pick<Song, "title" | "artist" | "album">>;
export type MetadataCleanPreviewItem = {
  id: string;
  before: Pick<Song, "title" | "artist" | "album">;
  after: Pick<Song, "title" | "artist" | "album">;
  patch: MetadataCleanPatch;
  fields: string[];
};
export type MetadataCleanPreview = {
  id: number;
  scope: "all" | "selected";
  totalCount: number;
  changedCount: number;
  skippedCount: number;
  titleFixCount: number;
  artistFixCount: number;
  albumFixCount: number;
  items: MetadataCleanPreviewItem[];
};
export type MetadataUndoItem = { id: string; patch: MetadataCleanPatch };

export type LibraryDropSide = "before" | "after";
export type LibraryDropTarget = { songId: string; side: LibraryDropSide; pull: number };
export type SongContextMenuState = { songId: string; x: number; y: number };
