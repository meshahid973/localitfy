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
const occurrences = new Map();
const emptyRules = [];


function scanEmptyRules(source, file) {
  const stack = [];
  let statementStart = 0;
  let parens = 0;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (char === '"' || char === "'") {
      for (const quote = char; ++i < source.length;) {
        if (source[i] === "\\") { i += 1; continue; }
        if (source[i] === quote) break;
      }
      continue;
    }
    if (char === "(") { parens += 1; continue; }
    if (char === ")") { parens = Math.max(0, parens - 1); continue; }
    if (parens) continue;
    if (char === "{") {
      stack.push({ open: i, prelude: source.slice(statementStart, i).replace(/\/\*[\s\S]*?\*\//g, "").trim() });
      statementStart = i + 1;
    } else if (char === ";") {
      statementStart = i + 1;
    } else if (char === "}") {
      const block = stack.pop();
      if (block && !source.slice(block.open + 1, i).replace(/\/\*[\s\S]*?\*\//g, "").trim()) {
        const line = source.slice(0, block.open).split("\n").length;
        emptyRules.push(file + ":" + line + " " + block.prelude.replace(/\s+/g, " "));
      }
      statementStart = i + 1;
    }
  }
}

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  scanEmptyRules(source, relative);

  for (const match of source.matchAll(/@(?:-webkit-)?keyframes\s+([A-Za-z_][\w-]*)/g)) {
    const name = match[1];
    if (!definitions.has(name)) definitions.set(name, new Set());
    definitions.get(name).add(relative);
    if (!occurrences.has(name)) occurrences.set(name, []);
    occurrences.get(name).push(relative + ":" + source.slice(0, match.index).split("\n").length);
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

const duplicateKeyframes = [...occurrences.entries()]
  .filter(([, locations]) => locations.length > 1)
  .map(([name, locations]) => name + " (" + locations.join(", ") + ")")
  .sort();

if (missing.length || duplicateKeyframes.length || emptyRules.length) {
  if (missing.length) console.error("[css-animation-ownership] missing keyframes:\n- " + missing.join("\n- "));
  if (duplicateKeyframes.length) console.error("[css-animation-ownership] duplicate keyframes:\n- " + duplicateKeyframes.join("\n- "));
  if (emptyRules.length) console.error("[css-animation-ownership] empty CSS blocks:\n- " + emptyRules.join("\n- "));
  process.exit(1);
}

console.log("[css-animation-ownership] OK: " + references.size + " animation references resolve, all keyframes are unique, no empty blocks.");
