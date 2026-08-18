import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcRoot = path.join(root, "src");

const knownTsNoCheck = new Set([
  "src/App.tsx",
  "src/LocaltifyAppView.tsx",
  "src/CatBuddy.tsx",
  "src/cover.tsx",
  "src/app/UpdateIsland.tsx",
  "src/localtifyConstants.ts",
  "src/localtifyUtils.ts"
]);

const knownViewDependencyDebt = new Set([
  "src/localtifyConstants.ts",
  "src/localtifyUtils.ts",
  "src/types/downloads.ts",
  "src/types/playlists.ts",
  "src/types/settings.ts",
  "src/types/song.ts",
  "src/types/theme.ts"
]);

const codeExtensions = new Set([".ts", ".tsx"]);

function toRepoPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute));
    } else if (codeExtensions.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }
  return files;
}

const files = walk(srcRoot);
const violations = [];

for (const absolute of files) {
  const repoPath = toRepoPath(absolute);
  const source = fs.readFileSync(absolute, "utf8");

  if (source.includes("@ts-nocheck") && !knownTsNoCheck.has(repoPath)) {
    violations.push(`${repoPath}: new @ts-nocheck is not allowed`);
  }

  const referencesViewMonolith =
    /(?:from\s+["'][^"']*LocaltifyAppView["']|export\s+.*from\s+["'][^"']*LocaltifyAppView["'])/.test(
      source
    );

  if (referencesViewMonolith && !knownViewDependencyDebt.has(repoPath) && repoPath !== "src/App.tsx") {
    violations.push(
      `${repoPath}: new dependency on LocaltifyAppView violates Phase 1 dependency direction`
    );
  }
}

if (violations.length) {
  console.error("[phase1-boundaries] Architecture boundary violation(s):");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log(
  `[phase1-boundaries] OK: checked ${files.length} TypeScript source files; known legacy debt remains allowlisted.`
);
