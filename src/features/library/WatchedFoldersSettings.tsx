import { useCallback, useEffect, useState } from "react";
import { FolderPlus, RefreshCw, X } from "lucide-react";
import type { Settings } from "../settings/settings.types";
import "./watched-folders.css";

type WatchedFolderStatus = Awaited<ReturnType<typeof window.localitfy.getWatchedFolderStatus>>;
type WatchedFoldersSettingsProps = {
  settings: Pick<Settings, "watchedFolders">;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => unknown;
};

const folderKey = (folder: string) => folder.replace(/[\\/]+$/, "").toLowerCase();
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
function ago(time: number) {
  const minutes = Math.floor((Date.now() - time) / 60_000);
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`;
}

/** Folders whose new music is added to the library automatically. */
export default function WatchedFoldersSettings({ settings, updateSetting }: WatchedFoldersSettingsProps) {
  const folders = Array.isArray(settings.watchedFolders) ? settings.watchedFolders : [];
  const [status, setStatus] = useState<WatchedFolderStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(() => { void window.localitfy.getWatchedFolderStatus().then(setStatus).catch(() => undefined); }, []);
  useEffect(() => {
    refresh();
    const stop = window.localitfy.onWatchedFoldersChange(refresh);
    // A newly added folder gets its first check in the background; keep the status line current meanwhile.
    const timer = window.setInterval(refresh, 3000);
    return () => { stop(); window.clearInterval(timer); };
  }, [refresh]);

  async function addFolder() {
    const picked = await window.localitfy.chooseWatchedFolder();
    if (picked.canceled || !picked.folder) return;
    if (folders.some((folder) => folderKey(folder) === folderKey(picked.folder))) { setMessage("That folder is already watched."); return; }
    setMessage("");
    await updateSetting("watchedFolders", [...folders, picked.folder]);
    refresh();
  }

  async function checkNow() {
    setChecking(true); setMessage("");
    try {
      const result = await window.localitfy.checkWatchedFolders();
      setStatus(result);
      setMessage(result.importedCount ? `Added ${plural(result.importedCount, "new song")}.` : "No new songs found.");
    } catch { setMessage("Could not check the folders. Please retry."); }
    finally { setChecking(false); }
  }

  const byFolder = new Map((status?.folders || []).map((entry) => [folderKey(entry.folder), entry]));
  return <div className="settingsPanelCard settingsFocusPanelV491">
    <div className="settingsPanelHeader"><div><strong>Watched folders</strong><span>New songs in these folders are added to your library while localtify is open, and on launch for anything added while it was closed. Songs already in your library are skipped, and deleted files show as missing.</span></div></div>
    {folders.length ? <ul className="watchedFolderList" aria-label="Watched folders">
      {folders.map((folder) => {
        const entry = byFolder.get(folderKey(folder));
        const state = !entry ? "starting…" : entry.error ? entry.error : !entry.checkedAt ? "checking…" : `watching · checked ${ago(entry.checkedAt)}`;
        return <li key={folder} className={entry?.error ? "watchedFolderError" : ""}>
          <span><strong>{folder.split(/[\\/]/).filter(Boolean).pop() || folder}</strong><small title={folder}>{folder}</small><small>{state}</small></span>
          <button type="button" className="settingsTinyButton" aria-label={`Stop watching ${folder}`}
            onClick={() => void updateSetting("watchedFolders", folders.filter((item) => item !== folder))}><X size={13} /></button>
        </li>;
      })}
    </ul> : <p>No folders watched yet. Add the folders where you keep or download music.</p>}
    <div className="settingsActionRow settingsActionRowCleanV491">
      <button type="button" className="settingsActionButton settingsPrimaryAction" disabled={folders.length >= 20} onClick={() => void addFolder()}><FolderPlus size={14} /> Add folder</button>
      {folders.length ? <button type="button" className="settingsActionButton" disabled={checking || status?.scanning} onClick={() => void checkNow()}>
        <RefreshCw size={14} /> {checking || status?.scanning ? "Checking…" : "Check now"}</button> : null}
    </div>
    <p className="settingsHintText" role="status" aria-live="polite">{message || (status?.lastImport ? `Last added ${plural(status.lastImport.count, "song")} ${ago(status.lastImport.at)}.` : "")}</p>
  </div>;
}
