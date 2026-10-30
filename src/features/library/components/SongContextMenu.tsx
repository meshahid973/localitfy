import { Disc3, Heart, ListEnd, Pencil, Play, Plus, Radio, SkipForward, Tags, ThumbsDown, Trash2, UserRound, UserX } from "lucide-react";
import { Cover } from "../../covers/Cover";
import { prettyMeta, prettyTitle } from "../../search";
import { splitArtistCredits } from "../../artists/artistCredits";
import { hasArtistMark, type NotForMeKind, type NotForMeMarks } from "../../analysis/notForMe";
import type { Song, SongContextMenuState } from "../song.types";
import "./song-context-menu.css";

const MAX_ARTIST_LINKS = 3;

export type SongContextMenuProps = {
  state: SongContextMenuState | null;
  songsById: Map<string, Song>;
  onClose: () => void;
  selectSong: (songId: string, autoplay?: boolean) => unknown;
  queueSong: (songId: string, playNext?: boolean) => unknown;
  openSimilarSongs: (song: Song) => unknown;
  openEditor: (song: Song) => unknown;
  openPlaylistPicker: (song: Song) => unknown;
  toggleLike: (songId: string) => unknown;
  askRemoveSong: (songId: string) => unknown;
  goToArtist: (artistName: string) => unknown;
  goToAlbum: (song: Song) => unknown;
  /** Present while music analysis is on, since only recommendations use it. */
  notForMe?: { marks: NotForMeMarks; toggle: (kind: NotForMeKind, value: string) => unknown };
  /** Present while MusicBrainz tagging is on. */
  findOnMusicBrainz?: (song: Song) => unknown;
};

export default function SongContextMenu({
  state,
  songsById,
  onClose,
  selectSong,
  queueSong,
  openSimilarSongs,
  openEditor,
  openPlaylistPicker,
  toggleLike,
  askRemoveSong,
  goToArtist,
  goToAlbum,
  notForMe,
  findOnMusicBrainz
}: SongContextMenuProps) {
  if (!state) return null;
  const song = songsById.get(state.songId);
  if (!song) return null;
  const artistNames = splitArtistCredits(song.artist).slice(0, MAX_ARTIST_LINKS);
  const leadArtist = song.artist?.trim() ? artistNames[0] : "";

  return (
    <div className="songContextMenuLayer" onClick={onClose}>
      <div
        className="songContextMenu"
        style={{ left: state.x, top: state.y }}
        role="menu"
        aria-label="song actions"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="songContextMenuHead">
          <Cover song={song} className="songContextMenuCover" />
          <span>
            <strong>{prettyTitle(song.title, 6)}</strong>
            <small>{prettyMeta(song.artist)}</small>
          </span>
        </div>
        <button type="button" role="menuitem" onClick={() => { onClose(); void selectSong(song.id, true); }}>
          <span className="songContextMenuIcon"><Play size={13} strokeWidth={3} /></span> play now
        </button>
        <button type="button" role="menuitem" onClick={() => { onClose(); queueSong(song.id, true); }}>
          <span className="songContextMenuIcon"><SkipForward size={13} strokeWidth={3} /></span> play next
        </button>
        <button type="button" role="menuitem" onClick={() => { onClose(); openSimilarSongs(song); }}>
          <span className="songContextMenuIcon"><Radio size={13} strokeWidth={3} /></span> similar songs
        </button>
        <button type="button" role="menuitem" onClick={() => { onClose(); queueSong(song.id, false); }}>
          <span className="songContextMenuIcon"><ListEnd size={13} strokeWidth={3} /></span> add to queue
        </button>
        <div className="songContextMenuDivider" aria-hidden="true" />
        <button type="button" role="menuitem" onClick={() => { onClose(); openPlaylistPicker(song); }}>
          <span className="songContextMenuIcon"><Plus size={13} strokeWidth={3} /></span> add to playlist
        </button>
        <button type="button" role="menuitem" onClick={() => { onClose(); toggleLike(song.id); }}>
          <span className="songContextMenuIcon"><Heart size={13} strokeWidth={3} /></span> {song.liked ? "remove from liked songs" : "save to liked songs"}
        </button>
        {notForMe ? (
          <button type="button" role="menuitem" title="Left out of daily mixes, similar songs and song radio"
            onClick={() => { onClose(); notForMe.toggle("song", song.id); }}>
            <span className="songContextMenuIcon"><ThumbsDown size={13} strokeWidth={3} /></span> {notForMe.marks.songs.includes(song.id) ? "undo not for me" : "not for me"}
          </button>
        ) : null}
        {notForMe && leadArtist ? (
          <button type="button" role="menuitem" title={`${leadArtist} is left out of daily mixes, similar songs and song radio`}
            onClick={() => { onClose(); notForMe.toggle("artist", leadArtist); }}>
            <span className="songContextMenuIcon"><UserX size={13} strokeWidth={3} /></span> {hasArtistMark(notForMe.marks, leadArtist) ? "recommend this artist again" : "don't recommend this artist"}
          </button>
        ) : null}
        <div className="songContextMenuDivider" aria-hidden="true" />
        {artistNames.map((artistName) => (
          <button key={artistName} type="button" role="menuitem" onClick={() => { onClose(); goToArtist(artistName); }}>
            <span className="songContextMenuIcon"><UserRound size={13} strokeWidth={3} /></span> go to {artistNames.length > 1 ? prettyMeta(artistName) : "artist"}
          </button>
        ))}
        {song.album?.trim() ? (
          <button type="button" role="menuitem" onClick={() => { onClose(); goToAlbum(song); }}>
            <span className="songContextMenuIcon"><Disc3 size={13} strokeWidth={3} /></span> go to album
          </button>
        ) : null}
        <div className="songContextMenuDivider" aria-hidden="true" />
        <button type="button" role="menuitem" onClick={() => { onClose(); openEditor(song); }}>
          <span className="songContextMenuIcon"><Pencil size={13} strokeWidth={3} /></span> edit song data
        </button>
        {findOnMusicBrainz && song.filePath ? (
          <button type="button" role="menuitem" title="Search MusicBrainz and pick the right release for this song"
            onClick={() => { onClose(); findOnMusicBrainz(song); }}>
            <span className="songContextMenuIcon"><Tags size={13} strokeWidth={3} /></span> find on musicbrainz
          </button>
        ) : null}
        <button className="dangerMenuItem" type="button" role="menuitem" onClick={() => { onClose(); askRemoveSong(song.id); }}>
          <span className="songContextMenuIcon"><Trash2 size={13} strokeWidth={3} /></span> remove from library
        </button>
      </div>
    </div>
  );
}
