import { useLayoutEffect, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { TagLookupResult } from "./tagging.types";
import { AUTO_SELECT, ProposalRow, Spinner, byTrack, errorText, plural } from "./tagging.shared";
import "./tagging.css";

export type DownloadTagDialogProps = {
  /** Library songs the finished download batch added. */
  songIds: string[];
  titleOf: (songId: string) => string;
  onClose: () => void;
};

/**
 * Asked when downloads finish: look the new songs up on MusicBrainz for proper tags, track
 * numbers and covers. Nothing goes online until you say yes, and nothing is saved before review.
 */
export default function DownloadTagDialog({ songIds, titleOf, onClose }: DownloadTagDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<TagLookupResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  async function lookUp() {
    setBusy(`Looking up ${plural(songIds.length, "song")} on MusicBrainz…`); setMessage("");
    try {
      const next = await window.localitfy.lookUpMusicBrainzTags(songIds);
      setResult(next);
      setSelected(new Set(next.proposals.filter((proposal) => proposal.confidence >= AUTO_SELECT).map((proposal) => proposal.songId)));
      if (!next.proposals.length) setMessage("MusicBrainz didn’t find these songs.");
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  async function save() {
    const ids = [...selected];
    setBusy(`Saving tags for ${plural(ids.length, "song")}…`); setMessage("");
    try {
      const applied = await window.localitfy.applyMusicBrainzTags(ids);
      const parts = [`Updated ${plural(applied.applied, "song")}${applied.written ? `, wrote tags into ${plural(applied.written, "file")} (originals are in the Trash)` : ""}.`];
      if (applied.failed.length) parts.push(`Could not update: ${applied.failed.map((failure) => `${failure.title} (${failure.error})`).join(", ")}.`);
      setSaved(!applied.failed.length);
      setSelected(new Set(applied.failed.map((failure) => failure.songId)));
      setMessage(parts.join(" "));
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  // Album by album, in track order.
  const proposals = result ? [...result.proposals].sort((a, b) => a.tags.album.localeCompare(b.tags.album) || byTrack(a, b)) : [];

  return <dialog ref={dialogRef} className="tagSearchDialog" aria-labelledby="download-tag-title" aria-modal="true"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <section className="tagSearchContent">
      <header className="tagSearchHeader">
        <div className="tagSearchHeading">
          <p className="tagSearchEyebrow">Downloads finished</p>
          <h2 id="download-tag-title">Get tags from MusicBrainz?</h2>
          <p>{result ? `${result.proposals.length} match${result.proposals.length === 1 ? "" : "es"} for ${plural(songIds.length, "downloaded song")}` : `Fill in album, track numbers, genre and cover art for ${plural(songIds.length, "downloaded song")}. You review every change before it’s saved.`}</p>
        </div>
        <button type="button" className="tagSearchClose" onClick={onClose} disabled={Boolean(busy)} aria-label="Close"><X size={20} /></button>
      </header>

      {!result ? <>
        <ul className="downloadTagSongs" aria-label="Downloaded songs">{songIds.slice(0, 8).map((id) => <li key={id}>{titleOf(id)}</li>)}
          {songIds.length > 8 ? <li>and {songIds.length - 8} more</li> : null}</ul>
        <div className="tagSearchActions">
          <button type="button" className="tagSearchButton" disabled={Boolean(busy)} onClick={onClose}>Not now</button>
          <button type="button" className="tagSearchButton primary" disabled={Boolean(busy)} onClick={() => void lookUp()}><Search size={14} /> Look up tags</button>
        </div>
      </> : <div className="tagSearchChosen">
        <div className="tagSearchActions">
          {saved ? <button type="button" className="tagSearchButton primary" onClick={onClose}>Done</button> : <>
            <button type="button" className="tagSearchButton" disabled={Boolean(busy)} onClick={onClose}>Not now</button>
            <button type="button" className="tagSearchButton primary" disabled={Boolean(busy) || !selected.size} onClick={() => void save()}><Check size={14} /> Save tags for {plural(selected.size, "song")}</button>
          </>}
        </div>
        <ul className="taggingProposals" aria-label="Matches">
          {proposals.map((proposal) => <ProposalRow key={proposal.songId} proposal={proposal} checked={selected.has(proposal.songId)} onToggle={() => toggle(proposal.songId)} />)}
          {result.missed.map((id) => <li key={id} className="taggingMissed">No match found for {titleOf(id)}</li>)}
        </ul>
      </div>}

      {busy || message ? <p className={busy ? "taggingStatus working" : "taggingStatus"} role="status" aria-live="polite">{busy ? <Spinner /> : null}{busy || message}</p> : null}
    </section>
  </dialog>;
}
