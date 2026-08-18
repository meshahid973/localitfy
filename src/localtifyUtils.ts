// Phase 2 compatibility barrel. App keeps stable imports while implementations move to owners.
export { clamp, collapseSpaces, formatTime, getGreeting, lower, normalizeUiText, safeNumber, toCssUrl } from "./shared/utils/format";
export { makeLocalId, readLocalJson, writeLocalJson } from "./shared/storage/localStorage";
export { applyLibraryOrder, cleanPlaylistList, cleanSongOrderIds, getSongPlaybackSourceKey, insertIdNearTarget, isPlayableSong, maybeApplyCoderpixelArtist, reorderIdList, reorderSongList, saveLibraryOrder, stableSongSourceKey } from "./features/library/library.utils";
export { normalizeSettingsSearch, resolveSettingsCategoryFromSearch, settingsTabMatchesSearch } from "./features/settings/settings.search";
export { hexToRgbString, hexToRgbaString, isCompleteHexColorInput, isRetiredAnimatedThemeId, isThemeId, normalizeCoverColorSyncMode, normalizeHexColor, normalizeHexInputDraft, normalizeThemeId } from "./features/settings/theme.utils";
export { friendlyUpdateError, updateLeaveAloneKey, updateRibbonTitle, updateStatusLabel, updateWasLeftAlone } from "./features/updates/update.utils";

// Remaining helpers are migrated in follow-up Phase 2 cuts; this list is intentionally shrinking.
export {
  buildAnimatedThemeVisualStyle, buildCoverAverageStyle, buildDiscordPreview, buildDiscordSongSearchUrl, buildRandomStarLayer, buildRuntimePixelArtAssets, buildSongSearchEntry,
  cleanArtistName, cleanCustomThemePreset, cleanMetadataField, cleanStringList, cleanToastCopy, cleanupSongTitle, compactSongKey, coverAverageColorCache, coverMoodName, createImportAnimationState,
  discordArtist, discordKeyFromFileName, fileNameFromPath, getAmbientStyle, getCachedRuntimePixelArtAssets, getCustomThemeColorPatch, getMetadataRepairPatch, getPixelArtAssetKey, getPixelAssetMoodTags,
  getPlaylistDropSide, getRendererSafeImageUrl, getSongAmbientSource, getSongCoverUsageKeys, heroTitleDensityClass, loadingScreenGif, makeCustomThemeColors, makeThemePresetStyle,
  normalizePixelArtFileName, normalizeSearchText, pixelArtForSong, pixelArtUrl, prepareSearchQuery, prettyMeta, prettyTitle, previewTitle, randomThemeHex, rankSongsForSearch, readPlaylistDraggedSongId,
  readSavedCustomThemePresets, removeBracketNoise, removeLooseNoiseWords, removeUrlNoise, runtimePixelArtImageUrl, sanitizeSongList, sanitizeSongRecord, scoreArtistGuess, scoreSongSearch, seededUnit,
  shortenWords, smartSongMetadata, songSignature, splitArtistTitleCandidate, splitSearchTerms, stableHash, stripAudioExtension, stripDuplicateCopySuffix, stripTrackNumber, useCoverAverageStyle, useStableCallback,
  writeSavedCustomThemePresets
} from "./LocaltifyAppView";
