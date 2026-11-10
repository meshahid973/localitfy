import { computerName } from "../../app/platform";
import { phoneLibrary } from "./library";
import { LocaltifyNative } from "./native";
import { readValue, writeValues } from "./store";

/** After a failed attempt (away from home), answer from the phone's copies for a while instead of waiting on the network. */
const RETRY_AFTER_MS = 60_000;
let unreachableUntil = 0;

type MacAnswer<T> = { ok: boolean; result?: T; error?: string };

/**
 * Runs one of the Mac's features (lyrics, daily mixes, similar songs…) through the paired Mac's sync server.
 * Only works on the home network, like sync itself.
 */
export async function callMac<T>(channel: string, payload: unknown, timeoutMs = 5000): Promise<MacAnswer<T>> {
  const pairing = phoneLibrary.pairing;
  if (!pairing || Date.now() < unreachableUntil) return { ok: false };
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
    unreachableUntil = Date.now() + RETRY_AFTER_MS;
    return { ok: false };
  }
  unreachableUntil = 0;
  let body: { result?: T; error?: string } = {};
  try { body = JSON.parse(response.body || "{}"); } catch { /* non-JSON error page */ }
  if (response.status >= 400) return { ok: false, error: body.error || `Your ${computerName()} answered with error ${response.status}` };
  return { ok: true, result: body.result as T };
}

/** A sync that just reached the Mac means it is worth asking again straight away. */
export function markMacReachable() {
  unreachableUntil = 0;
}

/** The Mac's answer when it can be reached (kept for offline use), otherwise the last kept answer, otherwise `fallback`. */
export async function fromMacOrKept<T>(channel: string, payload: unknown, key: string, fallback: T, keep: (result: T) => boolean = () => true): Promise<T> {
  const answer = await callMac<T>(channel, payload);
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
