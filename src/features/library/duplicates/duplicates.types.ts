/** One file variant of an album (or loose folder): `U` as .m4a, `U` as .mp3, `U` as "(1).mp3". */
export type DuplicateCopy = {
  key: string; folder: string; album: string; extension: string; duplicateName: boolean; trackCount: number; kbps: number | null;
};
export type DuplicateGroup = {
  id: string;
  /** The copy the scan recommends keeping for this track. */
  keepId: string;
  songs: Array<{ id: string; copyKey: string; track: number | null }>;
  confidence: "same-audio" | "similar-audio" | "metadata";
};
/** Groups decided together: keeping one copy for every track avoids ending up with halves of two albums. */
export type DuplicateSet = { id: string; kind: "album" | "track"; recommendedCopy: string; copies: DuplicateCopy[]; groups: DuplicateGroup[] };
export type DuplicateMerge = { keepId: string; removeIds: string[] };
