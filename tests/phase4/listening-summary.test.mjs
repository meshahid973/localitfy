import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import fs from "node:fs";
import ts from "typescript";
const require = createRequire(import.meta.url);
const { getRecordedListeningSummary, getRecordedListeningCalendarSummary } = require("../../electron/db/listening-summary.cjs");
const { createPlayEventsTable } = require("../../electron/db/play-events.cjs");
const compiled = ts.transpileModule(fs.readFileSync("src/features/analytics/listeningSummary.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { isListeningSummary, isListeningCalendarSummary } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE songs (id TEXT PRIMARY KEY); INSERT INTO songs VALUES ('song'), ('other');");
  createPlayEventsTable(database);
  const insert = database.prepare(`INSERT INTO play_events (id, sessionId, songId, startedAt, updatedAt, msListened)
    VALUES (?, 'session', ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET msListened = MAX(msListened, excluded.msListened)`);
  return { database, event: (id, song, start, ms, updated = start + ms) => insert.run(id, song, start, updated, ms) };
}

test("SQLite aggregates actual recorded milliseconds once per event with zero-filled UTC days", () => {
  const { database, event } = fixture();
  try {
    const since = Date.UTC(2026, 0, 1), day = 86400000, now = since + 6 * day + 60000;
    event("a", "song", since + 1000, 2000);
    event("a", "song", since + 1000, 3000);
    event("b", "song", since + 6 * day, 1000);
    event("c", "other", since + 6 * day + 2000, 500);
    event("old", "song", since - 1000, 200);
    event("future", "song", now + 1, 200);
    event("bad", "song", now - 100, 500);
    const result = getRecordedListeningSummary(database, { days: 7, now });
    assert.equal(result.totalMs, 4500);
    assert.equal(result.sessions, 3);
    assert.equal(result.byDay.length, 7);
    assert.deepEqual(result.byDay.map(entry => entry.ms), [3000, 0, 0, 0, 0, 0, 1500]);
    assert.deepEqual(result.bySong.sort((a,b) => a.id.localeCompare(b.id)), [{id:"other",ms:500}, {id:"song",ms:4000}]);
    assert.equal(result.comparison.totalMs, 200);
    assert.equal(result.comparison.sessions, 1);
    assert.equal(result.comparison.endAt, since);
    assert.equal(result.comparison.changePercent, 2150);
    assert.equal(isListeningSummary(result, 7), true);
    assert.equal(database.prepare("EXPLAIN QUERY PLAN SELECT * FROM play_events WHERE startedAt >= ?").all(since).some(row => row.detail.includes("idx_play_events_time")), true);
  } finally { database.close(); }
});

test("remote and cached listening snapshots cannot claim inconsistent dates, totals or baselines", () => {
  const { database } = fixture();
  try {
    const snapshot = getRecordedListeningSummary(database, { days: 7, now: Date.UTC(2026, 0, 7, 1) });
    assert.equal(isListeningSummary(snapshot, 7), true);
    const legacy = structuredClone(snapshot);
    delete legacy.comparison;
    delete legacy.startAt;
    assert.equal(isListeningSummary(legacy, 7), true, "older valid computer snapshots remain readable offline");
    assert.equal(isListeningSummary(snapshot, 30), false);
    assert.equal(isListeningSummary({ ...snapshot, generatedAt: Number.MAX_SAFE_INTEGER }), false);
    assert.equal(isListeningSummary({ ...snapshot, bySong: undefined }), false);
    assert.equal(isListeningSummary({ ...snapshot, totalMs: 1000 }), false);
    assert.equal(isListeningSummary({ ...snapshot, sessions: 1 }), false);
    const duplicates = structuredClone(snapshot);
    duplicates.byDay[1].day = duplicates.byDay[0].day;
    assert.equal(isListeningSummary(duplicates), false);
    const fabricated = structuredClone(snapshot);
    fabricated.comparison.changePercent = 100;
    assert.equal(isListeningSummary(fabricated), false);
  } finally { database.close(); }
});

test("empty periods and cleared history contain no invented baseline or percentages", () => {
  const { database, event } = fixture();
  try {
    const now = Date.UTC(2026, 0, 7, 1);
    let result = getRecordedListeningSummary(database, { days: 30, now });
    assert.equal(result.totalMs, 0);
    assert.equal(result.comparison.changePercent, null);
    event("actual", "song", now - 10000, 1000);
    result = getRecordedListeningSummary(database, { days: 30, now });
    assert.equal(result.totalMs, 1000);
    assert.equal(result.comparison.totalMs, 0);
    assert.equal(result.comparison.changePercent, null);
    database.exec("DELETE FROM play_events");
    assert.equal(getRecordedListeningSummary(database, { days: 90, now }).totalMs, 0);
    assert.throws(() => getRecordedListeningSummary(database, { days: 365, now }), /Invalid listening period/);
  } finally { database.close(); }
});


test("Calendar month and year are real UTC ranges, exclude future events and include exact previous periods",()=>{
  const {database,event}=fixture();
  try {
    const now=Date.UTC(2026,2,1,0,0,20);
    event("feb1","song",Date.UTC(2026,1,1,12),1000);
    event("feb2","song",Date.UTC(2026,1,28,23,59),2000);
    event("mar1","other",Date.UTC(2026,2,1,0,0,1),3000);
    event("late","song",now+10,1000);
    const month=getRecordedListeningCalendarSummary(database,{range:"month",offset:0,now});
    assert.equal(month.startAt,Date.UTC(2026,2,1));
    assert.equal(month.comparison.startAt,Date.UTC(2026,1,1));
    assert.equal(month.comparison.totalMs,3000);
    assert.equal(month.comparison.comparableTotalMs,0,"March 1st compared to February 1st so far, not the full February");
    assert.equal(month.comparison.changePercent,null);
    assert.equal(month.totalMs,3000);
    assert.equal(month.sessions,1);
    assert.equal(month.activeDays,1);
    assert.equal(month.byBucket.length,31);
    assert.deepEqual(month.bySong,[{id:"other",ms:3000}]);
    assert.equal(isListeningCalendarSummary(month,{range:"month",offset:0}),true);
    const feb=getRecordedListeningCalendarSummary(database,{range:"month",offset:1,now});
    assert.equal(feb.totalMs,3000);
    assert.equal(feb.byBucket.length,28);
    assert.equal(feb.comparison.byBucket.length,31,"previous January must remain complete when February has fewer days");
    assert.equal(feb.comparison.totalMs,0);
    assert.equal(feb.comparison.comparableTotalMs,0,"completed historical month uses complete previous baseline");
    assert.equal(feb.partial,false);
    assert.equal(isListeningCalendarSummary(feb,{range:"month",offset:1}),true);
    const year=getRecordedListeningCalendarSummary(database,{range:"year",offset:0,now});
    assert.equal(year.byBucket.length,12);
    assert.deepEqual(year.byBucket.slice(0,3),[{id:"2026-01",ms:0},{id:"2026-02",ms:3000},{id:"2026-03",ms:3000}]);
    assert.equal(year.totalMs,6000);
    assert.equal(isListeningCalendarSummary(year,{range:"year",offset:0}),true);
  }finally{database.close();}
});

test("Calendar ISO week, leap February and tampered cached snapshot remain accurate",()=>{
  const {database,event}=fixture();
  try {
    const now=Date.UTC(2024,1,29,19);
    event("leap","song",Date.UTC(2024,1,29,3),900);
    event("prior","song",Date.UTC(2024,1,25,3),100);
    const feb=getRecordedListeningCalendarSummary(database,{range:"month",offset:0,now});
    assert.equal(feb.byBucket.length,29);
    assert.equal(feb.totalMs,1000);
    const week=getRecordedListeningCalendarSummary(database,{range:"week",offset:0,now});
    assert.equal(week.startAt,Date.UTC(2024,1,26));
    assert.equal(week.byBucket.length,7);
    assert.equal(week.totalMs,900);
    assert.equal(week.comparison.totalMs,100);
    assert.equal(isListeningCalendarSummary(week,{range:"week",offset:0}),true);
    assert.equal(isListeningCalendarSummary({...week,totalMs:10000}),false);
    assert.equal(isListeningCalendarSummary({...week,activeDays:400}),false);
    assert.equal(isListeningCalendarSummary({...week,bySong:[...week.bySong,...week.bySong]}),false);
    assert.equal(isListeningCalendarSummary({...week,comparison:{...week.comparison,changePercent:999}}),false);
    assert.throws(()=>getRecordedListeningCalendarSummary(database,{range:"decade",now}),/Invalid listening calendar range/);
    assert.throws(()=>getRecordedListeningCalendarSummary(database,{range:"year",offset:121,now}),/Invalid listening calendar range/);
  }finally{database.close();}
});


test("In-progress calendar period compares to equivalent elapsed UTC time, not the full prior month",()=>{
  const {database,event}=fixture();
  try {
    const now=Date.UTC(2026,2,15,12,0,0);
    event("prior-before","song",Date.UTC(2026,1,3,11),3000);
    event("prior-after","song",Date.UTC(2026,1,25,11),8000);
    event("current","song",Date.UTC(2026,2,3,11),6000);
    const nowMonth=getRecordedListeningCalendarSummary(database,{range:"month",now});
    assert.equal(nowMonth.totalMs,6000);
    assert.equal(nowMonth.comparison.totalMs,11000,"the chart retains the complete previous February");
    assert.equal(nowMonth.comparison.comparableTotalMs,3000,"the current-to-date comparison excludes later February records");
    assert.equal(nowMonth.comparison.changePercent,100);
    assert.equal(isListeningCalendarSummary(nowMonth,{range:"month",offset:0}),true);
    const corrupted=structuredClone(nowMonth);
    corrupted.comparison.comparableTotalMs=12000;
    assert.equal(isListeningCalendarSummary(corrupted),false);
    const feb=getRecordedListeningCalendarSummary(database,{range:"month",offset:1,now});
    assert.equal(feb.comparison.comparableTotalMs,feb.comparison.totalMs,"completed periods compare complete periods");
    assert.equal(isListeningCalendarSummary(feb),true);
  } finally {database.close();}
});
