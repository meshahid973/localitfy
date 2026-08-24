import { useEffect, useRef, useState } from "react";

type ScreensaverControllerOptions = {
  currentSongId: string | null;
  isPlaying: boolean;
  animeVisuals: boolean;
  animatedBackgrounds: boolean;
};

export function useScreensaverController({
  currentSongId,
  isPlaying,
  animeVisuals,
  animatedBackgrounds
}: ScreensaverControllerOptions) {
  const [now, setNow] = useState(new Date());
  const [screensaverVisible, setScreensaverVisible] = useState(false);
  const [screensaverPreviewActive, setScreensaverPreviewActive] = useState(false);
  const screensaverTimerRef = useRef<number | null>(null);
  const screensaverPreviewTimerRef = useRef<number | null>(null);
  const screensaverIgnoreActivityUntilRef = useRef(0);

  useEffect(() => {
    const clearScreensaverTimer = () => {
      if (screensaverTimerRef.current) {
        window.clearTimeout(screensaverTimerRef.current);
        screensaverTimerRef.current = null;
      }
    };

    const canShowScreensaver = screensaverPreviewActive || (animeVisuals && animatedBackgrounds && !isPlaying);

    const armScreensaverTimer = () => {
      clearScreensaverTimer();
      if (!canShowScreensaver) return;
      screensaverTimerRef.current = window.setTimeout(() => {
        screensaverIgnoreActivityUntilRef.current = Date.now() + 1000;
        setScreensaverPreviewActive(false);
        setScreensaverVisible(true);
      }, 5 * 60 * 1000);
    };

    let lastPointerMoveAt = 0;

    const handleUserActivity = () => {
      if (Date.now() < screensaverIgnoreActivityUntilRef.current) return;
      setScreensaverVisible(false);
      armScreensaverTimer();
    };

    const handlePointerMoveActivity = () => {
      const now = Date.now();
      if (!screensaverVisible && now - lastPointerMoveAt < 1400) return;
      lastPointerMoveAt = now;
      handleUserActivity();
    };

    if (!canShowScreensaver) {
      setScreensaverVisible(false);
      clearScreensaverTimer();
      return clearScreensaverTimer;
    }

    armScreensaverTimer();
    window.addEventListener("pointerdown", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("wheel", handleUserActivity, { passive: true });
    window.addEventListener("pointermove", handlePointerMoveActivity, { passive: true });

    return () => {
      clearScreensaverTimer();
      window.removeEventListener("pointerdown", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("wheel", handleUserActivity);
      window.removeEventListener("pointermove", handlePointerMoveActivity);
    };
  }, [currentSongId, isPlaying, screensaverPreviewActive, screensaverVisible, animeVisuals, animatedBackgrounds]);

  return {
    now, setNow,
    screensaverVisible, setScreensaverVisible,
    screensaverPreviewActive, setScreensaverPreviewActive,
    screensaverTimerRef,
    screensaverPreviewTimerRef,
    screensaverIgnoreActivityUntilRef
  };
}
