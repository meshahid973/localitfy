import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const full = process.argv.includes("--full");
const ignored = new Set([".git", "node_modules", "dist", "release", ".vite"]);
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"]);
const allFiles = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.isFile()) allFiles.push(path.relative(root, fullPath).replaceAll(path.sep, "/"));
  }
}
for (const folder of ["src", "electron", "public"]) walk(path.join(root, folder));
if (fs.existsSync(path.join(root, "index.html"))) allFiles.push("index.html");

const sources = new Map();
for (const file of allFiles) {
  if (codeExtensions.has(path.posix.extname(file)) || file.endsWith(".css") || file.endsWith(".html")) {
    sources.set(file, fs.readFileSync(path.join(root, file), "utf8"));
  }
}

const referenceText = [...sources].filter(([file]) => !file.endsWith(".css")).map(([, body]) => body).join("\n");
const dynamicPrefixes = new Set();
const dynamicSuffixes = new Set();
for (const match of referenceText.matchAll(/([_A-Za-z][-_A-Za-z0-9]{2,})\$\{/g)) dynamicPrefixes.add(match[1]);
for (const match of referenceText.matchAll(/["'\x60]([_A-Za-z][-_A-Za-z0-9]{2,})["'\x60]\s*\+/g)) dynamicPrefixes.add(match[1]);
for (const match of referenceText.matchAll(/\}\s*([_A-Za-z][-_A-Za-z0-9]{2,})/g)) dynamicSuffixes.add(match[1]);
for (const match of referenceText.matchAll(/\+\s*["'\x60]([_A-Za-z][-_A-Za-z0-9]{2,})["'\x60]/g)) dynamicSuffixes.add(match[1]);

const knownDynamic = new Set(["is-on", "nav-home", "navIcon-home", "cover1", "cover2", "cover3", "cover4"]);
const classReferenced = (name) =>
  knownDynamic.has(name) ||
  referenceText.includes(name) ||
  [...dynamicPrefixes].some((prefix) => prefix.length >= 3 && name.startsWith(prefix)) ||
  [...dynamicSuffixes].some((suffix) => suffix.length >= 3 && name.endsWith(suffix));

let cssCandidates = 0;
const cssReports = [];
for (const [file, body] of sources) {
  if (!file.endsWith(".css")) continue;
  const allNames = [...new Set([...body.matchAll(/\.([_a-zA-Z][-_a-zA-Z0-9]*)/g)].map((m) => m[1]))];
  const missing = allNames.filter((name) => !classReferenced(name));
  if (!missing.length) continue;
  cssCandidates += missing.length;
  cssReports.push({ file, missing });
}

const codeFiles = [...sources.keys()].filter((p) => codeExtensions.has(path.posix.extname(p)));
const codeSet = new Set(codeFiles);
const imports = new Map();
const inbound = new Map(codeFiles.map((file) => [file, []]));
const possible = (file, specifier) => {
  if (!specifier.startsWith(".")) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  const candidates = [base, ...[...codeExtensions].map((ext) => base + ext), ...[...codeExtensions].map((ext) => base + "/index" + ext)];
  return candidates.find((candidate) => codeSet.has(candidate)) || null;
};
for (const file of codeFiles) {
  const body = sources.get(file);
  const specifiers = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^;"']{0,450}?\s+from\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']/g
  ];
  for (const pattern of patterns) for (const match of body.matchAll(pattern)) specifiers.add(match[1]);
  const deps = [...specifiers].map((specifier) => possible(file, specifier)).filter(Boolean);
  imports.set(file, deps);
  for (const dep of deps) inbound.get(dep).push(file);
}

const entrypoints = ["src/main.tsx", "electron/main.cjs", "electron/preload.cjs", "electron/worker.cjs"]
  .filter((file) => codeSet.has(file));
const seen = new Set(entrypoints);
const queue = [...entrypoints];
while (queue.length) {
  for (const dep of imports.get(queue.shift()) || []) {
    if (seen.has(dep)) continue;
    seen.add(dep);
    queue.push(dep);
  }
}
const suspects = codeFiles.filter((file) =>
  file.startsWith("src/") &&
  !file.endsWith(".d.ts") &&
  !seen.has(file)
);

console.log("[audit-unused] Advisory audit; dynamic classes, runtime entrypoints and external references need human verification.");
console.log("[audit-unused] Source files: " + codeFiles.length + "; CSS files: " + [...sources.keys()].filter((p) => p.endsWith(".css")).length);
console.log("[audit-unused] CSS class candidates: " + cssCandidates + "; possible unreachable source files: " + suspects.length);
for (const { file, missing } of cssReports.sort((a, b) => b.missing.length - a.missing.length)) {
  console.log("[audit-unused] CSS " + file + ": " + missing.length + " names");
  if (full) console.log("    " + missing.join(", "));
}
for (const file of suspects) {
  console.log("[audit-unused] SOURCE " + file + " (direct imports: " + (inbound.get(file)?.length || 0) + ")");
}
console.log("[audit-unused] No files changed.");
