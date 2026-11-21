import type { PlatformInfoLike, SongLike } from "../settings.shared";
export default function AboutSettings({appVersion,platformInfo,songs,onViewChangelog}:{appVersion:string;platformInfo:Required<PlatformInfoLike>;songs:ReadonlyArray<SongLike>;onViewChangelog?:()=>unknown}) {
  return <section className="settingsCategoryPage settingsDeclutterPageV491 settingsAboutCleanV491" aria-label="About localtify">
    <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491"><div><p className="eyebrow">About</p><h4>Localtify</h4></div><span>version {appVersion}</span></div>
    <div className="settingsPanelCard settingsFocusPanelV491 settingsAboutCardV491"><div className="settingsPanelHeader"><div><strong>Local-first music</strong><span>Diagnostics and debug version details are under Advanced.</span></div></div>
      <div className="settingsMiniStatusV491"><span><strong>{appVersion}</strong><small>Version</small></span><span><strong>{platformInfo.label}</strong><small>Platform</small></span><span><strong>{songs.length}</strong><small>Songs</small></span></div>
      {onViewChangelog?<button type="button" className="softButton" onClick={()=>void onViewChangelog()}>View what's new</button>:null}
    </div>
  </section>;
}
