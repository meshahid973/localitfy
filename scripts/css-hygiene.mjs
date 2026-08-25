import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcRoot = path.join(root, "src");
const write = process.argv.includes("--write");

function collectCssFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectCssFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(absolute);
  }
  return files.sort();
}

function normalizeCss(source) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let blankRun = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/[\t ]+$/g, "");
    if (line.trim() === "") {
      blankRun += 1;
      // Two blank lines are enough to separate historical sections without
      // leaving the large holes produced by declaration/block cleanup.
      if (blankRun <= 2) output.push("");
      continue;
    }

    blankRun = 0;
    output.push(line);
  }

  while (output.length && output[output.length - 1] === "") output.pop();
  const normalizedBody = output.join("\n").replace(/\n{4,}/g, "\n\n\n");
  return `${normalizedBody.replace(/\n/g, newline)}${newline}`;
}

const dirty = [];
let bytesSaved = 0;

for (const absolute of collectCssFiles(srcRoot)) {
  const source = fs.readFileSync(absolute, "utf8");
  const next = normalizeCss(source);
  if (next === source) continue;

  const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
  const saved = Buffer.byteLength(source, "utf8") - Buffer.byteLength(next, "utf8");
  dirty.push(relative);
  bytesSaved += Math.max(0, saved);

  if (write) {
    fs.writeFileSync(absolute, next, "utf8");
    console.log(`[css-hygiene] cleaned ${relative}${saved > 0 ? `; saved ${saved} bytes` : ""}`);
  }
}

if (dirty.length === 0) {
  console.log("[css-hygiene] clean");
  process.exit(0);
}

if (write) {
  console.log(`[css-hygiene] cleaned ${dirty.length} file(s); saved ${bytesSaved} bytes`);
  process.exit(0);
}

console.error(`[css-hygiene] ${dirty.length} CSS file(s) need whitespace cleanup: ${dirty.join(", ")}`);
console.error("[css-hygiene] run npm run css:dedup:fix to normalize them");
process.exit(1);
