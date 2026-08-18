from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / "src"
old = src / "LocaltifyAppView.tsx"
new = src / "features" / "shell" / "AppShell.tsx"

if not old.exists():
    raise SystemExit("src/LocaltifyAppView.tsx is missing")
if new.exists():
    raise SystemExit("src/features/shell/AppShell.tsx already exists")

text = old.read_text(encoding="utf-8-sig")
text = text.replace("// @ts-nocheck\n", "", 1)

replacements = {
    'from "./app/UpdateIsland"': 'from "../../app/UpdateIsland"',
    'from "./features/shell/TitleBar"': 'from "./TitleBar"',
    'from "./features/home/HomeView"': 'from "../home/HomeView"',
    'from "./features/library/LibraryView"': 'from "../library/LibraryView"',
    'from "./features/albums/AlbumsView"': 'from "../albums/AlbumsView"',
    'from "./features/playlists/PlaylistsView"': 'from "../playlists/PlaylistsView"',
    'from "./features/covers/CoversView"': 'from "../covers/CoversView"',
    'from "./features/analytics/AnalyticsView"': 'from "../analytics/AnalyticsView"',
    'from "./features/settings/SettingsView"': 'from "../settings/SettingsView"',
    'from "./features/downloads/DownloadsView"': 'from "../downloads/DownloadsView"',
    'from "./features/player/components/PlayerBar"': 'from "../player/components/PlayerBar"',
    'from "./Onboarding"': 'from "../../Onboarding"',
    'from "./features/covers/Cover"': 'from "../covers/Cover"',
    'from "./features/library/components/SongRows"': 'from "../library/components/SongRows"',
    'from "./shared/ui/LocaltifyViewUi"': 'from "../../shared/ui/LocaltifyViewUi"',
    'from "./features/library/song.types"': 'from "../library/song.types"',
    'from "./features/albums/album.types"': 'from "../albums/album.types"',
    'from "./features/albums/album.runtime"': 'from "../albums/album.runtime"',
    'from "./features/library"': 'from "../library"',
    'from "./shared/storage/localStorage"': 'from "../../shared/storage/localStorage"',
    'from "./shared/utils/format"': 'from "../../shared/utils/format"',
    'from "./features/covers/cover.ambient"': 'from "../covers/cover.ambient"',
    'from "./features/covers"': 'from "../covers"',
    'from "./features/search"': 'from "../search"',
    'from "./features/shell/navigation.constants"': 'from "./navigation.constants"',
    'from "./features/settings/settings.constants"': 'from "../settings/settings.constants"',
    'from "./features/updates/update.constants"': 'from "../updates/update.constants"',
    'from "./features/updates/update.utils"': 'from "../updates/update.utils"',
    'from "./core/app.constants"': 'from "../../core/app.constants"',
}

for before, after in replacements.items():
    text = text.replace(before, after)

# Make the new shell a genuinely typed module instead of carrying the old
# monolith's ts-nocheck debt forward.
text = text.replace(
    'import { lazy, Suspense, useMemo, useRef, useState } from "react";',
    'import { Suspense, useEffect, useMemo, useRef, useState } from "react";'
)
text = text.replace(
    'import type { CSSProperties } from "react";',
    'import type { CSSProperties, SyntheticEvent } from "react";'
)
text = text.replace(
    'import { Heart, HeartOff, ImagePlus, Save, Shuffle, Trash2, X } from "lucide-react";',
    'import { FolderPlus, Heart, HeartOff, ImagePlus, Pencil, Play, Plus, Save, Shuffle, SkipForward, Trash2, X } from "lucide-react";'
)
text = text.replace(
    'import {\n  CheckMiniIcon, EmptyCoverIcon, LocaltifyStateCard, MascotHelperBubble, MascotStateArt, MetaDividerDot,\n  PlusMiniIcon, ResultStatusIcon, UpdateStatusIcon, WindowCloseIcon, mascotStateForToast\n} from "../../shared/ui/LocaltifyViewUi";',
    'import { MascotStateArt, UpdateStatusIcon, WindowCloseIcon, mascotStateForToast } from "../../shared/ui/LocaltifyViewUi";\nimport type { LocaltifyStateCardTone, MascotStateKey } from "../../shared/ui/LocaltifyViewUi";'
)
text = text.replace(
    'import { clamp, formatTime, toCssUrl } from "../../shared/utils/format";',
    'import { clamp, formatTime } from "../../shared/utils/format";'
)
text = text.replace(
    'import { getAmbientStyle, getRendererSafeImageUrl, getSongAmbientSource } from "../covers/cover.ambient";',
    'import { getRendererSafeImageUrl } from "../covers/cover.ambient";'
)
text = text.replace('import { coverMoodName, pixelArtUrl } from "../covers";\n', '')
text = text.replace(
    'import { coverMoodOptions, settingsCategorySpring } from "../settings/settings.constants";',
    'import { settingsCategorySpring } from "../settings/settings.constants";'
)

# Drop props that were left behind when page JSX moved into feature views.
unused_props = {
    "misideModeActive",
    "openUpdateChangelog",
    "skipAvailableUpdate",
    "setImportAnimation",
    "currentTheme",
    "topArtists",
    "recentlyAdded",
    "setDownloadResults",
    "setDownloadQueue",
    "spotifyShowCookieInput",
    "setSpotifyShowCookieInput",
    "spotifyCookieDraft",
    "setSpotifyCookieDraft",
    "handleSpotifySetCookie",
    "currentTime",
}
start = text.index("  const {\n")
end = text.index("\n  } = props;", start)
head = text[:start]
block = text[start:end]
tail = text[end:]
block_lines = []
for line in block.splitlines():
    if line.startswith("    ") and line.strip().rstrip(",") in unused_props:
        continue
    block_lines.append(line)
text = head + "\n".join(block_lines) + tail

# The album importer already normalizes IDs to strings at runtime. Make that
# guarantee explicit so the feature-owned album type remains string[].
text = text.replace(
    'songIds: Array.isArray(album.songIds) ? [...new Set(album.songIds.map((id: unknown) => String(id || "").trim()).filter(Boolean))] : [],',
    'songIds: Array.isArray(album.songIds) ? [...new Set<string>(album.songIds.map((id: unknown) => String(id || "").trim()).filter((id: string) => Boolean(id)))] : [],'
)

text = text.replace('export type LocaltifyAppViewProps = Record<string, any>;', 'export type AppShellProps = Record<string, any>;')
text = text.replace('export default function LocaltifyAppView(props: LocaltifyAppViewProps) {', 'export default function AppShell(props: AppShellProps) {')

new.parent.mkdir(parents=True, exist_ok=True)
new.write_text(text, encoding="utf-8")
old.unlink()

app = src / "App.tsx"
app_text = app.read_text(encoding="utf-8-sig")
app_text = app_text.replace('import LocaltifyAppView from "./LocaltifyAppView";', 'import AppShell from "./features/shell/AppShell";')
app_text = app_text.replace('<LocaltifyAppView', '<AppShell')
app.write_text(app_text, encoding="utf-8")

# Align the declared album import result with the fields already returned and
# consumed by the current importer implementation.
dts = src / "localitfy.d.ts"
dts_text = dts.read_text(encoding="utf-8-sig")
dts_text = dts_text.replace(
    '    skippedDuplicates?: number;\n    songs: any[];',
    '    skippedDuplicates?: number;\n    duplicateCount?: number;\n    repairedExistingCount?: number;\n    songs: any[];'
)
dts.write_text(dts_text, encoding="utf-8")

# Tighten the boundary guard so the retired root monolith cannot return.
guard = ROOT / "scripts" / "check-phase1-boundaries.mjs"
guard_text = guard.read_text(encoding="utf-8")
if "LocaltifyAppView.tsx must stay deleted" not in guard_text:
    guard_text += '''\n\nif (fs.existsSync(path.join(root, "src", "LocaltifyAppView.tsx"))) {\n  console.error("[phase-boundaries] LocaltifyAppView.tsx must stay deleted after Phase 2 shell migration.");\n  process.exit(1);\n}\n'''
    guard.write_text(guard_text, encoding="utf-8")

print("[phase2-shell] moved renderer composition into typed features/shell/AppShell.tsx")
