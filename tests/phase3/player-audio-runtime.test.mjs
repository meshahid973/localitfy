import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("audio effects are typed and owned by the player runtime", () => {
  const settingsTypes = read("src/features/settings/settings.types.ts");
  const settingsDefaults = read("src/features/settings/settings.constants.ts");
  const runtime = read("src/features/player/audio/audioEffectRuntime.ts");
  const playerRuntime = read("src/features/player/usePlayerRuntime.ts");
  const app = read("src/App.tsx");

  assert.match(settingsTypes, /audioEffectMode:\s*AudioEffectMode/);
  assert.match(settingsTypes, /audioEffectAmount:\s*number/);
  assert.match(settingsTypes, /audioReverbAmount:\s*number/);
  assert.match(settingsDefaults, /audioEffectMode:\s*"normal"/);
  assert.match(settingsDefaults, /audioReverbAmount:\s*38/);

  assert.match(runtime, /class AudioEffectRuntime/);
  assert.match(runtime, /source\.connect\(this\.dryGain\)/);
  assert.match(runtime, /source\.connect\(this\.delay\)/);
  assert.match(runtime, /this\.feedback\.connect\(this\.delay\)/);
  assert.match(runtime, /requestedReverb/);

  assert.match(playerRuntime, /new AudioEffectRuntime\(\)/);
  assert.match(playerRuntime, /audioEffectRuntimeRef/);
  assert.doesNotMatch(app, /import \{ AudioEffectRuntime \}/);
  assert.doesNotMatch(app, /new AudioEffectRuntime\(\)/);
  assert.match(app, /audioEffectRuntimeRef/);
  assert.match(app, /effectiveVolumeRef/);
  assert.doesNotMatch(app, /beatAudioContextRef|audioEffectDryGainRef|audioEffectWetGainRef|audioEffectDelayRef|audioEffectFeedbackGainRef|audioEffectFilterRef/);
});

test("focus and visibility repairs use the latest playback callback", () => {
  const lifecycle = read("src/app/runtime/useAppLifecycleRuntime.ts");
  assert.match(lifecycle, /useLayoutEffect\(\(\) => \{/);
  assert.match(lifecycle, /repairPlaybackAfterAppReturnsRef\.current\s*=\s*repairPlaybackAfterAppReturns/);
  assert.match(lifecycle, /repairPlaybackAfterAppReturnsRef\.current\(reason\)/);
});

test("slowed plus reverb is a real playback setting instead of dead App state", () => {
  const playbackSettings = read("src/features/settings/categories/PlaybackSettings.tsx");
  const app = read("src/App.tsx");
  assert.match(playbackSettings, />slowed \+ reverb</);
  assert.match(playbackSettings, /audioReverbAmount/);
  assert.doesNotMatch(app, /function getAudioReverbAmount\(\)\s*\{\s*return 0/);
  assert.doesNotMatch(app, /\(settings as any\)\.audioEffectMode/);
});
