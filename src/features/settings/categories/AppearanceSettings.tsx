import { useEffect, useMemo, useState } from "react";
import SidebarTabsSettings from "./SidebarTabsSettings";
import type { Settings } from "../settings.types";
import type { ThemeId } from "../theme.types";
import type { ChoiceOption, CustomThemePresetOption, CustomThemeTokenOption, ThemeOption, UpdateSetting } from "../settings.shared";

const COMPLETE_HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const cleanDraft = (value: string) => `#${String(value || "").trim().replace(/[^#0-9a-fA-F]/g, "").replace(/#/g, "")}`.slice(0, 7);
const complete = (value: string) => COMPLETE_HEX_COLOR_RE.test(String(value || "").trim());

export type AppearanceSettingsProps = {
  currentTheme: { name: string; note?: string };
  settings: Settings;
  updateSetting: UpdateSetting;
  visibleThemes: ReadonlyArray<ThemeOption>;
  themeSwatchColors: Record<string, string>;
  effectiveTheme: string;
  resetCustomThemePalette: () => void;
  saveCurrentCustomThemePreset: () => void;
  customThemeName: string;
  setCustomThemeName: (value: string) => void;
  builtInCustomThemePresets: ReadonlyArray<CustomThemePresetOption>;
  savedCustomThemes: ReadonlyArray<CustomThemePresetOption>;
  removeSavedCustomThemePreset: (id: string) => void;
  applyCustomThemePreset: (preset: CustomThemePresetOption) => void;
  customThemeTokens: ReadonlyArray<CustomThemeTokenOption>;
  commitCustomThemeHexDraft: (key: string, value: string, fallback: string) => void;
  previewCustomThemeColor?: (key: string, value: string, fallback: string) => void;
  coverColorSyncOptions: ReadonlyArray<ChoiceOption>;
  selectedCoverColorSyncMode: string;
  updateCoverColorSyncMode: (value: string) => void | Promise<void>;
  openAdvanced: () => void;
};

export default function AppearanceSettings(props: AppearanceSettingsProps) {
  const { settings, updateSetting, customThemeTokens } = props;
  const signature = useMemo(() => customThemeTokens.map((token) => `${token.key}:${token.value}`).join("|"), [customThemeTokens]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    customThemeTokens.forEach((token) => { next[token.key] = token.value; });
    setDrafts(next);
  }, [signature, customThemeTokens]);

  function setDraft(key: string, value: string, fallback?: string) {
    const draft = cleanDraft(value);
    setDrafts((old) => ({ ...old, [key]: draft }));
    if (fallback && complete(draft)) props.previewCustomThemeColor?.(key, draft, fallback);
  }
  function applyDraft(key: string, value: string, fallback: string) {
    const draft = cleanDraft(value);
    const safe = complete(draft) ? draft : fallback;
    setDrafts((old) => ({ ...old, [key]: safe }));
    props.commitCustomThemeHexDraft(key, safe, fallback);
  }


  return (
    <section className="settingsCategoryPage settingsAppearanceCleanV491" aria-label="Appearance settings">
      <header className="settingsCategoryHeader">
        <div><p className="eyebrow">Appearance</p><h4>Make it yours</h4></div>
        <button type="button" className="settingsTinyButton" onClick={props.openAdvanced}>Display options</button>
      </header>

      <div className="settingsAppearanceTopGrid">
        <div className="settingsPanelCard settingsAppearanceThemeCard">
          <div className="settingsPanelHeader"><div><strong>App theme</strong><span>Applied across Home, Library and Liked songs.</span></div></div>
          <label className="settingsSelectField">
            <span>Theme preset</span>
            <select value={settings.theme} disabled={settings.customThemeEnabled}
              onChange={(event) => void updateSetting("theme", event.currentTarget.value as ThemeId)}
              aria-label="Choose theme">
              {props.visibleThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
            </select>
          </label>
          <div className="settingsThemeSelectedPreview" aria-live="polite">
            <span className="settingsThemeDot" style={{ background: props.themeSwatchColors[props.effectiveTheme] ?? props.themeSwatchColors.mint }} aria-hidden="true" />
            <div><strong>{settings.customThemeEnabled ? "Custom palette" : props.currentTheme.name}</strong>
              <small>{settings.customThemeEnabled ? "Turn off custom colors to change the preset" : props.currentTheme.note}</small></div>
          </div>
        </div>

        <div className="settingsPanelCard settingsAppearancePaletteCard">
          <div className="settingsPanelHeader">
            <div><strong>Custom colors</strong><span>Use your own palette instead of a preset.</span></div>
            <label className="settingsCompactSwitch">
              <span>{settings.customThemeEnabled ? "On" : "Off"}</span>
              <input type="checkbox" checked={settings.customThemeEnabled}
                onChange={(event) => void updateSetting("customThemeEnabled", event.currentTarget.checked)}
                aria-label="Enable custom colors" />
            </label>
          </div>
          <div className="customThemePresetRowV027" aria-label="Custom color presets">
            {props.builtInCustomThemePresets.slice(0, 4).map((preset) => (
              <button key={preset.name} className="customThemePresetButtonV027" type="button" onClick={() => props.applyCustomThemePreset(preset)}>
                <span style={{ background: preset.colors.customThemeColor }} aria-hidden="true" />
                <strong>{preset.name}</strong>
              </button>
            ))}
          </div>
          <details className="settingsDisclosure settingsPaletteEditor">
            <summary>Edit palette <span>Advanced</span></summary>
            <div className="settingsDisclosureBody">
              <div className="settingsPaletteSaveRow">
                <label className="settingsTextFieldV027"><span>Palette name</span>
                  <input value={props.customThemeName} onChange={(event) => props.setCustomThemeName(event.currentTarget.value)} aria-label="Custom colors name" />
                </label>
                <button className="settingsTinyButton" type="button" onClick={props.saveCurrentCustomThemePreset}>Save palette</button>
                <button className="settingsTinyButton" type="button" onClick={props.resetCustomThemePalette}>Reset colors</button>
              </div>
              <div className="customThemeTokenGridV027">{customThemeTokens.map((token) => {
                const draft = drafts[token.key] ?? token.value;
                const preview = complete(draft) ? draft : token.value;
                return (
                  <div className="customThemeTokenV027" key={token.key}>
                    <label className="customThemeColorPickerV032" title={`Pick ${token.label.toLowerCase()} color`}>
                      <span className="customThemeColorPreviewV027" style={{ background: preview }} aria-hidden="true" />
                      <input className="customThemeNativeColorInputV027" type="color" value={preview}
                        onInput={(event) => { if (complete(event.currentTarget.value)) setDraft(token.key, event.currentTarget.value, token.value); }}
                        onChange={(event) => applyDraft(token.key, event.currentTarget.value, token.value)}
                        aria-label={`${token.label} color picker`} />
                    </label>
                    <strong>{token.label}</strong>
                    <input className="customThemeHexInputV032" type="text" spellCheck={false} autoCapitalize="off"
                      maxLength={7} value={draft}
                      onChange={(event) => setDraft(token.key, event.currentTarget.value, token.value)}
                      onBlur={(event) => applyDraft(token.key, event.currentTarget.value, token.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(token.key, token.value); event.currentTarget.blur(); } }}
                      aria-label={`${token.label} hex color code`} />
                  </div>
                );
              })}</div>
              {props.savedCustomThemes.length > 0 ? (
                <details className="settingsSavedThemes">
                  <summary>Saved palettes ({props.savedCustomThemes.length})</summary>
                  <div className="settingsSavedThemesList">{props.savedCustomThemes.map((preset) => (
                    <div className="settingsSavedTheme" key={preset.id}>
                      <button type="button" onClick={() => props.applyCustomThemePreset(preset)}>
                        <span className="settingsThemeDot" style={{ background: preset.colors.customThemeColor }} aria-hidden="true" />
                        <span>{preset.name}</span>
                      </button>
                      <button type="button" className="settingsTinyButton" onClick={() => props.removeSavedCustomThemePreset(preset.id)}
                        aria-label={`Remove ${preset.name}`}>Remove</button>
                    </div>
                  ))}</div>
                </details>
              ) : null}
            </div>
          </details>
        </div>
      </div>

      <div className="settingsPanelCard settingsCoverTintCard">
        <div className="settingsPanelHeader"><div><strong>Album art tint</strong><span>How much cover art influences the player background.</span></div></div>
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

      <details className="settingsDisclosure settingsSidebarDisclosure">
        <summary>Sidebar arrangement <span>Reorder or hide sections</span></summary>
        <div className="settingsDisclosureBody"><SidebarTabsSettings settings={settings} updateSetting={updateSetting} /></div>
      </details>
    </section>
  );
}
