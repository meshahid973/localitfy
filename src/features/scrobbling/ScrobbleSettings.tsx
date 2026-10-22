import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { ScrobbleAnswer, ScrobbleService, ScrobbleStatus } from "./scrobble.types";
import "./scrobbling.css";

const openLink = (url: string) => { void window.localitfy.openExternal?.(url); };
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const HEX32 = /^[0-9a-f]{32}$/i;

type ScrobbleSettingsProps = { lastfmApiKey: string; saveLastfmApiKey: (key: string) => unknown };

/** Connect Last.fm and/or ListenBrainz. Secrets go straight to the main process and are never shown again. */
export default function ScrobbleSettings({ lastfmApiKey, saveLastfmApiKey }: ScrobbleSettingsProps) {
  const [status, setStatus] = useState<ScrobbleStatus | null>(null);
  // Starts from the Discover key; a key and secret from a new API account replace it for both.
  const [apiKey, setApiKey] = useState(lastfmApiKey || "");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<"" | ScrobbleService | "send" | `history-${ScrobbleService}`>("");
  const [error, setError] = useState("");

  const refresh = useCallback(() => { void window.localitfy.getScrobbleStatus().then(setStatus).catch(() => undefined); }, []);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function run(kind: typeof busy, task: () => Promise<ScrobbleAnswer>) {
    setBusy(kind); setError("");
    try {
      const answer = await task();
      setStatus(answer.status);
      if (!answer.ok) setError(answer.error || "Something went wrong.");
      return answer.ok;
    } finally { setBusy(""); }
  }
  async function connectLastfm() {
    const key = apiKey.trim();
    if (!await run("lastfm", () => window.localitfy.connectLastfmScrobbling({ apiKey: key, sharedSecret: secret }))) return;
    setSecret("");
    if (key !== lastfmApiKey) saveLastfmApiKey(key);
  }

  const disconnect = async (service: ScrobbleService) => setStatus(await window.localitfy.disconnectScrobbling(service));
  if (!status) return null;
  const waiting = status.lastfm.waiting + status.listenbrainz.waiting;
  const history = (service: ScrobbleService) => status[service].history ? <div className="scrobbleRow">
    <span className="settingsHintText">{plural(status[service].history, "earlier play")} from this device {status[service].history === 1 ? "hasn’t" : "haven’t"} been sent{service === "lastfm" ? " (Last.fm only takes the last 14 days)" : ""}.</span>
    <button type="button" className="settingsActionButton" disabled={busy === `history-${service}`}
      onClick={() => void run(`history-${service}`, () => window.localitfy.sendScrobbleHistory(service))}>{busy === `history-${service}` ? "Sending…" : "Send history"}</button>
  </div> : null;

  return <div className="settingsPanelCard settingsFocusPanelV491">
    <div className="settingsPanelHeader"><div><strong>Scrobbling</strong><span>Share what you play with Last.fm or ListenBrainz for stats, charts and recommendations across apps. A song counts once you’ve heard half of it or 4 minutes; songs under 30 seconds don’t count.</span></div></div>

    <div className="scrobbleService">
      <div className="scrobbleServiceHead"><strong>Last.fm</strong>
        {status.lastfm.connected ? <span>Connected as <b>{status.lastfm.username}</b></span> : null}</div>
      {status.lastfm.connected ? (
        <>{history("lastfm")}<button type="button" className="settingsActionButton" onClick={() => void disconnect("lastfm")}>Disconnect</button></>
      ) : status.connecting === "lastfm" || busy === "lastfm" ? (
        <div className="scrobbleRow"><span role="status">Approve localtify on the Last.fm page that just opened in your browser…</span>
          <button type="button" className="settingsActionButton" onClick={() => void window.localitfy.cancelScrobbleConnect().then(setStatus)}>Cancel</button></div>
      ) : (
        <div className="scrobbleRow">
          <input className="scrobbleInput" value={apiKey} onChange={(event) => setApiKey(event.currentTarget.value)} placeholder="API key"
            aria-label="Last.fm API key" spellCheck={false} autoComplete="off" />
          <input className="scrobbleInput" value={secret} onChange={(event) => setSecret(event.currentTarget.value)} placeholder="Shared secret"
            aria-label="Last.fm shared secret" spellCheck={false} autoComplete="off" type="password" />
          <button type="button" className="settingsActionButton settingsPrimaryAction" disabled={!HEX32.test(apiKey.trim()) || !HEX32.test(secret.trim())}
            onClick={() => void connectLastfm()}>Connect</button>
          <button type="button" className="scrobbleLink" onClick={() => openLink("https://www.last.fm/api/account/create")}>New API account <ExternalLink size={12} /></button>
        </div>
      )}
      {!status.lastfm.connected ? <small>Use the API key and shared secret from the same Last.fm API account. Last.fm only shows the shared secret once, when you create the account; if you didn’t save it, create a new one. Its key also replaces the one Discover uses. Connecting opens Last.fm so you can approve this app.</small> : null}
    </div>

    <div className="scrobbleService">
      <div className="scrobbleServiceHead"><strong>ListenBrainz</strong>
        {status.listenbrainz.connected ? <span>Connected as <b>{status.listenbrainz.username}</b></span> : null}</div>
      {status.listenbrainz.connected ? (
        <>{history("listenbrainz")}<button type="button" className="settingsActionButton" onClick={() => void disconnect("listenbrainz")}>Disconnect</button></>
      ) : (
        <div className="scrobbleRow">
          <input className="scrobbleInput" value={token} onChange={(event) => setToken(event.currentTarget.value)} placeholder="User token"
            aria-label="ListenBrainz user token" spellCheck={false} autoComplete="off" type="password" />
          <button type="button" className="settingsActionButton settingsPrimaryAction" disabled={!token.trim() || busy === "listenbrainz"}
            onClick={() => void run("listenbrainz", () => window.localitfy.connectListenbrainz({ token })).then(() => setToken(""))}>Connect</button>
          <button type="button" className="scrobbleLink" onClick={() => openLink("https://listenbrainz.org/settings/")}>Find it <ExternalLink size={12} /></button>
        </div>
      )}
    </div>

    {status.lastfm.connected || status.listenbrainz.connected ? <div className="scrobbleRow">
      <span className="settingsHintText" role="status">{waiting ? `${plural(waiting, "scrobble")} waiting to send` : `${plural(status.sent, "scrobble")} sent`}</span>
      {waiting ? <button type="button" className="settingsActionButton" disabled={busy === "send"} onClick={() => void run("send", () => window.localitfy.sendScrobblesNow())}>Send now</button> : null}
    </div> : null}
    {error || status.lastError ? <p role="alert">{error || status.lastError}</p> : null}
  </div>;
}
