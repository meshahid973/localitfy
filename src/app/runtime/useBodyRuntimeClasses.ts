import { useEffect } from "react";

type BodyRuntimeClassOptions = {
  isAppBackgrounded: boolean;
  isAppBackgroundedRef: { current: boolean };
  isPlaying: boolean;
};

const PERFORMANCE_CLASS = "localtifyPerf";
const PERFORMANCE_DATASET = "current";
const LEGACY_PERFORMANCE_CLASSES = [
  "localtifyPerfV301",
  "localtifyPerfV303",
  "localtifyPerfV305",
  "localtifyPerfV307",
  "localtifyPerfV310",
  "localtifyPerfV319",
  "localtifyGpuFriendly"
] as const;

export function useBodyRuntimeClasses({
  isAppBackgrounded,
  isAppBackgroundedRef,
  isPlaying
}: BodyRuntimeClassOptions) {
  useEffect(() => {
    const body = document.body;
    const syncFocusClass = () => {
      const backgrounded = document.hidden || !document.hasFocus();
      body.classList.toggle("localtifyWindowBackgrounded", backgrounded);
    };

    syncFocusClass();
    window.addEventListener("focus", syncFocusClass);
    window.addEventListener("blur", syncFocusClass);
    document.addEventListener("visibilitychange", syncFocusClass);

    return () => {
      window.removeEventListener("focus", syncFocusClass);
      window.removeEventListener("blur", syncFocusClass);
      document.removeEventListener("visibilitychange", syncFocusClass);
      body.classList.remove("localtifyWindowBackgrounded");
    };
  }, []);

  useEffect(() => {
    isAppBackgroundedRef.current = isAppBackgrounded;
    document.body.classList.toggle("localtifyBackgroundMode", isAppBackgrounded);
    return () => document.body.classList.remove("localtifyBackgroundMode");
  }, [isAppBackgrounded, isAppBackgroundedRef]);

  useEffect(() => {
    const body = document.body;

    body.classList.remove(...LEGACY_PERFORMANCE_CLASSES);
    body.classList.add(PERFORMANCE_CLASS);
    body.dataset.localtifyPerf = PERFORMANCE_DATASET;

    return () => {
      body.classList.remove(PERFORMANCE_CLASS, ...LEGACY_PERFORMANCE_CLASSES);
      if (body.dataset.localtifyPerf === PERFORMANCE_DATASET) delete body.dataset.localtifyPerf;
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("localtifyAudioPlaying", isPlaying);
    return () => document.body.classList.remove("localtifyAudioPlaying");
  }, [isPlaying]);
}
