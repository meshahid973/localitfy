import type { CoverGalleryEntry, CoverMood, CoverSong } from "./cover.types";

export function chunkItems<T>(items: T[], size: number) {
  const safeSize = Math.max(1, size);
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += safeSize) output.push(items.slice(index, index + safeSize));
  return output;
}

export function normalizeCoverSearch(value: string) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function coverEntryMatches(entry: CoverGalleryEntry, query: string, coverMoodName: (mood: CoverMood) => string) {
  if (!query) return true;
  const tagText = entry.tags.map(coverMoodName).join(" ");
  return [entry.asset.label, entry.asset.file, entry.asset.discordKey, tagText, entry.excluded ? "hidden excluded" : "visible", `${entry.usage} uses`].join(" ").toLowerCase().includes(query);
}

export function coverSongMatches(song: CoverSong, query: string) {
  if (!query) return true;
  return [song.title, song.artist, song.album, song.filePath, song.id].filter(Boolean).join(" ").toLowerCase().includes(query);
}
