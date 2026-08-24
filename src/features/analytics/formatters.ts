import type { LocaltifyAnalyticsSnapshot } from "./analyticsSnapshot";

export function localtifyAnalyticsNumber(snapshot: LocaltifyAnalyticsSnapshot, key: string, fallback = 0) {
  const value = Number(snapshot[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function localtifyAnalyticsString(snapshot: LocaltifyAnalyticsSnapshot, key: string, fallback = "") {
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function formatAnalyticsDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${safeSeconds}s`;
}
