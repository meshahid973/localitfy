import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { LyricsResult, LyricsSearchHit } from "./lyrics.types";

type Props = {
  songId: string;
  title: string;
  artist: string;
  onSelected: (songId: string, result: LyricsResult) => void;
};

export default function LyricsMatchPanel({ songId, title, artist, onSelected }: Props) {
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

  return (
    <div className="lyricsMatcher">
      <h3>Find the correct lyrics</h3>
      <p>Search LRCLIB and choose the version that matches your recording. Your selection is saved locally.</p>
      <form className="lyricsMatcherForm" onSubmit={(event) => void search(event)}>
        <input aria-label="search lyrics" autoFocus value={query} maxLength={120}
          placeholder="Song title or artist" onChange={(event) => setQuery(event.target.value)} />
        <button className="lyricsTextButton" type="submit" disabled={busy || query.trim().length < 2}>
          <Search size={14} aria-hidden="true" /> {busy ? "searching…" : "search"}
        </button>
      </form>
      {message ? <p className="lyricsMatchMessage" role="status">{message}</p> : null}
      <div className="lyricsMatchResults" aria-live="polite">
        {results.map((item) => (
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
