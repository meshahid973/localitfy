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

const allowedExactDuplicateGroups = [
  new Set(["build/icon.png", "src/assets/logo.png"])
];

const textExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".md", ".json", ".html"]);
const mojibakePatterns = [
  [0x00e2, 0x20ac, 0x00a2],
  [0x00e2, 0x20ac, 0x201d],
  [0x00e2, 0x20ac, 0x201c],
  [0x00e2, 0x20ac, 0x00a6],
  [0x00c2, 0x00b7],
  [0x00c2, 0x00b4],
  [0x00e2, 0x201d, 0x20ac]
].map((points) => String.fromCodePoint(...points));

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
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
function isAllowedDuplicateGroup(group) {
  const actual = new Set(group);
  return allowedExactDuplicateGroups.some((allowed) =>
    allowed.size === actual.size && [...allowed].every((item) => actual.has(item))
  );
}

const violations = [];
for (const relative of forbiddenFiles) {
  if (fs.existsSync(path.join(root, relative))) violations.push(`${relative}: legacy compatibility file must stay deleted`);
}

const qualityWorkflow = path.join(root, ".github", "workflows", "quality.yml");
if (!fs.existsSync(qualityWorkflow)) {
  violations.push(".github/workflows/quality.yml: permanent quality workflow must exist");
}
const workflowDirectory = path.join(root, ".github", "workflows");
if (fs.existsSync(workflowDirectory)) {
  const allowedWorkflows = new Set([".github/workflows/quality.yml"]);
  const workflowFiles = walk(workflowDirectory).filter((file) => fs.statSync(file).isFile());
  for (const file of workflowFiles) {
    const relative = repoPath(file);
    if (!allowedWorkflows.has(relative)) violations.push(`${relative}: temporary or unowned workflow must not remain in the repository`);
  }
}

const repairScripts = walk(path.join(root, "scripts")).filter((file) => /^apply-a\d|repair-a\d|fix-a\d/i.test(path.basename(file)));
for (const file of repairScripts) violations.push(`${repoPath(file)}: temporary repair script must not remain in the repository`);

const files = walk(root).filter((file) => {
  const relative = repoPath(file);
  return !relative.startsWith("localtify_asset_backups/") && !relative.startsWith("backups/");
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
  if (group.length > 1 && !isAllowedDuplicateGroup(group)) violations.push(`exact duplicate files: ${group.join(" | ")}`);
}

for (const file of files) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  const relative = repoPath(file);
  if (relative === "scripts/check-codebase-hygiene.mjs") continue;
  let source = "";
  try { source = fs.readFileSync(file, "utf8"); } catch { continue; }
  const found = mojibakePatterns.find((pattern) => source.includes(pattern));
  if (found) violations.push(`${relative}: contains likely UTF-8 mojibake`);
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
      const legacyRoots = [path.join(root, "src/player"), path.join(root, "src/types"), path.join(root, "src/ui"), path.join(root, "src/motion")];
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
console.log("[codebase-hygiene] OK: no accidental duplicates, legacy shims, temporary repair files/workflows, or mojibake; permanent CI is present.");
