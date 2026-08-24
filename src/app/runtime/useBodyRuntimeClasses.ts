import { useEffect } from "react";

type BodyRuntimeClassOptions = {
  isAppBackgrounded: boolean;
  isAppBackgroundedRef: { current: boolean };
  isPlaying: boolean;
  wantsMoreBlur: boolean;
};

const PERFORMANCE_CLASSES = [
  "localtifyPerfV301",
  "localtifyPerfV303",
  "localtifyPerfV307",
  "localtifyPerfV310",
  "localtifyPerfV319",
  "localtifyGpuFriendly"
] as const;

const OWNED_PERF_DATASETS = new Set(["v319", "v318", "v310", "v307", "v305", "v304", "v303", "v301"]);

export function useBodyRuntimeClasses({
  isAppBackgrounded,
  isAppBackgroundedRef,
  isPlaying,
  wantsMoreBlur
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
    body.classList.add(...PERFORMANCE_CLASSES);
    body.dataset.localtifyPerf = "v319";

    return () => {
      body.classList.remove(...PERFORMANCE_CLASSES);
      if (OWNED_PERF_DATASETS.has(String(body.dataset.localtifyPerf || ""))) {
        delete body.dataset.localtifyPerf;
      }
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("localtifyAudioPlaying", isPlaying);
    return () => document.body.classList.remove("localtifyAudioPlaying");
  }, [isPlaying]);

  useEffect(() => {
    const body = document.body;
    body.classList.toggle("localtifyWantMoreBlur", wantsMoreBlur);
    body.classList.toggle("localtifyNoMoreBlur", !wantsMoreBlur);

    return () => {
      body.classList.remove("localtifyWantMoreBlur");
      body.classList.remove("localtifyNoMoreBlur");
    };
  }, [wantsMoreBlur]);
}
