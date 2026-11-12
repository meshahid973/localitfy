const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PROTOCOL = 2;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
/** Mac features a paired phone may use while it is on the home network; the phone keeps the answers for offline use. */
const PHONE_FEATURES = new Set([
  "lyrics:get", "lyrics:search", "lyrics:select-match", "lyrics:set-offset", "lyrics:clear-selection",
  "analysis:daily-mixes", "analysis:similar-songs", "analysis:prompt-sound", "discover:get", "discover:artist-bio",
  // Read-only: the phone shows which accounts the Mac sends its plays to.
  "scrobble:status"
]);
/** Mac settings that switch those features on; the phone follows them so it offers what the Mac can answer. */
const FEATURE_SETTINGS = ["lyricsEnabled", "lyricsOnlineLookup", "experimentalMusicAnalysis", "discoverEnabled", "songRadio", "listeningHistoryEnabled", "notForMeSongs", "notForMeArtists"];
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_PAIRING_ATTEMPTS = 5;
const SONG_FIELDS = ["id", "title", "artist", "album", "genre", "liked", "playCount", "duration", "durationMs", "dateAdded", "lastPlayed", "volumeGain", "customVolume", "coverSource", "sourceType"];
const TEXT_FIELDS = ["title", "artist", "album", "genre"];
const NUMBER_FIELDS = ["volumeGain", "customVolume"];

const sha256 = (text) => crypto.createHash("sha256").update(String(text)).digest("hex");

/** Home-network peers only: the server never answers the wider internet, even if a port is forwarded. */
function isPrivateAddress(address = "") {
  const ip = String(address).replace(/^::ffff:/, "");
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (/^10\./.test(ip) || /^192\.168\./.test(ip) || /^169\.254\./.test(ip)) return true;
  const match = /^172\.(\d+)\./.exec(ip);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip);
}

function fileInfo(filePath) {
  try {
    if (!filePath || !path.isAbsolute(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    return { size: stat.size, mtimeMs: Math.round(stat.mtimeMs), ext: path.extname(filePath).slice(1).toLowerCase() };
  } catch {
    return null;
  }
}

function cleanText(value) {
  return typeof value === "string" && value.length <= 500 ? value : undefined;
}

/** Validates one song's phone edits. playCountDelta adds plays made on the phone; it never lowers the Mac's count. */
function cleanSongChange(change) {
  if (!change || typeof change !== "object") return null;
  const patch = {};
  if (typeof change.liked === "boolean") patch.liked = change.liked;
  for (const field of TEXT_FIELDS) {
    const text = cleanText(change[field]);
    if (text !== undefined) patch[field] = text;
  }
  for (const field of NUMBER_FIELDS) {
    if (Number.isFinite(change[field])) patch[field] = change[field];
  }
  const delta = Number.isSafeInteger(change.playCountDelta) && change.playCountDelta > 0 && change.playCountDelta <= 100000 ? change.playCountDelta : 0;
  const lastPlayed = typeof change.lastPlayed === "string" && !Number.isNaN(Date.parse(change.lastPlayed)) ? change.lastPlayed : null;
  return { patch, delta, lastPlayed };
}

function cleanPlaylist(value) {
  if (!value || typeof value !== "object" || typeof value.id !== "string" || !value.id || value.id.length > 200) return null;
  const songIds = Array.isArray(value.songIds) ? value.songIds.filter((id) => typeof id === "string" && id.length <= 200) : [];
  return {
    id: value.id,
    name: cleanText(value.name) || "playlist",
    songIds: [...new Set(songIds)],
    createdAt: Number.isSafeInteger(value.createdAt) ? value.createdAt : Date.now(),
    ...(value.rules && typeof value.rules === "object" ? { rules: value.rules } : {})
  };
}

/**
 * Phone sync over the home network. The Mac stays the source of truth for files and metadata:
 * the phone pulls a snapshot, merges its own edits against the previous snapshot, then pushes them here.
 */
function createSyncServer({ repositories, coverPath, statePath, serverName = "computer", platform = process.platform, appVersion = "", onChanged = () => {}, callFeature = null, onPlayEvent = () => {}, now = Date.now }) {
  let state = readState();
  let server = null;
  let pairing = null;

  function readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
      return { enabled: parsed.enabled === true, devices: Array.isArray(parsed.devices) ? parsed.devices : [] };
    } catch {
      return { enabled: false, devices: [] };
    }
  }

  function writeState() {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const temp = `${statePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(temp, statePath);
  }

  function newPairingCode() {
    pairing = { code: String(crypto.randomInt(0, 1_000_000)).padStart(6, "0"), expiresAt: now() + PAIRING_CODE_TTL_MS, attempts: 0 };
    return pairing;
  }

  function deviceForRequest(request) {
    const header = String(request.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return null;
    const hash = sha256(token);
    return state.devices.find((device) => device.tokenHash.length === hash.length &&
      crypto.timingSafeEqual(Buffer.from(device.tokenHash), Buffer.from(hash))) || null;
  }

  function snapshot() {
    const songs = repositories.songs.list().flatMap((song) => {
      const file = fileInfo(song.filePath);
      // Phones treat a missing snapshot entry as deletion. Do not send a partial
      // library when a drive is disconnected or a source file cannot be read.
      if (!file) throw new Error("Desktop audio files are unavailable. Reconnect the drive or relink missing songs before syncing. Cached phone files are unchanged.");
      const shaped = {};
      for (const field of SONG_FIELDS) if (song[field] !== undefined) shaped[field] = song[field];
      return [{ ...shaped, file, cover: fileInfo(coverPath(song)) }];
    });
    const settings = repositories.settings?.get?.() || {};
    return {
      protocol: PROTOCOL,
      // So the phone can say "Mac" or "PC"; a pairing made before this was sent learns it at the next sync.
      platform,
      serverTime: now(),
      features: Object.fromEntries(FEATURE_SETTINGS.filter((key) => settings[key] !== undefined).map((key) => [key, settings[key]])),
      songs,
      playlists: repositories.playlists.get(),
      listeningCounts: repositories.listening.counts()
    };
  }

  function applyChanges(body) {
    const result = { songs: 0, playlists: 0, playEvents: 0 };
    const finishedEvents = [];
    const changes = body?.songs && typeof body.songs === "object" ? body.songs : {};
    for (const [id, raw] of Object.entries(changes)) {
      const song = repositories.songs.get(id);
      const change = cleanSongChange(raw);
      if (!song || !change) continue;
      const patch = { ...change.patch };
      if (change.delta) patch.playCount = Math.max(0, Number(song.playCount || 0)) + change.delta;
      if (change.lastPlayed && (!song.lastPlayed || Date.parse(change.lastPlayed) > Date.parse(song.lastPlayed))) patch.lastPlayed = change.lastPlayed;
      if (Object.keys(patch).length && repositories.songs.patch(id, patch)) result.songs += 1;
    }

    const put = Array.isArray(body?.playlists?.put) ? body.playlists.put.map(cleanPlaylist).filter(Boolean) : [];
    const removed = new Set(Array.isArray(body?.playlists?.delete) ? body.playlists.delete.filter((id) => typeof id === "string") : []);
    if (put.length || removed.size) {
      const byId = new Map(put.map((playlist) => [playlist.id, playlist]));
      const current = repositories.playlists.get();
      const next = current.filter((playlist) => !removed.has(playlist.id)).map((playlist) => byId.get(playlist.id) || playlist);
      const known = new Set(current.map((playlist) => playlist.id));
      next.unshift(...put.filter((playlist) => !known.has(playlist.id)));
      repositories.playlists.save(next);
      result.playlists = put.length + removed.size;
    }

    const events = Array.isArray(body?.playEvents) ? body.playEvents.slice(0, 20000) : [];
    for (const event of events) {
      if (!repositories.listening.record(event)) continue;
      result.playEvents += 1;
      // Finished phone plays are scrobbled like the Mac's own; an unfinished one comes back once it ends.
      if (event.outcome !== "active") finishedEvents.push(event);
    }
    return { applied: result, finishedEvents };
  }

  function send(response, status, body) {
    const text = JSON.stringify(body);
    response.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text), "Cache-Control": "no-store" });
    response.end(text);
  }

  function sendFile(response, filePath) {
    const info = fileInfo(filePath);
    if (!info) return send(response, 404, { error: "not found" });
    response.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": info.size, "Cache-Control": "no-store" });
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => response.destroy());
    response.on("close", () => stream.destroy());
    stream.pipe(response);
  }

  function readJson(request) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      request.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          reject(new Error("request too large"));
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });
      request.on("end", () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
        } catch {
          reject(new Error("invalid JSON"));
        }
      });
      request.on("error", reject);
    });
  }

  async function handle(request, response) {
    if (!isPrivateAddress(request.socket.remoteAddress)) return send(response, 403, { error: "home network only" });
    const url = new URL(request.url || "/", "http://localhost");
    const route = url.pathname;

    if (request.method === "GET" && route === "/v1/hello") {
      return send(response, 200, { app: "localtify", protocol: PROTOCOL, name: serverName, platform, version: appVersion, paired: Boolean(deviceForRequest(request)) });
    }
    if (request.method === "POST" && route === "/v1/pair") {
      const body = await readJson(request);
      if (!pairing || pairing.expiresAt < now()) return send(response, 403, { error: "Open Phone sync in the Mac app's Settings to get a pairing code" });
      if (pairing.attempts >= MAX_PAIRING_ATTEMPTS) return send(response, 429, { error: "Too many wrong codes. Get a new code on the Mac" });
      if (String(body?.code || "") !== pairing.code) {
        pairing.attempts += 1;
        return send(response, 403, { error: "Wrong pairing code" });
      }
      pairing = null;
      const token = crypto.randomBytes(32).toString("base64url");
      const device = {
        id: crypto.randomUUID(),
        name: cleanText(body?.deviceName)?.slice(0, 80) || "Phone",
        tokenHash: sha256(token),
        pairedAt: now(),
        lastSyncAt: 0
      };
      state.devices.push(device);
      writeState();
      onChanged({ devices: true });
      return send(response, 200, { token, deviceId: device.id, name: serverName, platform });
    }

    const device = deviceForRequest(request);
    if (!device) return send(response, 401, { error: "This phone is not paired with this Mac" });

    if (request.method === "GET" && route === "/v1/snapshot") {
      device.lastSyncAt = now();
      writeState();
      onChanged({ devices: true });
      return send(response, 200, snapshot());
    }
    if (request.method === "POST" && route === "/v1/changes") {
      const body = await readJson(request);
      const receipt = repositories.sync.applyBatch(device.id, body.sequence, sha256(JSON.stringify(body)), () => applyChanges(body));
      // UI refreshes and scrobbling must not escape a rolled-back database transaction or run again on replay.
      if (!receipt.replayed) {
        onChanged(receipt.result.applied);
        for (const event of receipt.result.finishedEvents) onPlayEvent(event);
      }
      return send(response, 200, { ok: true, sequence: body.sequence, applied: receipt.result.applied });
    }
    const featureMatch = /^\/v1\/call\/([a-z:-]+)$/.exec(route);
    if (request.method === "POST" && featureMatch && PHONE_FEATURES.has(featureMatch[1]) && callFeature) {
      const body = await readJson(request);
      return send(response, 200, { result: (await callFeature(featureMatch[1], body?.payload)) ?? null });
    }
    const fileMatch = /^\/v1\/(audio|cover)\/([^/]+)$/.exec(route);
    if (request.method === "GET" && fileMatch) {
      const song = repositories.songs.get(decodeURIComponent(fileMatch[2]));
      if (!song) return send(response, 404, { error: "not found" });
      return sendFile(response, fileMatch[1] === "audio" ? song.filePath : coverPath(song));
    }
    return send(response, 404, { error: "not found" });
  }

  function start(port) {
    if (server) return Promise.resolve(server.address().port);
    return new Promise((resolve, reject) => {
      const next = http.createServer((request, response) => {
        handle(request, response).catch((error) => {
          if (!response.headersSent) send(response, 400, { error: error?.message || "bad request" });
          else response.destroy();
        });
      });
      next.once("error", reject);
      next.listen(port, () => {
        next.off("error", reject);
        server = next;
        resolve(next.address().port);
      });
    });
  }

  function stop() {
    pairing = null;
    if (!server) return Promise.resolve();
    const closing = server;
    server = null;
    return new Promise((resolve) => {
      closing.close(() => resolve());
      closing.closeAllConnections?.();
    });
  }

  return {
    start,
    stop,
    snapshot,
    applyChanges,
    newPairingCode,
    get pairing() { return pairing && pairing.expiresAt > now() ? { code: pairing.code, expiresAt: pairing.expiresAt } : null; },
    get running() { return Boolean(server); },
    get port() { return server ? server.address().port : 0; },
    get enabled() { return state.enabled; },
    setEnabled(enabled) { state.enabled = enabled === true; writeState(); },
    get devices() { return state.devices.map(({ id, name, pairedAt, lastSyncAt }) => ({ id, name, pairedAt, lastSyncAt })); },
    forgetDevice(id) { state.devices = state.devices.filter((device) => device.id !== id); writeState(); }
  };
}

module.exports = { createSyncServer, isPrivateAddress, cleanSongChange, cleanPlaylist, PROTOCOL, PHONE_FEATURES };
