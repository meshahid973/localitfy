import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Download, X } from "lucide-react";
import type { SpotifyTrack } from "../downloads/download.types";
import { formatTime } from "../../shared/utils/format";
import type { AlbumTracks, AlbumTracksRequest } from "./tagging.types";
import { Spinner, errorText, plural } from "./tagging.shared";
import "./tagging.css";

export type AlbumTracksDialogProps = {
  /** What to look up, and what to call it while loading ("Midwest Princess", "Lil Bit"). */
  request: AlbumTracksRequest & { label: string };
  /** Opens Downloads with these songs selected, ready to download. */
  sendToDownloads: (tracks: SpotifyTrack[]) => unknown;
  onClose: () => void;
};

const editionLine = (edition: AlbumTracks["editions"][number]) => [edition.note, edition.year, edition.format, edition.country, plural(edition.trackCount, "track")].filter(Boolean).join(" · ");

/**
 * "Complete album": the album's full track list from MusicBrainz, with the songs you already have
 * ticked off, so the rest can go to Downloads with the album name filled in.
 */
export default function AlbumTracksDialog({ request, sendToDownloads, onClose }: AlbumTracksDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<AlbumTracks | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  async function load(next: AlbumTracksRequest, label: string) {
    setBusy(`Finding the album for ${label}…`); setMessage("");
    try {
      const result = await window.localitfy.getMusicBrainzAlbumTracks(next);
      if (!result) { setMessage("MusicBrainz doesn’t know which album this is from."); return; }
      setData(result);
      setSelected(new Set(result.tracks.filter((track) => !track.songId).map((track) => track.id)));
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  // Opening the dialog is the request, so the lookup runs straight away.
  useEffect(() => { void Promise.resolve().then(() => load(request, request.label)); }, []);

  function download() {
    if (!data) return;
    const tracks = data.tracks.filter((track) => selected.has(track.id)).map((track): SpotifyTrack => ({
      // Downloads use the ID in file names, so it stays short and stable.
      id: `mb-${track.recordingId || track.id}`, title: track.title, artist: track.artist, albumName: data.release.title,
      durationMs: track.durationMs, duration: Math.round(track.durationMs / 1000)
    }));
    sendToDownloads(tracks);
    onClose();
  }

  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const owned = data ? data.tracks.filter((track) => track.songId).length : 0;
  const discs = data ? new Set(data.tracks.map((track) => track.disc)).size : 0;
  const otherEditions = data ? data.editions.filter((edition) => edition.id !== data.release.id) : [];

  return <dialog ref={dialogRef} className="tagSearchDialog" aria-labelledby="album-tracks-title" aria-modal="true"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <section className="tagSearchContent">
      <header className="tagSearchHeader">
        {data?.coverUrl ? <img className="tagSearchCover" src={data.coverUrl} alt="" /> : <span className="tagSearchCover taggingNoCover" aria-hidden="true" />}
        <div className="tagSearchHeading">
          <p className="tagSearchEyebrow">Complete album</p>
          <h2 id="album-tracks-title">{data?.release.title || request.label}</h2>
          {data ? <p>{[data.release.artist, data.release.note, data.release.year, data.release.releaseType].filter(Boolean).join(" · ")}</p> : null}
        </div>
        <button type="button" className="tagSearchClose" onClick={onClose} disabled={Boolean(busy)} aria-label="Close"><X size={20} /></button>
      </header>

      {busy || message ? <p className={busy ? "taggingStatus working" : "taggingStatus"} role="status" aria-live="polite">{busy ? <Spinner /> : null}{busy || message}</p> : null}

      {data ? <>
        <div className="albumTracksSummary">
          <span>{data.release.releaseType === "single" ? "MusicBrainz only knows this song from a single, not an album. " : ""}
            {owned === data.tracks.length ? `You have all ${plural(data.tracks.length, "song")}.` : `You have ${owned} of ${plural(data.tracks.length, "song")}.`}</span>
          <button type="button" className="tagSearchButton primary" disabled={Boolean(busy) || !selected.size} onClick={download}><Download size={14} /> Download {plural(selected.size, "song")}</button>
        </div>
        {otherEditions.length ? <details className="albumTracksEditions">
          <summary>Other editions ({otherEditions.length})</summary>
          <ul>{otherEditions.map((edition) => <li key={edition.id}>
            <button type="button" disabled={Boolean(busy)} onClick={() => void load({ releaseId: edition.id }, edition.title)}>
              <strong>{edition.title}</strong><small>{editionLine(edition)}</small>
            </button>
          </li>)}</ul>
        </details> : null}
        <ul className="albumTracksList" aria-label="Album tracks">{data.tracks.map((track) => <li key={track.id} className={track.songId ? "owned" : ""}>
          <label>
            {track.songId ? <span className="albumTracksOwned" title="Already in your library"><Check size={14} /></span>
              : <input type="checkbox" checked={selected.has(track.id)} onChange={() => toggle(track.id)} disabled={Boolean(busy)} />}
            <span className="albumTracksNumber">{discs > 1 ? `${track.disc}-` : ""}{track.position}</span>
            <span className="tagSearchResultText"><strong>{track.title}{track.artist !== data.release.artist ? <small>{track.artist}</small> : null}</strong>{track.songId ? <small>in your library</small> : null}</span>
            {track.durationMs ? <span className="tagSearchLength">{formatTime(track.durationMs / 1000)}</span> : null}
          </label>
        </li>)}</ul>
      </> : null}
    </section>
  </dialog>;
}
