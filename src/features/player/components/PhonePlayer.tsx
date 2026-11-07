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
import "./phone-player.css";

const LyricsView = lazy(() => import("../../lyrics/LyricsView"));

// Slots in the app's progress refs; 0 and 1 belong to the Home hero and the desktop player bar.
const MINI_SLOT = 2;
const SHEET_SLOT = 3;
const SWIPE_CLOSE_PX = 90;

export type PhonePlayerProps = PlayerBarProps & { lyrics: Omit<LyricsViewProps, "anchorRef"> };

/** The phone's player: a mini player above the tabs that opens a full-screen player with the cover or the lyrics. */
export default function PhonePlayer(props: PhonePlayerProps) {
  const {
    ambientStyle, commitSeek, currentDuration, currentSong, displayedProgress, displayedTime, isPlaying, isSeeking, isShuffle,
    nowPlayingContextLabel, openArtistPage, openSongContextMenu, playNext, playPrevious, previewSeek, progressDurationLabelRefs,
    progressInputRefs, progressRangeStyle, progressTimeLabelRefs, queueCount, queuePanelOpen, lyricsOpen, toggleLyrics,
    repeatButtonAriaLabel, repeatButtonStateText, repeatMode, setIsShuffle, startSeekPreview, toggleLike, togglePlay,
    toggleQueuePanel, toggleRepeat, lyrics
  } = props;
  const [expanded, setExpanded] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<number | null>(null);
  const duration = currentDuration || currentSong?.duration || 0;

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

  if (!currentSong) return null;

  const swipeStart = (event: ReactTouchEvent) => { swipeStartRef.current = event.touches[0]?.clientY ?? null; };
  const swipeEnd = (event: ReactTouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const end = event.changedTouches[0]?.clientY;
    if (start !== null && end !== undefined && end - start > SWIPE_CLOSE_PX) setExpanded(false);
  };

  const artists = splitArtistCredits(currentSong.artist);

  return (
    <>
      <div className="phoneMiniPlayer" style={ambientStyle} onClick={() => setExpanded(true)} role="button" tabIndex={0} aria-label="open player"
        onKeyDown={(event) => { if (event.key === "Enter") setExpanded(true); }}>
        <Cover song={currentSong} className="phoneMiniArt" priority="high" />
        <span className="phoneMiniMeta">
          <strong>{prettyTitle(currentSong.title, 8)}</strong>
          <small>{prettyMeta(currentSong.artist)}</small>
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
        <div className="phonePlayerSheet" role="dialog" aria-label="now playing" style={ambientStyle}>
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

          <div className="phonePlayerStage" ref={stageRef} onTouchStart={lyrics.open ? undefined : swipeStart} onTouchEnd={lyrics.open ? undefined : swipeEnd}>
            {lyrics.open ? (
              <Suspense fallback={null}><LyricsView {...lyrics} anchorRef={stageRef} /></Suspense>
            ) : (
              <Cover song={currentSong} className="phonePlayerArt" priority="high" />
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
            <button type="button" className={`phoneIconButton likeActionV443 ${currentSong.liked ? "liked likeActionActiveV443" : ""}`}
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
