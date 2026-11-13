import { makeLocalId } from "../../shared/storage/localStorage";
import { cleanSongOrderIds } from "../library/library.utils";
import type { Playlist } from "./playlist.types";
import { cleanSmartRules } from "./smartPlaylist";

export function cleanPlaylistList(value: unknown, validIds?: Set<string>): Playlist[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: Playlist[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const source = item as Partial<Playlist>;
    const id = String(source.id || makeLocalId("playlist")).trim();
    const name = String(source.name || `playlist ${index + 1}`).trim().slice(0, 120) || `playlist ${index + 1}`;
    if (!id || seen.has(id)) return;
    seen.add(id);
    const rules = cleanSmartRules(source.rules);
    output.push({
      id,
      name,
      songIds: cleanSongOrderIds(source.songIds, validIds),
      createdAt: Number.isFinite(Number(source.createdAt)) && Number(source.createdAt) > 0
        ? Number(source.createdAt)
        : Date.now(),
      ...(rules ? { rules } : {})
    });
  });

  return output;
}
