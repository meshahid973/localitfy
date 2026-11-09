"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createLastfmClient } = require("../discover/lastfm.cjs");
const { discover, withoutOwned } = require("../discover/recommend.cjs");

const RESULT_TTL_MS = 12 * 60 * 60 * 1000;
// Biographies rarely change. Old ones are still shown while offline or when Last.fm fails.
const BIO_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BIO_MAX_ENTRIES = 3000;
// A build can ship a key through the environment; one entered in Discover settings always wins.
const apiKeyFor = (settings) => String(settings.lastfmApiKey || process.env.LOCALTIFY_LASTFM_API_KEY || "").trim();

/** Discover is off until it's turned on, and needs a Last.fm API key. Results are kept for half a day. */
function registerDiscoverIpc(router, { getSongs, getSettings, cacheFile, bioFile, fetch, now = Date.now }) {
  let saved = null;
  let running = null;
  router.handle("discover:get", async (_event, payload = {}) => {
    const settings = getSettings();
    if (settings.discoverEnabled !== true) return { status: "off" };
    const apiKey = apiKeyFor(settings);
    if (!/^[0-9a-f]{32}$/i.test(apiKey)) return { status: "needs-key" };
    const current = { songs: getSongs(), hiddenArtists: Array.isArray(settings.notForMeArtists) ? settings.notForMeArtists : [] };
    if (payload?.refresh !== true && saved?.apiKey === apiKey && now() - saved.result.generatedAt < RESULT_TTL_MS) return withoutOwned(saved.result, current);
    if (running?.apiKey === apiKey) return running.promise.then((result) => withoutOwned(result, current));
    const client = createLastfmClient({ apiKey, cacheFile, fetch });
    const promise = (async () => {
      try {
        const result = await discover({ ...current, client, now: now() });
        // Requests from a previous API key must never overwrite the latest cached result.
        if (running?.apiKey === apiKey) saved = { apiKey, result };
        return result;
      } catch (error) {
        return { status: "error", error: error?.message || "Discover failed. Please try again." };
      } finally {
        client.flush();
        if (running?.promise === promise) running = null;
      }
    })();
    running = { apiKey, promise };
    return promise.then((result) => withoutOwned(result, current));
  });

  // Biographies use Discover's existing opt-in. Only validated records enter the disk cache.
  let bios = null;
  let bioClient = null;
  const bioRequests = new Map();

  const readBios = () => {
    if (bios) return bios;
    let decoded;
    try { decoded = JSON.parse(fs.readFileSync(bioFile, "utf8")); } catch { decoded = null; }
    // Null-prototype dictionaries safely handle unusual artist names, including "__proto__".
    bios = Object.create(null);
    if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
      for (const [artist, entry] of Object.entries(decoded)) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const bio = entry.bio;
        if (bio !== null && (!bio || typeof bio !== "object" || Array.isArray(bio) ||
            !["name", "url", "summary", "content"].every((field) => typeof bio[field] === "string"))) continue;
        // Retain valid biographies with invalid timestamps for offline fallback.
        bios[artist] = entry;
      }
    }
    return bios;
  };

  /** Atomically replace the cache file so an interrupted write cannot truncate older biographies. */
  const writeBios = () => {
    if (!bioFile) return;
    const entries = Object.entries(readBios())
      .sort((a, b) => (Number(b[1].at) || 0) - (Number(a[1].at) || 0))
      .slice(0, BIO_MAX_ENTRIES);
    const snapshot = Object.fromEntries(entries);
    let tempFile = "";
    try {
      fs.mkdirSync(path.dirname(bioFile), { recursive: true });
      tempFile = path.join(path.dirname(bioFile), "." + path.basename(bioFile) + "." + process.pid + "." + randomUUID() + ".tmp");
      fs.writeFileSync(tempFile, JSON.stringify(snapshot), { flag: "wx" });
      fs.renameSync(tempFile, bioFile);
      bios = Object.assign(Object.create(null), snapshot);
    } catch {
      if (tempFile) {
        try { fs.rmSync(tempFile, { force: true }); } catch { /* Ignore cleanup errors. */ }
      }
      // Cache persistence failures should not prevent playback or biography display.
    }
  };
  const bioAnswer = (entry) => (entry?.bio ? { status: "ready", ...entry.bio } : { status: "none" });

  router.handle("discover:artist-bio", async (_event, payload = {}) => {
    const artist = String(payload?.artist || "").trim().slice(0, 300);
    if (!artist) return { status: "none" };
    const settings = getSettings();
    if (settings.discoverEnabled !== true) return { status: "off" };

    const key = artist.toLocaleLowerCase();
    const stored = readBios()[key];
    const storedAt = Number(stored?.at);
    if (stored && Number.isFinite(storedAt) && now() - storedAt >= 0 && now() - storedAt < BIO_TTL_MS) return bioAnswer(stored);

    const apiKey = apiKeyFor(settings);
    if (!/^[0-9a-f]{32}$/i.test(apiKey)) return stored ? bioAnswer(stored) : { status: "needs-key" };
    if (bioClient?.apiKey !== apiKey) bioClient = { apiKey, client: createLastfmClient({ apiKey, cacheFile: "", fetch }) };

    // Pending requests must be keyed by both API key and artist, not by artist alone.
    const requestKey = apiKey + ":" + key;
    let request = bioRequests.get(requestKey);
    if (!request) {
      request = bioClient.client.artistInfo(artist).finally(() => bioRequests.delete(requestKey));
      bioRequests.set(requestKey, request);
    }
    const obsoleteOrDisabled = () => {
      const latest = getSettings();
      if (latest.discoverEnabled !== true) return { status: "off" };
      return apiKeyFor(latest) === apiKey ? null : { status: "needs-key" };
    };
    try {
      const answer = await request;
      const blocked = obsoleteOrDisabled();
      if (blocked) return blocked;
      const entry = { at: now(), bio: answer };
      readBios()[key] = entry;
      writeBios();
      return bioAnswer(entry);
    } catch (error) {
      const blocked = obsoleteOrDisabled();
      if (blocked) return blocked;
      return stored ? bioAnswer(stored) : { status: "error", error: error?.message || "Couldn't load the biography." };
    }
  });
}

module.exports = { registerDiscoverIpc };
