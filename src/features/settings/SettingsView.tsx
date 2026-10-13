import "./settings.css";
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
    <section data-page-section="settings" data-page-state="reset" className="settingsPage settingsPageV027">
      <header className="settingsPageHeader">
        <div><p className="eyebrow">preferences</p><h2>Settings</h2>
          <p>Choose how Localtify looks and plays your music.</p></div>
      </header>
      <div className="settingsLayout settingsPageLayoutV027">
        <SettingsRail {...settingsRail} />
        <div className="settingsCategoryContent settingsCategoryContentV027">
          <AnimatePresence mode="wait" initial={false}>
            <Motion.div key={settingsCategory}
              className={`settingsCategoryMotion settingsCategoryMotion-${settingsCategory}`}
              data-settings-category={settingsCategory}
              initial={settings.reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={settings.reducedMotion ? { duration: 0 } : settingsCategorySpring}>
              {renderSettingsCategoryContent()}
            </Motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
