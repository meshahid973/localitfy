import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("App is fully typechecked and delegates feature runtime ownership", () => {
  const app = read("src/App.tsx");
  assert.equal(app.includes("@ts-nocheck"), false);
  for (const controller of [
    "useCoversController",
    "useLibraryController",
    "useSettingsController",
    "useFeedbackController",
    "useScreensaverController",
    "useAnalyticsRuntime",
    "usePlayerRuntime"
  ]) assert.match(app, new RegExp(`\\b${controller}\\b`));
});

test("feature controllers do not depend on the renderer monolith", () => {
  const controllerFiles = [
    "src/features/covers/useCoversController.ts",
    "src/features/library/useLibraryController.ts",
    "src/features/settings/useSettingsController.ts",
    "src/features/feedback/useFeedbackController.ts",
    "src/features/shell/useScreensaverController.ts",
    "src/features/analytics/useAnalyticsRuntime.ts",
    "src/features/player/usePlayerRuntime.ts"
  ];
  for (const file of controllerFiles) {
    const source = read(file);
    assert.equal(source.includes('from "../../App"'), false, file);
    assert.equal(source.includes('from "../App"'), false, file);
    assert.equal(source.includes("@ts-nocheck"), false, file);
  }
});


test("playback checkpoint loop re-arms on visibility and reads the latest position preference", () => {
  const app = read("src/App.tsx");
  const loop = read("src/features/player/usePlayerRuntime.ts").split("export function usePlaybackProgressLoop")[1];
  assert.match(loop, /if \(document.hidden \|\| isBackgrounded\(\)\) tick\(performance.now\(\)\)/);
  assert.match(loop, /const handleProgressVisibility = \(\) => \{\s*stopProgressLoop\(\)/);
  assert.match(loop, /scheduleProgressTick\(document.hidden \? 1800 : 0\)/);
  assert.match(loop, /document.removeEventListener\("visibilitychange", handleProgressVisibility\)/);
  assert.match(app, /settingsRef.current.rememberPlaybackPosition/);
});
