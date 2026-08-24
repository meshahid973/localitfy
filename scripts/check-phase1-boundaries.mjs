import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcRoot = path.join(root, "src");
const knownTsNoCheck = new Set(["src/CatBuddy.tsx"]);
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
  if (repoPath === "src/App.tsx") {
    if (/from\s+["']\.\/localtifyConstants["']/.test(source)) violations.push("src/App.tsx: import feature constants from their canonical owners, not localtifyConstants.ts");
    if (/from\s+["']\.\/localtifyUtils["']/.test(source)) violations.push("src/App.tsx: import helpers from their canonical owners, not localtifyUtils.ts");
    if (/from\s+["']\.\/localtifyTypes["']/.test(source)) violations.push("src/App.tsx: import types from their canonical owners, not localtifyTypes.ts");
  }
}
if (violations.length) { console.error("[phase-boundaries] Architecture boundary violation(s):"); for (const violation of violations) console.error(`  - ${violation}`); process.exit(1); }
console.log(`[phase-boundaries] OK: checked ${files.length} TypeScript source files; no domain/shared code depends on renderer monoliths or App compatibility barrels.`);


if (fs.existsSync(path.join(root, "src", "LocaltifyAppView.tsx"))) {
  console.error("[phase-boundaries] LocaltifyAppView.tsx must stay deleted after Phase 2 shell migration.");
  process.exit(1);
}
