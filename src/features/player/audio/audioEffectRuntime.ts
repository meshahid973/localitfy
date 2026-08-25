import type { AudioEffectMode } from "../../settings/settings.types";

export type AudioEffectProfileInput = {
  mode: AudioEffectMode | string | null | undefined;
  baseRate: number;
  effectAmount?: number;
  reverbAmount?: number;
};

export type AudioEffectProfile = {
  mode: AudioEffectMode;
  playbackRate: number;
  preservesPitch: boolean;
  dryGain: number;
  wetGain: number;
  delaySeconds: number;
  feedbackGain: number;
  lowpassHz: number;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeAudioEffectMode(value: unknown): AudioEffectMode {
  const mode = String(value || "normal")
    .trim()
    .replace(/[\s_+-]+/g, "")
    .toLowerCase();

  if (["nightcore", "spedup", "speedup"].includes(mode)) return "nightcore";
  if (["daycore", "slowed", "slowedreverb", "slowreverb"].includes(mode)) return "daycore";
  return "normal";
}

export function getAudioEffectProfile({
  mode: rawMode,
  baseRate,
  effectAmount = 50,
  reverbAmount = 38
}: AudioEffectProfileInput): AudioEffectProfile {
  const mode = normalizeAudioEffectMode(rawMode);
  const safeBaseRate = clamp(Number(baseRate) || 1, 0.5, 2);
  const effect = clamp(Number(effectAmount) || 0, 0, 100) / 100;
  const requestedReverb = mode === "daycore" ? clamp(Number(reverbAmount) || 0, 0, 100) / 100 : 0;

  let playbackRate = safeBaseRate;
  let preservesPitch = true;

  if (mode === "nightcore") {
    playbackRate = clamp(safeBaseRate * (1.08 + effect * 0.14), 0.5, 2);
    preservesPitch = false;
  } else if (mode === "daycore") {
    playbackRate = clamp(safeBaseRate * (0.96 - effect * 0.14), 0.5, 2);
    preservesPitch = false;
  }

  // Keep the combined dry/wet path at or below unity-ish gain so enabling
  // reverb cannot unexpectedly make the song louder than the user's volume.
  const wetGain = requestedReverb * 0.30;
  const dryGain = 1 - requestedReverb * 0.32;

  return {
    mode,
    playbackRate,
    preservesPitch,
    dryGain: clamp(dryGain, 0.62, 1),
    wetGain: clamp(wetGain, 0, 0.30),
    delaySeconds: 0.11 + requestedReverb * 0.20,
    feedbackGain: requestedReverb * 0.24,
    lowpassHz: 4300 - requestedReverb * 1900
  };
}

type AnalyserSnapshot = {
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
};

export class AudioEffectRuntime {
  private context: AudioContext | null = null;
  private element: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array<ArrayBuffer> | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private delay: DelayNode | null = null;
  private feedback: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private graphConnected = false;
  private analyserConnected = false;

  apply(audio: HTMLAudioElement | null | undefined, input: AudioEffectProfileInput) {
    if (!audio) return getAudioEffectProfile(input);

    const profile = getAudioEffectProfile(input);
    this.applyMediaElementRate(audio, profile);

    const needsGraph = profile.wetGain > 0.001 || Boolean(this.source);
    if (!needsGraph) return profile;

    try {
      const context = this.ensureGraph(audio);
      const now = context.currentTime;
      this.setAudioParam(this.dryGain?.gain, profile.dryGain, now);
      this.setAudioParam(this.wetGain?.gain, profile.wetGain, now);
      this.setAudioParam(this.delay?.delayTime, profile.delaySeconds, now);
      this.setAudioParam(this.feedback?.gain, profile.feedbackGain, now);
      this.setAudioParam(this.filter?.frequency, profile.lowpassHz, now);
      void this.resume();
    } catch {
      // HTMLAudio playback remains valid when Web Audio is unavailable.
    }

    return profile;
  }

  ensureAnalyser(audio: HTMLAudioElement | null | undefined, input: AudioEffectProfileInput): AnalyserSnapshot | null {
    if (!audio) return null;

    const profile = this.apply(audio, input);

    try {
      const context = this.ensureGraph(audio);
      if (!this.analyser) {
        this.analyser = context.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.88;
        this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);
      }

      if (!this.analyserConnected && this.source) {
        this.source.connect(this.analyser);
        this.analyserConnected = true;
      }

      const now = context.currentTime;
      this.setAudioParam(this.dryGain?.gain, profile.dryGain, now);
      this.setAudioParam(this.wetGain?.gain, profile.wetGain, now);
      this.setAudioParam(this.delay?.delayTime, profile.delaySeconds, now);
      this.setAudioParam(this.feedback?.gain, profile.feedbackGain, now);
      this.setAudioParam(this.filter?.frequency, profile.lowpassHz, now);
      void this.resume();

      return this.analyser && this.analyserData
        ? { analyser: this.analyser, data: this.analyserData }
        : null;
    } catch {
      return null;
    }
  }

  async resume() {
    const context = this.context;
    if (!context || context.state === "closed" || context.state === "running") return;
    try {
      await context.resume();
    } catch {
      // A user gesture/focus retry can resume it later.
    }
  }

  dispose() {
    this.disconnectGraph();
    const context = this.context;
    this.context = null;
    this.element = null;

    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private getAudioContextConstructor() {
    return window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
      null;
  }

  private ensureGraph(audio: HTMLAudioElement) {
    const AudioContextCtor = this.getAudioContextConstructor();
    if (!AudioContextCtor) throw new Error("Web Audio is unavailable");

    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContextCtor({ latencyHint: "playback" });
      this.element = null;
      this.disconnectGraph();
    }

    if (this.element !== audio) {
      this.disconnectGraph();
      this.element = audio;
    }

    const context = this.context;
    if (!this.source) this.source = context.createMediaElementSource(audio);
    if (!this.dryGain) this.dryGain = context.createGain();
    if (!this.wetGain) this.wetGain = context.createGain();
    if (!this.delay) this.delay = context.createDelay(1.5);
    if (!this.feedback) this.feedback = context.createGain();
    if (!this.filter) {
      this.filter = context.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.Q.value = 0.35;
    }

    if (!this.graphConnected) {
      this.source.connect(this.dryGain);
      this.dryGain.connect(context.destination);

      this.source.connect(this.delay);
      this.delay.connect(this.filter);
      this.filter.connect(this.wetGain);
      this.wetGain.connect(context.destination);

      this.delay.connect(this.feedback);
      this.feedback.connect(this.delay);
      this.graphConnected = true;
    }

    return context;
  }

  private disconnectGraph() {
    try { this.source?.disconnect(); } catch {}
    try { this.analyser?.disconnect(); } catch {}
    try { this.dryGain?.disconnect(); } catch {}
    try { this.wetGain?.disconnect(); } catch {}
    try { this.delay?.disconnect(); } catch {}
    try { this.feedback?.disconnect(); } catch {}
    try { this.filter?.disconnect(); } catch {}

    this.source = null;
    this.analyser = null;
    this.analyserData = null;
    this.dryGain = null;
    this.wetGain = null;
    this.delay = null;
    this.feedback = null;
    this.filter = null;
    this.graphConnected = false;
    this.analyserConnected = false;
  }

  private setAudioParam(param: AudioParam | null | undefined, value: number, now: number) {
    if (!param || !Number.isFinite(value)) return;
    try {
      param.cancelScheduledValues(now);
      param.setTargetAtTime(value, now, 0.018);
    } catch {
      param.value = value;
    }
  }

  private applyMediaElementRate(audio: HTMLAudioElement, profile: AudioEffectProfile) {
    if (Math.abs(audio.playbackRate - profile.playbackRate) > 0.0005) {
      audio.playbackRate = profile.playbackRate;
    }

    try {
      (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = profile.preservesPitch;
      (audio as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = profile.preservesPitch;
      (audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = profile.preservesPitch;
    } catch {
      // Older Chromium builds can ignore pitch flags safely.
    }
  }
}
