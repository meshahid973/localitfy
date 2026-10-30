import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Search, X } from "lucide-react";
import { Cover } from "../covers/Cover";
import type { Song } from "../library/song.types";
import type { TagAlbumSearchResult, TagLookupResult } from "./tagging.types";
import { ProposalRow, Spinner, byTrack, errorText, plural } from "./tagging.shared";
import "./tagging.css";

export type TagSearchAlbum = { title: string; artist: string; coverSong: Song | null; songs: Song[] };
export type AlbumTagSearchDialogProps = { album: TagSearchAlbum; onClose: () => void };

const releaseLine = (row: TagAlbumSearchResult) => [row.note, row.year, row.releaseType.toLowerCase(), row.status && row.status !== "Official" ? row.status.toLowerCase() : "",
  row.format, row.country, row.trackCount ? plural(row.trackCount, "track") : "", row.label].filter(Boolean).join(" · ");

/**
 * Album right-click → "find on MusicBrainz": search by hand, pick the release, review every
 * track's match, save. All tracks end up on the same release, with the same cover.
 */
export default function AlbumTagSearchDialog({ album, onClose }: AlbumTagSearchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const songs = album.songs.filter((song) => song.filePath);
  const songIds = songs.map((song) => song.id);
  const [title, setTitle] = useState(album.title || "");
  const [artist, setArtist] = useState(album.artist || "");
  const [results, setResults] = useState<TagAlbumSearchResult[] | null>(null);
  const [chosen, setChosen] = useState<(TagLookupResult & { release: TagAlbumSearchResult }) | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
    setBusy("Searching MusicBrainz…"); setMessage(""); setChosen(null);
    try {
      const next = await window.localitfy.searchMusicBrainzAlbum(songIds, title.trim(), artist.trim());
      setResults(next);
      if (!next.length) setMessage("Nothing found. Try a shorter title or leave the artist empty.");
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  // Opening the dialog is the request, so the first search runs straight away.
  useEffect(() => { void Promise.resolve().then(search); }, []);

  async function choose(release: TagAlbumSearchResult) {
    setBusy(`Matching tracks to ${release.title}…`); setMessage("");
    try {
      const result = await window.localitfy.chooseMusicBrainzAlbum(songIds, release.releaseId);
      setChosen({ ...result, release });
      setSelected(new Set(result.proposals.map((proposal) => proposal.songId)));
      if (!result.proposals.length) setMessage("None of this album’s songs are on that release. Try another one.");
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  async function save() {
    const ids = [...selected];
    setBusy(`Saving tags for ${plural(ids.length, "song")}…`); setMessage("");
    try {
      const result = await window.localitfy.applyMusicBrainzTags(ids);
      const parts = [`Updated ${plural(result.applied, "song")}${result.written ? `, wrote tags into ${plural(result.written, "file")} (originals are in the Trash)` : ""}.`];
      if (result.failed.length) parts.push(`Could not update: ${result.failed.map((failure) => `${failure.title} (${failure.error})`).join(", ")}.`);
      setSaved(!result.failed.length);
      setSelected(new Set(result.failed.map((failure) => failure.songId)));
      setMessage(parts.join(" "));
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const titleOf = (id: string) => songs.find((song) => song.id === id)?.title || "Unknown song";
  return <dialog ref={dialogRef} className="tagSearchDialog" aria-labelledby="album-tag-search-title" aria-modal="true"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <section className="tagSearchContent">
      <header className="tagSearchHeader">
        <Cover song={album.coverSong} className="tagSearchCover" />
        <div className="tagSearchHeading">
          <p className="tagSearchEyebrow">Find album on MusicBrainz</p>
          <h2 id="album-tag-search-title">{album.title}</h2>
          <p>{[album.artist, plural(songs.length, "song")].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" className="tagSearchClose" onClick={onClose} disabled={Boolean(busy)} aria-label="Close"><X size={20} /></button>
      </header>

      {chosen ? <div className="tagSearchChosen">
        <strong>{chosen.release.title} <small className="tagSearchChosenMeta">{[chosen.release.artist, releaseLine(chosen.release)].filter(Boolean).join(" · ")}</small></strong>
        {/* Above the list, so saving a long album needs no scrolling. */}
        <div className="tagSearchActions">
          {saved ? <button type="button" className="tagSearchButton primary" onClick={onClose}>Done</button> : <>
            <button type="button" className="tagSearchButton" disabled={Boolean(busy)} onClick={() => { setChosen(null); setMessage(""); }}><ArrowLeft size={14} /> Back to results</button>
            <button type="button" className="tagSearchButton primary" disabled={Boolean(busy) || !selected.size} onClick={() => void save()}><Check size={14} /> Save tags for {plural(selected.size, "song")}</button>
          </>}
        </div>
        <ul className="taggingProposals" aria-label="Matched tracks">
          {[...chosen.proposals].sort(byTrack).map((proposal) => <ProposalRow key={proposal.songId} proposal={proposal} checked={selected.has(proposal.songId)} onToggle={() => toggle(proposal.songId)} />)}
          {chosen.missed.map((id) => <li key={id} className="taggingMissed">Not on this release: {titleOf(id)}</li>)}
        </ul>
      </div> : <form className="tagSearchForm" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <label><span>Album</span><input value={title} onChange={(event) => setTitle(event.target.value)} disabled={Boolean(busy)} /></label>
        <label><span>Artist</span><input value={artist} onChange={(event) => setArtist(event.target.value)} disabled={Boolean(busy)} placeholder="any artist" /></label>
        <button type="submit" className="tagSearchButton" disabled={Boolean(busy) || !title.trim()}><Search size={14} /> Search</button>
      </form>}

      {busy || message ? <p className={busy ? "taggingStatus working" : "taggingStatus"} role="status" aria-live="polite">{busy ? <Spinner /> : null}{busy || message}</p> : null}

      {!chosen && results?.length ? <ul className="tagSearchResults" aria-label="MusicBrainz releases">{results.map((row) => <li key={row.releaseId}>
        <button type="button" disabled={Boolean(busy)} onClick={() => void choose(row)}>
          <span className="tagSearchResultText"><strong>{row.title} <small>{row.artist}</small></strong><small>{releaseLine(row)}</small></span>
          <span className={row.score >= 0.8 ? "taggingScore" : "taggingScore low"} title="How closely title, artist and track count match">{Math.round(row.score * 100)}%</span>
        </button>
      </li>)}</ul> : null}
    </section>
  </dialog>;
}
