"use strict";

const DAY = 86400000;

/** Recorded time is attributed to the UTC day each event began, never estimated from track lengths. */
function getRecordedListeningSummary(database, { days = 30, now = Date.now() } = {}) {
  if (![7, 30, 90].includes(days) || !Number.isSafeInteger(now) || now < 0) throw new Error("Invalid listening period");
  const since = Math.floor(now / DAY) * DAY - (days - 1) * DAY;
  const previousSince = since - days * DAY;
  const rows = database.prepare(`
    SELECT CASE WHEN startedAt >= @since THEN 1 ELSE 0 END AS currentPeriod,
           strftime('%Y-%m-%d', startedAt / 1000, 'unixepoch') AS day,
           CASE WHEN startedAt >= @since THEN songId ELSE '' END AS songKey,
           SUM(msListened) AS ms, COUNT(*) AS sessions
    FROM play_events
    WHERE startedAt >= @previousSince AND startedAt <= @now AND updatedAt <= @now
      AND typeof(startedAt) = 'integer' AND typeof(msListened) = 'integer'
      AND msListened > 0 AND msListened <= @now - startedAt
    GROUP BY currentPeriod, day, songKey
  `).all({ since, previousSince, now });
  const makePeriod = start => ({
    startAt: start, totalMs: 0, sessions: 0,
    byDay: new Map(Array.from({ length: days }, (_, index) => [new Date(start + index * DAY).toISOString().slice(0, 10), 0]))
  });
  const current = makePeriod(since), previous = makePeriod(previousSince);
  const bySong = new Map();
  for (const row of rows) {
    const period = row.currentPeriod ? current : previous;
    if (!period.byDay.has(row.day)) continue;
    period.totalMs += row.ms;
    period.sessions += row.sessions;
    period.byDay.set(row.day, period.byDay.get(row.day) + row.ms);
    if (row.currentPeriod) bySong.set(row.songKey, (bySong.get(row.songKey) || 0) + row.ms);
  }
  const serialize = period => ({
    startAt: period.startAt, totalMs: period.totalMs, sessions: period.sessions,
    byDay: [...period.byDay].map(([day, ms]) => ({ day, ms }))
  });
  return {
    generatedAt: now, days, ...serialize(current), bySong: [...bySong].map(([id, ms]) => ({ id, ms })),
    comparison: { ...serialize(previous), endAt: since,
      changePercent: previous.totalMs > 0 ? (current.totalMs - previous.totalMs) / previous.totalMs * 100 : null }
  };
}

module.exports = { getRecordedListeningSummary };
