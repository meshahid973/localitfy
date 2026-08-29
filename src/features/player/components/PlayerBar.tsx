import type { CSSProperties, Dispatch, DragEventHandler, MutableRefObject, PointerEventHandler, SetStateAction } from "react";
import { Repeat2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import "../player.css";
import { Cover } from "../../covers/Cover";
import { PlayerPlayPauseMorphIcon } from "../PlayerPlayPauseMorphIcon";
import { formatTime } from "../../../shared/utils/format";
import { prettyMeta, prettyTitle } from "../../search/search.utils";
import type { Song } from "../../library/song.types";
import type { Settings } from "../../settings/settings.types";
import type { CoverColorSyncMode } from "../../settings/theme.types";
import type { RepeatMode } from "../player.types";

export type PlayerBarProps = {
  ambientStyle: CSSProperties;
  commitSeek: (value: string) => unknown;
  commitVolume: (value: string) => unknown;
  currentDuration: number;
  currentSong: Song | null;
  displayedProgress: number;
  displayedTime: number;
  draggedSongId: string;
  effectiveAmbient: boolean;
  effectiveCoverColorSyncMode: CoverColorSyncMode;
  handlePlayerDragLeave: DragEventHandler<HTMLElement>;
  handlePlayerDragOver: DragEventHandler<HTMLElement>;
  handlePlayerDrop: DragEventHandler<HTMLElement>;
  isPlaying: boolean;
  isSeeking: boolean;
  isShuffle: boolean;
  isVolumeDragging: boolean;
  nowPlayingSongMotionClass: string;
  nowPlayingTransitionKey: string | number;
  playButtonBurst: number;
  playNext: (automatic?: boolean, source?: string) => unknown;
  playPrevious: () => unknown;
  previewSeek: (value: string, input: HTMLInputElement) => unknown;
  previewVolume: (value: string, input: HTMLInputElement) => unknown;
  progressDurationLabelRefs: MutableRefObject<Array<HTMLSpanElement | null>>;
  progressInputRefs: MutableRefObject<Array<HTMLInputElement | null>>;
  progressRangeStyle: CSSProperties;
  progressTimeLabelRefs: MutableRefObject<Array<HTMLSpanElement | null>>;
  queueDropHot: boolean;
  repeatButtonAriaLabel: string;
  repeatButtonStateText: string;
  repeatButtonTitle: string;
  repeatMode: RepeatMode;
  setIsShuffle: Dispatch<SetStateAction<boolean>>;
  setIsVolumeDragging: Dispatch<SetStateAction<boolean>>;
  settings: Pick<Settings, "volume">;
  startPlayerResize: PointerEventHandler<HTMLButtonElement>;
  startSeekPreview: (value: string, input: HTMLInputElement) => unknown;
  togglePlay: () => unknown;
  toggleRepeat: () => unknown;
  updateSetting: (key: "volume", value: number, persist?: boolean) => unknown;
  volumeDraft: number;
  volumeDraftRef: MutableRefObject<number>;
  volumeRangeStyle: CSSProperties;
};

export default function PlayerBar(props: PlayerBarProps) {
  const {
    ambientStyle,
    commitSeek,
    commitVolume,
    currentDuration,
    currentSong,
    displayedProgress,
    displayedTime,
    draggedSongId,
    effectiveAmbient,
    effectiveCoverColorSyncMode,
    handlePlayerDragLeave,
    handlePlayerDragOver,
    handlePlayerDrop,
    isPlaying,
    isSeeking,
    isShuffle,
    isVolumeDragging,
    nowPlayingSongMotionClass,
    nowPlayingTransitionKey,
    playButtonBurst,
    playNext,
    playPrevious,
    previewSeek,
    previewVolume,
    progressDurationLabelRefs,
    progressInputRefs,
    progressRangeStyle,
    progressTimeLabelRefs,
    queueDropHot,
    repeatButtonAriaLabel,
    repeatButtonStateText,
    repeatButtonTitle,
    repeatMode,
    setIsShuffle,
    setIsVolumeDragging,
    settings,
    startPlayerResize,
    startSeekPreview,
    togglePlay,
    toggleRepeat,
    updateSetting,
    volumeDraft,
    volumeDraftRef,
    volumeRangeStyle
  } = props;
  return (
          <footer
            className={`playerBar ambientSurface ${isPlaying ? "playerPlaying" : "playerIdle"} ${draggedSongId ? "songDragActive" : ""} ${queueDropHot ? "queueDropHot" : ""}`}
            style={ambientStyle}
            data-ambient={effectiveAmbient ? "true" : "false"}
            data-cover-sync={effectiveCoverColorSyncMode}
            onDragOver={handlePlayerDragOver}
            onDragLeave={handlePlayerDragLeave}
            onDrop={handlePlayerDrop}
          >
            <button
              className="playerResizeHandle"
              type="button"
              onPointerDown={startPlayerResize}
              aria-label="resize player"
              title="drag up/down to resize the player"
            />

            <div className="playerDropHint" aria-hidden="true">
              drop to play next
            </div>

            <div className="playerLeft">
              <div className={`playerArtSwap nowPlayingPlayerArtSwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
                <Cover song={currentSong} className="smallArt" priority="high" />
              </div>

              <div className={`playerMeta nowPlayingMiniCopySwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
                <strong className={`nowPlayingMiniTitleSwap ${nowPlayingSongMotionClass}`} title={currentSong ? currentSong.title : ""}>
                  {currentSong ? prettyTitle(currentSong.title, 7) : "nothing playing"}
                </strong>
                <p className={`nowPlayingMiniArtistSwap ${nowPlayingSongMotionClass}`}>{currentSong ? prettyMeta(currentSong.artist) : "import a song to begin"}</p>
              </div>
            </div>

            <div className="playerCenter">
              <div className="controlRow">
                <button
                  className={isShuffle ? "circleButton active" : "circleButton"}
                  onClick={() => setIsShuffle((value) => !value)}
                  aria-label={isShuffle ? "turn shuffle off" : "turn shuffle on"}
                >
                  <Shuffle className="playerControlIcon" size={15} strokeWidth={2.15} aria-hidden="true" />
                </button>
                <button className="circleButton" onClick={playPrevious} aria-label="previous song">
                  <SkipBack className="playerControlIcon" size={17} strokeWidth={2.15} aria-hidden="true" />
                </button>
                <button className={`circleButton main ${playButtonBurst ? `playButtonBurst playButtonBurst${playButtonBurst % 2}` : ""}`} onClick={togglePlay} aria-label={isPlaying ? "pause" : "play"}>
                  <PlayerPlayPauseMorphIcon playing={isPlaying} />
                </button>
                <button className="circleButton" onClick={() => playNext(true)} aria-label="next song">
                  <SkipForward className="playerControlIcon" size={17} strokeWidth={2.15} aria-hidden="true" />
                </button>
                <button
                  className={`circleButton repeatButton ${repeatMode !== "off" ? `active repeat-${repeatMode}` : ""}`}
                  onClick={toggleRepeat}
                  type="button"
                  aria-label={repeatButtonAriaLabel}
                  aria-pressed={repeatMode !== "off"}
                  title={repeatButtonTitle}
                  data-repeat-mode={repeatMode}
                >
                  <Repeat2 className="playerControlIcon" size={16} strokeWidth={2.15} aria-hidden="true" />
                  {repeatButtonStateText ? <span className="repeatStateMark" aria-hidden="true">{repeatButtonStateText}</span> : null}
                </button>
              </div>

              <div className="progressRow progressResetSweep" key={`progress-${nowPlayingTransitionKey}`}>
                <span ref={(node) => { progressTimeLabelRefs.current[1] = node; }}>{formatTime(displayedTime)}</span>
                <input
                  ref={(node) => { progressInputRefs.current[1] = node; }}
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={displayedProgress}
                  style={progressRangeStyle}
                  aria-label="song progress"
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    startSeekPreview(event.currentTarget.value, event.currentTarget);
                  }}
                  onInput={(event) => previewSeek(event.currentTarget.value, event.currentTarget)}
                  onChange={(event) => previewSeek(event.currentTarget.value, event.currentTarget)}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                    commitSeek(event.currentTarget.value);
                  }}
                  onPointerCancel={(event) => commitSeek(event.currentTarget.value)}
                  onKeyUp={(event) => commitSeek(event.currentTarget.value)}
                  onBlur={(event) => isSeeking && commitSeek(event.currentTarget.value)}
                />
                <span ref={(node) => { progressDurationLabelRefs.current[1] = node; }}>{formatTime(currentDuration || currentSong?.duration || 0)}</span>
              </div>
            </div>

            <div className="playerRight">
              <div className="volumeWrap" aria-label="Volume">
                <button
                  type="button"
                  className="volumeIconButton"
                  onClick={() => updateSetting("volume", settings.volume > 0 ? 0 : 0.72, true)}
                  aria-label={settings.volume > 0 ? "mute volume" : "restore volume"}
                  title={settings.volume > 0 ? "Mute volume" : "Restore volume"}
                >
                  {settings.volume > 0 ? (
                    <Volume2 className="playerControlIcon" size={17} strokeWidth={2.2} aria-hidden="true" />
                  ) : (
                    <VolumeX className="playerControlIcon" size={17} strokeWidth={2.2} aria-hidden="true" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={volumeDraft}
                  style={volumeRangeStyle}
                  aria-label="volume level"
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    volumeDraftRef.current = Number(event.currentTarget.value);
                    setIsVolumeDragging(true);
                    previewVolume(event.currentTarget.value, event.currentTarget);
                  }}
                  onInput={(event) => previewVolume(event.currentTarget.value, event.currentTarget)}
                  onChange={(event) => previewVolume(event.currentTarget.value, event.currentTarget)}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                    commitVolume(event.currentTarget.value);
                  }}
                  onPointerCancel={(event) => {
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                    commitVolume(event.currentTarget.value);
                  }}
                  onKeyUp={(event) => commitVolume(event.currentTarget.value)}
                  onBlur={(event) => {
                    if (isVolumeDragging) commitVolume(event.currentTarget.value);
                  }}
                />
              </div>
            </div>
          </footer>
  );
}
