"use strict";

const { createLastfmClient } = require("../discover/lastfm.cjs");
const { discover, withoutOwned } = require("../discover/recommend.cjs");

const RESULT_TTL_MS = 12 * 60 * 60 * 1000;
// A build can ship a key through the environment; one entered in Discover settings always wins.
const apiKeyFor = (settings) => String(settings.lastfmApiKey || process.env.LOCALTIFY_LASTFM_API_KEY || "").trim();

/** Discover is off until it's turned on, and needs a Last.fm API key. Results are kept for half a day. */
function registerDiscoverIpc(router, { getSongs, getSettings, cacheFile, fetch, now = Date.now }) {
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
}

module.exports = { registerDiscoverIpc };
