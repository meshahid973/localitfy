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
  "play",
  "playing",
  "pause",
  "timeupdate",
  "waiting",
  "stalled",
  "suspend",
  "emptied",
  "ended",
  "volumechange",
  "ratechange",
  "error"
];

const RESTORE_EVENTS = new Set<PlayerEngineEvent>([
  "loadedmetadata",
  "canplay",
  "play",
  "playing"
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
    // Old Chromium builds may not expose every pitch property.
  }
}

export class HtmlAudioEngine implements PlayerEngine {
  readonly element: HTMLAudioElement;

  private source: PlayerEngineSource | null = null;
  private readonly listeners = new Map<PlayerEngineEvent, Set<PlayerEngineListener>>();
  private readonly removeDomListeners: PlayerEngineUnsubscribe[] = [];
  private desiredPlaybackRate = 1;
  private desiredPreservesPitch = true;
  private desiredVolume = 1;
  private desiredMuted = false;
  private pendingSeek: number | null = null;
  private applyingOutputState = false;
  private repairQueued = false;
  private playPromise: Promise<void> | null = null;
  private playAttempt = 0;
  private destroyed = false;

  constructor(element?: HTMLAudioElement) {
    this.element = element ?? new Audio();
    this.element.preload = this.element.preload || "metadata";
    this.desiredPlaybackRate = clamp(this.element.playbackRate || 1, 0.25, 4);
    this.desiredPreservesPitch = this.element.preservesPitch !== false;
    this.desiredVolume = clamp(this.element.volume, 0, 1);
    this.desiredMuted = this.element.muted;

    for (const event of MEDIA_EVENTS) {
      const handler = () => {
        if (RESTORE_EVENTS.has(event)) {
          this.restoreOutputState();
          this.applyPendingSeek();
        } else if (event === "ratechange" || event === "volumechange") {
          this.queueRepairIfNeeded();
        }

        this.emit(event);
      };

      this.element.addEventListener(event, handler);
      this.removeDomListeners.push(() => this.element.removeEventListener(event, handler));
    }
  }

  load(source: PlayerEngineSource) {
    if (this.destroyed) return;

    const sourceChanged = this.source?.id !== source.id || this.source?.url !== source.url;
    this.source = source;

    if (sourceChanged || !this.element.src) {
      this.pendingSeek = null;
      this.element.src = source.url;
      this.element.load();
    }

    this.restoreOutputState();
    this.emit("sourcechange");
  }

  clear() {
    if (this.destroyed) return;

    this.pause();
    this.source = null;
    this.pendingSeek = null;
    this.playPromise = null;

    if (this.element.src) {
      this.element.removeAttribute("src");
      this.element.load();
    }

    this.emit("sourcechange");
  }

  play() {
    if (this.destroyed) return Promise.reject(new Error("player engine destroyed"));
    if (!this.element.paused && !this.element.ended) {
      this.restoreOutputState();
      return Promise.resolve();
    }
    if (this.playPromise) return this.playPromise;

    this.restoreOutputState();
    const attempt = ++this.playAttempt;
    const playPromise = this.element.play()
      .then(() => {
        if (attempt !== this.playAttempt || this.destroyed) {
          this.element.pause();
          return;
        }

        this.restoreOutputState();
        this.applyPendingSeek();
      })
      .finally(() => {
        if (this.playPromise === playPromise) this.playPromise = null;
      });

    this.playPromise = playPromise;
    return playPromise;
  }

  pause() {
    this.playAttempt += 1;
    this.playPromise = null;
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
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const duration = Number.isFinite(this.element.duration) ? this.element.duration : Number.POSITIVE_INFINITY;
    const target = clamp(safeSeconds, 0, duration);

    if (this.element.readyState < HTMLMediaElement.HAVE_METADATA) {
      this.pendingSeek = target;
      return;
    }

    this.pendingSeek = null;
    this.element.currentTime = target;
  }

  setVolume(volume: number) {
    this.desiredVolume = clamp(volume, 0, 1);
    this.restoreOutputState();
  }

  setMuted(muted: boolean) {
    this.desiredMuted = Boolean(muted);
    this.restoreOutputState();
  }

  setPlaybackRate(rate: number, preservesPitch = true) {
    this.desiredPlaybackRate = clamp(rate, 0.25, 4);
    this.desiredPreservesPitch = preservesPitch;
    this.restoreOutputState();
  }

  recover() {
    if (this.destroyed) return;
    this.restoreOutputState();
    this.applyPendingSeek();
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
      if (bucket.size === 0) this.listeners.delete(event);
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.playAttempt += 1;
    this.playPromise = null;

    for (const remove of this.removeDomListeners.splice(0)) remove();
    this.listeners.clear();

    try {
      this.element.pause();
      this.element.removeAttribute("src");
      this.element.load();
    } catch {
      // Teardown must not throw during React unmount.
    }

    this.source = null;
    this.pendingSeek = null;
  }

  private applyPendingSeek() {
    if (this.pendingSeek === null || this.element.readyState < HTMLMediaElement.HAVE_METADATA) return;
    const duration = Number.isFinite(this.element.duration) ? this.element.duration : Number.POSITIVE_INFINITY;
    const target = clamp(this.pendingSeek, 0, duration);
    this.pendingSeek = null;

    if (Math.abs(this.element.currentTime - target) > 0.05) {
      this.element.currentTime = target;
    }
  }

  private restoreOutputState() {
    if (this.destroyed || this.applyingOutputState) return;
    this.applyingOutputState = true;

    try {
      setPitchPreservation(this.element, this.desiredPreservesPitch);

      if (Math.abs(this.element.defaultPlaybackRate - this.desiredPlaybackRate) > 0.0001) {
        this.element.defaultPlaybackRate = this.desiredPlaybackRate;
      }
      if (Math.abs(this.element.playbackRate - this.desiredPlaybackRate) > 0.0001) {
        this.element.playbackRate = this.desiredPlaybackRate;
      }
      if (Math.abs(this.element.volume - this.desiredVolume) > 0.0001) {
        this.element.volume = this.desiredVolume;
      }
      if (this.element.muted !== this.desiredMuted) {
        this.element.muted = this.desiredMuted;
      }
    } finally {
      this.applyingOutputState = false;
    }
  }

  private queueRepairIfNeeded() {
    if (this.destroyed || this.applyingOutputState || this.repairQueued) return;

    const rateWrong = Math.abs(this.element.playbackRate - this.desiredPlaybackRate) > 0.0001;
    const volumeWrong = Math.abs(this.element.volume - this.desiredVolume) > 0.0001;
    const muteWrong = this.element.muted !== this.desiredMuted;
    if (!rateWrong && !volumeWrong && !muteWrong) return;

    this.repairQueued = true;
    queueMicrotask(() => {
      this.repairQueued = false;
      this.restoreOutputState();
    });
  }

  private emit(event: PlayerEngineEvent) {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners?.size) return;

    const state = this.getState();
    for (const listener of eventListeners) listener(state, event);
  }
}
