import type { UpdatePromptState } from "./update.types";
export const APP_VERSION = "0.5.1";
export const UPDATE_LEAVE_ALONE_PREFIX = "localitfy.updateLeaveAloneVersion.";
export const WHATS_NEW_SEEN_KEY = "localitfy.whatsNewSeenVersion";
export const defaultUpdatePrompt: UpdatePromptState = { visible:false, status:"idle", version:"", percent:0, message:"", error:"" };
