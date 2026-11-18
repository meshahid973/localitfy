"use strict";

const API = "https://musicbrainz.org/ws/2/";
const COVER_ART = "https://coverartarchive.org/";

/** Network failures are reported as such, so callers never mistake them for "no match". */
function unreachable(cause) {
  const error = new Error("Couldn't reach MusicBrainz. Check your internet connection and try again.");
  error.code = "MUSICBRAINZ_UNREACHABLE";
  error.cause = cause;
  return error;
}

/** Lucene phrase for MusicBrainz search queries. */
const phrase = (value) => `"${String(value || "").replace(/[\\"]/g, "\\$&")}"`;

/**
 * MusicBrainz asks clients to identify themselves and stay at one request per second.
 * Requests are queued, so concurrent callers share the limit.
 */
function createMusicBrainzClient({ userAgent, fetchImpl = fetch, minIntervalMs = 1100, timeoutMs = 15000, maxCacheEntries = 256, cacheTtlMs = 24 * 60 * 60 * 1000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  let active = false;
  let lastAt = 0;
  let foregroundStreak = 0;
  const cache = new Map();
  const inFlight = new Map();
  const waiting = [];

  function pump() {
    if (active || !waiting.length) return;
    const preferred = waiting.findIndex(job => !job.background);
    const background = waiting.findIndex(job => job.background);
    const index = foregroundStreak >= 8 && background >= 0 ? background : Math.max(0, preferred);
    const [job] = waiting.splice(index, 1);
    foregroundStreak = job.background ? 0 : foregroundStreak + 1;
    active = true;
    void job.run().then(job.resolve, job.reject).finally(() => {
      active = false;
      pump();
    });
  }

  function request(pathname, params = {}, { background = false } = {}) {
    const url = new URL(pathname, API);
    for (const [key, value] of Object.entries({ ...params, fmt: "json" })) url.searchParams.set(key, value);
    const key = url.href;
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      cache.delete(key);
      cache.set(key, hit);
      return hit.promise;
    }
    cache.delete(key);
    const existing = inFlight.get(key);
    if (existing) {
      if (!background) existing.background = false;
      return existing.promise;
    }
    if (waiting.length >= 128 || (background && waiting.filter(job => job.background).length >= 16)) {
      return Promise.reject(new Error("MusicBrainz request queue is busy. Try again shortly."));
    }
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const run = async () => {
      for (let attempt = 0; ; attempt += 1) {
        const wait = lastAt + minIntervalMs - Date.now();
        if (wait > 0) await sleep(wait);
        lastAt = Date.now();
        const response = await fetchImpl(key, { headers: { "User-Agent": userAgent, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) }).catch((error) => { throw unreachable(error); });
        // 503 means the rate limit was hit; back off and retry a couple of times.
        if (response.status === 503 && attempt < 2) { await sleep(2000 * (attempt + 1)); continue; }
        if (!response.ok) throw response.status >= 500 ? unreachable(new Error(String(response.status))) : new Error(`MusicBrainz request failed (${response.status})`);
        return response.json();
      }
    };
    const entry = { promise, run, resolve, reject, background };
    inFlight.set(key, entry);
    promise.then(() => {
      inFlight.delete(key);
      cache.set(key, { promise, expiresAt: Date.now() + Math.max(0, cacheTtlMs) });
      while (cache.size > Math.max(1, maxCacheEntries)) cache.delete(cache.keys().next().value);
    }, () => { inFlight.delete(key); });
    waiting.push(entry);
    pump();
    return promise;
  }

  return {
    searchCatalog: (kind, text) => {
      const fields = { recording: "recording", artist: "artist", album: "releasegroup" };
      const field = Object.hasOwn(fields, kind) ? fields[kind] : null;
      if (!field) throw new Error("Unsupported catalog search.");
      const endpoint = kind === "album" ? "release-group" : kind;
      const query = kind === "artist" ? "artist:" + phrase(text) : field + ":" + phrase(text);
      return request(endpoint, { query, limit: kind === "recording" ? "100" : "25" }).then(body => {
        const items = body[endpoint + "s"];
        return Array.isArray(items) ? items : [];
      });
    },
    searchRecordings: (title, artist, options) => request("recording", { query: `recording:${phrase(title)}${artist ? ` AND artist:${phrase(artist)}` : ""}`, limit: "25" }, options).then((body) => body.recordings || []),
    searchReleases: (album, artist) => request("release", { query: `release:${phrase(album)}${artist ? ` AND artist:${phrase(artist)}` : ""}`, limit: "15" }).then((body) => body.releases || []),
    // Every edition of an album (standard, deluxe, regional…), with track counts.
    getReleaseGroupReleases: (id) => request("release", { "release-group": id, inc: "media", limit: "50" }).then((body) => body.releases || []),
    getRelease: (id) => request(`release/${encodeURIComponent(id)}`, { inc: "recordings artist-credits release-groups isrcs" }),
    getReleaseGroupGenres: (id) => request(`release-group/${encodeURIComponent(id)}`, { inc: "genres" }).then((body) => body.genres || []),
    getArtistGenres: (id) => request(`artist/${encodeURIComponent(id)}`, { inc: "genres" }).then((body) => body.genres || [])
  };
}

/** Front cover from the Cover Art Archive, falling back to the release group's cover. */
async function fetchCoverArt({ releaseId, releaseGroupId, userAgent, fetchImpl = fetch, maxBytes = 8 * 1024 * 1024 }) {
  const targets = [releaseId && `release/${releaseId}/front-500`, releaseGroupId && `release-group/${releaseGroupId}/front-500`].filter(Boolean);
  for (const target of targets) {
    const response = await fetchImpl(COVER_ART + target, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (!response?.ok) continue;
    const type = String(response.headers.get("content-type") || "");
    if (!/^image\/(jpeg|png)/.test(type)) continue;
    const length = Number(response.headers.get("content-length") || 0);
    if (length > maxBytes) { await response.body?.cancel?.().catch(() => undefined); continue; }
    let data;
    const reader = response.body?.getReader?.();
    if (reader) {
      const chunks = [];
      let total = 0;
      let exceeded = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) { exceeded = true; await reader.cancel(); break; }
          chunks.push(Buffer.from(value));
        }
      } catch { exceeded = true; }
      finally { reader.releaseLock?.(); }
      if (exceeded) continue;
      data = Buffer.concat(chunks, total);
    } else {
      // Older test doubles do not expose a stream; real fetch responses do.
      data = Buffer.from(await response.arrayBuffer());
    }
    if (data.length && data.length <= maxBytes) return { data, ext: type.includes("png") ? ".png" : ".jpg" };
  }
  return null;
}

const coverThumbUrl = (releaseId) => releaseId ? `${COVER_ART}release/${releaseId}/front-250` : "";

module.exports = { createMusicBrainzClient, fetchCoverArt, coverThumbUrl, phrase };
