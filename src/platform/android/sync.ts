import type { Settings } from "../../features/settings/settings.types";
import { LocaltifyNative } from "./native";
import { fileKey, phoneLibrary, type RemoteSong } from "./library";
import { fromMacOrKept, markMacReachable } from "./macFeatures";
import { EDITABLE_SONG_FIELDS, phonePlaylistChanges, phoneSongChanges, type SyncPlaylist, type SyncSongFields } from "./syncMerge";

export const SYNC_PORT = 47836;
const STALE_PLAY_MS = 6 * 60 * 60 * 1000;

export type SyncProgress = {
  phase: "idle" | "connecting" | "merging" | "downloading" | "cleaning" | "done" | "error";
  message: string;
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
};

type Snapshot = { protocol: number; serverTime: number; features?: Partial<Settings>; songs: RemoteSong[]; playlists: SyncPlaylist[]; listeningCounts: Array<[string, number, number]> };

const listeners = new Set<(progress: SyncProgress) => void>();
let progress: SyncProgress = { phase: "idle", message: "", done: 0, total: 0, bytesDone: 0, bytesTotal: 0 };
let running: Promise<void> | null = null;
let onLibraryChanged: () => void = () => {};
let onFeaturesChanged: () => void = () => {};

function report(next: Partial<SyncProgress>) {
  progress = { ...progress, ...next };
  for (const listener of listeners) listener(progress);
}

export const getSyncProgress = () => progress;
export function onSyncProgress(listener: (next: SyncProgress) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setLibraryChangedHandler(handler: () => void) {
  onLibraryChanged = handler;
}
export function setFeaturesChangedHandler(handler: () => void) {
  onFeaturesChanged = handler;
}

/** The Mac decides which of its features (lyrics, analysis, discover) are on; the phone offers the same. */
function adoptMacFeatures(features: Partial<Settings> = {}) {
  const changed = JSON.stringify(phoneLibrary.macFeatures) !== JSON.stringify(features);
  phoneLibrary.macFeatures = features;
  return changed;
}

/** "192.168.1.20" or "192.168.1.20:47836" or a full URL → base URL of the Mac's sync server. */
export function normalizeMacAddress(input: string) {
  const text = input.trim().replace(/\/+$/, "");
  if (!text) return "";
  const withScheme = /^https?:\/\//i.test(text) ? text : `http://${text}`;
  try {
    const url = new URL(withScheme);
    if (!url.port) url.port = String(SYNC_PORT);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

async function call<T>(path: string, options: { method?: string; body?: unknown; token?: string; base?: string } = {}): Promise<T> {
  const base = options.base || phoneLibrary.pairing?.url;
  if (!base) throw new Error("This phone is not paired with a Mac yet");
  const token = options.token ?? phoneLibrary.pairing?.token;
  let response: { status: number; body: string };
  try {
    response = await LocaltifyNative.request({
      url: `${base}${path}`,
      method: options.method || "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      timeoutMs: 60000
    });
  } catch {
    throw new Error("Could not reach the Mac. Check that both are on the same Wi-Fi and Phone sync is on in the Mac app");
  }
  let parsed: unknown = {};
  try { parsed = response.body ? JSON.parse(response.body) : {}; } catch { /* non-JSON error page */ }
  if (response.status >= 400) throw new Error((parsed as { error?: string })?.error || `The Mac answered with error ${response.status}`);
  return parsed as T;
}

export async function pairWithMac(address: string, code: string) {
  const base = normalizeMacAddress(address);
  if (!base) throw new Error("Enter the Mac's address, for example 192.168.1.20");
  const hello = await call<{ app?: string; name?: string }>("/v1/hello", { base, token: "" });
  if (hello.app !== "localtify") throw new Error("That address is not a localtify Mac");
  const result = await call<{ token: string; name: string }>("/v1/pair", { base, token: "", method: "POST", body: { code: code.trim(), deviceName: phoneLibrary.paths.deviceName } });
  phoneLibrary.pairing = { url: base, token: result.token, name: result.name || hello.name || "Mac" };
  await phoneLibrary.save(["pairing"]);
}

export async function forgetMac() {
  phoneLibrary.pairing = null;
  await phoneLibrary.save(["pairing"]);
}

const baseFields = (song: SyncSongFields): SyncSongFields => {
  const fields: SyncSongFields = { id: song.id, playCount: song.playCount, lastPlayed: song.lastPlayed ?? null };
  for (const field of EDITABLE_SONG_FIELDS) if (song[field] !== undefined) (fields as Record<string, unknown>)[field] = song[field];
  return fields;
};

/** Phone state that a sync must not lose: if it changes while the Mac is applying our edits, merge again. */
const phoneFingerprint = () => `${phoneLibrary.revision}:${phoneLibrary.pendingEvents.length}`;

let featuresChanged = false;

async function exchangeEdits() {
  for (let round = 0; round < 3; round += 1) {
    report({ phase: "connecting", message: `Connecting to ${phoneLibrary.pairing?.name || "your Mac"}…` });
    const before = await call<Snapshot>("/v1/snapshot");
    report({ phase: "merging", message: "Merging changes…" });
    const fingerprint = phoneFingerprint();
    const base = new Map(Object.entries(phoneLibrary.base.songs));
    const songs = phoneSongChanges(base, phoneLibrary.phoneSongFields());
    const playlists = phonePlaylistChanges(phoneLibrary.base.playlists, before.playlists, phoneLibrary.playlists);
    // Unfinished plays go too: the Mac updates them when they end. One cut short by the app being killed never ends.
    const playEvents = phoneLibrary.pendingEvents;
    const hasChanges = Object.keys(songs).length || playlists.put.length || playlists.delete.length || playEvents.length;
    if (hasChanges) await call("/v1/changes", { method: "POST", body: { songs, playlists, playEvents } });
    const after = hasChanges ? await call<Snapshot>("/v1/snapshot") : before;
    if (phoneFingerprint() !== fingerprint) continue;

    // Adopt the Mac's merged result. Local-only fields (resume position and the like) stay.
    const sent = new Set(playEvents.filter((event) => event.outcome !== "active" || event.updatedAt < Date.now() - STALE_PLAY_MS)
      .map((event) => `${event.id}:${event.updatedAt}`));
    phoneLibrary.pendingEvents = phoneLibrary.pendingEvents.filter((event) => !sent.has(`${event.id}:${event.updatedAt}`));
    const synced = new Set<string>([...EDITABLE_SONG_FIELDS, "playCount", "lastPlayed"]);
    phoneLibrary.edits = Object.fromEntries(Object.entries(phoneLibrary.edits).flatMap(([id, edit]) => {
      const rest = Object.fromEntries(Object.entries(edit).filter(([key]) => !synced.has(key)));
      return Object.keys(rest).length ? [[id, rest]] : [];
    }));
    phoneLibrary.remoteSongs = after.songs;
    phoneLibrary.playlists = after.playlists;
    phoneLibrary.listeningCounts = after.listeningCounts;
    featuresChanged = adoptMacFeatures(after.features) || featuresChanged;
    phoneLibrary.base = { songs: Object.fromEntries(after.songs.map((song) => [song.id, baseFields(song)])), playlists: after.playlists };
    await phoneLibrary.save(["remoteSongs", "playlists", "listeningCounts", "base", "edits", "pendingEvents", "macFeatures"]);
    onLibraryChanged();
    return;
  }
  throw new Error("The library kept changing during sync. Try again");
}

const PARALLEL_DOWNLOADS = 4;

async function syncFiles() {
  const songs = phoneLibrary.remoteSongs;
  // Covers follow the Mac's: a new or changed cover is copied, one the Mac no longer has is removed.
  const wanted = songs.filter((song) => phoneLibrary.files[song.id]?.audio !== fileKey(song.file) ||
    (song.cover ? phoneLibrary.files[song.id]?.cover !== fileKey(song.cover) : Boolean(phoneLibrary.files[song.id]?.cover)));
  const bytesTotal = wanted.reduce((sum, song) => sum + (phoneLibrary.files[song.id]?.audio === fileKey(song.file) ? 0 : song.file.size), 0);
  let bytesDone = 0;
  let done = 0;
  const inFlight = new Map<string, number>();
  const headers = { Authorization: `Bearer ${phoneLibrary.pairing?.token || ""}` };
  const base = phoneLibrary.pairing?.url || "";
  const reportBytes = () => {
    let partial = 0;
    for (const received of inFlight.values()) partial += received;
    report({ bytesDone: bytesDone + partial });
  };
  const progressListener = await LocaltifyNative.addListener("downloadProgress", ({ id, received }) => {
    if (!inFlight.has(id)) return;
    inFlight.set(id, received);
    reportBytes();
  });

  const copySong = async (song: RemoteSong) => {
    const local = { ...phoneLibrary.files[song.id] };
    if (local.audio !== fileKey(song.file)) {
      inFlight.set(song.id, 0);
      try {
        await LocaltifyNative.downloadFile({ id: song.id, url: `${base}/v1/audio/${encodeURIComponent(song.id)}`, path: phoneLibrary.audioPath(song.id, song.file.ext), headers });
      } finally {
        inFlight.delete(song.id);
      }
      if (local.audioExt && local.audioExt !== song.file.ext) await LocaltifyNative.deleteFile({ path: phoneLibrary.audioPath(song.id, local.audioExt) }).catch(() => undefined);
      Object.assign(local, { audio: fileKey(song.file), audioExt: song.file.ext });
      bytesDone += song.file.size;
    }
    if (song.cover && local.cover !== fileKey(song.cover)) {
      await LocaltifyNative.downloadFile({ id: `${song.id}:cover`, url: `${base}/v1/cover/${encodeURIComponent(song.id)}`, path: phoneLibrary.coverPath(song.id, song.cover.ext), headers });
      if (local.coverExt && local.coverExt !== song.cover.ext) await LocaltifyNative.deleteFile({ path: phoneLibrary.coverPath(song.id, local.coverExt) }).catch(() => undefined);
      Object.assign(local, { cover: fileKey(song.cover), coverExt: song.cover.ext });
    } else if (!song.cover && local.cover) {
      if (local.coverExt) await LocaltifyNative.deleteFile({ path: phoneLibrary.coverPath(song.id, local.coverExt) }).catch(() => undefined);
      delete local.cover;
      delete local.coverExt;
    }
    phoneLibrary.files[song.id] = local;
    done += 1;
    report({ phase: "downloading", message: `Copied ${song.title || "song"}`, done, total: wanted.length });
    reportBytes();
    // Save as we go so an interrupted first sync resumes where it stopped.
    if (done % 10 === 0 || done === wanted.length) {
      await phoneLibrary.save(["files"]);
      onLibraryChanged();
    }
  };

  report({ phase: "downloading", message: "Copying songs…", done: 0, total: wanted.length, bytesDone: 0, bytesTotal });
  let next = 0;
  let failed: unknown = null;
  const worker = async () => {
    while (next < wanted.length && !failed) {
      const song = wanted[next];
      next += 1;
      try {
        await copySong(song);
      } catch (error) {
        failed ??= error;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_DOWNLOADS, wanted.length) }, worker));
    if (failed) {
      // Keep what the other workers finished, then report the first failure.
      await phoneLibrary.save(["files"]).catch(() => undefined);
      onLibraryChanged();
      throw failed;
    }
  } finally {
    await progressListener.remove();
  }
  return wanted.length;
}

/** Songs removed on the Mac are removed from the phone too, along with their files. */
async function removeDeletedSongs() {
  const keep = new Set(phoneLibrary.remoteSongs.map((song) => song.id));
  let removed = 0;
  for (const [id, local] of Object.entries(phoneLibrary.files)) {
    if (keep.has(id)) continue;
    report({ phase: "cleaning", message: "Removing songs deleted on the Mac…" });
    if (local.audioExt) await LocaltifyNative.deleteFile({ path: phoneLibrary.audioPath(id, local.audioExt) }).catch(() => undefined);
    if (local.coverExt) await LocaltifyNative.deleteFile({ path: phoneLibrary.coverPath(id, local.coverExt) }).catch(() => undefined);
    delete phoneLibrary.files[id];
    removed += 1;
  }
  if (removed) await phoneLibrary.save(["files"]);
  return removed;
}

export function syncNow() {
  running ??= (async () => {
    await LocaltifyNative.setSyncActive({ active: true }).catch(() => undefined);
    try {
      featuresChanged = false;
      await exchangeEdits();
      markMacReachable();
      // Today's mixes are made on the Mac; keep a copy so they are there away from home too.
      await fromMacOrKept("analysis:daily-mixes", {}, "mac:daily-mixes", null).catch(() => undefined);
      const copied = await syncFiles();
      const removed = await removeDeletedSongs();
      const parts = [`${phoneLibrary.remoteSongs.length} songs`];
      if (copied) parts.push(`${copied} copied`);
      if (removed) parts.push(`${removed} removed`);
      phoneLibrary.lastSync = { at: Date.now(), ok: true, message: `Synced · ${parts.join(" · ")}` };
      report({ phase: "done", message: phoneLibrary.lastSync.message, done: 0, total: 0 });
      onLibraryChanged();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      phoneLibrary.lastSync = { at: Date.now(), ok: false, message };
      report({ phase: "error", message });
    } finally {
      await phoneLibrary.save(["lastSync"]).catch(() => undefined);
      await LocaltifyNative.setSyncActive({ active: false }).catch(() => undefined);
      running = null;
    }
    if (featuresChanged) onFeaturesChanged();
  })();
  return running;
}

export const isSyncing = () => Boolean(running);
