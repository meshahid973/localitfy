import { memo, useMemo } from "react";
import AppearanceSettings from "./categories/AppearanceSettings";
import PlaybackSettings from "./categories/PlaybackSettings";
import DiscordSettings from "./categories/DiscordSettings";
import LibrarySettings from "./categories/LibrarySettings";
import CoversSettings from "./categories/CoversSettings";
import DownloadSettings from "./categories/DownloadSettings";
import UpdateSettings from "./categories/UpdateSettings";
import AboutSettings from "./categories/AboutSettings";
import AdvancedSettings from "./categories/AdvancedSettings";
import { detectSettingsPlatform } from "./settings.shared";
import type { PlatformInfoLike } from "./settings.shared";

// Temporary flat-prop adapter for App.tsx. Feature components below receive only
// the data they own; this adapter disappears when App becomes composition-only.
type LegacySettingsAdapterProps = { settingsCategory: string; setSettingsCategory?: (value: string) => void; [key: string]: any };

const SettingsCategoryContent = memo(function SettingsCategoryContent(p: LegacySettingsAdapterProps) {
  const fallbackPlatform = useMemo(() => detectSettingsPlatform(), []);
  const platformInfo = { ...fallbackPlatform, ...(p.platformInfo || {}) } as Required<PlatformInfoLike>;

  switch (p.settingsCategory) {
    case "appearance": return <AppearanceSettings currentTheme={p.currentTheme} settings={p.settings} updateSetting={p.updateSetting} visibleThemes={p.visibleThemes} themeSwatchColors={p.THEME_SWATCH_COLORS} effectiveTheme={p.effectiveTheme} resetCustomThemePalette={p.resetCustomThemePalette} saveCurrentCustomThemePreset={p.saveCurrentCustomThemePreset} customThemeName={p.customThemeName} setCustomThemeName={p.setCustomThemeName} builtInCustomThemePresets={p.BUILT_IN_CUSTOM_THEME_PRESETS} applyCustomThemePreset={p.applyCustomThemePreset} customThemeTokens={p.customThemeTokens} commitCustomThemeHexDraft={p.commitCustomThemeHexDraft} previewCustomThemeColor={p.previewCustomThemeColor} coverColorSyncOptions={p.coverColorSyncOptions} selectedCoverColorSyncMode={p.selectedCoverColorSyncMode} updateCoverColorSyncMode={p.updateCoverColorSyncMode} openAdvanced={() => p.setSettingsCategory?.("advanced")} />;
    case "playback": return <PlaybackSettings settings={p.settings} updateSetting={p.updateSetting} />;
    case "discord": return <DiscordSettings settings={p.settings} updateSetting={p.updateSetting} discordPreview={p.discordPreview} discordStyleOptions={p.discordStyleOptions} discordSecondLineOptions={p.discordSecondLineOptions} discordArtModeOptions={p.discordArtModeOptions} />;
    case "library":
    case "metadata": return <LibrarySettings settings={p.settings} updateSetting={p.updateSetting} songs={p.songs} libraryScanBusy={p.libraryScanBusy} cleanLibraryMetadataAction={p.cleanLibraryMetadataAction} cleanSelectedMetadataAction={p.cleanSelectedMetadataAction} metadataSelectedCount={p.metadataSelectedCount || 0} metadataCleanPreview={p.metadataCleanPreview} applyMetadataCleanPreviewAction={p.applyMetadataCleanPreviewAction} cancelMetadataCleanPreviewAction={p.cancelMetadataCleanPreviewAction} undoLastMetadataCleanAction={p.undoLastMetadataCleanAction} metadataUndoCount={p.metadataUndoCount || 0} rebuildSearchIndexAction={p.rebuildSearchIndexAction} libraryScanMessage={p.libraryScanMessage} cleanupOptions={p.discordCleanupOptions} />;
    case "covers": return <CoversSettings pixelArtAssets={p.pixelArtAssets} changeView={p.changeView} />;
    case "downloads": return <DownloadSettings settings={p.settings} updateSetting={p.updateSetting} downloadFolderLabel={p.downloadFolderLabel} chooseDownloadFolder={p.chooseDownloadFolder} />;
    case "updates": return <UpdateSettings settings={p.settings} updateSetting={p.updateSetting} />;
    case "about": return <AboutSettings appVersion={p.APP_VERSION} platformInfo={platformInfo} songs={p.songs} />;
    case "advanced": return <AdvancedSettings settings={p.settings} updateSetting={p.updateSetting} appVersion={p.APP_VERSION} diagnosticsInfo={p.diagnosticsInfo} diagnosticsCopied={p.diagnosticsCopied} copyDiagnosticsInfo={p.copyDiagnosticsInfo} updatePrompt={p.updatePrompt} manualUpdateCheck={p.manualUpdateCheck} askUpdaterToInstall={p.askUpdaterToInstall} libraryScanBusy={p.libraryScanBusy} rebuildSearchIndexAction={p.rebuildSearchIndexAction} libraryRenderLimitRef={p.libraryRenderLimitRef} initialLibraryRenderLimit={p.INITIAL_LIBRARY_RENDER_LIMIT} setLibraryRenderLimit={p.setLibraryRenderLimit} pixelArtBusy={p.pixelArtBusy} songs={p.songs} randomizeAllCovers={p.randomizeAllCovers} rescanPixelArtFolder={p.rescanPixelArtFolder} changeView={p.changeView} platformInfo={platformInfo} resetDiscordSettings={p.resetDiscordSettings} resetAppearanceSettings={p.resetAppearanceSettings} resetPlayerLayoutSettings={p.resetPlayerLayoutSettings} resetLibraryLayoutSettings={p.resetLibraryLayoutSettings} resetAllSettingsSafely={p.resetAllSettingsSafely} />;
    default: return null;
  }
});
export default SettingsCategoryContent;
