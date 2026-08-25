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

reject("src/features/home/HomeView.tsx", [
  "quick library",
  "homeLibraryPanel",
  "homeLibraryActions",
  "renderHomeSongCards",
  "renderSongRows"
]);
reject("src/features/settings/categories/AdvancedSettings.tsx", ["Right side cards"]);
reject("src/app/runtime/useBodyRuntimeClasses.ts", ["localtifyWantMoreBlur", "localtifyNoMoreBlur"]);
reject("src/features/shell/performance.css", ["homeLibraryPanel", "localtifyNoMoreBlur", "localtifyWantMoreBlur"]);

const proximityShim = read("src/useProximityMotion.ts").trim();
if (proximityShim !== 'export { useProximityMotion } from "./features/shell/useProximityMotion";') {
  failures.push("src/useProximityMotion.ts: root module must stay a compatibility re-export; no second motion owner");
}

const motionPath = path.join(root, "src/features/shell/motion.css");
const motionBytes = fs.statSync(motionPath).size;
if (motionBytes > 20 * 1024) failures.push(`src/features/shell/motion.css: ${motionBytes} bytes exceeds 20 KiB ownership budget`);
reject("src/features/shell/motion.css", ["localtifyProximity", "VelocityMotionV320", "VelocityMotionV430"]);

const main = read("src/main.tsx");
const appImport = main.indexOf('import App from "./App";');
const releaseImport = main.indexOf('import "./features/shell/release.css";');
const perfImport = main.indexOf('import "./features/shell/performance.css";');
if (appImport < 0 || releaseImport < appImport || perfImport < releaseImport) {
  failures.push("src/main.tsx: App CSS must load before release.css, with performance.css last");
}

if (failures.length) {
  console.error("[release-ui-ownership] failures:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`[release-ui-ownership] OK; canonical motion is ${(motionBytes / 1024).toFixed(1)} KiB and retired Home UI cannot reappear.`);
