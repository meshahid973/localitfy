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

const proximityShim = read("src/useProximityMotion.ts").trim();
if (proximityShim !== 'export { useProximityMotion } from "./features/shell/useProximityMotion";') {
  failures.push("src/useProximityMotion.ts: root module must stay a compatibility re-export; no second motion owner");
}

const motionPath = path.join(root, "src/features/shell/motion.css");
const motionBytes = fs.statSync(motionPath).size;
if (motionBytes > 20 * 1024) failures.push(`src/features/shell/motion.css: ${motionBytes} bytes exceeds 20 KiB ownership budget`);
reject("src/features/shell/motion.css", ["localtifyProximity", "VelocityMotionV320", "VelocityMotionV430"]);

const homeViewSource = read("src/features/home/HomeView.tsx");
if (homeViewSource.includes("[key: string]: any")) failures.push("src/features/home/HomeView.tsx: loose index signature returned");

const homePath = path.join(root, "src/features/home/home.css");
const homeBytes = fs.statSync(homePath).size;
if (homeBytes > 24 * 1024) failures.push(`src/features/home/home.css: ${homeBytes} bytes exceeds 24 KiB Home ownership budget`);
const homeCss = read("src/features/home/home.css");
if (!homeCss.includes("data-view=\"home\"")) failures.push("src/features/home/home.css: Home header rules must be scoped to data-view=home");

const app = read("src/App.tsx");
if (!app.includes('import "./features/home/home.css";')) failures.push("src/App.tsx: canonical Home stylesheet import is missing");

const shell = read("src/features/shell/AppShell.tsx");
if (shell.includes("moreQuickLibraryBlur") || shell.includes("lessQuickLibraryBlur") || shell.includes("data-home-expanded")) {
  failures.push("src/features/shell/AppShell.tsx: retired Quick Library runtime ownership remains");
}
if (!shell.includes("data-view={view}")) failures.push("src/features/shell/AppShell.tsx: data-view ownership marker is missing");

const main = read("src/main.tsx");
if (main.includes("release.css")) failures.push("src/main.tsx: obsolete release.css override layer returned");
const appImport = main.indexOf('import App from "./App";');
const perfImport = main.indexOf('import "./features/shell/performance.css";');
if (appImport < 0 || perfImport < appImport) failures.push("src/main.tsx: performance.css must remain the final renderer policy after App CSS");

if (fs.existsSync(path.join(root, "src/features/shell/release.css"))) failures.push("src/features/shell/release.css: obsolete override file must stay deleted");

if (failures.length) {
  console.error("[release-ui-ownership] failures:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`[release-ui-ownership] OK; Home is ${(homeBytes / 1024).toFixed(1)} KiB, canonical motion is ${(motionBytes / 1024).toFixed(1)} KiB, and retired Home UI cannot reappear.`);
