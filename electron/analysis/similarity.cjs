const fs = require("node:fs");
const { tryDotMatrix, tryCenterAudioProfiles, tryDecodeNormalizedAudio } = require("../native/compute.cjs");
const { MODEL, ANALYZER_VERSION } = require("./model.cjs");
const { AUDIO_WEIGHT, GENRE_WEIGHT, dot, genreTags, genreTokens, genreSimilarity, libraryMean, centered, classifyPlay,
  listeningStats, skipRate, notForMe } = require("./listening-signals.cjs");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SEED_IDS = 2000;
const MAX_SEEDS = 50;
const RECENT_SEEDS = 25;
const CO_PLAY_DAYS = 180;
const CO_PLAY_HALF_LIFE_DAYS = 60;
const CO_PLAY_GAP_MS = 10 * 60 * 1000;
const CO_PLAY_BOOST = .06;
const SKIP_PENALTY = .15;
// An untagged song is treated as an average genre match, so missing tags neither win nor lose outright.
const UNKNOWN_GENRE = .5;

function identifier(value) { return typeof value === "string" && value.length > 0 && value.length <= 200; }

// One seed song (`songId`), a group of songs (`songIds` + `seedKey`, e.g. a playlist), or recent listening (`recent`).
function validateSimilarityRequest(payload) {
  if (!payload || typeof payload !== "object") throw new TypeError("A song ID is required");
  const limit = payload.limit ?? 30;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new TypeError("Result limit must be between 1 and 50");
  if (payload.recent === true) return { recent: true, seedKey: "recent", limit };
  if (payload.songIds !== undefined) {
    if (!Array.isArray(payload.songIds) || !payload.songIds.length || payload.songIds.length > MAX_SEED_IDS
      || !payload.songIds.every(identifier)) throw new TypeError("Seed songs are required");
    if (!identifier(payload.seedKey)) throw new TypeError("A seed key is required");
    return { songIds: [...new Set(payload.songIds)], seedKey: payload.seedKey, limit };
  }
  if (!identifier(payload.songId)) throw new TypeError("A song ID is required");
  return { songId: payload.songId, limit };
}

function readNormalizedVector(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length !== MODEL.dimensions * 4) return null;
  const vector = new Float64Array(MODEL.dimensions);
  let square = 0;
  for (let i = 0; i < vector.length; i++) {
    const value = buffer.readFloatLE(i * 4);
    if (!Number.isFinite(value)) return null;
    vector[i] = value;
    square += value * value;
  }
  const norm = Math.sqrt(square);
  if (!Number.isFinite(norm) || norm <= 0) return null;
  for (let i = 0; i < vector.length; i++) vector[i] /= norm;
  return vector;
}

function compatible(record) {
  return record.status === "ready" && record.modelId === MODEL.id && record.analyzerVersion === ANALYZER_VERSION
    && record.filePath === record.currentFilePath;
}

async function fileMatches(record, statFile) {
  try {
    const stat = await statFile(record.currentFilePath);
    return stat.isFile() && stat.size === record.fileSize && stat.mtimeMs === record.fileMtime;
  } catch { return false; }
}

// Songs heard back to back (same session, both actually listened to) with a seed. A pair only counts once per
// day and must recur on two or more days, so one album or library run in order does not become a signal.
function coPlayWeights(database, seedIds, now = Date.now()) {
  const rows = database.prepare(`SELECT e.sessionId, e.songId, e.startedAt, e.updatedAt, e.msListened, e.outcome, s.durationMs, s.duration
    FROM play_events e JOIN songs s ON s.id = e.songId WHERE e.startedAt >= ? AND e.outcome <> 'active'
    ORDER BY e.sessionId, e.startedAt`).iterate(now - CO_PLAY_DAYS * DAY_MS);
  const pairs = new Map();
  let previous = null;
  for (const row of rows) {
    const { heard } = classifyPlay(row);
    if (previous && heard && previous.sessionId === row.sessionId && previous.songId !== row.songId
      && row.startedAt - previous.updatedAt <= CO_PLAY_GAP_MS) {
      const day = Math.floor(row.startedAt / DAY_MS);
      for (const [seed, other] of [[previous.songId, row.songId], [row.songId, previous.songId]]) {
        if (!seedIds.has(seed) || seedIds.has(other)) continue;
        const entry = pairs.get(other) || { days: new Map() };
        const weight = Math.pow(.5, Math.max(0, now - row.startedAt) / (CO_PLAY_HALF_LIFE_DAYS * DAY_MS));
        entry.days.set(day, Math.max(entry.days.get(day) || 0, weight));
        pairs.set(other, entry);
      }
    }
    previous = heard ? row : null;
  }
  const weights = new Map();
  for (const [songId, { days }] of pairs) {
    if (days.size < 2) continue;
    weights.set(songId, [...days.values()].reduce((sum, value) => sum + value, 0));
  }
  return weights;
}

function recentSeedIds(database, now = Date.now()) {
  const ids = [];
  const rows = database.prepare(`SELECT e.songId, e.msListened, e.outcome, s.durationMs, s.duration FROM play_events e
    JOIN songs s ON s.id = e.songId WHERE e.startedAt >= ? AND e.outcome <> 'active' ORDER BY e.startedAt DESC`).iterate(now - 30 * DAY_MS);
  for (const row of rows) {
    if (ids.length >= RECENT_SEEDS) break;
    if (classifyPlay(row).heard && !ids.includes(row.songId)) ids.push(row.songId);
  }
  return ids;
}

// Evenly spaced picks keep large playlists bounded without favouring their start.
function sampleSeeds(ids) {
  if (ids.length <= MAX_SEEDS) return ids;
  return Array.from({ length: MAX_SEEDS }, (_, index) => ids[Math.floor(index * ids.length / MAX_SEEDS)]);
}

async function loadSeeds(database, ids, statFile) {
  const query = database.prepare(`SELECT s.id AS songId, s.filePath AS currentFilePath, s.genre, s.artist, a.* FROM songs s
    LEFT JOIN song_analysis a ON a.songId = s.id WHERE s.id = ?`);
  const seeds = []; let missing = 0; let found = 0;
  for (const id of ids) {
    const record = query.get(id);
    if (!record) continue;
    found += 1;
    try { if (!(await statFile(record.currentFilePath)).isFile()) { missing += 1; continue; } } catch { missing += 1; continue; }
    if (!record.modelId || record.status !== "ready" || !compatible(record) || !await fileMatches(record, statFile)) continue;
    const vector = readNormalizedVector(record.vector);
    if (vector) seeds.push({ ...record, vector });
  }
  return { seeds, found, missing };
}

// Invoked in a short-lived worker: vectors and filesystem checks never cross renderer IPC.
async function findSimilarSongs(database, payload, { statFile = fs.promises.stat, now = Date.now() } = {}) {
  const request = validateSimilarityRequest(payload);
  const { limit } = request;
  const result = { seedId: request.songId ?? request.seedKey, status: "ready", matches: [], compared: 0, seedCount: 0 };
  const requested = request.songId ? [request.songId] : request.recent ? recentSeedIds(database, now) : request.songIds;
  if (request.recent && !requested.length) return { ...result, status: "no-history" };
  const hidden = notForMe(database);
  const loaded = await loadSeeds(database, sampleSeeds(requested), statFile);
  const { found, missing } = loaded;
  // Recent listening, a playlist or radio history should not steer toward songs marked "not for me".
  const kept = request.songId ? loaded.seeds : loaded.seeds.filter((seed) => !hidden(seed));
  const seeds = kept.length ? kept : loaded.seeds;
  if (!found) return { ...result, status: "seed-unavailable" };
  if (!seeds.length) {
    if (request.songId) {
      if (missing) return { ...result, status: "seed-missing" };
      const record = database.prepare("SELECT status FROM song_analysis WHERE songId = ?").get(request.songId);
      return { ...result, status: record?.status === "ready" ? "seed-stale" : "seed-unanalyzed" };
    }
    return { ...result, status: "seed-unanalyzed" };
  }
  result.seedCount = seeds.length;
  // Every requested song is excluded from its own results, not just the sampled seeds.
  const excluded = new Set(requested);
  const seedPaths = new Set(seeds.map((seed) => seed.currentFilePath));
  const coPlay = coPlayWeights(database, new Set(seeds.map((seed) => seed.songId)), now);
  const stats = listeningStats(database, now);
  const top = Math.min(3, seeds.length);

  const candidateRecords = database.prepare(`
    SELECT s.filePath AS currentFilePath, s.genre, s.artist, a.* FROM song_analysis a JOIN songs s ON s.id = a.songId
    WHERE a.status = 'ready' AND a.modelId = ? AND a.analyzerVersion = ? AND a.filePath = s.filePath
  `).all(MODEL.id, ANALYZER_VERSION);
  const nativeVectors = tryDecodeNormalizedAudio(candidateRecords.map((record) => record.vector), MODEL.dimensions);
  const candidates = candidateRecords.flatMap((record, index) => {
    const vector = nativeVectors ? nativeVectors[index] : readNormalizedVector(record.vector);
    return vector ? [{ ...record, vector }] : [];
  });
  // Same signals as daily mixes: library-centered sound blended with genre tags.
  const allProfiles = [...candidates, ...seeds];
  const nativeAudio = tryCenterAudioProfiles(allProfiles.map((record) => record.vector));
  const mean = nativeAudio ? null : libraryMean(allProfiles.map((record) => record.vector));
  const centeredByRecord = nativeAudio
    ? new Map(allProfiles.map((record, index) => [record, nativeAudio[index]])) : null;
  const profile = (record) => ({
    audio: centeredByRecord ? centeredByRecord.get(record) : centered(record.vector, mean),
    genre: genreTokens(genreTags(record.genre))
  });
  const seedProfiles = seeds.map(profile);
  const rankBatch = async (batch) => {
    const validFiles = await Promise.all(batch.map((record) => fileMatches(record, statFile)));
    const points = batch.map((record, index) => validFiles[index] ? profile(record) : null);
    const nativeAudio = tryDotMatrix(points.map((point) => point?.audio || seedProfiles[0].audio),
      seedProfiles.map((seed) => seed.audio));
    for (let index = 0; index < batch.length; index++) {
      if (!validFiles[index]) continue;
      const candidate = batch[index];
      result.compared += 1;
      const point = points[index];
      // A group seed scores each candidate by its closest few seeds, so a mixed playlist matches each of its styles.
      let closestSound = -Infinity;
      const scores = seedProfiles.map((seed, seedIndex) => {
        const audio = nativeAudio ? nativeAudio[index * seedProfiles.length + seedIndex] : dot(seed.audio, point.audio);
        const genre = genreSimilarity(seed.genre, point.genre);
        closestSound = Math.max(closestSound, audio);
        return AUDIO_WEIGHT * audio + GENRE_WEIGHT * (genre ?? UNKNOWN_GENRE);
      });
      // Tags alone never make a match: the sound has to resemble at least one seed.
      if (closestSound <= 0) continue;
      scores.sort((a, b) => b - a);
      let score = 0;
      for (let i = 0; i < top; i++) score += scores[i] / top;
      score -= SKIP_PENALTY * skipRate(stats.get(candidate.songId));
      // Unrelated or opposed profiles are not useful suggestions. Scores are not probabilities.
      if (score <= 0) continue;
      const together = coPlay.get(candidate.songId) || 0;
      const match = { songId: candidate.songId, score: Math.min(1, score + Math.min(CO_PLAY_BOOST, .03 * Math.log1p(together))) };
      if (together) match.playedTogether = true;
      result.matches.push(match);
      result.matches.sort((a, b) => b.score - a.score || (a.songId < b.songId ? -1 : a.songId > b.songId ? 1 : 0));
      if (result.matches.length > limit) result.matches.pop();
    }
  };
  let batch = [];
  for (const candidate of candidates) {
    if (excluded.has(candidate.songId) || seedPaths.has(candidate.currentFilePath) || hidden(candidate)) continue;
    batch.push(candidate);
    if (batch.length === 32) { await rankBatch(batch); batch = []; }
  }
  if (batch.length) await rankBatch(batch);
  if (request.songId && !await fileMatches(seeds[0], statFile)) return { ...result, status: "seed-stale", matches: [] };
  return result;
}

module.exports = { validateSimilarityRequest, readNormalizedVector, findSimilarSongs, coPlayWeights, recentSeedIds };
