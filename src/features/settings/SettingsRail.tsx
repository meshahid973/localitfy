import { Search, X } from "lucide-react";
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

const SETTINGS_NAV_GROUPS: ReadonlyArray<{
  label: string;
  ids: ReadonlyArray<SettingsCategory>;
}> = [
  { label: "Listening", ids: ["appearance", "playback", "discord"] },
  { label: "Your collection", ids: ["library", "covers", "downloads"] },
  { label: "Application", ids: ["updates", "experimental", "advanced", "about"] }
];

export default function SettingsRail({
  tabs, activeCategory, search, resultLabel, onSearchChange, onCategoryChange
}: SettingsRailProps) {
  return (
    <aside className="settingsCategoryRail settingsCategoryRailV027 settingsCategoryRailPage" aria-label="Settings navigation">
      <div className="settingsSearchBoxV027">
        <label htmlFor="settings-section-search">Search settings</label>
        <div className="settingsSearchField">
          <Search size={15} strokeWidth={2} aria-hidden="true" />
          <input id="settings-section-search" type="search" value={search}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder="Find a setting..." />
          {search ? <button type="button" className="settingsSearchClear" onClick={() => onSearchChange("")} aria-label="Clear settings search">
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button> : null}
        </div>
      </div>
      {search.trim() ? <p className="settingsSearchHintV027" role="status">{resultLabel}</p> : null}
      <nav aria-label="Settings sections">
        {tabs.length ? SETTINGS_NAV_GROUPS.map((group) => {
          const items = group.ids.flatMap((id) => tabs.filter((tab) => tab.id === id));
          if (!items.length) return null;
          return <div className="settingsNavGroup" key={group.label}>
            <h3 className="settingsNavCaption">{group.label}</h3>
            {items.map((tab) => {
              const Icon = tab.icon;
              const selected = activeCategory === tab.id;
              return <button key={tab.id} className={`settingsCategoryButton ${selected ? "active" : ""}`}
                type="button" onClick={() => onCategoryChange(tab.id)} title={tab.description}
                aria-current={selected ? "page" : undefined}>
                <span className="settingsCategoryIcon" aria-hidden="true">
                  <Icon className="settingsLucideIcon" size={20} strokeWidth={1.9} />
                </span>
                <span className="settingsCategoryCopy"><strong>{tab.label}</strong></span>
              </button>;
            })}
          </div>;
        }) : <p className="settingsNoSearchResultsV027">No matching section. Try another search.</p>}
      </nav>
    </aside>
  );
}
