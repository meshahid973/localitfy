import type {
  PlayerEngine,
  PlayerEngineEvent,
  PlayerEngineSource,
  PlayerEngineState,
  PlayerEngineUnsubscribe
} from "./PlayerEngine";

export type PlayerControllerSnapshot = PlayerEngineState & {
  queue: readonly PlayerEngineSource[];
  queueIndex: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type PlayerControllerListener = (snapshot: PlayerControllerSnapshot, event: PlayerEngineEvent | "queuechange") => void;

export type PlayerController = {
  load(source: PlayerEngineSource): void;
  play(): Promise<void>;
  pause(): void;
  toggle(): Promise<boolean>;
  recover(): void;

  seekTo(seconds: number): void;
  seekBy(deltaSeconds: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number, preservesPitch?: boolean): void;

  setQueue(queue: readonly PlayerEngineSource[], startIndex?: number): void;
  clearQueue(): void;
  next(): void;
  previous(): void;

  getSnapshot(): PlayerControllerSnapshot;
  onChange(listener: PlayerControllerListener): PlayerEngineUnsubscribe;
  destroy(): void;
};

const ENGINE_EVENTS: readonly PlayerEngineEvent[] = [
  "sourcechange",
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

function clampIndex(index: number, queue: readonly PlayerEngineSource[]) {
  if (queue.length === 0) return -1;
  return Math.min(queue.length - 1, Math.max(0, index));
}

function sameSource(left: PlayerEngineSource, right: PlayerEngineSource) {
  return left.id === right.id && left.url === right.url;
}

function sameQueue(left: readonly PlayerEngineSource[], right: readonly PlayerEngineSource[]) {
  return left.length === right.length && left.every((item, index) => sameSource(item, right[index]));
}

export function createPlayerController(engine: PlayerEngine): PlayerController {
  let queue: PlayerEngineSource[] = [];
  let queueIndex = -1;
  let destroyed = false;

  const listeners = new Set<PlayerControllerListener>();
  const removeEngineListeners = ENGINE_EVENTS.map((event) =>
    engine.on(event, (_state, emittedEvent) => emit(emittedEvent))
  );

  function emit(event: PlayerEngineEvent | "queuechange") {
    if (destroyed || !listeners.size) return;
    const snapshot = getSnapshot();
    for (const listener of listeners) listener(snapshot, event);
  }

  function getSnapshot(): PlayerControllerSnapshot {
    return {
      ...engine.getState(),
      queue,
      queueIndex,
      hasNext: queueIndex >= 0 && queueIndex < queue.length - 1,
      hasPrevious: queueIndex > 0
    };
  }

  function load(source: PlayerEngineSource) {
    const existingIndex = queue.findIndex((item) => sameSource(item, source));
    const previousIndex = queueIndex;
    const previousQueue = queue;

    if (existingIndex >= 0) {
      queueIndex = existingIndex;
    } else {
      queue = [source];
      queueIndex = 0;
    }

    engine.load(source);
    if (previousIndex !== queueIndex || previousQueue !== queue) emit("queuechange");
  }

  function setQueue(nextQueue: readonly PlayerEngineSource[], startIndex = 0) {
    const normalizedQueue = [...nextQueue];
    const nextIndex = clampIndex(startIndex, normalizedQueue);
    const changed = !sameQueue(queue, normalizedQueue) || queueIndex !== nextIndex;

    queue = normalizedQueue;
    queueIndex = nextIndex;

    if (queueIndex >= 0) engine.load(queue[queueIndex]);
    else engine.clear();

    if (changed) emit("queuechange");
  }

  function clearQueue() {
    const changed = queue.length > 0 || queueIndex !== -1;
    queue = [];
    queueIndex = -1;
    engine.clear();
    if (changed) emit("queuechange");
  }

  function next() {
    if (queueIndex < 0 || queueIndex >= queue.length - 1) return;
    queueIndex += 1;
    engine.load(queue[queueIndex]);
    emit("queuechange");
  }

  function previous() {
    if (queueIndex <= 0) return;
    queueIndex -= 1;
    engine.load(queue[queueIndex]);
    emit("queuechange");
  }

  function onChange(listener: PlayerControllerListener): PlayerEngineUnsubscribe {
    if (destroyed) return () => undefined;
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const remove of removeEngineListeners) remove();
    listeners.clear();
    queue = [];
    queueIndex = -1;
    engine.destroy();
  }

  return {
    load,
    play: () => engine.play(),
    pause: () => engine.pause(),
    toggle: () => engine.toggle(),
    recover: () => engine.recover(),
    seekTo: (seconds) => engine.seek(seconds),
    seekBy: (deltaSeconds) => engine.seek(engine.getState().currentTime + deltaSeconds),
    setVolume: (volume) => engine.setVolume(volume),
    setMuted: (muted) => engine.setMuted(muted),
    setPlaybackRate: (rate, preservesPitch) => engine.setPlaybackRate(rate, preservesPitch),
    setQueue,
    clearQueue,
    next,
    previous,
    getSnapshot,
    onChange,
    destroy
  };
}
