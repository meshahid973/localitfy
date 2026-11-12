const LIVE_VERSION = 1;
const COMPUTER = "computer";
const HEARTBEAT_MS = 25 * 1000;
/** A phone answers every heartbeat; one silent for this many in a row has gone (Wi-Fi off, out of the house). */
const MISSED_HEARTBEATS = 2.5;
/** An active phone that drops off stays the player this long, so a Wi-Fi blip doesn't end its session. */
const ACTIVE_GRACE_MS = 30 * 1000;
const MAX_QUEUE = 500;
const ACTIONS = new Set(["play", "pause", "next", "previous", "seek", "play-song", "play-index", "queue-set", "queue-add", "shuffle", "repeat"]);

const text = (value, max = 500) => (typeof value === "string" ? value.slice(0, max) : "");
const number = (value) => (Number.isFinite(value) ? Number(value) : 0);
const ids = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === "string" && id.length <= 200).slice(0, MAX_QUEUE) : []);

/** What the active player reports: song, play state, a position stamped with the computer's clock, and its queue. */
function cleanState(state) {
  return {
    epoch: number(state.epoch),
    songId: text(state.songId, 200),
    title: text(state.title),
    artist: text(state.artist),
    album: text(state.album),
    durationMs: Math.max(0, number(state.durationMs)),
    playing: state.playing === true,
    positionMs: Math.max(0, number(state.positionMs)),
    at: number(state.at),
    rate: number(state.rate) || 1,
    shuffle: state.shuffle === true,
    repeat: ["off", "one", "all"].includes(state.repeat) ? state.repeat : "off",
    queue: ids(state.queue),
    queueRev: number(state.queueRev),
    contextLabel: text(state.contextLabel, 200),
    missing: ids(state.missing)
  };
}

function cleanCommand(message) {
  if (!ACTIONS.has(message.action)) return null;
  return {
    action: message.action,
    epoch: number(message.epoch),
    positionMs: Math.max(0, number(message.positionMs)),
    songId: text(message.songId, 200),
    index: number(message.index),
    songIds: ids(message.songIds),
    next: message.next === true,
    baseRev: number(message.baseRev),
    base: ids(message.base),
    queue: ids(message.queue),
    on: message.on === true,
    replaceQueue: message.replaceQueue === true,
    mode: ["off", "one", "all"].includes(message.mode) ? message.mode : "off"
  };
}

/**
 * The live connection between the computer and paired phones while both apps are open on the home network.
 * Each phone holds one server-sent-events stream (GET /v1/live) and posts its messages (POST /v1/live); the
 * computer's own window takes part through IPC as the peer "computer". The hub relays playback messages, decides
 * which device is the active player, and applies likes newest-first so live and batch sync agree.
 */
function createLiveHub({ repositories, serverName = "computer", now = Date.now, toComputer = () => {}, heartbeatMs = HEARTBEAT_MS, graceMs = ACTIVE_GRACE_MS }) {
  const phones = new Map();
  let session = { active: "", epoch: 0 };
  let lastState = null;
  let graceTimer = null;
  let heartbeat = null;

  const online = (id) => id === COMPUTER || phones.has(id);
  const peers = () => [
    { id: COMPUTER, name: serverName, kind: "computer" },
    ...[...phones].map(([id, phone]) => ({ id, name: phone.name, kind: "phone" }))
  ];
  const presence = () => ({ type: "presence", peers: peers(), session: { ...session, online: !session.active || online(session.active) }, state: lastState, serverTime: now() });

  function deliver(id, event) {
    if (id === COMPUTER) return toComputer(event);
    const phone = phones.get(id);
    if (phone) phone.response.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  function broadcast(event, except = "") {
    if (except !== COMPUTER) deliver(COMPUTER, event);
    for (const id of phones.keys()) if (id !== except) deliver(id, event);
  }

  function claim(id) {
    clearTimeout(graceTimer);
    if (session.active === id) return;
    session = { active: id, epoch: session.epoch + 1 };
    lastState = null;
    broadcast(presence());
  }

  /**
   * Newest change wins, by the computer's clock. A change from the future is treated as made now.
   * Without changedAt (a tap on the computer, or a batch from an older phone) the change is always the newest,
   * even if the clock went back.
   */
  function applyLike(songId, liked, changedAt) {
    const song = typeof songId === "string" ? repositories.songs.get(songId) : null;
    if (!song || typeof liked !== "boolean") return null;
    const known = repositories.sync.likeClock?.(songId) || 0;
    const at = changedAt === undefined ? Math.max(now(), known + 1) : Math.min(Number.isFinite(changedAt) && changedAt > 0 ? Math.round(changedAt) : now(), now());
    if (at <= known) return { songId, liked: Boolean(song.liked), changedAt: known, applied: false };
    if (Boolean(song.liked) !== liked) repositories.songs.patch(songId, { liked });
    repositories.sync.setLikeClock?.(songId, at);
    return { songId, liked, changedAt: at, applied: true };
  }

  /** Tells every device about a like that changed, except the one it came from. */
  function announceLike(result, from) {
    if (result?.applied) broadcast({ type: "like", songId: result.songId, liked: result.liked, changedAt: result.changedAt }, from);
  }

  function receive(from, message) {
    if (!message || typeof message !== "object" || !online(from)) return { ok: false, error: "not connected" };
    if (phones.has(from)) phones.get(from).seenAt = now();
    switch (message.type) {
      case "pong":
        return { ok: true };
      case "status":
        return { ok: true, self: from, version: LIVE_VERSION, ...presence() };
      case "like": {
        const result = applyLike(message.songId, message.liked, from === COMPUTER ? undefined : number(message.changedAt));
        if (!result) return { ok: false, error: "song not found" };
        announceLike(result, from);
        return { ok: true, ...result };
      }
      case "claim":
      case "took":
        claim(from);
        return { ok: true, session };
      case "state": {
        if (from !== session.active || number(message.epoch) !== session.epoch) return { ok: false, session };
        lastState = { ...cleanState(message), from };
        broadcast({ type: "state", state: lastState }, from);
        return { ok: true };
      }
      case "command": {
        const command = cleanCommand(message);
        if (!command) return { ok: false, error: "unknown command" };
        if (!session.active || !online(session.active)) return { ok: false, error: "nothing is playing on another device" };
        if (session.active === from) return { ok: false, error: "this device is the player" };
        deliver(session.active, { type: "command", from, ...command });
        return { ok: true };
      }
      case "transfer": {
        const to = text(message.to, 200);
        if (!online(to)) return { ok: false, error: "that device is not connected" };
        if (session.active === to) return { ok: true };
        if (session.active && online(session.active)) deliver(session.active, { type: "give", to, requester: from });
        // Nobody is playing (or the player dropped off): start from the last thing it reported.
        else deliver(to, { type: "take", requester: from, giver: "", handoff: lastState });
        return { ok: true };
      }
      case "handoff": {
        const to = text(message.to, 200);
        if (!online(to) || from !== session.active) return { ok: false, error: "that device is not connected" };
        const handoff = message.handoff && typeof message.handoff === "object" ? cleanState(message.handoff) : null;
        deliver(to, { type: "take", requester: text(message.requester, 200), giver: from, handoff });
        return { ok: true };
      }
      case "take-failed": {
        const event = { type: "take-failed", by: from, message: text(message.message) };
        for (const id of new Set([text(message.giver, 200), text(message.requester, 200)])) if (id && id !== from) deliver(id, event);
        return { ok: true };
      }
      case "notice":
        deliver(text(message.to, 200), { type: "notice", from, message: text(message.message) });
        return { ok: true };
      default:
        return { ok: false, error: "unknown message" };
    }
  }

  function startHeartbeat() {
    if (heartbeat) return;
    // A comment line every so often: keeps Wi-Fi routers from dropping the idle socket and lets the phone notice a dead one.
    // The phone answers each with a pong; without that, a phone that vanished could look connected until TCP gives up.
    heartbeat = setInterval(() => {
      for (const [id, phone] of [...phones]) {
        if (now() - phone.seenAt > heartbeatMs * MISSED_HEARTBEATS) disconnect(id);
        else phone.response.write(": ping\n\n");
      }
    }, heartbeatMs);
    heartbeat.unref?.();
  }

  function dropped(id, response) {
    if (phones.get(id)?.response !== response) return;
    phones.delete(id);
    if (!phones.size) { clearInterval(heartbeat); heartbeat = null; }
    if (session.active === id) {
      clearTimeout(graceTimer);
      graceTimer = setTimeout(() => {
        if (session.active !== id || online(id)) return;
        session = { active: "", epoch: session.epoch + 1 };
        lastState = null;
        broadcast(presence());
      }, graceMs);
      graceTimer.unref?.();
    }
    broadcast(presence());
  }

  /** GET /v1/live: one stream per phone; a newer connection from the same phone replaces the old one. */
  function open(device, request, response) {
    phones.get(device.id)?.response.end();
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    request.socket.setNoDelay?.(true);
    request.socket.setKeepAlive?.(true, 15000);
    phones.set(device.id, { name: device.name, response, seenAt: now() });
    if (session.active === device.id) clearTimeout(graceTimer);
    response.write(`retry: 2000\n\ndata: ${JSON.stringify({ ...presence(), type: "hello", self: device.id, version: LIVE_VERSION })}\n\n`);
    broadcast(presence(), device.id);
    startHeartbeat();
    const close = () => dropped(device.id, response);
    request.on("close", close);
    response.on("close", close);
  }

  function disconnect(id) {
    const phone = phones.get(id);
    if (!phone) return;
    phone.response.end();
    dropped(id, phone.response);
  }

  function closeAll() {
    for (const id of [...phones.keys()]) disconnect(id);
    clearTimeout(graceTimer);
    session = { active: "", epoch: session.epoch + 1 };
    lastState = null;
  }

  return { open, receive, applyLike, announceLike, disconnect, closeAll, presence, get session() { return session; } };
}

module.exports = { createLiveHub, LIVE_VERSION, COMPUTER, ACTIVE_GRACE_MS };
