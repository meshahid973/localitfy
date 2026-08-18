import type { DragEvent } from "react";
import type { LibraryDropSide } from "./song.types";
export function readPlaylistDraggedSongId(event: DragEvent<HTMLElement>, fallbackSongId = "") {
  return event.dataTransfer.getData("text/localitfy-song-id") || event.dataTransfer.getData("text/plain") || fallbackSongId;
}
export function getPlaylistDropSide(event: DragEvent<HTMLElement>): LibraryDropSide {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}
