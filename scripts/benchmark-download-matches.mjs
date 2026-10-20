import assert from "node:assert/strict";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/features/downloads/useDownloadsRuntime.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const exports = {};
runInNewContext(compiled, {
  exports, require: (name) => {
    if (name === "react") return {};
    throw new Error("Unexpected dependency: " + name);
  }
});

const librarySongs = Array.from({ length: 12000 }, (_, i) => ({
  id: String(i), filePath: "/music/" + i + ".flac", sourceTrackId: "spotify-" + i
}));
const results = Array.from({ length: 500 }, (_, i) => ({
  ok: true,
  spotifyTrackId: "spotify-" + ((i * 17) % librarySongs.length),
  filePath: "/music/" + ((i * 17) % librarySongs.length) + ".flac"
}));

function oldBatch() {
  return results.map((result) => {
    const spotifyId = String(result.spotifyTrackId || "").trim();
    const song = librarySongs.find((item) => String(item.sourceTrackId || "").trim() === spotifyId);
    return song?.id || "";
  });
}
function newBatch() {
  return Array.from(exports.enrichDownloadResultsWithLibraryMatches(results, librarySongs), (result) =>
    result.librarySongId || "");
}
assert.deepEqual(newBatch(), oldBatch());

function median(fn, runs = 5) {
  const measures = [];
  fn();
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    fn();
    measures.push(performance.now() - start);
  }
  measures.sort((a, b) => a - b);
  return measures[Math.floor(measures.length / 2)];
}
const before = median(oldBatch);
const after = median(newBatch);
console.log("[download-matches] 500 results against 12k tracks (ms): old " +
  before.toFixed(2) + " / indexed " + after.toFixed(2));
console.log("[download-matches] identical match IDs; runner timings are not UI latency");
