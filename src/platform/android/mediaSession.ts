import { LocaltifyNative, type MediaAction } from "./native";

type Handler = (details: MediaSessionActionDetails) => void;

/**
 * The renderer already describes playback through navigator.mediaSession (as it does for macOS and Windows).
 * Android's WebView ignores that, so this mirrors it into the native media session: notification, lock screen,
 * headset and Bluetooth buttons. Commands come back through the renderer's own action handlers.
 */
export function installMediaSessionBridge(filesDir: string, mediaPrefix: string) {
  const handlers = new Map<string, Handler>();
  let metadata: MediaMetadata | null = null;
  let playbackState: MediaSessionPlaybackState = "none";
  let lastPlayed: HTMLMediaElement | null = null;
  let timer = 0;

  const artworkPath = () => {
    const src = metadata?.artwork?.[0]?.src || "";
    if (!src.startsWith(mediaPrefix)) return "";
    return `${filesDir}/${decodeURIComponent(src.slice(mediaPrefix.length).split("?")[0])}`;
  };

  const push = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const element = lastPlayed;
      const duration = element && Number.isFinite(element.duration) ? element.duration : 0;
      void LocaltifyNative.updateMedia({
        title: metadata?.title || "",
        artist: metadata?.artist || "",
        album: metadata?.album || "",
        artwork: artworkPath(),
        state: metadata ? playbackState === "playing" ? "playing" : playbackState === "paused" ? "paused" : "none" : "none",
        position: element ? element.currentTime : 0,
        duration,
        rate: element?.playbackRate || 1
      }).catch(() => undefined);
    }, 60);
  };

  const session = {
    get metadata() { return metadata; },
    set metadata(value: MediaMetadata | null) { metadata = value; push(); },
    get playbackState() { return playbackState; },
    set playbackState(value: MediaSessionPlaybackState) { playbackState = value; push(); },
    setActionHandler(action: MediaSessionAction, handler: Handler | null) {
      if (handler) handlers.set(action, handler);
      else handlers.delete(action);
    },
    setPositionState() { push(); },
    setMicrophoneActive() {},
    setCameraActive() {}
  };
  Object.defineProperty(navigator, "mediaSession", { configurable: true, value: session });
  // Android's WebView has no MediaMetadata class either; the renderer only needs a plain holder.
  if (typeof window.MediaMetadata === "undefined") {
    window.MediaMetadata = class {
      title: string; artist: string; album: string; artwork: MediaImage[];
      constructor(init: MediaMetadataInit = {}) {
        this.title = init.title || "";
        this.artist = init.artist || "";
        this.album = init.album || "";
        this.artwork = [...(init.artwork || [])];
      }
    } as unknown as typeof MediaMetadata;
  }

  // A song routed through Web Audio (effects, beat visuals) stalls if it starts while the screen is off,
  // so audio elements never join a graph here; the effect runtime then falls back to plain element playback.
  if (window.AudioContext) {
    AudioContext.prototype.createMediaElementSource = function blockMediaElementSource(): MediaElementAudioSourceNode {
      throw new Error("Web Audio playback is off on Android");
    };
  }

  // Crossfade plays through detached Audio elements, so follow whichever element last started playing.
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function playAndTrack(this: HTMLMediaElement) {
    lastPlayed = this;
    const result = play.call(this);
    void result?.then?.(push, () => undefined);
    return result;
  };
  const currentTime = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
  if (currentTime?.set && currentTime.get) {
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      configurable: true,
      get: currentTime.get,
      set(this: HTMLMediaElement, value: number) {
        currentTime.set!.call(this, value);
        if (this === lastPlayed) push();
      }
    });
  }

  void LocaltifyNative.addListener("mediaAction", ({ action, position }) => {
    const name: MediaAction = action;
    const handler = handlers.get(name);
    if (!handler) return;
    handler(name === "seekto" ? { action: "seekto", seekTime: position ?? 0 } : { action: name as MediaSessionAction });
  });
}
