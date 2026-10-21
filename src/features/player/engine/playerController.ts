import type { PlayerEngine, PlayerEngineSource } from "./PlayerEngine";

/**
 * Transport-only facade around the main audio engine.
 * Queue order, history, shuffle, and repeats have one owner: usePlayerRuntime.
 * Do not mirror their state here or subscribe to unused media events.
 */
export type PlayerController = {
  load(source: PlayerEngineSource): void;
  play(): Promise<void>;
  pause(): void;
  toggle(): Promise<boolean>;
  seekTo(seconds: number): void;
  seekBy(deltaSeconds: number): void;
  setVolume(volume: number): void;
  destroy(): void;
};

export function createPlayerController(engine: PlayerEngine): PlayerController {
  return {
    load: (source) => engine.load(source),
    play: () => engine.play(),
    pause: () => engine.pause(),
    toggle: () => engine.toggle(),
    seekTo: (seconds) => engine.seek(seconds),
    seekBy: (deltaSeconds) => engine.seek(engine.getState().currentTime + deltaSeconds),
    setVolume: (volume) => engine.setVolume(volume),
    destroy: () => engine.destroy()
  };
}
