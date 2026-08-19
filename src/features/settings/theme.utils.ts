import type { CoverColorSyncMode, ThemeId } from "./theme.types";
import { coverColorSyncOptions } from "./settings.constants";
import { RETIRED_ANIMATED_THEME_IDS, THEME_ID_SET } from "./theme.constants";
export function isRetiredAnimatedThemeId(value: unknown) { return RETIRED_ANIMATED_THEME_IDS.has(String(value || "")); }
export function isThemeId(value: string): value is ThemeId { return THEME_ID_SET.has(value); }
export function normalizeThemeId(value: unknown, fallback: ThemeId = "mint"): ThemeId { const raw = String(value || "").trim(); if (isRetiredAnimatedThemeId(raw)) return "stars"; if (raw === "oled") return "mint"; return isThemeId(raw) ? raw : fallback; }
export function normalizeHexColor(value: string, fallback = "#8dffce") { const raw = String(value || "").trim(); const withHash = raw.startsWith("#") ? raw : `#${raw}`; const short = /^#([0-9a-f]{3})$/i.exec(withHash); if (short) return `#${short[1].split("").map((part) => `${part}${part}`).join("")}`.toLowerCase(); return /^#[0-9a-f]{6}$/i.test(withHash) ? withHash.toLowerCase() : fallback; }
export function normalizeHexInputDraft(value: string) { const raw = String(value || "").trim().replace(/[^0-9a-f#]/gi, ""); return `#${raw.replace(/#/g, "").slice(0, 6)}`; }
export function isCompleteHexColorInput(value: string) { return /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim()); }
export function normalizeCoverColorSyncMode(value: unknown): CoverColorSyncMode { const safe = String(value || "normal").trim() as CoverColorSyncMode; return coverColorSyncOptions.some((option) => option.id === safe) ? safe : "normal"; }
export function hexToRgbParts(value: string, fallback = "#8dffce") { const hex = normalizeHexColor(value, fallback).slice(1); const number = Number.parseInt(hex, 16); return { r:(number>>16)&255, g:(number>>8)&255, b:number&255 }; }
export function hexToRgbString(value: string, fallback = "#8dffce") { const {r,g,b}=hexToRgbParts(value,fallback); return `${r}, ${g}, ${b}`; }
export function hexToRgbaString(value: string, fallback = "#8dffce", alpha = 1) { return `rgba(${hexToRgbString(value, fallback)}, ${alpha})`; }
