export type ListeningOutcome = "active" | "ended" | "replaced" | "transition" | "error" | "interrupted";
export type PlayEvent = {
  id: string;
  sessionId: string;
  songId: string;
  startedAt: number;
  updatedAt: number;
  endedAt: number | null;
  msListened: number;
  outcome: ListeningOutcome;
  contextType: "library" | "playlist";
  contextId: string | null;
};

type PlaybackSample = { currentTime: number; paused: boolean; seeking: boolean; playbackRate: number };

// No timers or audio ownership here: the player supplies observations and lifecycle boundaries.
export class ListeningHistory {
  private event: PlayEvent | null = null;
  private lastPosition = 0;
  private lastTick = 0;
  private lastWrite = 0;
  private listened = 0;
  private running = false;
  private readonly sessionId: string;
  private readonly write: (event: PlayEvent) => void;
  private readonly now: () => number;
  private readonly monotonic: () => number;
  private readonly uuid: () => string;

  constructor(write: (event: PlayEvent) => void, now = Date.now,
    monotonic = () => performance.now(), uuid = () => crypto.randomUUID()) {
    this.write = write;
    this.now = now;
    this.monotonic = monotonic;
    this.uuid = uuid;
    this.sessionId = uuid();
  }

  play(songId: string, position: number, playlistId: string | null = null) {
    if (this.event?.songId !== songId) this.finish("replaced");
    if (!this.event) {
      const startedAt = this.now();
      this.event = { id: this.uuid(), sessionId: this.sessionId, songId, startedAt, updatedAt: startedAt,
        endedAt: null, msListened: 0, outcome: "active", contextType: playlistId ? "playlist" : "library", contextId: playlistId };
      this.listened = 0;
      this.checkpoint();
    }
    this.lastPosition = position;
    this.lastTick = this.monotonic();
    this.running = true;
  }

  sample(audio: PlaybackSample) {
    if (!this.event) return;
    const tick = this.monotonic();
    const elapsed = Math.max(0, tick - this.lastTick);
    const progress = audio.currentTime - this.lastPosition;
    const rate = Math.max(0.25, audio.playbackRate || 1);
    // Reject discontinuities; use wall listening milliseconds, not media time at fast/slow rates.
    if (this.running && !audio.seeking && progress > 0 && elapsed <= 5000 && progress <= elapsed * rate / 1000 + 0.25) {
      this.listened += Math.min(elapsed, progress * 1000 / rate);
    }
    this.lastPosition = audio.currentTime;
    this.lastTick = tick;
    this.running = !audio.paused && !audio.seeking;
    if (tick - this.lastWrite >= 15_000) this.checkpoint();
  }

  discontinuity(position: number) {
    this.lastPosition = position;
    this.lastTick = this.monotonic();
  }

  pause(audio: PlaybackSample) {
    this.sample(audio);
    this.running = false;
    this.checkpoint();
  }

  finish(outcome: Exclude<ListeningOutcome, "active">) {
    if (!this.event) return;
    this.checkpoint(outcome);
    this.event = null;
    this.running = false;
  }

  private checkpoint(outcome: ListeningOutcome = "active") {
    if (!this.event) return;
    const updatedAt = Math.max(this.event.updatedAt, this.now());
    this.event = { ...this.event, updatedAt, msListened: Math.min(Math.floor(this.listened), updatedAt - this.event.startedAt),
      outcome, endedAt: outcome === "active" ? null : updatedAt };
    this.lastWrite = this.monotonic();
    this.write({ ...this.event });
  }
}
