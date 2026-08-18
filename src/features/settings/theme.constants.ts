import type { ThemeId } from "./theme.types";
export const themes = [
  { id: "mint", name: "mint berry", note: "black and fresh", mood: "clean + calm", emoji: "🌿" },
  { id: "bubblegum", name: "bubblegum", note: "pink blue pop", mood: "cute UI", emoji: "🍬" },
  { id: "berry", name: "berry", note: "deep purple glow", mood: "soft night", emoji: "🍓" },
  { id: "midnight", name: "midnight", note: "deep blue OLED", mood: "late night", emoji: "🌙" },
  { id: "mono", name: "light mode", note: "bright clean contrast", mood: "daylight", emoji: "☀️" },
  { id: "stars", name: "stars", note: "drifting sparkle field", mood: "sparkly night", emoji: "✨" }
] as const;
export const THEME_ID_SET = new Set<string>(themes.map((theme) => theme.id));
export const RETIRED_ANIMATED_THEME_IDS = new Set(["vaporGlass", "nightTrain"]);
export const THEME_SWATCH_COLORS: Record<ThemeId, string> = {
  mint:"#8dffce", berry:"#ff72c8", aqua:"#53d7ff", sunset:"#ffb86b", lavender:"#c084fc", mono:"#f4f4f5", rose:"#fb7185", cotton:"#93c5fd", honey:"#facc15", lime:"#a3e635", midnight:"#60a5fa", mocha:"#c08457", cherry:"#f43f5e", ice:"#67e8f9", matcha:"#86efac", bubblegum:"#f472d0", stars:"#d7d5ff", sakura:"#f9a8d4", dreamcore:"#a78bfa", peach:"#fdba74", moon:"#cbd5e1", starlight:"#e0e7ff", neonNoir:"linear-gradient(135deg, #062a30 0%, #37f8ff 55%, #000 100%)", cyberGrape:"linear-gradient(135deg, #170033 0%, #a855f7 55%, #22d3ee 100%)", ember:"linear-gradient(135deg, #180704 0%, #ff7a2f 55%, #ffd166 100%)", forest:"linear-gradient(135deg, #03150d 0%, #34d399 55%, #0b3b25 100%)", ocean:"linear-gradient(135deg, #03142b 0%, #38bdf8 55%, #2563eb 100%)", ruby:"linear-gradient(135deg, #22040b 0%, #fb315d 55%, #7f1d1d 100%)", aurora:"linear-gradient(135deg, #071417 0%, #5eead4 40%, #c084fc 100%)", vanilla:"linear-gradient(135deg, #1d1710 0%, #fff1c2 55%, #f0b35a 100%)", vaporwave:"linear-gradient(135deg, #0e0630 0%, #fb6fd9 50%, #4dd4ff 100%)", ultraviolet:"linear-gradient(135deg, #12001f 0%, #8b5cf6 50%, #f0abfc 100%)", terminal:"linear-gradient(135deg, #001005 0%, #22c55e 55%, #bbf7d0 100%)", candyCloud:"linear-gradient(135deg, #2b0522 0%, #fb7bdc 48%, #67e8f9 100%)", rainstorm:"linear-gradient(135deg, #020617 0%, #38bdf8 45%, #818cf8 100%)", lavaLamp:"linear-gradient(135deg, #1b0500 0%, #ef4444 45%, #f59e0b 100%)", softSky:"linear-gradient(135deg, #06111f 0%, #93c5fd 52%, #e0f2fe 100%)", arcadeGhost:"#22d3ee"
};
