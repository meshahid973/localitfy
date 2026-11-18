import { Check } from "lucide-react";
import SidebarTabsSettings from "./SidebarTabsSettings";
import { isAndroidApp } from "../../../app/platform";
import type { Settings } from "../settings.types";
import { ToggleRow } from "../settings.shared";
import type { ChoiceOption, UpdateSetting } from "../settings.shared";
import { normalizeThemeId } from "../theme.utils";

export type AppearanceSettingsProps = {
  settings: Settings;
  updateSetting: UpdateSetting;
  coverColorSyncOptions: ReadonlyArray<ChoiceOption>;
  selectedCoverColorSyncMode: string;
  updateCoverColorSyncMode: (value: string) => void | Promise<void>;
  openAdvanced: () => void;
};

export default function AppearanceSettings(props: AppearanceSettingsProps) {
  const { settings, updateSetting } = props;
  const phone = isAndroidApp();
  const selected = normalizeThemeId(settings.theme);
  return (
    <section className="settingsCategoryPage settingsAppearanceCleanV491" aria-label="Appearance settings">
      <header className="settingsCategoryHeader">
        <div><h4>Appearance</h4></div>
        <button type="button" className="settingsTinyButton" onClick={props.openAdvanced}>Display options</button>
      </header>
      <div className="settingsPanelCard">
        <div className="settingsPanelHeader"><div><strong>Theme</strong><span>Choose the appearance of Localtify.</span></div></div>
        <div className="settingsModeGrid" role="group" aria-label="App theme">
          {(["light", "dark"] as const).map(mode => (
            <button key={mode} type="button" className="settingsModeButton" aria-pressed={selected === mode}
              onClick={() => void updateSetting("theme", mode)}>
              <span className="settingsModePreview" data-preview-mode={mode} aria-hidden="true">
                <span className="settingsModePreviewNav"><i/><i/><i/></span>
                <span className="settingsModePreviewBody"><i/><span><i/><i/><i/></span><i/></span>
                {selected === mode ? <span className="settingsModeCheck"><Check size={14}/></span> : null}
              </span>
              <strong>{mode === "light" ? "Light" : "Dark"}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="settingsPanelCard settingsCoverTintCard">
        <div className="settingsPanelHeader"><div><strong>Artwork ambience</strong><span>Use the current cover as a blurred background throughout Localtify.</span></div></div>
        <div className="settingsChoiceRowV491" role="group" aria-label="Live cover color strength">
          {props.coverColorSyncOptions.map((option) => {
            const active = props.selectedCoverColorSyncMode === option.id;
            return <button key={option.id} type="button"
              className={`settingsChoicePillV491 ${active ? "active" : ""}`}
              aria-pressed={active} onClick={() => void props.updateCoverColorSyncMode(option.id)}>
              <strong>{option.label || option.name || option.id}</strong>
            </button>;
          })}
        </div>
      </div>

      <div className="settingsPanelCard settingsLayoutControls">
        <div className="settingsPanelHeader">
          <div><strong>Layout & motion</strong><span>Customize how the app feels across all screens.</span></div>
        </div>
        <div className="settingsMiniGrid">
          {phone ? null : <ToggleRow label="Compact player" help="Use a smaller bottom playback bar." checked={settings.compactPlayer} onChange={(value) => void updateSetting("compactPlayer", value)} />}
          <ToggleRow label="Compact library" help="Fit more songs into each list." checked={settings.denseList} onChange={(value) => void updateSetting("denseList", value)} />
          <ToggleRow label="Reduce motion" help="Limit animation and transitions." checked={settings.reducedMotion} onChange={(value) => void updateSetting("reducedMotion", value)} />
          <ToggleRow label="Rounded corners" help="Use softer corners on cards and buttons." checked={settings.softCorners} onChange={(value) => void updateSetting("softCorners", value)} />
          <ToggleRow label="Animated glow" help="Show ambient player lighting." checked={settings.animatedGlow} onChange={(value) => void updateSetting("animatedGlow", value)} />
          {phone ? null : <ToggleRow label="Cat buddy" help="Show a little cat that follows the cursor." checked={settings.catBuddyEnabled === true} onChange={(value) => void updateSetting("catBuddyEnabled", value)} />}
          {phone ? null : <ToggleRow label="Idle screensaver" help={`Show the "am waiting.." screen after 5 minutes without playback.`} checked={settings.idleScreensaverEnabled !== false} onChange={(value) => void updateSetting("idleScreensaverEnabled", value)} />}
        </div>
      </div>

      {!phone ? <div className="settingsPanelCard">
        <div className="settingsPanelHeader"><div><strong>Sidebar layout</strong><span>Choose icons only, full labels, or expand on hover.</span></div></div>
        <div className="settingsChoiceRowV491" role="group" aria-label="Sidebar layout">
          {([["slim", "Collapsed"], ["fixed", "Expanded"], ["hover", "On hover"]] as const).map(([mode, label]) => (
            <button key={mode} type="button" className={`settingsChoicePillV491 ${settings.sidebarBehavior === mode ? "active" : ""}`}
              aria-pressed={settings.sidebarBehavior === mode} onClick={() => void updateSetting("sidebarBehavior", mode)}>
              <strong>{label}</strong>
            </button>
          ))}
        </div>
      </div> : null}

      <details className="settingsDisclosure settingsSidebarDisclosure">
        <summary>{phone ? <>Tabs <span>Choose the pages at the bottom</span></> : <>Sidebar arrangement <span>Reorder or hide sections</span></>}</summary>
        <div className="settingsDisclosureBody"><SidebarTabsSettings settings={settings} updateSetting={updateSetting} /></div>
      </details>
    </section>
  );
}
