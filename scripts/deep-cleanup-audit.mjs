import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignored = new Set([".git", "node_modules", "dist", "release", "dist-ssr", ".vite"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".html", ".json", ".md"]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(absolute));
    else if (entry.isFile()) out.push(absolute);
  }
  return out;
}
function rel(file) { return path.relative(root, file).split(path.sep).join("/"); }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

const files = walk(root);
const trackedLike = files.filter((file) => !rel(file).startsWith(".github/workflows/deep-cleanup-audit"));
const duplicates = new Map();
for (const file of trackedLike) {
  const stat = fs.statSync(file);
  if (stat.size === 0) continue;
  const key = `${stat.size}:${sha(file)}`;
  const group = duplicates.get(key) || [];
  group.push(rel(file));
  duplicates.set(key, group);
}
const duplicateGroups = [...duplicates.values()].filter((group) => group.length > 1).sort((a,b)=>b.length-a.length || a[0].localeCompare(b[0]));
console.log(`\n[deep-audit] exact duplicate groups: ${duplicateGroups.length}`);
for (const group of duplicateGroups) console.log(`  ${group.join(" | ")}`);

const legacyPaths = [
  "src/localtifyConstants.ts", "src/localtifyUtils.ts", "src/localtifyTypes.ts",
  "src/SettingsCategoryContent.tsx", "src/cover.tsx", "src/ui/Surface.tsx", "src/motion/physicalDrag.ts",
  "src/player/PlayerEngine.ts", "src/player/htmlAudioEngine.ts", "src/player/playerController.ts",
  "src/types/downloads.ts", "src/types/playlists.ts", "src/types/settings.ts", "src/types/song.ts", "src/types/theme.ts"
];
console.log(`\n[deep-audit] legacy compatibility files present: ${legacyPaths.filter((p)=>fs.existsSync(path.join(root,p))).length}`);
for (const p of legacyPaths) if (fs.existsSync(path.join(root,p))) console.log(`  ${p}`);

const sourceFiles = files.filter((file) => [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(path.extname(file)) && rel(file).startsWith("src/"));
const compatibilityNeedles = ["localtifyConstants", "localtifyUtils", "localtifyTypes", "/player/", "./player/", "/types/", "./types/", "/ui/Surface", "./ui/Surface", "/motion/physicalDrag", "./motion/physicalDrag", "./SettingsCategoryContent", "./cover"];
console.log("\n[deep-audit] source compatibility references:");
let compatibilityRefs = 0;
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  const hits = compatibilityNeedles.filter((needle)=>source.includes(needle));
  if (hits.length) { compatibilityRefs += 1; console.log(`  ${rel(file)} :: ${hits.join(", ")}`); }
}
console.log(`[deep-audit] files with compatibility references: ${compatibilityRefs}`);

const exportOwners = new Map();
for (const file of sourceFiles.filter((f)=>[".tsx", ".jsx"].includes(path.extname(f)))) {
  const source = fs.readFileSync(file, "utf8");
  const names = new Set();
  for (const match of source.matchAll(/(?:export\s+)?(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g)) names.add(match[1]);
  for (const match of source.matchAll(/(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/g)) names.add(match[1]);
  for (const name of names) {
    const list = exportOwners.get(name) || [];
    list.push(rel(file));
    exportOwners.set(name, list);
  }
}
const duplicateExports = [...exportOwners.entries()].filter(([, owners])=>owners.length > 1).sort((a,b)=>a[0].localeCompare(b[0]));
console.log(`\n[deep-audit] duplicate React-ish exported/component names: ${duplicateExports.length}`);
for (const [name, owners] of duplicateExports) console.log(`  ${name} :: ${owners.join(" | ")}`);

const cssFiles = files.filter((file)=>path.extname(file)===".css" && rel(file).startsWith("src/"));
const sourceReferenceText = files
  .filter((file)=>!rel(file).startsWith("scripts/") && path.extname(file)!==".css" && textExtensions.has(path.extname(file)) && (rel(file).startsWith("src/") || rel(file).startsWith("public/") || rel(file)==="index.html"))
  .map((file)=>fs.readFileSync(file,"utf8"))
  .join("\n");
const cssClasses = new Map();
for (const file of cssFiles) {
  const source = fs.readFileSync(file,"utf8");
  for (const match of source.matchAll(/\.([_a-zA-Z][-_a-zA-Z0-9]*)/g)) {
    const name = match[1];
    const owners = cssClasses.get(name) || new Set();
    owners.add(rel(file));
    cssClasses.set(name, owners);
  }
}
function dynamicallyPossible(name) {
  const fragments = name.split(/(?=[A-Z])|[-_]/).filter((part)=>part.length >= 5);
  return fragments.some((part)=>sourceReferenceText.includes(part));
}
const deadClasses = [...cssClasses.entries()].filter(([name])=>!sourceReferenceText.includes(name) && !dynamicallyPossible(name));
console.log(`\n[deep-audit] CSS class names total: ${cssClasses.size}; no-source-reference candidates: ${deadClasses.length}`);
for (const [name, owners] of deadClasses.slice(0, 250)) console.log(`  .${name} :: ${[...owners].join(" | ")}`);
if (deadClasses.length > 250) console.log(`  ... ${deadClasses.length - 250} more`);

const multiOwnerClasses = [...cssClasses.entries()].filter(([,owners])=>owners.size > 1).sort((a,b)=>b[1].size-a[1].size || a[0].localeCompare(b[0]));
console.log(`\n[deep-audit] CSS class names declared in multiple files: ${multiOwnerClasses.length}`);
for (const [name, owners] of multiOwnerClasses.slice(0,200)) console.log(`  .${name} :: ${[...owners].join(" | ")}`);
if (multiOwnerClasses.length > 200) console.log(`  ... ${multiOwnerClasses.length - 200} more`);
