import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const {createBootstrapHandler} = createRequire(import.meta.url)("../../electron/runtime/bootstrap.cjs");

test("interactive bootstrap skips diagnostics and genre backfill but preserves library and settings", async () => {
  const calls = [];
  const handler = createBootstrapHandler({
    yieldToMainLoop: async () => calls.push("yield"),
    backfillGenres: async () => calls.push("genres"),
    scheduleCoverWarmup: () => calls.push("warmup"),
    listSongs: () => [{id:"song"}],
    getSettings: () => ({theme:"light"}),
    getPlaylists: () => [],
    getDiagnostics: () => {calls.push("diagnostics"); return {database:{ok:true}};}
  });
  assert.deepEqual(await handler(null, {includeDiagnostics:false}), {songs:[{id:"song"}], settings:{theme:"light"}, playlists:[]});
  assert.deepEqual(calls, ["yield","warmup"]);
  calls.length=0;
  assert.equal((await handler(null,{includeGenres:true})).database.ok,true);
  assert.deepEqual(calls, ["yield","genres","warmup","diagnostics"]);
});
