import type { Song } from "./song.types";
import { prettyMeta, prettyTitle } from "../search/search.utils";
type TrackTags = Pick<Song, "title" | "artist">;
export function displaySongTitleV444(song: TrackTags, maxWords = 7) { return prettyTitle(song.title, maxWords); }
export function displaySongArtistV444(song: TrackTags) { return prettyMeta(song.artist); }
export function displaySongPickerSublineV444(song: TrackTags) {
  const artist = displaySongArtistV444(song);
  return !artist || artist === "unknown artist" ? "Pick a playlist or make a new one." : `${artist} · Pick a playlist or make a new one.`;
}
