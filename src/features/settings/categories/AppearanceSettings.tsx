import { useEffect, useMemo, useState } from "react";
import type { Settings } from "../settings.types";
import type { ThemeId } from "../theme.types";
import type { ChoiceOption, CustomThemePresetOption, CustomThemeTokenOption, ThemeOption, UpdateSetting } from "../settings.shared";

const INFO_MASCOT_SRC = new URL("../assets/info-state.png", import.meta.url).href;
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

  return <section className="settingsCategoryPage settingsDeclutterPageV491 settingsAppearanceCleanV491" aria-label="Appearance settings">
    <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491"><div><p className="eyebrow">appearance</p><h4>theme and colors</h4></div><span>{settings.customThemeEnabled ? "custom colors active" : `${props.currentTheme.name} active`}</span></div>
    <div className="settingsPanelCard settingsFocusPanelV491">
      <div className="settingsPanelHeader"><div><strong>Theme</strong><span>Choose the base look. Custom colors stay separate so this page does not feel like a control panel.</span></div></div>
      <div className="settingsThemeSelectPanel settingsThemeSelectPanelV491">
        <label className="settingsSelectField settingsSelectFieldV491"><span>theme</span><select value={settings.theme} disabled={settings.customThemeEnabled} title={settings.customThemeEnabled ? "Turn off custom colors before choosing a preset." : "Choose theme"} onChange={(event) => { if (!settings.customThemeEnabled) void updateSetting("theme", event.currentTarget.value as ThemeId); }} aria-label="Choose theme">{props.visibleThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
        <div className="settingsThemeSelectedPreview settingsThemeSelectedPreviewV491" aria-live="polite"><span className="settingsThemeDot" style={{ background: props.themeSwatchColors[props.effectiveTheme] ?? props.themeSwatchColors.mint }} aria-hidden="true" /><div><strong>{settings.customThemeEnabled ? "custom colors" : props.currentTheme.name}</strong><small>{settings.customThemeEnabled ? "preset themes are locked while custom colors are on" : props.currentTheme.note}</small></div></div>
      </div>
    </div>
    <div className="settingsPanelCard settingsFocusPanelV491 customThemeManagerV027 customThemeManagerCleanV491">
      <div className="settingsPanelHeader customThemeHeaderV027 customThemeHeaderCleanV491"><div><strong>Accent / custom colors</strong><span>Keep it simple: turn on live colors, pick a preset, adjust colors, then save or reset.</span></div><div className="settingsHeaderActionsV027 settingsHeaderActionsCleanV491"><label className="cleanToggleLabel"><input type="checkbox" checked={settings.customThemeEnabled} onChange={(event) => updateSetting("customThemeEnabled", event.currentTarget.checked)} /><span>{settings.customThemeEnabled ? "Live colors on" : "Live colors off"}</span></label><button className="settingsTinyButton" type="button" onClick={props.resetCustomThemePalette}>Reset</button><button className="settingsTinyButton" type="button" onClick={props.saveCurrentCustomThemePreset}>Save</button></div></div>
      <div className="customThemeBodyV027 customThemeBodyCleanV491"><label className="settingsTextFieldV027 settingsTextFieldCleanV491"><span>Name</span><input value={props.customThemeName} onChange={(event) => props.setCustomThemeName(event.currentTarget.value)} aria-label="Custom colors name" /></label></div>
      <div className="customThemePresetRowV027 customThemePresetRowCleanV491" aria-label="Custom color presets">{props.builtInCustomThemePresets.slice(0, 4).map((preset) => <button key={preset.name} className="customThemePresetButtonV027 customThemePresetButtonCleanV491" type="button" onClick={() => props.applyCustomThemePreset(preset)}><span style={{ background: preset.colors.customThemeColor }} aria-hidden="true" /><strong>{preset.name}</strong><small>{preset.note}</small></button>)}</div>
      <div className="customThemeTokenGridV027 customThemeTokenGridCleanV491">{customThemeTokens.slice(0, 6).map((token) => { const draft = drafts[token.key] ?? token.value; const preview = complete(draft) ? draft : token.value; return <div className="customThemeTokenV027 customThemeTokenCleanV491" key={token.key}><label className="customThemeColorPickerV032" title={`Pick ${token.label.toLowerCase()} color`}><span className="customThemeColorPreviewV027" style={{ background: preview }} aria-hidden="true" /><input className="customThemeNativeColorInputV027" type="color" value={preview} onInput={(event) => { const next = event.currentTarget.value; const swatch = event.currentTarget.previousElementSibling as HTMLElement | null; if (complete(next) && swatch) swatch.style.background = next; props.previewCustomThemeColor?.(token.key, next, token.value); }} onChange={(event) => applyDraft(token.key, event.currentTarget.value, token.value)} aria-label={`${token.label} color picker`} /></label><strong>{token.label}</strong><input className="customThemeHexInputV032" type="text" spellCheck={false} autoCapitalize="off" maxLength={7} value={draft} onChange={(event) => setDraft(token.key, event.currentTarget.value, token.value)} onBlur={(event) => applyDraft(token.key, event.currentTarget.value, token.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(token.key, token.value); event.currentTarget.blur(); } }} aria-label={`${token.label} hex color code`} /></div>; })}</div>
    </div>
    <div className="settingsPanelCard settingsFocusPanelV491 settingsLiveCoverColorsV491"><div className="settingsPanelHeader"><div><strong>Live cover colors</strong><span>Controls how much album art color is allowed to tint the app and player.</span></div></div><div className="settingsChoiceRowV491" role="group" aria-label="Live cover color strength">{props.coverColorSyncOptions.map((option) => { const active = props.selectedCoverColorSyncMode === option.id; const label = option.label || option.name || option.id; const note = option.note || (option.id === "off" ? "no cover tint" : option.id === "subtle" ? "tiny cover tint" : option.id === "strong" ? "bigger cover mood" : "balanced cover tint"); return <button key={option.id} type="button" className={`settingsChoicePillV491 ${active ? "active" : ""}`} onClick={() => void props.updateCoverColorSyncMode(option.id)} aria-pressed={active}><strong>{label}</strong><span>{note}</span></button>; })}</div></div>
    <div className="settingsPanelCard settingsFocusPanelV491 settingsAppearanceAdvancedCalloutV492 settingsAppearanceInfoCalloutV500"><div className="settingsPanelHeader settingsAppearanceInfoInnerV500"><img className="settingsInfoMascotV500" src={INFO_MASCOT_SRC} alt="" draggable={false} aria-hidden="true" /><div className="settingsAppearanceInfoCopyV500"><strong>looking for the other apperance options? go to advanced!</strong></div><button className="settingsActionButton settingsPrimaryAction" type="button" onClick={props.openAdvanced}>go to advanced</button></div></div>
  </section>;
}
