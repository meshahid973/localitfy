import { isAndroidApp } from "../../../app/platform";
import type { Settings } from "../settings.types";
import type { UpdateSetting } from "../settings.shared";
import { ToggleRow } from "../settings.shared";
import type { UpdatePromptState } from "../../updates/update.types";
type Props={
  settings:Settings;updateSetting:UpdateSetting;appVersion:string;
  lastUpdateCheckedLabel:string;updatePrompt:UpdatePromptState;
  manualUpdateCheck:()=>unknown;askUpdaterToDownload:()=>unknown;askUpdaterToInstall:()=>unknown;openUpdateChangelog:()=>unknown;
};
export default function UpdateSettings({settings,updateSetting,appVersion,lastUpdateCheckedLabel,updatePrompt,manualUpdateCheck,askUpdaterToDownload,askUpdaterToInstall,openUpdateChangelog}:Props) {
  const status=updatePrompt.status,hasUpdate=["available","downloading","downloaded"].includes(status);
  return <section className="settingsCategoryPage settingsDeclutterPageV491 settingsUpdatesPage settingsUpdatesCleanV491" aria-label="Update settings">
    <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491"><div><p className="eyebrow">Updates</p><h4>Keep Localtify current</h4></div><span>v{appVersion}</span></div>
    <div className="settingsPanelCard settingsFocusPanelV491"><div className="settingsPanelHeader"><div>
      <strong>{hasUpdate?"Version "+updatePrompt.version+" available":"Installed version "+appVersion}</strong>
      <span>{status==="downloading"?"Downloading update · "+Math.round(updatePrompt.percent)+"%":status==="downloaded"?"Ready to install when you restart":status==="error"?updatePrompt.message:"Last successful check: "+lastUpdateCheckedLabel}</span>
    </div></div>
    <div className="settingsMiniGrid">
      <ToggleRow label="Check automatically" help="Check after startup and periodically while Localtify is open." checked={settings.autoUpdateEnabled} onChange={value=>void updateSetting("autoUpdateEnabled",value)}/>
      {!isAndroidApp()?<ToggleRow label="Notify only" help="On: ask before downloading. Off: download desktop updates automatically, but ask before restarting." checked={settings.autoUpdateNotifyOnly} onChange={value=>void updateSetting("autoUpdateNotifyOnly",value)}/>:<p>Android updates open the verified release APK in the browser and require system installation approval.</p>}
    </div>
    <div className="settingsUpdatesActions">
      <button type="button" className="softButton" onClick={()=>void manualUpdateCheck()}>Check for updates</button>
      <button type="button" className="softButton" onClick={()=>void openUpdateChangelog()}>View changelog</button>
      {status==="available"?<button type="button" className="mainAction" onClick={()=>void askUpdaterToDownload()}>{updatePrompt.manualOnly?(isAndroidApp()?"Open APK download":"Open AppImage download"):"Download update"}</button>:null}
      {status==="downloaded"?<button type="button" className="mainAction" onClick={()=>void askUpdaterToInstall()}>Restart to update</button>:null}
    </div></div>
  </section>;
}
