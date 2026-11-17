/** Legacy IDs remain readable for old settings payloads; only dark/light are selectable. */
export type ThemeId =
  | "dark" | "light"
  | "mint" | "berry" | "aqua" | "sunset" | "lavender" | "mono" | "rose" | "cotton" | "honey" | "lime"
  | "midnight" | "mocha" | "cherry" | "ice" | "matcha" | "bubblegum" | "sakura" | "dreamcore" | "peach"
  | "moon" | "starlight" | "neonNoir" | "cyberGrape" | "ember" | "forest" | "ocean" | "ruby" | "aurora"
  | "vanilla" | "vaporwave" | "ultraviolet" | "terminal" | "candyCloud" | "rainstorm" | "lavaLamp"
  | "softSky" | "stars" | "arcadeGhost";

export type SecretMode = "none" | "stars" | "yukari";
export type SecretTriggerMode = Exclude<SecretMode, "none">;
export type CoverColorSyncMode = "off" | "subtle" | "normal" | "strong";
