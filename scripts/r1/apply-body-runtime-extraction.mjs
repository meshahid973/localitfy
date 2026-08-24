import fs from "node:fs";

const appPath = "src/App.tsx";
let source = fs.readFileSync(appPath, "utf8");

function requireReplace(search, replacement, label) {
  if (!source.includes(search)) {
    if (replacement && source.includes(replacement.trim())) return;
    throw new Error(`[r1] could not find ${label}`);
  }
  source = source.replace(search, replacement);
}

function replaceNamedImport(modulePath, replacement) {
  const endMarker = `} from "${modulePath}";`;
  const endStart = source.indexOf(endMarker);
  if (endStart < 0) {
    if (!source.includes(modulePath)) return;
    throw new Error(`[r1] could not find import end marker for ${modulePath}`);
  }
  const start = source.lastIndexOf("import type {", endStart);
  if (start < 0) throw new Error(`[r1] could not find typed import start for ${modulePath}`);
  const end = endStart + endMarker.length;
  source = source.slice(0, start) + replacement.trimEnd() + source.slice(end);
}

requireReplace(
  'import { runLocaltifyIdleTask } from "./app/runtime/idle";\n',
  'import { runLocaltifyIdleTask } from "./app/runtime/idle";\nimport { useBodyRuntimeClasses } from "./app/runtime/useBodyRuntimeClasses";\n',
  "runtime import insertion point"
);

replaceNamedImport("./localtifyTypes", `import type {
  LibraryDropSide,
  LibraryDropTarget,
  MetadataCleanPreview,
  PlaybackUrlCacheEntry,
  PlaybackUrlResult,
  Song
} from "./features/library/song.types";
import type { DownloadQueueItem, DownloadResult, SpotifyTrack } from "./features/downloads/download.types";
import type { Settings, SettingsCategory, CustomThemeColorKey, CustomThemePreset } from "./features/settings/settings.types";
import type { CoverColorSyncMode, SecretMode, SecretTriggerMode, ThemeId } from "./features/settings/theme.types";
import type { DiscordArtMode } from "./features/discord/discord.types";
import type { Playlist, PlaylistSummary } from "./features/playlists/playlist.types";
import type { View } from "./features/shell/view.types";`);

const focusEffectStart = `  useEffect(() => {\n    const body = document.body;\n    const syncFocusClass = () => {\n      const backgrounded = document.hidden || !document.hasFocus();\n      body.classList.toggle("localtifyWindowBackgrounded", backgrounded);\n    };`;
const focusEffectEnd = `  }, []);\n\n  const discordAssetBySongRef`;
const focusStartIndex = source.indexOf(focusEffectStart);
const focusEndIndex = source.indexOf(focusEffectEnd, focusStartIndex);
if (focusStartIndex < 0 || focusEndIndex < 0) {
  if (!source.includes("useBodyRuntimeClasses({")) throw new Error("[r1] could not locate window-background class effect");
} else {
  source = source.slice(0, focusStartIndex) + "  const discordAssetBySongRef" + source.slice(focusEndIndex + focusEffectEnd.length);
}

const bodyEffectsStart = `  useEffect(() => {\n    isAppBackgroundedRef.current = isAppBackgrounded;\n    document.body.classList.toggle("localtifyBackgroundMode", isAppBackgrounded);`;
const bodyEffectsEnd = `  }, [settings.quickLibraryMoreBlur]);`;
const bodyStartIndex = source.indexOf(bodyEffectsStart);
const bodyEndIndex = source.indexOf(bodyEffectsEnd, bodyStartIndex);
const bodyHook = `  useBodyRuntimeClasses({\n    isAppBackgrounded,\n    isAppBackgroundedRef,\n    isPlaying,\n    wantsMoreBlur: settings.quickLibraryMoreBlur !== false\n  });`;
if (bodyStartIndex < 0 || bodyEndIndex < 0) {
  if (!source.includes(bodyHook)) throw new Error("[r1] could not locate body runtime effect group");
} else {
  source = source.slice(0, bodyStartIndex) + bodyHook + source.slice(bodyEndIndex + bodyEffectsEnd.length);
}

if (/from\s+["']\.\/localtifyTypes["']/.test(source)) {
  throw new Error("[r1] App.tsx still imports localtifyTypes");
}
if (!source.includes('from "./app/runtime/useBodyRuntimeClasses"')) {
  throw new Error("[r1] App.tsx is missing useBodyRuntimeClasses import");
}

fs.writeFileSync(appPath, source);
console.log("[r1] extracted body runtime classes and direct type ownership from App.tsx");
