import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const failures = [];

function requirePath(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) failures.push(`missing ${relativePath}`);
}

function checkSyntax(relativePath) {
  const result = spawnSync(process.execPath, ["--check", relativePath], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) failures.push(`${relativePath}: ${result.stderr || result.stdout || "syntax check failed"}`);
}

if (pkg.version !== "0.4.2") failures.push(`package version is ${pkg.version}, expected 0.4.2`);

[
  "dist/index.html",
  "electron/main.cjs",
  "electron/preload.cjs",
  "electron/rpc.cjs",
  "src/App.tsx",
  "src/LocaltifyAppView.tsx",
  "src/home.css",
  "src/settings.css"
].forEach(requirePath);

["electron/main.cjs", "electron/preload.cjs", "electron/rpc.cjs"].forEach(checkSyntax);

const appSource = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const cssImports = [...appSource.matchAll(/import\s+["'](.+?\.css)["'];/g)].map((match) => match[1]);
const duplicateImports = cssImports.filter((item, index) => cssImports.indexOf(item) !== index);
if (duplicateImports.length) failures.push(`duplicate CSS imports: ${[...new Set(duplicateImports)].join(", ")}`);

for (const relativePath of ["src/App.tsx", "src/LocaltifyAppView.tsx", "src/home.css", "src/settings.css"]) {
  const text = fs.readFileSync(path.join(root, relativePath), "utf8");
  const lines = text.split(/\r?\n/);
  const badLine = lines.findIndex((line) => /[ \t]+$/.test(line));
  if (badLine >= 0) failures.push(`${relativePath}:${badLine + 1} has trailing whitespace`);
}

if (failures.length) {
  console.error("localtify 0.4.2 release check failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("localtify 0.4.2 release check passed");
