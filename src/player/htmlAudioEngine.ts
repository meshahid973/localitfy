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

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export class HtmlAudioEngine implements PlayerEngine {
  readonly element: HTMLAudioElement;

  private source: PlayerEngineSource | null = null;
  private readonly listeners = new Map<PlayerEngineEvent, Set<PlayerEngineListener>>();
  private readonly removeDomListeners: PlayerEngineUnsubscribe[] = [];

  constructor(element?: HTMLAudioElement) {
    this.element = element ?? new Audio();
    this.element.preload = this.element.preload || "metadata";

    for (const event of MEDIA_EVENTS) {
      const handler = () => this.emit(event);
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
    await this.element.play();
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

  setPlaybackRate(rate: number) {
    this.element.playbackRate = clamp(rate, 0.25, 4);
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

  private emit(event: PlayerEngineEvent) {
    const state = this.getState();
    const eventListeners = this.listeners.get(event);

    if (!eventListeners) return;

    for (const listener of eventListeners) {
      listener(state, event);
    }
  }
}

