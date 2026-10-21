import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { RotateCw, X, Search, RotateCcw } from "lucide-react";
import { Cover } from "../covers/Cover";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import type { Song } from "../library/song.types";
import type { LyricsResult } from "./lyrics.types";
import { activeLyricIndex } from "./lyrics.utils";
import LyricsMatchPanel from "./LyricsMatchPanel";
import "./lyrics.css";

export type LyricsViewProps = {
  open: boolean;
  onClose: () => unknown;
  song: Song | null;
  isPlaying: boolean;
  /** Current playback position in seconds, read every frame while open. */
  getTime: () => number;
  seekTo: (seconds: number) => unknown;
  openSettings: () => unknown;
  /** The main content area the view covers. */
  anchorRef: RefObject<HTMLElement | null>;
};

// Highlight a touch early so the line lights up as it is sung, not after.
const LEAD_SECONDS = 0.2;
const MANUAL_SCROLL_HOLD_MS = 3500;
const VIEW_GAP = 12;
const sessionCache = new Map<string, LyricsResult>();

export default function LyricsView({ open, onClose, song, isPlaying, getTime, seekTo, openSettings, anchorRef }: LyricsViewProps) {
  const viewRef = useRef<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLElement | null>>([]);
  const manualScrollUntilRef = useRef(0);
  const [result, setResult] = useState<LyricsResult | null>(null);
  const [matcherOpen, setMatcherOpen] = useState(false);
  const [offsetSaving, setOffsetSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [box, setBox] = useState<CSSProperties>({ top: 0, left: 0 });
  const songId = song?.id || "";
  const currentSongId = useRef(songId);
  currentSongId.current = songId;
  useEffect(() => { setMatcherOpen(false); }, [songId]);

  const load = useCallback((refresh: boolean) => {
    if (!songId) { setResult(null); return () => undefined; }
    let cancelled = false;
    const cached = refresh ? null : sessionCache.get(songId);
    setResult(cached || null);
    setActiveIndex(-1);
    if (cached) return () => undefined;
    window.localitfy.getLyrics({ id: songId, refresh })
      .then((next) => { if (next.status === "synced" || next.status === "plain" || next.status === "instrumental") sessionCache.set(songId, next); else sessionCache.delete(songId); if (!cancelled) setResult(next); })
      .catch(() => { if (!cancelled) setResult({ status: "error", source: "none", lines: [], error: "lyrics lookup failed" }); });
    return () => { cancelled = true; };
  }, [songId]);

  useEffect(() => (open ? load(false) : undefined), [open, load]);

  const adoptLyrics = (expectedId: string, next: LyricsResult) => {
    if (next.status === "synced" || next.status === "plain" || next.status === "instrumental") sessionCache.set(expectedId, next);
    else sessionCache.delete(expectedId);
    if (currentSongId.current !== expectedId) return;
    setResult(next);
    setMatcherOpen(false);
    setActiveIndex(-1);
  };

  const clearMatch = async () => {
    if (!songId) return;
    const expected = songId;
    try {
      const next = await window.localitfy.clearLyricsMatch({ id: expected });
      adoptLyrics(expected, next);
    } catch (error) { console.warn("[localtify lyrics reset]", error); }
  };

  const shiftLyrics = async (deltaMs: number) => {
    if (!songId || offsetSaving) return;
    const expected = songId;
    const offsetMs = Math.max(-30000, Math.min(30000, (result?.offsetMs || 0) + deltaMs));
    setOffsetSaving(true);
    try {
      const saved = await window.localitfy.setLyricsOffset({ id: expected, offsetMs });
      if (currentSongId.current === expected) {
        setResult(previous => {
          if (!previous) return previous;
          const next = { ...previous, offsetMs: saved.offsetMs };
          sessionCache.set(expected, next);
          return next;
        });
      }
    } catch (error) { console.warn("[localtify lyrics offset]", error); }
    finally { setOffsetSaving(false); }
  };

  // Follow the content area with an even gap, stopping above the player bar.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const view = viewRef.current;
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!view || !anchor) return;
      // A transformed ancestor becomes the containing block for `position: fixed`, so
      // convert viewport coordinates into its space using where the view actually lands.
      const placed = view.getBoundingClientRect();
      const originTop = placed.top - (parseFloat(view.style.top) || 0);
      const originLeft = placed.left - (parseFloat(view.style.left) || 0);
      const playerTop = document.querySelector(".playerBar")?.getBoundingClientRect().top ?? window.innerHeight;
      const top = anchor.top + VIEW_GAP;
      const bottom = Math.min(anchor.bottom, playerTop) - VIEW_GAP;
      const right = Math.min(anchor.right, window.innerWidth) - VIEW_GAP;
      const left = anchor.left + VIEW_GAP;
      setBox({ top: top - originTop, left: left - originLeft, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (anchorRef.current) observer.observe(anchorRef.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    viewRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".songContextMenuLayer, [role='dialog']:not(.lyricsView)")) {
        if (matcherOpen) setMatcherOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose, matcherOpen]);

  const synced = result?.status === "synced" ? result.lines : null;

  // Track the playing line. Re-renders only when the line changes.
  useEffect(() => {
    if (!open || !synced) return;
    let frame = 0;
    const tick = () => {
      setActiveIndex(activeLyricIndex(synced, getTime() + LEAD_SECONDS - (result?.offsetMs || 0) / 1000));
      if (isPlaying) frame = window.requestAnimationFrame(tick);
    };
    tick();
    // Paused: still pick up seeks from the player bar without spinning every frame.
    const idle = isPlaying ? 0 : window.setInterval(tick, 250);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(idle); };
  }, [open, synced, isPlaying, getTime, result?.offsetMs]);

  useEffect(() => {
    if (activeIndex < 0 || Date.now() < manualScrollUntilRef.current) return;
    const scroller = scrollerRef.current;
    const line = lineRefs.current[activeIndex];
    if (!scroller || !line) return;
    const target = line.offsetTop - scroller.clientHeight * 0.36 + line.offsetHeight / 2;
    scroller.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex]);

  if (!open) return null;
  const holdManualScroll = () => { manualScrollUntilRef.current = Date.now() + MANUAL_SCROLL_HOLD_MS; };

  let body;
  if (!song) body = <p className="lyricsMessage">Play a song to see its lyrics.</p>;
  else if (!result) body = <p className="lyricsMessage" role="status">Looking for lyrics…</p>;
  else if (result.status === "synced" || result.status === "plain") {
    body = (
      <div className={`lyricsLines ${result.status === "synced" ? "isSynced" : "isPlain"}`}>
        {result.status === "plain" ? <p className="lyricsNote">These lyrics aren’t synced to the song yet.</p> : null}
        {result.lines.map((line, index) => {
          const state = !synced ? "" : index === activeIndex ? "isActive" : index < activeIndex ? "isPast" : "";
          const text = line.text || "♪";
          return synced ? (
            <button
              type="button"
              key={index}
              ref={(node) => { lineRefs.current[index] = node; }}
              className={`lyricsLine ${state} ${line.text ? "" : "isBreak"}`}
              onClick={() => { manualScrollUntilRef.current = 0; seekTo(Math.max(0, line.time + (result?.offsetMs || 0) / 1000)); }}
              aria-current={index === activeIndex ? "true" : undefined}
            >
              {text}
            </button>
          ) : (
            <p key={index} className={`lyricsLine ${line.text ? "" : "isBreak"}`}>{line.text || " "}</p>
          );
        })}
        <p className="lyricsCredit">{result.manual ? "Manually selected LRCLIB lyrics" : result.source === "file" ? "Lyrics from a local .lrc file" : "Lyrics provided by LRCLIB"}</p>
      </div>
    );
  } else {
    const messages: Record<string, string> = {
      instrumental: "This song is instrumental.",
      missing: "No lyrics found for this song.",
      offline: "Online lookup is off. Add an .lrc file next to the song, or turn lookup on in settings.",
      disabled: "Lyrics are turned off in settings.",
      error: result.error ? `Couldn’t load lyrics: ${result.error}` : "Couldn’t load lyrics."
    };
    body = (
      <div className="lyricsMessage" role="status">
        <p>{messages[result.status]}</p>
        <div className="lyricsMessageActions">
          {result.status === "missing" || result.status === "error" ? (
            <button type="button" className="lyricsTextButton" onClick={() => load(true)}><RotateCw size={14} strokeWidth={2.4} aria-hidden="true" /> try again</button>
          ) : null}
          {result.status === "offline" || result.status === "disabled" ? (
            <button type="button" className="lyricsTextButton" onClick={openSettings}>lyrics settings</button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section ref={viewRef} className="lyricsView" role="dialog" aria-label="lyrics" tabIndex={-1} style={box}>
      <header className="lyricsHead">
        {song ? (
          <div className="lyricsSong">
            <Cover song={song} className="lyricsCover" />
            <span>
              <strong>{prettyTitle(song.title, 8)}</strong>
              <small>{prettyMeta(song.artist)}</small>
            </span>
          </div>
        ) : <span />}
        <div className="lyricsHeadActions">
          {song && result?.status === "synced" ? (
            <div className="lyricsOffsetControls" aria-label="lyrics timing offset">
              <button type="button" disabled={offsetSaving} aria-label="show lyrics 0.25 seconds earlier" onClick={() => void shiftLyrics(-250)}>−</button>
              <span>{((result.offsetMs || 0) / 1000).toFixed(2)}s</span>
              <button type="button" disabled={offsetSaving} aria-label="show lyrics 0.25 seconds later" onClick={() => void shiftLyrics(250)}>+</button>
            </div>
          ) : null}
          {song && result?.manual ? (
            <button type="button" className="lyricsTextButton" onClick={() => void clearMatch()} aria-label="reset manual lyrics match">
              <RotateCcw size={14} aria-hidden="true" /> reset match
            </button>
          ) : null}
          {song ? <button type="button" className="lyricsTextButton" onClick={() => setMatcherOpen(value => !value)} aria-expanded={matcherOpen}>
            <Search size={14} aria-hidden="true" /> {matcherOpen ? "back to lyrics" : "find lyrics"}
          </button> : null}
          <button type="button" className="lyricsIconButton" onClick={onClose} aria-label="close lyrics">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div ref={scrollerRef} className="lyricsScroller" onWheel={holdManualScroll} onTouchMove={holdManualScroll} onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(event.key)) holdManualScroll(); }}>
        {matcherOpen && song
          ? <LyricsMatchPanel key={song.id} songId={song.id} title={song.title} artist={song.artist} onSelected={adoptLyrics} />
          : body}
      </div>
    </section>
  );
}
