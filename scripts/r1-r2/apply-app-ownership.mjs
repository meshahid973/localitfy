import fs from "node:fs";

const appPath = "src/App.tsx";
let source = fs.readFileSync(appPath, "utf8");

function replaceNamedImport(modulePath, replacement) {
  const endMarker = `} from "${modulePath}";`;
  const endStart = source.indexOf(endMarker);
  if (endStart < 0) {
    if (source.includes(replacement.trim())) return;
    throw new Error(`Could not find import end marker for ${modulePath}`);
  }
  const start = source.lastIndexOf("import {", endStart);
  if (start < 0) throw new Error(`Could not find import start for ${modulePath}`);
  const end = endStart + endMarker.length;
  const current = source.slice(start, end);
  if (!current.includes(modulePath)) throw new Error(`Refusing ambiguous import rewrite for ${modulePath}`);
  source = source.slice(0, start) + replacement.trimEnd() + source.slice(end);
}

replaceNamedImport("./localtifyConstants", `import {
  BOOT_MIN_VISIBLE_MS,
  BOOT_STEPS,
  CUSTOM_THEME_COMMIT_DELAY_MS,
  HOME_GRID_RENDER_LIMIT,
  INITIAL_LIBRARY_RENDER_LIMIT,
  LIBRARY_RENDER_BATCH_SIZE,
  START_WITH_WINDOWS_DEFAULT_KEY,
  V013_DEFAULTS_KEY,
  loadingScreenGif,
  localtifyLogo,
  screensaverImage
} from "./core/app.constants";
import {
  CODERPIXEL_ARTIST_EASTER_EGG,
  PLAYBACK_URL_CACHE_TTL_MS
} from "./features/library/library.constants";
import {
  V013_RELEASE_DEFAULTS,
  coverColorSyncOptions,
  defaultSettings,
  settingsCategoryTabs
} from "./features/settings/settings.constants";
import { THEME_SWATCH_COLORS, themes } from "./features/settings/theme.constants";
import { BUILT_IN_CUSTOM_THEME_PRESETS } from "./features/settings/customTheme";
import { APP_VERSION } from "./features/updates/update.constants";
import {
  DISCORD_ASSET_KEYS,
  DISCORD_LOGO_ASSET,
  LOCALITFY_DOWNLOAD_URL,
  LOCALITFY_SOURCE_URL,
  discordArtModeOptions,
  discordCleanupOptions,
  discordSecondLineOptions,
  discordStyleOptions
} from "./features/discord/discord.constants";
import { PLAYLIST_STORAGE_KEY } from "./features/playlists/playlist.constants";`);

replaceNamedImport("./localtifyUtils", `import { clamp, collapseSpaces, formatTime, getGreeting } from "./shared/utils/format";
import { useStableCallback } from "./shared/hooks/useStableCallback";
import { makeLocalId, readLocalJson } from "./shared/storage/localStorage";
import {
  applyLibraryOrder,
  createImportAnimationState,
  getSongPlaybackSourceKey,
  isPlayableSong,
  maybeApplyCoderpixelArtist,
  reorderSongList,
  saveLibraryOrder,
  stableSongSourceKey
} from "./features/library";
import {
  buildSongSearchEntry,
  getMetadataRepairPatch,
  heroTitleDensityClass,
  prettyMeta,
  prettyTitle,
  rankSongsForSearch,
  sanitizeSongList
} from "./features/search";
import {
  normalizeSettingsSearch,
  resolveSettingsCategoryFromSearch,
  settingsTabMatchesSearch
} from "./features/settings/settings.search";
import {
  getAmbientStyle,
  getRendererSafeImageUrl,
  getSongAmbientSource,
  pixelArtUrl,
  useCoverAverageStyle
} from "./features/covers";
import {
  buildAnimatedThemeVisualStyle,
  getCustomThemeColorPatch,
  hexToRgbString,
  hexToRgbaString,
  makeCustomThemeColors,
  makeThemePresetStyle,
  normalizeCoverColorSyncMode,
  normalizeHexColor,
  normalizeHexInputDraft,
  normalizeThemeId,
  randomThemeHex,
  writeSavedCustomThemePresets
} from "./features/settings";
import { buildDiscordPreview, buildDiscordSongSearchUrl } from "./features/discord";
import { updateStatusLabel } from "./features/updates";
import { cleanPlaylistList } from "./features/playlists";`);

if (/from\s+["']\.\/localtifyConstants["']/.test(source)) {
  throw new Error("App.tsx still imports localtifyConstants after ownership rewrite");
}
if (/from\s+["']\.\/localtifyUtils["']/.test(source)) {
  throw new Error("App.tsx still imports localtifyUtils after ownership rewrite");
}

fs.writeFileSync(appPath, source);
console.log("[r1-r2] App.tsx now imports constants/helpers from canonical owners");
