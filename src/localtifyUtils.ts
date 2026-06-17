// @ts-nocheck
/* localtify 0.4.2 V042 — shared helper bridge.
   Update helpers are now owned here so they use the real APP_VERSION / update constants.
   The remaining legacy helpers are still bridged from LocaltifyAppView until they are extracted in smaller passes. */
import { APP_VERSION, UPDATE_LEAVE_ALONE_PREFIX } from "./localtifyConstants";

type UpdateRibbonPromptLike = {
  status?: "idle" | "checking" | "available" | "downloading" | "downloaded" | "latest" | "error" | "dev" | string;
  version?: string;
  percent?: number;
};

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function updateLeaveAloneKey(version: string) {
  return `${UPDATE_LEAVE_ALONE_PREFIX}${version || "latest"}`;
}

export function updateWasLeftAlone(version: string) {
  if (!version) return false;
  try {
    return window.localStorage.getItem(updateLeaveAloneKey(version)) === "1";
  } catch {
    return false;
  }
}

export function updateRibbonTitle(prompt: UpdateRibbonPromptLike) {
  const version = prompt.version || APP_VERSION;
  const status = prompt.status || "idle";

  if (status === "available") return `Update available · Localtify ${version} is available.`;
  if (status === "downloaded") return `Update ready · restart to install Localtify ${version}.`;
  if (status === "downloading") return `Downloading update · ${Math.round(clampNumber(Number(prompt.percent) || 0, 0, 100))}%`;
  if (status === "latest") return "Localtify is up to date.";
  if (status === "error") return "Update check failed.";
  if (status === "dev") return "Install Localtify to use automatic updates.";
  if (status === "checking") return "Checking for updates...";
  return "Localtify update";
}
export {
  applyLibraryOrder,
  buildAnimatedThemeVisualStyle,
  buildCoverAverageStyle,
  buildDiscordPreview,
  buildDiscordSongSearchUrl,
  buildRandomStarLayer,
  buildRuntimePixelArtAssets,
  buildSongSearchEntry,
  clamp,
  cleanArtistName,
  cleanCustomThemePreset,
  cleanMetadataField,
  cleanPlaylistList,
  cleanSongOrderIds,
  cleanStringList,
  cleanToastCopy,
  cleanupSongTitle,
  collapseSpaces,
  compactSongKey,
  coverAverageColorCache,
  coverMoodName,
  createImportAnimationState,
  discordArtist,
  discordKeyFromFileName,
  fileNameFromPath,
  formatTime,
  friendlyUpdateError,
  getAmbientStyle,
  getCachedRuntimePixelArtAssets,
  getCustomThemeColorPatch,
  getGreeting,
  getMetadataRepairPatch,
  getPixelArtAssetKey,
  getPixelAssetMoodTags,
  getPlaylistDropSide,
  getRendererSafeImageUrl,
  getSongAmbientSource,
  getSongCoverUsageKeys,
  getSongPlaybackSourceKey,
  heroTitleDensityClass,
  hexToRgbString,
  hexToRgbaString,
  insertIdNearTarget,
  isCompleteHexColorInput,
  isPlayableSong,
  isRendererSafeImageUrl,
  isRetiredAnimatedThemeId,
  isThemeId,
  loadingScreenGif,
  lower,
  makeCustomThemeColors,
  makeLocalId,
  makeThemePresetStyle,
  maybeApplyCoderpixelArtist,
  normalizeCoverColorSyncMode,
  normalizeHexColor,
  normalizeHexInputDraft,
  normalizePixelArtFileName,
  normalizeSearchText,
  normalizeSettingsSearch,
  normalizeThemeId,
  normalizeUiText,
  pixelArtForSong,
  pixelArtUrl,
  prepareSearchQuery,
  prettyMeta,
  prettyTitle,
  previewTitle,
  randomThemeHex,
  rankSongsForSearch,
  readLocalJson,
  readPlaylistDraggedSongId,
  readSavedCustomThemePresets,
  removeBracketNoise,
  removeLooseNoiseWords,
  removeUrlNoise,
  reorderIdList,
  reorderSongList,
  resolveSettingsCategoryFromSearch,
  runtimePixelArtImageUrl,
  safeNumber,
  sanitizeSongList,
  sanitizeSongRecord,
  saveLibraryOrder,
  scoreArtistGuess,
  scoreSongSearch,
  seededUnit,
  settingsTabMatchesSearch,
  shortenWords,
  smartSongMetadata,
  songSignature,
  splitArtistTitleCandidate,
  splitSearchTerms,
  stableHash,
  stableSongSourceKey,
  stripAudioExtension,
  stripDuplicateCopySuffix,
  stripTrackNumber,
  toCssUrl,
  updateStatusLabel,
  useCoverAverageStyle,
  useStableCallback,
  writeLocalJson,
  writeSavedCustomThemePresets
} from "./LocaltifyAppView";


