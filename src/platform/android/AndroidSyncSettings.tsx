import { useEffect, useState } from "react";
import { RefreshCw, Smartphone } from "lucide-react";
import { phoneLibrary } from "./library";
import { forgetMac, getSyncProgress, isSyncing, onSyncProgress, pairWithMac, syncNow, type SyncProgress } from "./sync";
import "../../features/sync/phone-sync.css";

function formatBytes(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.max(0, Math.round(bytes / 1e6))} MB`;
}

function ago(time: number) {
  const minutes = Math.floor((Date.now() - time) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.floor(hours / 24)} days ago`;
}

/** Phone side of sync: pair with the Mac once, then sync on demand (and automatically on launch). */
export default function AndroidSyncSettings() {
  const [progress, setProgress] = useState<SyncProgress>(getSyncProgress);
  const [paired, setPaired] = useState(Boolean(phoneLibrary.pairing));
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => onSyncProgress(setProgress), []);

  async function pair() {
    setBusy(true); setMessage("");
    try {
      await pairWithMac(address, code);
      setPaired(true); setCode("");
      void syncNow();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Pairing failed"); }
    finally { setBusy(false); }
  }

  const syncing = isSyncing() && progress.phase !== "done" && progress.phase !== "error";
  const last = phoneLibrary.lastSync;
  const transfer = progress.phase === "downloading" && progress.total
    ? `${progress.done + 1} of ${progress.total} · ${formatBytes(progress.bytesTotal - progress.bytesDone)} left`
    : "";

  return <div className="settingsPanelCard settingsFocusPanelV491">
    <div className="settingsPanelHeader"><div><strong>Sync with Mac</strong><span>Copies your whole library from the localtify Mac app over home Wi-Fi and keeps likes, playlists and play counts the same on both. Turn on Phone sync in the Mac app's Settings → Library first.</span></div></div>
    {paired ? <>
      <p className="settingsHintText">Paired with <strong>{phoneLibrary.pairing?.name}</strong> · {phoneLibrary.pairing?.url.replace(/^https?:\/\//, "")}</p>
      <div className="settingsActionRow settingsActionRowCleanV491">
        <button type="button" className="settingsActionButton settingsPrimaryAction" disabled={syncing} onClick={() => void syncNow()}>
          <RefreshCw size={14} /> {syncing ? "Syncing…" : "Sync now"}</button>
        <button type="button" className="settingsActionButton settingsGhostAction" disabled={syncing}
          onClick={() => void forgetMac().then(() => { setPaired(false); setMessage(""); })
            .catch((error) => setMessage(error instanceof Error ? error.message : "Could not unpair"))}>Unpair</button>
      </div>
      <p className="settingsHintText" role="status" aria-live="polite">
        {syncing ? [progress.message, transfer].filter(Boolean).join(" · ") : last ? `${last.message} · ${ago(last.at)}` : "Not synced yet."}
      </p>
      {syncing && progress.phase === "downloading" ? <p className="settingsHintText">Keep the app open until the first sync finishes.</p> : null}
    </> : <form className="phoneSyncPairForm" onSubmit={(event) => { event.preventDefault(); void pair(); }}>
      <label><span>Mac address</span><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="192.168.1.20" inputMode="url" autoCapitalize="off" autoCorrect="off" /></label>
      <label><span>Pairing code</span><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digits" inputMode="numeric" /></label>
      <button type="submit" className="settingsActionButton settingsPrimaryAction" disabled={busy || !address.trim() || code.length !== 6}><Smartphone size={14} /> {busy ? "Pairing…" : "Pair"}</button>
      <p className="settingsHintText">The Mac shows its address and a code under Settings → Library → Phone sync → Pair a phone.</p>
    </form>}
    {message ? <p className="settingsHintText phoneSyncError" role="alert">{message}</p> : null}
  </div>;
}
