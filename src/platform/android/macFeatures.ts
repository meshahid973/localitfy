import { computerName } from "../../app/platform";
import { phoneLibrary } from "./library";
import { LocaltifyNative } from "./native";
import { readValue, writeValues } from "./store";

/** After a failed attempt (away from home), answer from the phone's copies for a while instead of waiting on the network. */
const RETRY_AFTER_MS = 60_000;
let unreachableUntil = 0;
let unreachablePair: { url: string; token: string } | null = null;
const samePair = (a: { url: string; token: string } | null, b: { url: string; token: string } | null) => !!a && !!b && a.url === b.url && a.token === b.token;

type MacAnswer<T> = { ok: boolean; result?: T; error?: string };

/**
 * Runs one of the Mac's features (lyrics, daily mixes, similar songs…) through the paired Mac's sync server.
 * Only works on the home network, like sync itself.
 */
export async function callMac<T>(channel: string, payload: unknown, timeoutMs = 5000): Promise<MacAnswer<T>> {
  const pairing = phoneLibrary.pairing;
  if (!pairing || (samePair(unreachablePair, pairing) && Date.now() < unreachableUntil)) return { ok: false };
  const stillPaired = () => samePair(pairing, phoneLibrary.pairing);
  let response: { status: number; body: string };
  try {
    response = await LocaltifyNative.request({
      url: `${pairing.url}/v1/call/${channel}`,
      method: "POST",
      headers: { Authorization: `Bearer ${pairing.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payload: payload ?? null }),
      timeoutMs
    });
  } catch {
    if (stillPaired()) { unreachablePair = pairing; unreachableUntil = Date.now() + RETRY_AFTER_MS; }
    return { ok: false };
  }
  if (!stillPaired()) return { ok: false };
  unreachableUntil = 0;
  unreachablePair = null;
  let body: { result?: T; error?: string } = {};
  try { body = JSON.parse(response.body || "{}"); } catch { /* non-JSON error page */ }
  if (response.status >= 400) return { ok: false, error: body.error || `Your ${computerName()} answered with error ${response.status}` };
  return { ok: true, result: body.result as T };
}

/** A sync that just reached the Mac means it is worth asking again straight away. */
export function markMacReachable() {
  unreachableUntil = 0;
  unreachablePair = null;
}

/** The Mac's answer when it can be reached (kept for offline use), otherwise the last kept answer, otherwise `fallback`. */
export async function fromMacOrKept<T>(channel: string, payload: unknown, key: string, fallback: T, keep: (result: T) => boolean = () => true, timeoutMs?: number): Promise<T> {
  const answer = await callMac<T>(channel, payload, timeoutMs);
  if (answer.ok) {
    const result = answer.result as T;
    if (keep(result)) await writeValues({ [key]: result }).catch(() => undefined);
    return result;
  }
  const kept = await readValue<T | null>(key, null).catch(() => null);
  if (kept) return kept;
  if (answer.error) throw new Error(answer.error);
  return fallback;
}

/** Same as fromMacOrKept for actions that only make sense with the Mac there (searching, choosing a lyrics match). */
export async function fromMac<T>(channel: string, payload: unknown, timeoutMs?: number): Promise<T> {
  const answer = await callMac<T>(channel, payload, timeoutMs);
  if (answer.ok) return answer.result as T;
  throw new Error(answer.error || `Connect to the same Wi-Fi as your ${computerName()} (with Phone sync on) to use this`);
}

// Artwork metadata is public provider information, not a desktop media token.
// Keep one bounded offline registry rather than one IndexedDB key per lookup.
import type { DiscoverResult } from "../../features/discover/discover.types";
type ArtworkQuery = NonNullable<NonNullable<Parameters<Window["localitfy"]["getDiscoveries"]>[0]>["artwork"]>;
type ArtworkRow = { at: number; result: Extract<DiscoverResult, {status:"artwork"}> };
const ARTWORK_KEY = "mac:artwork-index-v1";
const artworkRows = new Map<string,ArtworkRow>();
const artworkPending = new Map<string,Promise<DiscoverResult>>();
let artworkHydration: Promise<void> | undefined;
function hydrateArtwork() {
  return artworkHydration ??= readValue<[string,ArtworkRow][]>(ARTWORK_KEY,[]).then(rows=>{
    if (!Array.isArray(rows)) return;
    for (const pair of rows.slice(-256)) {
      if (!Array.isArray(pair)) continue;
      const [key,row]=pair;
      if (typeof key==="string" && key.length<=2048 && Number.isFinite(row?.at) && row.at> Date.now()-7*86400000 && row.result?.status==="artwork") artworkRows.set(key,row);
    }
  }).catch(()=>{});
}
export async function cachedArtworkFromMac(artwork: ArtworkQuery): Promise<DiscoverResult> {
  if (phoneLibrary.effectiveSettings().discoverEnabled !== true) return {status:"off"};
  const key=JSON.stringify([artwork.kind||"recording",artwork.providerId||"",artwork.title,artwork.artist,artwork.album||"",artwork.durationMs||0,!!artwork.fallback]);
  if (key.length>2048) return {status:"error",error:"Artwork query too long"};
  await hydrateArtwork();
  const row=artworkRows.get(key);
  if (row && Date.now()-row.at<86400000) return row.result;
  const pending=artworkPending.get(key);
  if(pending) return pending;
  if(artworkPending.size>=8) return row?.result ?? {status:"artwork"};
  const job=callMac<DiscoverResult>("discover:get",{artwork},15000).then(async answer=>{
    if(phoneLibrary.effectiveSettings().discoverEnabled!==true) return {status:"off"} as const;
    const result=answer.result;
    if(answer.ok && result?.status==="artwork" && (result.coverUrl || result.fallbackCoverUrl || result.coverAlternatives?.length)) {
      if(JSON.stringify(result).length<=14000) {
        artworkRows.delete(key); artworkRows.set(key,{at:Date.now(),result});
        while(artworkRows.size>256 || JSON.stringify([...artworkRows]).length>512*1024) artworkRows.delete(artworkRows.keys().next().value!);
        await writeValues({[ARTWORK_KEY]:[...artworkRows]}).catch(()=>{});
      }
      return result;
    }
    if(row && Date.now()-row.at<7*86400000) return row.result;
    return result ?? {status:"artwork"} as const;
  }).finally(()=>artworkPending.delete(key));
  artworkPending.set(key,job);
  return job;
}
