import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Disc3, ListEnd, ListPlus, Pencil, Play, Shuffle, Tags, UserRound } from "lucide-react";
import { Cover } from "../covers/Cover";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import { splitArtistCredits } from "../artists/artistCredits";
import type { LocalAlbumEntry } from "./album.types";

const MAX_ARTIST_LINKS = 3;

export type AlbumContextMenuState = { album: LocalAlbumEntry; x: number; y: number; trigger: HTMLButtonElement };

export type AlbumContextMenuProps = {
  state: AlbumContextMenuState | null;
  onClose: () => void;
  openAlbum: (album: LocalAlbumEntry, trigger: HTMLButtonElement) => unknown;
  playSongs?: (ids: string[], label: string) => unknown;
  shuffleSongs?: (ids: string[], label: string) => unknown;
  queueSongs?: (ids: string[], label: string) => unknown;
  goToArtist?: (artistName: string) => unknown;
  /** Only albums you made yourself can be edited. */
  editAlbum?: (album: LocalAlbumEntry) => unknown;
  /** Present while MusicBrainz tagging is on. */
  findOnMusicBrainz?: (album: LocalAlbumEntry) => unknown;
  /** Lists the album's songs you don't have yet, to download. Present while MusicBrainz tagging is on. */
  completeAlbum?: (album: LocalAlbumEntry) => unknown;
};

/** Right-click menu for an album card; the same look and layer as the song menu. */
export default function AlbumContextMenu({ state, onClose, openAlbum, playSongs, shuffleSongs, queueSongs, goToArtist, editAlbum, findOnMusicBrainz, completeAlbum }: AlbumContextMenuProps) {
  const open = Boolean(state);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!state) return null;
  const { album } = state;
  const ids = album.songs.filter((song) => song.fileExists !== false).map((song) => song.id);
  const artistNames = goToArtist && album.artist?.trim() ? splitArtistCredits(album.albumArtist || album.artist).slice(0, MAX_ARTIST_LINKS) : [];
  const run = (action: () => unknown) => () => { onClose(); void action(); };

  // Rendered into the app root, like the album drawer: the albums page is a transformed
  // container, so a fixed menu inside it would not open at the cursor.
  return createPortal(
    <div className="songContextMenuLayer" onClick={onClose} onContextMenu={(event) => { event.preventDefault(); onClose(); }}>
      <div className="songContextMenu" style={{ left: state.x, top: state.y }} role="menu" aria-label="album actions" onClick={(event) => event.stopPropagation()}>
        <div className="songContextMenuHead">
          <Cover song={album.coverSong} className="songContextMenuCover" />
          <span>
            <strong>{prettyTitle(album.title, 6)}</strong>
            <small>{prettyMeta(album.artist)}</small>
          </span>
        </div>
        <button type="button" role="menuitem" onClick={run(() => openAlbum(album, state.trigger))}>
          <span className="songContextMenuIcon"><Disc3 size={13} strokeWidth={3} /></span> open album
        </button>
        {playSongs ? <button type="button" role="menuitem" disabled={!ids.length} onClick={run(() => playSongs(ids, album.title))}>
          <span className="songContextMenuIcon"><Play size={13} strokeWidth={3} /></span> play
        </button> : null}
        {shuffleSongs ? <button type="button" role="menuitem" disabled={ids.length < 2} onClick={run(() => shuffleSongs(ids, album.title))}>
          <span className="songContextMenuIcon"><Shuffle size={13} strokeWidth={3} /></span> shuffle
        </button> : null}
        {queueSongs ? <button type="button" role="menuitem" disabled={!ids.length} onClick={run(() => queueSongs(ids, album.title))}>
          <span className="songContextMenuIcon"><ListEnd size={13} strokeWidth={3} /></span> add to queue
        </button> : null}
        {artistNames.length ? <div className="songContextMenuDivider" aria-hidden="true" /> : null}
        {artistNames.map((artistName) => (
          <button key={artistName} type="button" role="menuitem" onClick={run(() => goToArtist?.(artistName))}>
            <span className="songContextMenuIcon"><UserRound size={13} strokeWidth={3} /></span> go to {artistNames.length > 1 ? prettyMeta(artistName) : "artist"}
          </button>
        ))}
        {editAlbum || findOnMusicBrainz || completeAlbum ? <div className="songContextMenuDivider" aria-hidden="true" /> : null}
        {editAlbum ? <button type="button" role="menuitem" onClick={run(() => editAlbum(album))}>
          <span className="songContextMenuIcon"><Pencil size={13} strokeWidth={3} /></span> edit album
        </button> : null}
        {completeAlbum ? <button type="button" role="menuitem" title="Find this album's other songs and download the ones you don't have"
          onClick={run(() => completeAlbum(album))}>
          <span className="songContextMenuIcon"><ListPlus size={13} strokeWidth={3} /></span> complete album
        </button> : null}
        {findOnMusicBrainz ? <button type="button" role="menuitem" disabled={!album.songs.some((song) => song.filePath)} title="Search MusicBrainz and match the whole album to one release"
          onClick={run(() => findOnMusicBrainz(album))}>
          <span className="songContextMenuIcon"><Tags size={13} strokeWidth={3} /></span> find on musicbrainz
        </button> : null}
      </div>
    </div>,
    document.querySelector(".app") || document.body
  );
}
