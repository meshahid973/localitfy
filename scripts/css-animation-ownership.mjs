import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

function collectCssFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectCssFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(absolute);
  }
  return files.sort();
}

const files = collectCssFiles(srcRoot);
const definitions = new Map();
const references = new Map();

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file).replaceAll(path.sep, "/");

  for (const match of source.matchAll(/@(?:-webkit-)?keyframes\s+([A-Za-z_][\w-]*)/g)) {
    const name = match[1];
    if (!definitions.has(name)) definitions.set(name, []);
    definitions.get(name).push(relative);
  }

  for (const declaration of source.matchAll(/\banimation(?:-name)?\s*:\s*([^;}]+)/g)) {
    for (const nameMatch of declaration[1].matchAll(/\blocaltify[A-Za-z0-9_-]+\b/g)) {
      const name = nameMatch[0];
      if (!references.has(name)) references.set(name, new Set());
      references.get(name).add(relative);
    }
  }
}

const missing = [...references.entries()]
  .filter(([name]) => !definitions.has(name))
  .map(([name, owners]) => `${name} <- ${[...owners].join(", ")}`)
  .sort();

const duplicateDefinitions = [...definitions.entries()]
  .filter(([, owners]) => owners.length > 1)
  .map(([name, owners]) => `${name} -> ${owners.join(", ")}`)
  .sort();

if (missing.length || duplicateDefinitions.length) {
  if (missing.length) {
    console.error("[css-animation-ownership] missing keyframe definition(s):\n- " + missing.join("\n- "));
  }
  if (duplicateDefinitions.length) {
    console.error("[css-animation-ownership] duplicate keyframe owner(s):\n- " + duplicateDefinitions.join("\n- "));
  }
  process.exit(1);
}

console.log(`[css-animation-ownership] OK: ${references.size} Localtify animation name(s) have one keyframe owner.`);
