import { Fragment, lazy, memo, Suspense, useRef, useState } from "react";
import { Eye, EyeOff, Heart, ListMusic, Minimize2, MicVocal, Repeat2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Cover } from "../../covers/Cover";
import { ArtworkBackdrop } from "../../covers/ArtworkBackdrop";
import { splitArtistCredits } from "../../artists/artistCredits";
import { prettyMeta, prettyTitle } from "../../search/search.utils";
import { formatTime } from "../../../shared/utils/format";
import { useModalFocus } from "../../../shared/hooks/useModalFocus";
import { PlayerPlayPauseMorphIcon } from "../PlayerPlayPauseMorphIcon";
import { DevicePicker } from "../../connect/DevicePicker";
import type { Song } from "../../library/song.types";
import type { LyricsViewProps } from "../../lyrics/LyricsView";
import type { PlayerBarProps } from "./PlayerBar";
import QueuePanel from "./QueuePanel";
import type { QueuePanelProps } from "./QueuePanel";

const LyricsView = lazy(() => import("../../lyrics/LyricsView"));
// Slots 0–3 belong to Home, the regular desktop bar and both phone surfaces.
const IMMERSIVE_SLOT = 4;
const ListeningArtwork = memo(Cover);
const ListeningBackdrop = memo(ArtworkBackdrop);

type Props = {
  player: PlayerBarProps;
  song: Song;
  queue: QueuePanelProps;
  lyrics: Omit<LyricsViewProps, "anchorRef">;
  backgroundStyle: string;
  backgrounded: boolean;
  onClose: () => void;
};

/** A presentation-only surface: transport, seek, queue and device state stay with the app. */
export default function ImmersivePlayer({ player, song, queue, lyrics, backgroundStyle, backgrounded, onClose }: Props) {
  const dialog = useModalFocus(true, true);
  const stage = useRef<HTMLDivElement>(null);
  const queueTrigger = useRef<HTMLButtonElement>(null);
  const lyricsTrigger = useRef<HTMLButtonElement>(null);
  const [minimal, setMinimal] = useState(false);
  const {
    isPlaying, isShuffle, repeatMode, repeatButtonAriaLabel, repeatButtonStateText,
    togglePlay, playNext, playPrevious, setIsShuffle, toggleRepeat, toggleLike,
    displayedProgress, displayedTime, currentDuration, progressInputRefs, progressTimeLabelRefs, progressDurationLabelRefs,
    progressRangeStyle, startSeekPreview, previewSeek, commitSeek, isSeeking,
    volumeDraft, volumeDraftRef, setIsVolumeDragging, isVolumeDragging, previewVolume, commitVolume, volumeRangeStyle,
    settings, updateSetting, connect, ambientStyle, effectiveAmbient, nowPlayingContextLabel, queuePanelOpen, toggleQueuePanel,
    lyricsOpen, toggleLyrics
  } = player;
  const duration = currentDuration || song.duration || 0;
  const showBackdrop = effectiveAmbient && backgroundStyle === "coverBlur" && !backgrounded;
  function closeLyrics() { lyrics.onClose(); lyricsTrigger.current?.focus({ preventScroll: true }); }
  function closeQueue() { queue.onClose(); queueTrigger.current?.focus({ preventScroll: true }); }
  function toggleMinimal() {
    if (!minimal) {
      if (queue.open) queue.onClose();
      if (lyrics.open) lyrics.onClose();
    }
    setMinimal(value => !value);
  }

  return <section ref={dialog} className="immersivePlayer" role="dialog" aria-modal="true" aria-label="Immersive player"
    tabIndex={-1} data-background={backgroundStyle} style={ambientStyle}
    onKeyDown={(event) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector(".songContextMenuLayer")) return;
      event.preventDefault();
      if (queue.open) closeQueue();
      else if (lyrics.open) closeLyrics();
      else onClose();
    }}>
    {showBackdrop ? <ListeningBackdrop song={song} /> : null}
    <header className="immersiveTop">
      <button type="button" className="immersiveIcon" aria-label="Close immersive player" title="Exit immersive player (Esc)" onClick={onClose}><Minimize2 size={20} aria-hidden="true" /></button>
      <div className="immersiveContext"><small>Now playing</small><strong>{nowPlayingContextLabel || "Your library"}</strong></div>
      <button type="button" className="immersiveIcon" aria-label={minimal ? "Show extra controls" : "Hide extra controls"}
        aria-pressed={minimal} title="Distraction-free mode" onClick={toggleMinimal}>{minimal ? <Eye size={20} aria-hidden="true" /> : <EyeOff size={20} aria-hidden="true" />}</button>
    </header>

    <div className="immersiveStage" ref={stage}>
      {lyrics.open ? <Suspense fallback={<span role="status">Loading lyrics…</span>}>
        <LyricsView {...lyrics} anchorRef={stage} embedded onClose={closeLyrics} openSettings={() => { onClose(); lyrics.openSettings(); }} />
      </Suspense> : <ListeningArtwork song={song} className="immersiveArtwork" priority="high" />}
    </div>

    <div className="immersiveBottom">
      <div className="immersiveMeta">
        <div className="immersiveTitles">
          <h2 title={song.title}>{prettyTitle(song.title, 12)}</h2>
          <p>{splitArtistCredits(song.artist).map((artist, index) => <Fragment key={artist}>
            {index ? ", " : null}<button type="button" onClick={() => { onClose(); player.openArtistPage(artist); }}>{prettyMeta(artist)}</button>
          </Fragment>)}</p>
        </div>
        <button type="button" className="immersiveIcon" aria-label={song.liked ? "Unlike song" : "Like song"} aria-pressed={Boolean(song.liked)} onClick={() => toggleLike(song.id)}>
          <Heart size={22} fill={song.liked ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      </div>

      <div className="immersiveSeek" key={player.nowPlayingTransitionKey}>
        <input type="range" min="0" max="100" step="0.1" defaultValue={displayedProgress} style={progressRangeStyle}
          aria-label="Song progress" disabled={duration <= 0}
          ref={node => { progressInputRefs.current[IMMERSIVE_SLOT] = node; }}
          onPointerDown={event => { event.currentTarget.setPointerCapture?.(event.pointerId); startSeekPreview(event.currentTarget.value, event.currentTarget); }}
          onInput={event => previewSeek(event.currentTarget.value, event.currentTarget)}
          onChange={event => previewSeek(event.currentTarget.value, event.currentTarget)}
          onPointerUp={event => { event.currentTarget.releasePointerCapture?.(event.pointerId); commitSeek(event.currentTarget.value); }}
          onPointerCancel={event => commitSeek(event.currentTarget.value)}
          onKeyUp={event => commitSeek(event.currentTarget.value)}
          onBlur={event => { if (isSeeking) commitSeek(event.currentTarget.value); }} />
        <div className="immersiveTimes">
          <span ref={node => { progressTimeLabelRefs.current[IMMERSIVE_SLOT] = node; }}>{formatTime(displayedTime)}</span>
          <span ref={node => { progressDurationLabelRefs.current[IMMERSIVE_SLOT] = node; }}>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="immersiveTransport">
        <button type="button" className="immersiveIcon" aria-label="Shuffle" aria-pressed={isShuffle} onClick={() => setIsShuffle(value => !value)}><Shuffle size={20} aria-hidden="true" /></button>
        <button type="button" className="immersiveIcon" aria-label="Previous song" onClick={playPrevious}><SkipBack size={26} aria-hidden="true" /></button>
        <button type="button" className="immersivePlay" aria-label={isPlaying ? "Pause" : "Play"} onClick={togglePlay}><PlayerPlayPauseMorphIcon playing={isPlaying} /></button>
        <button type="button" className="immersiveIcon" aria-label="Next song" onClick={() => playNext(true)}><SkipForward size={26} aria-hidden="true" /></button>
        <button type="button" className="immersiveIcon" aria-label={repeatButtonAriaLabel} aria-pressed={repeatMode !== "off"} onClick={toggleRepeat}>
          <Repeat2 size={20} aria-hidden="true" />{repeatButtonStateText ? <span className="immersiveRepeatMark" aria-hidden="true">{repeatButtonStateText}</span> : null}
        </button>
      </div>

      <div className="immersiveTools" hidden={minimal}>
        <div className="immersiveVolume">
          <button type="button" className="immersiveIcon" onClick={() => updateSetting("volume", settings.volume > 0 ? 0 : 0.72, true)}
            aria-label={settings.volume > 0 ? "Mute volume" : "Restore volume"}>{settings.volume > 0 ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}</button>
          <input type="range" min="0" max="100" step="1" value={volumeDraft} style={volumeRangeStyle} aria-label="Volume level"
            onPointerDown={event => { event.currentTarget.setPointerCapture?.(event.pointerId); volumeDraftRef.current = Number(event.currentTarget.value); setIsVolumeDragging(true); previewVolume(event.currentTarget.value, event.currentTarget); }}
            onInput={event => previewVolume(event.currentTarget.value, event.currentTarget)}
            onChange={event => previewVolume(event.currentTarget.value, event.currentTarget)}
            onPointerUp={event => { event.currentTarget.releasePointerCapture?.(event.pointerId); commitVolume(event.currentTarget.value); }}
            onPointerCancel={event => commitVolume(event.currentTarget.value)}
            onKeyUp={event => commitVolume(event.currentTarget.value)}
            onBlur={event => { if (isVolumeDragging) commitVolume(event.currentTarget.value); }} />
        </div>
        <div className="immersiveActions">
          {connect && !minimal ? <DevicePicker controls={connect} variant="bar" /> : null}
          {lyricsOpen !== undefined ? <button ref={lyricsTrigger} type="button" className="immersiveIcon" aria-label="Lyrics" aria-pressed={lyricsOpen} onClick={toggleLyrics}><MicVocal size={20} aria-hidden="true" /></button> : null}
          <button ref={queueTrigger} type="button" className="immersiveIcon" data-queue-trigger aria-label="Play queue"
            aria-expanded={queuePanelOpen} aria-controls={queuePanelOpen ? "localtify-play-queue" : undefined} aria-haspopup="dialog" onClick={toggleQueuePanel}><ListMusic size={20} aria-hidden="true" /></button>
        </div>
      </div>
    </div>
    <QueuePanel {...queue} />
  </section>;
}
