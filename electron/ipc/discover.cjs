"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createLastfmClient } = require("../discover/lastfm.cjs");
const { discover, withoutOwned } = require("../discover/recommend.cjs");
const { catalogArtwork, createArtworkLookup, matchArtistArtwork } = require("../discover/artwork.cjs");
const { rankCatalog, searchTerms } = require("../discover/catalog.cjs");

const RESULT_TTL_MS = 12 * 60 * 60 * 1000;
// Biographies rarely change. Old ones are still shown while offline or when Last.fm fails.
const BIO_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BIO_MAX_ENTRIES = 3000;
// A build can ship a key through the environment; one entered in Discover settings always wins.
const apiKeyFor = (settings) => String(settings.lastfmApiKey || process.env.LOCALTIFY_LASTFM_API_KEY || "").trim();

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanText = (value) => typeof value === "string" ? value.trim().slice(0, 300) : "";
function normalizeCatalog(kind, items) {
  const endpoint = kind;
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items.slice(0, 100) : []) {
    if (!item || typeof item.id !== "string" || !MBID.test(item.id) || seen.has(item.id.toLowerCase())) continue;
    const title = cleanText(kind === "artist" ? item.name : item.title);
    if (!title) continue;
    const artist = Array.isArray(item["artist-credit"]) ? item["artist-credit"].slice(0, 12)
      .map(credit => cleanText(credit?.name || credit?.artist?.name)).filter(Boolean).join(", ").slice(0, 300) : "";
    const subtitle = kind === "artist"
      ? [cleanText(item.disambiguation), cleanText(item.country)].filter(Boolean).join(" · ")
      : [artist, cleanText(item["first-release-date"])].filter(Boolean).join(" · ");
    seen.add(item.id.toLowerCase());
    result.push({ id: item.id, title, artist, subtitle, url: "https://musicbrainz.org/" + endpoint + "/" + item.id, ...catalogArtwork(kind, item) });
  }
  return result;
}

/** Public catalog needs only opt-in; Last.fm personalized results require a valid key. */
function registerDiscoverIpc(router, { getSongs, getSettings, cacheFile, bioFile, fetch, musicBrainzClient, searchStore, lookupAudioDb, searchYouTubeMusic, searchYouTubeMusicRadio, searchYouTubeArtwork, now = Date.now }) {
  let saved = null;
  let running = null;
  let catalogRunning = null;
  let artworkClient = null, artworkKey = "";
  const lookupArtwork = createArtworkLookup(musicBrainzClient, now, async (title, artist) => {
    const settings = getSettings();
    const apiKey = apiKeyFor(settings);
    if (settings.discoverEnabled !== true || !/^[0-9a-f]{32}$/i.test(apiKey)) return null;
    if (!artworkClient || artworkKey !== apiKey) {
      artworkKey = apiKey;
      artworkClient = createLastfmClient({ apiKey, cacheFile: cacheFile ? cacheFile + ".artwork" : "", fetch, now });
    }
    const client = artworkClient;
    try { return await client.trackInfo(title, artist); } finally { client.flush(); }
  }, lookupAudioDb ? (title, artist) => getSettings().discoverEnabled === true ? lookupAudioDb(title, artist) : Promise.resolve({}) : undefined, searchYouTubeArtwork ? (title, artist) => getSettings().discoverEnabled === true ? searchYouTubeArtwork("recording", `${title} ${artist.replace(/\s+-\s+Topic$/i,"")}`.slice(0,160)) : Promise.resolve([]) : undefined);
  const artistArtworkCache=new Map(), artistArtworkPending=new Map();
  async function lookupArtistArtwork(name) {
    if (!searchYouTubeArtwork) return {};
    const key=name.normalize("NFKC").toLowerCase();
    const hit=artistArtworkCache.get(key);
    if(hit&&now()-hit.at<(hit.value.coverUrl?86400000:60000))return hit.value;
    if(artistArtworkPending.has(key))return artistArtworkPending.get(key);
    if(artistArtworkPending.size>=4)throw Error("Artwork queue busy");
    const task=Promise.resolve().then(()=>searchYouTubeArtwork("artist",name.slice(0,160)))
      .then(items=>{const value=matchArtistArtwork(items,name);artistArtworkCache.set(key,{at:now(),value});while(artistArtworkCache.size>256)artistArtworkCache.delete(artistArtworkCache.keys().next().value);return value;})
      .finally(()=>artistArtworkPending.delete(key));
    artistArtworkPending.set(key,task);return task;
  }
  router.handle("discover:get", async (_event, payload = {}) => {
    const settings = getSettings();
    if (settings.discoverEnabled !== true) return { status: "off" };
    if (payload?.artwork !== undefined) {
      const { title, artist, kind = "recording" } = payload.artwork || {};
      if (!["artist","recording"].includes(kind) || typeof title !== "string" || typeof artist !== "string" || !title.trim() || (kind === "recording" && !artist.trim()) || title.length > 300 || artist.length > 300)
        return { status: "error", error: "Invalid artwork lookup." };
      try {
        const artwork = kind === "artist" ? await lookupArtistArtwork(title.trim()) : await lookupArtwork(title.trim(), artist.trim());
        return getSettings().discoverEnabled === true ? { status: "artwork", ...artwork } : { status: "off" };
      } catch { return { status: "error", error: "Artwork unavailable." }; }
    }
    if (payload?.catalog !== undefined) {
      const query = payload.catalog;
      const kind = query?.kind;
      const term = typeof query?.term === "string" ? query.term.trim() : "";
      if (!["recording", "artist"].includes(kind) || term.length < 2 || term.length > 160)
        return { status: "error", error: "Enter a search of 2–160 characters." };
      if (!musicBrainzClient) return { status: "error", error: "Public catalog is unavailable. Update the desktop application." };
      const radioSeed = query?.radioSeed;
      if (radioSeed !== undefined && (kind !== "recording" || typeof radioSeed !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(radioSeed) || !searchYouTubeMusicRadio)) return { status: "error", error: "Related songs unavailable." };
      const key = JSON.stringify([kind, term.toLowerCase(), radioSeed || ""]);
      if (catalogRunning && catalogRunning.key !== key)
        return { status: "error", error: "Another catalog search is in progress. Try again when it finishes." };
      if (!catalogRunning) {
        const promise = Promise.resolve().then(async () => {
          if (getSettings().discoverEnabled !== true) return [];
          if (radioSeed) return searchYouTubeMusicRadio(radioSeed);
          // Search YouTube Music only for explicit user queries, never library seeds.
          if (searchYouTubeMusic) {
            const direct = await searchYouTubeMusic(kind, term).catch(() => []);
            if (getSettings().discoverEnabled !== true) return [];
            if (direct.length) return direct;
          }
          // Artist searches retain the structured catalog; song searches combine
          // exact-title MusicBrainz matches, store metadata and listening popularity.
          if (kind !== "recording" || !searchStore) return normalizeCatalog(kind, await musicBrainzClient.searchCatalog(kind, term));
          const terms = searchTerms(term);
          const title = terms.at(-1);
          const settings = getSettings();
          const apiKey = apiKeyFor(settings);
          const lastfm = /^[0-9a-f]{32}$/i.test(apiKey) ? createLastfmClient({ apiKey, cacheFile, fetch, now }) : null;
          const jobs = [musicBrainzClient.searchCatalog(kind, title), searchStore(terms[0]), lastfm ? lastfm.searchTracks(title).finally(()=>lastfm.flush()) : Promise.resolve([])];
          if (terms.length > 1) jobs.push(searchStore(title));
          const settled = await Promise.allSettled(jobs);
          if (settled.slice(0,2).every(result=>result.status==="rejected") && settled.slice(2).every(result=>result.status==="rejected"||!result.value?.length)) throw Error("Catalog unavailable");
          const items = index => settled[index]?.status === "fulfilled" ? settled[index].value : [];
          return rankCatalog(term, normalizeCatalog(kind, items(0)), [...items(1), ...items(3)], items(2));
        })
          .finally(() => { if (catalogRunning?.promise === promise) catalogRunning = null; });
        catalogRunning = { key, promise };
      }
      try {
        const items = await catalogRunning.promise;
        return getSettings().discoverEnabled === true ? { status: "catalog", kind, items } : { status: "off" };
      } catch {
        return getSettings().discoverEnabled === true
          ? { status: "error", error: "Could not search the music catalog. Check your connection and try again." }
          : { status: "off" };
      }
    }
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
