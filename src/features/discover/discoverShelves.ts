import type { DiscoverArtist, DiscoverTrack } from "./discover.types";

const normalized = (text: string) => text.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const identity = (track: DiscoverTrack) => JSON.stringify([normalized(track.artist), normalized(track.title)]);

/** Preserve each artist's ranking while avoiding consecutive artist blocks.
 * Do not collapse differently titled versions/remixes. */
function interleave(groups: readonly (readonly DiscoverTrack[])[], seen: Set<string>): DiscoverTrack[] {
  const result: DiscoverTrack[] = [];
  const max = groups.reduce((length, group) => Math.max(length, group.length), 0);
  for (let rank = 0; rank < max; rank++) {
    for (const group of groups) {
      const track = group[rank];
      if (!track) continue;
      const key = identity(track);
      if (!normalized(track.title) || !normalized(track.artist) || seen.has(key)) continue;
      seen.add(key);
      result.push(track);
    }
  }
  return result;
}

export function buildDiscoverShelves(artists: readonly DiscoverArtist[], tracks: readonly DiscoverTrack[]) {
  const seen = new Set<string>();
  const recommended = interleave(artists.map(artist => artist.topTracks), seen);
  const byArtist = new Map<string, DiscoverTrack[]>();
  for (const track of tracks) {
    const key = normalized(track.artist);
    const group = byArtist.get(key) ?? [];
    group.push(track);
    byArtist.set(key, group);
  }
  return { recommended, popular: interleave([...byArtist.values()], seen) };
}
