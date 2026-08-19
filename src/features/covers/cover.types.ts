import type { CSSProperties, ComponentType, Dispatch, SetStateAction } from "react";

export type CoverMood = "all" | "favorites" | "leastUsed" | "cute" | "space" | "dark" | "cozy" | "energy";
export type PixelArtAsset = { file: string; label: string; discordKey: string };
export type RuntimePixelArtAsset = PixelArtAsset & { path?: string; url?: string; key?: string };
export type PixelArtBridgeAsset = { name?: string; key?: string; path?: string; url?: string };

export type CoverSong = {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  filePath?: string;
  coverUrl?: string | null;
  coverPath?: string | null;
  [key: string]: unknown;
};

export type CoverGalleryEntry = {
  key: string;
  asset: RuntimePixelArtAsset;
  tags: CoverMood[];
  usage: number;
  favorite: boolean;
  excluded: boolean;
};

export type CoverStats = {
  usableCount?: number;
  usedCount?: number;
  favoriteCount?: number;
  excludedCount?: number;
  least?: CoverGalleryEntry | null;
  most?: CoverGalleryEntry | null;
};

export type CoverStudioProps = {
  ambientStyle?: CSSProperties;
  pixelArtBusy: boolean;
  selectedCoverSongs: CoverSong[];
  currentSong: CoverSong | null;
  missingCoverSongs?: CoverSong[];
  coverGalleryMood: CoverMood;
  coverMoodOptions: Array<{ id: CoverMood; name?: string; label?: string }>;
  coverMoodCounts: Map<CoverMood, number>;
  coverStats: CoverStats;
  filteredCoverGalleryAssets: CoverGalleryEntry[];
  coverPickerSongList: CoverSong[];
  coverSelectedSongIds: string[];
  CoverComponent: ComponentType<{ song: CoverSong | null; className: string }>;
  prettyTitle: (rawTitle: string, maxWords?: number) => string;
  prettyMeta: (text: string) => string;
  pixelArtUrl: (file: string) => string;
  coverMoodName: (mood: CoverMood) => string;
  setCoverGalleryMood: (mood: CoverMood) => void;
  randomizeSelectedCovers: (mood: CoverMood) => void | Promise<void>;
  randomizeMissingCovers?: () => void | Promise<void>;
  cleanupCoverCache?: () => void | Promise<void>;
  rescanPixelArtFolder: () => void | Promise<void>;
  selectCurrentSongForCovers: () => void;
  selectVisibleSongsForCovers: () => void;
  setCoverSelectedSongIds: Dispatch<SetStateAction<string[]>>;
  toggleCoverSongSelection: (songId: string) => void;
  applyCoverAssetToSelection: (asset: RuntimePixelArtAsset) => void | Promise<void>;
  togglePixelCoverFavorite?: (key: string) => void;
  togglePixelCoverExcluded: (key: string) => void;
};
