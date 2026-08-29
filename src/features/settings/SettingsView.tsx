import "./settings.css";
import type { ReactNode } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import { settingsCategorySpring } from "./settings.constants";
import type { Settings, SettingsCategory } from "./settings.types";

export type SettingsViewProps = {
  renderSettingsCategoryContent: () => ReactNode;
  renderSettingsRail: (mode: "page" | "modal") => ReactNode;
  settings: Pick<Settings, "reducedMotion">;
  settingsCategory: SettingsCategory;
};

export default function SettingsView(props: SettingsViewProps) {
  const {
    renderSettingsCategoryContent,
    renderSettingsRail,
    settings,
    settingsCategory
  } = props;

  return (
    <section data-page-section="settings" data-page-state="reset" className="settingsPage settingsPageV027">
      <div className="settingsHero panel settingsHeroV027">
        <div>
          <p className="eyebrow">localtify controls</p>
          <h3>settings</h3>
          <p className="softText">Simple settings up front. Diagnostics, repair, and debug-style tools live in Advanced.</p>
        </div>
      </div>

      <div className="settingsLayout settingsPageLayoutV027">
        {renderSettingsRail("page")}
        <div className="settingsCategoryContent settingsCategoryContentV027">
          <AnimatePresence mode="wait" initial={false}>
            <Motion.div
              key={`settings-page-${settingsCategory}`}
              className={`settingsCategoryMotion settingsCategoryMotion-${settingsCategory}`}
              data-settings-category={settingsCategory}
              initial={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={settings.reducedMotion ? { duration: 0.1 } : settingsCategorySpring}
            >
              {renderSettingsCategoryContent()}
            </Motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
