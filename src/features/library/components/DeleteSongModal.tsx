import { prettyTitle } from "../../search";
import type { Song } from "../song.types";

type DeleteSongModalProps = {
  song: Song | null;
  busy: boolean;
  onClose: () => void;
  removeSong: (songId: string) => unknown;
};

export default function DeleteSongModal({ song, busy, onClose, removeSong }: DeleteSongModalProps) {
  if (!song) return null;
  return (
    <div className="modalWrap deleteModalWrap" onClick={() => !busy && onClose()}>
      <div className="deleteModal cartoonPop" onClick={(event) => event.stopPropagation()}>
        <div className="deleteFace">:(</div>
        <p className="deleteTiny">remove from localtify</p>
        <h3>do you really wanna delete<span>"{prettyTitle(song.title, 8)}"</span>from localtify?</h3>
        <p className="deleteSub">this only removes it from your localtify library.<br />your real music file stays safe on your pc.</p>
        <div className="deleteActions">
          <button className="heroGhost" onClick={onClose} disabled={busy}>no keep it</button>
          <button className="dangerButton bigDanger" onClick={() => removeSong(song.id)} disabled={busy}>{busy ? "removing..." : "yes remove it"}</button>
        </div>
      </div>
    </div>
  );
}
