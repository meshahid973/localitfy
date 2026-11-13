import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Song } from "../library/song.types";
import type { RepeatMode } from "../player/player.types";
import type { PlayerBarProps } from "../player/components/PlayerBar";
import type { QueuePanelProps } from "../player/components/QueuePanel";
import type { LyricsViewProps } from "../lyrics/LyricsView";
import { isPlayableSong } from "../library/library.utils";
import { computerName, isAndroidApp } from "../../app/platform";
import { clamp, formatTime } from "../../shared/utils/format";
import { addToQueue, livePositionMs, mergeQueueEdit, nextRepeatMode } from "./liveSession";
import type { LiveCommand, LiveConnectionStatus, LiveEvent, LiveMessage, LivePeer, LivePresence, LiveState } from "./connect.types";

/** The active player re-sends its state this often while playing, and whenever it drifts from what remotes assume. */
const STATE_EVERY_MS = 15 * 1000;
const DRIFT_MS = 1500;
/** A handoff the other device hasn't taken by then is undone: the music resumes where it was. */
const HANDOFF_TIMEOUT_MS = 6000;
const PAINT_EVERY_MS = 250;

/** The parts of the app's own player the live connection reads and drives. */
export type LocalPlayer = {
  songsById: Map<string, Song>;
  currentSong: Song | null;
  isPlaying: boolean;
  queue: string[];
  isShuffle: boolean;
  repeatMode: RepeatMode;
  contextLabel: string;
  rate: number;
  /** Seconds. */
  getTime: () => number;
  getDuration: () => number;
  togglePlay: () => unknown;
  next: () => unknown;
  previous: () => unknown;
  seek: (seconds: number) => unknown;
  setQueue: Dispatch<SetStateAction<string[]>>;
  setShuffle: Dispatch<SetStateAction<boolean>>;
  setRepeat: Dispatch<SetStateAction<RepeatMode>>;
  /** Loads songId at `seconds`, playing or paused. */
  start: (songId: string, seconds: number, play: boolean) => unknown;
  playQueueItem: (index: number) => unknown;
  onLike: (songId: string, liked: boolean) => unknown;
  toast: (message: string, tone?: "success" | "info" | "error") => unknown;
};

/** What the device picker shows. */
export type ConnectControls = {
  status: LiveConnectionStatus;
  self: string;
  peers: LivePeer[];
  active: string;
  /** Name of the device playing, when that is another one. */
  remoteName: string;
  label: (peer: LivePeer) => string;
  transfer: (id: string) => void;
};

/** The extra props the player bar and phone player take for the device picker. */
export type ConnectPlayerProps = { connect?: ConnectControls | null };

type Live = { status: LiveConnectionStatus; self: string; peers: LivePeer[]; session: LivePresence["session"]; state: LiveState | null };

const android = isAndroidApp();
const EMPTY_SESSION = { active: "", epoch: 0, online: true };

/** Stand-in for a song this device doesn't have in its library, from what the player reported. */
const reportedSong = (state: LiveState) => ({
  id: state.songId, title: state.title, artist: state.artist, album: state.album, duration: state.durationMs / 1000,
  liked: false, filePath: "", url: "", fileExists: false, coverUrl: ""
}) as unknown as Song;

/**
 * Spotify Connect–style playback between the computer and a phone on the same network. One device is the active
 * player and reports its state; the others show it and send commands. Likes go across both ways as they happen.
 * Without a connected device every call here falls through to the app's own player.
 */
export function usePlaybackConnect(local: LocalPlayer) {
  const localRef = useRef(local);
  localRef.current = local;
  const [live, setLive] = useState<Live>({ status: android ? "off" : "connected", self: android ? "" : "computer", peers: [], session: EMPTY_SESSION, state: null });
  const liveRef = useRef(live);
  const offsetRef = useRef(0);
  const queueRevRef = useRef(0);
  const publishedRef = useRef<{ state: LiveState; sentAt: number } | null>(null);
  const handoffRef = useRef<{ resume: boolean; timer: number } | null>(null);
  const seekingRef = useRef(false);
  // Set while this hook drives the app's player, so the app's remote-control redirects (toggle, play…) stay out of it.
  const drivingRef = useRef(false);
  const drive = (run: () => unknown) => {
    drivingRef.current = true;
    try { run(); } finally { drivingRef.current = false; }
  };
  const [, setTick] = useState(0);

  const update = (patch: Partial<Live>) => {
    liveRef.current = { ...liveRef.current, ...patch };
    setLive(liveRef.current);
  };
  const serverNow = () => Date.now() + offsetRef.current;
  const send = (message: LiveMessage) => window.localitfy?.liveSend?.(message).catch(() => ({ ok: false, error: "" })) ?? Promise.resolve({ ok: false });
  const peerName = (id: string) => liveRef.current.peers.find((peer) => peer.id === id)?.name || "";
  const label = (peer: LivePeer) => peer.id === liveRef.current.self
    ? `this ${peer.kind === "computer" ? computerName() : "phone"}`
    : peer.kind === "computer" ? `${peer.name} · ${computerName()}` : peer.name;
  /** Another device is playing and reachable: this one is a remote. */
  const remoteActive = () => {
    const { session, self, peers } = liveRef.current;
    return Boolean(session.active && session.active !== self && peers.some((peer) => peer.id === session.active));
  };

  const pauseLocal = () => {
    if (localRef.current.isPlaying) drive(localRef.current.togglePlay);
  };

  const buildState = (): LiveState | null => {
    const player = localRef.current;
    const song = player.currentSong;
    if (!song) return null;
    return {
      epoch: liveRef.current.session.epoch,
      songId: song.id, title: song.title || "", artist: song.artist || "", album: song.album || "",
      durationMs: Math.round((player.getDuration() || song.duration || 0) * 1000),
      playing: player.isPlaying,
      positionMs: Math.round(player.getTime() * 1000),
      at: serverNow(),
      rate: player.rate || 1,
      shuffle: player.isShuffle,
      repeat: player.repeatMode,
      queue: player.queue.slice(0, 500),
      queueRev: queueRevRef.current,
      contextLabel: player.contextLabel,
      missing: player.queue.slice(0, 500).filter((id) => !isPlayableSong(player.songsById.get(id)))
    };
  };

  const publish = () => {
    const { session, self, peers } = liveRef.current;
    if (session.active !== self || !self || peers.length < 2) return;
    const state = buildState();
    if (!state) return;
    publishedRef.current = { state, sentAt: Date.now() };
    void send({ type: "state", ...state });
  };

  const finishHandoff = (resume: boolean) => {
    const handoff = handoffRef.current;
    if (!handoff) return;
    window.clearTimeout(handoff.timer);
    handoffRef.current = null;
    if (resume && handoff.resume && !localRef.current.isPlaying) drive(localRef.current.togglePlay);
  };

  const startLocally = (songId: string, seconds: number, play: boolean) => drive(() => {
    const player = localRef.current;
    if (player.currentSong?.id !== songId) {
      player.start(songId, seconds, play);
      return;
    }
    player.seek(seconds);
    if (play !== player.isPlaying) player.togglePlay();
  });

  const applyCommand = (command: LiveCommand & { from: string }) => {
    const player = localRef.current;
    if (command.epoch && command.epoch !== liveRef.current.session.epoch) return;
    switch (command.action) {
      case "play": if (!player.isPlaying) player.togglePlay(); break;
      case "pause": pauseLocal(); break;
      case "next": player.next(); break;
      case "previous": player.previous(); break;
      case "seek": player.seek((command.positionMs || 0) / 1000); window.setTimeout(publish, 300); break;
      case "play-song": {
        const song = player.songsById.get(command.songId || "");
        if (!isPlayableSong(song)) {
          const title = player.songsById.get(command.songId || "")?.title || "That song";
          void send({ type: "notice", to: command.from, message: android ? `"${title}" isn't copied to the phone yet. Sync the phone to copy it` : `"${title}" isn't on the ${computerName()}` });
          break;
        }
        if (command.replaceQueue) player.setQueue(command.queue || []);
        startLocally(song.id, (command.positionMs || 0) / 1000, true);
        break;
      }
      case "play-index": {
        const index = player.queue[command.index ?? -1] === command.songId ? command.index! : player.queue.indexOf(command.songId || "");
        if (index >= 0) player.playQueueItem(index);
        break;
      }
      case "queue-set":
        player.setQueue((current) => command.baseRev === queueRevRef.current ? [...(command.queue || [])] : mergeQueueEdit(command.base || [], current, command.queue || []));
        break;
      case "queue-add": player.setQueue((current) => addToQueue(current, command.songIds || [], Boolean(command.next))); break;
      case "shuffle": player.setShuffle(Boolean(command.on)); break;
      case "repeat": player.setRepeat(command.mode || "off"); break;
    }
  };

  const adoptPresence = (presence: LivePresence, hello: boolean) => {
    offsetRef.current = presence.serverTime - Date.now();
    const self = presence.self || liveRef.current.self;
    update({ status: "connected", self, peers: presence.peers, session: presence.session, state: presence.state?.from === presence.session.active ? presence.state : null });
    const { active } = presence.session;
    if (active !== self) finishHandoff(false);
    if (!localRef.current.isPlaying || active === self || presence.peers.length < 2) return;
    // Only one device plays. One that comes back while still playing takes over; otherwise the newer player wins.
    if (hello || !active) void send({ type: "claim" });
    else pauseLocal();
  };

  const handlers = useRef<(event: LiveEvent) => void>(() => {});
  handlers.current = (event) => {
    const player = localRef.current;
    switch (event.type) {
      case "hello":
      case "presence":
        adoptPresence(event, event.type === "hello");
        break;
      case "connection":
        update(event.status === "connected" ? { status: event.status } : { status: event.status, peers: [], session: EMPTY_SESSION, state: null });
        break;
      case "state":
        if (event.state.from === liveRef.current.session.active && event.state.from !== liveRef.current.self) update({ state: event.state });
        break;
      case "command":
        if (liveRef.current.session.active === liveRef.current.self) drive(() => applyCommand(event));
        break;
      case "give": {
        const handoff = buildState();
        if (!handoff) {
          void send({ type: "take-failed", giver: "", requester: event.requester, message: "Nothing is playing" });
          break;
        }
        void send({ type: "handoff", to: event.to, requester: event.requester, handoff });
        finishHandoff(false);
        handoffRef.current = {
          resume: player.isPlaying,
          timer: window.setTimeout(() => {
            if (!handoffRef.current) return;
            player.toast(`Couldn't move playback to ${peerName(event.to) || "that device"}`, "error");
            finishHandoff(true);
          }, HANDOFF_TIMEOUT_MS)
        };
        pauseLocal();
        break;
      }
      case "take": {
        const handoff = event.handoff;
        const song = handoff ? player.songsById.get(handoff.songId) : undefined;
        const refuse = (message: string) => void send({ type: "take-failed", giver: event.giver, requester: event.requester, message });
        if (!handoff?.songId) { refuse("Nothing is playing"); break; }
        // The song playing has to be here. Queued songs that aren't stay in the queue, greyed out, and are skipped.
        if (!isPlayableSong(song)) {
          // Shown on whichever device asked, so it names the phone rather than "this phone".
          refuse(android ? `"${handoff.title}" isn't copied to the phone yet. Sync the phone to copy it` : `"${handoff.title}" isn't on the ${computerName()}`);
          break;
        }
        void send({ type: "took" });
        player.setQueue(handoff.queue);
        player.setShuffle(handoff.shuffle);
        player.setRepeat(handoff.repeat);
        startLocally(song.id, livePositionMs(handoff, serverNow()) / 1000, handoff.playing);
        break;
      }
      case "take-failed":
        player.toast(event.message || "Couldn't move playback", "error");
        finishHandoff(true);
        break;
      case "like":
        player.onLike(event.songId, event.liked);
        break;
      case "notice":
        player.toast(event.message, "info");
        break;
    }
  };

  useEffect(() => {
    const bridge = window.localitfy;
    if (!bridge?.onLiveEvent || !bridge.liveSend) return;
    const off = bridge.onLiveEvent((event) => handlers.current(event));
    void bridge.liveSend({ type: "status" }).then((reply) => {
      if (reply?.ok && reply.peers && reply.session) adoptPresence(reply as LivePresence, false);
    }).catch(() => undefined);
    return off;
  }, []);

  // Pressing play makes this device the player; the one playing before pauses.
  useEffect(() => {
    const { session, self, peers } = liveRef.current;
    if (local.isPlaying && self && peers.length > 1 && session.active !== self) void send({ type: "claim" });
  }, [local.isPlaying]);

  useEffect(() => { queueRevRef.current += 1; }, [local.queue]);

  useEffect(publish, [local.currentSong?.id, local.isPlaying, local.queue, local.isShuffle, local.repeatMode, live.session.epoch, live.session.active, live.self, live.peers.length]);

  // Seeks and slow starts don't change React state; catch them by comparing with what remotes assume.
  useEffect(() => {
    if (live.session.active !== live.self || live.peers.length < 2) return;
    const timer = window.setInterval(() => {
      const published = publishedRef.current;
      if (!published) return publish();
      const expected = livePositionMs(published.state, serverNow());
      const actual = localRef.current.getTime() * 1000;
      if (Math.abs(expected - actual) > DRIFT_MS || (localRef.current.isPlaying && Date.now() - published.sentAt > STATE_EVERY_MS)) publish();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [live.session.active, live.self, live.peers.length]);

  const remote = remoteActive() ? live.state : null;
  const remoteName = remoteActive() ? peerName(live.session.active) : "";

  // Remote position between reports; the progress bars are painted directly, like the app's own player does.
  const paintTargets = useRef<Pick<PlayerBarProps, "progressInputRefs" | "progressTimeLabelRefs" | "progressDurationLabelRefs"> | null>(null);
  const paint = (positionMs: number, durationMs: number) => {
    const targets = paintTargets.current;
    if (!targets) return;
    const percent = durationMs > 0 ? clamp((positionMs / durationMs) * 100, 0, 100) : 0;
    for (const input of targets.progressInputRefs.current) {
      if (!input) continue;
      input.value = String(percent);
      input.style.setProperty("--range-progress", `${percent}%`);
    }
    for (const node of targets.progressTimeLabelRefs.current) if (node) node.textContent = formatTime(positionMs / 1000);
    for (const node of targets.progressDurationLabelRefs.current) if (node) node.textContent = formatTime(durationMs / 1000);
  };
  useEffect(() => {
    if (!remote) return;
    const draw = () => { if (!seekingRef.current) paint(livePositionMs(remote, serverNow()), remote.durationMs); };
    draw();
    if (!remote.playing) return;
    const timer = window.setInterval(draw, PAINT_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [remote]);

  const command = (next: LiveCommand, optimistic?: Partial<LiveState>) => {
    const { state, session } = liveRef.current;
    if (state && optimistic) update({ state: { ...state, ...optimistic } });
    void send({ type: "command", epoch: session.epoch, ...next }).then((reply) => {
      if (reply && !reply.ok && reply.error) localRef.current.toast(reply.error, "error");
    });
  };
  const here = () => (liveRef.current.state ? livePositionMs(liveRef.current.state, serverNow()) : 0);

  // The phone's notification and lock screen control the other device while this one is a remote.
  useEffect(() => {
    if (!android) return;
    const song = remote ? local.songsById.get(remote.songId) : null;
    window.dispatchEvent(new CustomEvent("localtifyremotemedia", {
      detail: remote ? {
        title: remote.title, artist: remote.artist, album: remote.album, artworkUrl: song?.coverUrl || "",
        playing: remote.playing, positionMs: livePositionMs(remote, serverNow()), durationMs: remote.durationMs,
        shuffle: remote.shuffle, repeat: remote.repeat, device: remoteName
      } : null
    }));
  }, [remote, remoteName]);
  useEffect(() => {
    if (!android) return;
    const onAction = (event: Event) => {
      const { action, position } = (event as CustomEvent<{ action: string; position?: number }>).detail;
      const state = liveRef.current.state;
      if (!state || !remoteActive()) return;
      if (action === "play" || action === "pause") command({ action }, { playing: action === "play", positionMs: here(), at: serverNow() });
      else if (action === "nexttrack") command({ action: "next" });
      else if (action === "previoustrack") command({ action: "previous" });
      else if (action === "seekto") command({ action: "seek", positionMs: (position || 0) * 1000 }, { positionMs: (position || 0) * 1000, at: serverNow() });
      else if (action === "shuffle") command({ action: "shuffle", on: !state.shuffle }, { shuffle: !state.shuffle });
      else if (action === "repeat") command({ action: "repeat", mode: nextRepeatMode(state.repeat) }, { repeat: nextRepeatMode(state.repeat) });
    };
    window.addEventListener("localtifyremoteaction", onAction);
    return () => window.removeEventListener("localtifyremoteaction", onAction);
  }, []);

  const transfer = (id: string) => {
    const { session, self } = liveRef.current;
    if (id === session.active) return;
    // Nothing is playing anywhere yet: this device's song is the one to move.
    if (!session.active || !liveRef.current.peers.some((peer) => peer.id === session.active)) {
      if (localRef.current.currentSong && id !== self) void send({ type: "claim" }).then(() => send({ type: "transfer", to: id }));
      else void send({ type: "transfer", to: id });
      return;
    }
    void send({ type: "transfer", to: id }).then((reply) => {
      if (reply && !reply.ok && reply.error) localRef.current.toast(reply.error, "error");
    });
  };

  /** True while this device only controls another one; the app's own calls from this hook never count. */
  const redirect = () => !drivingRef.current && remoteActive();
  const toggle = () => {
    const state = liveRef.current.state;
    if (!redirect() || !state) return false;
    const playing = !state.playing;
    command({ action: playing ? "play" : "pause" }, { playing, positionMs: here(), at: serverNow() });
    return true;
  };
  const skip = (direction: 1 | -1) => {
    if (!redirect()) return false;
    command({ action: direction > 0 ? "next" : "previous" });
    return true;
  };

  const showPicker = android ? live.status !== "off" : live.peers.length > 1;
  const controls: ConnectControls | null = showPicker
    ? { status: live.status, self: live.self, peers: live.peers, active: live.session.active, remoteName, label, transfer }
    : null;
  const remoteSong = remote ? local.songsById.get(remote.songId) || reportedSong(remote) : null;

  return {
    controls,
    remote,

    /** The app's play/pause and skip buttons: while another device plays, they control it. */
    toggle,
    skip,
    /** A song picked here plays on the device that is playing, along with the queue it was picked with. */
    play(songId: string) {
      if (!redirect()) return false;
      const before = localRef.current.queue;
      // Let the app commit the queue it set together with the song (album, playlist) before reading it.
      window.setTimeout(() => {
        const after = localRef.current.queue;
        command({ action: "play-song", songId, replaceQueue: after !== before, queue: after });
      }, 50);
      return true;
    },
    queue(songIds: string[], next: boolean) {
      const state = liveRef.current.state;
      if (!redirect() || !state || !songIds.length) return false;
      command({ action: "queue-add", songIds, next }, { queue: addToQueue(state.queue, songIds, next) });
      return true;
    },

    playerBar<T extends PlayerBarProps>(props: T): T & ConnectPlayerProps {
      paintTargets.current = props;
      if (!remote || !remoteSong) return { ...props, connect: controls };
      const durationMs = remote.durationMs;
      const positionMs = livePositionMs(remote, serverNow());
      const toMs = (value: string | number) => (clamp(Number(value), 0, 100) / 100) * durationMs;
      const preview = (value: string | number, input?: HTMLInputElement | null) => {
        seekingRef.current = true;
        input?.style.setProperty("--range-progress", `${clamp(Number(value), 0, 100)}%`);
        for (const node of props.progressTimeLabelRefs.current) if (node) node.textContent = formatTime(toMs(value) / 1000);
      };
      return {
        ...props,
        connect: controls,
        currentSong: remoteSong,
        isPlaying: remote.playing,
        isSeeking: false,
        currentDuration: durationMs / 1000,
        displayedTime: positionMs / 1000,
        displayedProgress: durationMs > 0 ? (positionMs / durationMs) * 100 : 0,
        nowPlayingTransitionKey: `live:${remote.songId}`,
        nowPlayingContextLabel: remote.contextLabel || props.nowPlayingContextLabel,
        isShuffle: remote.shuffle,
        setIsShuffle: (value: SetStateAction<boolean>) => {
          const on = typeof value === "function" ? value(remote.shuffle) : value;
          command({ action: "shuffle", on }, { shuffle: on });
        },
        repeatMode: remote.repeat,
        repeatButtonStateText: remote.repeat === "one" ? "1" : "",
        toggleRepeat: () => command({ action: "repeat", mode: nextRepeatMode(remote.repeat) }, { repeat: nextRepeatMode(remote.repeat) }),
        queueCount: remote.queue.length,
        togglePlay: toggle,
        playNext: () => skip(1),
        playPrevious: () => skip(-1),
        startSeekPreview: preview,
        previewSeek: preview,
        commitSeek: (value?: string | number) => {
          seekingRef.current = false;
          const ms = toMs(value ?? 0);
          command({ action: "seek", positionMs: ms }, { positionMs: ms, at: serverNow() });
          setTick((tick) => tick + 1);
        }
      };
    },

    queuePanel(props: QueuePanelProps): QueuePanelProps {
      const player = localRef.current;
      if (!remote || !remoteSong) {
        // The phone skips queued songs it hasn't copied yet; show them greyed out instead of hiding them.
        return android ? { ...props, unavailable: { ids: new Set(props.queue.filter((id) => !isPlayableSong(player.songsById.get(id)))), label: "not on this phone" } } : props;
      }
      return {
        ...props,
        currentSong: remoteSong,
        contextLabel: remote.contextLabel,
        queue: remote.queue,
        setQueue: (value: SetStateAction<string[]>) => {
          const base = liveRef.current.state?.queue || remote.queue;
          const queue = typeof value === "function" ? value(base) : value;
          command({ action: "queue-set", baseRev: liveRef.current.state?.queueRev, base, queue }, { queue });
        },
        playQueueItem: (index: number) => command({ action: "play-index", index, songId: remote.queue[index] }),
        autoNextSong: null,
        repeatMode: remote.repeat,
        repeatPreview: null,
        unavailable: remote.missing.length ? { ids: new Set(remote.missing), label: `not on ${remoteName}` } : undefined
      };
    },

    lyrics<T extends Pick<LyricsViewProps, "song" | "isPlaying" | "getTime" | "seekTo">>(props: T): T {
      if (!remote || !remoteSong) return props;
      return {
        ...props,
        song: remoteSong,
        isPlaying: remote.playing,
        getTime: () => (liveRef.current.state ? livePositionMs(liveRef.current.state, serverNow()) / 1000 : 0),
        seekTo: (seconds: number) => command({ action: "seek", positionMs: seconds * 1000 }, { positionMs: seconds * 1000, at: serverNow() })
      };
    }
  };
}
