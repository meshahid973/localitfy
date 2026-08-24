import fs from "node:fs";

const appPath = "src/App.tsx";
let source = fs.readFileSync(appPath, "utf8");

function requireReplace(search, replacement, label) {
  if (!source.includes(search)) {
    if (replacement && source.includes(replacement.trim())) return;
    throw new Error(`[r1-lifecycle] could not find ${label}`);
  }
  source = source.replace(search, replacement);
}

const analyticsImport = `import {
  initLocalitfyAnalytics,
  trackAppLaunched,
  trackAppSessionEnded,
  trackAppActive,
  trackAppBackgrounded,
  trackAppForegrounded,
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
  trackError,
  trackAcquisitionSource
} from "./analytics";`;

const reducedAnalyticsImport = `import {
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

requireReplace(analyticsImport, reducedAnalyticsImport, "analytics import block");
requireReplace(
  'import { useBodyRuntimeClasses } from "./app/runtime/useBodyRuntimeClasses";\n',
  'import { useBodyRuntimeClasses } from "./app/runtime/useBodyRuntimeClasses";\nimport { useAppLifecycleRuntime } from "./app/runtime/useAppLifecycleRuntime";\n',
  "lifecycle runtime import insertion"
);
requireReplace(
  '  const analyticsSessionEndedRef = useRef(false);\n',
  "",
  "analytics session ref"
);

const effectStart = '  useEffect(() => {\n    let analyticsLaunchCancelled = false;';
const effectEndMarker = '  }, []);\n\n  // V313: onboarding is now a true first-run mini-app.';
const start = source.indexOf(effectStart);
const end = source.indexOf(effectEndMarker, start);

const hookCall = `  useAppLifecycleRuntime({
    appVersion: APP_VERSION,
    analyticsViewRef,
    appRootRef,
    playingRef,
    setIsAppBackgrounded,
    repairPlaybackAfterAppReturns
  });

  // V313: onboarding is now a true first-run mini-app.`;

if (start < 0 || end < 0) {
  if (!source.includes("useAppLifecycleRuntime({")) {
    throw new Error("[r1-lifecycle] could not locate lifecycle effect");
  }
} else {
  source = source.slice(0, start) + hookCall + source.slice(end + effectEndMarker.length);
}

for (const legacyName of [
  "initLocalitfyAnalytics",
  "trackAppLaunched",
  "trackAppSessionEnded",
  "trackAppActive",
  "trackAppBackgrounded",
  "trackAppForegrounded",
  "trackAcquisitionSource"
]) {
  if (new RegExp(`\\b${legacyName}\\b`).test(source)) {
    throw new Error(`[r1-lifecycle] App.tsx still owns lifecycle analytics symbol ${legacyName}`);
  }
}

if (source.includes("analyticsSessionEndedRef")) {
  throw new Error("[r1-lifecycle] App.tsx still owns analyticsSessionEndedRef");
}

fs.writeFileSync(appPath, source);
console.log("[r1-lifecycle] App lifecycle orchestration moved to app/runtime");
