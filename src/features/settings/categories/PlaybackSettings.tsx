import type { Settings } from "../settings.types";
import type { UpdateSetting } from "../settings.shared";
import { RangeRow, ToggleRow } from "../settings.shared";

export default function PlaybackSettings({ settings, updateSetting }: { settings: Settings; updateSetting: UpdateSetting }) {
  return <section className="settingsCategoryPage settingsDeclutterPageV491 settingsPlaybackCleanV491" aria-label="Playback settings">
    <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491"><div><p className="eyebrow">playback</p><h4>useful playback controls</h4></div><span>only the settings that change listening</span></div>
    <div className="settingsTwoColumn settingsTwoColumnCleanV491">
      <div className="settingsPanelCard settingsFocusPanelV491"><div className="settingsPanelHeader"><div><strong>Transitions</strong><span>Simple switching between tracks.</span></div></div><RangeRow label="Crossfade" value={settings.crossfadeSeconds} min={0} max={10} step={1} suffix="s" onChange={(value) => void updateSetting("crossfadeSeconds", value)} /><ToggleRow label="Crossfade enabled" help="Turns crossfade on or off." checked={settings.crossfadeEnabled} onChange={(value) => void updateSetting("crossfadeEnabled", value)} /><ToggleRow label="Gapless playback" help="Starts the next song without silence." checked={settings.gaplessPlayback} onChange={(value) => void updateSetting("gaplessPlayback", value)} /></div>
      <div className="settingsPanelCard settingsFocusPanelV491"><div className="settingsPanelHeader"><div><strong>Listening</strong><span>Keep the player predictable.</span></div></div><RangeRow label="Playback speed" value={settings.playbackSpeed} min={0.75} max={1.5} step={0.05} suffix="x" onChange={(value) => void updateSetting("playbackSpeed", value)} /><ToggleRow label="Volume normalization" help="Balances loud and quiet files." checked={settings.volumeNormalization} onChange={(value) => void updateSetting("volumeNormalization", value)} /><ToggleRow label="Remember position" help="Restores progress for long tracks." checked={settings.rememberPlaybackPosition} onChange={(value) => void updateSetting("rememberPlaybackPosition", value)} /><ToggleRow label="Compact player" help="Keeps the bottom player smaller." checked={settings.compactPlayer} onChange={(value) => void updateSetting("compactPlayer", value)} /></div>
    </div>
  </section>;
}
