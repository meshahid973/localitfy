import type { ReactNode } from "react";
import type { Song } from "./song.types";
import { displaySongTitleV444, displaySongArtistV444 } from "./trackDisplay";

/** Shared track copy; callers retain layout, artist links, actions and transport ownership. */
export function TrackMetadata({ song, className, subtitle, maxWords = 7 }: { song: Pick<Song, "title" | "artist">; className: string; subtitle?: ReactNode; maxWords?: number }) {
  return <span className={className}><strong title={song.title}>{displaySongTitleV444(song, maxWords)}</strong><small>{subtitle ?? displaySongArtistV444(song)}</small></span>;
}
