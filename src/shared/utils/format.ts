export function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
export function collapseSpaces(value: unknown) { return String(value || "").replace(/\s+/g, " ").trim(); }
export function normalizeUiText(text: string) { return String(text || "").normalize("NFKC").replace(/[\u0300-\u036f]/g, "").replace(/[\u200B-\u200D\uFEFF\u2060\u034F]/g, "").replace(/\p{Cf}/gu, ""); }
export function lower(text: string) { return normalizeUiText(text).toLowerCase(); }
export function formatTime(seconds: number) { if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"; const mins = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60).toString().padStart(2, "0"); return `${mins}:${secs}`; }
export function getGreeting(hour: number) { if (hour < 5) return "good night"; if (hour < 12) return "good morning"; if (hour < 17) return "good afternoon"; if (hour < 22) return "good evening"; return "late night vibes"; }
export function safeNumber(value: unknown, fallback = 0) { const next = Number(value); return Number.isFinite(next) && next >= 0 ? next : fallback; }
export function toCssUrl(value?: string | null): string { return value ? `url(${JSON.stringify(value)})` : "none"; }
