import type { LiveConnectionStatus, LiveEvent, LiveMessage, LivePresence, LiveReply } from "../../features/connect/connect.types";
import { phoneLibrary } from "./library";
import { LocaltifyNative } from "./native";

/** With nothing playing on either device, the connection closes this long after the app leaves the screen. */
const BACKGROUND_GRACE_MS = 60 * 1000;
const SEND_TIMEOUT_MS = 5000;

type Listener = (event: LiveEvent) => void;

const listeners = new Set<Listener>();
let status: LiveConnectionStatus = "off";
let presence: (LivePresence & { self: string }) | null = null;
let remotePlaying = false;
let backgroundTimer = 0;

function emit(event: LiveEvent) {
  for (const listener of listeners) listener(event);
}

function setStatus(next: LiveConnectionStatus) {
  if (next !== "connected") presence = null;
  if (status === next) return;
  status = next;
  emit({ type: "connection", status });
}

export const getLiveStatus = () => status;

export function onLiveEvent(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Applies a like the Mac confirmed or passed on, then tells the open app (usePlaybackConnect) if it changed. */
function adoptLike(songId: string, liked: boolean, changedAt: number) {
  if (phoneLibrary.adoptMacLike(songId, liked, changedAt)) emit({ type: "like", songId, liked, changedAt });
}

function receive(data: string) {
  let event: LiveEvent;
  try { event = JSON.parse(data) as LiveEvent; } catch { return; }
  if (event.type === "hello" || event.type === "presence") {
    phoneLibrary.clockOffset = event.serverTime - Date.now();
    presence = { ...event, self: event.self || presence?.self || "" };
    if (event.type === "hello") {
      setStatus("connected");
      void phoneLibrary.save(["clockOffset"]);
    }
    emit({ ...event, self: presence.self });
    return;
  }
  if (event.type === "like") {
    adoptLike(event.songId, event.liked, event.changedAt);
    return;
  }
  emit(event);
}

async function post(message: LiveMessage): Promise<LiveReply> {
  const pairing = phoneLibrary.pairing;
  if (!pairing) return { ok: false, error: "" };
  try {
    const response = await LocaltifyNative.request({
      url: `${pairing.url}/v1/live`, method: "POST", timeoutMs: SEND_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${pairing.token}` }, body: JSON.stringify(message)
    });
    return JSON.parse(response.body || "{}") as LiveReply;
  } catch {
    return { ok: false, error: "" };
  }
}

/** Messages to the Mac. Without a connection they fail at once; likes still reach it with the next batch sync. */
export async function sendLive(message: LiveMessage): Promise<LiveReply> {
  if (message.type === "status") return presence ? { ok: true, ...presence } : { ok: false, error: status };
  return status === "connected" ? post(message) : { ok: false, error: "" };
}

/** A like tapped on this phone, sent at once; the Mac answers with the like it kept (the newest tap wins). */
export async function sendLike(songId: string, liked: boolean) {
  const changedAt = phoneLibrary.likeClock[songId];
  if (!changedAt) return;
  const reply = await sendLive({ type: "like", songId, liked, changedAt });
  if (reply.ok && typeof reply.liked === "boolean" && typeof reply.changedAt === "number") adoptLike(songId, reply.liked, reply.changedAt);
}

async function refreshPresence() {
  const pairing = phoneLibrary.pairing;
  const reply = await post({ type: "status" });
  if (presence || status !== "connecting" || !pairing ||
      pairing.token !== phoneLibrary.pairing?.token || pairing.url !== phoneLibrary.pairing?.url) return;
  if (reply.ok && typeof reply.serverTime === "number") receive(JSON.stringify({ ...reply, type: "hello" }));
}

function connect() {
  window.clearTimeout(backgroundTimer);
  const pairing = phoneLibrary.pairing;
  if (!pairing || status === "unsupported") return;
  if (status === "off" || status === "offline") setStatus("connecting");
  // The native stream can survive a WebView reload, so its original hello may
  // predate these listeners. Recover presence even when no new stream opens.
  void LocaltifyNative.liveConnect({ url: pairing.url, token: pairing.token })
    .then(() => { if (!presence) void refreshPresence(); })
    .catch(() => setStatus("offline"));
}

function disconnect() {
  window.clearTimeout(backgroundTimer);
  void LocaltifyNative.liveDisconnect().catch(() => undefined);
  setStatus("off");
}

/** Keeps the connection while something plays on either device; otherwise lets it go a minute after the app hides. */
function followVisibility() {
  window.clearTimeout(backgroundTimer);
  if (document.visibilityState === "visible") return connect();
  backgroundTimer = window.setTimeout(() => {
    if (document.visibilityState === "visible") return;
    if (navigator.mediaSession.playbackState === "playing" || remotePlaying) return followVisibility();
    disconnect();
  }, BACKGROUND_GRACE_MS);
}

/** Starts the live connection with the paired Mac; the native side reconnects after sleep and network changes. */
export function installLiveConnection() {
  void LocaltifyNative.addListener("liveEvent", ({ data }) => receive(data));
  void LocaltifyNative.addListener("liveStatus", ({ status: next }) => {
    // "unpaired": the Mac forgot this phone. Batch sync reports that properly; live just stops.
    setStatus(next === "connected" ? (presence ? "connected" : "connecting") : next === "unpaired" ? "off" : next);
    // The stream's first event says who this phone is; ask as well, so a hello that went missing doesn't leave it waiting.
    if (next === "connected" && !presence) void refreshPresence();
  });
  window.addEventListener("localtifyremotemedia", (event) => {
    remotePlaying = Boolean((event as CustomEvent<{ playing?: boolean } | null>).detail?.playing);
  });
  document.addEventListener("visibilitychange", followVisibility);
  followVisibility();
}

/** After pairing, unpairing, or a sync that found a Mac with the live connection. */
export function restartLiveConnection() {
  if (status === "unsupported") status = "off";
  if (phoneLibrary.pairing) connect();
  else disconnect();
}
