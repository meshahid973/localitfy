import type { CoverColorSyncMode, ThemeId } from "./theme.types";
import { coverColorSyncOptions } from "./settings.constants";
export function normalizeThemeId(value: unknown, fallback: ThemeId = "dark"): "dark" | "light" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "light" || raw === "mono") return "light";
  if (raw === "dark" || raw) return "dark";
  return fallback === "light" ? "light" : "dark";
}
export function normalizeHexColor(value: string, fallback = "#8dffce") { const raw = String(value || "").trim(); const withHash = raw.startsWith("#") ? raw : `#${raw}`; const short = /^#([0-9a-f]{3})$/i.exec(withHash); if (short) return `#${short[1].split("").map((part) => `${part}${part}`).join("")}`.toLowerCase(); return /^#[0-9a-f]{6}$/i.test(withHash) ? withHash.toLowerCase() : fallback; }
export function normalizeCoverColorSyncMode(value: unknown): CoverColorSyncMode { const safe = String(value || "normal").trim() as CoverColorSyncMode; return coverColorSyncOptions.some((option) => option.id === safe) ? safe : "normal"; }
function hexToRgbParts(value: string, fallback = "#8dffce") { const hex = normalizeHexColor(value, fallback).slice(1); const number = Number.parseInt(hex, 16); return { r:(number>>16)&255, g:(number>>8)&255, b:number&255 }; }
export function hexToRgbString(value: string, fallback = "#8dffce") { const {r,g,b}=hexToRgbParts(value,fallback); return `${r}, ${g}, ${b}`; }

/** Choose the higher WCAG contrast for text on an opaque accent surface. */
export function accentTextColor(value: string): "#000000" | "#ffffff" {
  const { r, g, b } = hexToRgbParts(value);
  const linear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
  return (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? "#000000" : "#ffffff";
}
