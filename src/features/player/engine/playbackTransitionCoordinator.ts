export type PlaybackPhase = "idle" | "loading" | "ready" | "playing" | "paused" | "seeking" | "crossfading" | "ended" | "error";
export type PlaybackSnapshot = { phase: PlaybackPhase; sourceId: string; generation: number; targetId: string; beforeSeek: PlaybackPhase; beforeCrossfade: PlaybackPhase };

/** Transport transition guards shared by the main audio and gapless preloader. */
export class PlaybackTransitionCoordinator {
  private state: PlaybackSnapshot = { phase: "idle", sourceId: "", generation: 0, targetId: "", beforeSeek: "idle", beforeCrossfade: "idle" };
  snapshot(): Readonly<PlaybackSnapshot> { return { ...this.state }; }
  requestPlay(id: string): number {
    if (this.state.sourceId !== id) { this.state.sourceId = id; this.state.generation++; }
    if (!this.state.targetId) this.state.phase = "loading";
    return this.state.generation;
  }
  isCurrent(generation: number, id: string) { return generation === this.state.generation && id === this.state.sourceId && !this.state.targetId; }
  ready() { if (this.state.phase === "loading") this.state.phase = "ready"; }
  playing() { if (!this.state.targetId) this.state.phase = "playing"; }
  requestPause() { if (!this.state.targetId) this.state.phase = "paused"; }
  paused(protectedHandoff = false): boolean {
    if (protectedHandoff || this.state.targetId) return false;
    this.state.phase = "paused"; return true;
  }
  seekStarted() {
    if (this.state.phase !== "seeking") this.state.beforeSeek = this.state.phase;
    this.state.phase = "seeking";
  }
  seekFinished() { if (this.state.phase === "seeking") this.state.phase = this.state.beforeSeek; }
  crossfadeStarted(id: string): boolean {
    if (!id || this.state.targetId) return false;
    this.state.beforeCrossfade = this.state.phase === "paused" ? "paused" : "playing";
    this.state.targetId = id; this.state.phase = "crossfading"; return true;
  }
  isCurrentCrossfade(id: string, generation: number) { return this.state.targetId === id && this.state.generation === generation; }
  crossfadeFinished(id: string): boolean {
    if (id !== this.state.targetId) return false;
    this.state.sourceId = id; this.state.generation++; this.state.targetId = ""; this.state.phase = "playing";
    return true;
  }
  crossfadeCancelled() {
    if (!this.state.targetId) return;
    this.state.targetId = ""; this.state.phase = this.state.beforeCrossfade;
  }
  ended(protectedHandoff = false): boolean {
    if (protectedHandoff || this.state.targetId) return false;
    this.state.phase = "ended"; return true;
  }
  failed() { this.state.targetId = ""; this.state.phase = "error"; }
  reset() { this.state.sourceId = ""; this.state.targetId = ""; this.state.phase = "idle"; this.state.generation++; }
}
