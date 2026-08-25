import { useEffect, useLayoutEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { View } from "../../features/shell/view.types";

export type AppReturnRepairReason = "focus" | "visibility" | "background-tick";

type LifecycleAnalytics = {
  init: (appVersion: string) => boolean;
  appLaunched: (properties: { initial_view: View }) => void;
  appSessionEnded: (properties: { reason: "beforeunload" | "unmount"; current_view: View }) => void;
  appActive: (properties: { reason: string; current_view: View }) => void;
  appBackgrounded: (properties: { reason: string; current_view: View }) => void;
  appForegrounded: (properties: { reason: string; current_view: View }) => void;
  acquisitionSource: (properties: { source: string; initial_view: View }) => void;
  error: (name: string, message: string, properties: { current_view: View }) => void;
};

type AppLifecycleRuntimeOptions = {
  appVersion: string;
  analytics: LifecycleAnalytics;
  analyticsViewRef: MutableRefObject<View>;
  appRootRef: MutableRefObject<HTMLElement | null>;
  playingRef: MutableRefObject<boolean>;
  setIsAppBackgrounded: (backgrounded: boolean) => void;
  repairPlaybackAfterAppReturns: (reason: AppReturnRepairReason) => void;
};

export function useAppLifecycleRuntime({
  appVersion,
  analytics,
  analyticsViewRef,
  appRootRef,
  playingRef,
  setIsAppBackgrounded,
  repairPlaybackAfterAppReturns
}: AppLifecycleRuntimeOptions) {
  const analyticsSessionEndedRef = useRef(false);
  const repairPlaybackAfterAppReturnsRef = useRef(repairPlaybackAfterAppReturns);

  useLayoutEffect(() => {
    repairPlaybackAfterAppReturnsRef.current = repairPlaybackAfterAppReturns;
  }, [repairPlaybackAfterAppReturns]);

  useEffect(() => {
    let analyticsLaunchCancelled = false;
    const analyticsLaunchTimer = window.setTimeout(() => {
      if (analyticsLaunchCancelled) return;
      const analyticsReady = analytics.init(appVersion);

      if (analyticsReady) {
        analytics.appLaunched({ initial_view: analyticsViewRef.current });
        analytics.appActive({ reason: "launch", current_view: analyticsViewRef.current });
        analytics.acquisitionSource({ source: "direct_app_launch", initial_view: analyticsViewRef.current });
      }
    }, 950);

    const finishAnalyticsSession = (reason: "beforeunload" | "unmount") => {
      if (analyticsSessionEndedRef.current) return;
      analyticsSessionEndedRef.current = true;
      analytics.appSessionEnded({ reason, current_view: analyticsViewRef.current });
    };

    const handleBeforeUnload = () => finishAnalyticsSession("beforeunload");
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
        analytics.appBackgrounded({ reason: "visibility_hidden", current_view: analyticsViewRef.current });
        return;
      }

      repairPlayback("visibility");
      repairHeroAmbienceAfterFocus();
      analytics.appForegrounded({ reason: "visibility_visible", current_view: analyticsViewRef.current });
      analytics.appActive({ reason: "visibility_visible", current_view: analyticsViewRef.current });
    };

    const handleFocus = () => {
      if (!document.hidden) {
        setIsAppBackgrounded(false);
        repairPlayback("focus");
        repairHeroAmbienceAfterFocus();
      }
      analytics.appActive({ reason: "window_focus", current_view: analyticsViewRef.current });
    };

    const handleBlur = () => {
      if (document.hidden) setIsAppBackgrounded(true);
      analytics.appBackgrounded({ reason: "window_blur", current_view: analyticsViewRef.current });
    };

    const handleWindowError = (event: ErrorEvent) => {
      analytics.error("renderer_error", event.message || event.error?.name || "unknown renderer error", {
        current_view: analyticsViewRef.current
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "unknown rejection");
      analytics.error("unhandled_rejection", reason, { current_view: analyticsViewRef.current });
    };

    const heartbeatTimer = window.setInterval(() => {
      if (!document.hidden) analytics.appActive({ reason: "heartbeat", current_view: analyticsViewRef.current });
    }, 300_000);

    const backgroundAudioKeeper = window.setInterval(() => {
      if (!document.hidden || !playingRef.current) return;
      repairPlayback("background-tick");
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
