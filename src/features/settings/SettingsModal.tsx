import "./settings.css";
import type { ReactNode } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import { X } from "lucide-react";
import type { SettingsCategory } from "./settings.types";
import { settingsCategorySpring } from "./settings.constants";

export type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  settingsCategory: SettingsCategory;
  reducedMotion: boolean;
  renderSettingsRail: (scope: string) => ReactNode;
  renderSettingsCategoryContent: () => ReactNode;
};

export default function SettingsModal({
  open,
  onClose,
  settingsCategory,
  reducedMotion,
  renderSettingsRail,
  renderSettingsCategoryContent
}: SettingsModalProps) {
  if (!open) return null;

  return (
    <div className="modalWrap settingsOverlay" onClick={onClose}>
      <div
        className="settingsModal cleanSettingsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settingsTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modalHead cleanSettingsHead">
          <div>
            <p className="eyebrow">settings</p>
            <h3 id="settingsTitle">make localtify feel right</h3>
            <span>clear controls, simple wording, and no messy long scrolling.</span>
          </div>
          <button className="closeModalButton" type="button" onClick={onClose} aria-label="Close settings">
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>
        <div className="settingsLayout settingsModalLayoutV027">
          {renderSettingsRail("modal")}
          <div className="settingsCategoryContent settingsCategoryContentV027">
            <AnimatePresence mode="wait" initial={false}>
              <Motion.div
                key={`settings-modal-${settingsCategory}`}
                className={`settingsCategoryMotion settingsCategoryMotion-${settingsCategory}`}
                data-settings-category={settingsCategory}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={reducedMotion ? { duration: 0.1 } : settingsCategorySpring}
              >
                {renderSettingsCategoryContent()}
              </Motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
