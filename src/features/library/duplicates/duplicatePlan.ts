import type { DuplicateMerge, DuplicateSet } from "./duplicates.types";

/** What the user picked for each set: a copy (album sets) or a song (single-track sets). Unlisted sets are skipped. */
export type DuplicateChoices = Map<string, string>;

/** The copy or song each set keeps by default. */
export function defaultChoices(sets: readonly DuplicateSet[]): DuplicateChoices {
  return new Map(sets.filter((set) => set.groups.every((group) => group.confidence !== "metadata"))
    .map((set) => [set.id, set.kind === "album" ? set.recommendedCopy : set.groups[0].keepId]));
}

/**
 * One merge per duplicate group. In an album set every track keeps its song from the chosen copy, so one whole
 * copy survives; a track the chosen copy lacks keeps its best-ranked song instead.
 */
export function buildMerges(sets: readonly DuplicateSet[], choices: DuplicateChoices): DuplicateMerge[] {
  const merges: DuplicateMerge[] = [];
  for (const set of sets) {
    const choice = choices.get(set.id);
    if (!choice) continue;
    for (const group of set.groups) {
      const keep = group.songs.find((song) => song.id === choice || song.copyKey === choice) || group.songs[0];
      merges.push({ keepId: keep.id, removeIds: group.songs.filter((song) => song.id !== keep.id).map((song) => song.id) });
    }
  }
  return merges;
}

/** Replace removed song IDs with the kept ones, dropping repeats (playlists, queue, manual albums). */
export function remapSongIds(ids: readonly string[], keptFor: ReadonlyMap<string, string>) {
  return [...new Set(ids.map((id) => keptFor.get(id) || id))];
}

export function keptForRemoved(merges: readonly DuplicateMerge[]) {
  return new Map(merges.flatMap((merge) => merge.removeIds.map((id) => [id, merge.keepId] as const)));
}
