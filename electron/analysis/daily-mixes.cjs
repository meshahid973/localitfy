const fs = require("node:fs");
const { tryDotMatrix, tryClusterFromCenters, tryDecodeNormalizedAudio } = require("../native/compute.cjs");
const { createHash } = require("node:crypto");
const { MODEL, ANALYZER_VERSION } = require("./model.cjs");
const { readNormalizedVector } = require("./similarity.cjs");
const { AUDIO_WEIGHT, GENRE_WEIGHT, dot, normalize, genreTags, genreTokens, libraryMean, centered, listeningStats, notForMe } = require("./listening-signals.cjs");
const GENERATOR_VERSION = 2;
const MIX_LENGTH = 25;
function validateDailyMixRequest(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || (payload.refresh !== undefined && typeof payload.refresh !== "boolean")) throw new TypeError("Invalid mix request");
  return { refresh: payload.refresh === true };
}
function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function noise(seed, id) { return createHash("sha256").update(`${seed}:${id}`).digest().readUInt32LE(0) / 0xffffffff; }
function artist(track) { return String(track.artist || "").trim().toLowerCase(); }

// Audio profiles share a narrow cone, so center them on the library mean before clustering,
// then append genre tags. A feature dot product is AUDIO_WEIGHT * audio cosine + GENRE_WEIGHT * genre cosine.
function buildFeatures(tracks) {
  const dimensions = tracks[0].vector.length;
  const vectors = tracks.map((track) => track.vector);
  const mean = libraryMean(vectors);
  const tokens = tracks.map((track) => genreTokens(track.tags));
  const vocabulary = new Map([...new Set(tokens.flatMap((map) => [...map.keys()]))].sort().map((token, index) => [token, index]));
  const audioScale = Math.sqrt(AUDIO_WEIGHT); const genreScale = Math.sqrt(GENRE_WEIGHT);
  return tracks.map((track, index) => {
    const audio = centered(track.vector, mean);
    const genre = new Float64Array(vocabulary.size);
    for (const [token, weight] of tokens[index]) genre[vocabulary.get(token)] = weight;
    normalize(genre);
    const feature = new Float64Array(dimensions + vocabulary.size);
    for (let i = 0; i < dimensions; i++) feature[i] = audio[i] * audioScale;
    for (let i = 0; i < genre.length; i++) feature[dimensions + i] = genre[i] * genreScale;
    return { audio, feature };
  });
}

// k-means++ seeding (deterministic per seed). Stops early when every track already sits on a center.
function seedCenters(points, count, seed) {
  const first = points.reduce((best, point) => noise(seed, point.songId) > noise(seed, best.songId) ? point : best);
  const centers = [first.feature];
  const distance = points.map((point) => Math.max(0, dot(point.feature, point.feature) + dot(first.feature, first.feature) - 2 * dot(point.feature, first.feature)));
  while (centers.length < count) {
    const total = distance.reduce((sum, value) => sum + value, 0);
    if (total <= 1e-9) break;
    let target = noise(seed, `center-${centers.length}`) * total; let chosen = points.length - 1;
    for (let i = 0; i < points.length; i++) { target -= distance[i]; if (target <= 0 && distance[i] > 0) { chosen = i; break; } }
    const center = points[chosen].feature; centers.push(center);
    const centerNorm = dot(center, center);
    for (let i = 0; i < points.length; i++) {
      const next = Math.max(0, dot(points[i].feature, points[i].feature) + centerNorm - 2 * dot(points[i].feature, center));
      if (next < distance[i]) distance[i] = next;
    }
  }
  return centers.map((center) => normalize(Float64Array.from(center)));
}

// Lloyd iterations with a minimum group size: a group short of `minimum` takes the tracks that lose the
// least by moving, so one outlier can never become its own mix and every mix has enough candidates.
function cluster(points, count, minimum, seed) {
  const centers = seedCenters(points, count, seed);
  const nativeCluster = tryClusterFromCenters(points.map((point) => point.feature), centers, minimum);
  if (nativeCluster) return nativeCluster;
  let assignment = new Int32Array(points.length).fill(-1); let similarity = [];
  for (let pass = 0; pass < 12; pass++) {
    // Small clusters are faster in JavaScript than packing and crossing NAPI.
    // Let larger libraries amortize the native vector-matrix allocation.
    const nativeWork = points.length * centers.length * (points[0]?.feature.length || 0);
    const nativeScores = nativeWork >= 1_000_000
      ? tryDotMatrix(points.map((point) => point.feature), centers) : null;
    similarity = points.map((point, index) => centers.map((center, centerIndex) =>
      nativeScores ? nativeScores[index * centers.length + centerIndex] : dot(point.feature, center)));
    const next = new Int32Array(points.length); const sizes = new Array(centers.length).fill(0);
    for (let i = 0; i < points.length; i++) {
      let best = 0;
      for (let c = 1; c < centers.length; c++) if (similarity[i][c] > similarity[i][best]) best = c;
      next[i] = best; sizes[best] += 1;
    }
    for (let c = 0; c < centers.length; c++) {
      if (sizes[c] >= minimum) continue;
      const movable = [];
      for (let i = 0; i < points.length; i++) if (next[i] !== c) movable.push([similarity[i][next[i]] - similarity[i][c], i]);
      movable.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (const [, i] of movable) {
        if (sizes[c] >= minimum) break;
        if (sizes[next[i]] <= minimum) continue;
        sizes[next[i]] -= 1; next[i] = c; sizes[c] += 1;
      }
    }
    const changed = next.some((value, i) => value !== assignment[i]);
    assignment = next;
    if (!changed) break;
    for (let c = 0; c < centers.length; c++) {
      const mean = new Float64Array(centers[c].length); let members = 0;
      for (let i = 0; i < points.length; i++) if (assignment[i] === c) { members += 1; for (let j = 0; j < mean.length; j++) mean[j] += points[i].feature[j]; }
      if (members && dot(mean, mean) > 1e-12) centers[c] = normalize(mean);
    }
  }
  let cohesion = 0;
  for (let i = 0; i < points.length; i++) cohesion += similarity[i][assignment[i]];
  return { centers, assignment, cohesion };
}

function groupPlan(total) {
  const minimum = Math.min(40, Math.max(5, Math.floor(total / 3)));
  const maximum = total >= 1000 ? 5 : total >= 500 ? 4 : 3;
  // Leave slack above the minimum so groups can follow the library's shape instead of being forced to blend.
  return { minimum, count: Math.max(1, Math.min(maximum, Math.floor(total / (minimum * 1.25)))) };
}

function capitalize(text) { return text ? text[0].toLocaleUpperCase() + text.slice(1) : text; }
function topEntry(counts) {
  let best = null;
  for (const entry of counts.values()) if (!best || entry.count > best.count || (entry.count === best.count && entry.label < best.label)) best = entry;
  return best;
}
// Name a mix after its most common genre tag, else its most frequent artist.
function nameMix(tracks, index, used) {
  const genres = new Map(); const artists = new Map();
  for (const track of tracks) {
    for (const [key, label] of track.tags) {
      const entry = genres.get(key) || { label: label.toLowerCase(), count: 0 };
      entry.count += 1; genres.set(key, entry);
    }
    const key = artist(track);
    if (key) { const entry = artists.get(key) || { label: String(track.artist).trim(), count: 0 }; entry.count += 1; artists.set(key, entry); }
  }
  const ranked = [...genres.values()].sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : 1));
  const genre = ranked[0]; const lead = topEntry(artists);
  const share = (entry, part) => entry && entry.count >= Math.max(3, Math.ceil(tracks.length * part));
  const options = [];
  // A clear leading genre names the mix; if another mix took it, try the next strong genre before an artist suffix.
  if (share(genre, .3)) {
    options.push(`${capitalize(genre.label)} mix`);
    for (const entry of ranked.slice(1)) if (share(entry, .2)) options.push(`${capitalize(entry.label)} mix`);
    if (lead && lead.count >= 2) options.push(`${capitalize(genre.label)} mix · ${lead.label}`);
  }
  if (lead && lead.count >= 3) options.push(`${lead.label} mix`);
  const name = options.find((option) => !used.has(option.toLowerCase())) || `Daily mix ${index + 1}`;
  used.add(name.toLowerCase());
  return name;
}

// Taste nudges are small and capped so mixes rotate instead of converging on the most-played tracks:
// a fixed share of slots goes to rarely played tracks, and anything from recent mixes is penalised.
function taste(track) {
  const finishes = track.finishes || 0; const skips = track.skips || 0;
  let value = track.liked ? .04 : 0;
  if (finishes + skips) value += Math.min(.05, .025 * Math.log1p(finishes)) - .3 * skips / (skips + finishes + 1);
  else value += Math.min(.02, Math.log1p(Math.max(0, Number(track.playCount) || 0)) * .006);
  return value;
}
// Rarely played and not being skipped: these fill the exploration slots.
function isFresh(track) { return !(track.finishes > .5) && !(track.skips > .5) && (Number(track.playCount) || 0) <= 1; }

function sequence(pool, center, seed, recent) {
  const selected = []; const artistCounts = new Map();
  const remaining = pool.map((track) => ({ track, fit: dot(track.point.feature, center), base: .15 * noise(seed, track.songId)
    - Math.min(.25, .12 * (recent.get(track.songId) || 0)) }));
  const exploreEvery = 4;
  while (remaining.length && selected.length < MIX_LENGTH) {
    const last = selected.at(-1); const recentArtists = selected.slice(-2).map(artist).filter(Boolean);
    const explore = selected.length % exploreEvery === exploreEvery - 1 && remaining.some((entry) => isFresh(entry.track));
    let best = -1; let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const { track, fit, base } = remaining[i];
      if (explore && !isFresh(track)) continue;
      const key = artist(track);
      const score = .6 * fit + base + (explore ? 0 : taste(track)) + (last ? .08 * dot(track.point.audio, last.point.audio) : 0)
        - (key && recentArtists.includes(key) ? .7 : 0) - .03 * (artistCounts.get(key) || 0);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    const [{ track }] = remaining.splice(best, 1); selected.push(track);
    const key = artist(track); if (key) artistCounts.set(key, (artistCounts.get(key) || 0) + 1);
  }
  return selected;
}

// Tracks may carry `genre`, `liked`, `playCount` and decayed `finishes`/`skips`. `recent` maps song IDs to
// how strongly they featured in recent mixes. Scores describe audio and tag similarity, not mood or probability.
function generateMixes(input, seed, { recent = new Map() } = {}) {
  if (input.length < 5) return [];
  const ordered = [...input].sort((a, b) => a.songId.localeCompare(b.songId)).map((track) => ({ ...track, tags: genreTags(track.genre) }));
  const features = buildFeatures(ordered);
  ordered.forEach((track, index) => { track.point = { songId: track.songId, ...features[index] }; });
  const { minimum, count } = groupPlan(ordered.length);
  let best = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const candidate = cluster(ordered.map((track) => track.point), count, minimum, `${seed}:${attempt}`);
    if (!best || candidate.cohesion > best.cohesion + 1e-9) best = candidate;
  }
  const groups = best.centers.map(() => ({ tracks: [] }));
  ordered.forEach((track, index) => groups[best.assignment[index]].tracks.push(track));
  // The unnormalized mean makes `fit` a track's average similarity to its group: loose groups lean on
  // taste and rotation, tight groups keep their most typical tracks.
  for (const group of groups) {
    group.center = new Float64Array(ordered[0].point.feature.length);
    for (const track of group.tracks) for (let i = 0; i < group.center.length; i++) group.center[i] += track.point.feature[i] / group.tracks.length;
  }
  const viable = groups.filter((group) => group.tracks.length >= 5)
    .sort((a, b) => b.tracks.length - a.tracks.length || a.tracks[0].songId.localeCompare(b.tracks[0].songId));
  const used = new Set();
  return viable.map((group, index) => {
    const selected = sequence(group.tracks, group.center, seed, recent);
    return { id: `daily-${index + 1}`, name: nameMix(selected, index, used), songIds: selected.map((track) => track.songId) };
  });
}

// Songs from the last few days' mixes (and today's earlier edition) are pushed back so mixes keep rotating.
function recentAppearances(database, day, cached) {
  const recent = new Map(); const weights = [1, .6, .3];
  const add = (raw, weight) => {
    let parsed; try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return; }
    for (const mix of Array.isArray(parsed?.mixes) ? parsed.mixes : []) for (const id of Array.isArray(mix.songIds) ? mix.songIds : []) {
      recent.set(id, (recent.get(id) || 0) + weight);
    }
  };
  if (cached) add(cached.result, 1);
  database.prepare("SELECT result FROM daily_mixes WHERE day < ? ORDER BY day DESC LIMIT 3").all(day).forEach((row, index) => add(row.result, weights[index]));
  return recent;
}
async function getDailyMixes(database, request, { statFile = fs.promises.stat, now = new Date() } = {}) {
  const { refresh } = validateDailyMixRequest(request);
  const day = localDay(now);
  const records = database.prepare(`SELECT s.artist, s.genre, s.liked, s.playCount, s.filePath AS currentFilePath, a.*
    FROM song_analysis a JOIN songs s ON s.id = a.songId
    WHERE a.status = 'ready' AND a.modelId = ? AND a.analyzerVersion = ? AND a.filePath = s.filePath
    ORDER BY a.songId`).all(MODEL.id, ANALYZER_VERSION);
  const identity = (rows) => JSON.stringify(rows.map((t) => [t.songId, t.filePath, t.fileSize, t.fileMtime, t.analyzedAt]));
  const originalIdentity = identity(records);
  const tracks = []; const paths = new Set(); const validRecords = [];
  for (let start = 0; start < records.length; start += 32) {
    const batch = records.slice(start, start + 32);
    const valid = await Promise.all(batch.map(async (record) => {
      try { const stat = await statFile(record.filePath); return stat.isFile() && stat.size === record.fileSize && stat.mtimeMs === record.fileMtime; }
      catch { return false; }
    }));
    for (let i = 0; i < batch.length; i++) if (valid[i]) validRecords.push(batch[i]);
  }
  const nativeVectors = tryDecodeNormalizedAudio(validRecords.map((record) => record.vector), MODEL.dimensions);
  for (let i = 0; i < validRecords.length; i++) {
    const record = validRecords[i]; if (paths.has(record.filePath)) continue;
    const vector = nativeVectors ? nativeVectors[i] : readNormalizedVector(record.vector);
    if (!vector) continue;
    tracks.push({ ...record, vector }); paths.add(record.filePath);
  }
  const fingerprint = createHash("sha256").update(JSON.stringify([GENERATOR_VERSION, MODEL.id, ANALYZER_VERSION,
    tracks.map((t) => [t.songId, t.filePath, t.fileSize, t.fileMtime, t.analyzedAt])])).digest("hex");
  const cached = database.prepare("SELECT * FROM daily_mixes WHERE day = ?").get(day);
  const edition = !cached ? 0 : refresh ? cached.edition + 1 : cached.edition;
  let result;
  if (!refresh && cached?.fingerprint === fingerprint) {
    try { result = JSON.parse(cached.result); } catch { /* Rebuild a damaged cache. */ }
  }
  // Marked songs leave today's mixes straight away, without rebuilding them; unmarking brings them back.
  const hidden = notForMe(database);
  const hiddenIds = new Set(tracks.filter(hidden).map((track) => track.songId));
  const visible = (mixes) => ({ ...mixes, mixes: mixes.mixes.map((mix) => ({ ...mix, songIds: mix.songIds.filter((id) => !hiddenIds.has(id)) }))
    .filter((mix) => mix.songIds.length) });
  if (!result) {
    const stats = listeningStats(database, now);
    for (const track of tracks) Object.assign(track, stats.get(track.songId));
    result = { day, edition, generatedAt: now.getTime(), eligible: tracks.length,
      mixes: generateMixes(tracks.filter((track) => !hiddenIds.has(track.songId)), `${day}:${edition}`, { recent: recentAppearances(database, day, refresh ? cached : null) }) };
  }
  // Recheck the chosen files after clustering, before committing their IDs.
  const selected = new Set(result.mixes.flatMap((mix) => mix.songIds));
  for (const track of tracks) if (selected.has(track.songId)) {
    try {
      const stat = await statFile(track.filePath);
      if (!stat.isFile() || stat.size !== track.fileSize || stat.mtimeMs !== track.fileMtime) throw new Error();
    } catch { throw new Error("A music file changed while building mixes. Please retry."); }
  }
  // Hold the write lock only for validation and a small cache write, never for clustering.
  return database.transaction(() => {
    const current = database.prepare(`SELECT a.songId, a.filePath, a.fileSize, a.fileMtime, a.analyzedAt
      FROM song_analysis a JOIN songs s ON s.id=a.songId WHERE a.status='ready'
      AND a.modelId=? AND a.analyzerVersion=? AND a.filePath=s.filePath ORDER BY a.songId`).all(MODEL.id, ANALYZER_VERSION);
    if (identity(current) !== originalIdentity) throw new Error("Library analysis changed while building mixes. Please retry.");
    const latest = database.prepare("SELECT * FROM daily_mixes WHERE day = ?").get(day);
    if (latest && latest.edition !== cached?.edition) {
      if (latest.fingerprint === fingerprint) return visible(JSON.parse(latest.result));
      throw new Error("Library mixes changed while building. Please retry.");
    }
    database.prepare(`INSERT INTO daily_mixes (day, edition, fingerprint, result, generatedAt) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(day) DO UPDATE SET edition=excluded.edition, fingerprint=excluded.fingerprint,
      result=excluded.result, generatedAt=excluded.generatedAt`).run(day, result.edition, fingerprint, JSON.stringify(result), result.generatedAt);
    database.prepare("DELETE FROM daily_mixes WHERE day NOT IN (SELECT day FROM daily_mixes ORDER BY day DESC LIMIT 7)").run();
    return visible(result);
  }).immediate();
}
module.exports = { generateMixes, getDailyMixes, localDay, validateDailyMixRequest };
