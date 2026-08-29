import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = (relative) => path.join(root, relative);
const read = (relative) => fs.readFileSync(p(relative), "utf8");
const write = (relative, content) => {
  fs.mkdirSync(path.dirname(p(relative)), { recursive: true });
  fs.writeFileSync(p(relative), content.replace(/\r\n/g, "\n"), "utf8");
};
function replaceRequired(relative, from, to) {
  const source = read(relative);
  if (!source.includes(from)) throw new Error(`${relative}: missing expected text: ${from.slice(0,120)}`);
  write(relative, source.replace(from, to));
}
function addImport(relative, importLine, anchor) {
  let source = read(relative);
  if (source.includes(importLine)) return;
  if (anchor && source.includes(anchor)) source = source.replace(anchor, `${anchor}\n${importLine}`);
  else source = `${importLine}\n${source}`;
  write(relative, source);
}

// 1. Put global theme tokens under global styles instead of the Settings feature.
if (!fs.existsSync(p("src/styles/themes.css"))) {
  fs.renameSync(p("src/features/settings/themes.css"), p("src/styles/themes.css"));
} else if (fs.existsSync(p("src/features/settings/themes.css"))) {
  fs.rmSync(p("src/features/settings/themes.css"));
}

// 2. Make CSS ownership follow runtime/component ownership.
const appCssBlock = `import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./styles/tokens.css";
import "./features/shell/app-core.css";
import "./App.css";
import "./features/settings/themes.css";
import "./features/settings/settings.css";
import "./features/home/home.css";
import "./features/shell/motion.css";
import "./features/onboarding/onboarding.css";
import "./features/player/player.css";
import "./features/shell/effects.css";`;
replaceRequired("src/App.tsx", appCssBlock, `import "./App.css";`);

write("src/main.tsx", `import "./index.css";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./app/AppErrorBoundary";

/* Global typography, design tokens, and theme variables. */
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./styles/tokens.css";
import "./styles/themes.css";

/* Shared renderer primitives and temporary reset foundation. */
import "./shared/ui/view-ui.css";
import "./styles/page-foundation.css";

/* Performance overrides intentionally stay last in the renderer cascade. */
import "./features/shell/performance.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
`);

addImport("src/features/home/HomeView.tsx", 'import "./home.css";', 'import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";');
addImport("src/Onboarding.tsx", 'import "./features/onboarding/onboarding.css";');
addImport("src/features/player/components/PlayerBar.tsx", 'import "../player.css";', 'import { Repeat2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";');
addImport("src/features/settings/SettingsView.tsx", 'import "./settings.css";');
addImport("src/features/settings/SettingsModal.tsx", 'import "./settings.css";');

// Shell owns shell-only CSS and lazy-loads rebuildable page modules.
let shell = read("src/features/shell/AppShell.tsx");
shell = shell.replace('import { Suspense } from "react";', 'import { lazy, Suspense } from "react";');
for (const line of [
  'import LibraryView from "../library/LibraryView";\n',
  'import AlbumsView from "../albums/AlbumsView";\n',
  'import PlaylistsView from "../playlists/PlaylistsView";\n',
  'import CoversView from "../covers/CoversView";\n',
  'import AnalyticsView from "../analytics/AnalyticsView";\n',
  'import SettingsView from "../settings/SettingsView";\n',
  'import DownloadsView from "../downloads/DownloadsView";\n'
]) shell = shell.replace(line, "");
const shellAnchor = 'import { yukariUpdateImage } from "../../core/app.constants";';
const shellInsert = `${shellAnchor}\nimport "./app-core.css";\nimport "./motion.css";\nimport "./effects.css";\nimport "../../styles/view-shell.css";\n\nconst LibraryView = lazy(() => import("../library/LibraryView"));\nconst AlbumsView = lazy(() => import("../albums/AlbumsView"));\nconst PlaylistsView = lazy(() => import("../playlists/PlaylistsView"));\nconst CoversView = lazy(() => import("../covers/CoversView"));\nconst AnalyticsView = lazy(() => import("../analytics/AnalyticsView"));\nconst SettingsView = lazy(() => import("../settings/SettingsView"));\nconst DownloadsView = lazy(() => import("../downloads/DownloadsView"));`;
if (!shell.includes(shellAnchor)) throw new Error("AppShell import anchor missing");
shell = shell.replace(shellAnchor, shellInsert);
const pageBlock = `              {view === "home" ? <HomeView {...home} /> : null}

            {(view === "library" || view === "liked") ? <LibraryView {...library} /> : null}


            {view === "albums" ? <AlbumsView {...albums} /> : null}

            {view === "playlists" ? <PlaylistsView {...playlists} /> : null}

            {view === "covers" ? <CoversView {...covers} /> : null}

            {view === "analytics" ? <AnalyticsView {...analytics} /> : null}


            {view === "settings" ? <SettingsView {...settingsView} /> : null}

            {view === "downloads" ? <DownloadsView {...downloads} /> : null}`;
const pageBlockNext = `              {view === "home" ? <HomeView {...home} /> : null}

              <Suspense fallback={null}>
                {(view === "library" || view === "liked") ? <LibraryView {...library} /> : null}
                {view === "albums" ? <AlbumsView {...albums} /> : null}
                {view === "playlists" ? <PlaylistsView {...playlists} /> : null}
                {view === "covers" ? <CoversView {...covers} /> : null}
                {view === "analytics" ? <AnalyticsView {...analytics} /> : null}
                {view === "settings" ? <SettingsView {...settingsView} /> : null}
                {view === "downloads" ? <DownloadsView {...downloads} /> : null}
              </Suspense>`;
if (!shell.includes(pageBlock)) throw new Error("AppShell page block missing");
shell = shell.replace(pageBlock, pageBlockNext);
write("src/features/shell/AppShell.tsx", shell);

// 3. Make ground-zero reset an explicit temporary state. A redesigned page can remove this flag.
const resetRoots = [
  ["src/features/library/LibraryView.tsx", 'data-page-section="library"', 'data-page-section="library" data-page-state="reset"'],
  ["src/features/albums/AlbumsView.tsx", 'data-page-section="albums"', 'data-page-section="albums" data-page-state="reset"'],
  ["src/features/playlists/PlaylistsView.tsx", 'data-page-section="playlists"', 'data-page-section="playlists" data-page-state="reset"'],
  ["src/features/downloads/DownloadsView.tsx", 'data-page-section="downloads"', 'data-page-section="downloads" data-page-state="reset"'],
  ["src/features/analytics/AnalyticsView.tsx", 'data-page-section="analytics"', 'data-page-section="analytics" data-page-state="reset"'],
  ["src/features/covers/CoverStudio.tsx", 'data-page-section="covers"', 'data-page-section="covers" data-page-state="reset"'],
  ["src/features/settings/SettingsView.tsx", 'data-page-section="settings"', 'data-page-section="settings" data-page-state="reset"']
];
for (const [relative, from, to] of resetRoots) replaceRequired(relative, from, to);

const reset = '.pageTransition:not(.pageTransition-home) [data-page-section][data-page-state="reset"]';
write("src/styles/page-foundation.css", `/* Temporary layout for pages awaiting redesign. Remove data-page-state="reset" when a page gets its own CSS. */

${reset},
${reset} * {
  box-sizing: border-box;
}

${reset} {
  width: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  display: grid;
  align-content: start;
  gap: 16px;
}

/* Neutralize historical global surfaces only while the page explicitly opts into reset mode. */
${reset} :where(
  .panel, .libraryPanelV025, .likedLibraryPanelV025, .libraryQuickMetaV039 > span,
  .libraryMissingStripV039, .songRow, .albumsHeroPanelV318, .albumCardV318,
  .albumDetailPanelV318, .albumBuilderPanelV318, .playlistHeroPanel, .playlistCreatePanel,
  .playlistShelfPanel, .playlistTracksPanel, .playlistTrackRow, .coverStudioHero,
  .coverSelectedSongsPanel, .coverGalleryPanel, .coverGalleryCardCleanOnly, .downloadPanelV031,
  .downloadQueuePanel, .converterBoxV031, .spotifyTrackItemV326, .analyticsHeroV339,
  .analyticsRecapCardV339, .analyticsSnapshotCardV339, .analyticsMiniCardV339,
  .analyticsSharePanelV339, .settingsHeroV027, .settingsPanelCard, .settingsPageCard,
  .settingsFocusPanelV491
) {
  border-color: transparent !important;
  border-image: none !important;
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  text-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
}

${reset} :where(.softButton, .mainAction, .heroMain, .heroGhost, .shuffleLibraryButtonV025, .settingsTinyButton, .settingsActionButton) {
  background-image: none !important;
  box-shadow: none !important;
  filter: none !important;
}

${reset} :where(button, input, select, textarea) { max-width: 100%; font: inherit; }
${reset} :where(button, [role="button"]) { cursor: pointer; }

${reset}:where(.libraryPanelV025, .likedLibraryPanelV025, .albumsPageV318, .playlistsPage, .coverStudioLayout, .downloadsLayoutV031, .analyticsStudioV339, .settingsPageV027) {
  width: 100%;
  min-width: 0;
}

${reset}:where(.libraryPanelV025, .likedLibraryPanelV025) {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

${reset} :where(.libraryPanelHeadV025, .libraryPanelActionsV025, .libraryMissingActionsV039, .panelHead, .downloadActionRow, .converterActions, .downloadTabStrip) {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
${reset} :where(.libraryPanelHeadV025, .panelHead) { justify-content: space-between; }

${reset} :where(.libraryQuickMetaV039, .libraryCoverCardsGridV321, .albumsGridV318, .playlistShelfGrid, .coverGalleryGrid, .analyticsRecapGridV339, .analyticsMiniGridV339, .settingsThemeGrid) {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

${reset} .libraryMissingStripV039 {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

${reset} :where(.libraryFullListV025, .libraryCoverCardShellV321, .virtualSongViewport, .coverVirtualGalleryViewport, .coverGalleryViewport, .downloadQueueList, .spotifyTrackList) {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

${reset}:where(.albumsPageV318, .playlistsPage, .coverStudioLayout, .analyticsStudioV339, .settingsPageV027) {
  display: grid;
  gap: 16px;
}

${reset} :where(.playlistTopGrid, .playlistContentGrid, .downloadsLayoutV031, .coverStudioBody, .settingsLayout, .settingsPageLayoutV027),
${reset}.downloadsLayoutV031 {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, .42fr);
  gap: 16px;
  align-items: start;
}

${reset} :where(.settingsLayout, .settingsPageLayoutV027) { grid-template-columns: minmax(190px, 230px) minmax(0, 1fr); }
${reset} :where(.playlistTrackRow, .spotifyTrackItemV326, .songRow, .albumCardV318) { min-width: 0; }

@media (max-width: 1180px) {
  ${reset} :where(.playlistTopGrid, .playlistContentGrid, .downloadsLayoutV031, .coverStudioBody, .settingsLayout, .settingsPageLayoutV027),
  ${reset}.downloadsLayoutV031 { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  ${reset} .libraryMissingStripV039 { grid-template-columns: 1fr; }
  ${reset} :where(.libraryQuickMetaV039, .libraryCoverCardsGridV321, .albumsGridV318, .playlistShelfGrid, .coverGalleryGrid, .analyticsRecapGridV339, .analyticsMiniGridV339, .settingsThemeGrid) {
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  }
}
`);

// 4. Tighten the easiest high-value renderer boundaries without changing behavior.
let library = read("src/features/library/LibraryView.tsx");
library = library.replace('import { LocaltifyStateCard, MascotStateArt } from "../../shared/ui/LocaltifyViewUi";', `import type { DragEventHandler, ReactNode } from "react";\nimport { LocaltifyStateCard, MascotStateArt } from "../../shared/ui/LocaltifyViewUi";\nimport type { Song } from "./song.types";\nimport type { Playlist } from "../playlists/playlist.types";\nimport type { Settings } from "../settings/settings.types";\nimport type { View } from "../shell/view.types";`);
library = library.replace(/export type LibraryViewProps = \{[\s\S]*?\n\};\n\nexport default function LibraryView/, `export type LibraryViewProps = {
  changeView: (view: View, source?: string) => unknown;
  deleteBusy: boolean;
  handleLibraryAreaDragLeave: DragEventHandler<HTMLDivElement>;
  handleLibraryAreaDragOver: DragEventHandler<HTMLDivElement>;
  handleLibraryAreaDrop: DragEventHandler<HTMLDivElement>;
  handleSearchInput: (value: string) => unknown;
  importSongs: () => unknown;
  libraryAlbumCount: number;
  libraryArtistCount: number;
  libraryMissingLabel: string;
  missingFileCount: number;
  now: unknown;
  playlists: Playlist[];
  query: string;
  removeMissingSongs: () => Promise<unknown> | unknown;
  renderHomeSongCards: (songs: Song[], className?: string) => ReactNode;
  renderSongRows: (songs: Song[], className?: string) => ReactNode;
  setLibraryFilterMode?: (mode: "all" | "missing") => unknown;
  settings: Pick<Settings, "libraryRowStyle">;
  showingMissingFiles: boolean;
  shuffleLibrarySongsAction: () => unknown;
  songs: Song[];
  view: View;
  visibleSongs: Song[];
};

export default function LibraryView`);
write("src/features/library/LibraryView.tsx", library);

let covers = read("src/features/covers/CoversView.tsx");
covers = covers.replace('import { Suspense } from "react";', 'import { Suspense } from "react";\nimport type { CoverSong, CoverStudioProps } from "./cover.types";');
covers = covers.replace(/export type CoversViewProps = \{[\s\S]*?\n\};\n\nexport default function CoversView/, `export type CoversViewProps = Pick<CoverStudioProps,
  | "ambientStyle" | "applyCoverAssetToSelection" | "coverGalleryMood" | "coverMoodCounts"
  | "coverPickerSongList" | "coverSelectedSongIds" | "coverStats" | "currentSong"
  | "filteredCoverGalleryAssets" | "pixelArtBusy" | "randomizeSelectedCovers" | "rescanPixelArtFolder"
  | "selectCurrentSongForCovers" | "selectVisibleSongsForCovers" | "selectedCoverSongs"
  | "setCoverGalleryMood" | "setCoverSelectedSongIds" | "toggleCoverSongSelection"
  | "togglePixelCoverExcluded" | "togglePixelCoverFavorite"
> & {
  importSongs: () => unknown;
  now: unknown;
  songs: CoverSong[];
};

export default function CoversView`);
write("src/features/covers/CoversView.tsx", covers);

let player = read("src/features/player/components/PlayerBar.tsx");
player = player.replace('import { Repeat2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";', `import type { CSSProperties, Dispatch, DragEventHandler, MutableRefObject, PointerEventHandler, SetStateAction } from "react";\nimport { Repeat2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";`);
player = player.replace('import { prettyMeta, prettyTitle } from "../../search/search.utils";', `import { prettyMeta, prettyTitle } from "../../search/search.utils";\nimport type { Song } from "../../library/song.types";\nimport type { Settings } from "../../settings/settings.types";\nimport type { CoverColorSyncMode } from "../../settings/theme.types";\nimport type { RepeatMode } from "../player.types";`);
player = player.replace(/export type PlayerBarProps = \{[\s\S]*?\n\};\n\nexport default function PlayerBar/, `export type PlayerBarProps = {
  ambientStyle: CSSProperties;
  commitSeek: (value: string) => unknown;
  commitVolume: (value: string) => unknown;
  currentDuration: number;
  currentSong: Song | null;
  displayedProgress: number;
  displayedTime: number;
  draggedSongId: string;
  effectiveAmbient: boolean;
  effectiveCoverColorSyncMode: CoverColorSyncMode;
  handlePlayerDragLeave: DragEventHandler<HTMLElement>;
  handlePlayerDragOver: DragEventHandler<HTMLElement>;
  handlePlayerDrop: DragEventHandler<HTMLElement>;
  isPlaying: boolean;
  isSeeking: boolean;
  isShuffle: boolean;
  isVolumeDragging: boolean;
  nowPlayingSongMotionClass: string;
  nowPlayingTransitionKey: string | number;
  playButtonBurst: number;
  playNext: (automatic?: boolean, source?: string) => unknown;
  playPrevious: () => unknown;
  previewSeek: (value: string, input: HTMLInputElement) => unknown;
  previewVolume: (value: string, input: HTMLInputElement) => unknown;
  progressDurationLabelRefs: MutableRefObject<Array<HTMLSpanElement | null>>;
  progressInputRefs: MutableRefObject<Array<HTMLInputElement | null>>;
  progressRangeStyle: CSSProperties;
  progressTimeLabelRefs: MutableRefObject<Array<HTMLSpanElement | null>>;
  queueDropHot: boolean;
  repeatButtonAriaLabel: string;
  repeatButtonStateText: string;
  repeatButtonTitle: string;
  repeatMode: RepeatMode;
  setIsShuffle: Dispatch<SetStateAction<boolean>>;
  setIsVolumeDragging: Dispatch<SetStateAction<boolean>>;
  settings: Pick<Settings, "volume">;
  startPlayerResize: PointerEventHandler<HTMLButtonElement>;
  startSeekPreview: (value: string, input: HTMLInputElement) => unknown;
  togglePlay: () => unknown;
  toggleRepeat: () => unknown;
  updateSetting: (key: "volume", value: number, persist?: boolean) => unknown;
  volumeDraft: number;
  volumeDraftRef: MutableRefObject<number>;
  volumeRangeStyle: CSSProperties;
};

export default function PlayerBar`);
write("src/features/player/components/PlayerBar.tsx", player);

let analyticsView = read("src/features/analytics/AnalyticsView.tsx");
analyticsView = analyticsView.replace('import { prettyTitle } from "../search/search.utils";', 'import { prettyTitle } from "../search/search.utils";\nimport type { Song } from "../library/song.types";');
analyticsView = analyticsView.replace(/export type AnalyticsViewProps = \{[\s\S]*?\n\};\n\nexport default function AnalyticsView/, `export type AnalyticsRecapCard = { label: string; value: string; note: string; meta: string; progress?: number };
export type AnalyticsStatCard = { label: string; value: string; note: string };
export type AnalyticsViewProps = {
  analyticsRecapCards: AnalyticsRecapCard[];
  analyticsStatCards: AnalyticsStatCard[];
  averageSongSeconds: number;
  importSongs: () => unknown;
  libraryHealthLabel: string;
  libraryLengthLabel: string;
  likedPercent: number;
  longestSong: Song | null;
  missingFileCount: number;
  neverPlayedSongs: Song[];
  playedPercent: number;
  ready: boolean;
  recentImportWeekCount: number;
  songs: Song[];
};

export default function AnalyticsView`);
write("src/features/analytics/AnalyticsView.tsx", analyticsView);

let snapshot = read("src/features/analytics/analyticsSnapshot.ts");
snapshot = `import type { Song } from "../library/song.types";\nimport type { Playlist } from "../playlists/playlist.types";\nimport type { Settings } from "../settings/settings.types";\nimport type { RepeatMode } from "../player/player.types";\n\n` + snapshot;
snapshot = snapshot.replace(`export type LocaltifyAnalyticsSnapshotInput = {\n  activeView: string;\n  songs?: any[];\n  likedCount?: number;\n  playlists?: any[];\n  settings?: Record<string, any>;\n  isShuffle?: boolean;\n  repeatMode?: string;\n  downloadResultCount?: number;\n};`, `export type LocaltifyAnalyticsSnapshotInput = {
  activeView: string;
  songs?: Song[];
  likedCount?: number;
  playlists?: Playlist[];
  settings?: Partial<Settings>;
  isShuffle?: boolean;
  repeatMode?: RepeatMode;
  downloadResultCount?: number;
};`);
snapshot = snapshot.replace(/export function computeLocaltifyAnalyticsSnapshot\(input: \{[\s\S]*?\n\}\): LocaltifyAnalyticsSnapshot \{/, 'export function computeLocaltifyAnalyticsSnapshot(input: LocaltifyAnalyticsSnapshotInput): LocaltifyAnalyticsSnapshot {');
write("src/features/analytics/analyticsSnapshot.ts", snapshot);

// 5. Permanent CI restored; use Node-24 action runtimes and Node 22 for the app itself.
write(".github/workflows/quality.yml", `name: quality

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: quality-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  linux-validation:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run release:check

  windows-native-smoke:
    runs-on: windows-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run check
      - name: Electron runtime smoke
        timeout-minutes: 1
        run: npx electron scripts/ci-electron-smoke.cjs

  discord-activity:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    defaults:
      run:
        working-directory: discord-activity
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: discord-activity/package-lock.json
      - run: npm ci
      - run: npm run build
`);
write("scripts/ci-electron-smoke.cjs", `const { app } = require("electron");\n\nconst timeout = setTimeout(() => {\n  console.error("electron-smoke-timeout");\n  app.exit(1);\n}, 30_000);\ntimeout.unref();\n\napp.whenReady().then(() => {\n  clearTimeout(timeout);\n  console.log("electron-ready");\n  app.quit();\n}).catch((error) => {\n  clearTimeout(timeout);\n  console.error(error);\n  app.exit(1);\n});\n`);

// 6. Update ownership/budget references after the theme move.
for (const relative of ["scripts/check-performance-budgets.mjs", "CONTRIBUTING.md", "tests/phase4/page-style-reset.test.mjs", "tests/phase4/ground-zero-css.test.mjs"]) {
  let source = read(relative);
  source = source.replaceAll("src/features/settings/themes.css", "src/styles/themes.css");
  write(relative, source);
}

// 7. Replace ownership checker with redesign-ready invariants and debt ratchets.
write("scripts/check-release-ui-ownership.mjs", `import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const count = (source, token) => source.split(token).length - 1;
const fail = (message) => failures.push(message);

const retiredPageStyles = [
  "src/features/library/library.css", "src/features/albums/albums.css", "src/features/playlists/playlists.css",
  "src/features/covers/covers.css", "src/features/downloads/downloads.css", "src/features/analytics/analytics.css"
];
const resetRoots = [".libraryPanelV025", ".albumsPageV318", ".playlistsPage", ".coverStudioLayout", ".downloadsLayoutV031", ".analyticsStudioV339", ".settingsPageV027"];
const resetSources = [
  ["src/features/library/LibraryView.tsx", "library"], ["src/features/albums/AlbumsView.tsx", "albums"],
  ["src/features/playlists/PlaylistsView.tsx", "playlists"], ["src/features/downloads/DownloadsView.tsx", "downloads"],
  ["src/features/analytics/AnalyticsView.tsx", "analytics"], ["src/features/covers/CoverStudio.tsx", "covers"],
  ["src/features/settings/SettingsView.tsx", "settings"]
];

for (const file of retiredPageStyles) if (exists(file)) fail(file + ": retired page CSS returned before redesign");
if (exists("src/features/settings/themes.css")) fail("global theme CSS returned to Settings ownership");
if (!exists("src/styles/themes.css")) fail("src/styles/themes.css is missing");

const app = read("src/App.tsx");
const appCssImports = [...app.matchAll(/import\\s+[\"']([^\"']+\\.css)[\"']/g)].map((match) => match[1]);
if (appCssImports.length !== 1 || appCssImports[0] !== "./App.css") fail("App.tsx must own only legacy App.css; feature CSS must be co-located");

const requiredOwners = [
  ["src/features/home/HomeView.tsx", './home.css'],
  ["src/Onboarding.tsx", './features/onboarding/onboarding.css'],
  ["src/features/player/components/PlayerBar.tsx", '../player.css'],
  ["src/features/settings/SettingsView.tsx", './settings.css'],
  ["src/features/settings/SettingsModal.tsx", './settings.css']
];
for (const [file, specifier] of requiredOwners) if (!read(file).includes('import "' + specifier + '";')) fail(file + ": missing co-located CSS owner " + specifier);

const shell = read("src/features/shell/AppShell.tsx");
for (const specifier of ["./app-core.css", "./motion.css", "./effects.css", "../../styles/view-shell.css"]) if (!shell.includes('import "' + specifier + '";')) fail("AppShell missing shell CSS owner " + specifier);
for (const modulePath of ["library/LibraryView", "albums/AlbumsView", "playlists/PlaylistsView", "covers/CoversView", "analytics/AnalyticsView", "settings/SettingsView", "downloads/DownloadsView"]) {
  if (!shell.includes('lazy(() => import("../' + modulePath + '"))')) fail("AppShell must lazy-load " + modulePath);
}

const main = read("src/main.tsx");
for (const specifier of ["@fontsource/space-grotesk/500.css", "@fontsource/space-grotesk/600.css", "@fontsource/space-grotesk/700.css", "./styles/tokens.css", "./styles/themes.css", "./shared/ui/view-ui.css", "./styles/page-foundation.css", "./features/shell/performance.css"]) {
  if (!main.includes('import "' + specifier + '";')) fail("main.tsx missing global stylesheet " + specifier);
}
const mainCssImports = [...main.matchAll(/import\\s+[\"']([^\"']+\\.css)[\"']/g)].map((match) => match[1]);
if (mainCssImports.at(-1) !== "./features/shell/performance.css") fail("performance.css must remain the final renderer CSS import");

for (const [file, section] of resetSources) {
  const source = read(file);
  if (!source.includes('data-page-section="' + section + '" data-page-state="reset"')) fail(file + ": reset page must opt into data-page-state=reset");
}
const foundation = read("src/styles/page-foundation.css");
if (!foundation.includes('[data-page-section][data-page-state="reset"]')) fail("page foundation is not reset-state gated");
if (/\\[data-page-section\\](?!\\[data-page-state="reset"\\])/.test(foundation)) fail("page foundation contains an ungated page-section selector");
for (const rootSelector of resetRoots) {
  const index = foundation.indexOf(rootSelector);
  if (index < 0) fail("page foundation lost structural reset selector " + rootSelector);
}
for (const token of ["linear-gradient(", "radial-gradient("]) if (foundation.includes(token)) fail("visual skin leaked into page foundation: " + token);

for (const file of ["src/App.css", "src/features/shell/app-core.css", "src/features/shell/effects.css", "src/styles/themes.css", "src/styles/view-shell.css"]) {
  const source = read(file).replace(/\\/\\*[\\s\\S]*?\\*\\//g, " ");
  for (const selector of resetRoots) if (source.includes(selector)) fail(file + ": rebuild page selector leaked into global owner: " + selector);
}

const cssBudgets = [
  ["src/App.css", 238 * 1024, 2209], ["src/features/shell/app-core.css", 80 * 1024, 664],
  ["src/features/player/player.css", 75 * 1024, 819], ["src/features/shell/effects.css", 65 * 1024, 662],
  ["src/styles/themes.css", 83 * 1024, 2], ["src/styles/view-shell.css", 20 * 1024, 190],
  ["src/styles/page-foundation.css", 8 * 1024, 12], ["src/features/home/home.css", 20 * 1024, 11]
];
for (const [file, maxBytes, maxImportant] of cssBudgets) {
  if (!exists(file)) { fail(file + ": required CSS owner missing"); continue; }
  const source = read(file); const bytes = Buffer.byteLength(source); const important = count(source, "!important");
  if (bytes > maxBytes) fail(file + ": CSS size grew past ratchet (" + bytes + " > " + maxBytes + ")");
  if (important > maxImportant) fail(file + ": !important debt grew past ratchet (" + important + " > " + maxImportant + ")");
}

const anyBudgets = [
  ["src/App.tsx", 37], ["src/features/albums/AlbumsView.tsx", 69], ["src/features/downloads/DownloadsView.tsx", 54],
  ["src/features/playlists/PlaylistsView.tsx", 37], ["src/features/player/components/PlayerBar.tsx", 0],
  ["src/features/library/LibraryView.tsx", 0], ["src/features/covers/CoversView.tsx", 0],
  ["src/features/analytics/AnalyticsView.tsx", 0], ["src/features/analytics/analyticsSnapshot.ts", 0]
];
for (const [file, maxAny] of anyBudgets) {
  const hits = (read(file).match(/\\bany\\b/g) || []).length;
  if (hits > maxAny) fail(file + ": any debt grew past ratchet (" + hits + " > " + maxAny + ")");
}

if (!exists(".github/workflows/quality.yml")) fail("permanent quality workflow is missing");
if (!exists("scripts/ci-electron-smoke.cjs")) fail("Electron CI smoke script is missing");

if (failures.length) {
  console.error("[release-ui-ownership] failures:\\n- " + failures.join("\\n- "));
  process.exit(1);
}
console.log("[release-ui-ownership] OK; CSS ownership, reset gating, CI, lazy page boundaries, and debt ratchets are enforced.");
`);

// 8. Update tests to enforce the new ownership model and permanent CI.
write("tests/phase3/hardening.test.mjs", `import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("feature styles have canonical co-located ownership", () => {
  const app = read("src/App.tsx");
  const appCss = [...app.matchAll(/import\\s+[\"']([^\"']+\\.css)[\"']/g)].map((match) => match[1]);
  assert.deepEqual(appCss, ["./App.css"]);
  for (const [file, owned] of [
    ["src/features/home/HomeView.tsx", "./home.css"], ["src/Onboarding.tsx", "./features/onboarding/onboarding.css"],
    ["src/features/player/components/PlayerBar.tsx", "../player.css"], ["src/features/settings/SettingsView.tsx", "./settings.css"],
    ["src/features/shell/AppShell.tsx", "./app-core.css"]
  ]) assert.ok(read(file).includes(owned), file + " is missing " + owned);
  assert.equal(fs.existsSync(path.join(root, "src/features/settings/themes.css")), false);
  assert.equal(fs.existsSync(path.join(root, "src/styles/themes.css")), true);
});

test("main renderer sandbox is enabled and documented", () => {
  const main = read("electron/main.cjs"); const doc = read("docs/architecture/electron-sandbox.md");
  assert.match(main, /nodeIntegration:\\s*false/); assert.match(main, /contextIsolation:\\s*true/); assert.match(main, /sandbox:\\s*true/);
  assert.doesNotMatch(main, /sandbox:\\s*false/); assert.match(main, /webviewTag:\\s*false/); assert.match(main, /allowRunningInsecureContent:\\s*false/);
  assert.match(main, /navigateOnDragDrop:\\s*false/); assert.match(main, /isTrustedMainFrameIpcEvent/); assert.match(main, /rendererFileRoot/);
  assert.match(main, /installRendererSecurityGuards/); assert.match(main, /createIconRuntime/); assert.match(main, /createWindowTranslucencyRuntime/);
  assert.match(doc, /sandbox enabled/i); assert.match(doc, /trusted sender/i); assert.match(doc, /main frame/i);
});

test("hardening is enforced locally and in permanent CI", () => {
  for (const file of ["scripts/check-performance-budgets.mjs", "scripts/test-database-recovery.cjs", "scripts/css-hygiene.mjs", "scripts/ci-electron-smoke.cjs", ".github/workflows/quality.yml"]) assert.ok(fs.existsSync(path.join(root, file)), file + " missing");
  const workflow = read(".github/workflows/quality.yml");
  assert.match(workflow, /ubuntu-latest/); assert.match(workflow, /windows-latest/); assert.match(workflow, /npm run release:check/); assert.match(workflow, /ci-electron-smoke\\.cjs/); assert.match(workflow, /discord-activity/);
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.check, /bridge:check/); assert.match(pkg.scripts.check, /boundaries:check/); assert.match(pkg.scripts.check, /css:dedup:check/);
  assert.match(pkg.scripts.check, /typecheck/); assert.match(pkg.scripts.check, /db:recovery-test/); assert.match(pkg.scripts["hardening:check"], /performance:check/);
  assert.match(pkg.scripts["release:check"], /hardening:check/); assert.match(pkg.scripts["release:check"], /assets:compress:dry/);
});
`);

write("tests/phase4/ground-zero-css.test.mjs", `import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const megaFiles = ["src/App.css", "src/features/shell/app-core.css", "src/styles/themes.css", "src/features/shell/effects.css"];
const forbiddenPageTokens = [".libraryPanel", ".libraryQuick", ".libraryMissing", ".albumsPage", ".albumsHero", ".albumCard", ".playlistsPage", ".playlistHero", ".coverStudio", ".downloadsLayout", ".downloadPanel", ".spotifyTrack", ".analytics", ".settingsPage", ".settingsHero"];
const pages = [
  ["src/features/library/LibraryView.tsx", "library"], ["src/features/albums/AlbumsView.tsx", "albums"], ["src/features/playlists/PlaylistsView.tsx", "playlists"],
  ["src/features/downloads/DownloadsView.tsx", "downloads"], ["src/features/analytics/AnalyticsView.tsx", "analytics"], ["src/features/covers/CoverStudio.tsx", "covers"], ["src/features/settings/SettingsView.tsx", "settings"]
];

test("rebuildable pages explicitly opt into temporary reset mode", () => {
  for (const [relative, section] of pages) assert.ok(read(relative).includes('data-page-section="' + section + '" data-page-state="reset"'), relative + " is not reset-state gated");
});

test("historical global CSS cannot own rebuild page class families", () => {
  for (const relative of megaFiles) {
    const source = read(relative).replace(/\\/\\*[\\s\\S]*?\\*\\//g, " ");
    const leaked = forbiddenPageTokens.filter((token) => source.includes(token));
    assert.deepEqual(leaked, [], relative + " still owns reset page families: " + leaked.join(", "));
  }
});

test("ground-zero foundation only applies while reset state is present", () => {
  const source = read("src/styles/page-foundation.css");
  assert.ok(source.includes('[data-page-section][data-page-state="reset"]'));
  assert.doesNotMatch(source, /\\[data-page-section\\](?!\\[data-page-state="reset"\\])/);
  assert.ok(Buffer.byteLength(source) < 8 * 1024);
  for (const token of ["linear-gradient(", "radial-gradient("]) assert.equal(source.includes(token), false);
});

test("legacy root shim and sidebar geometry debt stay removed", () => {
  assert.equal(fs.existsSync(path.join(root, "src/useProximityMotion.ts")), false);
  assert.ok(read("src/App.tsx").includes('from "./features/shell/useProximityMotion"'));
  const appCss = read("src/App.css");
  for (const token of ["var(--sidebar-width-release)", "var(--sidebar-width-used)", "var(--sidebar-width, 249px)", "88px 218px", '[data-sidebar-behavior="hover"]', '[data-sidebar-behavior="slim"]']) assert.equal(appCss.includes(token), false, token);
});
`);

let pageResetTest = read("tests/phase4/page-style-reset.test.mjs");
pageResetTest = pageResetTest.replace('test("temporary page foundation stays structural and small", () => {', 'test("temporary page foundation stays reset-gated, structural, and small", () => {');
pageResetTest = pageResetTest.replace('  for (const selector of resetPageRoots) {', '  assert.ok(source.includes(\'[data-page-section][data-page-state="reset"]\'));\n  assert.doesNotMatch(source, /\\[data-page-section\\](?!\\[data-page-state="reset"\\])/);\n\n  for (const selector of resetPageRoots) {');
write("tests/phase4/page-style-reset.test.mjs", pageResetTest);

let cssOwnership = read("tests/phase4/css-view-ownership.test.mjs");
cssOwnership = cssOwnership.replace('    "./styles/view-shell.css",\n', '    "./styles/themes.css",\n');
write("tests/phase4/css-view-ownership.test.mjs", cssOwnership);

write("tests/phase4/redesign-readiness.test.mjs", `import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("non-Home page modules are lazy boundaries", () => {
  const shell = read("src/features/shell/AppShell.tsx");
  for (const modulePath of ["library/LibraryView", "albums/AlbumsView", "playlists/PlaylistsView", "covers/CoversView", "analytics/AnalyticsView", "settings/SettingsView", "downloads/DownloadsView"]) assert.ok(shell.includes('lazy(() => import("../' + modulePath + '"))'), modulePath);
  assert.match(shell, /<Suspense fallback=\{null\}>/);
});

test("typed redesign boundaries cannot regress to any", () => {
  for (const relative of ["src/features/library/LibraryView.tsx", "src/features/covers/CoversView.tsx", "src/features/player/components/PlayerBar.tsx", "src/features/analytics/AnalyticsView.tsx", "src/features/analytics/analyticsSnapshot.ts"]) assert.equal((read(relative).match(/\\bany\\b/g) || []).length, 0, relative + " regained any");
});

test("theme CSS is globally owned and feature CSS is co-located", () => {
  assert.equal(fs.existsSync(path.join(root, "src/features/settings/themes.css")), false);
  assert.equal(fs.existsSync(path.join(root, "src/styles/themes.css")), true);
  assert.deepEqual([...read("src/App.tsx").matchAll(/import\\s+[\"']([^\"']+\\.css)[\"']/g)].map((m) => m[1]), ["./App.css"]);
});
`);

console.log("[redesign-readiness] ownership, reset gating, typed boundaries, lazy pages, and permanent CI prepared");
