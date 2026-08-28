import { performance } from "node:perf_hooks";
import process from "node:process";

const CHECK = process.argv.includes("--check");
const SONG_COUNT = 50_000;
const IMPORT_COUNT = 20_000;
const COVER_COUNT = 18_000;

function timed(name, fn) {
  const started = performance.now();
  const value = fn();
  const ms = performance.now() - started;
  return { name, ms, value };
}

function makeSong(index) {
  const artist = `artist ${index % 1300}`;
  const album = `album ${index % 4200}`;
  return {
    id: `song-${index}`,
    title: `track ${index} ${index % 17 === 0 ? "midnight" : "local"}`,
    artist,
    album,
    filePath: `/library/${index % 250}/${artist}/${album}/track-${index}.flac`,
    duration: 120 + (index % 280),
    playCount: index % 91,
    dateAdded: 1_700_000_000_000 + index * 1000,
    coverPath: `/covers/${index % COVER_COUNT}.png`
  };
}

const heapBefore = process.memoryUsage().heapUsed;
const songs = Array.from({ length: SONG_COUNT }, (_, index) => makeSong(index));
const results = [];

results.push(timed("startup_shape_50k", () => songs.map((song) => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  album: song.album,
  duration: song.duration,
  coverPath: song.coverPath
}))));

let songById;
let pathSet;
results.push(timed("library_index_50k", () => {
  songById = new Map();
  pathSet = new Set();
  for (const song of songs) {
    songById.set(song.id, song);
    pathSet.add(song.filePath.toLowerCase());
  }
  return songById.size;
}));

results.push(timed("search_50k", () => {
  const terms = ["midnight", "artist 42", "album 900"];
  let matches = 0;
  for (const song of songs) {
    const haystack = `${song.title} ${song.artist} ${song.album}`.toLowerCase();
    if (terms.some((term) => haystack.includes(term))) matches += 1;
  }
  return matches;
}));

results.push(timed("import_dedupe_20k", () => {
  let newFiles = 0;
  for (let index = 0; index < IMPORT_COUNT; index += 1) {
    const existing = index % 3 === 0;
    const candidate = existing
      ? songs[index].filePath
      : `/incoming/new-${index}.flac`;
    if (!pathSet.has(candidate.toLowerCase())) newFiles += 1;
  }
  return newFiles;
}));

results.push(timed("scan_sort_50k", () => songs
  .map((song, index) => ({ path: song.filePath, mtimeMs: song.dateAdded + (index % 37) }))
  .sort((left, right) => right.mtimeMs - left.mtimeMs)
  .slice(0, 1000)));

results.push(timed("thumbnail_cache_50k", () => {
  const cache = new Map();
  for (const song of songs) {
    const key = `${song.coverPath}|${song.dateAdded % 1000}|256`;
    if (!cache.has(key)) cache.set(key, `thumb-${cache.size}.png`);
  }
  return cache.size;
}));

results.push(timed("background_policy_100k", () => {
  let maintenanceRuns = 0;
  let lastMaintenance = 0;
  for (let tick = 0; tick < 100_000; tick += 1) {
    const now = tick * 250;
    if (now - lastMaintenance >= 15_000) {
      maintenanceRuns += 1;
      lastMaintenance = now;
      songById.get(`song-${tick % SONG_COUNT}`);
    }
  }
  return maintenanceRuns;
}));

const heapAfter = process.memoryUsage().heapUsed;
const heapDeltaMiB = Math.max(0, heapAfter - heapBefore) / (1024 * 1024);
const totalMs = results.reduce((sum, result) => sum + result.ms, 0);

const limits = {
  startup_shape_50k: 1200,
  library_index_50k: 1500,
  search_50k: 2000,
  import_dedupe_20k: 1000,
  scan_sort_50k: 1800,
  thumbnail_cache_50k: 1500,
  background_policy_100k: 800
};

console.log(`[runtime-benchmark] synthetic library: ${SONG_COUNT.toLocaleString()} songs`);
for (const result of results) {
  const limit = limits[result.name];
  console.log(`[runtime-benchmark] ${result.name}: ${result.ms.toFixed(1)} ms${limit ? ` / ${limit} ms` : ""}`);
}
console.log(`[runtime-benchmark] measured total: ${totalMs.toFixed(1)} ms / 8000 ms`);
console.log(`[runtime-benchmark] heap delta: ${heapDeltaMiB.toFixed(1)} MiB / 512 MiB`);

if (CHECK) {
  const failures = results
    .filter((result) => result.ms > limits[result.name])
    .map((result) => `${result.name}: ${result.ms.toFixed(1)} ms > ${limits[result.name]} ms`);
  if (totalMs > 8000) failures.push(`total: ${totalMs.toFixed(1)} ms > 8000 ms`);
  if (heapDeltaMiB > 512) failures.push(`heap delta: ${heapDeltaMiB.toFixed(1)} MiB > 512 MiB`);

  if (failures.length) {
    console.error("[runtime-benchmark] failures:\n- " + failures.join("\n- "));
    process.exit(1);
  }
}

console.log("[runtime-benchmark] passed");
