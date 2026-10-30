import { useEffect, useRef, useState } from "react";
import { ToggleRow } from "../settings.shared";
import type { AnalysisStatus } from "../../analysis/analysis.types";
import type { Settings } from "../settings.types";
import type { Song } from "../../library/song.types";
import NotForMeSettings from "../../analysis/NotForMeSettings";
import TaggingSettings from "../../tagging/TaggingSettings";

const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

type ExperimentalSettingsProps = { settings: Settings; songs: readonly Song[]; updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => unknown };

export default function ExperimentalSettings({ settings, songs, updateSetting }: ExperimentalSettingsProps) {
  const [status, setStatus] = useState<AnalysisStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [clearTarget, setClearTarget] = useState<"history" | "analysis" | null>(null);
  const [lyricsCacheCleared, setLyricsCacheCleared] = useState(false);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  useEffect(() => {
    mounted.current = true;
    let stopped = false;
    let timer: number;
    const poll = async () => {
      const version = requestVersion.current;
      try {
        const next = await window.localitfy.getAnalysisStatus();
        if (!stopped && version === requestVersion.current) { setStatus(next); setError(""); }
      } catch { if (!stopped) setError("Could not load experimental feature status. Please reopen this section."); }
      if (!stopped) timer = window.setTimeout(poll, 1500);
    };
    void poll();
    return () => { stopped = true; mounted.current = false; window.clearTimeout(timer); };
  }, []);

  async function run(action: () => Promise<AnalysisStatus>, success = "") {
    requestVersion.current += 1;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await action();
      if (mounted.current) { setStatus(next); setMessage(success); }
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : "The action failed. Please try again.");
    } finally { requestVersion.current += 1; if (mounted.current) setBusy(false); }
  }

  if (!status) return <section className="settingsCategoryPage" aria-label="Experimental features"><h4>Experimental features</h4><p role="status">{error || "Loading experimental features…"}</p></section>;
  const downloading = status.download.state === "downloading";
  const ready = status.download.state === "ready";
  const active = status.running || status.scanning;
  const batteryBlocked = status.onBattery && !status.allowOnBattery;

  return <section className="settingsCategoryPage settingsDeclutterPageV491" aria-label="Experimental features">
    <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491"><div><p className="eyebrow">experimental</p><h4>music analysis</h4></div><span>Local processing · early access</span></div>
    <div className="settingsPanelCard settingsFocusPanelV491">
      <div className="settingsPanelHeader"><div><strong>Audio similarity analysis</strong><span>Analyze your tracks, then choose Similar songs from a song’s menu to find audio matches. Results may vary. Your music and analysis stay on this device.</span></div></div>
      <fieldset disabled={busy || !status.supported} className="experimentalControls">
        <ToggleRow label="Enable music analysis" help="Off by default. Enabling does not download a model or start scanning your library." checked={status.enabled} onChange={(value) => void run(async () => {
          const status = await window.localitfy.setAnalysisEnabled(value);
          await updateSetting("experimentalMusicAnalysis", value);
          return status;
        })} />
      </fieldset>
      {!status.supported ? <p>Music analysis currently requires Apple silicon on macOS. Listening history is available on this device.</p> : null}
      <p>{status.model.name} · {megabytes(status.model.bytes)} download and installed model files</p>
      <p>License: {status.model.license}. CPU inference uses a bundled runtime and may use several hundred MB of memory while analyzing.</p>
      <div className="settingsActionRow settingsActionRowCleanV491">
        <button type="button" className="settingsActionButton" onClick={() => void window.localitfy.openExternal(status.model.source)}>Model source</button>
        <button type="button" className="settingsActionButton" onClick={() => void window.localitfy.openExternal(status.model.licenseUrl)}>License and model details</button>
        {!ready && !downloading ? <button type="button" className="settingsActionButton settingsPrimaryAction" disabled={busy || !status.enabled || !status.supported} onClick={() => void run(() => window.localitfy.downloadAnalysisModel())}>Download model · {megabytes(status.model.bytes)}</button> : null}
        {downloading ? <button type="button" className="settingsActionButton" disabled={busy} onClick={() => void run(() => window.localitfy.cancelAnalysisDownload())}>Cancel download</button> : null}
        {ready ? <button type="button" className="settingsActionButton" disabled={busy} onClick={() => void run(() => window.localitfy.removeAnalysisModel(), "Model removed. Saved analysis is retained.")}>Remove model</button> : null}
      </div>
      <div role="status" aria-live="polite">
        {downloading ? <><p>Downloading {megabytes(status.download.downloadedBytes)} / {megabytes(status.download.totalBytes)}</p><progress aria-label="Model download" value={status.download.downloadedBytes} max={status.download.totalBytes} /></> : <p>{ready ? "Model installed and verified. Works offline." : "Model not installed."}</p>}
      </div>
      {status.download.error ? <p role="alert">{status.download.error}</p> : null}
    </div>
    <div className="settingsPanelCard settingsFocusPanelV491">
      <div className="settingsPanelHeader"><div><strong>Library analysis</strong><span>Samples the beginning, middle and end of each track. Runs in a background worker, one song at a time. Battery use is off by default.</span></div></div>
      <fieldset disabled={busy || !status.supported} className="experimentalControls"><ToggleRow label="Allow analysis on battery power" help="Uses more battery. Turning this off while on battery pauses analysis. Enabling allows you to start or resume analysis manually." checked={status.allowOnBattery} onChange={(value) => void run(() => window.localitfy.setAnalysisOnBattery(value))} /></fieldset>
      <p role="status">{status.scanning ? "Checking library files…" : status.running ? `Analyzing · ${status.queued} tracks remaining` : status.paused ? "Analysis paused" : "Analysis finished"} · {status.analyzed} saved · {status.failures} failed</p>
      {batteryBlocked ? <p>Analysis is paused while using battery power. Connect to power or enable battery analysis.</p> : null}
      <div className="settingsActionRow settingsActionRowCleanV491">
        <button type="button" className="settingsActionButton settingsPrimaryAction" disabled={busy || !status.supported || !status.enabled || !ready || active || batteryBlocked} onClick={() => void run(() => window.localitfy.startAnalysis())}>Analyze new or changed tracks</button>
        <button type="button" className="settingsActionButton" disabled={busy || !active} onClick={() => void run(() => window.localitfy.pauseAnalysis())}>Pause analysis</button>
        <button type="button" className="settingsActionButton" disabled={busy || !status.supported || !status.enabled || !ready || active || batteryBlocked || !status.failures} onClick={() => void run(() => window.localitfy.startAnalysis({ retry: true }))}>Retry failed tracks</button>
        <button type="button" className="settingsActionButton" disabled={busy || !status.analyzed && !status.failures} onClick={() => setClearTarget("analysis")}>Clear saved analysis</button>
      </div>
      {status.error ? <p role="alert">{status.error}</p> : null}
    </div>
    <div className="settingsPanelCard settingsFocusPanelV491">
      <div className="settingsPanelHeader"><div><strong>Local listening history</strong><span>Listening time and playback outcomes can help future recommendations. Stored only in your local library database.</span></div></div>
      <fieldset disabled={busy} className="experimentalControls"><ToggleRow label="Save listening history" help="Turning this off stops new history writes. Existing history stays until cleared." checked={status.historyEnabled} onChange={(value) => void run(() => window.localitfy.setListeningHistoryEnabled(value))} /></fieldset>
      <div className="settingsActionRow settingsActionRowCleanV491"><button type="button" className="settingsActionButton" disabled={busy} onClick={() => setClearTarget("history")}>Clear listening history</button></div>
    </div>
    {status.enabled || settings.discoverEnabled ? <NotForMeSettings settings={settings} songs={songs} updateSetting={updateSetting} /> : null}
    <div className="settingsPanelCard settingsFocusPanelV491">
      <div className="settingsPanelHeader"><div><strong>Lyrics</strong><span>Shows time-synced lyrics for the playing song. Open them with the microphone button in the player. A matching .lrc file next to a song is always used first.</span></div></div>
      <fieldset className="experimentalControls">
        <ToggleRow label="Show lyrics" help="Off by default. Adds the lyrics button to the player." checked={settings.lyricsEnabled === true} onChange={(value) => void updateSetting("lyricsEnabled", value)} />
        <ToggleRow label="Look up lyrics online" help="Sends the song title, artist, album and length to LRCLIB (lrclib.net), a free community lyrics database. Results are cached on this device." checked={settings.lyricsOnlineLookup !== false} onChange={(value) => void updateSetting("lyricsOnlineLookup", value)} />
      </fieldset>
      <div className="settingsActionRow settingsActionRowCleanV491">
        <button type="button" className="settingsActionButton" onClick={() => void window.localitfy.openExternal("https://lrclib.net")}>About LRCLIB</button>
        <button type="button" className="settingsActionButton" disabled={lyricsCacheCleared} onClick={() => void window.localitfy.clearLyricsCache().then(() => { if (mounted.current) setLyricsCacheCleared(true); })}>{lyricsCacheCleared ? "Lyrics cache cleared" : "Clear lyrics cache"}</button>
      </div>
    </div>
    <TaggingSettings settings={settings} songs={songs} updateSetting={updateSetting} />
    {clearTarget ? <div className="settingsPanelCard" role="group" aria-label="Confirm clearing data"><p>Clear {clearTarget === "history" ? "listening history" : "saved analysis"}? Your music, playlists and existing play counts are kept. Database backups may retain earlier data.</p><div className="settingsActionRow"><button type="button" className="settingsActionButton" disabled={busy} onClick={() => { const target = clearTarget; setClearTarget(null); void run(() => target === "history" ? window.localitfy.clearListeningHistory() : window.localitfy.clearAnalysis(), target === "history" ? "History cleared. Recording resumes with the next playback session." : "Saved analysis cleared."); }}>Clear data</button><button type="button" className="settingsActionButton" onClick={() => setClearTarget(null)}>Keep data</button></div></div> : null}
    {message ? <p role="status">{message}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
