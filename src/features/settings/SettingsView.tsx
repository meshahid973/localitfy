import "./settings.css";
import "./settings-premium.css";
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import SettingsRail from "./SettingsRail";
import type { SettingsRailProps } from "./SettingsRail";
import type { SettingsCategory } from "./settings.types";

export type SettingsViewProps = {
  renderSettingsCategoryContent: () => ReactNode;
  settingsRail: SettingsRailProps;
  settingsCategory: SettingsCategory;
};

export default function SettingsView({
  renderSettingsCategoryContent, settingsRail, settingsCategory
}: SettingsViewProps) {
  return (
    <section data-page-section="settings" className="settingsPage settingsPageV027">
      <header className="settingsPageIntro">
        <div className="settingsIntroIdentity">
          <span className="settingsIntroMark" aria-hidden="true"><SlidersHorizontal size={18} strokeWidth={1.9} /></span>
          <div className="settingsIntroTitle">
            <h1>Settings</h1>
            <p>Your player, your preferences.</p>
          </div>
        </div>
        <span className="settingsIntroCurrent" aria-label="Current settings section">
          {settingsRail.tabs.find((tab) => tab.id === settingsCategory)?.label ?? "Settings"}
        </span>
      </header>
      <div className="settingsLayout settingsPageLayoutV027">
        <SettingsRail {...settingsRail} />
        <div className="settingsCategoryContent settingsCategoryContentV027">
          <div key={settingsCategory} className={`settingsCategoryMotion settingsCategoryMotion-${settingsCategory}`}
            data-settings-category={settingsCategory}>
            {renderSettingsCategoryContent()}
          </div>
        </div>
      </div>
    </section>
  );
}
