/** Assign recorded milliseconds to the UTC day the event began; no seek or track-length estimates. */
function summarizeRecordedListening(events, since, now, days) {
  const byDay = new Map();
  for (let i = 0; i < days; i++) byDay.set(new Date(since + i * 86400000).toISOString().slice(0, 10), 0);
  const byId = new Map();
  for (const event of events) {
    if (!event.id || !event.songId || !Number.isFinite(event.startedAt) || event.startedAt < since || event.startedAt > now || !Number.isSafeInteger(event.msListened) || event.msListened <= 0 || event.msListened > now - event.startedAt) continue;
    const old = byId.get(event.id);
    if (!old || old.msListened < event.msListened) byId.set(event.id, event);
  }
  const bySong = new Map();
  let totalMs = 0;
  for (const event of byId.values()) {
    const day = new Date(event.startedAt).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + event.msListened);
    bySong.set(event.songId, (bySong.get(event.songId) || 0) + event.msListened);
    totalMs += event.msListened;
  }
  return { generatedAt: now, days, totalMs, sessions: byId.size, byDay: [...byDay].map(([day, ms]) => ({ day, ms })), bySong: [...bySong].map(([id, ms]) => ({ id, ms })) };
}
module.exports = { summarizeRecordedListening };
