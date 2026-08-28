import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function reject(relativePath, tokens) {
  const source = read(relativePath);
  for (const token of tokens) {
    if (source.toLowerCase().includes(token.toLowerCase())) failures.push(`${relativePath}: retired token remains: ${token}`);
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

reject("src/features/home/HomeView.tsx", retiredHomeTokens);
reject("src/features/home/home.css", retiredHomeTokens);
reject("src/App.tsx", ["quickLibraryMoreBlur", "showHomeSideCards", "homeDashboardClass", "settings.homeExpanded", "settings.showRightColumn"]);
reject("src/features/settings/settings.types.ts", ["homeExpanded:", "showRightColumn:", "quickLibraryMoreBlur:"]);
reject("src/features/settings/settings.constants.ts", ["homeExpanded:", "showRightColumn:", "quickLibraryMoreBlur:"]);
for (const css of ["src/App.css", "src/features/shell/motion.css", "src/features/shell/performance.css"]) reject(css, retiredHomeTokens.slice(1));
reject("src/features/settings/categories/AdvancedSettings.tsx", ["Right side cards"]);
reject("src/app/runtime/useBodyRuntimeClasses.ts", ["localtifyWantMoreBlur", "localtifyNoMoreBlur"]);
reject("src/features/shell/performance.css", ["localtifyNoMoreBlur", "localtifyWantMoreBlur"]);

const proximityShimPath = path.join(root, "src/useProximityMotion.ts");
if (!fs.existsSync(proximityShimPath)) {
  failures.push("src/useProximityMotion.ts: compatibility seam is missing before App import migration");
} else {
  const proximityShim = read("src/useProximityMotion.ts").trim();
  if (proximityShim !== 'export { useProximityMotion } from "./features/shell/useProximityMotion";') {
    failures.push("src/useProximityMotion.ts: root module must remain a pure compatibility re-export; no second motion owner");
  }
}

const appSource = read("src/App.tsx");
const allowedRootOwners = new Set(["useProximityMotion", "Onboarding", "CatBuddy"]);
const rootCompatibilityImports = [...appSource.matchAll(/from\s+["']\.\/(?!features\/|app\/|core\/|shared\/|platform\/|analytics(?:["']))([^"']+)["']/g)]
  .map((match) => match[1])
  .filter((specifier) => !allowedRootOwners.has(specifier));
if (rootCompatibilityImports.length) {
  failures.push(`src/App.tsx: unexpected root imports are forbidden: ${rootCompatibilityImports.join(", ")}`);
}
if ((appSource.match(/from\s+["']\.\/useProximityMotion["']/g) || []).length > 1) {
  failures.push("src/App.tsx: proximity compatibility import must occur at most once");
}

const motionPath = path.join(root, "src/features/shell/motion.css");
const motionBytes = fs.statSync(motionPath).size;
if (motionBytes > 20 * 1024) failures.push(`src/features/shell/motion.css: ${motionBytes} bytes exceeds 20 KiB ownership budget`);
reject("src/features/shell/motion.css", ["localtifyProximity", "VelocityMotionV320", "VelocityMotionV430"]);

const homeViewSource = read("src/features/home/HomeView.tsx");
if (homeViewSource.includes("[key: string]: any")) failures.push("src/features/home/HomeView.tsx: loose index signature returned");
for (const marker of ["JUMP BACK IN", "Listen now", "Top Artists", "New Releases"]) {
  if (!homeViewSource.includes(marker)) failures.push(`src/features/home/HomeView.tsx: missing Home hierarchy marker ${marker}`);
}

const homePath = path.join(root, "src/features/home/home.css");
const homeBytes = fs.statSync(homePath).size;
if (homeBytes > 24 * 1024) failures.push(`src/features/home/home.css: ${homeBytes} bytes exceeds 24 KiB Home ownership budget`);
const homeCss = read("src/features/home/home.css");
if (!homeCss.includes(".app:has(.pageTransition-home)")) failures.push("src/features/home/home.css: Home shell rules must be scoped through .pageTransition-home");
if (fs.existsSync(path.join(root, "src/features/home/home-polish.css"))) failures.push("src/features/home/home-polish.css: duplicate Home override layer must stay removed");

const cssOwnershipBudgets = [
  ["src/App.css", 246 * 1024],
  ["src/features/shell/app-core.css", 112 * 1024],
  ["src/features/settings/settings.css", 204 * 1024],
  ["src/features/player/player.css", 160 * 1024],
  ["src/features/shell/effects.css", 96 * 1024],
  ["src/shared/ui/view-ui.css", 16 * 1024],
  ["src/features/library/library.css", 20 * 1024],
  ["src/features/albums/albums.css", 36 * 1024],
  ["src/features/playlists/playlists.css", 32 * 1024],
  ["src/features/covers/covers.css", 32 * 1024],
  ["src/features/downloads/downloads.css", 36 * 1024],
  ["src/features/analytics/analytics.css", 24 * 1024]
];
for (const [relativePath, maxBytes] of cssOwnershipBudgets) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: required stylesheet owner is missing`);
    continue;
  }
  const bytes = fs.statSync(absolutePath).size;
  if (bytes > maxBytes) failures.push(`${relativePath}: ${(bytes / 1024).toFixed(1)} KiB exceeds ${(maxBytes / 1024).toFixed(0)} KiB ownership budget`);
}

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

const shell = read("src/features/shell/AppShell.tsx");
if (shell.includes("moreQuickLibraryBlur") || shell.includes("lessQuickLibraryBlur") || shell.includes("data-home-expanded")) {
  failures.push("src/features/shell/AppShell.tsx: retired Quick Library runtime ownership remains");
}
if (!shell.includes("pageTransition-${view}")) failures.push("src/features/shell/AppShell.tsx: view-scoped page transition marker is missing");

const main = read("src/main.tsx");
if (main.includes("release.css")) failures.push("src/main.tsx: obsolete release.css override layer returned");
if (main.includes("home-polish.css")) failures.push("src/main.tsx: duplicate Home polish import returned");
const appImport = main.indexOf('import App from "./App";');
const perfImport = main.indexOf('import "./features/shell/performance.css";');
if (appImport < 0 || perfImport < appImport) failures.push("src/main.tsx: performance.css must remain the final renderer policy after App CSS");

const rendererFeatureStyles = [
  "./shared/ui/view-ui.css",
  "./features/library/library.css",
  "./features/albums/albums.css",
  "./features/playlists/playlists.css",
  "./features/covers/covers.css",
  "./features/downloads/downloads.css",
  "./features/analytics/analytics.css"
];
for (const ownedImport of rendererFeatureStyles) {
  const statement = `import "${ownedImport}";`;
  if (!main.includes(statement)) failures.push(`src/main.tsx: missing feature stylesheet owner ${ownedImport}`);
  if (main.indexOf(statement) > perfImport) failures.push(`src/main.tsx: ${ownedImport} must load before performance.css`);
}

for (const forbiddenHomeSelector of [
  ".libraryPanelV025",
  ".albumsPageV318",
  ".playlistsPage",
  ".coverStudioLayout",
  ".downloadsLayoutV031",
  ".analyticsStudioV339",
  ".localtifyStateCardV373"
]) {
  if (homeCss.includes(forbiddenHomeSelector)) failures.push(`src/features/home/home.css: foreign selector returned: ${forbiddenHomeSelector}`);
}

if (fs.existsSync(path.join(root, "src/features/shell/release.css"))) failures.push("src/features/shell/release.css: obsolete override file must stay deleted");

if (failures.length) {
  console.error("[release-ui-ownership] failures:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`[release-ui-ownership] OK; Home is ${(homeBytes / 1024).toFixed(1)} KiB, canonical motion is ${(motionBytes / 1024).toFixed(1)} KiB, feature CSS owners are present and budgeted, and Home has one scoped stylesheet owner.`);
