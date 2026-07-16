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
  "timeupdate",
  "play",
  "pause",
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

export function createPlayerController(engine: PlayerEngine): PlayerController {
  let queue: PlayerEngineSource[] = [];
  let queueIndex = -1;

  const listeners = new Set<PlayerControllerListener>();
  const removeEngineListeners = ENGINE_EVENTS.map((event) =>
    engine.on(event, (_state, emittedEvent) => emit(emittedEvent))
  );

  function emit(event: PlayerEngineEvent | "queuechange") {
    const snapshot = getSnapshot();

    for (const listener of listeners) {
      listener(snapshot, event);
    }
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

    if (existingIndex >= 0) {
      queueIndex = existingIndex;
    } else {
      // Standalone playback should not keep an old queue/index around.
      queue = [source];
      queueIndex = 0;
    }

    engine.load(source);
    emit("queuechange");
  }

  function setQueue(nextQueue: readonly PlayerEngineSource[], startIndex = 0) {
    queue = [...nextQueue];
    queueIndex = clampIndex(startIndex, queue);

    if (queueIndex >= 0) {
      engine.load(queue[queueIndex]);
    } else {
      engine.clear();
    }

    emit("queuechange");
  }

  function clearQueue() {
    queue = [];
    queueIndex = -1;
    engine.clear();
    emit("queuechange");
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
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function destroy() {
    for (const remove of removeEngineListeners) {
      remove();
    }

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
