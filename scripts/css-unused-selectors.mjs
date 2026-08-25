import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html"]);
const ignoredDirs = new Set(["node_modules", ".git", "dist", "release", ".vite"]);
const knownDynamicClasses = new Set(["is-on", "nav-home", "navIcon-home", "cover1", "cover2", "cover3", "cover4"]);

function walk(directory, predicate) {
  const out = [];
  if (!fs.existsSync(directory)) return out;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(absolute, predicate));
    else if (entry.isFile() && predicate(absolute)) out.push(absolute);
  }
  return out;
}

const referenceFiles = [
  ...walk(srcRoot, (file) => codeExtensions.has(path.extname(file))),
  ...walk(path.join(root, "public"), (file) => codeExtensions.has(path.extname(file))),
  path.join(root, "index.html")
].filter((file, index, all) => fs.existsSync(file) && all.indexOf(file) === index);

const referenceText = referenceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const dynamicPrefixes = new Set();
const dynamicSuffixes = new Set();
for (const match of referenceText.matchAll(/([_A-Za-z][-_A-Za-z0-9]{2,})\$\{/g)) dynamicPrefixes.add(match[1]);
for (const match of referenceText.matchAll(/["'`]([_A-Za-z][-_A-Za-z0-9]{2,})["'`]\s*\+/g)) dynamicPrefixes.add(match[1]);
for (const match of referenceText.matchAll(/\}\s*([_A-Za-z][-_A-Za-z0-9]{2,})/g)) dynamicSuffixes.add(match[1]);
for (const match of referenceText.matchAll(/\+\s*["'`]([_A-Za-z][-_A-Za-z0-9]{2,})["'`]/g)) dynamicSuffixes.add(match[1]);

function classLooksLive(name) {
  if (knownDynamicClasses.has(name) || referenceText.includes(name)) return true;
  for (const prefix of dynamicPrefixes) if (prefix.length >= 3 && name.startsWith(prefix)) return true;
  for (const suffix of dynamicSuffixes) if (suffix.length >= 3 && name.endsWith(suffix)) return true;
  return false;
}

const candidates = [];
for (const file of walk(srcRoot, (absolute) => absolute.endsWith(".css"))) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const source = fs.readFileSync(file, "utf8");
  const names = new Set([...source.matchAll(/\.([_a-zA-Z][-_a-zA-Z0-9]*)/g)].map((match) => match[1]));
  for (const name of names) {
    if (!classLooksLive(name)) candidates.push(`${relative}:.${name}`);
  }
}

if (!candidates.length) {
  console.log("[css-unused-audit] no suspicious selectors found");
  process.exit(0);
}

console.log(`[css-unused-audit] ${candidates.length} selector candidate(s) need human review; no files were changed.`);
for (const candidate of candidates.slice(0, 40)) console.log(`  - ${candidate}`);
if (candidates.length > 40) console.log(`  ... and ${candidates.length - 40} more`);
console.log("[css-unused-audit] advisory only: dynamic runtime classes make automatic deletion unsafe.");
