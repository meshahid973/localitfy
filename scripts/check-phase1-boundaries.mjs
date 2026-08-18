import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcRoot = path.join(root, "src");
const knownTsNoCheck = new Set(["src/App.tsx", "src/LocaltifyAppView.tsx", "src/CatBuddy.tsx", "src/app/UpdateIsland.tsx"]);
const protectedPrefixes = ["src/features/", "src/types/", "src/shared/", "src/platform/", "src/core/"];
const codeExtensions = new Set([".ts", ".tsx"]);
function toRepoPath(filePath) { return path.relative(root, filePath).split(path.sep).join("/"); }
function walk(directory) { const files = []; for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const absolute = path.join(directory, entry.name); if (entry.isDirectory()) files.push(...walk(absolute)); else if (codeExtensions.has(path.extname(entry.name))) files.push(absolute); } return files; }
const files = walk(srcRoot); const violations = [];
for (const absolute of files) {
  const repoPath = toRepoPath(absolute), source = fs.readFileSync(absolute, "utf8");
  if (source.includes("@ts-nocheck") && !knownTsNoCheck.has(repoPath)) violations.push(`${repoPath}: new @ts-nocheck is not allowed`);
  const view = /(?:from\s+["'][^"']*LocaltifyAppView["']|export\s+.*from\s+["'][^"']*LocaltifyAppView["'])/.test(source);
  const app = /(?:from\s+["'][^"']*(?:\/|^)App["']|export\s+.*from\s+["'][^"']*(?:\/|^)App["'])/.test(source);
  if (view && repoPath !== "src/App.tsx") violations.push(`${repoPath}: dependency on LocaltifyAppView violates feature ownership`);
  if (protectedPrefixes.some((prefix) => repoPath.startsWith(prefix)) && (view || app)) violations.push(`${repoPath}: protected feature/type/shared/platform/core code may not depend on renderer monoliths`);
}
if (violations.length) { console.error("[phase-boundaries] Architecture boundary violation(s):"); for (const violation of violations) console.error(`  - ${violation}`); process.exit(1); }
console.log(`[phase-boundaries] OK: checked ${files.length} TypeScript source files; no domain/shared code depends on renderer monoliths.`);
