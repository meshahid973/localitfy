import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Copy, RefreshCw, X } from "lucide-react";
import type { Song } from "../song.types";
import { fileNameFromPath, prettyMeta, prettyTitle } from "../../search";
import type { DuplicateCopy, DuplicateMerge, DuplicateSet } from "./duplicates.types";
import { buildMerges, defaultChoices, type DuplicateChoices } from "./duplicatePlan";
import "./duplicates.css";

export type DuplicatesMergeResult = { merges: DuplicateMerge[]; songs: Song[] };

type DuplicatesDialogProps = {
  songs: readonly Song[];
  onClose: () => void;
  onMerged: (result: DuplicatesMergeResult) => unknown;
};

function folderLabel(folder: string) { return folder.split(/[\\/]/).filter(Boolean).slice(-2).join(" / "); }
function copyLabel(copy: DuplicateCopy) {
  return `${folderLabel(copy.folder)} · .${copy.extension}${copy.duplicateName ? " copy" : ""}`;
}

export default function DuplicatesDialog({ songs, onClose, onMerged }: DuplicatesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sets, setSets] = useState<DuplicateSet[] | null>(null);
  const [scanned, setScanned] = useState(0);
  const [choices, setChoices] = useState<DuplicateChoices>(new Map());
  const [moveToTrash, setMoveToTrash] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [scanError, setScanError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const songsById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true); setScanError("");
    void window.localitfy.findDuplicates().then((result) => {
      if (cancelled) return;
      if (!result.ok || !result.sets) { setScanError(result.message || "Could not scan for duplicates. Please retry."); return; }
      setSets(result.sets); setScanned(result.scanned || 0); setChoices(defaultChoices(result.sets));
    }).catch(() => { if (!cancelled) setScanError("Could not scan for duplicates. Please retry."); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  const merges = useMemo(() => buildMerges(sets || [], choices), [sets, choices]);
  const removeCount = merges.reduce((count, merge) => count + merge.removeIds.length, 0);
  const choose = (setId: string, value: string | null) => setChoices((current) => {
    const next = new Map(current);
    if (value) next.set(setId, value); else next.delete(setId);
    return next;
  });

  async function merge() {
    if (!merges.length) return;
    setBusy(true); setMessage("");
    try {
      const result = await window.localitfy.mergeDuplicates({ merges, moveToTrash });
      if (!result.ok || !result.songs || !result.merges) { setMessage(result.message || "Could not merge duplicates. Nothing was changed."); return; }
      onMerged({ merges: result.merges, songs: result.songs });
      const trash = moveToTrash ? ` ${result.trashed} file${result.trashed === 1 ? "" : "s"} moved to the Trash${result.trashFailed ? `, ${result.trashFailed} could not be moved` : ""}${result.skippedShared ? `, ${result.skippedShared} shared file path${result.skippedShared === 1 ? "" : "s"} left untouched` : ""}.` : "";
      setMessage(`Removed ${result.removedCount} duplicate${result.removedCount === 1 ? "" : "s"}.${trash}`);
      setSets(null); setAttempt((value) => value + 1);
    } catch {
      setMessage("Could not merge duplicates. Nothing was changed.");
    } finally { setBusy(false); }
  }

  const groupCount = sets?.reduce((count, set) => count + set.groups.length, 0) || 0;
  return <dialog ref={dialogRef} className="duplicatesDialog" aria-labelledby="duplicates-title" aria-modal="true"
    onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="duplicatesContent">
      <header className="duplicatesHeader">
        <span className="duplicatesIcon" aria-hidden="true"><Copy size={22} /></span>
        <div><p className="duplicatesEyebrow">Library cleanup</p><h2 id="duplicates-title">Duplicates</h2>
          <p>{sets ? `${groupCount} song${groupCount === 1 ? "" : "s"} with duplicates · ${scanned} songs checked` : "Same title, artists and length, confirmed by sound when analyzed."}</p></div>
        <button type="button" className="duplicatesClose" onClick={onClose} aria-label="Close duplicates"><X size={20} /></button>
      </header>
      <p className="duplicatesIntro">Albums are kept as a whole copy, so you never end up with half of one copy and half of another.
        Plays, likes, playlist spots and listening history move to the song you keep. A database backup is made first.</p>
      {busy && !sets ? <p className="duplicatesNotice" role="status">Checking your library…</p> : null}
      {message ? <p className="duplicatesNotice" role="status">{message}</p> : null}
      {scanError ? <div className="duplicatesNotice" role="alert"><p>{scanError}</p>
        <button type="button" className="duplicatesAction" onClick={() => setAttempt((value) => value + 1)}><RefreshCw size={15} />Scan again</button></div> : null}
      {sets && !sets.length ? <p className="duplicatesNotice" role="status">No duplicates found.</p> : null}
      {sets?.some((set) => set.groups.some((group) => group.confidence === "metadata")) ?
        <p className="duplicatesNotice" role="note">Some matches are based on titles, artists and duration only. Review and select those groups manually before merging.</p> : null}
      {sets?.map((set) => {
        const first = songsById.get(set.groups[0].keepId);
        const choice = choices.get(set.id) || null;
        const copiesByKey = new Map(set.copies.map((copy) => [copy.key, copy]));
        const title = set.kind === "album" ? prettyMeta(first?.album || "album") : prettyTitle(first?.title || "song");
        return <article key={set.id} className="duplicatesSet" data-skipped={!choice}>
          <header className="duplicatesSetHead">
            <label className="duplicatesInclude"><input type="checkbox" checked={Boolean(choice)}
              onChange={(event) => choose(set.id, event.currentTarget.checked ? defaultChoices([set]).get(set.id) || null : null)} />
              <span><strong>{title}</strong><small>{prettyMeta(first?.artist || "")}{set.kind === "album" ? ` · ${set.groups.length} tracks in ${set.copies.length} copies` : ""}</small></span></label>
          </header>
          <fieldset className="duplicatesChoices" disabled={!choice || busy}>
            <legend>{set.kind === "album" ? "Keep this copy" : "Keep this one"}</legend>
            {set.kind === "album" ? set.copies.map((copy) => <label key={copy.key} className="duplicatesChoice">
              <input type="radio" name={`keep-${set.id}`} checked={choice === copy.key} onChange={() => choose(set.id, copy.key)} />
              <span><strong>{copyLabel(copy)}</strong><small>{copy.trackCount} track{copy.trackCount === 1 ? "" : "s"} in library{copy.kbps ? ` · ${copy.kbps} kbps` : ""}{copy.key === set.recommendedCopy ? " · recommended" : ""}</small></span>
            </label>) : set.groups[0].songs.map((member, index) => {
              const song = songsById.get(member.id); const copy = copiesByKey.get(member.copyKey);
              return <label key={member.id} className="duplicatesChoice">
                <input type="radio" name={`keep-${set.id}`} checked={choice === member.id} onChange={() => choose(set.id, member.id)} />
                <span><strong>{prettyMeta(song?.album || "")} · {fileNameFromPath(song?.filePath)}</strong><small>{folderLabel(copy?.folder || "")}{copy?.kbps ? ` · ${copy.kbps} kbps` : ""}{index === 0 ? " · recommended" : ""}</small></span>
              </label>;
            })}
          </fieldset>
          {set.kind === "album" ? <details className="duplicatesTracks"><summary>Show tracks</summary><ol>
            {set.groups.map((group) => {
              const keep = group.songs.find((song) => song.copyKey === choice) || group.songs[0];
              const song = songsById.get(keep.id);
              return <li key={group.id}><span>{prettyTitle(song?.title || "")}</span>
                <small>keep {fileNameFromPath(song?.filePath)}{keep.copyKey !== choice && choice ? " (only in another copy)" : ""} · remove {group.songs.length - 1}
                  {group.confidence === "metadata" ? " · matched by tags and length only" : ""}</small></li>;
            })}</ol></details>
            : set.groups[0].confidence === "metadata" ? <p className="duplicatesHint">Matched by tags and length only. Analyze these songs to confirm by sound.</p> : null}
        </article>;
      })}
      {sets?.length ? <footer className="duplicatesFooter">
        <label className="duplicatesInclude"><input type="checkbox" checked={moveToTrash} disabled={busy} onChange={(event) => setMoveToTrash(event.currentTarget.checked)} />
          <span><strong>Also move removed files to the Trash</strong><small>Otherwise the files stay on disk and only leave your library.</small></span></label>
        <button type="button" className="duplicatesAction duplicatesPrimary" disabled={busy || !removeCount} onClick={() => void merge()}>
          {busy ? "Merging…" : `Remove ${removeCount} duplicate${removeCount === 1 ? "" : "s"}`}</button>
      </footer> : null}
    </section>
  </dialog>;
}
