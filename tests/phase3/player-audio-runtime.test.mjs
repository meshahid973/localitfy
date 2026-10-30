import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
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
  assert.match(playbackSettings, /value: "daycore" as AudioEffectMode, label: "slowed \+ reverb"/);
  assert.match(playbackSettings, /audioReverbAmount/);
  assert.doesNotMatch(app, /function getAudioReverbAmount\(\)\s*\{\s*return 0/);
  assert.doesNotMatch(app, /\(settings as any\)\.audioEffectMode/);
});

test("Web Audio does not attach a silent suspended graph or close on StrictMode replay", () => {
  const fx = read("src/features/player/audio/audioEffectRuntime.ts");
  const hook = read("src/features/player/usePlayerRuntime.ts");
  const app = read("src/App.tsx");
  assert.match(fx, /this\.context\.state !== "running"/);
  assert.match(hook, /audioEffectMountGenerationRef\.current !== mountGeneration/);
  assert.match(hook, /queueMicrotask\(/);
  assert.doesNotMatch(app, /function disposeAudioEngine\(/);
});

test("incoming track ignores stale play and old outgoing pause events", () => {
  const element = read("src/features/player/components/PlaybackAudioElement.tsx");
  const app = read("src/App.tsx");
  assert.match(element, /if \(!pendingPlayRef\.current\) return;/);
  assert.match(app, /pendingPlayRef\.current && \["loading", "ready"\]/);
});

test("suspended Web Audio must not intercept audible HTML audio before resuming", async () => {
  let sourceConnections = 0;
  const node = () => ({ connect() {}, disconnect() {} });
  const param = () => ({ value: 0, cancelScheduledValues() {}, setTargetAtTime(value) { this.value = value; } });
  class FakeAudioContext {
    state = "suspended";
    currentTime = 0;
    destination = node();
    async resume() { this.state = "running"; }
    async close() { this.state = "closed"; }
    createMediaElementSource() { sourceConnections++; return node(); }
    createGain() { return { ...node(), gain: param() }; }
    createDelay() { return { ...node(), delayTime: param() }; }
    createBiquadFilter() { return { ...node(), frequency: param(), Q: param() }; }
  }
  const source = read("src/features/player/audio/audioEffectRuntime.ts");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("exports", "require", "window", output)(
    exports,
    () => ({ clampFinite: (value, min, max) => Math.max(min, Math.min(max, value)) }),
    { AudioContext: FakeAudioContext }
  );
  const runtime = new exports.AudioEffectRuntime();
  const audio = { playbackRate: 1 };
  const profile = { mode: "daycore", baseRate: 1, reverbAmount: 40 };
  runtime.apply(audio, profile);
  assert.equal(sourceConnections, 0, "a suspended context must not intercept sound");
  await Promise.resolve();
  runtime.apply(audio, profile);
  assert.equal(sourceConnections, 1, "once resumed, the effects graph connects exactly once");
  runtime.apply(audio, profile);
  assert.equal(sourceConnections, 1, "reusing effects does not create another media source");
  runtime.dispose();
});

test("native pause and stop cancel the secondary audio first", () => {
  const app = read("src/App.tsx");
  assert.match(app, /function stopPlaybackFromNative\(\) \{\s*stopCrossfadeAuto\(\);\s*playbackTransitionRef\.current\.requestPause\(\)/);
  assert.match(app, /function pauseAudioSmooth\(\) \{\s*stopCrossfadeAuto\(\);\s*playbackTransitionRef\.current\.requestPause\(\)/);
  assert.match(app, /if \(command\.type === "pause"\) \{ stopCrossfadeAuto\(\);/);
});

test("stale media pause/play events are ignored when current element state disagrees", () => {
  const app = read("src/App.tsx");
  assert.match(app, /handleAudioPause\(\) \{\s*if \(audioRef\.current && !audioRef\.current\.paused\) return;/);
  assert.match(app, /handlePlaying\(\) \{\s*if \(audioRef\.current\?\.paused\) return;/);
});

test("focus repair does not resurrect audio after a newer pause or track switch", () => {
  const app = read("src/App.tsx");
  assert.match(app, /const repairGeneration = playbackTransitionRef\.current\.snapshot\(\)\.generation;/);
  assert.match(app, /generation !== repairGeneration/);
  assert.match(app, /phase === "paused"\) audio\.pause\(\)/);
});
