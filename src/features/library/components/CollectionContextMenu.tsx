import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Disc3, ListEnd, ListMusic, ListPlus, Pencil, Play, Radio, Shuffle, Tags, UserRound } from "lucide-react";
import { Cover } from "../../covers/Cover";
import { prettyMeta, prettyTitle } from "../../search/search.utils";
import { splitArtistCredits } from "../../artists/artistCredits";
import { playableIds, type CollectionTarget, type PlayCollectionOptions } from "../../shell/appActions";
import type { LocalAlbumEntry } from "../../albums/album.types";
import "./song-context-menu.css";

const MAX_ARTIST_LINKS = 3;
const OPEN_LABELS: Record<CollectionTarget["kind"], string> = { album: "open album", artist: "open artist", genre: "open genre", playlist: "open playlist", mix: "open mix" };

export type CollectionContextMenuState = { target: CollectionTarget; x: number; y: number };

export type CollectionContextMenuProps = {
  state: CollectionContextMenuState | null;
  onClose: () => void;
  open: (target: CollectionTarget) => unknown;
  play: (target: CollectionTarget, options?: PlayCollectionOptions) => unknown;
  queue: (target: CollectionTarget) => unknown;
  goToArtist: (artistName: string) => unknown;
  findSimilar: (target: CollectionTarget) => unknown;
  /** Only albums you made yourself can be edited. */
  editAlbum?: (album: LocalAlbumEntry) => unknown;
  /** Present while MusicBrainz tagging is on. */
  findAlbumOnMusicBrainz?: (album: LocalAlbumEntry) => unknown;
  /** Lists the album's songs you don't have yet, to download. Present while MusicBrainz tagging is on. */
  completeAlbum?: (album: LocalAlbumEntry) => unknown;
};

/** Right-click menu for an album, artist, genre, playlist or mix; the same look and layer as the song menu. */
export default function CollectionContextMenu({ state, onClose, open, play, queue, goToArtist, findSimilar, editAlbum, findAlbumOnMusicBrainz, completeAlbum }: CollectionContextMenuProps) {
  const isOpen = Boolean(state);
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onClose]);

  if (!state) return null;
  const { target } = state;
  const { album } = target;
  const ids = playableIds(target.songs);
  const artistNames = album && album.artist?.trim() ? splitArtistCredits(album.albumArtist || album.artist).slice(0, MAX_ARTIST_LINKS) : [];
  const editable = album && (album as { source?: string }).source === "manual" ? editAlbum : undefined;
  const run = (action: () => unknown) => () => { onClose(); void action(); };

  // Rendered into the app root: pages are transformed containers, so a fixed menu inside one would not open at the cursor.
  return createPortal(
    <div className="songContextMenuLayer" onClick={onClose} onContextMenu={(event) => { event.preventDefault(); onClose(); }}>
      <div className="songContextMenu" style={{ left: state.x, top: state.y }} role="menu" aria-label={`${target.kind} actions`} onClick={(event) => event.stopPropagation()}>
        <div className="songContextMenuHead">
          <Cover song={target.coverSong} className="songContextMenuCover" />
          <span>
            <strong>{prettyTitle(target.title, 6)}</strong>
            <small>{prettyMeta(target.subtitle)}</small>
          </span>
        </div>
        <button type="button" role="menuitem" onClick={run(() => open(target))}>
          <span className="songContextMenuIcon">{target.kind === "album" ? <Disc3 size={13} strokeWidth={3} /> : target.kind === "artist" ? <UserRound size={13} strokeWidth={3} /> : <ListMusic size={13} strokeWidth={3} />}</span> {OPEN_LABELS[target.kind]}
        </button>
        <button type="button" role="menuitem" disabled={!ids.length} onClick={run(() => play(target))}>
          <span className="songContextMenuIcon"><Play size={13} strokeWidth={3} /></span> play
        </button>
        <button type="button" role="menuitem" disabled={ids.length < 2} onClick={run(() => play(target, { shuffle: true }))}>
          <span className="songContextMenuIcon"><Shuffle size={13} strokeWidth={3} /></span> shuffle
        </button>
        <button type="button" role="menuitem" disabled={!ids.length} onClick={run(() => queue(target))}>
          <span className="songContextMenuIcon"><ListEnd size={13} strokeWidth={3} /></span> add to queue
        </button>
        <button type="button" role="menuitem" disabled={!ids.length} onClick={run(() => findSimilar(target))}>
          <span className="songContextMenuIcon"><Radio size={13} strokeWidth={3} /></span> similar songs
        </button>
        {artistNames.length ? <div className="songContextMenuDivider" aria-hidden="true" /> : null}
        {artistNames.map((artistName) => (
          <button key={artistName} type="button" role="menuitem" onClick={run(() => goToArtist(artistName))}>
            <span className="songContextMenuIcon"><UserRound size={13} strokeWidth={3} /></span> go to {artistNames.length > 1 ? prettyMeta(artistName) : "artist"}
          </button>
        ))}
        {album && (editable || findAlbumOnMusicBrainz || completeAlbum) ? <div className="songContextMenuDivider" aria-hidden="true" /> : null}
        {album && editable ? <button type="button" role="menuitem" onClick={run(() => editable(album))}>
          <span className="songContextMenuIcon"><Pencil size={13} strokeWidth={3} /></span> edit album
        </button> : null}
        {album && completeAlbum ? <button type="button" role="menuitem" title="Find this album's other songs and download the ones you don't have"
          onClick={run(() => completeAlbum(album))}>
          <span className="songContextMenuIcon"><ListPlus size={13} strokeWidth={3} /></span> complete album
        </button> : null}
        {album && findAlbumOnMusicBrainz ? <button type="button" role="menuitem" disabled={!album.songs.some((song) => song.filePath)} title="Search MusicBrainz and match the whole album to one release"
          onClick={run(() => findAlbumOnMusicBrainz(album))}>
          <span className="songContextMenuIcon"><Tags size={13} strokeWidth={3} /></span> find on musicbrainz
        </button> : null}
      </div>
    </div>,
    document.querySelector(".app") || document.body
  );
}
