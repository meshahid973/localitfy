import type { UpdatePromptState } from "./update.types";
export const APP_VERSION = "0.4.1";
export const UPDATE_LEAVE_ALONE_PREFIX = "localitfy.updateLeaveAloneVersion.";
export const WHATS_NEW_SEEN_KEY = "localitfy.whatsNewSeenVersion";
export const defaultUpdatePrompt: UpdatePromptState = { visible:false, status:"idle", version:"", percent:0, message:"", error:"" };
export const updateRibbonEnterSpring = { type:"spring", stiffness:500, damping:35, mass:0.58 } as const;
export const updateRibbonChildSpring = { type:"spring", stiffness:520, damping:34, mass:0.55 } as const;
export const whatsNewItems = [
  "0.4.1 fixes the album library importer freezing on large nested-folder scans",
  "Nested album folders are detected more safely so parent artist folders do not steal child album covers",
  "Album import progress is throttled so the UI stays responsive while scanning and importing",
  "Linux AppImage startup hardening from 0.4.0 is kept, with cleaner update-check behavior",
  "Small release cleanup for version text, Linux install copy, and old development comments"
];
