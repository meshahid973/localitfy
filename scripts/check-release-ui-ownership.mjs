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

const rebuiltPageStyles = [
  "src/features/albums/albums.css", "src/features/playlists/playlists.css",
  "src/features/covers/covers.css", "src/features/downloads/downloads.css",
  "src/features/analytics/analytics.css", "src/features/settings/settings.css"
];
const featureRoots = [".albumsPageV318", ".playlistsPage", ".coverStudioLayout", ".downloadsLayoutV031", ".analyticsStudioV339", ".settingsPageV027"];
const resetSources = [
  ["src/features/genres/GenresView.tsx", "genres"], ["src/features/albums/AlbumsView.tsx", "albums"], ["src/features/playlists/PlaylistsView.tsx", "playlists"],
  ["src/features/downloads/DownloadsView.tsx", "downloads"], ["src/features/analytics/AnalyticsView.tsx", "analytics"],
  ["src/features/covers/CoverStudio.tsx", "covers"], ["src/features/settings/SettingsView.tsx", "settings"]
];

for (const file of rebuiltPageStyles) if (!exists(file)) fail(file + ": rebuilt page CSS is missing");
if (exists("src/features/settings/themes.css")) fail("global theme CSS returned to Settings ownership");
if (!exists("src/styles/themes.css")) fail("src/styles/themes.css is missing");

const app = read("src/App.tsx");
const appCssImports = [...app.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
if (appCssImports.length !== 1 || appCssImports[0] !== "./App.css") fail("App.tsx must own only legacy App.css; feature CSS must be co-located");

const requiredOwners = [
  ["src/features/home/HomeView.tsx", './home.css'],
  ["src/features/library/LibraryView.tsx", './library.css'],
  ["src/features/artists/ArtistsView.tsx", './artists.css'],
  ["src/features/genres/GenresView.tsx", './genres.css'],
  ["src/Onboarding.tsx", './features/onboarding/onboarding.css'],
  ["src/features/player/components/PlayerBar.tsx", '../player.css'],
  ["src/features/settings/SettingsView.tsx", './settings.css'],
  ["src/features/albums/AlbumsView.tsx", './albums.css'],
  ["src/features/playlists/PlaylistsView.tsx", './playlists.css'],
  ["src/features/covers/CoversView.tsx", './covers.css'],
  ["src/features/downloads/DownloadsView.tsx", './downloads.css'],
  ["src/features/analytics/AnalyticsView.tsx", './analytics.css']
];
for (const [file, specifier] of requiredOwners) if (!read(file).includes('import "' + specifier + '";')) fail(file + ": missing co-located CSS owner " + specifier);

const library = read("src/features/library/LibraryView.tsx");
if (!library.includes('data-page-section="library"')) fail("LibraryView lost its page owner marker");
if (library.includes('data-page-state="reset"')) fail("LibraryView returned to temporary reset mode after redesign started");

const shell = read("src/features/shell/AppShell.tsx");
for (const specifier of ["./app-core.css", "./motion.css", "./effects.css", "../../styles/view-shell.css"]) if (!shell.includes('import "' + specifier + '";')) fail("AppShell missing shell CSS owner " + specifier);
for (const modulePath of ["library/LibraryView", "artists/ArtistsView", "genres/GenresView", "albums/AlbumsView", "playlists/PlaylistsView", "covers/CoversView", "analytics/AnalyticsView", "settings/SettingsView", "downloads/DownloadsView"]) {
  if (!shell.includes('lazy(() => import("../' + modulePath + '"))')) fail("AppShell must lazy-load " + modulePath);
}

const main = read("src/main.tsx");
for (const specifier of ["@fontsource/space-grotesk/500.css", "@fontsource/space-grotesk/600.css", "@fontsource/space-grotesk/700.css", "./styles/tokens.css", "./styles/themes.css", "./shared/ui/view-ui.css", "./features/shell/performance.css"]) {
  if (!main.includes('import "' + specifier + '";')) fail("main.tsx missing global stylesheet " + specifier);
}
const mainCssImports = [...main.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
if (mainCssImports.at(-1) !== "./features/shell/performance.css") fail("performance.css must remain the final renderer CSS import");

for (const [file, section] of resetSources) {
  const source = read(file);
  if (!source.includes('data-page-section="' + section + '"')) fail(file + ": missing page owner marker");
  if (source.includes('data-page-state="reset"')) fail(file + ": rebuilt page must not use reset mode");
}
if (exists("src/styles/page-foundation.css")) fail("retired reset stylesheet must remain deleted");
if (main.includes("page-foundation.css")) fail("renderer still imports retired reset stylesheet");

for (const file of ["src/App.css", "src/features/shell/app-core.css", "src/features/shell/effects.css", "src/styles/themes.css", "src/styles/view-shell.css"]) {
  const source = read(file).replace(/\/\*[\s\S]*?\*\//g, " ");
  for (const selector of featureRoots) if (source.includes(selector)) fail(file + ": rebuild page selector leaked into global owner: " + selector);
  if (file !== "src/styles/view-shell.css" && source.includes(".libraryPage")) fail(file + ": rebuilt Library root leaked into global owner");
}

const cssBudgets = [
  ["src/App.css", 238 * 1024, 2209], ["src/features/shell/app-core.css", 80 * 1024, 664],
  ["src/features/player/player.css", 75 * 1024, 819], ["src/features/shell/effects.css", 65 * 1024, 662],
  ["src/styles/themes.css", 83 * 1024, 2], ["src/styles/view-shell.css", 20 * 1024, 198],
  ["src/features/home/home.css", 20 * 1024, 11],
  ["src/features/library/library.css", 24 * 1024, 95], ["src/features/artists/artists.css", 12 * 1024, 0], ["src/features/genres/genres.css", 4 * 1024, 0]
];
for (const [file, maxBytes, maxImportant] of cssBudgets) {
  if (!exists(file)) { fail(file + ": required CSS owner missing"); continue; }
  const source = read(file);
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const bytes = Buffer.byteLength(normalizedSource);
  const important = count(source, "!important");
  if (bytes > maxBytes) fail(file + ": CSS size grew past ratchet (" + bytes + " > " + maxBytes + ")");
  if (important > maxImportant) fail(file + ": !important debt grew past ratchet (" + important + " > " + maxImportant + ")");
}

const anyBudgets = [
  ["src/App.tsx", 38], ["src/features/albums/AlbumsView.tsx", 69], ["src/features/downloads/DownloadsView.tsx", 54],
  ["src/features/playlists/PlaylistsView.tsx", 37], ["src/features/player/components/PlayerBar.tsx", 0],
  ["src/features/library/LibraryView.tsx", 0], ["src/features/artists/ArtistsView.tsx", 0], ["src/features/genres/GenresView.tsx", 0], ["src/features/covers/CoversView.tsx", 0],
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
console.log("[release-ui-ownership] OK; feature CSS, page ownership, CI, lazy boundaries, and debt ratchets are enforced.");
