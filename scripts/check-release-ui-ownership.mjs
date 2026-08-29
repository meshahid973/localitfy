import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const count = (source, token) => source.split(token).length - 1;
function countLooseAny(source) {
  const patterns = [
    /:\s*any\b/g,
    /\bas\s+any\b/g,
    /<\s*any\s*>/g,
    /\bany\s*\[\s*\]/g,
    /\b(?:Record|Array|Promise|Map|Set)<[^>]*\bany\b[^>]*>/g
  ];
  return patterns.reduce((total, pattern) => total + (source.match(pattern) || []).length, 0);
}
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
const appCssImports = [...app.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
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
const mainCssImports = [...main.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
if (mainCssImports.at(-1) !== "./features/shell/performance.css") fail("performance.css must remain the final renderer CSS import");

for (const [file, section] of resetSources) {
  const source = read(file);
  if (!source.includes('data-page-section="' + section + '" data-page-state="reset"')) fail(file + ": reset page must opt into data-page-state=reset");
}
const foundation = read("src/styles/page-foundation.css");
if (!foundation.includes('[data-page-section][data-page-state="reset"]')) fail("page foundation is not reset-state gated");
if (/\[data-page-section\](?!\[data-page-state="reset"\])/.test(foundation)) fail("page foundation contains an ungated page-section selector");
for (const rootSelector of resetRoots) {
  const index = foundation.indexOf(rootSelector);
  if (index < 0) fail("page foundation lost structural reset selector " + rootSelector);
}
for (const token of ["linear-gradient(", "radial-gradient("]) if (foundation.includes(token)) fail("visual skin leaked into page foundation: " + token);

for (const file of ["src/App.css", "src/features/shell/app-core.css", "src/features/shell/effects.css", "src/styles/themes.css", "src/styles/view-shell.css"]) {
  const source = read(file).replace(/\/\*[\s\S]*?\*\//g, " ");
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
  ["src/App.tsx", 38], ["src/features/albums/AlbumsView.tsx", 69], ["src/features/downloads/DownloadsView.tsx", 54],
  ["src/features/playlists/PlaylistsView.tsx", 37], ["src/features/player/components/PlayerBar.tsx", 0],
  ["src/features/library/LibraryView.tsx", 0], ["src/features/covers/CoversView.tsx", 0],
  ["src/features/analytics/AnalyticsView.tsx", 0], ["src/features/analytics/analyticsSnapshot.ts", 0]
];
for (const [file, maxAny] of anyBudgets) {
  const hits = countLooseAny(read(file));
  if (hits > maxAny) fail(file + ": any debt grew past ratchet (" + hits + " > " + maxAny + ")");
}

if (!exists(".github/workflows/quality.yml")) fail("permanent quality workflow is missing");
if (!exists("scripts/ci-electron-smoke.cjs")) fail("Electron CI smoke script is missing");

if (failures.length) {
  console.error("[release-ui-ownership] failures:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("[release-ui-ownership] OK; CSS ownership, reset gating, CI, lazy page boundaries, and debt ratchets are enforced.");
