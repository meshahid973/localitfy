import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const appPath = path.join(root, "src/App.tsx");
let source = fs.readFileSync(appPath, "utf8");

function replaceOnce(label, needle, replacement) {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`[audio-migration] ${label}: expected source not found`);
  if (source.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`[audio-migration] ${label}: expected a single source match`);
  }
  source = source.slice(0, index) + replacement + source.slice(index + needle.length);
}

function replaceRegexOnce(label, pattern, replacement) {
  const matches = [...source.matchAll(new RegExp(pattern.source, `${pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`}`))];
  if (matches.length !== 1) throw new Error(`[audio-migration] ${label}: expected 1 match, found ${matches.length}`);
  source = source.replace(pattern, replacement);
}

replaceOnce(
  "audio runtime import",
  'import { usePlayerRuntime } from "./features/player";\n',
  'import { usePlayerRuntime } from "./features/player";\nimport { AudioEffectRuntime } from "./features/player/audio/audioEffectRuntime";\n'
);

replaceOnce(
  "player runtime refs",
  `    lastQueueHistoryRef, songRef, timeRef, durationRef, playingRef, volumeRef, lastNonZeroVolumeRef,\n    beatFrameRef, beatFrameTimerRef, beatAudioContextRef, beatAnalyserRef, beatSourceRef,\n    audioEffectDryGainRef, audioEffectWetGainRef, audioEffectDelayRef, audioEffectFeedbackGainRef,\n    audioEffectFilterRef, beatDataRef, beatSmoothRef, beatReactiveTargetCacheRef, beatLastPaintSignatureRef,\n`,
  `    lastQueueHistoryRef, songRef, timeRef, durationRef, playingRef, volumeRef, effectiveVolumeRef, lastNonZeroVolumeRef,\n    beatFrameRef, beatFrameTimerRef, audioEffectRuntimeRef,\n    beatSmoothRef, beatReactiveTargetCacheRef, beatLastPaintSignatureRef,\n`
);

replaceRegexOnce(
  "legacy audio effect owner",
  /  function getAudioEffectMode\(\) \{[\s\S]*?\n  function setAudioElementVolume/,
  `  function getAudioEffectRuntime() {\n    if (!audioEffectRuntimeRef.current) {\n      audioEffectRuntimeRef.current = new AudioEffectRuntime();\n    }\n    return audioEffectRuntimeRef.current;\n  }\n\n  function getAudioEffectInput() {\n    return {\n      mode: settings.audioEffectMode,\n      baseRate: settings.playbackSpeed,\n      effectAmount: settings.audioEffectAmount,\n      reverbAmount: settings.audioReverbAmount\n    };\n  }\n\n  function disposeAudioEngine() {\n    audioEffectRuntimeRef.current?.dispose();\n    audioEffectRuntimeRef.current = null;\n  }\n\n  function setAudioElementVolume`
);

replaceRegexOnce(
  "legacy rate and graph helpers",
  /  function getEffectivePlaybackRate\(\) \{[\s\S]*?\n  const getTargetAudioVolume = useCallback/,
  `  function applyPlaybackRateSettings(audio: HTMLAudioElement | null | undefined) {\n    if (!audio) return;\n    getAudioEffectRuntime().apply(audio, getAudioEffectInput());\n  }\n\n  function syncAudioEffectGraph(audio: HTMLAudioElement | null | undefined) {\n    if (!audio || audio !== audioRef.current) return;\n    getAudioEffectRuntime().apply(audio, getAudioEffectInput());\n  }\n\n  const getTargetAudioVolume = useCallback`
);

replaceRegexOnce(
  "beat analyser owner",
  /    const ensureAnalyser = \(\) => \{[\s\S]*?\n    \};\n\n    const getBeatTargets/,
  `    const ensureAnalyser = () => {\n      const audio = audioRef.current;\n      if (!audio) return null;\n      return getAudioEffectRuntime().ensureAnalyser(audio, getAudioEffectInput());\n    };\n\n    const getBeatTargets`
);

replaceOnce(
  "beat context resume",
  `    const context = beatAudioContextRef.current;\n    if (context?.state === "suspended") {\n      void context.resume().catch(() => undefined);\n    }\n`,
  `    void audioEffectRuntimeRef.current?.resume();\n`
);

replaceOnce(
  "beat analyser snapshot",
  `        const analyser = ensureAnalyser();\n        const data = analyser ? beatDataRef.current : null;\n`,
  `        const analyserSnapshot = ensureAnalyser();\n        const analyser = analyserSnapshot?.analyser ?? null;\n        const data = analyserSnapshot?.data ?? null;\n`
);

replaceOnce(
  "beat effect dependencies",
  `  }, [ready, isPlaying, currentSong?.id, settings.animatedGlow, settings.reducedMotion, settings.volume, view, settingsCategory, isViewSwitching, isSeeking, isVolumeDragging]);`,
  `  }, [ready, isPlaying, currentSong?.id, settings.animatedGlow, settings.reducedMotion, settings.volume, settings.playbackSpeed, settings.audioEffectMode, settings.audioEffectAmount, settings.audioReverbAmount, view, settingsCategory, isViewSwitching, isSeeking, isVolumeDragging]);`
);

replaceOnce(
  "resume audio context",
  `  function resumeAudioContextSafely() {\n    const context = beatAudioContextRef.current;\n    if (!context || context.state !== "suspended") return;\n    void context.resume().catch(() => undefined);\n  }`,
  `  function resumeAudioContextSafely() {\n    void audioEffectRuntimeRef.current?.resume();\n  }`
);

replaceOnce(
  "return repair graph",
  `    applyPlaybackRateSettings(audio);\n    setAudioElementVolume(audio, getTargetAudioVolume(songRef.current));`,
  `    applyPlaybackRateSettings(audio);\n    const repairedVolume = getTargetAudioVolume(songRef.current);\n    setAudioElementVolume(audio, repairedVolume);\n    effectiveVolumeRef.current = repairedVolume;\n    syncAudioEffectGraph(audio);`
);

replaceOnce(
  "apply quality runtime",
  `      setAudioElementVolume(audio, safeVolume);\n      applyPlaybackRateSettings(audio);\n      audio.preload = settings.gaplessPlayback ? "auto" : "metadata";\n      volumeRef.current = safeVolume;\n      return safeVolume;`,
  `      setAudioElementVolume(audio, safeVolume);\n      applyPlaybackRateSettings(audio);\n      syncAudioEffectGraph(audio);\n      audio.preload = settings.gaplessPlayback ? "auto" : "metadata";\n      effectiveVolumeRef.current = safeVolume;\n      return safeVolume;`
);

replaceOnce(
  "apply quality dependencies",
  `      settings.playbackSpeed,\n      settings.gaplessPlayback,\n      (settings as any).audioEffectMode\n`,
  `      settings.playbackSpeed,\n      settings.gaplessPlayback,\n      settings.audioEffectMode,\n      settings.audioEffectAmount,\n      settings.audioReverbAmount\n`
);

// Effective element volume is allowed to change during normalization/fades/crossfade.
// Master/user volume must not be overwritten by those transient values.
source = source
  .replaceAll("volumeRef.current = safeVolume;", "effectiveVolumeRef.current = safeVolume;")
  .replaceAll("volumeRef.current = handoffVolume;", "effectiveVolumeRef.current = handoffVolume;")
  .replaceAll("volumeRef.current = safeTarget;", "effectiveVolumeRef.current = safeTarget;")
  .replaceAll("volumeRef.current = nextVolume;", "effectiveVolumeRef.current = nextVolume;");

// The master volume sync is intentionally restored after the broad transient replacement.
replaceOnce(
  "master volume settings sync",
  `    playingRef.current = isPlaying;\n    effectiveVolumeRef.current = settings.volume;\n\n    if (settings.volume > 0.01) {`,
  `    playingRef.current = isPlaying;\n    volumeRef.current = settings.volume;\n\n    if (settings.volume > 0.01) {`
);

replaceOnce(
  "master volume immediate update",
  `    const safePercent = Math.round(safeVolume * 100);\n    const nextSettings = { ...settings, volume: safeVolume };\n\n    volumeDraftRef.current = safePercent;`,
  `    const safePercent = Math.round(safeVolume * 100);\n    const nextSettings = { ...settings, volume: safeVolume };\n\n    volumeRef.current = safeVolume;\n    volumeDraftRef.current = safePercent;`
);

replaceOnce(
  "beat visual effective volume",
  `        const safeVolume = clamp(volumeRef.current || settings.volume || 0.75, 0.16, 1);`,
  `        const safeVolume = clamp(effectiveVolumeRef.current || volumeRef.current || settings.volume || 0.75, 0.16, 1);`
);

for (const deadName of [
  "beatAudioContextRef",
  "beatAnalyserRef",
  "beatSourceRef",
  "audioEffectDryGainRef",
  "audioEffectWetGainRef",
  "audioEffectDelayRef",
  "audioEffectFeedbackGainRef",
  "audioEffectFilterRef",
  "beatDataRef",
  "getAudioEffectMode",
  "getAudioEffectAmount",
  "getAudioReverbAmount",
  "getEffectivePlaybackRate"
]) {
  if (source.includes(deadName)) throw new Error(`[audio-migration] stale legacy symbol remains: ${deadName}`);
}

if (!source.includes("effectiveVolumeRef.current = repairedVolume;")) {
  throw new Error("[audio-migration] focus repair did not receive effective-volume ownership");
}
if (!source.includes("syncAudioEffectGraph(audio);")) {
  throw new Error("[audio-migration] effect graph sync missing");
}

fs.writeFileSync(appPath, source);
console.log("[audio-migration] App.tsx now delegates effects to AudioEffectRuntime and separates master/effective volume");
