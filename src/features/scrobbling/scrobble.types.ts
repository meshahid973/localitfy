export type ScrobbleService = "lastfm" | "listenbrainz";
/** `history`: earlier plays from this device that haven't been sent yet. */
type ServiceStatus = { connected: boolean; username: string; waiting: number; history: number };
export type ScrobbleStatus = {
  lastfm: ServiceStatus;
  listenbrainz: ServiceStatus;
  sent: number;
  lastSentAt: number;
  lastError: string;
  connecting: "" | "lastfm";
};
export type ScrobbleAnswer = { ok: boolean; error?: string; status: ScrobbleStatus };
