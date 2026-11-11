import type { RepeatMode } from "../player/player.types";

/** The computer is always "computer"; a phone is its pairing's device ID. */
export type LivePeer = { id: string; name: string; kind: "computer" | "phone" };

/** Which device is the player. epoch goes up every time that changes; messages from an older epoch are ignored. */
export type LiveSession = { active: string; epoch: number; online: boolean };

/**
 * What the active player reports. positionMs was the position at `at` (the computer's clock), so a remote shows
 * positionMs + (now - at) × rate while playing instead of needing an update every second.
 */
export type LiveState = {
  from?: string;
  epoch: number;
  songId: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  playing: boolean;
  positionMs: number;
  at: number;
  rate: number;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: string[];
  /** Goes up with every queue change on the player, so a remote's edit can tell whether it saw the latest queue. */
  queueRev: number;
  contextLabel: string;
  /** Queued songs the player can't play (not copied to that phone yet); they show greyed out and are skipped. */
  missing: string[];
};

export type LiveAction = "play" | "pause" | "next" | "previous" | "seek" | "play-song" | "play-index" | "queue-set" | "queue-add" | "shuffle" | "repeat";

export type LiveCommand = {
  action: LiveAction;
  epoch?: number;
  positionMs?: number;
  songId?: string;
  index?: number;
  songIds?: string[];
  next?: boolean;
  /** queue-set: the queue the edit started from, and its queueRev. */
  baseRev?: number;
  base?: string[];
  queue?: string[];
  /** play-song: the remote picked a song together with what follows it (an album, a playlist). */
  replaceQueue?: boolean;
  on?: boolean;
  mode?: RepeatMode;
};

/** "unsupported": the paired computer runs a localtify from before the live connection; batch sync still works. */
export type LiveConnectionStatus = "off" | "connecting" | "connected" | "offline" | "unsupported";

export type LivePresence = { self?: string; peers: LivePeer[]; session: LiveSession; state: LiveState | null; serverTime: number; version?: number };

export type LiveEvent =
  | ({ type: "hello" | "presence" } & LivePresence)
  | { type: "state"; state: LiveState }
  | ({ type: "command"; from: string } & LiveCommand)
  | { type: "give"; to: string; requester: string }
  | { type: "take"; requester: string; giver: string; handoff: LiveState | null }
  | { type: "take-failed"; by: string; message: string }
  | { type: "like"; songId: string; liked: boolean; changedAt: number }
  | { type: "notice"; from: string; message: string }
  /** Only on the phone: the state of its connection to the computer. */
  | { type: "connection"; status: LiveConnectionStatus };

export type LiveMessage =
  | { type: "status" }
  | { type: "claim" | "took" }
  | ({ type: "state" } & LiveState)
  | ({ type: "command" } & LiveCommand)
  | { type: "transfer"; to: string }
  | { type: "handoff"; to: string; requester: string; handoff: LiveState }
  | { type: "take-failed"; giver: string; requester: string; message: string }
  | { type: "notice"; to: string; message: string }
  | { type: "like"; songId: string; liked: boolean; changedAt?: number };

export type LiveReply = { ok: boolean; error?: string } & Partial<LivePresence> & Record<string, unknown>;
