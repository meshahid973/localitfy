import { prettyTitle } from "../../search";
import { useModalFocus } from "../../../shared/hooks/useModalFocus";
import type { Song } from "../song.types";

export type DeleteSongModalProps = {
  song: Song | null;
  busy: boolean;
  onClose: () => void;
  removeSong: (songId: string) => unknown;
};

export default function DeleteSongModal({ song, busy, onClose, removeSong }: DeleteSongModalProps) {
  const dialogRef = useModalFocus(Boolean(song));
  if (!song) return null;
  return (
    <div className="modalWrap deleteModalWrap" onClick={() => !busy && onClose()}>
      <div ref={dialogRef} tabIndex={-1} className="deleteModal cartoonPop" role="alertdialog" aria-modal="true" aria-labelledby="delete-song-dialog-title" aria-describedby="delete-song-dialog-description" onClick={(event) => event.stopPropagation()}>
        <div className="deleteFace">:(</div>
        <p className="deleteTiny">remove from localtify</p>
        <h3 id="delete-song-dialog-title">remove <span>"{prettyTitle(song.title, 8)}"</span> from localtify?</h3>
        <p className="deleteSub" id="delete-song-dialog-description">this only removes it from your localtify library.<br />your real music file stays safe on your pc.</p>
        <div className="deleteActions">
          <button className="heroGhost" onClick={onClose} disabled={busy}>no keep it</button>
          <button className="dangerButton bigDanger" onClick={() => removeSong(song.id)} disabled={busy}>{busy ? "removing..." : "yes remove it"}</button>
        </div>
      </div>
    </div>
  );
}
