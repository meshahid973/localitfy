import type { UpdatePromptState } from "./update.types";
export const APP_VERSION = "0.5.0";
export const UPDATE_LEAVE_ALONE_PREFIX = "localitfy.updateLeaveAloneVersion.";
export const WHATS_NEW_SEEN_KEY = "localitfy.whatsNewSeenVersion";
export const defaultUpdatePrompt: UpdatePromptState = { visible:false, status:"idle", version:"", percent:0, message:"", error:"" };
export const updateRibbonEnterSpring = { type:"spring", stiffness:500, damping:35, mass:0.58 } as const;
export const updateRibbonChildSpring = { type:"spring", stiffness:520, damping:34, mass:0.55 } as const;
export const whatsNewItems = [
  "More reliable music-library imports and album artwork handling",
  "Playback and background-audio stability improvements",
  "Cleaner navigation, consistent UI details, and retired legacy styling",
  "Optional Rust-powered processing with JavaScript fallback; disabled by default",
  "Stronger Windows and Linux packaging and release validation"
];
