import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

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
  album?: string;
  [key: string]: any;
};

type ImportAnimationLike = {
  active: boolean;
  [key: string]: any;
};

type UpdatePromptLike = {
  status?: string;
  version?: string;
  message?: string;
  error?: string;
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

type VisualCustomizationOption = {
  id: string;
  label: string;
  note: string;
};

type OptionItem = {
  id: string;
  label: string;
  note?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function numberSetting(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolSetting(value: unknown) {
  return Boolean(value);
}

function textSetting(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function optionLabel(option: ChoiceOption | ThemeOption | OptionItem | CustomThemePresetOption) {
  return "label" in option && option.label ? option.label : "name" in option && option.name ? option.name : option.id;
}

function optionNote(option: ChoiceOption | ThemeOption | OptionItem | CustomThemePresetOption) {
  return "note" in option && option.note ? option.note : "";
}

function safeHex(value: string) {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : "#7dd3fc";
}

function run(action: (...args: any[]) => void | Promise<void>, ...args: any[]) {
  void action(...args);
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
      releaseLabel: "AppImage, RPM, and DEB",
      startupSettingSupported: false,
      desktopControlsLabel: "Linux desktop controls",
      desktopControlsHelp: "Tray and media keys work when your desktop environment exposes them.",
      startupSettingLabel: "Linux autostart",
      startupSettingHelp: "Linux autostart will use a desktop entry flow later.",
      linuxInstallNotes: [
        "AppImage works as the universal Linux package.",
        "RPM is for Fedora, openSUSE, and RHEL-style distros.",
        "DEB is for Ubuntu, Debian, Linux Mint, and related distros."
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
      desktopControlsHelp: "macOS controls are hidden until a macOS release exists.",
      startupSettingLabel: "Start localtify with macOS",
      startupSettingHelp: "macOS autostart can be added later with a signed build.",
      linuxInstallNotes: []
    };
  }

  return {
    id: isWindows ? "windows" : "unknown",
    label: isWindows ? "Windows" : "Unknown desktop",
    releaseLabel: isWindows ? "NSIS installer" : "Desktop build",
    startupSettingSupported: isWindows,
    desktopControlsLabel: isWindows ? "Windows controls" : "Desktop controls",
    desktopControlsHelp: isWindows ? "Use media keys, taskbar controls, tray controls, and Windows now playing." : "Tray and media keys work where your desktop supports them.",
    startupSettingLabel: "Start localtify when Windows starts",
    startupSettingHelp: "Keeps localtify ready after you sign in.",
    linuxInstallNotes: []
  };
}

function PageHeader({
  eyebrow,
  title,
  detail,
  meta
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  meta?: string;
}) {
  return (
    <div className="settingsCategoryHeader">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h4>{title}</h4>
        {detail ? <p className="settingsLead">{detail}</p> : null}
      </div>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}

function Panel({
  title,
  note,
  children,
  action,
  className = ""
}: {
  title: string;
  note?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`settingsPanelCard ${className}`}>
      <div className="settingsPanelHeader">
        <div>
          <strong>{title}</strong>
          {note ? <span>{note}</span> : null}
        </div>
        {action ? <div className="settingsPanelHeaderAction">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  help,
  checked,
  disabled,
  onChange
}: {
  label: string;
  help?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`toggleRow ${checked ? "active" : ""} ${disabled ? "disabled" : ""}`} title={help || label}>
      <span className="toggleRowCopy">
        <span className="settingsLabelLine">
          <strong>{label}</strong>
          {help ? <span className="settingsInfoDot" aria-hidden="true">i</span> : null}
        </span>
        {help ? <small>{help}</small> : null}
      </span>
      <input type="checkbox" role="switch" aria-label={label} aria-checked={checked} checked={checked} disabled={disabled} onChange={(event) => onChange(event.currentTarget.checked)} />
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
  disabled,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const activeValue = editing ? draftValue : value;
  const fill = ((activeValue - min) / (max - min || 1)) * 100;
  const displayValue = step < 1 ? activeValue.toFixed(step < 0.05 ? 2 : 1).replace(/\.0$/, "") : String(Math.round(activeValue));

  useEffect(() => {
    if (!editing) setDraftValue(value);
  }, [editing, value]);

  function commit(nextValue = draftValue) {
    const clamped = clamp(nextValue, min, max);
    setDraftValue(clamped);
    setEditing(false);
    if (clamped !== value) onChange(clamped);
  }

  return (
    <label className={`rangeRow ${disabled ? "disabled" : ""}`} title={`${label}: ${displayValue}${suffix || ""}`}>
      <span className="rangeRowCopy">
        <span className="settingsLabelLine">
          <strong>{label}</strong>
          <span className="settingsInfoDot" aria-hidden="true">i</span>
        </span>
        <small>{displayValue}{suffix || ""}</small>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={activeValue}
        disabled={disabled}
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

function ChoiceGrid({
  options,
  value,
  onChange,
  columns = "auto",
  ariaLabel
}: {
  options: ReadonlyArray<ChoiceOption | OptionItem | ThemeOption>;
  value: string;
  onChange: (value: string) => void;
  columns?: "auto" | "two" | "three" | "four";
  ariaLabel?: string;
}) {
  return (
    <div className={`settingsChoiceGrid settingsChoiceGrid-${columns}`} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          className={`settingsChoice ${value === option.id ? "active" : ""}`}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
        >
          <strong>{optionLabel(option)}</strong>
          {optionNote(option) ? <small>{optionNote(option)}</small> : null}
        </button>
      ))}
    </div>
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
    <div className="visualOptionGroup">
      <div className="visualOptionGroupHead">
        <strong>{title}</strong>
        <span>{note}</span>
      </div>
      <ChoiceGrid options={options} value={value} onChange={onChange} columns="three" ariaLabel={title} />
    </div>
  );
}

function StatGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="settingsStatGrid">
      {items.map((item) => (
        <span key={item.label}>
          <strong>{item.value}</strong>
          <small>{item.label}</small>
        </span>
      ))}
    </div>
  );
}

function ThemePresetButton({
  preset,
  active,
  onClick,
  onRemove
}: {
  preset: CustomThemePresetOption;
  active?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  const accent = preset.colors?.customThemeColor || preset.colors?.customThemeAccent || "#7dd3fc";

  return (
    <div className={`settingsPresetItem ${active ? "active" : ""}`} style={{ ["--preset-accent" as string]: accent } as CSSProperties}>
      <button type="button" onClick={onClick}>
        <i aria-hidden="true" />
        <span>
          <strong>{preset.name}</strong>
          {preset.note ? <small>{preset.note}</small> : null}
        </span>
      </button>
      {onRemove ? <button className="settingsTinyButton danger" type="button" onClick={onRemove} aria-label={`Remove ${preset.name}`}>remove</button> : null}
    </div>
  );
}

function EmptyState({ title, note }: { title: string; note: string }) {
  return (
    <div className="settingsEmptyState">
      <strong>{title}</strong>
      <span>{note}</span>
    </div>
  );
}

const HOME_BANNER_TYPE_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "dynamic", label: "Dynamic", note: "cover tint" },
  { id: "albumCover", label: "Album cover", note: "cover focus" },
  { id: "cleanBlack", label: "Clean black", note: "plain black" },
  { id: "none", label: "None", note: "hide hero art" }
];

const MEDIA_CARD_BACKGROUND_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "solid", label: "Solid", note: "flat cards" },
  { id: "glassy", label: "Glassy", note: "soft glass" },
  { id: "oledFlat", label: "OLED flat", note: "black" }
];

const HOME_LAYOUT_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "compact", label: "Compact", note: "smaller" },
  { id: "balanced", label: "Balanced", note: "default" },
  { id: "bigHero", label: "Big hero", note: "larger hero" }
];

const LIBRARY_ROW_STYLE_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "compactRows", label: "Compact rows", note: "smaller rows" },
  { id: "comfyRows", label: "Comfy rows", note: "readable" },
  { id: "coverCards", label: "Cover cards", note: "cover-first" },
  { id: "listOnly", label: "List only", note: "plain list" }
];

const SIDEBAR_BEHAVIOR_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "fixed", label: "Fixed", note: "normal" },
  { id: "slim", label: "Slim", note: "narrow" },
  { id: "hover", label: "Expand", note: "hover open" }
];

const PLAYER_BACKGROUND_OPTIONS: ReadonlyArray<VisualCustomizationOption> = [
  { id: "flat", label: "Flat", note: "stable" },
  { id: "coverBlur", label: "Cover blur", note: "soft" },
  { id: "oledBlack", label: "OLED", note: "black" }
];

const DOWNLOAD_QUALITY_OPTIONS: ReadonlyArray<OptionItem> = [
  { id: "best", label: "Best", note: "highest available" },
  { id: "320", label: "320kbps", note: "large mp3" },
  { id: "256", label: "256kbps", note: "balanced" },
  { id: "192", label: "192kbps", note: "smaller" }
];

const DOWNLOAD_FORMAT_OPTIONS: ReadonlyArray<OptionItem> = [
  { id: "mp3", label: "MP3", note: "recommended" },
  { id: "flac", label: "FLAC", note: "larger files" },
  { id: "wav", label: "WAV", note: "huge raw files" }
];

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
  cleanSelectedMetadataAction,
  metadataSelectedCount = 0,
  metadataCleanPreview,
  applyMetadataCleanPreviewAction,
  cancelMetadataCleanPreviewAction,
  undoLastMetadataCleanAction,
  metadataUndoCount = 0,
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

  const linuxInstallNotes = activePlatformInfo.linuxInstallNotes?.length ? activePlatformInfo.linuxInstallNotes : fallbackPlatformInfo.linuxInstallNotes;
  const showLinuxInstallNotes = activePlatformInfo.id === "linux" || linuxInstallNotes.length > 0;
  const selectedThemeColor = THEME_SWATCH_COLORS[effectiveTheme] ?? THEME_SWATCH_COLORS.mint ?? "#7dd3fc";
  const previewSongTitle = currentSong?.title || "No song playing";
  const previewSongArtist = currentSong?.artist || "local files";

  if (settingsCategory === "appearance") {
    return (
      <section className="settingsCategoryPage" aria-label="Appearance settings">
        <PageHeader eyebrow="appearance" title="how the app looks" detail="Theme, density, motion, and custom color controls in one stable layout." meta={`${currentTheme.name} theme`} />

        <Panel title="Theme" note="Choose the base look. Presets lock while custom theme is enabled.">
          <div className="settingsThemeSelectPanel">
            <label className="settingsSelectField">
              <span>base theme</span>
              <select value={settings.theme} disabled={boolSetting(settings.customThemeEnabled)} onChange={(event) => run(updateSetting, "theme", event.currentTarget.value as ThemeId)} aria-label="Choose theme">
                {visibleThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
              </select>
            </label>
            <div className="settingsThemeSelectedPreview" aria-live="polite">
              <span className="settingsThemeDot" style={{ background: selectedThemeColor }} aria-hidden="true" />
              <div>
                <strong>{boolSetting(settings.customThemeEnabled) ? "custom theme" : currentTheme.name}</strong>
                <small>{currentTheme.note || "Ready"}</small>
              </div>
            </div>
          </div>

          <div className="settingsThemeGrid" aria-label="Theme presets">
            {visibleThemes.map((theme) => (
              <button
                key={theme.id}
                className={`settingsThemeCard ${!settings.customThemeEnabled && settings.theme === theme.id ? "active" : ""}`}
                type="button"
                disabled={boolSetting(settings.customThemeEnabled)}
                onClick={() => run(updateSetting, "theme", theme.id as ThemeId)}
                aria-pressed={!settings.customThemeEnabled && settings.theme === theme.id}
              >
                <span className="settingsThemeSwatch" style={{ background: THEME_SWATCH_COLORS[theme.id] ?? selectedThemeColor }} aria-hidden="true" />
                <strong>{theme.name}</strong>
                {theme.note ? <small>{theme.note}</small> : null}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Visual density" note="Small layout controls that do not remount the app.">
          <div className="visualCustomizationGrid">
            <VisualOptionGroup title="Home banner" note="Top area style" options={HOME_BANNER_TYPE_OPTIONS} value={textSetting(settings.homeBannerType, "dynamic")} onChange={(value) => run(updateSetting, "homeBannerType", value)} />
            <VisualOptionGroup title="Card background" note="Surface style" options={MEDIA_CARD_BACKGROUND_OPTIONS} value={textSetting(settings.mediaCardBackground, "glassy")} onChange={(value) => run(updateSetting, "mediaCardBackground", value)} />
            <VisualOptionGroup title="Home layout" note="Home screen density" options={HOME_LAYOUT_OPTIONS} value={textSetting(settings.homeLayoutMode, "balanced")} onChange={(value) => run(updateSetting, "homeLayoutMode", value)} />
            <VisualOptionGroup title="Library rows" note="Library list density" options={LIBRARY_ROW_STYLE_OPTIONS} value={textSetting(settings.libraryRowStyle, "comfyRows")} onChange={(value) => run(updateSetting, "libraryRowStyle", value)} />
            <VisualOptionGroup title="Sidebar" note="Navigation behavior" options={SIDEBAR_BEHAVIOR_OPTIONS} value={textSetting(settings.sidebarBehavior, "fixed")} onChange={(value) => run(updateSetting, "sidebarBehavior", value)} />
            <VisualOptionGroup title="Player background" note="Bottom bar style" options={PLAYER_BACKGROUND_OPTIONS} value={textSetting(settings.playerBackgroundStyle, "coverBlur")} onChange={(value) => run(updateSetting, "playerBackgroundStyle", value)} />
          </div>
        </Panel>

        <div className="settingsTwoColumn">
          <Panel title="Motion and comfort" note="Keep animation smooth without heavy repainting.">
            <div className="settingsMiniGrid">
              <ToggleRow label="Reduced motion" help="Uses calmer transitions across settings and library." checked={boolSetting(settings.reducedMotion)} onChange={(value) => run(updateSetting, "reducedMotion", value)} />
              <ToggleRow label="Soft corners" help="Uses rounded cards and controls." checked={settings.softCorners !== false} onChange={(value) => run(updateSetting, "softCorners", value)} />
              <ToggleRow label="Compact player" help="Shrinks the bottom player area." checked={boolSetting(settings.compactPlayer)} onChange={(value) => run(updateSetting, "compactPlayer", value)} />
              <ToggleRow label="Right column" help="Shows the side panel on wider layouts." checked={settings.showRightColumn !== false} onChange={(value) => run(updateSetting, "showRightColumn", value)} />
            </div>
          </Panel>

          <Panel title="Custom theme" note="Create or tune your own palette.">
            <div className="settingsActionRow">
              <ToggleRow label="Enable custom theme" checked={boolSetting(settings.customThemeEnabled)} onChange={(value) => run(updateSetting, "customThemeEnabled", value)} />
              <button className="settingsActionButton" type="button" onClick={randomizeCustomThemePalette}>randomize</button>
              <button className="settingsActionButton" type="button" onClick={resetCustomThemePalette}>reset</button>
            </div>
            <div className="settingsInlineForm">
              <input className="settingsInlineInput" value={customThemeName} onChange={(event) => setCustomThemeName(event.currentTarget.value)} placeholder="custom theme name" aria-label="Custom theme name" />
              <button className="settingsActionButton settingsPrimaryAction" type="button" onClick={saveCurrentCustomThemePreset}>save preset</button>
            </div>
          </Panel>
        </div>

        {boolSetting(settings.customThemeEnabled) ? (
          <Panel title="Custom palette" note="Edit color tokens without changing the page layout.">
            <div className="settingsPresetGrid">
              {BUILT_IN_CUSTOM_THEME_PRESETS.map((preset) => (
                <ThemePresetButton key={preset.id} preset={preset} onClick={() => run(applyCustomThemePreset, preset)} />
              ))}
            </div>

            {savedCustomThemes.length ? (
              <div className="settingsPresetGrid settingsSavedPresetGrid">
                {savedCustomThemes.map((preset) => (
                  <ThemePresetButton key={preset.id} preset={preset} onClick={() => run(applyCustomThemePreset, preset)} onRemove={() => removeSavedCustomThemePreset(preset.id)} />
                ))}
              </div>
            ) : null}

            <div className="settingsTokenGrid">
              {customThemeTokens.map((token) => {
                const draft = customThemeHexDrafts[token.key] ?? token.value;
                return (
                  <label className="settingsTokenCard" key={token.key}>
                    <input className="themeColorInput" type="color" value={safeHex(draft)} onChange={(event) => run(handleCustomThemeNativeColor, token.key, event.currentTarget.value)} aria-label={`${token.label} color`} />
                    <span className="themeTokenVisual" style={{ background: safeHex(draft) }} aria-hidden="true" />
                    <span className="themeTokenCopy">
                      <strong>{token.label}</strong>
                      {token.help ? <small>{token.help}</small> : null}
                    </span>
                    <input
                      className="accentTextInput"
                      value={draft}
                      onChange={(event) => run(handleCustomThemeHexDraftChange, token.key, event.currentTarget.value)}
                      onBlur={() => run(commitCustomThemeHexDraft, token.key)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") run(commitCustomThemeHexDraft, token.key);
                      }}
                      aria-label={`${token.label} hex value`}
                    />
                  </label>
                );
              })}
            </div>
          </Panel>
        ) : null}

        <Panel title="Cover color sync" note="Choose how album art influences the UI.">
          <ChoiceGrid options={coverColorSyncOptions} value={selectedCoverColorSyncMode} onChange={(value) => run(updateCoverColorSyncMode, value)} columns="three" ariaLabel="Cover color sync" />
        </Panel>
      </section>
    );
  }

  if (settingsCategory === "playback") {
    return (
      <section className="settingsCategoryPage" aria-label="Playback settings">
        <PageHeader eyebrow="playback" title="how songs play" detail="Smooth transitions, volume, and playback behavior." meta={currentSong ? `${previewSongTitle} • ${previewSongArtist}` : "local music controls"} />

        <div className="settingsTwoColumn">
          <Panel title="Song transitions" note="Use measured timing so the audio system stays stable.">
            <div className="settingsMiniGrid">
              <RangeRow label="Crossfade" value={numberSetting(settings.crossfadeSeconds, 0)} min={0} max={10} step={1} suffix="s" disabled={!boolSetting(settings.crossfadeEnabled)} onChange={(value) => run(updateSetting, "crossfadeSeconds", value)} />
              <ToggleRow label="Crossfade enabled" help="Turns crossfade on or off." checked={boolSetting(settings.crossfadeEnabled)} onChange={(value) => run(updateSetting, "crossfadeEnabled", value)} />
              <ToggleRow label="Gapless playback" help="Starts the next song without silence." checked={boolSetting(settings.gaplessPlayback)} onChange={(value) => run(updateSetting, "gaplessPlayback", value)} />
            </div>
          </Panel>

          <Panel title="Playback feel" note="Small controls for loudness and speed.">
            <div className="settingsMiniGrid">
              <RangeRow label="Speed" value={numberSetting(settings.playbackSpeed, 1)} min={0.75} max={1.5} step={0.05} suffix="x" onChange={(value) => run(updateSetting, "playbackSpeed", value)} />
              <RangeRow label="Volume" value={numberSetting(settings.volume, 1)} min={0} max={1} step={0.01} onChange={(value) => run(updateSetting, "volume", value)} />
              <ToggleRow label="Volume normalization" help="Balances loud and quiet files." checked={boolSetting(settings.volumeNormalization)} onChange={(value) => run(updateSetting, "volumeNormalization", value)} />
              <ToggleRow label="Per-song volume" help="Remembers custom volume per track." checked={boolSetting(settings.perSongVolumeMemory)} onChange={(value) => run(updateSetting, "perSongVolumeMemory", value)} />
              <ToggleRow label="Sleep timer" help="Stops playback after thirty minutes when enabled." checked={numberSetting(settings.sleepTimerMinutes, 0) > 0} onChange={(value) => run(updateSetting, "sleepTimerMinutes", value ? 30 : 0)} />
            </div>
          </Panel>
        </div>

        <Panel title="Now playing preview" note="Shows how the player text currently resolves.">
          <div className="settingsPreviewCard">
            <span>current song</span>
            <strong>{previewSongTitle}</strong>
            <small>{previewSongArtist}</small>
          </div>
        </Panel>
      </section>
    );
  }

  if (settingsCategory === "discord") {
    return (
      <section className="settingsCategoryPage" aria-label="Discord settings">
        <PageHeader eyebrow="discord rich presence" title="privacy, text, buttons, and artwork" detail="Controls what Discord can show while localtify is running." meta={settings.discordEnabled ? "showing activity" : "activity hidden"} />

        <Panel title="Discord preview" note="This preview follows the current RPC text settings.">
          <div className="discordPreviewMock" aria-label="Discord activity preview">
            <span>{discordPreview.badge}</span>
            <strong>{discordPreview.details}</strong>
            <small>{discordPreview.state}</small>
          </div>
        </Panel>

        <Panel title="Privacy and visibility" note="Keep these obvious so nobody gets stuck in privacy mode.">
          <div className="settingsMiniGrid four">
            <ToggleRow label="Enable Discord activity" help="Shows localtify as your Discord status." checked={boolSetting(settings.discordEnabled)} onChange={(value) => run(updateSetting, "discordEnabled", value)} />
            <ToggleRow label="Privacy mode" help="Hides the exact song name." checked={boolSetting(settings.discordPrivacyMode)} onChange={(value) => run(updateSetting, "discordPrivacyMode", value)} />
            <ToggleRow label="Paused status" help="Shows paused or idle when playback is not active." checked={boolSetting(settings.discordShowPausedIdle)} onChange={(value) => run(updateSetting, "discordShowPausedIdle", value)} />
            <ToggleRow label="RPC buttons" help="Shows safe Discord buttons." checked={boolSetting(settings.discordButtons)} onChange={(value) => run(updateSetting, "discordButtons", value)} />
          </div>
        </Panel>

        <div className="settingsTwoColumn">
          <Panel title="Status style" note="Changes the main Discord text style.">
            <ChoiceGrid options={discordStyleOptions} value={textSetting(settings.discordActivityStyle, discordStyleOptions[0]?.id || "")} onChange={(value) => run(updateSetting, "discordActivityStyle", value)} columns="three" ariaLabel="Discord status style" />
          </Panel>

          <Panel title="Second line" note="Choose the smaller line under the song.">
            <ChoiceGrid options={discordSecondLineOptions} value={textSetting(settings.discordSecondLine, discordSecondLineOptions[0]?.id || "")} onChange={(value) => run(updateSetting, "discordSecondLine", value)} columns="three" ariaLabel="Discord second line" />
          </Panel>
        </div>

        <div className="settingsTwoColumn">
          <Panel title="Artwork mode" note="Choose the image used in Rich Presence.">
            <ChoiceGrid options={discordArtModeOptions} value={textSetting(settings.discordArtMode, discordArtModeOptions[0]?.id || "")} onChange={(value) => run(updateSetting, "discordArtMode", value)} columns="three" ariaLabel="Discord artwork mode" />
          </Panel>

          <Panel title="Title cleanup" note="Controls cleanup used by Discord and metadata previews.">
            <ChoiceGrid options={discordCleanupOptions} value={textSetting(settings.discordTitleCleanup, discordCleanupOptions[0]?.id || "")} onChange={(value) => run(updateSetting, "discordTitleCleanup", value)} columns="three" ariaLabel="Discord title cleanup" />
          </Panel>
        </div>
      </section>
    );
  }

  if (settingsCategory === "library" || settingsCategory === "metadata") {
    const previewItems = Array.isArray(metadataCleanPreview?.items) ? metadataCleanPreview.items.slice(0, 6) : [];

    return (
      <section className="settingsCategoryPage" aria-label="Library settings">
        <PageHeader eyebrow={settingsCategory === "metadata" ? "metadata" : "library"} title="imports, search, and playlists" detail="Clean names, rebuild search, create playlists, and keep the library responsive." meta={`${songs.length} songs indexed`} />

        <div className="settingsTwoColumn">
          <Panel title="Metadata cleanup" note="Preview fixes before applying them to the library.">
            <ChoiceGrid options={discordCleanupOptions} value={textSetting(settings.discordTitleCleanup, discordCleanupOptions[0]?.id || "")} onChange={(value) => run(updateSetting, "discordTitleCleanup", value)} columns="three" ariaLabel="Metadata cleanup mode" />
            <div className="settingsActionRow">
              <button className="settingsActionButton settingsPrimaryAction" type="button" disabled={libraryScanBusy} onClick={cleanLibraryMetadataAction}>preview clean all</button>
              <button className="settingsActionButton" type="button" disabled={libraryScanBusy || !metadataSelectedCount} onClick={() => cleanSelectedMetadataAction?.()}>selected only {metadataSelectedCount ? `(${metadataSelectedCount})` : ""}</button>
              <button className="settingsActionButton" type="button" disabled={libraryScanBusy || !metadataUndoCount} onClick={() => run(undoLastMetadataCleanAction || (() => undefined))}>undo last clean {metadataUndoCount ? `(${metadataUndoCount})` : ""}</button>
              <button className="settingsActionButton" type="button" disabled={libraryScanBusy} onClick={rebuildSearchIndexAction}>rebuild search</button>
              <button className="settingsActionButton" type="button" onClick={importSongs} disabled={importAnimation.active}>import songs</button>
            </div>

            {metadataCleanPreview ? (
              <div className="metadataCleanerPreviewBox" role="status" aria-live="polite">
                <div className="metadataCleanerPreviewHead">
                  <span>preview before applying</span>
                  <strong>{metadataCleanPreview.changedCount || 0} fix{(metadataCleanPreview.changedCount || 0) === 1 ? "" : "es"}</strong>
                  <small>{metadataCleanPreview.skippedCount || 0} skipped • titles {metadataCleanPreview.titleFixCount || 0} • artists {metadataCleanPreview.artistFixCount || 0} • albums {metadataCleanPreview.albumFixCount || 0}</small>
                </div>
                <div className="metadataCleanerPreviewList">
                  {previewItems.length ? previewItems.map((item: any) => (
                    <div className="metadataCleanerPreviewItem" key={item.id || `${item.before?.title}-${item.after?.title}`}>
                      <span>
                        <small>before</small>
                        <strong>{item.before?.title || "untitled"}</strong>
                        <em>{item.before?.artist || "unknown artist"}</em>
                      </span>
                      <b aria-hidden="true">→</b>
                      <span>
                        <small>after</small>
                        <strong>{item.after?.title || "untitled"}</strong>
                        <em>{item.after?.artist || "unknown artist"}</em>
                      </span>
                    </div>
                  )) : <EmptyState title="No preview items" note="Nothing needed cleanup with the current settings." />}
                </div>
                <div className="settingsActionRow">
                  <button className="settingsActionButton settingsPrimaryAction" type="button" disabled={libraryScanBusy || !(metadataCleanPreview.changedCount || 0)} onClick={() => run(applyMetadataCleanPreviewAction || (() => undefined))}>apply fixes</button>
                  <button className="settingsActionButton settingsGhostAction" type="button" disabled={libraryScanBusy} onClick={() => cancelMetadataCleanPreviewAction?.()}>cancel</button>
                </div>
              </div>
            ) : null}

            {libraryScanMessage ? <p className="settingsHintText">{libraryScanMessage}</p> : null}
          </Panel>

          <Panel title="Playlists and queue" note="Create playlists and control the active queue.">
            <div className="settingsInlineForm">
              <input className="settingsInlineInput" value={newPlaylistName} onChange={(event) => setNewPlaylistName(event.currentTarget.value)} placeholder="new playlist name" aria-label="New playlist name" />
              <button className="settingsActionButton settingsPrimaryAction" type="button" onClick={createPlaylist}>create</button>
              <button className="settingsActionButton" type="button" onClick={() => run(changeView, "playlists", "settings")}>open</button>
              <button className="settingsActionButton" type="button" onClick={clearQueue} disabled={playQueue.length === 0}>clear queue</button>
            </div>
            <ToggleRow label="Repeat active playlist" help="When the queue ends, localtify starts the active playlist again." checked={repeatPlaylist} onChange={(value) => setRepeatPlaylist(value)} />
            <div className="settingsPlaylistList">
              {playlists.length ? playlists.map((playlist) => (
                <div className="settingsPlaylistItem" key={playlist.id}>
                  <span>
                    <strong>{playlist.name}</strong>
                    <small>{playlist.songIds.length} song{playlist.songIds.length === 1 ? "" : "s"}</small>
                  </span>
                  <div>
                    <button className="settingsTinyButton" type="button" onClick={() => openPlaylist(playlist.id)}>open</button>
                    <button className="settingsTinyButton" type="button" onClick={() => run(playPlaylist, playlist, false)} disabled={playlist.songIds.length === 0}>play</button>
                    <button className="settingsTinyButton" type="button" onClick={() => run(playPlaylist, playlist, true)} disabled={playlist.songIds.length === 0}>shuffle</button>
                    <button className="settingsTinyButton danger" type="button" onClick={() => removePlaylist(playlist.id)}>remove</button>
                  </div>
                </div>
              )) : <EmptyState title="No playlists yet" note="Create one here, then add songs from the song menu." />}
            </div>
          </Panel>
        </div>
      </section>
    );
  }

  if (settingsCategory === "covers") {
    return (
      <section className="settingsCategoryPage" aria-label="Cover settings">
        <PageHeader eyebrow="covers" title="pixel art and cover tools" detail="Cover actions stay light here; the heavy gallery opens only when needed." meta={`${pixelArtAssets.length} pixel assets`} />

        <div className="settingsTwoColumn">
          <Panel title="Cover gallery" note="Open the gallery only when you need to edit covers.">
            <div className="settingsActionRow">
              <button className="settingsActionButton settingsPrimaryAction" type="button" onClick={() => run(changeView, "covers", "settings")}>open cover gallery</button>
              <button className="settingsActionButton" type="button" disabled={pixelArtBusy || songs.length === 0} onClick={randomizeAllCovers}>randomize all covers</button>
              <button className="settingsActionButton" type="button" disabled={pixelArtBusy} onClick={rescanPixelArtFolder}>rescan pixel art</button>
            </div>
            <p className="settingsHintText">{pixelArtBusy ? "Working on pixel art..." : "Missing-cover filters and batch cover tools are inside the cover gallery."}</p>
          </Panel>

          <Panel title="Cover ambience" note="Keep these light to avoid screen-switch stutter.">
            <div className="settingsMiniGrid">
              <ToggleRow label="Cover glow" help="Adds cover-based glow to the UI." checked={boolSetting(settings.animatedGlow)} onChange={(value) => run(updateSetting, "animatedGlow", value)} />
              <ToggleRow label="Floating notes" help="Shows tiny music note particles." checked={boolSetting(settings.showFloatingNotes)} onChange={(value) => run(updateSetting, "showFloatingNotes", value)} />
              <ToggleRow label="Large artwork" help="Makes cover images larger on the home page." checked={boolSetting(settings.homeExpanded)} onChange={(value) => run(updateSetting, "homeExpanded", value)} />
              <ToggleRow label="Quick library blur" help="Adds softer blur on quick library cards." checked={boolSetting(settings.quickLibraryMoreBlur)} onChange={(value) => run(updateSetting, "quickLibraryMoreBlur", value)} />
            </div>
          </Panel>
        </div>
      </section>
    );
  }

  if (settingsCategory === "downloads") {
    return (
      <section className="settingsCategoryPage" aria-label="Download settings">
        <PageHeader eyebrow="downloads" title="download settings" detail="Choose how downloaded audio is saved, named, converted, and imported." meta={settings.downloadFolder || downloadFolderLabel || "default folder"} />

        <div className="settingsTwoColumn">
          <Panel title="Audio quality" note="Best keeps source quality when possible.">
            <ChoiceGrid options={DOWNLOAD_QUALITY_OPTIONS} value={textSetting(settings.downloadQuality, "best")} onChange={(value) => run(updateSetting, "downloadQuality", value as DownloadQuality)} columns="four" ariaLabel="Download quality" />
          </Panel>

          <Panel title="Format" note="MP3 is the safest default for compatibility.">
            <ChoiceGrid options={DOWNLOAD_FORMAT_OPTIONS} value={textSetting(settings.downloadFormat, "mp3")} onChange={(value) => run(updateSetting, "downloadFormat", value as DownloadFormat)} columns="three" ariaLabel="Download format" />
          </Panel>
        </div>

        <Panel title="Download behavior" note="Keep post-download cleanup automatic and predictable.">
          <div className="settingsMiniGrid">
            <ToggleRow label="Auto-add to library" help="Downloaded audio appears in localtify automatically." checked={boolSetting(settings.downloadAutoAdd)} onChange={(value) => run(updateSetting, "downloadAutoAdd", value)} />
            <ToggleRow label="Clean title after download" help="Removes common video words from downloaded filenames." checked={boolSetting(settings.downloadCleanTitle)} onChange={(value) => run(updateSetting, "downloadCleanTitle", value)} />
          </div>
        </Panel>

        <Panel title="Download folder" note="Choose where localtify saves downloaded songs.">
          <div className="settingsFolderRow">
            <code>{settings.downloadFolder || downloadFolderLabel || "Default downloads folder"}</code>
            <button className="settingsActionButton settingsPrimaryAction" type="button" onClick={chooseDownloadFolder}>choose folder</button>
            {settings.downloadFolder ? <button className="settingsActionButton" type="button" onClick={() => run(updateSetting, "downloadFolder", "")}>use default</button> : null}
          </div>
        </Panel>
      </section>
    );
  }

  if (settingsCategory === "updates") {
    return (
      <section className="settingsCategoryPage" aria-label="Update settings">
        <PageHeader eyebrow="updates" title="updates and version" detail="Check for releases, install downloaded updates, and view notes." meta={`version ${APP_VERSION} • ${activePlatformInfo.label}`} />

        <div className="settingsTwoColumn">
          <Panel title="Update status" note="Check for new releases and finish downloaded updates.">
            <div className="settingsUpdateSummary">
              <div className="settingsUpdateCurrent">
                <span className="settingsUpdateVersionBadge">{APP_VERSION}</span>
                <div>
                  <strong>Current version</strong>
                  <span>localtify {APP_VERSION}</span>
                </div>
              </div>
              <div className={`settingsUpdateMessage settingsUpdateMessage-${updatePrompt.status || "idle"}`}>
                <strong>{updatePrompt.status === "idle" || !updatePrompt.status ? "Ready to check" : updatePrompt.status === "error" ? "Update check failed" : updateStatusLabel(updatePrompt.status)}</strong>
                <span>{updatePrompt.error || updatePrompt.message || (updatePrompt.status === "idle" || !updatePrompt.status ? "Check for updates whenever you are ready." : "Update status will appear here.")}</span>
              </div>
            </div>
            <div className="settingsActionRow">
              <button className="settingsActionButton settingsPrimaryAction" type="button" onClick={manualUpdateCheck} disabled={updatePrompt.status === "checking" || updatePrompt.status === "downloading"}>check now</button>
              <button className="settingsActionButton" type="button" onClick={askUpdaterToInstall} disabled={updatePrompt.status !== "downloaded"}>restart to install</button>
              <button className="settingsActionButton settingsGhostAction" type="button" onClick={skipAvailableUpdate} disabled={!updatePrompt.version || updatePrompt.status !== "available"}>skip version</button>
            </div>
          </Panel>

          <Panel title="Update behavior" note="Choose how localtify checks for updates.">
            <div className="settingsMiniGrid">
              <ToggleRow label="Update checks" help="Checks for new releases while the app is open." checked={boolSetting(settings.autoUpdateEnabled)} onChange={(value) => run(updateSetting, "autoUpdateEnabled", value)} />
              <ToggleRow label="Notify only" help="Shows update messages instead of installing automatically." checked={boolSetting(settings.autoUpdateNotifyOnly)} onChange={(value) => run(updateSetting, "autoUpdateNotifyOnly", value)} />
            </div>
            <div className="settingsActionRow">
              <button className="settingsActionButton" type="button" onClick={() => setWhatsNewOpen(true)}>open what’s new</button>
            </div>
          </Panel>
        </div>

        {showLinuxInstallNotes ? (
          <Panel title="Linux packages" note="AppImage is the main universal Linux build. RPM and DEB are native installers.">
            <ul className="settingsPlainList">
              {linuxInstallNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </Panel>
        ) : null}

        <Panel title={`What’s new in ${APP_VERSION}`} note="Short release notes.">
          <ul className="settingsPlainList">
            {whatsNewItems.length ? whatsNewItems.map((item) => <li key={item}>{item}</li>) : <li>No release notes loaded yet.</li>}
          </ul>
        </Panel>
      </section>
    );
  }

  if (settingsCategory === "about") {
    return (
      <section className="settingsCategoryPage" aria-label="About and diagnostics">
        <PageHeader eyebrow="about" title="localtify status" detail="Copy diagnostics when reporting bugs. No song names or private library paths are included." meta={`version ${APP_VERSION} • ${activePlatformInfo.label}`} />

        <Panel title="App info" note="Use this when reporting bugs." action={<button className="settingsActionButton settingsPrimaryAction" type="button" onClick={copyDiagnosticsInfo}>{diagnosticsCopied ? "copied" : "copy app info"}</button>}>
          <div className="settingsDiagnosticsGrid">
            {diagnosticsInfo.items.map((item) => (
              <div className="settingsDiagnosticCard" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Platform support" note="Windows and Linux use separate release packages, icons, and platform controls.">
          <StatGrid items={[
            { label: "platform", value: activePlatformInfo.label },
            { label: "package", value: activePlatformInfo.releaseLabel },
            { label: "startup setting", value: activePlatformInfo.startupSettingSupported ? "available" : "hidden" },
            { label: "release notes", value: showLinuxInstallNotes ? "ready" : "standard" }
          ]} />
        </Panel>

        <Panel title="Bug report text" note="Copyable app diagnostics only.">
          <textarea className="settingsDiagnosticsText" readOnly value={diagnosticsInfo.copyText} aria-label="localtify diagnostics text" />
        </Panel>
      </section>
    );
  }

  if (settingsCategory === "advanced") {
    return (
      <section className="settingsCategoryPage" aria-label="Advanced settings">
        <PageHeader eyebrow="advanced" title="reset and app status" detail="Reset selected settings without touching your songs." meta={`version ${APP_VERSION} • ${activePlatformInfo.label}`} />

        <div className="settingsTwoColumn">
          <Panel title="App status" note="Quick library and importer status.">
            <StatGrid items={[
              { label: "songs", value: songs.length },
              { label: "liked", value: likedSongs.length },
              { label: "pixel art", value: pixelArtAssets.length },
              { label: "importer", value: importAnimation.active ? "busy" : "ready" }
            ]} />
          </Panel>

          <Panel title="Search and library" note="Rebuild search if imported songs do not appear correctly.">
            <div className="settingsActionRow">
              <button className="settingsActionButton settingsPrimaryAction" type="button" disabled={libraryScanBusy} onClick={rebuildSearchIndexAction}>rebuild search</button>
              <button className="settingsActionButton" type="button" onClick={() => {
                libraryRenderLimitRef.current = INITIAL_LIBRARY_RENDER_LIMIT;
                setLibraryRenderLimit(INITIAL_LIBRARY_RENDER_LIMIT);
              }}>reset loaded songs</button>
            </div>
          </Panel>
        </div>

        <Panel title={activePlatformInfo.desktopControlsLabel} note={activePlatformInfo.desktopControlsHelp}>
          <div className="settingsMiniGrid">
            <ToggleRow label="Keep localtify in tray when closed" help="The close button hides the app instead of quitting." checked={boolSetting(settings.minimizeToTray)} onChange={(value) => run(updateSetting, "minimizeToTray", value)} />
            {activePlatformInfo.startupSettingSupported ? <ToggleRow label={activePlatformInfo.startupSettingLabel} help={activePlatformInfo.startupSettingHelp} checked={boolSetting(settings.startWithWindows)} onChange={(value) => run(updateSetting, "startWithWindows", value)} /> : null}
          </div>
        </Panel>

        <Panel title="Reset settings" note="Reset only the selected group. Your library stays untouched.">
          <div className="settingsResetGrid">
            <button className="settingsResetButton" type="button" onClick={resetDiscordSettings}>
              <strong>Reset Discord settings</strong>
              <span>Privacy mode, status text, buttons, artwork, and cleanup.</span>
            </button>
            <button className="settingsResetButton" type="button" onClick={resetAppearanceSettings}>
              <strong>Reset appearance</strong>
              <span>Theme, colors, motion, corners, and ambience settings.</span>
            </button>
            <button className="settingsResetButton" type="button" onClick={resetPlayerLayoutSettings}>
              <strong>Reset player layout</strong>
              <span>Player size, visualizer, volume, and speed.</span>
            </button>
            <button className="settingsResetButton" type="button" onClick={resetLibraryLayoutSettings}>
              <strong>Reset library layout</strong>
              <span>Library density, loaded rows, and list preferences.</span>
            </button>
            <button className="settingsResetButton danger" type="button" onClick={resetAllSettingsSafely}>
              <strong>Reset all settings</strong>
              <span>Restores app defaults without deleting songs.</span>
            </button>
          </div>
        </Panel>
      </section>
    );
  }

  return (
    <section className="settingsCategoryPage" aria-label="Settings">
      <PageHeader eyebrow="settings" title="choose a category" detail="Pick a settings category from the sidebar." />
      <EmptyState title="No category selected" note="The settings page is ready." />
    </section>
  );
});

export default SettingsCategoryContent;
