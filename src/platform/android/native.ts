import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export type MediaAction = "play" | "pause" | "stop" | "nexttrack" | "previoustrack" | "seekto" | "shuffle" | "repeat";

export type MediaUpdate = {
  title: string;
  artist: string;
  album: string;
  /** Absolute path of a cover inside app storage. */
  artwork: string;
  state: "playing" | "paused" | "none";
  position: number;
  duration: number;
  rate: number;
  shuffle: boolean;
  repeat: "off" | "one" | "all";
};

/** Native half of the Android app (android/app/src/main/java/.../LocaltifyNativePlugin.java). */
export interface LocaltifyNativePlugin {
  getPaths(): Promise<{ files: string; mediaPrefix: string; deviceName: string }>;
  request(options: { url: string; method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number }): Promise<{ status: number; body: string }>;
  downloadFile(options: { id: string; url: string; path: string; headers?: Record<string, string> }): Promise<{ bytes: number }>;
  deleteFile(options: { path: string }): Promise<{ deleted: boolean }>;
  setSyncActive(options: { active: boolean }): Promise<void>;
  moveToBackground(): Promise<void>;
  updateMedia(options: MediaUpdate): Promise<void>;
  /** Opens (or keeps) the live event stream from the Mac; reconnects on its own until liveDisconnect. */
  liveConnect(options: { url: string; token: string }): Promise<void>;
  liveDisconnect(): Promise<void>;
  addListener(event: "mediaAction", listener: (data: { action: MediaAction; position?: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: "downloadProgress", listener: (data: { id: string; received: number; total: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: "liveEvent", listener: (data: { data: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "liveStatus", listener: (data: { status: "connecting" | "connected" | "offline" | "unsupported" | "unpaired" }) => void): Promise<PluginListenerHandle>;
}

export const LocaltifyNative = registerPlugin<LocaltifyNativePlugin>("LocaltifyNative");
