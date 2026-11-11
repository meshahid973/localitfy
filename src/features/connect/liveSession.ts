import type { LiveState } from "./connect.types";

/** Where the active player is now, from its last report. */
export function livePositionMs(state: Pick<LiveState, "playing" | "positionMs" | "at" | "rate" | "durationMs">, serverNow: number) {
  const elapsed = state.playing ? Math.max(0, serverNow - state.at) * (state.rate || 1) : 0;
  const position = state.positionMs + elapsed;
  return state.durationMs > 0 ? Math.min(position, state.durationMs) : position;
}

/**
 * A remote edited the queue starting from `base`; the player's queue is now `current`. If nothing changed in
 * between the edit applies as is. Otherwise songs the player dropped or added meanwhile stay dropped or added.
 */
export function mergeQueueEdit(base: string[], current: string[], edited: string[]) {
  if (base.length === current.length && base.every((id, index) => id === current[index])) return [...edited];
  const before = new Set(base);
  const now = new Set(current);
  const droppedByPlayer = new Set(base.filter((id) => !now.has(id)));
  const kept = edited.filter((id) => !droppedByPlayer.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...current.filter((id) => !before.has(id) && !keptSet.has(id))];
}

/** Queue as "add to queue" does it on the player: a song already queued moves instead of repeating. */
export function addToQueue(queue: string[], songIds: string[], next: boolean) {
  const adding = new Set(songIds);
  const rest = queue.filter((id) => !adding.has(id));
  return next ? [...songIds, ...rest] : [...rest, ...songIds];
}

export const nextRepeatMode = (mode: LiveState["repeat"]): LiveState["repeat"] => (mode === "all" ? "one" : mode === "one" ? "off" : "all");
