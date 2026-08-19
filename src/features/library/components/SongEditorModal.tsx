import { useEffect } from "react";
import { Heart, HeartOff, ImagePlus, Save, Shuffle, Trash2, X } from "lucide-react";
import { Cover } from "../../covers/Cover";
import { formatTime } from "../../../shared/utils/format";
import type { Playlist } from "../../playlists/playlist.types";
import type { Song } from "../song.types";

export type SongEditorModalProps = {
  song: Song | null;
  onClose: () => void;
  pixelArtBusy: boolean;
  randomizeCover: () => unknown;
  pickCover: () => unknown;
  editTitle: string;
  setEditTitle: (value: string) => void;
  editArtist: string;
  setEditArtist: (value: string) => void;
  editAlbum: string;
  setEditAlbum: (value: string) => void;
  playlists: Playlist[];
  toggleSongPlaylist: (playlistId: string, songId: string) => unknown;
  toggleLike: (songId: string) => unknown;
  askRemoveSong: (songId: string) => unknown;
  saveEditor: () => unknown;
};

export default function SongEditorModal(props: SongEditorModalProps) {
  const { song } = props;
  useEffect(() => {
    document.body.classList.toggle("localtifyEditorModalOpen", Boolean(song));
    return () => document.body.classList.remove("localtifyEditorModalOpen");
  }, [song]);

  if (!song) return null;
  const {
    onClose, pixelArtBusy, randomizeCover, pickCover,
    editTitle, setEditTitle, editArtist, setEditArtist, editAlbum, setEditAlbum,
    playlists, toggleSongPlaylist, toggleLike, askRemoveSong, saveEditor
  } = props;

  return (
    <div className="modalWrap editorModalWrap" onClick={onClose}>
      <div className="editorModal editorModalMotion" onClick={(event) => event.stopPropagation()}>
        <div className="modalHead editorModalHead">
          <div>
            <p className="eyebrow">song details</p>
            <h3>edit track</h3>
            <span className="editorHeadSub">change the name, cover, and details for this song.</span>
          </div>
          <div className="editorHeaderActions">
            <button className="closeModalButton editorCloseButton" type="button" onClick={onClose} aria-label="Close edit track dialog">
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
        <div className="editorGrid editorGridBetter">
          <aside className="editorCoverBlock editorCoverBlockBetter">
            <div className="editorCoverShell"><Cover song={song} className="editorCover" /></div>
            <div className="editorCoverActions editorCoverActionsBetterV039">
              <button className="softButton editorIconButton" disabled={pixelArtBusy} onClick={randomizeCover}>
                <Shuffle size={15} strokeWidth={2.4} /><span>random pixel art</span>
              </button>
              <button className="softButton editorIconButton" disabled={pixelArtBusy} onClick={pickCover}>
                <ImagePlus size={15} strokeWidth={2.4} /><span>choose image from pc</span>
              </button>
            </div>
            <div className="editorMiniStats" aria-label="song quick stats">
              <span><strong>{formatTime(song.duration || 0)}</strong><small>duration</small></span>
              <span><strong>{song.playCount || 0}</strong><small>plays</small></span>
            </div>
          </aside>
          <div className="editorFields editorFieldsBetter">
            <section className="editorCard editorFormCard">
              <div className="editorSectionTitle"><strong>metadata</strong><span>what shows inside the app</span></div>
              <div className="editorLabelGrid">
                <label><span>title</span><input value={editTitle} onChange={(event) => setEditTitle(event.currentTarget.value)} /></label>
                <label><span>artist</span><input value={editArtist} onChange={(event) => setEditArtist(event.currentTarget.value)} placeholder="coderpixel / artist name" /></label>
                <label><span>album</span><input value={editAlbum} onChange={(event) => setEditAlbum(event.currentTarget.value)} /></label>
              </div>
            </section>
            <section className="editorCard editorPlaylistCard">
              <div className="editorSectionTitle"><strong>playlists</strong><span>add this song to one of your mixes</span></div>
              {playlists.length ? (
                <div className="editorPlaylistChips">
                  {playlists.map((playlist) => {
                    const added = playlist.songIds.includes(song.id);
                    return <button key={playlist.id} className={`editorPlaylistChip ${added ? "active" : ""}`} type="button" onClick={() => toggleSongPlaylist(playlist.id, song.id)}>{playlist.name}</button>;
                  })}
                </div>
              ) : <p className="settingsHintText">No playlists yet. Create one from the playlists page or the + button on a song.</p>}
            </section>
            <div className="editorActions editorActionsBetter">
              <button className="softButton editorIconButton" onClick={() => toggleLike(song.id)}>
                {song.liked ? <HeartOff size={15} strokeWidth={2.4} /> : <Heart size={15} strokeWidth={2.4} />}<span>{song.liked ? "unlike" : "like"}</span>
              </button>
              <button className="dangerButton editorIconButton" onClick={() => askRemoveSong(song.id)}><Trash2 size={15} strokeWidth={2.4} /><span>remove song</span></button>
              <button className="heroMain editorIconButton" onClick={saveEditor}><Save size={15} strokeWidth={2.4} /><span>save changes</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
