import type { CSSProperties } from "react";
import type { ThemeId } from "./theme.types";
import { accentTextColor, hexToRgbString, hexToRgbaString, normalizeThemeId } from "./theme.utils";

export type ThemeVisualPalette = {
  accent: string;
  accent2: string;
  background: string;
  surface: string;
  text: string;
  highlight: string;
  progress?: string;
};
export const THEME_PRESET_COLORS: Record<"dark" | "light", ThemeVisualPalette> = {
  dark: { background: "#000000", surface: "#151518", text: "#ffffff", accent: "#7696ff", accent2: "#a6b8ff", highlight: "#ffffff" },
  light: { background: "#f5f5f7", surface: "#ffffff", text: "#18181b", accent: "#3659c5", accent2: "#526da8", highlight: "#18181b" }
};

export function makeThemePresetStyle(themeId: ThemeId): CSSProperties {
  const mode = normalizeThemeId(themeId);
  const p = THEME_PRESET_COLORS[mode];
  const light = mode === "light";
  const progress=p.progress??p.accent;
  const accentRgb=hexToRgbString(p.accent,THEME_PRESET_COLORS.dark.accent);
  const accent2Rgb=hexToRgbString(p.accent2,p.accent);
  const highlightRgb=hexToRgbString(p.highlight,p.accent);
  const progressRgb=hexToRgbString(progress,p.accent);
  return {
    "--bg":p.background,
    "--bg-2":p.background,
    "--bg-3":p.surface,
    "--panel": p.surface,
    "--surface": p.surface,
    "--surface-2": light ? "#e7e7eb" : "#19191c",
    "--surface-3": light ? "#dedee3" : "#232326",
    "--lt-bg-elevated": light ? "#ffffff" : "#111214",
    "--lt-surface-soft": light ? "rgba(24,24,27,.055)" : "rgba(255,255,255,.055)",
    "--lt-surface-raised": light ? "#e7e7eb" : "#19191c",
    "--lt-danger": light ? "#b42343" : "#ff8095",
    "--text":p.text,
    "--text-2":hexToRgbaString(p.text,"#ffffff",.78),
    "--muted": light ? "#55555f" : "#b5b5bd",
    "--faint": light ? "#696972" : "#94949e",
    "--line": hexToRgbaString(p.text,p.text,.10),
    "--line-2": hexToRgbaString(p.text,p.text,.18),
    "--accent":p.accent,
    "--button-text-on-accent":accentTextColor(p.accent),
    "--accent-2":p.accent2,
    "--highlight":p.highlight,
    "--progress":progress,
    "--accent-rgb":accentRgb,
    "--accent-2-rgb":accent2Rgb,
    "--highlight-rgb":highlightRgb,
    "--progress-rgb":progressRgb,
    "--accent-soft":hexToRgbaString(p.accent,p.accent,.14),
    "--accent-line":hexToRgbaString(p.accent,p.accent,.34),
    "--theme-accent":p.accent,
    "--theme-accent-2":p.accent2,
    "--theme-highlight":p.highlight,
    "--theme-progress":progress,
    "--theme-card-glass":hexToRgbaString(p.accent,p.accent,.045),
    "--theme-card-border":hexToRgbaString(p.accent,p.accent,.16),
    "--theme-hover-glass":hexToRgbaString(p.accent,p.accent,.09),
    "--theme-hover-border":hexToRgbaString(p.accent,p.accent,.32),
    "--card-rgb":accentRgb,
    "--localtify-sidebar-bg":hexToRgbaString(p.background,"#050505",.98),
    "--localtify-sidebar-bg-2":hexToRgbaString(p.surface,"#111111",.72),
    "--localtify-panel-bg":hexToRgbaString(p.surface,"#111111",.52),
    "--localtify-panel-bg-2":hexToRgbaString(p.background,"#050505",.74),
    "--localtify-line-soft":hexToRgbaString(p.accent,p.accent,.16)
  } as CSSProperties;
}
