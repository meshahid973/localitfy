import { Fragment, lazy, Suspense, useEffect, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import { ChevronDown, ListMusic, MicVocal, MoreVertical, Repeat2, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { Cover } from "../../covers/Cover";
import { PlayerPlayPauseMorphIcon } from "../PlayerPlayPauseMorphIcon";
import { formatTime } from "../../../shared/utils/format";
import { prettyMeta, prettyTitle } from "../../search/search.utils";
import { splitArtistCredits } from "../../artists/artistCredits";
import { LikeHeartAnimationV443 } from "../../../shared/ui/LikeHeartAnimation";
import type { LyricsViewProps } from "../../lyrics/LyricsView";
import type { PlayerBarProps } from "./PlayerBar";
import { DevicePicker } from "../../connect/DevicePicker";
import { useModalFocus } from "../../../shared/hooks/useModalFocus";
import "./phone-player.css";

const LyricsView = lazy(() => import("../../lyrics/LyricsView"));

// Slots in the app's progress refs; 0 and 1 belong to the Home hero and the desktop player bar.
const MINI_SLOT = 2;
const SHEET_SLOT = 3;
const SWIPE_CLOSE_PX = 90;
const SWIPE_SKIP_PX = 70;

export type PhonePlayerProps = PlayerBarProps & { lyrics: Omit<LyricsViewProps, "anchorRef"> };

/** The phone's player: a mini player above the tabs that opens a full-screen player with the cover or the lyrics. */
export default function PhonePlayer(props: PhonePlayerProps) {
  const {
    ambientStyle, commitSeek, currentDuration, currentSong, displayedProgress, displayedTime, isPlaying, isSeeking, isShuffle,
    nowPlayingContextLabel, openArtistPage, openSongContextMenu, playNext, playPrevious, previewSeek, progressDurationLabelRefs,
    progressInputRefs, progressRangeStyle, progressTimeLabelRefs, queueCount, queuePanelOpen, lyricsOpen, toggleLyrics,
    repeatButtonAriaLabel, repeatButtonStateText, repeatMode, setIsShuffle, startSeekPreview, toggleLike, togglePlay,
    toggleQueuePanel, toggleRepeat, lyrics, connect
  } = props;
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useModalFocus(expanded);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const artSlotRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef(0);
  const dragFrameRef = useRef<number | null>(null);
  const duration = currentDuration || currentSong?.duration || 0;

  const resetDrag = () => {
    if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    artSlotRef.current?.classList.remove("isDragging");
    artSlotRef.current?.style.removeProperty("transform");
    artSlotRef.current?.style.removeProperty("opacity");
  };

  useEffect(() => resetDrag, [expanded]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("localtifyplayersheet", { detail: expanded }));
    return () => { if (expanded) window.dispatchEvent(new CustomEvent("localtifyplayersheet", { detail: false })); };
  }, [expanded]);

  // Android back: lyrics first, then the full-screen player.
  useEffect(() => {
    if (!expanded) return;
    const onBack = (event: Event) => {
      event.preventDefault();
      if (lyrics.open) lyrics.onClose();
      else setExpanded(false);
    };
    window.addEventListener("localtifyuiback", onBack);
    return () => window.removeEventListener("localtifyuiback", onBack);
  }, [expanded, lyrics]);

  // The system media controls (notification, lock screen) show and change shuffle and repeat too.
  const toggleRepeatRef = useRef(toggleRepeat);
  toggleRepeatRef.current = toggleRepeat;
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("localtifyplayermodes", { detail: { shuffle: isShuffle, repeat: repeatMode } }));
  }, [isShuffle, repeatMode]);
  useEffect(() => {
    const onModeAction = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "shuffle") setIsShuffle((value) => !value);
      else toggleRepeatRef.current();
    };
    window.addEventListener("localtifymodeaction", onModeAction);
    return () => window.removeEventListener("localtifymodeaction", onModeAction);
  }, [setIsShuffle]);

  if (!currentSong) return null;

  // Down closes the player; on the cover, left plays the next song and right the previous one.
  const swipeStart = (event: ReactTouchEvent) => {
    resetDrag();
    const touch = event.touches[0];
    swipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const swipeMove = (event: ReactTouchEvent) => {
    const start = swipeStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    dragOffsetRef.current = Math.abs(dx) > Math.abs(touch.clientY - start.y) ? dx : 0;
    if (dragFrameRef.current !== null) return;
    // Paint at most once per frame without re-rendering the player and lyrics.
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const slot = artSlotRef.current;
      if (!slot) return;
      const offset = dragOffsetRef.current;
      slot.classList.toggle("isDragging", offset !== 0);
      slot.style.transform = `translateX(${offset}px) rotate(${offset / 40}deg)`;
      slot.style.opacity = String(1 - Math.min(Math.abs(offset) / 600, 0.4));
    });
  };
  const swipeEnd = (event: ReactTouchEvent) => {
    const start = swipeStartRef.current;
    const touch = event.changedTouches[0];
    swipeStartRef.current = null;
    resetDrag();
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dy > SWIPE_CLOSE_PX && dy > Math.abs(dx)) setExpanded(false);
    else if (Math.abs(dx) > SWIPE_SKIP_PX && Math.abs(dx) > Math.abs(dy) * 1.5 && event.currentTarget.classList.contains("phonePlayerStage")) {
      if (dx < 0) playNext(true);
      else playPrevious();
    }
  };

  const artists = splitArtistCredits(currentSong.artist);

  return (
    <>
      <div className="phoneMiniPlayer" style={ambientStyle} onClick={() => setExpanded(true)} role="button" tabIndex={0} aria-label="open player"
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setExpanded(true);
          }
        }}>
        <Cover song={currentSong} className="phoneMiniArt" priority="high" />
        <span className="phoneMiniMeta">
          <strong>{prettyTitle(currentSong.title, 8)}</strong>
          <small>{connect?.remoteName ? `on ${connect.remoteName} · ` : ""}{prettyMeta(currentSong.artist)}</small>
        </span>
        <button type="button" className="phoneIconButton" onClick={(event) => { event.stopPropagation(); togglePlay(); }} aria-label={isPlaying ? "pause" : "play"}>
          <PlayerPlayPauseMorphIcon playing={isPlaying} />
        </button>
        <button type="button" className="phoneIconButton" onClick={(event) => { event.stopPropagation(); playNext(true); }} aria-label="next song">
          <SkipForward size={22} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <input ref={(node) => { progressInputRefs.current[MINI_SLOT] = node; }} className="phoneMiniProgress" type="range" min="0" max="100" step="0.1"
          defaultValue={displayedProgress} tabIndex={-1} aria-hidden="true" disabled />
      </div>

      {expanded ? (
        <div ref={dialogRef} tabIndex={-1} className="phonePlayerSheet" role="dialog" aria-modal="true" aria-label="now playing" style={ambientStyle}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            event.preventDefault();
            if (lyrics.open) lyrics.onClose();
            else setExpanded(false);
          }}>
          <div className="phonePlayerBackdrop" aria-hidden="true"><Cover song={currentSong} className="phonePlayerBackdropArt" /></div>

          <header className="phonePlayerTop" onTouchStart={swipeStart} onTouchEnd={swipeEnd}>
            <button type="button" className="phoneIconButton" onClick={() => setExpanded(false)} aria-label="close player">
              <ChevronDown size={26} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <span className="phonePlayerContext">
              <small>playing from</small>
              <strong>{nowPlayingContextLabel || "your library"}</strong>
            </span>
            <button type="button" className="phoneIconButton" onClick={(event) => openSongContextMenu(event, currentSong)} aria-label="song options">
              <MoreVertical size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </header>

          <div className="phonePlayerStage" ref={stageRef} onTouchStart={lyrics.open ? undefined : swipeStart}
            onTouchMove={lyrics.open ? undefined : swipeMove} onTouchEnd={lyrics.open ? undefined : swipeEnd}
            onTouchCancel={() => { swipeStartRef.current = null; resetDrag(); }}>
            {lyrics.open ? (
              <Suspense fallback={null}><LyricsView {...lyrics} anchorRef={stageRef} /></Suspense>
            ) : (
              <div ref={artSlotRef} className="phonePlayerArtSlot">
                <Cover song={currentSong} className="phonePlayerArt" priority="high" />
              </div>
            )}
          </div>

          <div className="phonePlayerInfo">
            <span className="phonePlayerTitles">
              <strong>{prettyTitle(currentSong.title, 12)}</strong>
              <small>
                {artists.map((name, index) => (
                  <Fragment key={name}>
                    {index ? ", " : null}
                    <button type="button" onClick={() => { setExpanded(false); openArtistPage(name); }}>{prettyMeta(name)}</button>
                  </Fragment>
                ))}
              </small>
            </span>
            <button type="button" className={`phoneIconButton phoneLikeButton iconAction likeActionV443 ${currentSong.liked ? "liked likeActionActiveV443" : ""}`}
              onClick={() => toggleLike(currentSong.id)} aria-label={currentSong.liked ? "unlike song" : "like song"} aria-pressed={Boolean(currentSong.liked)}>
              <LikeHeartAnimationV443 liked={Boolean(currentSong.liked)} />
            </button>
          </div>

          <div className="phonePlayerSeek">
            <input
              ref={(node) => { progressInputRefs.current[SHEET_SLOT] = node; }}
              type="range" min="0" max="100" step="0.1" defaultValue={displayedProgress} style={progressRangeStyle} aria-label="song progress"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); startSeekPreview(event.currentTarget.value, event.currentTarget); }}
              onInput={(event) => previewSeek(event.currentTarget.value, event.currentTarget)}
              onChange={(event) => previewSeek(event.currentTarget.value, event.currentTarget)}
              onPointerUp={(event) => { event.currentTarget.releasePointerCapture?.(event.pointerId); commitSeek(event.currentTarget.value); }}
              onPointerCancel={(event) => commitSeek(event.currentTarget.value)}
              onBlur={(event) => isSeeking && commitSeek(event.currentTarget.value)}
            />
            <span className="phonePlayerTimes">
              <span ref={(node) => { progressTimeLabelRefs.current[SHEET_SLOT] = node; }}>{formatTime(displayedTime)}</span>
              <span ref={(node) => { progressDurationLabelRefs.current[SHEET_SLOT] = node; }}>{formatTime(duration)}</span>
            </span>
          </div>

          <div className="phonePlayerControls">
            <button type="button" className={`phoneIconButton phoneToggle ${isShuffle ? "active" : ""}`} onClick={() => setIsShuffle((value) => !value)}
              aria-label={isShuffle ? "turn shuffle off" : "turn shuffle on"} aria-pressed={isShuffle}>
              <Shuffle size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button type="button" className="phoneIconButton phoneSkip" onClick={playPrevious} aria-label="previous song">
              <SkipBack size={30} strokeWidth={2} fill="currentColor" aria-hidden="true" />
            </button>
            <button type="button" className="phonePlayButton" onClick={togglePlay} aria-label={isPlaying ? "pause" : "play"}>
              <PlayerPlayPauseMorphIcon playing={isPlaying} />
            </button>
            <button type="button" className="phoneIconButton phoneSkip" onClick={() => playNext(true)} aria-label="next song">
              <SkipForward size={30} strokeWidth={2} fill="currentColor" aria-hidden="true" />
            </button>
            <button type="button" className={`phoneIconButton phoneToggle ${repeatMode !== "off" ? "active" : ""}`} onClick={toggleRepeat}
              aria-label={repeatButtonAriaLabel} aria-pressed={repeatMode !== "off"}>
              <Repeat2 size={22} strokeWidth={2.2} aria-hidden="true" />
              {repeatButtonStateText ? <span className="phoneRepeatMark" aria-hidden="true">{repeatButtonStateText}</span> : null}
            </button>
          </div>

          <div className="phonePlayerTools">
            {connect ? <DevicePicker controls={connect} variant="chip" /> : null}
            {lyricsOpen !== undefined ? (
              <button type="button" className={`phoneChip ${lyricsOpen ? "active" : ""}`} onClick={toggleLyrics} aria-pressed={lyricsOpen}>
                <MicVocal size={18} strokeWidth={2.2} aria-hidden="true" /> lyrics
              </button>
            ) : null}
            <button type="button" className={`phoneChip ${queuePanelOpen ? "active" : ""}`} onClick={toggleQueuePanel} aria-pressed={queuePanelOpen}>
              <ListMusic size={18} strokeWidth={2.2} aria-hidden="true" /> up next{queueCount ? ` · ${queueCount}` : ""}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
