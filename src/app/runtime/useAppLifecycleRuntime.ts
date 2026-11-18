import { useEffect, useLayoutEffect, useRef } from "react";
import type { MutableRefObject } from "react";

export type AppReturnRepairReason = "focus" | "visibility" | "background-tick";

type AppLifecycleRuntimeOptions = {
  isPlaying: boolean;
  appRootRef: MutableRefObject<HTMLElement | null>;
  playingRef: MutableRefObject<boolean>;
  setIsAppBackgrounded: (backgrounded: boolean) => void;
  repairPlaybackAfterAppReturns: (reason: AppReturnRepairReason) => void;
};

export function useAppLifecycleRuntime({
  isPlaying,
  appRootRef,
  playingRef,
  setIsAppBackgrounded,
  repairPlaybackAfterAppReturns
}: AppLifecycleRuntimeOptions) {
  const repairPlaybackAfterAppReturnsRef = useRef(repairPlaybackAfterAppReturns);

  useLayoutEffect(() => {
    repairPlaybackAfterAppReturnsRef.current = repairPlaybackAfterAppReturns;
  }, [repairPlaybackAfterAppReturns]);

  // Retain the existing safety net only during hidden playback, not while
  // browsing the foreground, paused or idle.
  useEffect(() => {
    if (!isPlaying) return;
    let backgroundAudioKeeper: number | null = null;
    const stop = () => {
      if (backgroundAudioKeeper !== null) window.clearInterval(backgroundAudioKeeper);
      backgroundAudioKeeper = null;
    };
    const sync = () => {
      if (!document.hidden) { stop(); return; }
      if (backgroundAudioKeeper !== null) return;
      backgroundAudioKeeper = window.setInterval(() => {
        if (!document.hidden || !playingRef.current) { stop(); return; }
        repairPlaybackAfterAppReturnsRef.current("background-tick");
      }, 1800);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => { stop(); document.removeEventListener("visibilitychange", sync); };
  }, [isPlaying, playingRef]);

  useEffect(() => {
    let focusRepairTimer = 0;

    const repairHeroAmbienceAfterFocus = () => {
      if (focusRepairTimer) window.clearTimeout(focusRepairTimer);

      document.body.classList.add("localtifyFocusRecovering");
      appRootRef.current?.classList.add("localtifyHeroAmbienceRecovering");

      focusRepairTimer = window.setTimeout(() => {
        document.body.classList.remove("localtifyFocusRecovering");
        appRootRef.current?.classList.remove("localtifyHeroAmbienceRecovering");
        focusRepairTimer = 0;
      }, 420);
    };

    const repairPlayback = (reason: AppReturnRepairReason) => {
      repairPlaybackAfterAppReturnsRef.current(reason);
    };

    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsAppBackgrounded(hidden);

      if (hidden) {
        repairPlayback("background-tick");
        return;
      }

      repairPlayback("visibility");
      repairHeroAmbienceAfterFocus();
    };

    const handleFocus = () => {
      if (!document.hidden) {
        setIsAppBackgrounded(false);
        repairPlayback("focus");
        repairHeroAmbienceAfterFocus();
      }
    };

    const handleBlur = () => {
      if (document.hidden) setIsAppBackgrounded(true);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (focusRepairTimer) window.clearTimeout(focusRepairTimer);
      document.body.classList.remove("localtifyFocusRecovering");
      appRootRef.current?.classList.remove("localtifyHeroAmbienceRecovering");
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
