"use strict";

// Minimal Last.fm client for Discover: similar artists and an artist's top tracks. Only artist names
// and song titles are sent. Responses are cached on disk for a week and requests are spaced to stay under 5 per second.
const fs = require("node:fs");
const path = require("node:path");

const API_URL = "https://ws.audioscrobbler.com/2.0/";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 2000;
const REQUEST_SPACING_MS = 220;
const TIMEOUT_MS = 12_000;

class LastfmError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

function errorFor(code, message) {
  if (code === 10 || code === 26) return new LastfmError("Last.fm rejected the API key. Check it in Discover settings.", "bad-key");
  if (code === 29) return new LastfmError("Last.fm is rate limiting requests. Please try again in a minute.", "rate-limited");
  return new LastfmError(message || "Last.fm returned an error.", "lastfm");
}

function createLastfmClient({ apiKey, cacheFile, fetch = globalThis.fetch, now = Date.now, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  let cache = null;
  let dirty = false;
  let nextSlot = 0;

  function loadCache() {
    if (cache) return cache;
    try { cache = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch { cache = {}; }
    if (!cache || typeof cache !== "object" || Array.isArray(cache)) cache = {};
    return cache;
  }

  function saveCache() {
    if (!dirty || !cacheFile) return;
    const entries = Object.entries(loadCache()).filter(([, entry]) => now() - entry.at < CACHE_TTL_MS)
      .sort((a, b) => b[1].at - a[1].at).slice(0, CACHE_MAX_ENTRIES);
    try {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(entries)));
      dirty = false;
    } catch { /* A cache that can't be written only costs extra requests. */ }
  }

  async function call(method, params) {
    // The key is left out of the cache key so changing it doesn't throw away good answers.
    const key = `${method}?${new URLSearchParams(params)}`;
    const cached = loadCache()[key];
    if (cached && now() - cached.at < CACHE_TTL_MS) return cached.data;
    const slot = Math.max(now(), nextSlot);
    nextSlot = slot + REQUEST_SPACING_MS;
    if (slot > now()) await wait(slot - now());
    const url = `${API_URL}?${new URLSearchParams({ method, ...params, api_key: apiKey, format: "json", autocorrect: "1" })}`;
    let response;
    try {
      response = await fetch(url, { headers: { "User-Agent": "localtify" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch { throw new LastfmError("Couldn't reach Last.fm. Check your connection and try again.", "network"); }
    let body = null;
    try { body = await response.json(); } catch { /* handled below */ }
    if (body?.error) {
      // "Not found" is a normal answer for obscure artists and songs, so it's cached as empty.
      if (body.error !== 6) throw errorFor(body.error, body.message);
      body = {};
    } else if (!response.ok || !body) throw new LastfmError(`Last.fm answered with HTTP ${response.status}.`, "http");
    loadCache()[key] = { at: now(), data: body };
    dirty = true;
    return body;
  }

  const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);
  const artistName = (item) => String(item?.artist?.name ?? item?.artist ?? "").trim();
  return {
    async similarArtists(artist, limit = 30) {
      const body = await call("artist.getsimilar", { artist, limit: String(limit) });
      return list(body?.similarartists?.artist).map((item) => ({ name: String(item?.name || "").trim(), match: Number(item?.match) || 0, url: item?.url || "" }))
        .filter((item) => item.name);
    },
    async topTracks(artist, limit = 3) {
      const body = await call("artist.gettoptracks", { artist, limit: String(limit) });
      return list(body?.toptracks?.track).map((item) => ({ title: String(item?.name || "").trim(), artist: artistName(item) || artist, url: item?.url || "" }))
        .filter((item) => item.title).slice(0, limit);
    },
    flush: saveCache
  };
}

module.exports = { createLastfmClient, LastfmError, API_URL, errorFor };
