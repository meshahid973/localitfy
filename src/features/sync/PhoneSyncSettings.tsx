import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import "../library/watched-folders.css";
import "./phone-sync.css";

type PhoneSyncStatus = Awaited<ReturnType<typeof window.localitfy.getPhoneSyncStatus>>;

function ago(time: number) {
  if (!time) return "never synced";
  const minutes = Math.floor((Date.now() - time) / 60_000);
  if (minutes < 1) return "synced just now";
  if (minutes < 60) return `synced ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `synced ${hours} h ago` : `synced ${Math.floor(hours / 24)} days ago`;
}

/** Mac side of phone sync: turn the home-network server on, show a pairing code, manage paired phones. */
export default function PhoneSyncSettings() {
  const [status, setStatus] = useState<PhoneSyncStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.localitfy.getPhoneSyncStatus().then(setStatus).catch(() => undefined);
    return window.localitfy.onPhoneSyncStatus(setStatus);
  }, []);

  async function run(action: () => Promise<PhoneSyncStatus>) {
    setBusy(true);
    try { setStatus(await action()); } catch { /* the status line keeps the last known state */ }
    finally { setBusy(false); }
  }

  const address = status?.addresses[0] ? `${status.addresses[0]}:${status.port}` : "";
  return <div className="settingsPanelCard settingsFocusPanelV491">
    <div className="settingsPanelHeader"><div><strong>Phone sync</strong><span>Keeps the localtify Android app in step with this Mac over your home Wi-Fi: songs, covers, likes, playlists and play counts, in both directions. Nothing leaves your network.</span></div></div>
    <div className="settingsActionRow settingsActionRowCleanV491">
      <button type="button" className={`settingsActionButton ${status?.enabled ? "" : "settingsPrimaryAction"}`} disabled={busy || !status}
        onClick={() => void run(() => window.localitfy.setPhoneSyncEnabled(!status?.enabled))}>{status?.enabled ? "Turn off" : "Turn on"}</button>
      {status?.enabled ? <button type="button" className="settingsActionButton settingsPrimaryAction" disabled={busy}
        onClick={() => void run(window.localitfy.newPhoneSyncCode)}><Smartphone size={14} /> Pair a phone</button> : null}
    </div>
    {status?.error ? <p className="settingsHintText phoneSyncError" role="alert">{status.error}</p> : null}
    {status?.pairing ? <div className="phoneSyncPairing" role="status">
      <span>In the phone app, open Settings → Library → Sync with Mac and enter</span>
      <strong className="phoneSyncCode">{status.pairing.code}</strong>
      <small>{status.name}{address ? ` · ${address}` : ""} · code expires in 10 minutes</small>
    </div> : status?.enabled && status.running ? <p className="settingsHintText">On · {status.name}{address ? ` · ${address}` : ""}</p> : null}
    {status?.devices.length ? <ul className="watchedFolderList" aria-label="Paired phones">
      {status.devices.map((device) => <li key={device.id}>
        <span><strong>{device.name}</strong><small>{ago(device.lastSyncAt)}</small></span>
        <button type="button" className="settingsTinyButton" aria-label={`Forget ${device.name}`}
          onClick={() => void run(() => window.localitfy.forgetPhoneSyncDevice(device.id))}><X size={13} /></button>
      </li>)}
    </ul> : null}
  </div>;
}
