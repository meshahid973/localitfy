"use strict";

// Scrobbling: plays are sent to Last.fm and/or ListenBrainz using the usual rule (a song over 30 seconds counts
// once half of it, or 4 minutes, has been heard). Plays wait in a queue file until they're sent, so nothing is lost
// offline or if the app quits. Sign-ins are encrypted with the system keychain where Electron offers it.
const fs = require("node:fs");
const path = require("node:path");
const { artistCredits } = require("../analysis/listening-signals.cjs");
const { createLastfmService, createListenbrainzService, ScrobbleError } = require("./services.cjs");

const MIN_DURATION_SEC = 30;
const MAX_THRESHOLD_MS = 4 * 60 * 1000;
const QUEUE_MAX = 10_000;
const SEEN_MAX = 200;
const LASTFM_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const BATCH = { lastfm: 50, listenbrainz: 100 };
const RETRY_MS = [60_000, 120_000, 300_000, 900_000, 1_800_000];
const CONNECT_POLL_MS = 3000;
const CONNECT_TIMEOUT_MS = 3 * 60 * 1000;
const SERVICES = ["lastfm", "listenbrainz"];

/** The play to send for a listening event, or null if the song can't be scrobbled. */
function playFor(event, song) {
  const artist = artistCredits(song?.artist)[0];
  const title = String(song?.title || "").trim();
  if (!artist || !title || artist.toLocaleLowerCase() === "unknown artist") return null;
  const durationSec = Math.round(Number(song.durationMs) / 1000 || Number(song.duration) || 0);
  if (durationSec && durationSec < MIN_DURATION_SEC) return null;
  const album = String(song.album || "").trim();
  return { id: event.id, artist, title, album: album === "local files" ? "" : album, durationSec, startedAt: Number(event.startedAt) || 0 };
}
const thresholdMs = (play) => (play.durationSec ? Math.min(MAX_THRESHOLD_MS, play.durationSec * 500) : MAX_THRESHOLD_MS);

function createScrobbler({ file, getSong, listPlays = () => [], encrypt = (text) => `plain:${text}`, decrypt = (text) => text.replace(/^plain:/, ""),
  fetch = globalThis.fetch, now = Date.now, openUrl = async () => {}, setTimer = setTimeout, clearTimer = clearTimeout, log = console.log }) {
  let state = null;
  const seen = new Map();
  let flushing = null;
  let retryTimer = null;
  let retryStep = 0;
  let connectAttempt = 0;
  let connecting = "";
  const historyCounts = new Map();

  function load() {
    if (state) return state;
    try { state = JSON.parse(fs.readFileSync(file, "utf8")); } catch { state = {}; }
    if (!state || typeof state !== "object") state = {};
    state.queue = Array.isArray(state.queue) ? state.queue : [];
    return state;
  }
  function save() {
    const temporary = file + "." + process.pid + ".tmp";
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify(load()), { mode: 0o600 });
      fs.renameSync(temporary, file);
    } catch (error) {
      try { fs.unlinkSync(temporary); } catch {}
      log("[localtify scrobble] could not save", error?.message);
      throw error;
    }
  }

  function service(name) {
    const saved = load()[name];
    if (!saved) return null;
    try {
      if (name === "lastfm") return { api: createLastfmService({ apiKey: saved.apiKey, secret: decrypt(saved.secret), fetch }), sessionKey: decrypt(saved.session) };
      return { api: createListenbrainzService({ token: decrypt(saved.token), fetch }) };
    } catch { return null; }
  }
  const connected = () => SERVICES.filter((name) => load()[name]);
  const trim = (queue) => { if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX); };
  const signIn = (name, saved) => { load()[name] = { ...saved, connectedAt: now() }; historyCounts.delete(name); save(); };

  // Plays that ended before the service was connected; later ones are scrobbled as they happen.
  function pastPlays(name) {
    const saved = load()[name];
    if (!saved?.connectedAt || saved.historySent) return [];
    const since = name === "lastfm" ? now() - LASTFM_MAX_AGE_MS : 0;
    return listPlays({ before: saved.connectedAt, since }).flatMap((event) => {
      const play = playFor(event, getSong(event.songId));
      return play && Number(event.msListened) >= thresholdMs(play) ? [play] : [];
    });
  }
  function historyCount(name) {
    if (!historyCounts.has(name)) { try { historyCounts.set(name, pastPlays(name).length); } catch { return 0; } }
    return historyCounts.get(name);
  }

  function signOut(name, reason = "") {
    delete load()[name];
    historyCounts.delete(name);
    for (const play of state.queue) play.pending = play.pending.filter((target) => target !== name);
    state.queue = state.queue.filter((play) => play.pending.length);
    if (reason) state.lastError = reason;
    save();
  }

  function scheduleRetry() {
    if (retryTimer) return;
    const delay = RETRY_MS[Math.min(retryStep, RETRY_MS.length - 1)];
    retryStep += 1;
    retryTimer = setTimer(() => { retryTimer = null; void flush(); }, delay);
    retryTimer?.unref?.();
  }

  async function sendTo(name) {
    const target = service(name);
    if (!target) return;
    for (;;) {
      const cutoff = now() - LASTFM_MAX_AGE_MS;
      // Last.fm refuses plays older than two weeks.
      if (name === "lastfm") for (const play of state.queue) if (play.startedAt < cutoff) play.pending = play.pending.filter((item) => item !== name);
      const batch = state.queue.filter((play) => play.pending.includes(name)).slice(0, BATCH[name]);
      if (!batch.length) return;
      try {
        if (name === "lastfm") await target.api.scrobble(target.sessionKey, batch);
        else await target.api.scrobble(batch);
      } catch (error) {
        if (error instanceof ScrobbleError && error.signedOut) { signOut(name, error.message); return; }
        state.lastError = error?.message || "Scrobbling failed.";
        // An uncertain failure must not silently discard plays; retry later.
        scheduleRetry();
        return;
      }
      for (const play of batch) play.pending = play.pending.filter((item) => item !== name);
      state.sent = (state.sent || 0) + batch.length;
      state.lastSentAt = now();
    }
  }

  async function sendAll() {
    load().lastError = "";
    for (const name of connected()) await sendTo(name);
    state.queue = state.queue.filter((play) => play.pending.length);
    if (!state.lastError) retryStep = 0;
    save();
  }
  // Cleared in .finally so it can't be cleared before it's set when there's nothing to send.
  function flush() {
    flushing ||= sendAll().finally(() => { flushing = null; });
    return flushing;
  }

  function enqueue(play) {
    const pending = connected();
    if (!pending.length) return;
    const queue = load().queue;
    if (queue.some((item) => item.id === play.id)) return;
    queue.push({ ...play, pending });
    trim(queue);
    save();
    void flush();
  }

  function nowPlaying(play) {
    for (const name of connected()) {
      const target = service(name);
      if (!target) continue;
      const sent = name === "lastfm" ? target.api.nowPlaying(target.sessionKey, play) : target.api.nowPlaying(play);
      // "Now playing" is best effort; only a revoked sign-in matters.
      void Promise.resolve(sent).catch((error) => { if (error instanceof ScrobbleError && error.signedOut) signOut(name, error.message); });
    }
  }

  return {
    /** Called with every listening event the player records. */
    observe(event) {
      if (!event?.id || !connected().length) return;
      const seenEntry = seen.get(event.id) || { nowPlaying: false, queued: false };
      if (seenEntry.queued && seenEntry.nowPlaying) return;
      const play = playFor(event, getSong(event.songId));
      if (!play) return;
      if (!seenEntry.nowPlaying && event.outcome === "active") { seenEntry.nowPlaying = true; nowPlaying(play); }
      if (!seenEntry.queued && Number(event.msListened) >= thresholdMs(play)) { seenEntry.queued = true; enqueue(play); }
      seen.delete(event.id);
      seen.set(event.id, seenEntry);
      if (seen.size > SEEN_MAX) seen.delete(seen.keys().next().value);
    },
    flush,
    status() {
      const saved = load();
      const service = (name) => ({ connected: Boolean(saved[name]), username: saved[name]?.username || "",
        waiting: saved.queue.filter((play) => play.pending.includes(name)).length, history: historyCount(name) });
      return { lastfm: service("lastfm"), listenbrainz: service("listenbrainz"),
        sent: saved.sent || 0, lastSentAt: saved.lastSentAt || 0, lastError: saved.lastError || "", connecting };
    },
    /** Opens Last.fm in the browser to approve the app, then waits for the approval. */
    /** The key and secret must come from the same Last.fm API account; the sign-in only works with that key. */
    async connectLastfm({ apiKey: key, sharedSecret }) {
      const apiKey = String(key || "").trim();
      const secret = String(sharedSecret || "").trim();
      if (!/^[0-9a-f]{32}$/i.test(apiKey)) throw new Error("The API key is 32 letters and numbers, shown on your Last.fm API account.");
      if (!/^[0-9a-f]{32}$/i.test(secret)) throw new Error("The shared secret is 32 letters and numbers, shown once when you create a Last.fm API account.");
      if (secret.toLowerCase() === apiKey.toLowerCase()) throw new Error("That's the API key. Paste the shared secret that came with it.");
      const attempt = ++connectAttempt;
      connecting = "lastfm";
      try {
        const api = createLastfmService({ apiKey, secret, fetch });
        const token = await api.getToken();
        await openUrl(api.authUrl(token));
        const deadline = now() + CONNECT_TIMEOUT_MS;
        while (now() < deadline) {
          await new Promise((resolve) => setTimer(resolve, CONNECT_POLL_MS));
          if (attempt !== connectAttempt) throw new Error("Connecting was cancelled.");
          const session = await api.getSession(token);
          if (session) {
            signIn("lastfm", { apiKey, secret: encrypt(secret), session: encrypt(session.sessionKey), username: session.username });
            return this.status();
          }
        }
        throw new Error("Last.fm wasn't approved in time. Try connecting again.");
      } finally { if (attempt === connectAttempt) connecting = ""; }
    },
    cancelConnect() { connectAttempt += 1; connecting = ""; },
    async connectListenbrainz({ token }) {
      const value = String(token || "").trim();
      if (!value) throw new Error("Paste your ListenBrainz user token.");
      const { username } = await createListenbrainzService({ token: value, fetch }).validate();
      signIn("listenbrainz", { token: encrypt(value), username });
      return this.status();
    },
    /** Queues this device's earlier plays for one service, once. */
    async sendHistory(name) {
      if (!SERVICES.includes(name)) throw new TypeError("Unknown scrobbling service");
      const saved = load()[name];
      if (!saved) throw new Error("Connect first.");
      const queue = state.queue;
      for (const play of pastPlays(name)) {
        const queued = queue.find((item) => item.id === play.id);
        if (queued) { if (!queued.pending.includes(name)) queued.pending.push(name); } else queue.push({ ...play, pending: [name] });
      }
      queue.sort((a, b) => a.startedAt - b.startedAt);
      trim(queue);
      saved.historySent = true;
      historyCounts.delete(name);
      save();
      await flush();
      return this.status();
    },
    disconnect(name) { if (SERVICES.includes(name)) signOut(name); return this.status(); },
    dispose() { clearTimer(retryTimer); retryTimer = null; connectAttempt += 1; }
  };
}

module.exports = { createScrobbler, playFor, thresholdMs };
