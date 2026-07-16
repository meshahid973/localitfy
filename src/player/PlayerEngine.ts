export type PlayerEngineEvent =
  | "sourcechange"
  | "loadstart"
  | "loadedmetadata"
  | "canplay"
  | "timeupdate"
  | "play"
  | "pause"
  | "ended"
  | "volumechange"
  | "ratechange"
  | "error";

export type PlayerEngineUnsubscribe = () => void;

export type PlayerEngineSource = {
  id?: string;
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string | null;
  duration?: number | null;
};

export type PlayerEngineError = {
  code: number;
  message?: string;
};

export type PlayerEngineState = {
  source: PlayerEngineSource | null;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  paused: boolean;
  ended: boolean;
  readyState: number;
  error: PlayerEngineError | null;
};

export type PlayerEngineListener = (state: PlayerEngineState, event: PlayerEngineEvent) => void;

export interface PlayerEngine {
  readonly element: HTMLAudioElement;

  load(source: PlayerEngineSource): void;
  clear(): void;
  play(): Promise<void>;
  pause(): void;
  toggle(): Promise<boolean>;

  seek(seconds: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number, preservesPitch?: boolean): void;

  getState(): PlayerEngineState;
  on(event: PlayerEngineEvent, listener: PlayerEngineListener): PlayerEngineUnsubscribe;

  destroy(): void;
}

