import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcRoot = path.join(root, "src");
const write = process.argv.includes("--write");
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html"]);
const ignoredDirs = new Set(["node_modules", ".git", "dist", "release"]);
const knownDynamicClasses = new Set(["is-on", "nav-home", "navIcon-home", "cover1", "cover2", "cover3", "cover4"]);

function walk(directory, predicate) {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(absolute, predicate));
    else if (entry.isFile() && predicate(absolute)) out.push(absolute);
  }
  return out;
}
function repoPath(file) { return path.relative(root, file).split(path.sep).join("/"); }
function skipComment(text, index, end) { const close = text.indexOf("*/", index + 2); return close === -1 || close >= end ? end : close + 2; }
function skipString(text, index, end) { const quote = text[index]; let cursor = index + 1; while (cursor < end) { if (text[cursor] === "\\") { cursor += 2; continue; } if (text[cursor] === quote) return cursor + 1; cursor += 1; } return end; }
function findMatchingBrace(text, open, end) { let depth = 1; for (let cursor = open + 1; cursor < end; cursor += 1) { const char = text[cursor]; if (char === "/" && text[cursor + 1] === "*") { cursor = skipComment(text, cursor, end) - 1; continue; } if (char === '"' || char === "'") { cursor = skipString(text, cursor, end) - 1; continue; } if (char === "{") depth += 1; else if (char === "}") { depth -= 1; if (depth === 0) return cursor; } } throw new Error(`Unbalanced CSS brace at offset ${open}`); }
function findStatementBoundary(text, start, end) { let paren = 0, bracket = 0; for (let cursor = start; cursor < end; cursor += 1) { const char = text[cursor]; if (char === "/" && text[cursor + 1] === "*") { cursor = skipComment(text, cursor, end) - 1; continue; } if (char === '"' || char === "'") { cursor = skipString(text, cursor, end) - 1; continue; } if (char === "(") paren += 1; else if (char === ")") paren = Math.max(0, paren - 1); else if (char === "[") bracket += 1; else if (char === "]") bracket = Math.max(0, bracket - 1); else if (paren === 0 && bracket === 0 && (char === "{" || char === ";")) return { index: cursor, char }; } return null; }
function isContainerAtRule(prelude) { return /^@(media|supports|container|layer|scope|document)\b/i.test(prelude); }
function isKeyframes(prelude) { return /^@(?:-webkit-)?keyframes\b/i.test(prelude); }
function splitSelectors(prelude) { const out = []; let start = 0, paren = 0, bracket = 0; for (let cursor = 0; cursor <= prelude.length; cursor += 1) { const char = prelude[cursor]; if (char === '"' || char === "'") { cursor = skipString(prelude, cursor, prelude.length) - 1; continue; } if (char === "(") paren += 1; else if (char === ")") paren = Math.max(0, paren - 1); else if (char === "[") bracket += 1; else if (char === "]") bracket = Math.max(0, bracket - 1); if ((cursor === prelude.length || char === ",") && paren === 0 && bracket === 0) { const part = prelude.slice(start, cursor).trim(); if (part) out.push(part); start = cursor + 1; } } return out; }

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

function classIsLive(name) {
  if (knownDynamicClasses.has(name) || referenceText.includes(name)) return true;
  for (const prefix of dynamicPrefixes) if (prefix.length >= 3 && name.startsWith(prefix)) return true;
  for (const suffix of dynamicSuffixes) if (suffix.length >= 3 && name.endsWith(suffix)) return true;
  return false;
}
function selectorCanBePruned(selector) {
  if (/["']/.test(selector) || /:(?:is|where|not|has)\s*\(/i.test(selector)) return false;
  const classes = [...selector.matchAll(/\.([_a-zA-Z][-_a-zA-Z0-9]*)/g)].map((match) => match[1]);
  return classes.length > 0 && classes.some((name) => !classIsLive(name));
}

function rewriteRuleList(text, start, end, stats) {
  let cursor = start;
  let output = "";
  while (cursor < end) {
    let statementStart = cursor;
    while (statementStart < end) {
      if (/\s/.test(text[statementStart])) { statementStart += 1; continue; }
      if (text[statementStart] === "/" && text[statementStart + 1] === "*") { statementStart = skipComment(text, statementStart, end); continue; }
      break;
    }
    if (statementStart >= end) { output += text.slice(cursor, end); break; }
    output += text.slice(cursor, statementStart);
    const boundary = findStatementBoundary(text, statementStart, end);
    if (!boundary) { output += text.slice(statementStart, end); break; }
    const rawPrelude = text.slice(statementStart, boundary.index);
    const prelude = rawPrelude.trim();
    if (boundary.char === ";") { output += text.slice(statementStart, boundary.index + 1); cursor = boundary.index + 1; continue; }
    const close = findMatchingBrace(text, boundary.index, end);
    const bodyStart = boundary.index + 1;
    const bodyEnd = close;
    if (prelude.startsWith("@")) {
      if (isContainerAtRule(prelude) && !isKeyframes(prelude)) {
        const body = rewriteRuleList(text, bodyStart, bodyEnd, stats);
        output += `${rawPrelude}{${body}}`;
      } else {
        output += text.slice(statementStart, close + 1);
      }
      cursor = close + 1;
      continue;
    }
    const selectors = splitSelectors(prelude);
    const kept = selectors.filter((selector) => !selectorCanBePruned(selector));
    if (kept.length === selectors.length) {
      output += text.slice(statementStart, close + 1);
    } else if (kept.length === 0) {
      stats.blocks += 1;
      stats.selectors += selectors.length;
      stats.bytes += Buffer.byteLength(text.slice(statementStart, close + 1), "utf8");
    } else {
      stats.selectors += selectors.length - kept.length;
      output += `${kept.join(",\n")}{${text.slice(bodyStart, bodyEnd)}}`;
    }
    cursor = close + 1;
  }
  return output;
}

const dirty = [];
const total = { blocks: 0, selectors: 0, bytes: 0 };
for (const file of walk(srcRoot, (absolute) => absolute.endsWith(".css"))) {
  const source = fs.readFileSync(file, "utf8");
  const stats = { blocks: 0, selectors: 0, bytes: 0 };
  const next = rewriteRuleList(source, 0, source.length, stats);
  if (next === source) continue;
  dirty.push(repoPath(file));
  total.blocks += stats.blocks;
  total.selectors += stats.selectors;
  total.bytes += Math.max(0, Buffer.byteLength(source, "utf8") - Buffer.byteLength(next, "utf8"));
  if (write) {
    fs.writeFileSync(file, next, "utf8");
    console.log(`[css-unused] pruned ${stats.selectors} unreachable selector(s) from ${repoPath(file)}`);
  }
}
if (!dirty.length) { console.log("[css-unused] clean"); process.exit(0); }
if (write) { console.log(`[css-unused] pruned ${total.selectors} unreachable selector(s), removed ${total.blocks} full rule block(s), saved ${total.bytes} bytes across ${dirty.length} file(s)`); process.exit(0); }
console.error(`[css-unused] ${dirty.length} CSS file(s) contain provably unreachable simple class selectors: ${dirty.join(", ")}`);
console.error("[css-unused] run npm run css:dedup:fix to prune them");
process.exit(1);
