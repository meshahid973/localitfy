import type { SettingsCategory } from "./settings.types";
import type { settingsCategoryTabs } from "./settings.constants";

export type SettingsRailProps = {
  tabs: ReadonlyArray<(typeof settingsCategoryTabs)[number]>;
  activeCategory: SettingsCategory;
  search: string;
  resultLabel: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (category: SettingsCategory) => void;
};

export default function SettingsRail({
  tabs, activeCategory, search, resultLabel, onSearchChange, onCategoryChange
}: SettingsRailProps) {
  return (
    <aside className="settingsCategoryRail settingsCategoryRailV027 settingsCategoryRailPage" aria-label="Settings navigation">
      <label className="settingsSearchBoxV027" htmlFor="settings-section-search">
        <span>Search settings</span>
        <input id="settings-section-search" type="search" value={search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder="Theme, audio, downloads..." />
      </label>
      <p className="settingsSearchHintV027" role="status">{resultLabel}</p>
      <nav aria-label="Settings sections">
        {tabs.length ? tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeCategory === tab.id;
          return (
            <button key={tab.id} className={`settingsCategoryButton ${selected ? "active" : ""}`}
              type="button" onClick={() => onCategoryChange(tab.id)}
              aria-current={selected ? "page" : undefined}>
              <span className="settingsCategoryIcon" aria-hidden="true">
                <Icon className="settingsLucideIcon" size={19} strokeWidth={2.05} />
              </span>
              <span className="settingsCategoryCopy"><strong>{tab.label}</strong><span>{tab.description}</span></span>
            </button>
          );
        }) : <p className="settingsNoSearchResultsV027">No matching section. Try another search.</p>}
      </nav>
    </aside>
  );
}
