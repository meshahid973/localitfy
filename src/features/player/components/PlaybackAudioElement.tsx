import type { MutableRefObject, SyntheticEvent } from "react";
import type { Song } from "../../library/song.types";
import { getSongPlaybackSourceKey } from "../../library";

export type PlaybackAudioElementProps = {
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  currentSong: Song | null;
  songRef: MutableRefObject<Song | null>;
  pendingPlayRef: MutableRefObject<boolean>;
  playbackUrlCacheRef: MutableRefObject<Map<string, unknown>>;
  timeRef: MutableRefObject<number>;
  handleCanPlay: () => unknown;
  handlePlaying: () => unknown;
  handleAudioPause?: () => unknown;
  handleAudioTimeUpdate?: (event: SyntheticEvent<HTMLAudioElement>) => unknown;
  handleAudioEnded?: () => unknown;
  setIsPlaying: (playing: boolean) => void;
  saveDuration: (duration: number) => unknown;
  tickPlayCountTracker: (time: number) => unknown;
  markSongCompletedForPlayCount: (song: Song | null) => unknown;
  patchSongLocal: (songId: string, patch: Partial<Song>) => Promise<unknown> | unknown;
  playNext: (automatic?: boolean, source?: string) => unknown;
  setPlayerError: (message: string) => void;
  getAudioErrorText: (audio: HTMLAudioElement | null) => string;
  setStatusText: (message: string) => void;
  resetPlayCountTracker: () => unknown;
  stopFade: () => unknown;
  stopCrossfadeAuto?: () => unknown;
  stopProgressLoop: () => unknown;
};

export default function PlaybackAudioElement(props: PlaybackAudioElementProps) {
  const {
    audioRef, currentSong, songRef, pendingPlayRef, playbackUrlCacheRef, timeRef,
    handleCanPlay, handlePlaying, handleAudioPause, handleAudioTimeUpdate, handleAudioEnded,
    setIsPlaying, saveDuration, tickPlayCountTracker, markSongCompletedForPlayCount, patchSongLocal,
    playNext, setPlayerError, getAudioErrorText, setStatusText, resetPlayCountTracker,
    stopFade, stopCrossfadeAuto, stopProgressLoop
  } = props;

  return (
    <audio
      ref={audioRef}
      preload="auto"
      crossOrigin="anonymous"
      onCanPlay={handleCanPlay}
      onPlaying={handlePlaying}
      onPlay={() => { pendingPlayRef.current = false; setIsPlaying(true); }}
      onPause={() => {
        if (typeof handleAudioPause === "function") { handleAudioPause(); return; }
        if (!audioRef.current?.ended) setIsPlaying(false);
      }}
      onLoadedMetadata={(event: SyntheticEvent<HTMLAudioElement>) => saveDuration(event.currentTarget.duration)}
      onDurationChange={(event: SyntheticEvent<HTMLAudioElement>) => saveDuration(event.currentTarget.duration)}
      onTimeUpdate={(event: SyntheticEvent<HTMLAudioElement>) => {
        if (typeof handleAudioTimeUpdate === "function") { handleAudioTimeUpdate(event); return; }
        const nextTime = event.currentTarget.currentTime;
        timeRef.current = nextTime;
        tickPlayCountTracker(nextTime);
      }}
      onEnded={() => {
        if (typeof handleAudioEnded === "function") { handleAudioEnded(); return; }
        const endedSong = songRef.current || currentSong;
        markSongCompletedForPlayCount(endedSong);
        if (endedSong?.id) void patchSongLocal(endedSong.id, { playbackPosition: 0 });
        playNext(true, "auto");
      }}
      onError={() => {
        const audio = audioRef.current;
        const failedSong = songRef.current || currentSong;
        const failedCacheKey = getSongPlaybackSourceKey(failedSong);
        if (failedCacheKey) playbackUrlCacheRef.current.delete(failedCacheKey);
        setPlayerError(getAudioErrorText(audio));
        setStatusText("playback error");
        setIsPlaying(false);
        pendingPlayRef.current = false;
        resetPlayCountTracker();
        stopFade();
        if (typeof stopCrossfadeAuto === "function") stopCrossfadeAuto();
        stopProgressLoop();
        window.localitfy.clearDiscordActivity().catch(() => undefined);
      }}
    />
  );
}
