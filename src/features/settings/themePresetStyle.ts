import type { CSSProperties } from "react";
import type { ThemeId } from "./theme.types";
import { hexToRgbString, hexToRgbaString } from "./theme.utils";

export type ThemeVisualPalette = {
  accent: string;
  accent2: string;
  background: string;
  surface: string;
  text: string;
  highlight: string;
  progress?: string;
};
export const THEME_PRESET_COLORS: Record<ThemeId, ThemeVisualPalette> = {
 mint:{accent:"#8dffce",accent2:"#68d8ff",background:"#020706",surface:"#0b1713",text:"#f4fff9",highlight:"#d8fff0"},
  berry:{accent:"#ff72c8",accent2:"#b05cff",background:"#0b0209",surface:"#1b0b18",text:"#fff3fb",highlight:"#ffc4ee"},
  aqua:{accent:"#53d7ff",accent2:"#7c5cff",background:"#02070b",surface:"#071724",text:"#effaff",highlight:"#c6f3ff"},
  sunset:{accent:"#ffb86b",accent2:"#ff5f8a",background:"#0b0502",surface:"#1c1008",text:"#fff7ed",highlight:"#ffd7a8"},
  lavender:{accent:"#c084fc",accent2:"#f0abfc",background:"#080412",surface:"#161024",text:"#f8f3ff",highlight:"#e9d5ff"},
  mono:{accent:"#f4f4f5",accent2:"#a1a1aa",background:"#030303",surface:"#121212",text:"#f8f8f8",highlight:"#d4d4d8"},
  rose:{accent:"#fb7185",accent2:"#f472b6",background:"#0b0306",surface:"#1a0b10",text:"#fff1f4",highlight:"#fecdd3"},
  cotton:{accent:"#93c5fd",accent2:"#f0abfc",background:"#030711",surface:"#0e1626",text:"#f0f7ff",highlight:"#dbeafe"},
  honey:{accent:"#facc15",accent2:"#fb923c",background:"#090701",surface:"#1a1405",text:"#fffbe7",highlight:"#fef3c7"},
  lime:{accent:"#a3e635",accent2:"#22c55e",background:"#030800",surface:"#0d1805",text:"#f7ffe8",highlight:"#d9f99d"},
  midnight:{accent:"#60a5fa",accent2:"#818cf8",background:"#020617",surface:"#0b1223",text:"#f1f5ff",highlight:"#bfdbfe"},
  mocha:{accent:"#c08457",accent2:"#f5c17a",background:"#090604",surface:"#19110c",text:"#fff7ed",highlight:"#fed7aa"},
  cherry:{accent:"#f43f5e",accent2:"#fb7185",background:"#0c0205",surface:"#1d0710",text:"#fff1f3",highlight:"#fecdd3"},
  ice:{accent:"#67e8f9",accent2:"#bae6fd",background:"#02090c",surface:"#081821",text:"#effdff",highlight:"#cffafe"},
  matcha:{accent:"#86efac",accent2:"#bef264",background:"#020804",surface:"#0b180e",text:"#effff3",highlight:"#bbf7d0"},
  bubblegum:{accent:"#f472d0",accent2:"#67e8f9",background:"#0b0310",surface:"#1b1025",text:"#fff3fb",highlight:"#fbcfe8"},
  stars:{accent:"#d7d5ff",accent2:"#8fdcff",background:"#050610",surface:"#17182d",text:"#f6f3ff",highlight:"#ffffff"},
  sakura:{accent:"#f9a8d4",accent2:"#fb7185",background:"#0b0408",surface:"#1c0e16",text:"#fff5fa",highlight:"#fce7f3"},
  dreamcore:{accent:"#a78bfa",accent2:"#f0abfc",background:"#050416",surface:"#121027",text:"#f7f3ff",highlight:"#ddd6fe"},
  peach:{accent:"#fdba74",accent2:"#fb7185",background:"#0b0603",surface:"#1b1008",text:"#fff7ed",highlight:"#fed7aa"},
  moon:{accent:"#cbd5e1",accent2:"#94a3b8",background:"#04060a",surface:"#111827",text:"#f8fafc",highlight:"#e2e8f0"},
  starlight:{accent:"#e0e7ff",accent2:"#93c5fd",background:"#030414",surface:"#0e1025",text:"#f8fbff",highlight:"#dbeafe"},
  neonNoir:{accent:"#37f8ff",accent2:"#22d3ee",background:"#010608",surface:"#06171b",text:"#effeff",highlight:"#a5f3fc"},
  cyberGrape:{accent:"#a855f7",accent2:"#22d3ee",background:"#080011",surface:"#170826",text:"#fbf4ff",highlight:"#e9d5ff"},
  ember:{accent:"#ff7a2f",accent2:"#ffd166",background:"#0b0301",surface:"#1d0b04",text:"#fff7ed",highlight:"#fed7aa"},
  forest:{accent:"#34d399",accent2:"#86efac",background:"#020704",surface:"#08170e",text:"#effff5",highlight:"#bbf7d0"},
  ocean:{accent:"#38bdf8",accent2:"#2563eb",background:"#020716",surface:"#09162c",text:"#f0f9ff",highlight:"#bae6fd"},
  ruby:{accent:"#fb315d",accent2:"#f97316",background:"#0c0205",surface:"#1e0710",text:"#fff1f4",highlight:"#fecdd3"},
  aurora:{accent:"#5eead4",accent2:"#c084fc",background:"#02090b",surface:"#08171a",text:"#f2fffd",highlight:"#ccfbf1"},
  vanilla:{accent:"#fff1c2",accent2:"#f0b35a",background:"#080604",surface:"#17120b",text:"#fffaf0",highlight:"#fde68a"},
  vaporwave:{accent:"#fb6fd9",accent2:"#4dd4ff",background:"#070315",surface:"#160c28",text:"#fff4fd",highlight:"#fbcfe8"},
  ultraviolet:{accent:"#8b5cf6",accent2:"#f0abfc",background:"#07000f",surface:"#150822",text:"#faf5ff",highlight:"#ddd6fe"},
  terminal:{accent:"#22c55e",accent2:"#bbf7d0",background:"#000804",surface:"#06140b",text:"#effff3",highlight:"#86efac"},
  candyCloud:{accent:"#fb7bdc",accent2:"#67e8f9",background:"#0b0310",surface:"#1b1025",text:"#fff4fd",highlight:"#fbcfe8"},
  rainstorm:{accent:"#38bdf8",accent2:"#818cf8",background:"#020617",surface:"#0b1224",text:"#f0f9ff",highlight:"#bfdbfe"},
  lavaLamp:{accent:"#ef4444",accent2:"#f59e0b",background:"#0b0200",surface:"#1c0803",text:"#fff4ee",highlight:"#fecaca"},
  softSky:{accent:"#93c5fd",accent2:"#e0f2fe",background:"#04101d",surface:"#0c1b2f",text:"#f0f9ff",highlight:"#dbeafe"},
  arcadeGhost:{accent:"#22d3ee",accent2:"#f472b6",background:"#03030a",surface:"#0e1020",text:"#f8fbff",highlight:"#a5f3fc"}
};

export function makeThemePresetStyle(themeId: ThemeId): CSSProperties {
  const p=THEME_PRESET_COLORS[themeId]??THEME_PRESET_COLORS.mint;
  const progress=p.progress??p.accent;
  const accentRgb=hexToRgbString(p.accent,THEME_PRESET_COLORS.mint.accent);
  const accent2Rgb=hexToRgbString(p.accent2,p.accent);
  const highlightRgb=hexToRgbString(p.highlight,p.accent);
  const progressRgb=hexToRgbString(progress,p.accent);
  return {
    "--bg":p.background,
    "--bg-2":p.background,
    "--bg-3":p.surface,
    "--panel":hexToRgbaString(p.surface,"#121212",.56),
    "--surface":hexToRgbaString(p.surface,"#121212",.42),
    "--surface-2":hexToRgbaString(p.surface,"#121212",.56),
    "--surface-3":hexToRgbaString(p.surface,"#121212",.72),
    "--text":p.text,
    "--text-2":hexToRgbaString(p.text,"#ffffff",.78),
    "--muted":hexToRgbaString(p.text,"#ffffff",.54),
    "--faint":hexToRgbaString(p.text,"#ffffff",.34),
    "--line":hexToRgbaString(p.accent,"#8dffce",.18),
    "--line-2":hexToRgbaString(p.accent,"#8dffce",.28),
    "--accent":p.accent,
    "--accent-2":p.accent2,
    "--highlight":p.highlight,
    "--progress":progress,
    "--accent-rgb":accentRgb,
    "--accent-2-rgb":accent2Rgb,
    "--highlight-rgb":highlightRgb,
    "--progress-rgb":progressRgb,
    "--accent-soft":hexToRgbaString(p.accent,"#8dffce",.14),
    "--accent-line":hexToRgbaString(p.accent,"#8dffce",.34),
    "--theme-accent":p.accent,
    "--theme-accent-2":p.accent2,
    "--theme-highlight":p.highlight,
    "--theme-progress":progress,
    "--theme-card-glass":hexToRgbaString(p.accent,"#8dffce",.045),
    "--theme-card-border":hexToRgbaString(p.accent,"#8dffce",.16),
    "--theme-hover-glass":hexToRgbaString(p.accent,"#8dffce",.09),
    "--theme-hover-border":hexToRgbaString(p.accent,"#8dffce",.32),
    "--card-rgb":accentRgb,
    "--localtify-sidebar-bg":hexToRgbaString(p.background,"#050505",.98),
    "--localtify-sidebar-bg-2":hexToRgbaString(p.surface,"#111111",.72),
    "--localtify-panel-bg":hexToRgbaString(p.surface,"#111111",.52),
    "--localtify-panel-bg-2":hexToRgbaString(p.background,"#050505",.74),
    "--localtify-line-soft":hexToRgbaString(p.accent,"#8dffce",.16)
  } as CSSProperties;
}
