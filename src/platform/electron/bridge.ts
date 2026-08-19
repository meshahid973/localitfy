import type { LocalitfyBridge } from "./bridge.types";

/**
 * Renderer-side access point for Electron's preload bridge.
 *
 * Existing direct `window.localitfy` access is intentionally left in place
 * during Phase 1. New/extracted modules should use this function so the app can
 * migrate toward one typed platform boundary without a risky big-bang rewrite.
 */
export function getLocalitfyBridge(): LocalitfyBridge {
  return window.localitfy;
}
