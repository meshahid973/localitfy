import fs from "node:fs";

const appPath = "src/App.tsx";
let source = fs.readFileSync(appPath, "utf8");

const analyticsImportEnd = '} from "./analytics";';
const analyticsEnd = source.indexOf(analyticsImportEnd);
if (analyticsEnd < 0) throw new Error("[r1-lifecycle] analytics import not found");
const analyticsStart = source.lastIndexOf("import {", analyticsEnd);
if (analyticsStart < 0) throw new Error("[r1-lifecycle] analytics import start not found");
const analyticsReplacement = `import {
  initLocalitfyAnalytics,
  trackAcquisitionSource,
  trackAppActive,
  trackAppBackgrounded,
  trackAppForegrounded,
  trackAppLaunched,
  trackAppSessionEnded,
  trackAppView,
  trackSettingsOpened,
  trackThemeChanged,
  trackSongsImported,
  trackImportFailed,
  trackLibrarySnapshot,
  trackLibraryViewChanged,
  trackDownloadsOpened,
  trackDiscordToggled,
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  trackError
} from "./analytics";`;
source = source.slice(0, analyticsStart) + analyticsReplacement + source.slice(analyticsEnd + analyticsImportEnd.length);

const oldCall = `  useAppLifecycleRuntime({
    appVersion: APP_VERSION,
    analyticsViewRef,
    appRootRef,
    playingRef,
    setIsAppBackgrounded,
    repairPlaybackAfterAppReturns
  });`;
const newCall = `  useAppLifecycleRuntime({
    appVersion: APP_VERSION,
    analytics: {
      init: initLocalitfyAnalytics,
      appLaunched: trackAppLaunched,
      appSessionEnded: trackAppSessionEnded,
      appActive: trackAppActive,
      appBackgrounded: trackAppBackgrounded,
      appForegrounded: trackAppForegrounded,
      acquisitionSource: trackAcquisitionSource,
      error: trackError
    },
    analyticsViewRef,
    appRootRef,
    playingRef,
    setIsAppBackgrounded,
    repairPlaybackAfterAppReturns
  });`;
if (!source.includes(oldCall)) {
  if (!source.includes(newCall)) throw new Error("[r1-lifecycle] lifecycle hook call not found");
} else {
  source = source.replace(oldCall, newCall);
}

if (source.includes("let analyticsLaunchCancelled = false")) {
  throw new Error("[r1-lifecycle] old lifecycle effect still exists in App.tsx");
}
if (!source.includes('from "./app/runtime/useAppLifecycleRuntime"')) {
  throw new Error("[r1-lifecycle] lifecycle runtime import missing");
}

fs.writeFileSync(appPath, source);
console.log("[r1-lifecycle] App.tsx lifecycle orchestration is owned by app/runtime");
