/* localtify 0.3.7 V262 — cleaner settings, Linux release notes, and hidden platform-only controls. */
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
  currentTheme: CurrentThemeOption;
  settings: Settings;

  // Keep callbacks permissive here because App.tsx owns the exact domain types
  // such as keyof Settings, CustomThemeColorKey, View, Playlist, and update status unions.
  // This component only forwards already-valid values from typed option arrays.
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
  handleCustomThemeNativeColor: (...args: any[]) => void;
  handleCustomThemeHexDraftChange: (...args: any[]) => void;
  commitCustomThemeHexDraft: (...args: any[]) => void;
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


type VisualCustomizationOption = {
  id: string;
  label: string;
  note: string;
};

function readSettingChoice(settings: Settings, key: string, fallback: string) {
  const value = settings?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function VisualOptionButton({
  option,
  active,
  onClick
}: {
  option: VisualCustomizationOption;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`visualOptionButtonV205 ${active ? "active" : ""}`}
      type="button"
      onClick={onClick}
      aria-pressed={active}
    >
      <strong>{option.label}</strong>
      <span>{option.note}</span>
    </button>
  );
}

function VisualOptionGroup({
  title,
  note,
  options,
  value,
  onChange
}: {
  title: string;
  note: string;
  options: ReadonlyArray<VisualCustomizationOption>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="visualOptionGroupV205">
      <div className="visualOptionGroupHeadV205">
        <strong>{title}</strong>
        <span>{note}</span>
      </div>
      <div className="visualOptionGridV205">
        {options.map((option) => (
          <VisualOptionButton
            key={option.id}
            option={option}
            active={value === option.id}
            onClick={() => onChange(option.id)}
          />
        ))}
      </div>
    </div>
  );
}

const HOME_BANNER_TYPE_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "dynamic", label: "Dynamic", note: "cover tint" },
  { id: "albumCover", label: "Album cover", note: "cover focus" },
  { id: "cleanBlack", label: "Clean black", note: "plain black" },
  { id: "none", label: "None", note: "hide hero art" }
];

const BLUR_EFFECT_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "off", label: "Off", note: "flat" },
  { id: "subtle", label: "Subtle", note: "light glass" },
  { id: "normal", label: "Normal", note: "balanced" },
  { id: "strong", label: "Strong", note: "more glass" }
];

const MEDIA_CARD_BACKGROUND_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "solid", label: "Solid", note: "flat cards" },
  { id: "glassy", label: "Glassy", note: "transparent" },
  { id: "acrylic", label: "Acrylic", note: "acrylic" },
  { id: "oledFlat", label: "OLED flat", note: "black" }
];

const HOME_LAYOUT_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "compact", label: "Compact", note: "smaller" },
  { id: "balanced", label: "Balanced", note: "default" },
  { id: "bigHero", label: "Big hero", note: "larger hero" },
  { id: "minimal", label: "Minimal", note: "simple" }
];

const LIBRARY_ROW_STYLE_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "compactRows", label: "Compact rows", note: "smaller rows" },
  { id: "comfyRows", label: "Comfy rows", note: "readable" },
  { id: "coverCards", label: "Cover cards", note: "cover-first" },
  { id: "listOnly", label: "List only", note: "plain list" }
];

const STAR_INTENSITY_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "off", label: "Off", note: "hidden" },
  { id: "subtle", label: "Subtle", note: "default" },
  { id: "normal", label: "Normal", note: "clear" },
  { id: "bright", label: "Bright", note: "brighter" }
];

const SIDEBAR_BEHAVIOR_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "fixed", label: "Fixed", note: "normal" },
  { id: "slim", label: "Slim", note: "narrow" },
  { id: "hover", label: "Expand on hover", note: "hover open" }
];

const PLAYER_BACKGROUND_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "flat", label: "Flat", note: "flat" },
  { id: "coverBlur", label: "Cover blur", note: "cover glow" },
  { id: "acrylic", label: "Acrylic", note: "acrylic" },
  { id: "oledBlack", label: "OLED black", note: "black" }
];

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
        "AppImage: chmod +x localtify-0.3.7-x64.AppImage, then run it directly.",
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
  currentTheme,
  settings,
  updateSetting,
  visibleThemes,
  THEME_SWATCH_COLORS,
  effectiveTheme,
  randomizeCustomThemePalette,
  resetCustomThemePalette,
  saveCurrentCustomThemePreset,
  customThemeName,
  setCustomThemeName,
  currentSong,
  BUILT_IN_CUSTOM_THEME_PRESETS,
  applyCustomThemePreset,
  savedCustomThemes,
  removeSavedCustomThemePreset,
  customThemeTokens,
  customThemeHexDrafts,
  handleCustomThemeNativeColor,
  handleCustomThemeHexDraftChange,
  commitCustomThemeHexDraft,
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
  rebuildSearchIndexAction,
  importSongs,
  importAnimation,
  libraryScanMessage,
  newPlaylistName,
  setNewPlaylistName,
  createPlaylist,
  changeView,
  clearQueue,
  playQueue,
  repeatPlaylist,
  setRepeatPlaylist,
  playlists,
  openPlaylist,
  playPlaylist,
  removePlaylist,
  pixelArtAssets,
  pixelArtBusy,
  randomizeAllCovers,
  rescanPixelArtFolder,
  downloadFolderLabel,
  chooseDownloadFolder,
  APP_VERSION,
  updatePrompt,
  updateStatusLabel,
  manualUpdateCheck,
  askUpdaterToInstall,
  skipAvailableUpdate,
  setWhatsNewOpen,
  whatsNewItems,
  copyDiagnosticsInfo,
  diagnosticsCopied,
  diagnosticsInfo,
  platformInfo,
  likedSongs,
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

return (
  <>
    {settingsCategory === "appearance" ? (
      <section className="settingsCategoryPage" aria-label="Appearance settings">
        <div className="settingsCategoryHeader">
          <div>
            <p className="eyebrow">appearance</p>
            <h4>how the app looks</h4>
          </div>
          <span>{currentTheme.name} theme active</span>
        </div>

        <div className="settingsPanelCard">
          <div className="settingsPanelHeader">
            <div>
              <strong>Choose theme</strong>
              <span>Pick the base look of localtify.</span>
            </div>
          </div>

          <div className="settingsThemeSelectPanel">
            <label className="settingsSelectField">
              <span>theme</span>
              <select
                value={settings.theme}
                disabled={settings.customThemeEnabled}
                title={settings.customThemeEnabled ? "Turn off custom theme before choosing a preset." : "Choose theme"}
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

            {settings.customThemeEnabled ? (
              <p className="themePickerLockNoteV026">custom theme is on, so preset themes are locked.</p>
            ) : null}

            <div className="settingsThemeSelectedPreview" aria-live="polite">
              <span className="settingsThemeDot" style={{ background: THEME_SWATCH_COLORS[effectiveTheme] ?? THEME_SWATCH_COLORS.mint }} aria-hidden="true" />
              <div>
                <strong>{settings.customThemeEnabled ? "custom theme" : currentTheme.name}</strong>
                <small>{currentTheme.note}</small>
              </div>
            </div>
          </div>
        </div>

        <div className="settingsPanelCard visualCustomizationCardV205">
          <div className="settingsPanelHeader visualCustomizationHeaderV205">
            <div>
              <strong>Visuals</strong>
              <span>Quick controls for the home screen, cards, stars, sidebar, and player.</span>
            </div>
          </div>

          <div className="visualCustomizationGridV205">
            <VisualOptionGroup
              title="Home banner"
              note="Top area style."
              options={HOME_BANNER_TYPE_OPTIONS}
              value={readSettingChoice(settings, "homeBannerType", "dynamic")}
              onChange={(value) => updateSetting("homeBannerType", value)}
            />

            <VisualOptionGroup
              title="Blur effects"
              note="Controls glass/blur strength."
              options={BLUR_EFFECT_OPTIONS}
              value={readSettingChoice(settings, "blurEffects", "normal")}
              onChange={(value) => updateSetting("blurEffects", value)}
            />

            <VisualOptionGroup
              title="Card background"
              note="Panel/card surface style."
              options={MEDIA_CARD_BACKGROUND_OPTIONS}
              value={readSettingChoice(settings, "mediaCardBackground", "acrylic")}
              onChange={(value) => updateSetting("mediaCardBackground", value)}
            />

            <VisualOptionGroup
              title="Home layout"
              note="Home screen density."
              options={HOME_LAYOUT_OPTIONS}
              value={readSettingChoice(settings, "homeLayoutMode", "balanced")}
              onChange={(value) => updateSetting("homeLayoutMode", value)}
            />

            <VisualOptionGroup
              title="Library rows"
              note="Library list density."
              options={LIBRARY_ROW_STYLE_OPTIONS}
              value={readSettingChoice(settings, "libraryRowStyle", "comfyRows")}
              onChange={(value) => updateSetting("libraryRowStyle", value)}
            />

            <VisualOptionGroup
              title="Stars"
              note="Star field strength."
              options={STAR_INTENSITY_OPTIONS}
              value={readSettingChoice(settings, "starsIntensity", "subtle")}
              onChange={(value) => updateSetting("starsIntensity", value)}
            />

            <VisualOptionGroup
              title="Sidebar"
              note="Sidebar width behavior."
              options={SIDEBAR_BEHAVIOR_OPTIONS}
              value={readSettingChoice(settings, "sidebarBehavior", "fixed")}
              onChange={(value) => updateSetting("sidebarBehavior", value)}
            />

            <VisualOptionGroup
              title="Player background"
              note="Bottom bar style."
              options={PLAYER_BACKGROUND_OPTIONS}
              value={readSettingChoice(settings, "playerBackgroundStyle", "coverBlur")}
              onChange={(value) => updateSetting("playerBackgroundStyle", value)}
            />
          </div>
        </div>

        <div className="settingsPanelCard customThemeManagerV027">
          <div className="settingsPanelHeader customThemeHeaderV027">
            <div>
              <strong>Custom theme</strong>
              <span>Turn on a custom theme and adjust the main colors.</span>
            </div>
            <div className="settingsHeaderActionsV027">
              <label className="cleanToggleLabel">
                <input type="checkbox" checked={settings.customThemeEnabled} onChange={(event) => updateSetting("customThemeEnabled", event.currentTarget.checked)} />
                <span>{settings.customThemeEnabled ? "Custom theme on" : "Custom theme off"}</span>
              </label>
              <button className="settingsTinyButton" type="button" onClick={randomizeCustomThemePalette}>Random colors</button>
              <button className="settingsTinyButton" type="button" onClick={resetCustomThemePalette}>Reset colors</button>
              <button className="settingsTinyButton" type="button" onClick={saveCurrentCustomThemePreset}>Save theme</button>
            </div>
          </div>

          <div className="customThemeBodyV027">
            <label className="settingsTextFieldV027">
              <span>Theme name</span>
              <input value={customThemeName} onChange={(event) => setCustomThemeName(event.currentTarget.value)} aria-label="Custom theme name" />
            </label>

            <div className="customThemePreviewV027" aria-live="polite">
              <span>Preview</span>
              <strong>{currentSong?.title || "localtify preview"}</strong>
              <small>{currentSong?.artist || "sample artist"}</small>
              <div className="customThemePreviewBarV027" aria-hidden="true">
                <i />
              </div>
            </div>
          </div>

          <div className="customThemePresetRowV027" aria-label="Built in custom theme presets">
            {BUILT_IN_CUSTOM_THEME_PRESETS.map((preset) => (
              <button key={preset.name} className="customThemePresetButtonV027" type="button" onClick={() => applyCustomThemePreset(preset)}>
                <span style={{ background: preset.colors.customThemeColor }} aria-hidden="true" />
                <strong>{preset.name}</strong>
                <small>{preset.note}</small>
              </button>
            ))}
          </div>

          {savedCustomThemes.length > 0 ? (
            <div className="savedThemeRowV027" aria-label="Saved custom themes">
              {savedCustomThemes.map((preset) => (
                <div key={preset.id} className="savedThemeButtonV027">
                  <button type="button" onClick={() => applyCustomThemePreset(preset)}>
                    <span style={{ background: preset.colors.customThemeColor }} aria-hidden="true" />
                    <strong>{preset.name}</strong>
                  </button>
                  <button type="button" onClick={() => removeSavedCustomThemePreset(preset.id)} aria-label={`Remove ${preset.name}`}>
                    remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="customThemeTokenGridV027">
            {customThemeTokens.map((token) => {
              const hexDraft = customThemeHexDrafts[token.key] ?? token.value;

              return (
                <div className="customThemeTokenV027" key={token.key}>
                  <label className="customThemeColorPickerV032" title={`Pick ${token.label.toLowerCase()} color`}>
                    <span className="customThemeColorPreviewV027" style={{ background: token.value }} aria-hidden="true" />
                    <input
                      className="customThemeNativeColorInputV027"
                      type="color"
                      value={token.value}
                      onInput={(event) => handleCustomThemeNativeColor(token.key, event.currentTarget.value)}
                      onChange={(event) => handleCustomThemeNativeColor(token.key, event.currentTarget.value)}
                      aria-label={`${token.label} color picker`}
                    />
                  </label>
                  <strong>{token.label}</strong>
                  <small>{token.help}</small>
                  <input
                    className="customThemeHexInputV032"
                    type="text"
                    inputMode="text"
                    spellCheck={false}
                    autoCapitalize="off"
                    maxLength={7}
                    value={hexDraft}
                    onChange={(event) => handleCustomThemeHexDraftChange(token.key, event.currentTarget.value)}
                    onBlur={(event) => commitCustomThemeHexDraft(token.key, event.currentTarget.value, token.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
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

        <div className="settingsTwoColumn">
          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Layout</strong>
                <span>Change spacing and screen density.</span>
              </div>
            </div>
            <div className="settingsMiniGrid">
              <ToggleRow label="Right side cards" help="Shows the optional right column." checked={settings.showRightColumn} onChange={(value) => updateSetting("showRightColumn", value)} />
              <ToggleRow label="Expanded now playing" help="Makes the hero area larger." checked={settings.heroExpanded} onChange={(value) => updateSetting("heroExpanded", value)} />
              <ToggleRow label="Compact player" help="Keeps the bottom player smaller." checked={settings.compactPlayer} onChange={(value) => updateSetting("compactPlayer", value)} />
              <ToggleRow label="Compact library" help="Fits smaller rows." checked={settings.denseList} onChange={(value) => updateSetting("denseList", value)} />
              <ToggleRow label="Reduce motion" help="Turns off most decorative animations." checked={settings.reducedMotion} onChange={(value) => updateSetting("reducedMotion", value)} />
            </div>
          </div>

          <div className="settingsPanelCard coverSyncSettingsCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Cards and ambience</strong>
                <span>Control library cards, corners, and cover tint.</span>
              </div>
            </div>
            <div className="settingsMiniGrid">
              <ToggleRow label="Soft corners" help="Uses rounder cards and buttons." checked={settings.softCorners} onChange={(value) => updateSetting("softCorners", value)} />
              <ToggleRow label="Floating notes" help="Shows tiny music note particles." checked={settings.showFloatingNotes} onChange={(value) => updateSetting("showFloatingNotes", value)} />
              <ToggleRow label="Animated glow" help="Keeps ambience on, but pauses it during fast screen switches." checked={settings.animatedGlow} onChange={(value) => updateSetting("animatedGlow", value)} />
            </div>

            <div className="coverSyncPicker modalCoverSyncPicker">
              <div className="coverSyncHeader">
                <strong>Cover Color Sync</strong>
                <small>Pick how strongly the current cover tints the app.</small>
              </div>
              <div className="coverSyncOptions" role="group" aria-label="Cover Color Sync strength">
                {coverColorSyncOptions.map((option) => (
                  <button key={option.id} className={`coverSyncChoice ${selectedCoverColorSyncMode === option.id ? "active" : ""}`} type="button" onClick={() => updateCoverColorSyncMode(option.id)} aria-pressed={selectedCoverColorSyncMode === option.id}>
                    <strong>{option.label}</strong>
                    <span>{option.note}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    ) : null}

    {settingsCategory === "playback" ? (
      <section className="settingsCategoryPage" aria-label="Playback settings">
        <div className="settingsCategoryHeader">
          <div>
            <p className="eyebrow">playback</p>
            <h4>how songs play</h4>
          </div>
          <span>local music controls</span>
        </div>

        <div className="settingsTwoColumn">
          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Song transitions</strong>
                <span>Make switching between songs smoother.</span>
              </div>
            </div>
            <RangeRow label="Crossfade" value={settings.crossfadeSeconds} min={0} max={10} step={1} suffix="s" onChange={(value) => updateSetting("crossfadeSeconds", value)} />
            <ToggleRow label="Crossfade enabled" help="Turns the crossfade setting on or off." checked={settings.crossfadeEnabled} onChange={(value) => updateSetting("crossfadeEnabled", value)} />
            <ToggleRow label="Gapless playback" help="Starts the next song without silence." checked={settings.gaplessPlayback} onChange={(value) => updateSetting("gaplessPlayback", value)} />
          </div>

          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Playback feel</strong>
                <span>Small controls for speed and loudness.</span>
              </div>
            </div>
            <RangeRow label="Speed" value={settings.playbackSpeed} min={0.75} max={1.5} step={0.05} suffix="x" onChange={(value) => updateSetting("playbackSpeed", value)} />
            <RangeRow label="Volume" value={settings.volume} min={0} max={1} step={0.01} suffix="" onChange={(value) => updateSetting("volume", value)} />
            <ToggleRow label="Volume normalization" help="Balances loud and quiet files." checked={settings.volumeNormalization} onChange={(value) => updateSetting("volumeNormalization", value)} />
            <ToggleRow label="Per-song volume" help="Remembers custom volume per track." checked={settings.perSongVolumeMemory} onChange={(value) => updateSetting("perSongVolumeMemory", value)} />
            <ToggleRow label="Sleep timer" help="Lets the app stop after a set time." checked={settings.sleepTimerMinutes > 0} onChange={(value) => updateSetting("sleepTimerMinutes", value ? 30 : 0)} />
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

        <div className="settingsPanelCard">
          <div className="settingsPanelHeader">
            <div>
              <strong>Title cleanup</strong>
              <span>Controls the text cleanup used by Discord and metadata previews.</span>
            </div>
          </div>
          <div className="optionGrid three discordOptionGrid">
            {discordCleanupOptions.map((option) => (
              <button key={option.id} className={`settingsChoice ${settings.discordTitleCleanup === option.id ? "active" : ""}`} type="button" onClick={() => updateSetting("discordTitleCleanup", option.id)}>
                <strong>{option.name}</strong>
                <small>{option.note}</small>
              </button>
            ))}
          </div>
        </div>
      </section>
    ) : null}

    {settingsCategory === "library" || settingsCategory === "metadata" ? (
      <section className="settingsCategoryPage" aria-label="Library settings">
        <div className="settingsCategoryHeader">
          <div>
            <p className="eyebrow">library</p>
            <h4>imports, search, and playlists</h4>
          </div>
          <span>{songs.length} songs indexed</span>
        </div>

        <div className="settingsTwoColumn">
          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Metadata cleanup</strong>
                <span>Control how messy file names are cleaned.</span>
              </div>
            </div>
            <div className="optionGrid three">
              {discordCleanupOptions.map((option) => (
                <button key={option.id} className={`settingsChoice ${settings.discordTitleCleanup === option.id ? "active" : ""}`} type="button" onClick={() => updateSetting("discordTitleCleanup", option.id)}>
                  <strong>{option.name}</strong>
                  <small>{option.note}</small>
                </button>
              ))}
            </div>
            <div className="settingsActionRow">
              <button className="settingsActionButton" type="button" disabled={libraryScanBusy} onClick={cleanLibraryMetadataAction}>clean all names</button>
              <button className="settingsActionButton" type="button" disabled={libraryScanBusy} onClick={rebuildSearchIndexAction}>rebuild search</button>
              <button className="settingsActionButton" type="button" onClick={importSongs} disabled={importAnimation.active}>import songs</button>
            </div>
            {libraryScanMessage ? <p className="settingsHintText">{libraryScanMessage}</p> : null}
          </div>

          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Playlists and queue</strong>
                <span>Create playlists, clear the queue, and test playback.</span>
              </div>
            </div>
            <div className="settingsActionRow">
              <input className="settingsInlineInput" value={newPlaylistName} onChange={(event) => setNewPlaylistName(event.currentTarget.value)} placeholder="new playlist name" />
              <button className="settingsActionButton" type="button" onClick={() => createPlaylist()}>create playlist</button>
              <button className="settingsActionButton" type="button" onClick={() => changeView("playlists", "settings")}>open playlists</button>
              <button className="settingsActionButton" type="button" onClick={clearQueue} disabled={playQueue.length === 0}>clear queue</button>
            </div>
            <ToggleRow label="Repeat active playlist" help="When the queue ends, localtify starts the active playlist again." checked={repeatPlaylist} onChange={(value) => setRepeatPlaylist(value)} />
            <div className="settingsPlainList settingsPlaylistList">
              {playlists.length ? playlists.map((playlist) => (
                <div className="settingsPlaylistItem" key={playlist.id}>
                  <span>
                    <strong>{playlist.name}</strong>
                    <small>{playlist.songIds.length} song{playlist.songIds.length === 1 ? "" : "s"}</small>
                  </span>
                  <div>
                    <button className="settingsTinyButton" type="button" onClick={() => openPlaylist(playlist.id)}>open</button>
                    <button className="settingsTinyButton" type="button" onClick={() => playPlaylist(playlist, false)} disabled={playlist.songIds.length === 0}>play</button>
                    <button className="settingsTinyButton" type="button" onClick={() => playPlaylist(playlist, true)} disabled={playlist.songIds.length === 0}>shuffle</button>
                    <button className="settingsTinyButton danger" type="button" onClick={() => removePlaylist(playlist.id)}>remove</button>
                  </div>
                </div>
              )) : <p className="settingsHintText">No playlists yet. Create one here, then add songs from the song editor.</p>}
            </div>
          </div>
        </div>
      </section>
    ) : null}

    {settingsCategory === "covers" ? (
      <section className="settingsCategoryPage" aria-label="Cover settings">
        <div className="settingsCategoryHeader">
          <div>
            <p className="eyebrow">covers</p>
            <h4>pixel art and cover tools</h4>
          </div>
          <span>{pixelArtAssets.length} pixel art assets</span>
        </div>

        <div className="settingsTwoColumn">
          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Cover gallery</strong>
                <span>Open the full cover page only when you need it, so settings stays light.</span>
              </div>
            </div>
            <div className="settingsActionRow">
              <button className="settingsActionButton" type="button" onClick={() => changeView("covers", "settings")}>open cover gallery</button>
              <button className="settingsActionButton" type="button" disabled={pixelArtBusy || songs.length === 0} onClick={randomizeAllCovers}>randomize all covers</button>
              <button className="settingsActionButton" type="button" disabled={pixelArtBusy} onClick={rescanPixelArtFolder}>rescan pixel art</button>
            </div>
            <p className="settingsHintText">{pixelArtBusy ? "working on pixel art..." : "Cover tools stay here, but the expensive gallery only renders when opened."}</p>
          </div>

          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Cover ambience</strong>
                <span>Control cover glow without making screen switching heavy.</span>
              </div>
            </div>
            <div className="settingsMiniGrid">
              <ToggleRow label="Cover glow" help="Adds cover-based glow to the UI." checked={settings.animatedGlow} onChange={(value) => updateSetting("animatedGlow", value)} />
              <ToggleRow label="Floating notes" help="Shows tiny music note particles." checked={settings.showFloatingNotes} onChange={(value) => updateSetting("showFloatingNotes", value)} />
              <ToggleRow label="Large artwork" help="Makes cover images bigger on the home page." checked={settings.homeExpanded} onChange={(value) => updateSetting("homeExpanded", value)} />
            </div>
          </div>
        </div>
      </section>
    ) : null}

    {settingsCategory === "downloads" ? (
      <section className="settingsContentBlock">
        <p className="eyebrow">downloads</p>
        <h2>download settings</h2>
        <p className="settingsLead">Choose how downloaded audio is saved, named, converted, and imported.</p>

        <div className="settingsGrid twoCols downloadSettingsGridV031">
          <div className="settingGroup">
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

          <div className="settingGroup">
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

        <div className="settingsCardStack downloadToggleStackV031">
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

          <label className="toggleRow">
            <span>
              <strong>Clean title after download</strong>
              <small>Removes common video words like official video/audio from downloaded filenames.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.downloadCleanTitle}
              onChange={(event) => void updateSetting("downloadCleanTitle", event.currentTarget.checked)}
            />
          </label>
        </div>

        <div className="settingGroup downloadFolderGroupV031">
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
      <section className="settingsCategoryPage settingsUpdatesPage" aria-label="Update settings">
        <div className="settingsCategoryHeader">
          <div>
            <p className="eyebrow">updates</p>
            <h4>updates and version</h4>
          </div>
          <span>version {APP_VERSION} • {activePlatformInfo.label}</span>
        </div>

        <div className="settingsTwoColumn settingsUpdatesGrid">
          <div className="settingsPanelCard settingsUpdatePanel">
            <div className="settingsPanelHeader">
              <div>
                <strong>Update status</strong>
                <span>Check for new releases and finish downloaded updates.</span>
              </div>
            </div>

            <div className="settingsUpdateSummary">
              <div className="settingsUpdateCurrent">
                <span className="settingsUpdateVersionBadge">{APP_VERSION}</span>
                <div>
                  <strong>Current version</strong>
                  <span>localtify {APP_VERSION}</span>
                </div>
              </div>

              <div className={`settingsUpdateMessage settingsUpdateMessage-${updatePrompt.status}`}>
                <strong>{updatePrompt.status === "idle" ? "Ready to check" : updatePrompt.status === "error" ? "Update check failed" : updateStatusLabel(updatePrompt.status)}</strong>
                <span>
                  {updatePrompt.error || updatePrompt.message || (updatePrompt.status === "idle" ? "Check for updates whenever you are ready." : "Update status will appear here.")}
                </span>
              </div>
            </div>

            <div className="settingsActionRow settingsUpdateActions">
              <button className="settingsActionButton settingsPrimaryAction" type="button" onClick={manualUpdateCheck} disabled={updatePrompt.status === "checking" || updatePrompt.status === "downloading"}>check now</button>
              <button className="settingsActionButton" type="button" onClick={askUpdaterToInstall} disabled={updatePrompt.status !== "downloaded"}>restart to install</button>
              <button className="settingsActionButton settingsGhostAction" type="button" onClick={skipAvailableUpdate} disabled={!updatePrompt.version || updatePrompt.status !== "available"}>skip version</button>
            </div>
          </div>

          <div className="settingsPanelCard settingsUpdateBehaviorPanel">
            <div className="settingsPanelHeader">
              <div>
                <strong>Update behavior</strong>
                <span>Choose how localtify checks for updates.</span>
              </div>
            </div>
            <div className="settingsMiniGrid">
              <ToggleRow label="Update checks" help="Checks for new releases while the app is open." checked={settings.autoUpdateEnabled} onChange={(value) => updateSetting("autoUpdateEnabled", value)} />
              <ToggleRow label="Notify only" help="Shows an update message instead of installing automatically." checked={settings.autoUpdateNotifyOnly} onChange={(value) => updateSetting("autoUpdateNotifyOnly", value)} />
            </div>
            <div className="settingsActionRow">
              <button className="settingsActionButton" type="button" onClick={() => setWhatsNewOpen(true)}>Open what’s new</button>
            </div>
          </div>
        </div>

        {showLinuxInstallNotes ? (
          <div className="settingsPanelCard settingsFullWidthPanel settingsLinuxInstallPanel">
            <div className="settingsPanelHeader">
              <div>
                <strong>Linux packages</strong>
                <span>AppImage is the main universal Linux build. RPM and DEB are extra native installers.</span>
              </div>
            </div>
            <ul className="settingsPlainList settingsReleaseList">
              {linuxInstallNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="settingsPanelCard settingsFullWidthPanel">
          <div className="settingsPanelHeader">
            <div>
              <strong>What’s new in {APP_VERSION}</strong>
              <span>Short notes for this release.</span>
            </div>
          </div>
          <ul className="settingsPlainList settingsReleaseList">
            {whatsNewItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>
    ) : null}



    {settingsCategory === "about" ? (
      <section className="settingsCategoryPage" aria-label="About and diagnostics">
        <div className="settingsCategoryHeader">
          <div>
            <p className="eyebrow">about</p>
            <h4>localtify status</h4>
          </div>
          <span>version {APP_VERSION} • {activePlatformInfo.label}</span>
        </div>

        <div className="settingsPanelCard settingsFullWidthPanel settingsDiagnosticsPanel">
          <div className="settingsPanelHeader settingsDiagnosticsHeader">
            <div>
              <strong>App info</strong>
              <span>Copy this when reporting bugs so it is easier to understand your setup.</span>
            </div>
            <button className="settingsActionButton settingsCopyInfoButton" type="button" onClick={copyDiagnosticsInfo}>
              {diagnosticsCopied ? "copied" : "copy app info"}
            </button>
          </div>

          <div className="settingsDiagnosticsGrid">
            {diagnosticsInfo.items.map((item) => (
              <div className="settingsDiagnosticCard" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="settingsPanelCard settingsFullWidthPanel settingsPlatformPanel">
          <div className="settingsPanelHeader">
            <div>
              <strong>Platform support</strong>
              <span>Windows and Linux now use separate release packages, icons, and platform controls.</span>
            </div>
          </div>
          <div className="statusGrid">
            <span><strong>{activePlatformInfo.label}</strong><small>platform</small></span>
            <span><strong>{activePlatformInfo.releaseLabel}</strong><small>package</small></span>
            <span><strong>{activePlatformInfo.startupSettingSupported ? "available" : "hidden"}</strong><small>startup setting</small></span>
            <span><strong>{showLinuxInstallNotes ? "ready" : "standard"}</strong><small>release notes</small></span>
          </div>
        </div>

        <div className="settingsPanelCard settingsFullWidthPanel settingsDiagnosticsCopyPanel">
          <div className="settingsPanelHeader">
            <div>
              <strong>Bug report text</strong>
              <span>No song names, file paths, or private library metadata are included.</span>
            </div>
          </div>
          <textarea className="settingsDiagnosticsText" readOnly value={diagnosticsInfo.copyText} aria-label="localtify diagnostics text" />
        </div>
      </section>
    ) : null}

    {settingsCategory === "advanced" ? (
      <section className="settingsCategoryPage" aria-label="Advanced settings">
        <div className="settingsCategoryHeader">
          <div>
            <p className="eyebrow">advanced</p>
            <h4>reset and app status</h4>
          </div>
          <span>version {APP_VERSION} • {activePlatformInfo.label}</span>
        </div>

        <div className="settingsTwoColumn">
          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>App status</strong>
                <span>Quick library and importer status.</span>
              </div>
            </div>
            <div className="statusGrid">
              <span><strong>{songs.length}</strong><small>songs</small></span>
              <span><strong>{likedSongs.length}</strong><small>liked</small></span>
              <span><strong>{pixelArtAssets.length}</strong><small>pixel art</small></span>
              <span><strong>{importAnimation.active ? "busy" : "ready"}</strong><small>importer</small></span>
            </div>
          </div>

          <div className="settingsPanelCard">
            <div className="settingsPanelHeader">
              <div>
                <strong>Search and library</strong>
                <span>Rebuild search if imported songs do not appear correctly.</span>
              </div>
            </div>
            <div className="settingsActionRow">
              <button className="settingsActionButton" type="button" disabled={libraryScanBusy} onClick={rebuildSearchIndexAction}>Rebuild search</button>
              <button className="settingsActionButton" type="button" onClick={() => {
                libraryRenderLimitRef.current = INITIAL_LIBRARY_RENDER_LIMIT;
                setLibraryRenderLimit(INITIAL_LIBRARY_RENDER_LIMIT);
              }}>Reset loaded songs</button>
            </div>
          </div>
        </div>

        <div className="settingsPanelCard settingsFullWidthPanel">
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
            ) : null}
          </div>
        </div>

        <div className="settingsPanelCard settingsFullWidthPanel settingsResetPanel">
          <div className="settingsPanelHeader">
            <div>
              <strong>Reset settings</strong>
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
