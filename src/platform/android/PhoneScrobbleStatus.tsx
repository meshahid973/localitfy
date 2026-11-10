import { useEffect, useState } from "react";
import type { ScrobbleService, ScrobbleStatus } from "../../features/scrobbling/scrobble.types";
import { phoneLibrary } from "./library";
import { onSyncProgress } from "./sync";
import "../../features/scrobbling/scrobbling.css";

const SERVICES: Array<[ScrobbleService, string]> = [["lastfm", "Last.fm"], ["listenbrainz", "ListenBrainz"]];
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Phone side of scrobbling: the Mac holds the accounts and sends the phone's plays once they sync. Read-only here. */
export default function PhoneScrobbleStatus() {
  const [status, setStatus] = useState<ScrobbleStatus | null>(null);
  const [unsynced, setUnsynced] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setUnsynced(phoneLibrary.pendingEvents.filter((event) => event.outcome !== "active").length);
      void window.localitfy.getScrobbleStatus().then(setStatus).catch(() => undefined);
    };
    refresh();
    return onSyncProgress((next) => { if (next.phase === "done") refresh(); });
  }, []);

  return <div className="settingsPanelCard settingsFocusPanelV491">
    <div className="settingsPanelHeader"><div><strong>Scrobbling</strong><span>Your Mac sends plays from this phone to Last.fm or ListenBrainz each time the two sync. Connect accounts in the Mac app's Settings → Playback.</span></div></div>
    {SERVICES.map(([service, name]) => (
      <div className="scrobbleService" key={service}>
        <div className="scrobbleServiceHead"><strong>{name}</strong>
          <span>{status?.[service].connected ? <>Connected as <b>{status[service].username}</b> on your Mac</> : "Not connected on your Mac"}</span></div>
      </div>
    ))}
    <p className="settingsHintText" role="status">
      {unsynced ? `${plural(unsynced, "play")} on this phone ${unsynced === 1 ? "goes" : "go"} to your Mac at the next sync.` : "Every play on this phone has reached your Mac."}
      {status?.lastfm.connected ? " Last.fm only takes plays from the last 14 days, so sync at least every two weeks." : ""}
    </p>
  </div>;
}
