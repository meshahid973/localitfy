export type ListeningSummary = {
  generatedAt: number;
  days: number;
  startAt?: number;
  comparison?: { startAt: number; endAt: number; totalMs: number; sessions: number; changePercent: number | null; byDay: Array<{ day: string; ms: number }> };
  totalMs: number;
  sessions: number;
  byDay: Array<{ day: string; ms: number }>;
  bySong: Array<{ id: string; ms: number }>;
};

const nonnegativeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Reject malformed remote or cached snapshots instead of displaying incorrect totals. */
export function isListeningSummary(value: unknown, expectedDays?: number): value is ListeningSummary {
  if (!object(value) || !nonnegativeInteger(value.generatedAt) || value.generatedAt > 8640000000000000 || ![7, 30, 90].includes(Number(value.days)) ||
      typeof value.days !== "number" || expectedDays !== undefined && value.days !== expectedDays) return false;
  const days = value.days;
  const currentStart = Math.floor(value.generatedAt / 86400000) * 86400000 - (days - 1) * 86400000;
  const validPeriod = (period: Record<string, unknown>, start: number) => {
    if (!nonnegativeInteger(period.totalMs) || !nonnegativeInteger(period.sessions) ||
        Boolean(period.totalMs) !== Boolean(period.sessions) || period.sessions > period.totalMs || !Array.isArray(period.byDay) || period.byDay.length !== days) return false;
    let total = 0;
    for (let index = 0; index < days; index++) {
      const day = period.byDay[index];
      if (!object(day) || !nonnegativeInteger(day.ms) || day.day !== new Date(start + index * 86400000).toISOString().slice(0, 10)) return false;
      total += day.ms;
    }
    return total === period.totalMs;
  };
  if (!validPeriod(value, currentStart) || !Array.isArray(value.bySong)) return false;
  let total = 0;
  const ids = new Set<string>();
  for (const song of value.bySong) {
    if (!object(song) || typeof song.id !== "string" || !song.id || ids.has(song.id) || !nonnegativeInteger(song.ms) || song.ms === 0) return false;
    ids.add(song.id);
    total += song.ms;
  }
  if (total !== value.totalMs) return false;
  if (value.comparison !== undefined) {
    const previous = value.comparison;
    const start = currentStart - days * 86400000;
    if (!object(previous) || !validPeriod(previous, start) || previous.startAt !== start || previous.endAt !== currentStart) return false;
    const expected = Number(previous.totalMs) > 0 ? (Number(value.totalMs) - Number(previous.totalMs)) / Number(previous.totalMs) * 100 : null;
    if (expected === null ? previous.changePercent !== null : typeof previous.changePercent !== "number" || !Number.isFinite(previous.changePercent) || Math.abs(previous.changePercent - expected) > 0.000001) return false;
  }
  return true;
}
