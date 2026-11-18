import { IconButton } from "../../shared/ui/IconButton";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { RotateCw, X, Search, RotateCcw } from "lucide-react";
import { Cover } from "../covers/Cover";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import type { Song } from "../library/song.types";
import type { LyricsLine, LyricsResult } from "./lyrics.types";
import { activeLyricIndex, nextLyricCheckDelay, lyricLanguage } from "./lyrics.utils";
import LyricsMatchPanel from "./LyricsMatchPanel";
import "./lyrics.css";

export type LyricsViewProps = {
  open: boolean;
  onClose: () => unknown;
  song: Song | null;
  isPlaying: boolean;
  /** Current playback position in seconds. */
  getTime: () => number;
  getPlaybackRate?: () => number;
  /** Local media events wake the clock immediately after seeks/rate changes. */
  subscribeClock?: (listener: () => void) => () => void;
  seekTo: (seconds: number) => unknown;
  openSettings: () => unknown;
  /** The main content area the view covers. */
  anchorRef: RefObject<HTMLElement | null>;
  embedded?: boolean;
};

const MANUAL_SCROLL_HOLD_MS = 3500;
const VIEW_GAP = 12;

export default function LyricsView({ open, onClose, song, isPlaying, getTime, getPlaybackRate, subscribeClock, seekTo, openSettings, anchorRef, embedded = false }: LyricsViewProps) {
  const viewRef = useRef<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLElement | null>>([]);
  const manualScrollUntilRef = useRef(0);
  const [manualScrollUntil, setManualScrollUntil] = useState(0);
  const following = manualScrollUntil === 0;
  const [loaded, setLoaded] = useState<{ revision: string; result: LyricsResult } | null>(null);
  const [showCompanions, setShowCompanions] = useState(true);
  const [saveError, setSaveError] = useState("");
  const pendingRequest = useRef<{ id: string; requestId: string } | null>(null);
  const wordFrame = useRef({ line: -1, word: -2 });
  const [matcherOpen, setMatcherOpen] = useState(false);
  const [offsetSaving, setOffsetSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [box, setBox] = useState<CSSProperties>({ top: 0, left: 0 });
  const songId = song?.id || "";
  const songRevision = JSON.stringify([songId, song?.filePath, song?.title, song?.artist, song?.album, song?.duration]);
  const result = loaded?.revision === songRevision ? loaded.result : null;
  const currentSongId = useRef(songId);
  const currentRevision = useRef(songRevision);
  const requestGeneration = useRef(0);
  const openRef = useRef(open);
  currentSongId.current = songId;
  currentRevision.current = songRevision;
  openRef.current = open;
  useEffect(() => { setMatcherOpen(false); setManualScrollUntil(0); manualScrollUntilRef.current = 0; setSaveError(""); setOffsetSaving(false); }, [songRevision]);
  const cancelLookup = useCallback(() => {
    const pending = pendingRequest.current;
    pendingRequest.current = null;
    if (pending) void window.localitfy.getLyrics({ ...pending, cancel: true }).catch(() => undefined);
  }, []);

  const load = useCallback((refresh: boolean) => {
    cancelLookup();
    const generation = ++requestGeneration.current;
    setLoaded(null);
    setActiveIndex(-1);
    if (!songId) return;
    const isCurrent = () => openRef.current && currentRevision.current === songRevision && requestGeneration.current === generation;
    // The backend owns the disk/offline cache and its invalidation.
    const requestId = globalThis.crypto.randomUUID?.() ?? `lyrics-${Date.now()}-${generation}-${Math.random().toString(36).slice(2)}`;
    pendingRequest.current = { id: songId, requestId };
    window.localitfy.getLyrics({ id: songId, refresh, requestId })
      .then((next) => { if (isCurrent()) setLoaded({ revision: songRevision, result: next }); })
      .catch(() => { if (isCurrent()) setLoaded({ revision: songRevision, result: { status: "error", source: "none", lines: [], error: "lyrics lookup failed" } }); })
      .finally(() => { if (pendingRequest.current?.requestId === requestId) pendingRequest.current = null; });
  }, [songId, songRevision, cancelLookup]);

  useEffect(() => {
    if (open) load(false);
    return () => { requestGeneration.current++; cancelLookup(); };
  }, [open, load, cancelLookup]);

  const adoptLyrics = (expectedId: string, next: LyricsResult) => {
    if (!openRef.current || currentSongId.current !== expectedId || currentRevision.current !== songRevision) return;
    requestGeneration.current++;
    cancelLookup();
    setLoaded({ revision: songRevision, result: next });
    setMatcherOpen(false);
    setActiveIndex(-1);
  };

  const clearMatch = async () => {
    if (!songId) return;
    const expected = songId;
    const generation = ++requestGeneration.current;
    cancelLookup();
    setSaveError("");
    try {
      const next = await window.localitfy.clearLyricsMatch({ id: expected });
      if (requestGeneration.current === generation && currentRevision.current === songRevision) adoptLyrics(expected, next);
    } catch { if (currentRevision.current === songRevision) setSaveError("Could not reset the lyrics match."); }
  };

  const shiftLyrics = async (deltaMs: number, reset = false) => {
    if (!songId || offsetSaving) return;
    const expected = songId;
    const generation = requestGeneration.current;
    const offsetMs = reset ? 0 : Math.max(-30000, Math.min(30000, (result?.offsetMs || 0) + deltaMs));
    setSaveError("");
    setOffsetSaving(true);
    try {
      const saved = await window.localitfy.setLyricsOffset({ id: expected, offsetMs });
      if (openRef.current && currentRevision.current === songRevision && requestGeneration.current === generation) {
        setLoaded(previous => previous?.revision === songRevision ? { ...previous, result: { ...previous.result, offsetMs: saved.offsetMs } } : previous);
      }
    } catch { if (currentRevision.current === songRevision) setSaveError("Could not save the timing adjustment."); }
    finally { if (currentRevision.current === songRevision) setOffsetSaving(false); }
  };

  // Follow the content area with an even gap, stopping above the player bar.
  useLayoutEffect(() => {
    if (!open || embedded) return;
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
  }, [open, anchorRef, embedded]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".songContextMenuLayer, [role='dialog']:not(.lyricsView)")) {
        if (matcherOpen) setMatcherOpen(false);
        else onClose();
      }
    };
    if (embedded) return;
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose, matcherOpen, embedded]);

  useEffect(() => { if (open && !embedded) viewRef.current?.focus({ preventScroll: true }); }, [open, embedded]);
  const synced = result?.status === "synced" ? result.lines : null;
  const offsetMs = result?.offsetMs || 0;
  const clockTime = useRef(0);
  const paintWords = useCallback((index: number, time: number) => {
    const words = synced?.[index]?.words;
    const word = words ? activeLyricIndex(words, time) : -1;
    if (wordFrame.current.line === index && wordFrame.current.word === word) return;
    const line = lineRefs.current[index];
    if (!line) return;
    for (const segment of Array.from(line.querySelectorAll<HTMLElement>("[data-lyric-word]"))) {
      segment.dataset.sung = Number(segment.dataset.lyricWord) <= word ? "true" : "false";
    }
    wordFrame.current = { line: index, word };
  }, [synced]);
  useLayoutEffect(() => { wordFrame.current = { line: -1, word: -2 }; paintWords(activeIndex, clockTime.current); }, [activeIndex, paintWords, matcherOpen]);
  const registerLine = useCallback((index: number, node: HTMLElement | null) => { lineRefs.current[index] = node; }, []);
  const seekLine = useCallback((line: LyricsLine) => { manualScrollUntilRef.current = 0; setManualScrollUntil(0); seekTo(Math.max(0, line.time + offsetMs / 1000)); }, [seekTo, offsetMs]);

  // Wake near a line boundary, not on every display refresh. A bounded
  // resync interval also handles buffering and remote/Android clock drift.
  useEffect(() => {
    if (!open || !synced || matcherOpen) return;
    let timer = 0;
    const tick = () => {
      window.clearTimeout(timer);
      if (document.hidden) return;
      const time = getTime() - offsetMs / 1000;
      clockTime.current = time;
      const index = activeLyricIndex(synced, time);
      setActiveIndex(previous => previous === index ? previous : index);
      paintWords(index, time);
      if (isPlaying || !subscribeClock) {
        const delay = isPlaying
          ? nextLyricCheckDelay(synced, index, time, getPlaybackRate?.() || 1)
          : 250;
        timer = window.setTimeout(tick, delay);
      }
    };
    const unsubscribe = subscribeClock?.(tick);
    document.addEventListener("visibilitychange", tick);
    tick();
    return () => {
      window.clearTimeout(timer);
      unsubscribe?.();
      document.removeEventListener("visibilitychange", tick);
    };
  }, [open, synced, isPlaying, getTime, getPlaybackRate, subscribeClock, matcherOpen, offsetMs, paintWords]);

  useEffect(() => {
    if (matcherOpen || Date.now() < manualScrollUntilRef.current) return;
    const scroller = scrollerRef.current;
    const line = lineRefs.current[activeIndex];
    if (!scroller) return;
    if (!line) { scroller.scrollTo({ top: 0, behavior: "auto" }); return; }
    const target = line.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - scroller.clientHeight * 0.36 + line.offsetHeight / 2;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !!document.querySelector(".app.reducedMotion");
    scroller.scrollTo({ top: Math.max(0, target), behavior: reduceMotion ? "auto" : "smooth" });
  }, [activeIndex, following, matcherOpen, showCompanions, synced]);

  useEffect(() => {
    if (following || !open) return;
    const timer = window.setTimeout(() => {
      manualScrollUntilRef.current = 0;
      setManualScrollUntil(0);
    }, Math.max(0, manualScrollUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [following, manualScrollUntil, open]);

  if (!open) return null;
  const holdManualScroll = () => { manualScrollUntilRef.current = Date.now() + MANUAL_SCROLL_HOLD_MS; setManualScrollUntil(manualScrollUntilRef.current); };

  let body;
  if (!song) body = <p className="lyricsMessage">Play a song to see its lyrics.</p>;
  else if (!result) body = <p className="lyricsMessage" role="status">Looking for lyrics…</p>;
  else if (result.status === "synced" || result.status === "plain") {
    body = (
      <div className={`lyricsLines ${result.status === "synced" ? "isSynced" : "isPlain"}`}>
        {result.status === "plain" ? <p className="lyricsNote">These lyrics aren’t synced to the song yet.</p> : null}
        {result.lines.map((line, index) => <LyricRow key={index} line={line} index={index} synced={Boolean(synced)} state={!synced ? "" : index === activeIndex ? "isActive" : index < activeIndex ? "isPast" : ""} register={registerLine} seek={seekLine} companions={showCompanions} />)}
        <p className="lyricsCredit">{result.manual ? "Manually selected LRCLIB lyrics" : result.source === "file" ? "Lyrics from a local .lrc file" : result.source === "embedded" ? "Lyrics embedded in the audio file" : "Lyrics provided by LRCLIB"}</p>
      </div>
    );
  } else {
    const messages: Record<string, string> = {
      instrumental: "This song is instrumental.",
      missing: "No lyrics found for this song.",
      offline: "Online lookup is off. Add an .lrc file next to the song, embed lyrics in your audio, or turn lookup on in settings.",
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
    <section ref={viewRef} className="lyricsView" role="dialog" aria-label="lyrics" tabIndex={-1} style={embedded ? undefined : box}
      onKeyDown={embedded ? (event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        if (matcherOpen) setMatcherOpen(false);
        else onClose();
      } : undefined}>
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
          {synced && !following ? <button type="button" className="lyricsTextButton" onClick={() => { manualScrollUntilRef.current = 0; setManualScrollUntil(0); }}>Follow lyrics</button> : null}
          {song && result?.status === "synced" ? (
            <div className="lyricsOffsetControls" aria-label="lyrics timing offset">
              <button type="button" disabled={offsetSaving} aria-label="show lyrics 0.25 seconds earlier" onClick={() => void shiftLyrics(-250)}>−</button>
              <button type="button" className="lyricsOffsetReset" disabled={offsetSaving || !offsetMs} title="Reset timing offset" aria-label="Reset timing offset" onClick={() => void shiftLyrics(0, true)}>{(offsetMs / 1000).toFixed(2)}s</button>
              <button type="button" disabled={offsetSaving} aria-label="show lyrics 0.25 seconds later" onClick={() => void shiftLyrics(250)}>+</button>
            </div>
          ) : null}
          {result?.lines.some(line => line.romanization || line.translation) ? <button type="button" className="lyricsTextButton" aria-pressed={showCompanions} onClick={() => setShowCompanions(value => !value)}>Translations / romaji</button> : null}
          {song && result?.manual ? (
            <button type="button" className="lyricsTextButton" onClick={() => void clearMatch()} aria-label="reset manual lyrics match">
              <RotateCcw size={14} aria-hidden="true" /> reset match
            </button>
          ) : null}
          {song ? <button type="button" className="lyricsTextButton" onClick={() => setMatcherOpen(value => !value)} aria-expanded={matcherOpen}>
            <Search size={14} aria-hidden="true" /> {matcherOpen ? "back to lyrics" : "find lyrics"}
          </button> : null}
          <IconButton type="button" className="lyricsIconButton" onClick={onClose} aria-label="close lyrics">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </IconButton>
        </div>
      </header>
      {saveError ? <p className="lyricsNote" role="alert">{saveError}</p> : null}
      <div ref={scrollerRef} className="lyricsScroller" tabIndex={0} aria-label="Scrollable lyrics" onWheel={holdManualScroll} onTouchMove={holdManualScroll} onPointerDown={(event) => { if (event.target === event.currentTarget) holdManualScroll(); }} onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) holdManualScroll(); }}>
        {matcherOpen && song
          ? <LyricsMatchPanel key={songRevision} songId={song.id} title={song.title} artist={song.artist} onSelected={adoptLyrics} />
          : body}
      </div>
    </section>
  );
}

// Memoized rows mean boundary updates repaint only rows whose status changes.
// Word boundaries update the current row directly without React state churn.
const LyricRow = memo(function LyricRow({ line, index, synced, state, register, seek, companions }: {
  line: LyricsLine; index: number; synced: boolean; state: string;
  register: (index: number, node: HTMLElement | null) => void; seek: (line: LyricsLine) => void; companions: boolean;
}) {
  const content = <><span className="lyricsPrimary" lang={lyricLanguage(line.text)}>{line.words?.length ? line.words.map((word, i) => <span key={i} data-lyric-word={i}>{word.text}</span>) : line.text || "♪"}</span>{companions && line.romanization ? <span className="lyricsCompanion">{line.romanization}</span> : null}{companions && line.translation ? <span className="lyricsCompanion">{line.translation}</span> : null}</>;
  const className = `lyricsLine ${state} ${line.text ? "" : "isBreak"}`;
  return synced ? <button type="button" ref={node => register(index, node)} className={className} onClick={() => seek(line)} aria-current={state === "isActive" ? "true" : undefined} aria-label={line.text ? undefined : "Instrumental break"}>{content}</button> : <p className={className}>{content}</p>;
});
