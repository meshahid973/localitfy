export const themes = [
  { id: "light", name: "Light", note: "Clean neutral surfaces", mood: "daylight", emoji: "☀️" },
  { id: "dark", name: "Dark", note: "Deep black and charcoal", mood: "night", emoji: "🌙" }
] as const;
export const THEME_ID_SET = new Set<string>(themes.map(theme => theme.id));
export const RETIRED_ANIMATED_THEME_IDS = new Set(["stars", "vaporGlass", "nightTrain"]);
export const THEME_SWATCH_COLORS: Record<string, string> = { dark: "#000000", light: "#f5f5f7" };
