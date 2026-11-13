import { X } from "lucide-react";
import { useModalFocus } from "../../../shared/hooks/useModalFocus";
import { MascotStateArt } from "../../../shared/ui/LocaltifyViewUi";
import { displaySongPickerSublineV444, displaySongTitleV444 } from "../../library/components/SongRows";
import type { Song } from "../../library/song.types";
import type { Playlist } from "../playlist.types";
import PlaylistCoverCollage from "./PlaylistCoverCollage";

export type PlaylistPickerModalProps = {
  song: Song | null;
  name: string;
  setName: (value: string) => void;
  onClose: () => void;
  playlists: Playlist[];
  songsById: Map<string, Song>;
  addSongToPlaylist: (playlistId: string, songId: string) => unknown;
  createPlaylistWithSong: (songId: string, name: string) => unknown;
};

export default function PlaylistPickerModal({
  song, name, setName, onClose, playlists, songsById,
  addSongToPlaylist, createPlaylistWithSong
}: PlaylistPickerModalProps) {
  const dialogRef = useModalFocus(Boolean(song));
  if (!song) return null;
  // Smart playlists fill themselves, so songs can't be added to them by hand.
  const manualPlaylists = playlists.filter((playlist) => !playlist.rules);
  return (
    <div className="modalWrap playlistPickerWrap" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className="playlistPickerModal playlistPickerModalV444" role="dialog" aria-modal="true" aria-label="Add song to playlist" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape" && !event.defaultPrevented) onClose(); }}>
        <div className="modalHead playlistPickerHead">
          <div>
            <p className="eyebrow">add to playlist</p>
            <h3>{displaySongTitleV444(song, 9)}</h3>
            <span className="editorHeadSub">{displaySongPickerSublineV444(song)}</span>
          </div>
          <button className="closeModalButton" type="button" onClick={onClose} aria-label="close"><X size={18} strokeWidth={2.4} /></button>
        </div>
        <div className="playlistPickerList">
          {manualPlaylists.length ? manualPlaylists.map((playlist) => {
            const added = playlist.songIds.includes(song.id);
            const previewSongs = playlist.songIds.slice(0, 4).map((songId) => songsById.get(songId)).filter((item): item is Song => Boolean(item));
            return (
              <button key={playlist.id} className={`playlistPickerItem ${added ? "active" : ""}`} type="button" disabled={added} onClick={() => addSongToPlaylist(playlist.id, song.id)}>
                <PlaylistCoverCollage songs={previewSongs} className="playlistPickerCollage playlistCoverCollage" />
                <span><strong>{playlist.name}</strong><small>{added ? "already added" : `${playlist.songIds.length} song${playlist.songIds.length === 1 ? "" : "s"}`}</small></span>
                <em>{added ? "added" : "add"}</em>
              </button>
            );
          }) : (
            <div className="playlistEmptyState playlistMascotEmptyV496">
              <MascotStateArt state="question" className="playlistEmptyMascotV496" />
              <span className="mascotEmptyCopyV496"><strong>No playlists yet</strong><p>Make one below and this song will be added right away.</p></span>
            </div>
          )}
        </div>
        <form className="playlistPickerCreate" onSubmit={(event) => { event.preventDefault(); if (name.trim()) createPlaylistWithSong(song.id, name); }}>
          <input value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="new playlist name" aria-label="New playlist name" />
          <button className="mainAction" type="submit" disabled={!name.trim()}>create and add</button>
        </form>
      </div>
    </div>
  );
}
