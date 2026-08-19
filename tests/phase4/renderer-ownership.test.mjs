import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("App delegates platform and policy helpers to owned modules", () => {
  const app = read("src/App.tsx");
  assert.match(app, /from "\.\/app\/platform"/);
  assert.match(app, /from "\.\/features\/settings\/visualCustomization"/);
  assert.match(app, /from "\.\/features\/onboarding\/onboardingRelease"/);
  assert.match(app, /from "\.\/features\/settings\/customThemePersistence"/);
  assert.doesNotMatch(app, /function getLocaltifyPlatformInfo/);
  assert.doesNotMatch(app, /const VISUAL_CUSTOMIZATION_DEFAULTS/);
  assert.doesNotMatch(app, /CUSTOM_THEME_UPDATE_BACKUP_KEY/);
});

test("App delegates analytics formatting, feedback policy, idle scheduling and player icon", () => {
  const app = read("src/App.tsx");
  assert.match(app, /features\/analytics\/formatters/);
  assert.match(app, /features\/feedback\/feedbackPrompt/);
  assert.match(app, /app\/runtime\/idle/);
  assert.match(app, /features\/player\/PlayerPlayPauseMorphIcon/);
  assert.doesNotMatch(app, /function localtifyAnalyticsNumber/);
  assert.doesNotMatch(app, /function runLocaltifyIdleTask/);
});
