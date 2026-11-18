import { createContext, useContext, type MouseEvent as ReactMouseEvent } from "react";
import type { Song } from "../library/song.types";
import type { Playlist } from "../playlists/playlist.types";
import type { PageDetail, NavigationHistory } from "./useNavigationHistory";
import { artistDetailId } from "./useNavigationHistory";

/** Anything that opens as a page and plays as a whole: an artist, genre, playlist or daily mix. */
export type CollectionTarget = {
  kind: PageDetail["kind"];
  id: string;
  title: string;
  subtitle: string;
  songs: readonly Song[];
  coverSong: Song | null;
  playlist?: Playlist;
};

export type PlayCollectionOptions = { shuffle?: boolean; startId?: string };

/**
 * The same interactions on every page: clicking a collection opens its page, its play button plays it,
 * and right-click opens the same menu. Provided once by the app shell.
 */
export type AppActions = {
  nav: NavigationHistory;
  openCollection: (target: CollectionTarget) => void;
  playCollection: (target: CollectionTarget, options?: PlayCollectionOptions) => void;
  queueCollection: (target: CollectionTarget) => void;
  openCollectionMenu: (event: ReactMouseEvent<HTMLElement>, target: CollectionTarget) => void;
  openSongMenu: (event: ReactMouseEvent<HTMLElement>, song: Song) => unknown;
};

export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppActions() {
  const actions = useContext(AppActionsContext);
  if (!actions) throw new Error("useAppActions needs the app shell");
  return actions;
}

export const playableIds = (songs: readonly Song[]) => songs.filter((song) => song.fileExists !== false).map((song) => song.id);
export function firstCover(songs: readonly Song[]): Song | null {
  let best: Song | null = null;
  for (const song of songs) {
    if (!song.coverUrl && !song.coverPath && !song.coverThumbnailUrl && !song.coverThumbUrl && !song.coverFullUrl && !song.thumbnailUrl) continue;
    if (!best || (Number(song.playCount) || 0) > (Number(best.playCount) || 0)) best = song;
  }
  return best ?? songs[0] ?? null;
}
const trackCount = (count: number) => `${count} track${count === 1 ? "" : "s"}`;

export function artistTarget(name: string, songs: readonly Song[]): CollectionTarget {
  return { kind: "artist", id: artistDetailId(name), title: name, subtitle: `artist · ${trackCount(songs.length)}`, songs, coverSong: firstCover(songs) };
}

export function genreTarget(name: string, songs: readonly Song[]): CollectionTarget {
  return { kind: "genre", id: name.toLocaleLowerCase(), title: name, subtitle: `genre · ${trackCount(songs.length)}`, songs, coverSong: firstCover(songs) };
}

export function playlistTarget(playlist: Playlist, songs: readonly Song[]): CollectionTarget {
  return { kind: "playlist", id: playlist.id, title: playlist.name, subtitle: `${playlist.rules ? "smart playlist" : "playlist"} · ${trackCount(songs.length)}`, songs, coverSong: firstCover(songs), playlist };
}

export function mixTarget(mix: { id: string; name: string }, songs: readonly Song[]): CollectionTarget {
  return { kind: "mix", id: mix.id, title: mix.name, subtitle: `daily mix · ${trackCount(songs.length)}`, songs, coverSong: firstCover(songs) };
}
