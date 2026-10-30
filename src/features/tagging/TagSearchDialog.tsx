import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Search, X } from "lucide-react";
import { Cover } from "../covers/Cover";
import type { Song } from "../library/song.types";
import { formatTime } from "../../shared/utils/format";
import type { TagProposal, TagSearchResult } from "./tagging.types";
import { Spinner, describeChanges, errorText, plural } from "./tagging.shared";
import "./tagging.css";

export type TagSearchDialogProps = { song: Song; onClose: () => void };

const releaseLine = (row: TagSearchResult) => [row.album, row.year, row.releaseType.toLowerCase(), row.country, row.trackCount ? plural(row.trackCount, "track") : ""].filter(Boolean).join(" · ");

/**
 * Right-click → "find on MusicBrainz": search by hand, pick the right release, review, save.
 * For songs the automatic lookup (or an earlier Picard run) matched to the wrong recording.
 */
export default function TagSearchDialog({ song, onClose }: TagSearchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(song.title || "");
  const [artist, setArtist] = useState(song.artist || "");
  const [results, setResults] = useState<TagSearchResult[] | null>(null);
  const [proposal, setProposal] = useState<TagProposal | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  async function search() {
    if (!title.trim()) return;
    setBusy("Searching MusicBrainz…"); setMessage(""); setProposal(null);
    try {
      const next = await window.localitfy.searchMusicBrainz(song.id, title.trim(), artist.trim());
      setResults(next);
      if (!next.length) setMessage("Nothing found. Try a shorter title or leave the artist empty.");
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  // Opening the dialog is the request, so the first search runs straight away.
  useEffect(() => { void Promise.resolve().then(search); }, []);

  async function choose(row: TagSearchResult) {
    setBusy(`Getting ${row.album}…`); setMessage("");
    try { setProposal(await window.localitfy.chooseMusicBrainzMatch(song.id, row.recordingId, row.releaseId)); }
    catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  async function save() {
    if (!proposal) return;
    setBusy("Saving tags…"); setMessage("");
    try {
      const result = await window.localitfy.applyMusicBrainzTags([song.id]);
      if (result.failed.length) { setMessage(`Could not update this song: ${result.failed[0].error}.`); return; }
      setSaved(true);
      setMessage(result.written ? "Saved. The tags are in the file now and the original is in the Trash." : "Saved to your library.");
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  const { tags } = proposal || {};
  return <dialog ref={dialogRef} className="tagSearchDialog" aria-labelledby="tag-search-title" aria-modal="true"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <section className="tagSearchContent">
      <header className="tagSearchHeader">
        <Cover song={song} className="tagSearchCover" />
        <div className="tagSearchHeading">
          <p className="tagSearchEyebrow">Find on MusicBrainz</p>
          <h2 id="tag-search-title">{song.title}</h2>
          <p>{[song.artist, song.album, song.duration ? `your file is ${formatTime(song.duration)}` : ""].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" className="tagSearchClose" onClick={onClose} disabled={Boolean(busy)} aria-label="Close"><X size={20} /></button>
      </header>

      {proposal && tags ? <div className="tagSearchChosen">
        <div className="tagSearchChosenRow">
          {proposal.coverUrl ? <img src={proposal.coverUrl} alt="" /> : <span className="taggingNoCover" aria-hidden="true" />}
          <span className="taggingProposalText">
            <strong>{tags.title} <small>{tags.artist}</small></strong>
            <small>{[tags.album + (tags.year ? ` (${tags.year})` : ""), tags.trackNumber ? `track ${tags.trackNumber}${tags.trackTotal ? ` of ${tags.trackTotal}` : ""}` : "", tags.genre].filter(Boolean).join(" · ")}</small>
            <small className="taggingChanges">{describeChanges(proposal)}</small>
          </span>
        </div>
        <div className="tagSearchActions">
          {saved ? <button type="button" className="tagSearchButton primary" onClick={onClose}>Done</button> : <>
            <button type="button" className="tagSearchButton" disabled={Boolean(busy)} onClick={() => { setProposal(null); setMessage(""); }}><ArrowLeft size={14} /> Back to results</button>
            <button type="button" className="tagSearchButton primary" disabled={Boolean(busy)} onClick={() => void save()}><Check size={14} /> Save tags</button>
          </>}
        </div>
      </div> : <form className="tagSearchForm" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} disabled={Boolean(busy)} /></label>
        <label><span>Artist</span><input value={artist} onChange={(event) => setArtist(event.target.value)} disabled={Boolean(busy)} placeholder="any artist" /></label>
        <button type="submit" className="tagSearchButton" disabled={Boolean(busy) || !title.trim()}><Search size={14} /> Search</button>
      </form>}

      {busy || message ? <p className={busy ? "taggingStatus working" : "taggingStatus"} role="status" aria-live="polite">{busy ? <Spinner /> : null}{busy || message}</p> : null}

      {!proposal && results?.length ? <ul className="tagSearchResults" aria-label="MusicBrainz results">{results.map((row) => <li key={`${row.recordingId}:${row.releaseId}`}>
        <button type="button" disabled={Boolean(busy)} onClick={() => void choose(row)}>
          <span className="tagSearchResultText"><strong>{row.title} <small>{row.artist}</small></strong><small>{releaseLine(row)}</small></span>
          {row.durationMs ? <span className="tagSearchLength">{formatTime(row.durationMs / 1000)}</span> : null}
          <span className={row.score >= 0.8 ? "taggingScore" : "taggingScore low"} title="How closely title, artist and length match your search">{Math.round(row.score * 100)}%</span>
        </button>
      </li>)}</ul> : null}
    </section>
  </dialog>;
}
