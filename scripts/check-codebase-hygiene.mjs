import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirs = new Set([".git", "node_modules", "dist", "release", ".vite"]);
const forbiddenFiles = [
  "src/localtifyConstants.ts",
  "src/localtifyUtils.ts",
  "src/localtifyTypes.ts",
  "src/localtifyAssets.ts",
  "src/SettingsCategoryContent.tsx",
  "src/cover.tsx",
  "src/ui/Surface.tsx",
  "src/motion/physicalDrag.ts",
  "src/player/PlayerEngine.ts",
  "src/player/htmlAudioEngine.ts",
  "src/player/playerController.ts",
  "src/types/downloads.ts",
  "src/types/playlists.ts",
  "src/types/settings.ts",
  "src/types/song.ts",
  "src/types/theme.ts"
];

function walk(directory) {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(absolute));
    else if (entry.isFile()) out.push(absolute);
  }
  return out;
}
function repoPath(file) { return path.relative(root, file).split(path.sep).join("/"); }
function hash(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

const violations = [];
for (const relative of forbiddenFiles) {
  if (fs.existsSync(path.join(root, relative))) violations.push(`${relative}: legacy compatibility file must stay deleted`);
}

const files = walk(root).filter((file) => {
  const relative = repoPath(file);
  return !relative.startsWith(".github/workflows/") && !relative.startsWith("localtify_asset_backups/") && !relative.startsWith("backups/");
});
const byHash = new Map();
for (const file of files) {
  const size = fs.statSync(file).size;
  if (!size) continue;
  const key = `${size}:${hash(file)}`;
  const group = byHash.get(key) || [];
  group.push(repoPath(file));
  byHash.set(key, group);
}
for (const group of byHash.values()) {
  if (group.length > 1) violations.push(`exact duplicate files: ${group.join(" | ")}`);
}

const sharedUi = path.join(root, "src/shared/ui/LocaltifyViewUi.tsx");
if (fs.existsSync(sharedUi) && /export\s+function\s+PlayerPlayPauseMorphIcon\b/.test(fs.readFileSync(sharedUi, "utf8"))) {
  violations.push("src/shared/ui/LocaltifyViewUi.tsx: player morph icon belongs only to features/player");
}

const srcFiles = walk(path.join(root, "src")).filter((file) => [".ts", ".tsx", ".js", ".jsx"].includes(path.extname(file)));
for (const file of srcFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relative = repoPath(file);
  for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (/localtify(?:Constants|Utils|Types|Assets)$/.test(specifier)) violations.push(`${relative}: imports removed compatibility barrel ${specifier}`);
    if (specifier.startsWith(".")) {
      const resolved = path.resolve(path.dirname(file), specifier);
      const legacyRoots = [path.join(root,"src/player"), path.join(root,"src/types"), path.join(root,"src/ui"), path.join(root,"src/motion")];
      if (legacyRoots.some((legacyRoot) => resolved === legacyRoot || resolved.startsWith(`${legacyRoot}${path.sep}`))) {
        violations.push(`${relative}: imports legacy compatibility path ${specifier}`);
      }
    }
  }
}

if (violations.length) {
  console.error("[codebase-hygiene] violation(s):");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}
console.log("[codebase-hygiene] OK: no exact duplicate tracked files, legacy compatibility shims, or duplicate player morph component.");
