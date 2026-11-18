/** Only current renderer modes; legacy persisted IDs are normalized at the boundary. */
export type ThemeId = "dark" | "light";

export type SecretMode = "none" | "yukari";
export type SecretTriggerMode = Exclude<SecretMode, "none">;
export type CoverColorSyncMode = "off" | "subtle" | "normal" | "strong";
