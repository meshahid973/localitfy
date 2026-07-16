import type {
  PlayerEngine,
  PlayerEngineEvent,
  PlayerEngineListener,
  PlayerEngineSource,
  PlayerEngineState,
  PlayerEngineUnsubscribe
} from "./PlayerEngine";

const MEDIA_EVENTS: readonly PlayerEngineEvent[] = [
  "loadstart",
  "loadedmetadata",
  "canplay",
  "timeupdate",
  "play",
  "pause",
  "ended",
  "volumechange",
  "ratechange",
  "error"
];

const PLAYBACK_SETTING_EVENTS = new Set<PlayerEngineEvent>([
  "loadedmetadata",
  "canplay",
  "play"
]);

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function setPitchPreservation(element: HTMLAudioElement, preservesPitch: boolean) {
  try {
    element.preservesPitch = preservesPitch;
    (element as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = preservesPitch;
    (element as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = preservesPitch;
  } catch {
    // Older Chromium builds may not expose every pitch-preservation property.
  }
}

export class HtmlAudioEngine implements PlayerEngine {
  readonly element: HTMLAudioElement;

  private source: PlayerEngineSource | null = null;
  private readonly listeners = new Map<PlayerEngineEvent, Set<PlayerEngineListener>>();
  private readonly removeDomListeners: PlayerEngineUnsubscribe[] = [];
  private desiredPlaybackRate = 1;
  private desiredPreservesPitch = true;
  private applyingPlaybackSettings = false;

  constructor(element?: HTMLAudioElement) {
    this.element = element ?? new Audio();
    this.element.preload = this.element.preload || "metadata";
    this.desiredPlaybackRate = clamp(this.element.playbackRate || 1, 0.25, 4);
    this.desiredPreservesPitch = this.element.preservesPitch !== false;

    for (const event of MEDIA_EVENTS) {
      const handler = () => {
        if (PLAYBACK_SETTING_EVENTS.has(event)) {
          this.restorePlaybackSettings();
        } else if (event === "ratechange") {
          this.repairUnexpectedRateChange();
        }

        this.emit(event);
      };

      this.element.addEventListener(event, handler);
      this.removeDomListeners.push(() => this.element.removeEventListener(event, handler));
    }
  }

  load(source: PlayerEngineSource) {
    this.source = source;

    if (this.element.src !== source.url) {
      this.element.src = source.url;
      this.element.load();
    }

    this.restorePlaybackSettings();
    this.emit("sourcechange");
  }

  clear() {
    this.pause();
    this.source = null;

    if (this.element.src) {
      this.element.removeAttribute("src");
      this.element.load();
    }

    this.emit("sourcechange");
  }

  async play() {
    this.restorePlaybackSettings();
    await this.element.play();
    this.restorePlaybackSettings();
  }

  pause() {
    this.element.pause();
  }

  async toggle() {
    if (this.element.paused) {
      await this.play();
      return true;
    }

    this.pause();
    return false;
  }

  seek(seconds: number) {
    const duration = Number.isFinite(this.element.duration) ? this.element.duration : Number.POSITIVE_INFINITY;
    this.element.currentTime = clamp(seconds, 0, duration);
  }

  setVolume(volume: number) {
    this.element.volume = clamp(volume, 0, 1);
  }

  setMuted(muted: boolean) {
    this.element.muted = muted;
  }

  setPlaybackRate(rate: number, preservesPitch = true) {
    this.desiredPlaybackRate = clamp(rate, 0.25, 4);
    this.desiredPreservesPitch = preservesPitch;
    this.restorePlaybackSettings();
  }

  getState(): PlayerEngineState {
    const mediaError = this.element.error;

    return {
      source: this.source,
      currentTime: Number.isFinite(this.element.currentTime) ? this.element.currentTime : 0,
      duration: Number.isFinite(this.element.duration) ? this.element.duration : this.source?.duration ?? 0,
      volume: this.element.volume,
      muted: this.element.muted,
      playbackRate: this.element.playbackRate,
      paused: this.element.paused,
      ended: this.element.ended,
      readyState: this.element.readyState,
      error: mediaError ? { code: mediaError.code, message: mediaError.message } : null
    };
  }

  on(event: PlayerEngineEvent, listener: PlayerEngineListener): PlayerEngineUnsubscribe {
    const bucket = this.listeners.get(event) ?? new Set<PlayerEngineListener>();
    bucket.add(listener);
    this.listeners.set(event, bucket);

    return () => {
      bucket.delete(listener);
      if (bucket.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  destroy() {
    this.clear();

    for (const remove of this.removeDomListeners.splice(0)) {
      remove();
    }

    this.listeners.clear();
  }

  private restorePlaybackSettings() {
    if (this.applyingPlaybackSettings) return;

    this.applyingPlaybackSettings = true;

    try {
      setPitchPreservation(this.element, this.desiredPreservesPitch);

      if (Math.abs(this.element.defaultPlaybackRate - this.desiredPlaybackRate) > 0.0001) {
        this.element.defaultPlaybackRate = this.desiredPlaybackRate;
      }

      if (Math.abs(this.element.playbackRate - this.desiredPlaybackRate) > 0.0001) {
        this.element.playbackRate = this.desiredPlaybackRate;
      }
    } finally {
      this.applyingPlaybackSettings = false;
    }
  }

  private repairUnexpectedRateChange() {
    if (this.applyingPlaybackSettings) return;
    if (Math.abs(this.element.playbackRate - this.desiredPlaybackRate) <= 0.0001) return;

    queueMicrotask(() => this.restorePlaybackSettings());
  }

  private emit(event: PlayerEngineEvent) {
    const state = this.getState();
    const eventListeners = this.listeners.get(event);

    if (!eventListeners) return;

    for (const listener of eventListeners) {
      listener(state, event);
    }
  }
}
