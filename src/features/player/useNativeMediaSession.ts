import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Song } from "../library/song.types";
import { prettyMeta } from "../search/search.utils";
import { getRendererSafeImageUrl } from "../covers";
import { clamp } from "../../shared/utils/format";

export type NativeMediaSessionOptions = {
  audioRef: MutableRefObject<HTMLAudioElement | null>;
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
  onSeek: (seconds: number) => unknown;
};

/** Keeps native Windows/media-key ownership independent of App state layout. */
export function useNativeMediaSession({
  audioRef, song, isPlaying, duration, currentTime, playbackSpeed, timeRef,
  onPlay, onPause, onStop, onPrevious, onNext, onSeek
}: NativeMediaSessionOptions) {
  const actionsRef = useRef({ onPlay, onPause, onStop, onPrevious, onNext, onSeek });
  actionsRef.current = { onPlay, onPause, onStop, onPrevious, onNext, onSeek };
  const durationRef = useRef(duration);
  durationRef.current = duration;

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const seekLimit = (audio: HTMLAudioElement) => [audio.duration, durationRef.current].find(value => Number.isFinite(value) && value > 0) || 0;
    const seekBy = (seconds: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(audio.currentTime)) return;
      const limit = seekLimit(audio);
      if (limit) actionsRef.current.onSeek(clamp(audio.currentTime + seconds, 0, limit));
    };
    const registered: MediaSessionAction[] = [];
    const setActionHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try { navigator.mediaSession.setActionHandler(action, handler); registered.push(action); } catch { /* Unsupported actions must not disable the remaining controls. */ }
    };
    const offset = (details: MediaSessionActionDetails) => Number.isFinite(details.seekOffset) && Number(details.seekOffset) > 0 ? Number(details.seekOffset) : 10;
    setActionHandler("play", () => actionsRef.current.onPlay());
    setActionHandler("pause", () => actionsRef.current.onPause());
    setActionHandler("stop", () => actionsRef.current.onStop());
    setActionHandler("previoustrack", () => actionsRef.current.onPrevious());
    setActionHandler("nexttrack", () => actionsRef.current.onNext());
    setActionHandler("seekbackward", details => seekBy(-offset(details)));
    setActionHandler("seekforward", details => seekBy(offset(details)));
    setActionHandler("seekto", details => {
      const audio = audioRef.current;
      const limit = audio ? seekLimit(audio) : 0;
      if (limit && typeof details.seekTime === "number" && Number.isFinite(details.seekTime)) actionsRef.current.onSeek(clamp(details.seekTime, 0, limit));
    });
    return () => {
      for (const action of registered) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* Optional action. */ }
      }
    };
  }, [audioRef]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      const mediaArtworkSrc = getRendererSafeImageUrl(song?.coverUrl);
      const artwork = mediaArtworkSrc
        ? ([{ src: mediaArtworkSrc }] as MediaImage[])
        : [];
      navigator.mediaSession.metadata = song
        ? new MediaMetadata({
          title: song.title || "Unknown song",
          artist: prettyMeta(song.artist) || "Unknown artist",
          album: song.album || "localtify",
          artwork
        })
        : null;
    } catch {
      // Native metadata is optional and must never interrupt playback.
    }
  }, [song?.id, song?.coverUrl, song?.title, song?.artist, song?.album]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try { navigator.mediaSession.playbackState = song ? (isPlaying ? "playing" : "paused") : "none"; } catch {}
  }, [song?.id, isPlaying]);

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
  }, [song?.id, duration, playbackSpeed, isPlaying, currentTime]);
}
