"use strict";

// The two places plays can be sent. Last.fm calls are signed with the user's shared secret; ListenBrainz uses
// the user's token. Neither ever reaches the renderer.
const crypto = require("node:crypto");
const { API_URL, LastfmError, errorFor } = require("../discover/lastfm.cjs");

const TIMEOUT_MS = 15_000;
const LISTENBRAINZ_URL = "https://api.listenbrainz.org/1/";
const CLIENT = { media_player: "localtify", submission_client: "localtify" };

class ScrobbleError extends Error {
  /** `retry`: worth trying again later. `signedOut`: the saved sign-in no longer works. */
  constructor(message, { retry = false, signedOut = false } = {}) { super(message); this.retry = retry; this.signedOut = signedOut; }
}

const offline = (service) => new ScrobbleError(`Couldn't reach ${service}. Plays are kept and sent later.`, { retry: true });

function createLastfmService({ apiKey, secret, fetch = globalThis.fetch }) {
  // https://www.last.fm/api/authspec: md5 of the sorted parameters (minus format) followed by the secret.
  const sign = (params) => crypto.createHash("md5")
    .update(Object.keys(params).sort().map((key) => key + params[key]).join("") + secret, "utf8").digest("hex");

  async function call(method, params = {}) {
    const body = { ...params, method, api_key: apiKey };
    const form = new URLSearchParams({ ...body, api_sig: sign(body), format: "json" });
    let response;
    try {
      response = await fetch(API_URL, { method: "POST", body: form, headers: { "User-Agent": "localtify" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch { throw offline("Last.fm"); }
    let json = null;
    try { json = await response.json(); } catch { /* handled below */ }
    if (json?.error) {
      // 9: session revoked. 11/16: Last.fm is down. 29: rate limited. 13: wrong shared secret. 14: the user hasn't approved yet.
      if (json.error === 9) throw new ScrobbleError("Last.fm signed this app out. Connect again to keep scrobbling.", { signedOut: true });
      if ([11, 16, 29].includes(json.error)) throw new ScrobbleError("Last.fm is busy. Plays are kept and sent later.", { retry: true });
      if (json.error === 13) throw new ScrobbleError("Last.fm didn't accept the shared secret. Check that the API key and shared secret come from the same API account.");
      const error = errorFor(json.error, json.message);
      error.lastfmCode = json.error;
      throw error;
    }
    if (!response.ok || !json) throw new ScrobbleError(`Last.fm answered with HTTP ${response.status}.`, { retry: response.status >= 500 });
    return json;
  }

  const track = (play, prefix = "", suffix = "") => ({
    [`${prefix}artist${suffix}`]: play.artist, [`${prefix}track${suffix}`]: play.title,
    ...(play.album ? { [`${prefix}album${suffix}`]: play.album } : {}),
    ...(play.durationSec ? { [`${prefix}duration${suffix}`]: String(play.durationSec) } : {})
  });

  return {
    async getToken() { return (await call("auth.getToken")).token; },
    authUrl: (token) => `https://www.last.fm/api/auth/?${new URLSearchParams({ api_key: apiKey, token })}`,
    /** Resolves to null until the user approves the app in their browser. */
    async getSession(token) {
      try { const { session } = await call("auth.getSession", { token }); return { sessionKey: session.key, username: session.name }; }
      catch (error) { if (error instanceof LastfmError && error.lastfmCode === 14) return null; throw error; }
    },
    nowPlaying: (sessionKey, play) => call("track.updateNowPlaying", { ...track(play), sk: sessionKey }),
    /** Up to 50 plays per call. */
    scrobble(sessionKey, plays) {
      const params = { sk: sessionKey };
      plays.forEach((play, index) => Object.assign(params, track(play, "", `[${index}]`), { [`timestamp[${index}]`]: String(Math.floor(play.startedAt / 1000)) }));
      return call("track.scrobble", params);
    }
  };
}

function createListenbrainzService({ token, fetch = globalThis.fetch }) {
  async function request(pathname, init = {}) {
    let response;
    try {
      response = await fetch(LISTENBRAINZ_URL + pathname, { ...init, headers: { Authorization: `Token ${token}`, "Content-Type": "application/json", ...init.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch { throw offline("ListenBrainz"); }
    let json = null;
    try { json = await response.json(); } catch { /* handled below */ }
    if (response.status === 401) throw new ScrobbleError("ListenBrainz rejected the token. Connect again with a new one.", { signedOut: true });
    if (response.status === 429 || response.status >= 500) throw new ScrobbleError("ListenBrainz is busy. Plays are kept and sent later.", { retry: true });
    if (!response.ok) throw new ScrobbleError(json?.error || `ListenBrainz answered with HTTP ${response.status}.`);
    return json;
  }
  const metadata = (play) => ({ artist_name: play.artist, track_name: play.title, ...(play.album ? { release_name: play.album } : {}),
    additional_info: { ...CLIENT, ...(play.durationSec ? { duration_ms: play.durationSec * 1000 } : {}) } });
  return {
    async validate() {
      const result = await request("validate-token");
      if (!result?.valid) throw new ScrobbleError("ListenBrainz didn't accept that token. Copy it again from your ListenBrainz settings.");
      return { username: result.user_name };
    },
    nowPlaying: (play) => request("submit-listens", { method: "POST", body: JSON.stringify({ listen_type: "playing_now", payload: [{ track_metadata: metadata(play) }] }) }),
    /** Up to 100 plays per call. */
    scrobble: (plays) => request("submit-listens", { method: "POST", body: JSON.stringify({
      listen_type: plays.length === 1 ? "single" : "import",
      payload: plays.map((play) => ({ listened_at: Math.floor(play.startedAt / 1000), track_metadata: metadata(play) })) }) })
  };
}

module.exports = { createLastfmService, createListenbrainzService, ScrobbleError };
