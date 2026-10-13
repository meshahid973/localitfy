import type { SettingsCategory } from "./settings.types";
import { settingsCategoryTabs } from "./settings.constants";

export function normalizeSettingsSearch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function settingsTabMatchesSearch(tab: (typeof settingsCategoryTabs)[number], value: string) {
  const query = normalizeSettingsSearch(value);
  if (!query) return true;
  const haystack = `${tab.id} ${tab.label} ${tab.description} ${tab.keywords}`.toLowerCase();
  return query.split(" ").every((part) => haystack.includes(part));
}

export function resolveSettingsCategoryFromSearch(value: string): SettingsCategory | null {
  const query = normalizeSettingsSearch(value);
  if (!query) return null;
  const exactMatch = settingsCategoryTabs.find((tab) => tab.id === query || tab.label.toLowerCase() === query);
  if (exactMatch) return exactMatch.id;
  return settingsCategoryTabs.find((tab) => settingsTabMatchesSearch(tab, query))?.id ?? null;
}
