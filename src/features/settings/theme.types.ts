export type ThemeId =
  | "mint" | "berry" | "aqua" | "sunset" | "lavender" | "mono" | "rose" | "cotton" | "honey" | "lime"
  | "midnight" | "mocha" | "cherry" | "ice" | "matcha" | "bubblegum" | "sakura" | "dreamcore" | "peach"
  | "moon" | "starlight" | "neonNoir" | "cyberGrape" | "ember" | "forest" | "ocean" | "ruby" | "aurora"
  | "vanilla" | "vaporwave" | "ultraviolet" | "terminal" | "candyCloud" | "rainstorm" | "lavaLamp"
  | "softSky" | "stars" | "arcadeGhost";

export type SecretMode = "none" | "stars" | "yukari";
export type SecretTriggerMode = Exclude<SecretMode, "none">;
export type CoverColorSyncMode = "off" | "subtle" | "normal" | "strong";
