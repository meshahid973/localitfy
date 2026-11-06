"use strict";

const fs = require("node:fs");
const path = require("node:path");
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

  // Artist pages show a Last.fm biography under the same opt-in as Discover. Answers live on disk so they work offline.
  let bios = null;
  let bioClient = null;
  const bioRequests = new Map();
  const readBios = () => {
    if (bios) return bios;
    try { bios = JSON.parse(fs.readFileSync(bioFile, "utf8")); } catch { bios = {}; }
    if (!bios || typeof bios !== "object" || Array.isArray(bios)) bios = {};
    return bios;
  };
  const writeBios = () => {
    if (!bioFile) return;
    const entries = Object.entries(readBios()).sort((a, b) => b[1].at - a[1].at).slice(0, BIO_MAX_ENTRIES);
    bios = Object.fromEntries(entries);
    try {
      fs.mkdirSync(path.dirname(bioFile), { recursive: true });
      fs.writeFileSync(bioFile, JSON.stringify(bios));
    } catch { /* An unsaved biography is only asked for again. */ }
  };
  const bioAnswer = (entry) => (entry.bio ? { status: "ready", ...entry.bio } : { status: "none" });

  router.handle("discover:artist-bio", async (_event, payload = {}) => {
    const artist = String(payload?.artist || "").trim().slice(0, 300);
    if (!artist) return { status: "none" };
    const settings = getSettings();
    if (settings.discoverEnabled !== true) return { status: "off" };
    const key = artist.toLocaleLowerCase();
    const stored = readBios()[key];
    if (stored && now() - stored.at < BIO_TTL_MS) return bioAnswer(stored);
    const apiKey = apiKeyFor(settings);
    if (!/^[0-9a-f]{32}$/i.test(apiKey)) return stored ? bioAnswer(stored) : { status: "needs-key" };
    if (bioClient?.apiKey !== apiKey) bioClient = { apiKey, client: createLastfmClient({ apiKey, cacheFile: "", fetch }) };
    let request = bioRequests.get(key);
    if (!request) {
      request = bioClient.client.artistInfo(artist).finally(() => bioRequests.delete(key));
      bioRequests.set(key, request);
    }
    try {
      const entry = { at: now(), bio: await request };
      readBios()[key] = entry;
      writeBios();
      return bioAnswer(entry);
    } catch (error) {
      return stored ? bioAnswer(stored) : { status: "error", error: error?.message || "Couldn't load the biography." };
    }
  });
}

module.exports = { registerDiscoverIpc };
