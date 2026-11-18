import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { LyricsResult, LyricsSearchHit } from "./lyrics.types";

type Props = {
  songId: string;
  title: string;
  artist: string;
  onSelected: (songId: string, result: LyricsResult) => void;
  result?: LyricsResult | null;
};

export default function LyricsMatchPanel({ songId, title, artist, onSelected, result }: Props) {
  const [editing, setEditing] = useState(false);
  const [localLyrics, setLocalLyrics] = useState("");
  const [query, setQuery] = useState(() => [title, artist].filter(Boolean).join(" ").trim());
  const [results, setResults] = useState<LyricsSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const requestVersion = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; requestVersion.current++; };
  }, []);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    if (text.length < 2 || busy) return;
    const version = ++requestVersion.current;
    setBusy(true);
    setMessage("");
    setResults([]);
    try {
      const found = await window.localitfy.searchLyrics({ id: songId, query: text });
      if (!active.current || requestVersion.current !== version) return;
      setResults(found);
      if (!found.length) setMessage("No matching records. Try a shorter title or different artist.");
    } catch (error) {
      if (active.current && requestVersion.current === version) {
        setMessage(error instanceof Error ? error.message : "Lyrics search failed.");
      }
    } finally {
      if (active.current && requestVersion.current === version) setBusy(false);
    }
  };

  const select = async (id: number) => {
    if (busy || selectedId !== null) return;
    setSelectedId(id);
    setMessage("");
    try {
      const result = await window.localitfy.selectLyricsMatch({ id: songId, lrclibId: id });
      if (active.current) onSelected(songId, result);
    } catch (error) {
      if (active.current) setMessage(error instanceof Error ? error.message : "Couldn't save this lyrics match.");
    } finally {
      if (active.current) setSelectedId(null);
    }
  };

  const edit = () => {
    setEditing(value => !value);
    setMessage("");
    setLocalLyrics(result?.lines.map(line => {
      if (line.time < 0) return line.text;
      const tag = (time: number) => {
        const ms = Math.round(time * 1000);
        return String(Math.floor(ms / 60000)).padStart(2,"0") + ":" + String(Math.floor(ms / 1000) % 60).padStart(2,"0") + "." + String(ms % 1000).padStart(3,"0");
      };
      return "[" + tag(line.time) + "]" + (line.words?.length ? line.words.map(word => "<" + tag(word.time) + ">" + word.text).join("") : line.text);
    }).join("\n") || "");
  };
  const saveLocal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !localLyrics.trim()) return;
    setBusy(true); setMessage("");
    try {
      const saved = await window.localitfy.selectLyricsMatch({ id: songId, localLyrics });
      if (active.current) onSelected(songId, saved);
    } catch { if (active.current) setMessage("Could not save local lyrics. Check the text and try again."); }
    finally { if (active.current) setBusy(false); }
  };
  return (
    <div className="lyricsMatcher">
      <h3>Find the correct lyrics</h3>
      <p>Search LRCLIB and choose the version that matches your recording. Your selection is saved locally.</p>
      <button type="button" className="lyricsTextButton" disabled={busy || selectedId !== null} aria-expanded={editing} onClick={edit}>{editing ? "Back to search" : "Edit or paste local lyrics"}</button>
      {editing ? <form className="lyricsLocalEditor" onSubmit={event => void saveLocal(event)}>
        <label htmlFor="local-lyrics-input">Plain text or LRC (timestamps optional)</label>
        <textarea id="local-lyrics-input" autoFocus rows={10} maxLength={50000} value={localLyrics} onChange={event => setLocalLyrics(event.currentTarget.value)} placeholder="[00:01.00] Your lyrics" />
        <button className="lyricsTextButton" type="submit" disabled={busy || !localLyrics.trim()}>{busy ? "Saving…" : "Save local lyrics"}</button>
      </form> : <form className="lyricsMatcherForm" onSubmit={(event) => void search(event)}>
        <input aria-label="search lyrics" autoFocus value={query} maxLength={120}
          placeholder="Song title or artist" onChange={(event) => setQuery(event.target.value)} />
        <button className="lyricsTextButton" type="submit" disabled={busy || query.trim().length < 2}>
          <Search size={14} aria-hidden="true" /> {busy ? "searching…" : "search"}
        </button>
      </form>}
      {message ? <p className="lyricsMatchMessage" role="status">{message}</p> : null}
      <div className="lyricsMatchResults" aria-live="polite">
        {!editing && results.map((item) => (
          <button type="button" key={item.id} className="lyricsMatchItem"
            disabled={selectedId !== null || busy} onClick={() => void select(item.id)}>
            <span><strong>{item.title || "Untitled"}</strong><small>{item.artist || "Unknown artist"}{item.album ? " · " + item.album : ""}</small></span>
            <small>{item.instrumental ? "instrumental" : item.synced ? "synced" : "plain"}{item.duration ? " · " + Math.round(item.duration) + "s" : ""}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
