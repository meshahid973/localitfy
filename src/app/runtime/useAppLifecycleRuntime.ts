import { useEffect, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  initLocalitfyAnalytics,
  trackAcquisitionSource,
  trackAppActive,
  trackAppBackgrounded,
  trackAppForegrounded,
  trackAppLaunched,
  trackAppSessionEnded,
  trackError
} from "../../analytics";
import type { View } from "../../features/shell/view.types";

export type AppReturnRepairReason = "focus" | "visibility" | "background-tick";

type AppLifecycleRuntimeOptions = {
  appVersion: string;
  analyticsViewRef: RefObject<View>;
  appRootRef: RefObject<HTMLElement | null>;
  playingRef: RefObject<boolean>;
  setIsAppBackgrounded: Dispatch<SetStateAction<boolean>>;
  repairPlaybackAfterAppReturns: (reason: AppReturnRepairReason) => void;
};

export function useAppLifecycleRuntime({
  appVersion,
  analyticsViewRef,
  appRootRef,
  playingRef,
  setIsAppBackgrounded,
  repairPlaybackAfterAppReturns
}: AppLifecycleRuntimeOptions) {
  const analyticsSessionEndedRef = useRef(false);

  useEffect(() => {
    let analyticsLaunchCancelled = false;
    const analyticsLaunchTimer = window.setTimeout(() => {
      if (analyticsLaunchCancelled) return;
      const analyticsReady = initLocalitfyAnalytics(appVersion);

      if (analyticsReady) {
        trackAppLaunched({ initial_view: analyticsViewRef.current });
        trackAppActive({ reason: "launch", current_view: analyticsViewRef.current });
        trackAcquisitionSource({ source: "direct_app_launch", initial_view: analyticsViewRef.current });
      }
    }, 950);

    const finishAnalyticsSession = (reason: "beforeunload" | "unmount") => {
      if (analyticsSessionEndedRef.current) return;
      analyticsSessionEndedRef.current = true;
      trackAppSessionEnded({ reason, current_view: analyticsViewRef.current });
    };

    const handleBeforeUnload = () => {
      finishAnalyticsSession("beforeunload");
    };

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

    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsAppBackgrounded(hidden);

      if (hidden) {
        repairPlaybackAfterAppReturns("background-tick");
        trackAppBackgrounded({ reason: "visibility_hidden", current_view: analyticsViewRef.current });
        return;
      }

      repairPlaybackAfterAppReturns("visibility");
      repairHeroAmbienceAfterFocus();
      trackAppForegrounded({ reason: "visibility_visible", current_view: analyticsViewRef.current });
      trackAppActive({ reason: "visibility_visible", current_view: analyticsViewRef.current });
    };

    const handleFocus = () => {
      if (!document.hidden) {
        setIsAppBackgrounded(false);
        repairPlaybackAfterAppReturns("focus");
        repairHeroAmbienceAfterFocus();
      }
      trackAppActive({ reason: "window_focus", current_view: analyticsViewRef.current });
    };

    const handleBlur = () => {
      if (document.hidden) setIsAppBackgrounded(true);
      trackAppBackgrounded({ reason: "window_blur", current_view: analyticsViewRef.current });
    };

    const handleWindowError = (event: ErrorEvent) => {
      trackError("renderer_error", event.message || event.error?.name || "unknown renderer error", {
        current_view: analyticsViewRef.current
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "unknown rejection");
      trackError("unhandled_rejection", reason, { current_view: analyticsViewRef.current });
    };

    const heartbeatTimer = window.setInterval(() => {
      if (!document.hidden) {
        trackAppActive({ reason: "heartbeat", current_view: analyticsViewRef.current });
      }
    }, 300_000);

    const backgroundAudioKeeper = window.setInterval(() => {
      if (!document.hidden || !playingRef.current) return;
      repairPlaybackAfterAppReturns("background-tick");
    }, 1800);

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      analyticsLaunchCancelled = true;
      window.clearTimeout(analyticsLaunchTimer);
      if (focusRepairTimer) window.clearTimeout(focusRepairTimer);
      document.body.classList.remove("localtifyFocusRecovering");
      appRootRef.current?.classList.remove("localtifyHeroAmbienceRecovering");
      finishAnalyticsSession("unmount");
      window.clearInterval(heartbeatTimer);
      window.clearInterval(backgroundAudioKeeper);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
