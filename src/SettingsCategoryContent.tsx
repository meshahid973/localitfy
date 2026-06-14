import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
type ThemeId = string;
type DownloadQuality = "best" | "320" | "256" | "192";
type DownloadFormat = "mp3" | "flac" | "wav";
type Settings = {
  downloadQuality: DownloadQuality;
  downloadFormat: DownloadFormat;
  [key: string]: any;
};
type ThemeOption = {
  id: string;
  name: string;
  note?: string;
};
type CurrentThemeOption = {
  name: string;
  note?: string;
};
type CustomThemeColorPatch = {
  customThemeColor: string;
  [key: string]: string;
};
type CustomThemePresetOption = {
  id: string;
  name: string;
  note?: string;
  colors: CustomThemeColorPatch;
};
type CustomThemeTokenOption = {
  key: string;
  label: string;
  help?: string;
  value: string;
};
type ChoiceOption = {
  id: string;
  label?: string;
  name?: string;
  note?: string;
};
type PlaylistOption = {
  id: string;
  name: string;
  songIds: string[];
};
type SongLike = {
  id?: string;
  title?: string;
  artist?: string;
  [key: string]: any;
};
type ImportAnimationLike = {
  active: boolean;
  [key: string]: any;
};
type UpdatePromptLike = {
  [key: string]: any;
};
type PlatformInfoLike = {
  id?: "windows" | "linux" | "mac" | "unknown";
  label?: string;
  releaseLabel?: string;
  startupSettingSupported?: boolean;
  desktopControlsLabel?: string;
  desktopControlsHelp?: string;
  startupSettingLabel?: string;
  startupSettingHelp?: string;
  linuxInstallNotes?: string[];
};
type DiagnosticsInfo = {
  items: Array<{ label: string; value: string | number }>;
  copyText: string;
};
type MutableNumberRef = {
  current: number;
};
type SettingsCategoryContentProps = {
  settingsCategory: string;
  setSettingsCategory?: (value: string) => void;
  currentTheme: CurrentThemeOption;
  settings: Settings;
  updateSetting: (...args: any[]) => void | Promise<void>;
  visibleThemes: ReadonlyArray<ThemeOption>;
  THEME_SWATCH_COLORS: Record<string, string>;
  effectiveTheme: string;
  randomizeCustomThemePalette: () => void;
  resetCustomThemePalette: () => void;
  saveCurrentCustomThemePreset: () => void;
  customThemeName: string;
  setCustomThemeName: (value: string) => void;
  currentSong: SongLike | null;
  BUILT_IN_CUSTOM_THEME_PRESETS: ReadonlyArray<CustomThemePresetOption>;
  applyCustomThemePreset: (...args: any[]) => void;
  savedCustomThemes: ReadonlyArray<CustomThemePresetOption>;
  removeSavedCustomThemePreset: (id: string) => void;
  customThemeTokens: ReadonlyArray<CustomThemeTokenOption>;
  customThemeHexDrafts: Record<string, string>;
  handleCustomThemeHexDraftChange: (...args: any[]) => void;
  commitCustomThemeHexDraft: (...args: any[]) => void;
  previewCustomThemeColor?: (...args: any[]) => void;
  coverColorSyncOptions: ReadonlyArray<ChoiceOption>;
  selectedCoverColorSyncMode: string;
  updateCoverColorSyncMode: (...args: any[]) => void;
  discordPreview: { badge: string; details: string; state: string };
  discordStyleOptions: ReadonlyArray<ChoiceOption>;
  discordSecondLineOptions: ReadonlyArray<ChoiceOption>;
  discordArtModeOptions: ReadonlyArray<ChoiceOption>;
  discordCleanupOptions: ReadonlyArray<ChoiceOption>;
  songs: ReadonlyArray<SongLike>;
  libraryScanBusy: boolean;
  cleanLibraryMetadataAction: () => void;
  cleanSelectedMetadataAction?: () => void;
  metadataSelectedCount?: number;
  metadataCleanPreview?: any | null;
  applyMetadataCleanPreviewAction?: () => void | Promise<void>;
  cancelMetadataCleanPreviewAction?: () => void;
  undoLastMetadataCleanAction?: () => void | Promise<void>;
  metadataUndoCount?: number;
  rebuildSearchIndexAction: () => void;
  importSongs: () => void;
  importAnimation: ImportAnimationLike;
  libraryScanMessage: string;
  newPlaylistName: string;
  setNewPlaylistName: (value: string) => void;
  createPlaylist: () => void;
  changeView: (...args: any[]) => void;
  clearQueue: () => void;
  playQueue: ReadonlyArray<string>;
  repeatPlaylist: boolean;
  setRepeatPlaylist: (value: boolean) => void;
  playlists: ReadonlyArray<PlaylistOption>;
  openPlaylist: (playlistId: string) => void;
  playPlaylist: (...args: any[]) => void | Promise<void>;
  removePlaylist: (playlistId: string) => void;
  pixelArtAssets: ReadonlyArray<any>;
  pixelArtBusy: boolean;
  randomizeAllCovers: () => void;
  rescanPixelArtFolder: () => void;
  downloadFolderLabel: string;
  chooseDownloadFolder: () => void;
  APP_VERSION: string;
  updatePrompt: UpdatePromptLike;
  updateStatusLabel: (...args: any[]) => string;
  manualUpdateCheck: () => void;
  askUpdaterToInstall: () => void;
  skipAvailableUpdate: () => void;
  setWhatsNewOpen: (value: boolean) => void;
  whatsNewItems: ReadonlyArray<string>;
  copyDiagnosticsInfo: () => void;
  diagnosticsCopied: boolean;
  diagnosticsInfo: DiagnosticsInfo;
  platformInfo?: PlatformInfoLike;
  likedSongs: ReadonlyArray<SongLike>;
  libraryRenderLimitRef: MutableNumberRef;
  INITIAL_LIBRARY_RENDER_LIMIT: number;
  setLibraryRenderLimit: (value: number) => void;
  resetDiscordSettings: () => void;
  resetAppearanceSettings: () => void;
  resetPlayerLayoutSettings: () => void;
  resetLibraryLayoutSettings: () => void;
  resetAllSettingsSafely: () => void;
};
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function ToggleRow({
  label,
  help,
  checked,
  onChange
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggleRow" title={help || label}>
      <span className="toggleRowCopy">
        <span className="settingsLabelLine">
          <strong>{label}</strong>
          {help ? <span className="settingsInfoDot" aria-hidden="true">i</span> : null}
        </span>
        {help ? <small>{help}</small> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
    </label>
  );
}
function RangeRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const activeValue = editing ? draftValue : value;
  const shownValue = `${activeValue}${suffix || ""}`;
  const fill = ((activeValue - min) / (max - min || 1)) * 100;
  useEffect(() => {
    if (!editing) {
      setDraftValue(value);
    }
  }, [editing, value]);
  function commit(nextValue = draftValue) {
    const clamped = clamp(nextValue, min, max);
    setDraftValue(clamped);
    setEditing(false);
    if (clamped !== value) {
      onChange(clamped);
    }
  }
  return (
    <label className="rangeRow" title={`${label}: ${shownValue}`}>
      <span className="rangeRowCopy">
        <span className="settingsLabelLine">
          <strong>{label}</strong>
          <span className="settingsInfoDot" aria-hidden="true">i</span>
        </span>
        <small>{shownValue}</small>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={activeValue}
        style={{ ["--range-progress" as string]: `${clamp(fill, 0, 100)}%` } as CSSProperties}
        onPointerDown={() => {
          setEditing(true);
          setDraftValue(value);
        }}
        onChange={(event) => setDraftValue(Number(event.currentTarget.value))}
        onPointerUp={(event) => commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => commit(Number(event.currentTarget.value))}
        onBlur={(event) => commit(Number(event.currentTarget.value))}
      />
    </label>
  );
}

const COMPLETE_HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
function cleanCustomColorDraft(value: string) {
  const raw = String(value || "").trim().replace(/[^#0-9a-fA-F]/g, "");
  const withoutExtraHashes = raw.replace(/#/g, "");
  return `#${withoutExtraHashes}`.slice(0, 7);
}
function isCompleteHexColor(value: string) {
  return COMPLETE_HEX_COLOR_RE.test(String(value || "").trim());
}
function detectSettingsPlatform(): Required<PlatformInfoLike> {
  const userAgent = typeof navigator !== "undefined" ? String(navigator.userAgent || "").toLowerCase() : "";
  const platform = typeof navigator !== "undefined" ? String(navigator.platform || "").toLowerCase() : "";
  const isLinux = /linux|x11|wayland/.test(userAgent) || platform.includes("linux");
  const isMac = /mac os|macintosh|darwin/.test(userAgent) || platform.includes("mac");
  const isWindows = /windows|win32|win64|wow64/.test(userAgent) || platform.includes("win");
  if (isLinux) {
    return {
      id: "linux",
      label: "Linux",
      releaseLabel: "AppImage / RPM / DEB",
      startupSettingSupported: false,
      desktopControlsLabel: "Linux desktop controls",
      desktopControlsHelp: "Tray and media keys work where your Linux desktop environment exposes them.",
      startupSettingLabel: "Linux autostart",
      startupSettingHelp: "Hidden in this release. Linux autostart will use a proper desktop-entry flow later.",
      linuxInstallNotes: [
        "AppImage: right click > Properties > Allow executing file as program, or run chmod +x Localtify-0.4.0-x86_64.AppImage.",
        "If the AppImage does not open, install FUSE/libfuse2 for your distro, then run it again.",
        "RPM: for Fedora, openSUSE, and RHEL-style distros.",
        "DEB: for Ubuntu, Debian, Linux Mint, and related distros."
      ]
    };
  }
  if (isMac) {
    return {
      id: "mac",
      label: "macOS",
      releaseLabel: "macOS build not published yet",
      startupSettingSupported: false,
      desktopControlsLabel: "macOS desktop controls",
      desktopControlsHelp: "macOS support is not part of this release yet. Windows startup controls stay hidden.",
      startupSettingLabel: "Start localtify with macOS",
      startupSettingHelp: "macOS autostart will be added later when a signed macOS build exists.",
      linuxInstallNotes: []
    };
  }
  return {
    id: isWindows ? "windows" : "unknown",
    label: isWindows ? "Windows" : "Unknown desktop",
    releaseLabel: isWindows ? "NSIS installer" : "Desktop build",
    startupSettingSupported: isWindows,
    desktopControlsLabel: isWindows ? "Windows controls" : "Desktop controls",
    desktopControlsHelp: isWindows
      ? "Use keyboard media keys, taskbar buttons, tray controls, and Windows now playing."
      : "Tray and media keys are available where the current desktop environment supports them.",
    startupSettingLabel: "Start localtify when Windows starts",
    startupSettingHelp: "Enabled by default so the player is ready after you sign in. You can turn it off anytime.",
    linuxInstallNotes: []
  };
}
const SettingsCategoryContent = memo(function SettingsCategoryContent({
  settingsCategory,
  setSettingsCategory,
  currentTheme,
  settings,
  updateSetting,
  visibleThemes,
  THEME_SWATCH_COLORS,
  effectiveTheme,
  resetCustomThemePalette,
  saveCurrentCustomThemePreset,
  customThemeName,
  setCustomThemeName,
  BUILT_IN_CUSTOM_THEME_PRESETS,
  applyCustomThemePreset,
  customThemeTokens,
  commitCustomThemeHexDraft,
  previewCustomThemeColor,
  coverColorSyncOptions,
  selectedCoverColorSyncMode,
  updateCoverColorSyncMode,
  discordPreview,
  discordStyleOptions,
  discordSecondLineOptions,
  discordArtModeOptions,
  discordCleanupOptions,
  songs,
  libraryScanBusy,
  cleanLibraryMetadataAction,
  cleanSelectedMetadataAction,
  metadataSelectedCount = 0,
  metadataCleanPreview,
  applyMetadataCleanPreviewAction,
  cancelMetadataCleanPreviewAction,
  undoLastMetadataCleanAction,
  metadataUndoCount = 0,
  rebuildSearchIndexAction,
  libraryScanMessage,
  changeView,
  pixelArtAssets,
  pixelArtBusy,
  randomizeAllCovers,
  rescanPixelArtFolder,
  downloadFolderLabel,
  chooseDownloadFolder,
  APP_VERSION,
  updatePrompt,
  manualUpdateCheck,
  askUpdaterToInstall,
  copyDiagnosticsInfo,
  diagnosticsCopied,
  diagnosticsInfo,
  platformInfo,
  libraryRenderLimitRef,
  INITIAL_LIBRARY_RENDER_LIMIT,
  setLibraryRenderLimit,
  resetDiscordSettings,
  resetAppearanceSettings,
  resetPlayerLayoutSettings,
  resetLibraryLayoutSettings,
  resetAllSettingsSafely
}: SettingsCategoryContentProps) {
  const fallbackPlatformInfo = useMemo(() => detectSettingsPlatform(), []);
  const activePlatformInfo = {
    ...fallbackPlatformInfo,
    ...(platformInfo || {})
  } as Required<PlatformInfoLike>;
  const linuxInstallNotes = activePlatformInfo.linuxInstallNotes?.length
    ? activePlatformInfo.linuxInstallNotes
    : fallbackPlatformInfo.linuxInstallNotes;
  const showLinuxInstallNotes = activePlatformInfo.id === "linux" || linuxInstallNotes.length > 0;
  const customThemeTokenSignature = useMemo(
    () => customThemeTokens.map((token) => `${token.key}:${token.value}`).join("|"),
    [customThemeTokens]
  );
  const [customColorDrafts, setCustomColorDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    customThemeTokens.forEach((token) => {
      nextDrafts[token.key] = token.value;
    });
    setCustomColorDrafts(nextDrafts);
  }, [customThemeTokenSignature, customThemeTokens]);
  function previewCustomColorDraft(key: string, value: string, fallback: string, swatch?: HTMLElement | null) {
    const draft = cleanCustomColorDraft(value);
    if (!isCompleteHexColor(draft)) return;
    if (swatch) {
      swatch.style.background = draft;
    }
    previewCustomThemeColor?.(key, draft, fallback);
  }
  function setCustomColorDraft(key: string, value: string, fallback?: string) {
    const draft = cleanCustomColorDraft(value);
    setCustomColorDrafts((old) => ({ ...old, [key]: draft }));
    if (fallback && isCompleteHexColor(draft)) {
      previewCustomThemeColor?.(key, draft, fallback);
    }
  }
  function applyCustomColorDraft(key: string, value: string, fallback: string) {
    const draft = cleanCustomColorDraft(value);
    const safeColor = isCompleteHexColor(draft) ? draft : fallback;
    setCustomColorDrafts((old) => ({ ...old, [key]: safeColor }));
    commitCustomThemeHexDraft(key, safeColor, fallback);
  }
return (
  <>
    {settingsCategory === "appearance" ? (
      <section className="settingsCategoryPage settingsDeclutterPageV491 settingsAppearanceCleanV491" aria-label="Appearance settings">
        <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491">
          <div>
            <p className="eyebrow">appearance</p>
            <h4>theme and colors</h4>
          </div>
          <span>{settings.customThemeEnabled ? "custom colors active" : `${currentTheme.name} active`}</span>
        </div>

        <div className="settingsPanelCard settingsFocusPanelV491">
          <div className="settingsPanelHeader">
            <div>
              <strong>Theme</strong>
              <span>Choose the base look. Custom colors stay separate so this page does not feel like a control panel.</span>
            </div>
          </div>
          <div className="settingsThemeSelectPanel settingsThemeSelectPanelV491">
            <label className="settingsSelectField settingsSelectFieldV491">
              <span>theme</span>
              <select
                value={settings.theme}
                disabled={settings.customThemeEnabled}
                title={settings.customThemeEnabled ? "Turn off custom colors before choosing a preset." : "Choose theme"}
                onChange={(event) => {
                  if (settings.customThemeEnabled) return;
                  void updateSetting("theme", event.currentTarget.value as ThemeId);
                }}
                aria-label="Choose theme"
              >
                {visibleThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
              </select>
            </label>
            <div className="settingsThemeSelectedPreview settingsThemeSelectedPreviewV491" aria-live="polite">
              <span className="settingsThemeDot" style={{ background: THEME_SWATCH_COLORS[effectiveTheme] ?? THEME_SWATCH_COLORS.mint }} aria-hidden="true" />
              <div>
                <strong>{settings.customThemeEnabled ? "custom colors" : currentTheme.name}</strong>
                <small>{settings.customThemeEnabled ? "preset themes are locked while custom colors are on" : currentTheme.note}</small>
              </div>
            </div>
          </div>
        </div>

        <div className="settingsPanelCard settingsFocusPanelV491 customThemeManagerV027 customThemeManagerCleanV491">
          <div className="settingsPanelHeader customThemeHeaderV027 customThemeHeaderCleanV491">
            <div>
              <strong>Accent / custom colors</strong>
              <span>Keep it simple: turn on live colors, pick a preset, adjust colors, then save or reset.</span>
            </div>
            <div className="settingsHeaderActionsV027 settingsHeaderActionsCleanV491">
              <label className="cleanToggleLabel">
                <input type="checkbox" checked={settings.customThemeEnabled} onChange={(event) => updateSetting("customThemeEnabled", event.currentTarget.checked)} />
                <span>{settings.customThemeEnabled ? "Live colors on" : "Live colors off"}</span>
              </label>
              <button className="settingsTinyButton" type="button" onClick={resetCustomThemePalette}>Reset</button>
              <button className="settingsTinyButton" type="button" onClick={saveCurrentCustomThemePreset}>Save</button>
            </div>
          </div>

          <div className="customThemeBodyV027 customThemeBodyCleanV491">
            <label className="settingsTextFieldV027 settingsTextFieldCleanV491">
              <span>Name</span>
              <input value={customThemeName} onChange={(event) => setCustomThemeName(event.currentTarget.value)} aria-label="Custom colors name" />
            </label>
          </div>

          <div className="customThemePresetRowV027 customThemePresetRowCleanV491" aria-label="Custom color presets">
            {BUILT_IN_CUSTOM_THEME_PRESETS.slice(0, 4).map((preset) => (
              <button key={preset.name} className="customThemePresetButtonV027 customThemePresetButtonCleanV491" type="button" onClick={() => applyCustomThemePreset(preset)}>
                <span style={{ background: preset.colors.customThemeColor }} aria-hidden="true" />
                <strong>{preset.name}</strong>
                <small>{preset.note}</small>
              </button>
            ))}
          </div>

          <div className="customThemeTokenGridV027 customThemeTokenGridCleanV491">
            {customThemeTokens.slice(0, 6).map((token) => {
              const hexDraft = customColorDrafts[token.key] ?? token.value;
              const previewColor = isCompleteHexColor(hexDraft) ? hexDraft : token.value;
              return (
                <div className="customThemeTokenV027 customThemeTokenCleanV491" key={token.key}>
                  <label className="customThemeColorPickerV032" title={`Pick ${token.label.toLowerCase()} color`}>
                    <span className="customThemeColorPreviewV027" style={{ background: previewColor }} aria-hidden="true" />
                    <input
                      className="customThemeNativeColorInputV027"
                      type="color"
                      value={previewColor}
                      onInput={(event) => {
                        const swatch = event.currentTarget.previousElementSibling as HTMLElement | null;
                        previewCustomColorDraft(token.key, event.currentTarget.value, token.value, swatch);
                      }}
                      onChange={(event) => applyCustomColorDraft(token.key, event.currentTarget.value, token.value)}
                      aria-label={`${token.label} color picker`}
                    />
                  </label>
                  <strong>{token.label}</strong>
                  <input
                    className="customThemeHexInputV032"
                    type="text"
                    inputMode="text"
                    spellCheck={false}
                    autoCapitalize="off"
                    maxLength={7}
                    value={hexDraft}
                    onChange={(event) => setCustomColorDraft(token.key, event.currentTarget.value, token.value)}
                    onBlur={(event) => applyCustomColorDraft(token.key, event.currentTarget.value, token.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        setCustomColorDraft(token.key, token.value);
                        event.currentTarget.blur();
                      }
                    }}
                    aria-label={`${token.label} hex color code`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="settingsPanelCard settingsFocusPanelV491 settingsLiveCoverColorsV491">
          <div className="settingsPanelHeader">
            <div>
              <strong>Live cover colors</strong>
              <span>Controls how much album art color is allowed to tint the app and player.</span>
            </div>
          </div>
          <div className="settingsChoiceRowV491" role="group" aria-label="Live cover color strength">
            {coverColorSyncOptions.map((option: ChoiceOption) => {
              const active = selectedCoverColorSyncMode === option.id;
              const label = option.label || option.name || option.id;
              const note = option.note || (option.id === "off" ? "no cover tint" : option.id === "subtle" ? "tiny cover tint" : option.id === "strong" ? "bigger cover mood" : "balanced cover tint");
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`settingsChoicePillV491 ${active ? "active" : ""}`}
                  onClick={() => void updateCoverColorSyncMode(option.id)}
                  aria-pressed={active}
                  aria-label={`Set live cover colors to ${label}`}
                  title={`Live cover colors: ${label}`}
                >
                  <strong>{label}</strong>
                  <span>{note}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="settingsPanelCard settingsFocusPanelV491 settingsAppearanceAdvancedCalloutV492">
          <div className="settingsPanelHeader">
            <div>
              <strong>looking for the other apperance options? go to advanced!</strong>
              <span>Layout, card behavior, sidebar, glow, motion, cover repair, Linux notes, diagnostics, and reset tools are kept in Advanced now.</span>
            </div>
            <button
              className="settingsActionButton settingsPrimaryAction"
              type="button"
              onClick={() => setSettingsCategory?.("advanced")}
            >
              go to advanced
            </button>
          </div>
        </div>
      </section>
    ) : null}
    {settingsCategory === "playback" ? (
      <section className="settingsCategoryPage settingsDeclutterPageV491 settingsPlaybackCleanV491" aria-label="Playback settings">
        <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491">
          <div>
            <p className="eyebrow">playback</p>
            <h4>useful playback controls</h4>
          </div>
          <span>only the settings that change listening</span>
        </div>
        <div className="settingsTwoColumn settingsTwoColumnCleanV491">
          <div className="settingsPanelCard settingsFocusPanelV491">
            <div className="settingsPanelHeader">
              <div>
                <strong>Transitions</strong>
                <span>Simple switching between tracks.</span>
              </div>
            </div>
            <RangeRow label="Crossfade" value={settings.crossfadeSeconds} min={0} max={10} step={1} suffix="s" onChange={(value) => updateSetting("crossfadeSeconds", value)} />
            <ToggleRow label="Crossfade enabled" help="Turns crossfade on or off." checked={settings.crossfadeEnabled} onChange={(value) => updateSetting("crossfadeEnabled", value)} />
            <ToggleRow label="Gapless playback" help="Starts the next song without silence." checked={settings.gaplessPlayback} onChange={(value) => updateSetting("gaplessPlayback", value)} />
          </div>
          <div className="settingsPanelCard settingsFocusPanelV491">
            <div className="settingsPanelHeader">
              <div>
                <strong>Listening</strong>
                <span>Keep the player predictable.</span>
              </div>
            </div>
            <RangeRow label="Playback speed" value={settings.playbackSpeed} min={0.75} max={1.5} step={0.05} suffix="x" onChange={(value) => updateSetting("playbackSpeed", value)} />
            <ToggleRow label="Volume normalization" help="Balances loud and quiet files." checked={settings.volumeNormalization} onChange={(value) => updateSetting("volumeNormalization", value)} />
            <ToggleRow label="Remember position" help="Restores progress for long tracks." checked={settings.rememberPlaybackPosition} onChange={(value) => updateSetting("rememberPlaybackPosition", value)} />
            <ToggleRow label="Compact player" help="Keeps the bottom player smaller." checked={settings.compactPlayer} onChange={(value) => updateSetting("compactPlayer", value)} />
          </div>
        </div>
      </section>
    ) : null}
    {settingsCategory === "discord" ? (
      <section className="settingsCategoryPage discordSettingsPage" aria-label="Discord settings">
        <div className="settingsCategoryHeader discordCategoryHeader">
          <div>
            <p className="eyebrow">discord rich presence</p>
            <h4>privacy, text, buttons, and artwork</h4>
          </div>
          <span>{settings.discordEnabled ? "showing activity" : "activity hidden"}</span>
        </div>
        <div className="settingsPanelCard discordHeroCard">
          <div className="discordPreviewMock" aria-label="Discord activity preview">
            <span>{discordPreview.badge}</span>
            <strong>{discordPreview.details}</strong>
            <small>{discordPreview.state}</small>
          </div>
          <div className="discordHeroCopy">
            <strong>Discord preview</strong>
            <span>These controls match rpc.cjs: privacy hides the exact song, style changes the text, artwork changes the large image, and buttons can be disabled.</span>
          </div>
        </div>
        <div className="settingsPanelCard discordMainControls">
          <div className="settingsPanelHeader">
            <div>
              <strong>Privacy and visibility</strong>
              <span>The most important Discord settings are here first so nobody gets stuck in privacy mode.</span>
            </div>
          </div>
          <div className="settingsMiniGrid four discordToggleGrid">
            <ToggleRow label="Enable Discord activity" help="Shows localtify as your Discord status." checked={settings.discordEnabled} onChange={(value) => updateSetting("discordEnabled", value)} />
            <ToggleRow label="Privacy mode" help="Hides the exact song name and shows a generic local music status." checked={settings.discordPrivacyMode} onChange={(value) => updateSetting("discordPrivacyMode", value)} />
            <ToggleRow label="Paused status" help="Shows paused/idle when playback is not active." checked={settings.discordShowPausedIdle} onChange={(value) => updateSetting("discordShowPausedIdle", value)} />
            <ToggleRow label="RPC buttons" help="Shows safe buttons like search song or get localtify." checked={settings.discordButtons} onChange={(value) => updateSetting("discordButtons", value)} />
          </div>
        </div>
        <div className="settingsTwoColumn discordSettingsGrid">
          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Status style</strong>
                <span>Changes the main Discord text style.</span>
              </div>
            </div>
            <div className="optionGrid five discordOptionGrid">
              {discordStyleOptions.map((option) => (
                <button key={option.id} className={`settingsChoice ${settings.discordActivityStyle === option.id ? "active" : ""}`} type="button" onClick={() => updateSetting("discordActivityStyle", option.id)}>
                  <strong>{option.name}</strong>
                  <small>{option.note}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Second line</strong>
                <span>Choose the smaller line under the song.</span>
              </div>
            </div>
            <div className="optionGrid five discordOptionGrid">
              {discordSecondLineOptions.map((option) => (
                <button key={option.id} className={`settingsChoice ${settings.discordSecondLine === option.id ? "active" : ""}`} type="button" onClick={() => updateSetting("discordSecondLine", option.id)}>
                  <strong>{option.name}</strong>
                  <small>{option.note}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="settingsPanelCard discordArtworkCard">
          <div className="settingsPanelHeader">
            <div>
              <strong>Artwork mode</strong>
              <span>Choose the image used in Discord Rich Presence.</span>
            </div>
          </div>
          <div className="optionGrid four discordOptionGrid">
            {discordArtModeOptions.map((option) => (
              <button key={option.id} className={`settingsChoice ${settings.discordArtMode === option.id ? "active" : ""}`} type="button" onClick={() => updateSetting("discordArtMode", option.id)}>
                <strong>{option.name}</strong>
                <small>{option.note}</small>
              </button>
            ))}
          </div>
          <p className="settingsHintText">Pixel shuffle rotates through available Discord image assets before repeating them.</p>
        </div>
      </section>
    ) : null}
    {settingsCategory === "library" || settingsCategory === "metadata" ? (
      <section className="settingsCategoryPage" aria-label="Library settings">
        <div className="settingsCategoryHeader">
          <div>
            <p className="eyebrow">library</p>
            <h4>imports, search, and metadata</h4>
          </div>
          <span>{songs.length} songs indexed</span>
        </div>
        <div className="settingsPanelCard metadataCleanerPanelV441">
          <div className="settingsPanelHeader metadataCleanerHeaderV440">
            <div>
              <strong>Clean title tool</strong>
              <span>Preview title cleanup before changing saved library text.</span>
            </div>
            <span className="metadataCleanerBadgeV440">{libraryScanBusy ? "working" : "preview first"}</span>
          </div>
          <div className="metadataCleanerModeGridV441">
            {discordCleanupOptions.map((option) => (
              <button key={option.id} className={`cleanerOptionV440 ${settings.discordTitleCleanup === option.id ? "active" : ""}`} type="button" onClick={() => updateSetting("discordTitleCleanup", option.id)}>
                <strong>{option.name}</strong>
                <small>{option.note}</small>
              </button>
            ))}
          </div>
          <div className="settingsActionRow metadataCleanerActionRowV440">
            <button className="settingsActionButton settingsPrimaryAction" type="button" disabled={libraryScanBusy} onClick={cleanLibraryMetadataAction}>preview all fixes</button>
            <button className="settingsActionButton" type="button" disabled={libraryScanBusy || !metadataSelectedCount} onClick={() => cleanSelectedMetadataAction?.()}>preview selected {metadataSelectedCount ? `(${metadataSelectedCount})` : ""}</button>
            <button className="settingsActionButton" type="button" disabled={libraryScanBusy || !metadataUndoCount} onClick={() => void undoLastMetadataCleanAction?.()}>undo last clean {metadataUndoCount ? `(${metadataUndoCount})` : ""}</button>
            <button className="settingsActionButton settingsGhostAction" type="button" disabled={libraryScanBusy} onClick={rebuildSearchIndexAction}>rebuild search</button>
          </div>
          {metadataCleanPreview ? (
            <div className="metadataCleanerPreviewBoxV425 metadataCleanerPreviewBoxV440" role="status" aria-live="polite">
              <div className="metadataCleanerPreviewHeadV425 metadataCleanerPreviewHeadV440">
                <span>preview before applying</span>
                <strong>{metadataCleanPreview.changedCount || 0} fix{(metadataCleanPreview.changedCount || 0) === 1 ? "" : "es"} ready</strong>
                <small>{metadataCleanPreview.skippedCount || 0} skipped · {metadataCleanPreview.titleFixCount || 0} titles · {metadataCleanPreview.artistFixCount || 0} artists · {metadataCleanPreview.albumFixCount || 0} albums</small>
              </div>
              <div className="metadataCleanerPreviewListV425 metadataCleanerPreviewListV440">
                {(metadataCleanPreview.items || []).slice(0, 6).map((item: any) => (
                  <div className="metadataCleanerPreviewItemV425 metadataCleanerPreviewItemV440" key={item.id}>
                    <span>
                      <small>before</small>
                      <strong>{item.before?.title || "untitled"}</strong>
                      <em>{item.before?.artist || "unknown artist"}</em>
                    </span>
                    <b className="metadataCleanerArrowV440" aria-hidden="true"><i /></b>
                    <span>
                      <small>after</small>
                      <strong>{item.after?.title || "untitled"}</strong>
                      <em>{item.after?.artist || "unknown artist"}</em>
                    </span>
                  </div>
                ))}
              </div>
              <div className="metadataCleanerPreviewActionsV425 metadataCleanerPreviewActionsV440">
                <button className="settingsActionButton settingsPrimaryAction" type="button" disabled={libraryScanBusy || !(metadataCleanPreview.changedCount || 0)} onClick={() => void applyMetadataCleanPreviewAction?.()}>apply preview</button>
                <button className="settingsActionButton settingsGhostAction" type="button" disabled={libraryScanBusy} onClick={() => cancelMetadataCleanPreviewAction?.()}>cancel</button>
              </div>
            </div>
          ) : null}
          {libraryScanMessage ? <p className="settingsHintText">{libraryScanMessage}</p> : null}
        </div>
      </section>
    ) : null}
    {settingsCategory === "covers" ? (
      <section className="settingsCategoryPage settingsDeclutterPageV491 settingsCoversCleanV491" aria-label="Cover settings">
        <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491">
          <div>
            <p className="eyebrow">covers</p>
            <h4>cover tools</h4>
          </div>
          <span>{pixelArtAssets.length} cover assets</span>
        </div>
        <div className="settingsPanelCard settingsFocusPanelV491 settingsCoverToolsCompactV491">
          <div className="settingsPanelHeader">
            <div>
              <strong>Normal cover tools</strong>
              <span>Common cover actions stay here. Repair and bulk tools are now in Advanced.</span>
            </div>
          </div>
          <div className="settingsActionRow settingsActionRowCleanV491">
            <button className="settingsActionButton settingsPrimaryAction" type="button" onClick={() => changeView("covers", "settings")}>change cover</button>
            <button className="settingsActionButton" type="button" onClick={() => changeView("covers", "settings")}>recent covers</button>
            <button className="settingsActionButton" type="button" onClick={() => changeView("covers", "settings")}>missing covers</button>
          </div>
        </div>
      </section>
    ) : null}
    {settingsCategory === "downloads" ? (
      <section className="settingsContentBlock settingsDeclutterPageV491 settingsDownloadsCleanV491">
        <p className="eyebrow">downloads</p>
        <h2>download settings</h2>
        <p className="settingsLead">Keep the normal download options only: quality, format, auto-add, and folder.</p>
        <div className="settingsGrid twoCols downloadSettingsGridV031">
          <div className="settingGroup settingsFocusPanelV491">
            <h3>Audio quality</h3>
            <p>Best keeps the source quality when possible. Fixed bitrates are useful if you want smaller MP3 files.</p>
            <div className="optionGrid compactOptions">
              {(["best", "320", "256", "192"] as Settings["downloadQuality"][]).map((quality) => (
                <button
                  key={quality}
                  className={`settingsChoice ${settings.downloadQuality === quality ? "active" : ""}`}
                  onClick={() => void updateSetting("downloadQuality", quality)}
                >
                  <strong>{quality === "best" ? "Best" : `${quality}kbps`}</strong>
                  <span>{quality === "best" ? "highest available" : "smaller file size"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="settingGroup settingsFocusPanelV491">
            <h3>Format</h3>
            <p>MP3 is best for compatibility. FLAC is bigger but keeps more quality when conversion allows it.</p>
            <div className="optionGrid compactOptions">
              {(["mp3", "flac", "wav"] as Settings["downloadFormat"][]).map((format) => (
                <button
                  key={format}
                  className={`settingsChoice ${settings.downloadFormat === format ? "active" : ""}`}
                  onClick={() => void updateSetting("downloadFormat", format)}
                >
                  <strong>{format.toUpperCase()}</strong>
                  <span>{format === "mp3" ? "recommended" : format === "flac" ? "large quality files" : "huge raw files"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="settingsCardStack downloadToggleStackV031 settingsFocusPanelV491">
          <label className="toggleRow">
            <span>
              <strong>Auto-add to library</strong>
              <small>Downloaded audio appears in localtify automatically.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.downloadAutoAdd}
              onChange={(event) => void updateSetting("downloadAutoAdd", event.currentTarget.checked)}
            />
          </label>
        </div>
        <div className="settingGroup downloadFolderGroupV031 settingsFocusPanelV491">
          <h3>Download folder</h3>
          <p>Choose where localtify saves downloaded songs. Leave it empty to use the default Downloads/localitfy folder.</p>
          <div className="folderPickerRow">
            <code>{settings.downloadFolder || downloadFolderLabel || "Default downloads folder"}</code>
            <button className="softButton" onClick={() => void chooseDownloadFolder()}>choose folder</button>
            {settings.downloadFolder ? (
              <button className="softButton" onClick={() => void updateSetting("downloadFolder", "")}>use default</button>
            ) : null}
          </div>
        </div>
      </section>
    ) : null}
    {settingsCategory === "updates" ? (
      <section className="settingsCategoryPage settingsDeclutterPageV491 settingsUpdatesPage settingsUpdatesCleanV491" aria-label="Update settings">
        <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491">
          <div>
            <p className="eyebrow">updates</p>
            <h4>simple update notice</h4>
          </div>
          <span>{settings.autoUpdateEnabled ? "checks on" : "checks off"}</span>
        </div>
        <div className="settingsPanelCard settingsFocusPanelV491 settingsUpdateBehaviorPanel">
          <div className="settingsPanelHeader">
            <div>
              <strong>Update behavior</strong>
              <span>The top update island stays simple: update available, download update, close.</span>
            </div>
          </div>
          <div className="settingsMiniGrid">
            <ToggleRow label="Update checks" help="Checks for new releases while the app is open." checked={settings.autoUpdateEnabled} onChange={(value) => updateSetting("autoUpdateEnabled", value)} />
            <ToggleRow label="Notify only" help="Shows an update message instead of installing automatically." checked={settings.autoUpdateNotifyOnly} onChange={(value) => updateSetting("autoUpdateNotifyOnly", value)} />
          </div>
        </div>
      </section>
    ) : null}
    {settingsCategory === "about" ? (
      <section className="settingsCategoryPage settingsDeclutterPageV491 settingsAboutCleanV491" aria-label="About localtify">
        <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491">
          <div>
            <p className="eyebrow">about</p>
            <h4>localtify</h4>
          </div>
          <span>version {APP_VERSION}</span>
        </div>
        <div className="settingsPanelCard settingsFocusPanelV491 settingsAboutCardV491">
          <div className="settingsPanelHeader">
            <div>
              <strong>App info moved</strong>
              <span>Diagnostics and debug version details now live in Advanced so normal settings stay clean.</span>
            </div>
          </div>
          <div className="settingsMiniStatusV491">
            <span><strong>{APP_VERSION}</strong><small>version</small></span>
            <span><strong>{activePlatformInfo.label}</strong><small>platform</small></span>
            <span><strong>{songs.length}</strong><small>songs</small></span>
          </div>
        </div>
      </section>
    ) : null}
    {settingsCategory === "advanced" ? (
      <section className="settingsCategoryPage settingsDeclutterPageV491 settingsAdvancedBoringV491" aria-label="Advanced settings">
        <div className="settingsCategoryHeader settingsCategoryHeaderCleanV491">
          <div>
            <p className="eyebrow">advanced</p>
            <h4>maintenance</h4>
          </div>
          <span>boring tools · version {APP_VERSION}</span>
        </div>

        <div className="settingsPanelCard settingsBoringPanelV491 settingsDiagnosticsPanelV491">
          <div className="settingsPanelHeader settingsDiagnosticsHeader">
            <div>
              <strong>Diagnostics</strong>
              <span>Safe app info for bug reports. Hidden here so normal settings stay clean.</span>
            </div>
            <button className="settingsActionButton settingsCopyInfoButton" type="button" onClick={copyDiagnosticsInfo}>
              {diagnosticsCopied ? "copied" : "copy app info"}
            </button>
          </div>
          <div className="settingsDiagnosticsGrid settingsDiagnosticsGridV440">
            {diagnosticsInfo.items.map((item) => (
              <div className="settingsDiagnosticCard" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="settingsTwoColumn settingsAdvancedGridV491">
          <div className="settingsPanelCard settingsBoringPanelV491">
            <div className="settingsPanelHeader">
              <div>
                <strong>Update tools</strong>
                <span>Manual update checks and install controls live here.</span>
              </div>
            </div>
            <div className="settingsActionRow settingsActionRowCleanV491">
              <button className="settingsActionButton" type="button" onClick={manualUpdateCheck} disabled={updatePrompt.status === "checking" || updatePrompt.status === "downloading"}>force update check</button>
              <button className="settingsActionButton" type="button" onClick={askUpdaterToInstall} disabled={updatePrompt.status !== "downloaded"}>restart to install</button>
            </div>
          </div>

          <div className="settingsPanelCard settingsBoringPanelV491">
            <div className="settingsPanelHeader">
              <div>
                <strong>Search and library</strong>
                <span>Repair library loading when something looks stale.</span>
              </div>
            </div>
            <div className="settingsActionRow settingsActionRowCleanV491">
              <button className="settingsActionButton" type="button" disabled={libraryScanBusy} onClick={rebuildSearchIndexAction}>rebuild search</button>
              <button className="settingsActionButton" type="button" onClick={() => {
                libraryRenderLimitRef.current = INITIAL_LIBRARY_RENDER_LIMIT;
                setLibraryRenderLimit(INITIAL_LIBRARY_RENDER_LIMIT);
              }}>reset loaded songs</button>
            </div>
          </div>
        </div>

        <div className="settingsPanelCard settingsBoringPanelV491 settingsFullWidthPanel settingsAdvancedVisualPanelV491">
          <div className="settingsPanelHeader">
            <div>
              <strong>Advanced visual tuning</strong>
              <span>Small visual options are hidden here instead of crowding Appearance.</span>
            </div>
          </div>
          <div className="settingsMiniGrid appearanceMiniGridV356">
            <ToggleRow label="Right side cards" help="Shows the optional right column." checked={settings.showRightColumn} onChange={(value) => updateSetting("showRightColumn", value)} />
            <ToggleRow label="Compact library" help="Fits smaller rows." checked={settings.denseList} onChange={(value) => updateSetting("denseList", value)} />
            <ToggleRow label="Reduce motion" help="Turns off most decorative animations." checked={settings.reducedMotion} onChange={(value) => updateSetting("reducedMotion", value)} />
            <ToggleRow label="Soft corners" help="Uses rounder cards and buttons." checked={settings.softCorners} onChange={(value) => updateSetting("softCorners", value)} />
            <ToggleRow label="Animated glow" help="Keeps ambience on, but pauses it during fast screen switches." checked={settings.animatedGlow} onChange={(value) => updateSetting("animatedGlow", value)} />
            <ToggleRow label="Cat buddy" help="Tiny cat follows your cursor." checked={settings.catBuddyEnabled === true} onChange={(value) => updateSetting("catBuddyEnabled", value)} />
          </div>
        </div>

        <div className="settingsPanelCard settingsBoringPanelV491 settingsFullWidthPanel settingsAdvancedCoverPanelV491">
          <div className="settingsPanelHeader">
            <div>
              <strong>Advanced cover repair</strong>
              <span>Bulk cover tools are here so the normal Covers page stays simple.</span>
            </div>
          </div>
          <div className="settingsActionRow settingsActionRowCleanV491">
            <button className="settingsActionButton" type="button" disabled={pixelArtBusy || songs.length === 0} onClick={randomizeAllCovers}>bulk cover cleanup</button>
            <button className="settingsActionButton" type="button" disabled={pixelArtBusy} onClick={rescanPixelArtFolder}>repair / rescan covers</button>
            <button className="settingsActionButton" type="button" onClick={() => changeView("covers", "advanced")}>hidden covers</button>
            <button className="settingsActionButton" type="button" onClick={() => changeView("covers", "advanced")}>least-used cover logic</button>
          </div>
        </div>

        <div className="settingsPanelCard settingsBoringPanelV491 settingsFullWidthPanel">
          <div className="settingsPanelHeader">
            <div>
              <strong>{activePlatformInfo.desktopControlsLabel}</strong>
              <span>{activePlatformInfo.desktopControlsHelp}</span>
            </div>
          </div>
          <div className="settingsMiniGrid">
            <ToggleRow label="Keep localtify in tray when closed" help="The X button hides the app instead of quitting. Use Quit from the tray to close it fully." checked={settings.minimizeToTray} onChange={(value) => updateSetting("minimizeToTray", value)} />
            {activePlatformInfo.startupSettingSupported ? (
              <ToggleRow label={activePlatformInfo.startupSettingLabel} help={activePlatformInfo.startupSettingHelp} checked={settings.startWithWindows} onChange={(value) => updateSetting("startWithWindows", value)} />
            ) : (
              <div className="settingsManualNoteV491">
                <strong>{activePlatformInfo.startupSettingLabel}</strong>
                <span>{activePlatformInfo.startupSettingHelp}</span>
              </div>
            )}
          </div>
          {showLinuxInstallNotes ? (
            <ul className="settingsPlainList settingsReleaseList settingsLinuxNotesV491">
              {linuxInstallNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          ) : null}
        </div>

        <div className="settingsPanelCard settingsBoringPanelV491 settingsFullWidthPanel settingsResetPanel settingsDangerPanelV491">
          <div className="settingsPanelHeader">
            <div>
              <strong>Danger / reset tools</strong>
              <span>Reset only the selected app settings. Your songs stay in the library.</span>
            </div>
          </div>
          <div className="settingsResetGrid">
            <button className="settingsResetButton" type="button" onClick={resetDiscordSettings}>
              <strong>Reset Discord settings</strong>
              <span>Restores privacy mode, status text, buttons, artwork, and cleanup.</span>
            </button>
            <button className="settingsResetButton" type="button" onClick={resetAppearanceSettings}>
              <strong>Reset appearance</strong>
              <span>Restores theme, colors, motion, corners, and ambience settings.</span>
            </button>
            <button className="settingsResetButton" type="button" onClick={resetPlayerLayoutSettings}>
              <strong>Reset player layout</strong>
              <span>Restores player size, visualizer, volume, and speed.</span>
            </button>
            <button className="settingsResetButton" type="button" onClick={resetLibraryLayoutSettings}>
              <strong>Reset library layout</strong>
              <span>Restores sidebar width, compact library, home layout, and hero options.</span>
            </button>
            <button className="settingsResetButton danger" type="button" onClick={resetAllSettingsSafely}>
              <strong>Reset all settings</strong>
              <span>Asks first, then restores every app setting to default.</span>
            </button>
          </div>
        </div>
      </section>
    ) : null}
  </>
);
});
export default SettingsCategoryContent;
