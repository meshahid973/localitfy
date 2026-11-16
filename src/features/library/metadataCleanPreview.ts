import { smartSongMetadata } from "../search";
import type { MetadataCleanPreview, Song } from "./song.types";

/** Prepare a read-only preview. Only changed rows are retained; no full-record
 * sanitation, extra filter passes or intermediate previews for unchanged songs.
 */
export function createMetadataCleanPreview(songs: Song[], coverSelectedSongIds: string[], scope: "all" | "selected" = "all"): MetadataCleanPreview {
  const selectedIds = scope === "selected" && coverSelectedSongIds.length ? new Set(coverSelectedSongIds) : null;
  const items: MetadataCleanPreview["items"] = [];
  let totalCount = 0, titleFixCount = 0, artistFixCount = 0, albumFixCount = 0;
  for (const song of songs) {
    if (selectedIds && !selectedIds.has(song.id)) continue;
    totalCount++;
    // Repair preview historically uses sanitizeSongRecord(song, 0)'s metadata.
    // Compute those same fields without allocating unrelated playback properties.
    const repair = smartSongMetadata(song, 0);
    const patch: Partial<Pick<Song, "title" | "artist" | "album">> = {};
    if (repair.title !== song.title) { patch.title = repair.title; titleFixCount++; }
    if (repair.artist !== song.artist) { patch.artist = repair.artist; artistFixCount++; }
    if (repair.album !== song.album) { patch.album = repair.album; albumFixCount++; }
    const fields = Object.keys(patch);
    if (!fields.length) continue;
    items.push({
      id: song.id,
      before: { title: song.title, artist: song.artist, album: song.album },
      after: { title: patch.title ?? song.title, artist: patch.artist ?? song.artist, album: patch.album ?? song.album },
      patch, fields
    });
  }
  return {
    id: Date.now(), scope, totalCount, changedCount: items.length, skippedCount: totalCount - items.length,
    titleFixCount, artistFixCount, albumFixCount, items
  };
}
