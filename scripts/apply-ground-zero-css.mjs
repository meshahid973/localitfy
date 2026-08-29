import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const write = (relative, content) => {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content.replace(/\r\n/g, "\n"), "utf8");
};

function replaceRequired(relative, from, to) {
  const source = read(relative);
  if (!source.includes(from)) throw new Error(`${relative}: expected text missing: ${from.slice(0, 90)}`);
  write(relative, source.replace(from, to));
}

const pageClassMatchers = [
  /^library/i,
  /^likedLibrary/i,
  /^shuffleLibraryButton/i,
  /^dangerGhostV039$/,
  /^albums/i,
  /^albumFolder/i,
  /^albumCard/i,
  /^albumDetail/i,
  /^albumBuilder/i,
  /^albumDraft/i,
  /^albumMetaPills/i,
  /^albumActionRow/i,
  /^albumTrack/i,
  /^playlistsPage$/i,
  /^playlistPage/i,
  /^playlistTopGrid$/i,
  /^playlistHero/i,
  /^playlistCreate/i,
  /^playlistContentGrid$/i,
  /^playlistShelf/i,
  /^playlistTracks/i,
  /^playlistRename/i,
  /^playlistManage/i,
  /^playlistCover/i,
  /^playlistEmpty/i,
  /^playlistTrack/i,
  /^coverStudio/i,
  /^coverMood/i,
  /^coverSelected/i,
  /^coverPanel/i,
  /^coverSong/i,
  /^coverGallery/i,
  /^coverQuick/i,
  /^coverRecent/i,
  /^coverPreview/i,
  /^coverApply/i,
  /^downloadsLayout/i,
  /^download/i,
  /^spotify/i,
  /^converter/i,
  /^analytics/i,
  /^settingsPage/i,
  /^settingsHero/i,
  /^settingsLayout$/i,
  /^settingsPageLayout/i,
  /^settingsCategoryContent/i,
  /^settingsCategoryMotion/i
];

function isPageClass(name) {
  return pageClassMatchers.some((matcher) => matcher.test(name));
}

function skipComment(text, index, end) {
  const close = text.indexOf("*/", index + 2);
  return close === -1 || close >= end ? end : close + 2;
}

function skipString(text, index, end) {
  const quote = text[index];
  let cursor = index + 1;
  while (cursor < end) {
    if (text[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (text[cursor] === quote) return cursor + 1;
    cursor += 1;
  }
  return end;
}

function findMatchingBrace(text, open, end) {
  let depth = 1;
  for (let cursor = open + 1; cursor < end; cursor += 1) {
    const char = text[cursor];
    if (char === "/" && text[cursor + 1] === "*") {
      cursor = skipComment(text, cursor, end) - 1;
      continue;
    }
    if (char === '"' || char === "'") {
      cursor = skipString(text, cursor, end) - 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return cursor;
    }
  }
  throw new Error(`unbalanced CSS block at ${open}`);
}

function findBoundary(text, start, end) {
  let paren = 0;
  let bracket = 0;
  for (let cursor = start; cursor < end; cursor += 1) {
    const char = text[cursor];
    if (char === "/" && text[cursor + 1] === "*") {
      cursor = skipComment(text, cursor, end) - 1;
      continue;
    }
    if (char === '"' || char === "'") {
      cursor = skipString(text, cursor, end) - 1;
      continue;
    }
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (paren === 0 && bracket === 0 && (char === "{" || char === ";")) return { index: cursor, char };
  }
  return null;
}

function splitSelectorList(value) {
  const out = [];
  let start = 0;
  let paren = 0;
  let bracket = 0;
  for (let cursor = 0; cursor < value.length; cursor += 1) {
    const char = value[cursor];
    if (char === "/" && value[cursor + 1] === "*") {
      cursor = skipComment(value, cursor, value.length) - 1;
      continue;
    }
    if (char === '"' || char === "'") {
      cursor = skipString(value, cursor, value.length) - 1;
      continue;
    }
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === "," && paren === 0 && bracket === 0) {
      out.push(value.slice(start, cursor).trim());
      start = cursor + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out.filter(Boolean);
}

function selectorOwnsResetPage(selector) {
  const clean = selector.replace(/\/\*[\s\S]*?\*\//g, " ");
  for (const match of clean.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
    if (isPageClass(match[1])) return true;
  }
  return false;
}

function selectorOwnsLegacySidebarMode(selector) {
  return /\[data-sidebar-behavior=["'](?:hover|slim)["']\]/i.test(selector) || /\.sidebarHoverOpen\b/i.test(selector);
}

function transformRuleList(text, start = 0, end = text.length, options = {}) {
  let cursor = start;
  let output = "";
  while (cursor < end) {
    const triviaStart = cursor;
    while (cursor < end) {
      if (/\s/.test(text[cursor])) {
        cursor += 1;
        continue;
      }
      if (text[cursor] === "/" && text[cursor + 1] === "*") {
        cursor = skipComment(text, cursor, end);
        continue;
      }
      break;
    }
    output += text.slice(triviaStart, cursor);
    if (cursor >= end) break;

    const statementStart = cursor;
    const boundary = findBoundary(text, cursor, end);
    if (!boundary) {
      output += text.slice(cursor, end);
      break;
    }
    const preludeRaw = text.slice(statementStart, boundary.index);
    const prelude = preludeRaw.trim();
    if (boundary.char === ";") {
      output += text.slice(statementStart, boundary.index + 1);
      cursor = boundary.index + 1;
      continue;
    }

    const close = findMatchingBrace(text, boundary.index, end);
    const bodyStart = boundary.index + 1;
    const bodyEnd = close;
    if (prelude.startsWith("@")) {
      if (/^@(media|supports|container|layer|scope|document)\b/i.test(prelude)) {
        const body = transformRuleList(text, bodyStart, bodyEnd, options);
        output += `${preludeRaw}{${body}}`;
      } else {
        output += text.slice(statementStart, close + 1);
      }
      cursor = close + 1;
      continue;
    }

    const selectors = splitSelectorList(preludeRaw);
    const kept = selectors.filter((selector) => {
      if (selectorOwnsResetPage(selector)) return false;
      if (options.stripLegacySidebarModes && selectorOwnsLegacySidebarMode(selector)) return false;
      return true;
    });
    if (kept.length) output += `${kept.join(",\n")}{${text.slice(bodyStart, bodyEnd)}}`;
    cursor = close + 1;
  }
  return output;
}

replaceRequired("src/App.tsx", 'import { useProximityMotion } from "./useProximityMotion";', 'import { useProximityMotion } from "./features/shell/useProximityMotion";');
const shim = path.join(root, "src/useProximityMotion.ts");
if (fs.existsSync(shim)) fs.rmSync(shim);

const rootMarkers = [
  ["src/features/library/LibraryView.tsx", '<section className={`panel fillPanel libraryPanelV025 ${view === "liked" ? "likedPanel likedLibraryPanelV025" : ""}`}>', '<section data-page-section="library" className={`panel fillPanel libraryPanelV025 ${view === "liked" ? "likedPanel likedLibraryPanelV025" : ""}`}>'],
  ["src/features/albums/AlbumsView.tsx", '<section className="albumsPageV318">', '<section data-page-section="albums" className="albumsPageV318">'],
  ["src/features/playlists/PlaylistsView.tsx", '<section className="playlistsPage playlistPageV029">', '<section data-page-section="playlists" className="playlistsPage playlistPageV029">'],
  ["src/features/downloads/DownloadsView.tsx", '<section className="downloadsLayout downloadsLayoutV031">', '<section data-page-section="downloads" className="downloadsLayout downloadsLayoutV031">'],
  ["src/features/analytics/AnalyticsView.tsx", '<section className="analyticsStudioV339" aria-label="lightweight listening recap">', '<section data-page-section="analytics" className="analyticsStudioV339" aria-label="lightweight listening recap">'],
  ["src/features/covers/CoverStudio.tsx", 'return <section className="coverStudioLayout coverStudioCleanLayout">', 'return <section data-page-section="covers" className="coverStudioLayout coverStudioCleanLayout">'],
  ["src/features/settings/SettingsView.tsx", '<section className="settingsPage settingsPageV027">', '<section data-page-section="settings" className="settingsPage settingsPageV027">']
];
for (const [relative, from, to] of rootMarkers) replaceRequired(relative, from, to);

const megaFiles = [
  "src/App.css",
  "src/features/shell/app-core.css",
  "src/features/settings/themes.css",
  "src/features/shell/effects.css"
];
for (const relative of megaFiles) {
  const before = read(relative);
  let after = transformRuleList(before, 0, before.length, {
    stripLegacySidebarModes: relative === "src/App.css" || relative === "src/features/shell/app-core.css"
  });
  if (relative === "src/App.css") {
    after = after
      .replaceAll("var(--sidebar-width-used, var(--sidebar-width, 249px))", "var(--workspace-sidebar-current, 236px)")
      .replaceAll("var(--sidebar-width-used)", "var(--workspace-sidebar-current, 236px)")
      .replaceAll("var(--sidebar-width-release)", "var(--workspace-sidebar-current, 236px)")
      .replaceAll("var(--sidebar-width, 249px)", "var(--workspace-sidebar-current, 236px)")
      .replace("inset: 34px 0 88px 218px !important;", "inset: 34px 0 88px var(--workspace-sidebar-current, 236px) !important;");
  }
  write(relative, after);
  const removed = Buffer.byteLength(before) - Buffer.byteLength(after);
  console.log(`[ground-zero] ${relative}: removed ${(removed / 1024).toFixed(1)} KiB`);
}

const foundation = `/* Ground-zero structure for pages awaiting redesign. No page visual skin belongs here. */

.pageTransition:not(.pageTransition-home),
.pageTransition:not(.pageTransition-home) * {
  box-sizing: border-box;
}

.pageTransition:not(.pageTransition-home) [data-page-section] {
  width: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  display: grid;
  align-content: start;
  gap: 16px;
}

/* Remove inherited historical surfaces while preserving layout and interaction. */
.pageTransition:not(.pageTransition-home) [data-page-section] :where(
  .panel,
  .libraryPanelV025,
  .likedLibraryPanelV025,
  .libraryQuickMetaV039 > span,
  .libraryMissingStripV039,
  .songRow,
  .albumsHeroPanelV318,
  .albumCardV318,
  .albumDetailPanelV318,
  .albumBuilderPanelV318,
  .playlistHeroPanel,
  .playlistCreatePanel,
  .playlistShelfPanel,
  .playlistTracksPanel,
  .playlistTrackRow,
  .coverStudioHero,
  .coverSelectedSongsPanel,
  .coverGalleryPanel,
  .coverGalleryCardCleanOnly,
  .downloadPanelV031,
  .downloadQueuePanel,
  .converterBoxV031,
  .spotifyTrackItemV326,
  .analyticsHeroV339,
  .analyticsRecapCardV339,
  .analyticsSnapshotCardV339,
  .analyticsMiniCardV339,
  .analyticsSharePanelV339,
  .settingsHeroV027,
  .settingsPanelCard,
  .settingsPageCard,
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

.pageTransition:not(.pageTransition-home) [data-page-section] :where(
  .softButton,
  .mainAction,
  .heroMain,
  .heroGhost,
  .shuffleLibraryButtonV025,
  .settingsTinyButton,
  .settingsActionButton
) {
  background-image: none !important;
  box-shadow: none !important;
  filter: none !important;
}

.pageTransition:not(.pageTransition-home) [data-page-section] :where(button, input, select, textarea) {
  max-width: 100%;
  font: inherit;
}

.pageTransition:not(.pageTransition-home) [data-page-section] :where(button, [role="button"]) {
  cursor: pointer;
}

.libraryPanelV025,
.likedLibraryPanelV025,
.albumsPageV318,
.playlistsPage,
.coverStudioLayout,
.downloadsLayoutV031,
.analyticsStudioV339,
.settingsPageV027 {
  width: 100%;
  min-width: 0;
}

.libraryPanelV025,
.likedLibraryPanelV025 {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.libraryPanelHeadV025,
.libraryPanelActionsV025,
.libraryMissingActionsV039,
.panelHead,
.downloadActionRow,
.converterActions,
.downloadTabStrip {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.libraryPanelHeadV025,
.panelHead {
  justify-content: space-between;
}

.libraryQuickMetaV039,
.libraryCoverCardsGridV321,
.albumsGridV318,
.playlistShelfGrid,
.coverGalleryGrid,
.analyticsRecapGridV339,
.analyticsMiniGridV339,
.settingsThemeGrid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.libraryMissingStripV039 {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.libraryFullListV025,
.libraryCoverCardShellV321,
.virtualSongViewport,
.coverVirtualGalleryViewport,
.coverGalleryViewport,
.downloadQueueList,
.spotifyTrackList {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.albumsPageV318,
.playlistsPage,
.coverStudioLayout,
.analyticsStudioV339,
.settingsPageV027 {
  display: grid;
  gap: 16px;
}

.playlistTopGrid,
.playlistContentGrid,
.downloadsLayoutV031,
.coverStudioBody,
.settingsLayout,
.settingsPageLayoutV027 {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, .42fr);
  gap: 16px;
  align-items: start;
}

.settingsLayout,
.settingsPageLayoutV027 {
  grid-template-columns: minmax(190px, 230px) minmax(0, 1fr);
}

.playlistTrackRow,
.spotifyTrackItemV326,
.songRow,
.albumCardV318 {
  min-width: 0;
}

@media (max-width: 1180px) {
  .playlistTopGrid,
  .playlistContentGrid,
  .downloadsLayoutV031,
  .coverStudioBody,
  .settingsLayout,
  .settingsPageLayoutV027 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .libraryMissingStripV039 {
    grid-template-columns: 1fr;
  }

  .libraryQuickMetaV039,
  .libraryCoverCardsGridV321,
  .albumsGridV318,
  .playlistShelfGrid,
  .coverGalleryGrid,
  .analyticsRecapGridV339,
  .analyticsMiniGridV339,
  .settingsThemeGrid {
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  }
}
`;
write("src/styles/page-foundation.css", foundation);

const groundZeroTest = `import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const megaFiles = ["src/App.css", "src/features/shell/app-core.css", "src/features/settings/themes.css", "src/features/shell/effects.css"];
const pageMatchers = ${JSON.stringify(pageClassMatchers.map((matcher) => matcher.source))};
const isPageClass = (name) => pageMatchers.some((source) => new RegExp(source, "i").test(name));

test("rebuildable pages expose a neutral ownership root", () => {
  const expected = [
    ["src/features/library/LibraryView.tsx", 'data-page-section="library"'],
    ["src/features/albums/AlbumsView.tsx", 'data-page-section="albums"'],
    ["src/features/playlists/PlaylistsView.tsx", 'data-page-section="playlists"'],
    ["src/features/downloads/DownloadsView.tsx", 'data-page-section="downloads"'],
    ["src/features/analytics/AnalyticsView.tsx", 'data-page-section="analytics"'],
    ["src/features/covers/CoverStudio.tsx", 'data-page-section="covers"'],
    ["src/features/settings/SettingsView.tsx", 'data-page-section="settings"']
  ];
  for (const [relative, marker] of expected) assert.equal(read(relative).includes(marker), true, relative + " is missing " + marker);
});

test("historical mega CSS cannot own reset page class families", () => {
  for (const relative of megaFiles) {
    const source = read(relative).replace(/\\/\\*[\\s\\S]*?\\*\\//g, " ");
    const classes = [...source.matchAll(/\\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]);
    const leaked = [...new Set(classes.filter(isPageClass))];
    assert.deepEqual(leaked, [], relative + " still owns reset page classes: " + leaked.join(", "));
  }
});

test("legacy root shim and sidebar geometry debt stay removed", () => {
  assert.equal(fs.existsSync(path.join(root, "src/useProximityMotion.ts")), false, "root proximity hook shim returned");
  assert.equal(read("src/App.tsx").includes('from "./features/shell/useProximityMotion"'), true, "App is not using the canonical shell hook");
  const appCss = read("src/App.css");
  for (const token of ["var(--sidebar-width-release)", "var(--sidebar-width-used)", "var(--sidebar-width, 249px)", "88px 218px", '[data-sidebar-behavior="hover"]', '[data-sidebar-behavior="slim"]']) {
    assert.equal(appCss.includes(token), false, "App.css still contains legacy shell geometry: " + token);
  }
});

test("ground-zero foundation is structural, scoped, and small", () => {
  const source = read("src/styles/page-foundation.css");
  assert.equal(source.includes("[data-page-section]"), true);
  assert.equal(source.includes(".pageTransition:not(.pageTransition-home)"), true);
  assert.ok(Buffer.byteLength(source) < 8 * 1024, "page foundation exceeded 8 KiB");
  for (const token of ["linear-gradient(", "radial-gradient("]) assert.equal(source.includes(token), false, "visual skin leaked into page foundation");
});
`;
write("tests/phase4/ground-zero-css.test.mjs", groundZeroTest);

function ratchetBudget(relative, currentBudget) {
  const bytes = fs.statSync(path.join(root, relative)).size;
  return Math.max(8, Math.ceil(bytes / 1024) + 4);
}

const newBudgets = new Map([
  ["src/App.css", ratchetBudget("src/App.css")],
  ["src/features/shell/app-core.css", ratchetBudget("src/features/shell/app-core.css")],
  ["src/features/settings/themes.css", ratchetBudget("src/features/settings/themes.css")]
]);
for (const checker of ["scripts/check-performance-budgets.mjs", "scripts/check-release-ui-ownership.mjs"]) {
  let source = read(checker);
  for (const [relative, kib] of newBudgets) {
    const pattern = new RegExp(`(\\["${relative.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}",\\s*)\\d+(\\s*\\*\\s*(?:KiB|1024)\\])`, "g");
    source = source.replace(pattern, `$1${kib}$2`);
  }
  write(checker, source);
}

console.log("[ground-zero] page roots standardized, legacy page selectors purged, shell shim removed, and budgets ratcheted");
