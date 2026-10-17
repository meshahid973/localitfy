import "./settings.css";
import "./settings-premium.css";
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import { settingsCategorySpring } from "./settings.constants";
import SettingsRail from "./SettingsRail";
import type { SettingsRailProps } from "./SettingsRail";
import type { Settings, SettingsCategory } from "./settings.types";

export type SettingsViewProps = {
  renderSettingsCategoryContent: () => ReactNode;
  settingsRail: SettingsRailProps;
  settings: Pick<Settings, "reducedMotion">;
  settingsCategory: SettingsCategory;
};

export default function SettingsView({
  renderSettingsCategoryContent, settingsRail, settings, settingsCategory
}: SettingsViewProps) {
  return (
    <section data-page-section="settings" className="settingsPage settingsPageV027">
      <header className="settingsPageIntro">
        <div className="settingsIntroIdentity">
          <span className="settingsIntroMark" aria-hidden="true"><SlidersHorizontal size={18} strokeWidth={1.9} /></span>
          <div className="settingsIntroTitle">
            <h1>Settings</h1>
            <p>Personalize your listening.</p>
          </div>
        </div>
        <span className="settingsIntroCurrent" aria-label="Current settings section">
          {settingsRail.tabs.find((tab) => tab.id === settingsCategory)?.label ?? "Settings"}
        </span>
      </header>
      <div className="settingsLayout settingsPageLayoutV027">
        <SettingsRail {...settingsRail} />
        <div className="settingsCategoryContent settingsCategoryContentV027">
          <AnimatePresence mode="wait" initial={false}>
            <Motion.div key={settingsCategory}
              className={`settingsCategoryMotion settingsCategoryMotion-${settingsCategory}`}
              data-settings-category={settingsCategory}
              initial={settings.reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={settings.reducedMotion ? { duration: 0 } : settingsCategorySpring}>
              {renderSettingsCategoryContent()}
            </Motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
