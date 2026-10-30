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
function createMusicBrainzClient({ userAgent, fetchImpl = fetch, minIntervalMs = 1100, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  let queue = Promise.resolve();
  let lastAt = 0;
  const cache = new Map();

  function request(pathname, params = {}) {
    const url = new URL(pathname, API);
    for (const [key, value] of Object.entries({ ...params, fmt: "json" })) url.searchParams.set(key, value);
    const key = url.href;
    if (cache.has(key)) return cache.get(key);
    const run = queue.then(async () => {
      for (let attempt = 0; ; attempt += 1) {
        const wait = lastAt + minIntervalMs - Date.now();
        if (wait > 0) await sleep(wait);
        lastAt = Date.now();
        const response = await fetchImpl(key, { headers: { "User-Agent": userAgent, Accept: "application/json" } }).catch((error) => { throw unreachable(error); });
        // 503 means the rate limit was hit; back off and retry a couple of times.
        if (response.status === 503 && attempt < 2) { await sleep(2000 * (attempt + 1)); continue; }
        if (!response.ok) throw response.status >= 500 ? unreachable(new Error(String(response.status))) : new Error(`MusicBrainz request failed (${response.status})`);
        return response.json();
      }
    });
    queue = run.catch(() => undefined);
    cache.set(key, run);
    run.catch(() => cache.delete(key));
    return run;
  }

  return {
    searchRecordings: (title, artist) => request("recording", { query: `recording:${phrase(title)}${artist ? ` AND artist:${phrase(artist)}` : ""}`, limit: "25" }).then((body) => body.recordings || []),
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
    const response = await fetchImpl(COVER_ART + target, { headers: { "User-Agent": userAgent } }).catch(() => null);
    if (!response?.ok) continue;
    const type = String(response.headers.get("content-type") || "");
    if (!/^image\/(jpeg|png)/.test(type)) continue;
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length && data.length <= maxBytes) return { data, ext: type.includes("png") ? ".png" : ".jpg" };
  }
  return null;
}

const coverThumbUrl = (releaseId) => releaseId ? `${COVER_ART}release/${releaseId}/front-250` : "";

module.exports = { createMusicBrainzClient, fetchCoverArt, coverThumbUrl, phrase };
