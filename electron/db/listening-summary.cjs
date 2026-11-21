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


const DAY_MS = 86400000;
/** Real UTC calendar windows. Dates belong to the start of each recorded playback event. */
function calendarBounds(range, offset, now) {
  if (!["week","month","year"].includes(range) || !Number.isSafeInteger(offset) || offset < 0 || offset > 120 || !Number.isSafeInteger(now) || now < 0) {
    throw new Error("Invalid listening calendar range");
  }
  const today = new Date(now);
  const year = today.getUTCFullYear(), month = today.getUTCMonth();
  if (range === "year") {
    const y = year - offset;
    return [Date.UTC(y,0,1), Date.UTC(y+1,0,1), Date.UTC(y-1,0,1)];
  }
  if (range === "month") {
    return [Date.UTC(year,month-offset,1), Date.UTC(year,month-offset+1,1), Date.UTC(year,month-offset-1,1)];
  }
  const todayUtc = Date.UTC(year,month,today.getUTCDate());
  const thisMonday = todayUtc - ((today.getUTCDay()+6)%7) * DAY_MS;
  const start = thisMonday - offset*7*DAY_MS;
  return [start,start+7*DAY_MS,start-7*DAY_MS];
}
function calendarBucketKeys(start, end, range) {
  const keys = [];
  if (range === "year") {
    for (let t=start;t<end;t=Date.UTC(new Date(t).getUTCFullYear(),new Date(t).getUTCMonth()+1,1)) keys.push(new Date(t).toISOString().slice(0,7));
  } else {
    for (let t=start;t<end;t+=DAY_MS) keys.push(new Date(t).toISOString().slice(0,10));
  }
  return keys;
}
function getRecordedListeningCalendarSummary(database, {range="month",offset=0,now=Date.now()}={}) {
  const [startAt,endAt,previousStartAt] = calendarBounds(range,offset,now);
  const previousEndAt=startAt;
  const partial=now>=startAt && now<endAt;
  // For an in-progress period compare only the equivalent elapsed time of the preceding calendar period.
  const comparisonEnd=partial?Math.min(previousEndAt,previousStartAt+(now-startAt)+1):previousEndAt;
  let comparableTotalMs=0;
  const makePeriod=(start,end)=>({
    startAt:start,endAt:end,totalMs:0,sessions:0,activeDays:0,
    byBucket:new Map(calendarBucketKeys(start,end,range).map(key=>[key,0])),
    days:new Set()
  });
  const current=makePeriod(startAt,endAt), previous=makePeriod(previousStartAt,previousEndAt);
  const bySong=new Map();
  const rows=database.prepare(
    "SELECT startedAt, songId, SUM(msListened) AS ms, COUNT(*) AS sessions, " +
    "SUM(CASE WHEN startedAt < @comparisonEnd THEN msListened ELSE 0 END) AS comparableMs " +
    "FROM play_events WHERE startedAt >= @since AND startedAt < @endAt AND startedAt <= @now " +
    "AND updatedAt <= @now AND typeof(startedAt) = 'integer' AND typeof(msListened) = 'integer' " +
    "AND msListened > 0 AND msListened <= @now - startedAt " +
    "GROUP BY strftime('%Y-%m-%d', startedAt / 1000, 'unixepoch'), songId"
  ).all({since:previousStartAt,endAt,now,comparisonEnd});
  for(const row of rows){
    const period=row.startedAt>=startAt?current:previous;
    const day=new Date(row.startedAt).toISOString().slice(0,10);
    const key=range==="year"?day.slice(0,7):day;
    if(!period.byBucket.has(key))continue;
    period.totalMs+=row.ms;period.sessions+=row.sessions;period.days.add(day);
    period.byBucket.set(key,period.byBucket.get(key)+row.ms);
    if(period===current)bySong.set(row.songId,(bySong.get(row.songId)||0)+row.ms);
    else comparableTotalMs+=row.comparableMs;
  }
  const serialize=p=>({startAt:p.startAt,endAt:p.endAt,totalMs:p.totalMs,sessions:p.sessions,activeDays:p.days.size,
    byBucket:[...p.byBucket].map(([id,ms])=>({id,ms}))});
  return {
    range,offset,generatedAt:now,partial,
    ...serialize(current),
    bySong:[...bySong].map(([id,ms])=>({id,ms})).sort((a,b)=>b.ms-a.ms||a.id.localeCompare(b.id)),
    comparison:{...serialize(previous),comparableTotalMs,
      changePercent:comparableTotalMs>0?(current.totalMs-comparableTotalMs)/comparableTotalMs*100:null}
  };
}

module.exports = { getRecordedListeningSummary, getRecordedListeningCalendarSummary };

