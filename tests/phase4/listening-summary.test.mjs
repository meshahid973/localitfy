import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { summarizeRecordedListening } = require("../../electron/db/listening-summary.cjs");
test("history aggregates recorded milliseconds once per event, and excludes invalid or out-of-period events", () => {
  const since=Date.UTC(2026,0,1),day=86400000,now=since+day+60000;
  const event=(id,songId,startedAt,msListened)=>({id,songId,startedAt,msListened});
  const result=summarizeRecordedListening([
    event("a","song",since+1000,2000),event("a","song",since+1000,3000),
    event("b","song",since+day,1000),event("c","other",since+day+2000,500),
    event("old","song",since-1,200),event("future","song",now+1,200),event("bad","song",now-100,500)
  ],since,now,2);
  assert.equal(result.totalMs,4500);
  assert.equal(result.sessions,3);
  assert.deepEqual(result.byDay,[{day:"2026-01-01",ms:3000},{day:"2026-01-02",ms:1500}]);
  assert.deepEqual(result.bySong,[{id:"song",ms:4000},{id:"other",ms:500}]);
});
