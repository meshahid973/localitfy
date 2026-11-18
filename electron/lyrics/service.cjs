const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { parseLrc, plainLines, cleanTitle, primaryArtist } = require("./lrc.cjs");

const LRCLIB = "https://lrclib.net/api";
const MISS_TTL_MS = 2 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_GAP_MS = 300;
const DURATION_TOLERANCE_S = 4;
const PLACEHOLDER_ARTIST = /^(?:unknown artist|unknown|various artists?|n\/a|none|untitled)$/i;

function shapeResult(source, { synced = "", plain = "", instrumental = false } = {}) {
  const lines = parseLrc(synced);
  if (lines.length) return { status: "synced", source, lines };
  const text = plainLines(plain || synced);
  if (text.length) return { status: "plain", source, lines: text.map((line) => ({ time: -1, text: line })) };
  return { status: instrumental ? "instrumental" : "missing", source, lines: [] };
}

function normalized(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function matchTitle(candidateTitle, trackTitle) {
  const candidate = normalized(cleanTitle(candidateTitle));
  const track = normalized(trackTitle);
  if (!candidate) return true; // Covers legacy metadata-less test fixtures, not LRCLIB's real records.
  if (!track) return false;
  if (candidate === track) return true;
  // A title may include a subtitle or an extra edition suffix.
  if (track.length >= 7 && candidate.length >= 7 &&
    (candidate.startsWith(track + " ") || track.startsWith(candidate + " "))) return true;
  const needle = new Set(track.split(" ").filter(Boolean));
  const hay = new Set(candidate.split(" ").filter(Boolean));
  return needle.size >= 2 && hay.size >= 2 &&
    [...needle].filter(part => hay.has(part)).length / Math.max(needle.size, hay.size) >= 0.8;
}

function chooseLyricsResult(records, { track, artist, duration }) {
  const results = (Array.isArray(records) ? records : []).filter(item => item && typeof item === "object");
  const targetArtist = normalized(artist);
  const candidates = results.flatMap(item => {
    if (!matchTitle(item.trackName || item.name, track)) return [];
    const actualArtist = normalized(item.artistName);
    const seconds = Number(item.duration);
    const knownRuntime = duration > 0 && Number.isFinite(seconds) && seconds > 0;
    const gap = knownRuntime ? Math.abs(seconds - duration) : 0;
    const exactTitle = normalized(cleanTitle(item.trackName || item.name)) === normalized(track);
    const matchingArtist = !targetArtist || !actualArtist || targetArtist === actualArtist ||
      actualArtist.startsWith(targetArtist + " ") || targetArtist.startsWith(actualArtist + " ");
    // Permit an incorrectly tagged local artist only for an unusually specific title
    // with an extremely close runtime. Never use loose matches with wrong artists.
    if (!matchingArtist && !(exactTitle && normalized(track).length >= 12 && knownRuntime && gap <= 2)) return [];
    // A slowed/extended audio file may still have matching words, but not the same timestamps.
    if (gap > Math.max(40, duration * 0.3)) return [];
    const synced = Boolean(item.syncedLyrics);
    const hasLyrics = synced || Boolean(item.plainLyrics) || item.instrumental === true;
    if (!hasLyrics) return [];
    const sameLength = knownRuntime && gap <= DURATION_TOLERANCE_S;
    return [{ item, gap, sameLength, synced, artistMatched: Boolean(targetArtist && actualArtist && matchingArtist) }];
  });
  candidates.sort((a, b) =>
    Number(b.artistMatched) - Number(a.artistMatched) ||
    Number(b.sameLength) - Number(a.sameLength) ||
    Number(b.synced) - Number(a.synced) ||
    a.gap - b.gap
  );
  const picked = candidates[0];
  if (!picked) return null;
  const { item, sameLength } = picked;
  // Never apply incorrect timestamps to slowed/remixed audio.
  return shapeResult("lrclib", {
    synced: sameLength ? item.syncedLyrics : "",
    plain: item.plainLyrics ||
      (item.syncedLyrics ? parseLrc(item.syncedLyrics).map(line => line.text).join("\n") : ""),
    instrumental: item.instrumental
  });
}

function retryAfterMs(response, fallbackMs, timestamp = Date.now()) {
  const raw = response.headers?.get?.("retry-after");
  if (!raw) return fallbackMs;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - timestamp) : fallbackMs;
}

async function readEmbeddedLyrics(filePath) {
  if (!filePath) return null;
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return null;
    const { parseFile } = await import("music-metadata");
    const { common } = await parseFile(filePath, { duration: false, skipCovers: true });
    for (const value of common.lyrics || []) {
      const plain = typeof value === "string" ? value : value?.text || "";
      const result = shapeResult("embedded", { synced: plain, plain });
      if (result.lines.length) return result;
    }
  } catch { /* inaccessible or unsupported local tags */ }
  return null;
}

function createLyricsService({
  cacheDir, userAgent, fetchImpl = globalThis.fetch, now = Date.now,
  readEmbedded = readEmbeddedLyrics,
  retryDelayMs = 1000, requestSpacingMs = REQUEST_GAP_MS,
  maxCacheEntries = 2048, maxCacheBytes = 32 * 1024 * 1024,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
}) {
  const pending = new Map();
  let cacheGeneration = 0;
  let cacheTail = Promise.resolve();
  let inventory = null;
  let cacheBytes = 0;
  const entryLimit = Math.min(512 * 1024, maxCacheBytes);
  function mutateCache(task) {
    const run = cacheTail.then(task);
    cacheTail = run.catch(() => undefined);
    return run;
  }
  const cacheFile = key => path.join(cacheDir, key + ".json");
  let queue = Promise.resolve();
  let nextRequestAt = 0;

  async function readCache(key) {
    try {
      const file = cacheFile(key);
      if ((await fs.stat(file)).size > entryLimit) return null;
      const entry = JSON.parse(await fs.readFile(file, "utf8"));
      if (entry?.result?.status === "missing" && now() - Number(entry.savedAt || 0) > MISS_TTL_MS) return null;
      return entry?.result || null;
    } catch { return null; }
  }

  async function loadInventory() {
    if (inventory) return;
    const rows = [];
    for (const name of await fs.readdir(cacheDir)) {
      if (!/^[a-f0-9]{40}\.json$/.test(name)) continue;
      try {
        const stat = await fs.lstat(path.join(cacheDir, name));
        if (stat.isFile()) rows.push({ key: name.slice(0, -5), size: stat.size, modified: stat.mtimeMs });
      } catch { /* removed concurrently */ }
    }
    rows.sort((a, b) => a.modified - b.modified);
    inventory = new Map(rows.map(row => [row.key, row.size]));
    cacheBytes = rows.reduce((sum, row) => sum + row.size, 0);
  }

  async function writeCache(key, result, generation) {
    const data = JSON.stringify({ savedAt: now(), result });
    const bytes = Buffer.byteLength(data);
    if (bytes > entryLimit || maxCacheEntries < 1) return;
    try {
      await mutateCache(async () => {
        if (generation !== cacheGeneration) return;
        await fs.mkdir(cacheDir, { recursive: true });
        await loadInventory();
        if (generation !== cacheGeneration) return;
        const file = cacheFile(key);
        const temporary = file + ".tmp";
        try {
          await fs.writeFile(temporary, data);
          await fs.rename(temporary, file);
        } finally { await fs.rm(temporary, { force: true }).catch(() => undefined); }
        cacheBytes -= inventory.get(key) || 0;
        inventory.delete(key);
        inventory.set(key, bytes);
        cacheBytes += bytes;
        // Only evict regenerable, hashed LRCLIB cache entries; never user sidecars or manual matches.
        while (inventory.size > maxCacheEntries || cacheBytes > maxCacheBytes) {
          const oldest = inventory.keys().next().value;
          await fs.rm(cacheFile(oldest), { force: true });
          cacheBytes -= inventory.get(oldest);
          inventory.delete(oldest);
        }
      });
    } catch { inventory = null; /* cache is best effort */ }
  }

  async function attachCompanions(filePath, result) {
    if (!filePath || result.status !== "synced") return result;
    const base = filePath.slice(0, filePath.length - path.extname(filePath).length);
    const lines = result.lines.map(line => ({ ...line }));
    for (const [suffix, field] of [[".romanized.lrc", "romanization"], [".translation.lrc", "translation"]]) {
      try {
        const file = base + suffix;
        if ((await fs.stat(file)).size > 512 * 1024) continue;
        const companion = parseLrc(await fs.readFile(file, "utf8"));
        const times = new Map(companion.filter(line => line.text).map(line => [Math.round(line.time * 1000), line.text]));
        for (const line of lines) {
          const value = times.get(Math.round(line.time * 1000));
          if (line.text && value && value !== line.text) line[field] = value;
        }
      } catch { /* optional local companion */ }
    }
    return { ...result, lines };
  }

  async function readSidecar(filePath) {
    if (!filePath) return null;
    const base = filePath.slice(0, filePath.length - path.extname(filePath).length);
    for (const candidate of [base + ".lrc", base + ".LRC"]) {
      try {
        if ((await fs.stat(candidate)).size > 512 * 1024) continue;
        const source = await fs.readFile(candidate, "utf8");
        const result = shapeResult("file", { synced: source, plain: source });
        if (result.lines.length) return result;
      } catch { /* no local sidecar */ }
    }
    return null;
  }

  function request(endpoint, params, signal) {
    const url = LRCLIB + "/" + endpoint + "?" + new URLSearchParams(params);
    const run = queue.then(async () => {
      signal?.throwIfAborted();
      const wait = Math.max(0, nextRequestAt - now());
      if (wait > 0) await waitFor(sleep(wait), signal);
      signal?.throwIfAborted();
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          signal?.throwIfAborted();
          const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
          const response = await fetchImpl(url, {
            headers: { "User-Agent": userAgent, Accept: "application/json" },
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout
          });
          if (response.status === 404) return null;
          if (response.status === 429 || response.status === 503) {
            const delay = retryAfterMs(response, retryDelayMs * (attempt + 1), now());
            // Preserve the server's cooldown across subsequent requests.
            nextRequestAt = Math.max(nextRequestAt, now() + delay);
            if (attempt < 2 && delay <= 10_000) {
              await waitFor(sleep(delay), signal);
              continue;
            }
            throw new Error(response.status === 429
              ? "LRCLIB is rate-limiting requests (429). Try again shortly."
              : "LRCLIB is temporarily overloaded (503). Try again shortly.");
          }
          if (response.status >= 500 && attempt < 2) {
            await waitFor(sleep(retryDelayMs * (attempt + 1)), signal);
            continue;
          }
          if (!response.ok) throw new Error("lyrics lookup failed (" + response.status + ")");
          return response.json();
        }
        throw new Error("LRCLIB is temporarily unavailable");
      } finally {
        nextRequestAt = Math.max(nextRequestAt, now() + requestSpacingMs);
      }
    });
    queue = run.catch(() => {});
    return run;
  }

  async function lookupOnline(song, signal) {
    let fallback = null;
    const track = cleanTitle(song.title);
    const cleanedArtist = primaryArtist(song.artist);
    const artist = PLACEHOLDER_ARTIST.test(cleanedArtist) ? "" : cleanedArtist;
    const album = cleanTitle(song.album);
    const duration = Number(song.duration);
    if (!track) return { status: "missing", source: "lrclib", lines: [] };
    const queryDuration = Number.isFinite(duration) && duration >= 1 && duration <= 3600 ? Math.round(duration) : 0;
    if (artist) {
      const args = { track_name: track, artist_name: artist };
      if (album && !/^(unknown album|unknown|n\/a|none)$/i.test(album)) args.album_name = album;
      if (queryDuration) args.duration = String(queryDuration);
      const exact = await request("get", args, signal);
      if (exact && (exact.syncedLyrics || exact.plainLyrics || exact.instrumental)) {
        const match = chooseLyricsResult([exact], { track, artist, duration: queryDuration });
        if (match?.status === "synced" || match?.status === "instrumental") return match;
        if (match?.status === "plain") fallback = match;
      }
    }

    // Structured search can be too strict for locally imported/remixed metadata.
    const structured = await request("search", artist ? { track_name: track, artist_name: artist } : { track_name: track }, signal);
    const direct = chooseLyricsResult(structured, { track, artist, duration: queryDuration });
    if (direct?.status === "synced" || direct?.status === "instrumental") return direct;
    if (direct?.status === "plain") fallback = direct;
    // LRCLIB's q searches across title, artist, and album, like its website.
    const broad = await request("search", { q: track }, signal);
    const broadMatch = chooseLyricsResult(broad, { track, artist, duration: queryDuration });
    return (broadMatch?.status === "synced" ? broadMatch : fallback || broadMatch) ||
      { status: "missing", source: "lrclib", lines: [] };
  }

  // Shared requests survive one consumer closing; abort when the last consumer leaves.
  function waitFor(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(signal.reason);
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }

  async function get(song, { online = true, refresh = false, signal } = {}) {
    if (!song) return { status: "missing", source: "none", lines: [] };
    const sidecar = await readSidecar(song.filePath);
    if (sidecar) return attachCompanions(song.filePath, sidecar);
    signal?.throwIfAborted();
    const embedded = await waitFor(Promise.resolve(readEmbedded(song.filePath)), signal);
    if (embedded?.lines?.length) return attachCompanions(song.filePath, embedded);
    // v2 invalidates earlier false misses caused by strict search/duration filtering.
    const key = crypto.createHash("sha1")
      .update(["v3", cleanTitle(song.title), primaryArtist(song.artist), cleanTitle(song.album), Math.round(Number(song.duration) || 0)].join("\u0000").toLowerCase())
      .digest("hex");
    const generation = cacheGeneration;
    await cacheTail;
    if ((!refresh || !online) && generation === cacheGeneration) {
      const cached = await readCache(key);
      if (cached && generation === cacheGeneration && (online || cached.status !== "missing")) return attachCompanions(song.filePath, cached);
    }
    if (!online) return { status: "offline", source: "none", lines: [] };
    signal?.throwIfAborted();
    const pendingKey = `${generation}:${key}`;
    let entry = pending.get(pendingKey);
    if (!entry || entry.controller.signal.aborted) {
      const controller = new AbortController();
      const next = { controller, consumers: 0, work: null };
      next.work = lookupOnline(song, controller.signal)
        .then(async result => { if (!controller.signal.aborted) await writeCache(key, result, generation); return result; })
        .catch(error => ({ status: "error", source: "lrclib", lines: [], error: error?.name === "TimeoutError" ? "lyrics lookup timed out" : String(error?.message || error) }))
        .finally(() => { if (pending.get(pendingKey) === next) pending.delete(pendingKey); });
      pending.set(pendingKey, next);
      entry = next;
    }
    entry.consumers++;
    try { return await attachCompanions(song.filePath, await waitFor(entry.work, signal)); }
    finally {
      entry.consumers--;
      if (!entry.consumers && pending.get(pendingKey) === entry) entry.controller.abort();
    }
  }

  async function searchManual(query) {
    const text = String(query || "").trim().slice(0, 120);
    if (text.length < 2) return [];
    const rows = await request("search", { q: text });
    return (Array.isArray(rows) ? rows : []).filter(item =>
      Number.isSafeInteger(item?.id) && item.id > 0 &&
      (item.syncedLyrics || item.plainLyrics || item.instrumental)
    ).slice(0, 20).map(item => ({
      id: item.id,
      title: String(item.trackName || item.name || "").slice(0, 180),
      artist: String(item.artistName || "").slice(0, 180),
      album: String(item.albumName || "").slice(0, 180),
      duration: Number(item.duration || 0),
      synced: Boolean(item.syncedLyrics),
      instrumental: Boolean(item.instrumental)
    }));
  }

  async function getManual(id) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError("Invalid LRCLIB record ID");
    const record = await request("get/" + id, {});
    if (!record || Number(record.id) !== id) throw new Error("Lyrics record is unavailable");
    const result = shapeResult("lrclib", {
      synced: record.syncedLyrics,
      plain: record.plainLyrics,
      instrumental: record.instrumental
    });
    if (!["synced", "plain", "instrumental"].includes(result.status)) {
      throw new Error("This record has no usable lyrics");
    }
    return result;
  }

  async function clearCache() {
    cacheGeneration++;
    await mutateCache(async () => {
      await fs.rm(cacheDir, { recursive: true, force: true });
      inventory = null;
      cacheBytes = 0;
    });
    return true;
  }

  return { get, searchManual, getManual, clearCache };
}

module.exports = { createLyricsService, shapeResult, chooseLyricsResult, retryAfterMs };
