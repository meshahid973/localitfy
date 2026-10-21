import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Song } from "../library/song.types";
import { prettyMeta } from "../search/search.utils";
import { getRendererSafeImageUrl } from "../covers";
import { clamp } from "../../shared/utils/format";

export type NativeMediaSessionOptions = {
  song: Song | null;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  playbackSpeed: number;
  timeRef: MutableRefObject<number>;
  onPlay: () => unknown;
  onPause: () => unknown;
  onStop: () => unknown;
  onPrevious: () => unknown;
  onNext: () => unknown;
};

/** Keeps native Windows/media-key ownership independent of App state layout. */
export function useNativeMediaSession({
  song, isPlaying, duration, currentTime, playbackSpeed, timeRef,
  onPlay, onPause, onStop, onPrevious, onNext
}: NativeMediaSessionOptions) {
  const actionsRef = useRef({ onPlay, onPause, onStop, onPrevious, onNext });
  actionsRef.current = { onPlay, onPause, onStop, onPrevious, onNext };

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const seekBy = (seconds: number) => {
      const audio = document.querySelector<HTMLAudioElement>(".appShell audio");
      if (!audio) return;
      const limit = duration || audio.duration || 0;
      audio.currentTime = clamp(audio.currentTime + seconds, 0, limit || Number.MAX_SAFE_INTEGER);
    };
    try {
      const mediaArtworkSrc = getRendererSafeImageUrl(song?.coverUrl);
      const artwork = mediaArtworkSrc
        ? ([96, 128, 192, 256, 512].map(size => ({
          src: mediaArtworkSrc, sizes: String(size) + "x" + String(size), type: "image/png"
        })) as MediaImage[])
        : [];
      navigator.mediaSession.metadata = song
        ? new MediaMetadata({
          title: song.title || "Unknown song",
          artist: prettyMeta(song.artist) || "Unknown artist",
          album: song.album || "localtify",
          artwork
        })
        : null;
      navigator.mediaSession.playbackState = song ? (isPlaying ? "playing" : "paused") : "none";
      navigator.mediaSession.setActionHandler("play", () => actionsRef.current.onPlay());
      navigator.mediaSession.setActionHandler("pause", () => actionsRef.current.onPause());
      navigator.mediaSession.setActionHandler("stop", () => actionsRef.current.onStop());
      navigator.mediaSession.setActionHandler("previoustrack", () => actionsRef.current.onPrevious());
      navigator.mediaSession.setActionHandler("nexttrack", () => actionsRef.current.onNext());
      navigator.mediaSession.setActionHandler("seekbackward", () => seekBy(-10));
      navigator.mediaSession.setActionHandler("seekforward", () => seekBy(10));
      navigator.mediaSession.setActionHandler("seekto", details => {
        const audio = document.querySelector<HTMLAudioElement>(".appShell audio");
        if (audio && typeof details.seekTime === "number") audio.currentTime = clamp(details.seekTime, 0, duration || audio.duration || 0);
      });
    } catch {
      // Native controls are optional and must never interrupt playback.
    }
  }, [song?.id, song?.coverUrl, song?.title, song?.artist, song?.album, isPlaying, duration]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !song) return;
    try {
      if (typeof navigator.mediaSession.setPositionState !== "function") return;
      const total = Math.max(0, Number(duration) || 0);
      const position = clamp(Number(timeRef.current || currentTime) || 0, 0, total || Number.MAX_SAFE_INTEGER);
      navigator.mediaSession.setPositionState({
        duration: total || Math.max(position, 1),
        playbackRate: clamp(Number(playbackSpeed) || 1, 0.5, 2),
        position
      });
    } catch {
      // Windows media progress is optional.
    }
  }, [song?.id, duration, playbackSpeed]);
}
