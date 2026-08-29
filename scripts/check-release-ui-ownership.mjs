import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

function reject(relativePath, tokens) {
  const source = read(relativePath).toLowerCase();
  for (const token of tokens) {
    if (source.includes(token.toLowerCase())) failures.push(`${relativePath}: retired token remains: ${token}`);
  }
}

const retiredHomeTokens = [
  "quick library",
  "homeLibraryPanel",
  "homeLibraryActions",
  "homeShelfPanel",
  "homeShelfStack",
  "homeListenCard",
  "homeFreshCard",
  "homeFreshRail",
  "heroQuickActions",
  "heroTinyButton"
];

const retiredPageStyles = [
  "src/features/library/library.css",
  "src/features/albums/albums.css",
  "src/features/playlists/playlists.css",
  "src/features/covers/covers.css",
  "src/features/downloads/downloads.css",
  "src/features/analytics/analytics.css"
];

const resetPageRoots = [
  ".libraryPanelV025",
  ".albumsPageV318",
  ".playlistsPage",
  ".coverStudioLayout",
  ".downloadsLayoutV031",
  ".analyticsStudioV339"
];

reject("src/features/home/HomeView.tsx", retiredHomeTokens);
reject("src/features/home/home.css", retiredHomeTokens);
reject("src/App.tsx", ["quickLibraryMoreBlur", "showHomeSideCards", "homeDashboardClass", "settings.homeExpanded", "settings.showRightColumn"]);
reject("src/features/settings/settings.types.ts", ["homeExpanded:", "showRightColumn:", "quickLibraryMoreBlur:"]);
reject("src/features/settings/settings.constants.ts", ["homeExpanded:", "showRightColumn:", "quickLibraryMoreBlur:"]);

const homeViewSource = read("src/features/home/HomeView.tsx");
for (const marker of ["JUMP BACK IN", "Listen now", "Most listened", "New Releases"]) {
  if (!homeViewSource.includes(marker)) failures.push(`src/features/home/HomeView.tsx: missing Home hierarchy marker ${marker}`);
}
if (homeViewSource.includes("Top Artists")) failures.push("src/features/home/HomeView.tsx: retired Top Artists label returned");
if (homeViewSource.includes('style={{ transform: "none" }}')) failures.push("src/features/home/HomeView.tsx: CSS behavior leaked back into inline styles");

const homePath = path.join(root, "src/features/home/home.css");
const homeBytes = fs.statSync(homePath).size;
const homeCss = read("src/features/home/home.css");
if (homeBytes > 20 * 1024) failures.push(`src/features/home/home.css: ${homeBytes} bytes exceeds 20 KiB Home ownership budget`);
if (!homeCss.includes(".app:has(.pageTransition-home)")) failures.push("src/features/home/home.css: Home shell rules must stay scoped through .pageTransition-home");
if (!homeCss.includes("width: 100%")) failures.push("src/features/home/home.css: Home must fill the available content pane");
if (homeCss.includes("width: min(1560px") || homeCss.includes("width: min(1640px")) failures.push("src/features/home/home.css: retired desktop max-width returned");
if (exists("src/features/home/home-polish.css")) failures.push("src/features/home/home-polish.css: duplicate Home override layer must stay removed");

for (const relativePath of retiredPageStyles) {
  if (exists(relativePath)) failures.push(`${relativePath}: retired page design returned before its rebuild`);
}

for (const [relativePath, maxBytes] of [
  ["src/App.css", 238 * 1024],
  ["src/features/shell/app-core.css", 80 * 1024],
  ["src/features/settings/themes.css", 83 * 1024],
  ["src/features/settings/settings.css", 8 * 1024],
  ["src/features/player/player.css", 160 * 1024],
  ["src/features/shell/effects.css", 96 * 1024],
  ["src/shared/ui/view-ui.css", 16 * 1024],
  ["src/styles/page-foundation.css", 8 * 1024],
  ["src/styles/view-shell.css", 20 * 1024]
]) {
  if (!exists(relativePath)) {
    failures.push(`${relativePath}: required stylesheet owner is missing`);
    continue;
  }
  const bytes = fs.statSync(path.join(root, relativePath)).size;
  if (bytes > maxBytes) failures.push(`${relativePath}: ${(bytes / 1024).toFixed(1)} KiB exceeds ${(maxBytes / 1024).toFixed(0)} KiB ownership budget`);
}

const appSource = read("src/App.tsx");
for (const ownedImport of [
  './features/shell/app-core.css',
  './features/settings/themes.css',
  './features/settings/settings.css',
  './features/home/home.css',
  './features/shell/motion.css',
  './features/onboarding/onboarding.css',
  './features/player/player.css',
  './features/shell/effects.css'
]) {
  if (!appSource.includes(`import "${ownedImport}";`)) failures.push(`src/App.tsx: missing canonical owned stylesheet ${ownedImport}`);
}

const main = read("src/main.tsx");
if (main.includes("release.css")) failures.push("src/main.tsx: obsolete release.css override layer returned");
if (main.includes("home-polish.css")) failures.push("src/main.tsx: duplicate Home polish import returned");
for (const ownedImport of [
  "./shared/ui/view-ui.css",
  "./styles/view-shell.css",
  "./styles/page-foundation.css",
  "./features/shell/performance.css"
]) {
  if (!main.includes(`import "${ownedImport}";`)) failures.push(`src/main.tsx: missing renderer stylesheet ${ownedImport}`);
}
for (const relativePath of retiredPageStyles) {
  const specifier = relativePath.replace(/^src\//, "./");
  if (main.includes(specifier)) failures.push(`src/main.tsx: retired page stylesheet still imported ${specifier}`);
}
const perfImport = main.indexOf('import "./features/shell/performance.css";');
if (perfImport < 0) failures.push("src/main.tsx: performance.css is missing");

const workspaceCss = read("src/styles/view-shell.css");
for (const marker of [
  "--workspace-sidebar-expanded",
  "--workspace-sidebar-current",
  ".appShell",
  ".sidebar",
  '[data-sidebar-behavior="slim"]',
  '[data-sidebar-behavior="hover"]',
  ".pageTransition:not(.pageTransition-home)"
]) {
  if (!workspaceCss.includes(marker)) failures.push(`src/styles/view-shell.css: shared shell lost ${marker}`);
}
if (workspaceCss.includes("--workspace-max")) failures.push("src/styles/view-shell.css: retired workspace max-width returned");
for (const forbiddenPageSelector of [...resetPageRoots, ".settingsPageV027"]) {
  if (workspaceCss.includes(forbiddenPageSelector)) failures.push(`src/styles/view-shell.css: page design leaked into shell: ${forbiddenPageSelector}`);
}

const globalVisualOwners = [
  "src/App.css",
  "src/features/shell/app-core.css",
  "src/features/shell/effects.css",
  "src/features/settings/themes.css"
];
for (const relativePath of globalVisualOwners) {
  const source = read(relativePath);
  for (const selector of resetPageRoots) {
    if (source.includes(selector)) failures.push(`${relativePath}: reset page root leaked into global visual owner: ${selector}`);
  }
}

const foundation = read("src/styles/page-foundation.css");
for (const selector of resetPageRoots) {
  if (!foundation.includes(selector)) failures.push(`src/styles/page-foundation.css: structural reset root missing ${selector}`);
}
for (const visualToken of ["linear-gradient(", "radial-gradient("]) {
  if (foundation.includes(visualToken)) failures.push(`src/styles/page-foundation.css: visual styling leaked into structural foundation: ${visualToken}`);
}

const settingsView = read("src/features/settings/SettingsView.tsx");
if (settingsView.includes(": any")) failures.push("src/features/settings/SettingsView.tsx: loose any props returned");
const settingsCss = read("src/features/settings/settings.css");
if (!settingsCss.includes("Visual redesign intentionally removed")) failures.push("src/features/settings/settings.css: settings reset marker is missing");

if (failures.length) {
  console.error("[release-ui-ownership] failures:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`[release-ui-ownership] OK; Home is ${(homeBytes / 1024).toFixed(1)} KiB, page designs are reset, and shell geometry has one owner.`);
