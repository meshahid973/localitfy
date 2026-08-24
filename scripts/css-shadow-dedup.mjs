import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcRoot = path.join(root, "src");
const write = process.argv.includes("--write");

function walkCss(directory) {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walkCss(absolute));
    else if (entry.isFile() && entry.name.endsWith(".css")) out.push(absolute);
  }
  return out.sort();
}

function skipComment(text, index, end) {
  const close = text.indexOf("*/", index + 2);
  return close === -1 || close >= end ? end : close + 2;
}

function skipString(text, index, end) {
  const quote = text[index];
  let cursor = index + 1;
  while (cursor < end) {
    if (text[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (text[cursor] === quote) return cursor + 1;
    cursor += 1;
  }
  return end;
}

function findMatchingBrace(text, open, end) {
  let depth = 1;
  for (let cursor = open + 1; cursor < end; cursor += 1) {
    const char = text[cursor];
    if (char === "/" && text[cursor + 1] === "*") {
      cursor = skipComment(text, cursor, end) - 1;
      continue;
    }
    if (char === '"' || char === "'") {
      cursor = skipString(text, cursor, end) - 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return cursor;
    }
  }
  throw new Error(`Unbalanced CSS brace at offset ${open}`);
}

function findStatementBoundary(text, start, end) {
  let paren = 0;
  let bracket = 0;
  for (let cursor = start; cursor < end; cursor += 1) {
    const char = text[cursor];
    if (char === "/" && text[cursor + 1] === "*") {
      cursor = skipComment(text, cursor, end) - 1;
      continue;
    }
    if (char === '"' || char === "'") {
      cursor = skipString(text, cursor, end) - 1;
      continue;
    }
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (paren === 0 && bracket === 0 && (char === "{" || char === ";")) {
      return { index: cursor, char };
    }
  }
  return null;
}

function normalizePrelude(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*([>,+~])\s*/g, "$1")
    .trim();
}

function splitDeclarations(body) {
  const chunks = [];
  let start = 0;
  let paren = 0;
  let bracket = 0;
  for (let cursor = 0; cursor <= body.length; cursor += 1) {
    const char = body[cursor];
    if (char === "/" && body[cursor + 1] === "*") {
      cursor = skipComment(body, cursor, body.length) - 1;
      continue;
    }
    if (char === '"' || char === "'") {
      cursor = skipString(body, cursor, body.length) - 1;
      continue;
    }
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    if ((cursor === body.length || char === ";") && paren === 0 && bracket === 0) {
      const chunk = body.slice(start, cursor).trim();
      if (chunk) chunks.push(chunk);
      start = cursor + 1;
    }
  }
  return chunks;
}

function parseDeclaration(chunk) {
  let paren = 0;
  let bracket = 0;
  for (let cursor = 0; cursor < chunk.length; cursor += 1) {
    const char = chunk[cursor];
    if (char === "/" && chunk[cursor + 1] === "*") {
      cursor = skipComment(chunk, cursor, chunk.length) - 1;
      continue;
    }
    if (char === '"' || char === "'") {
      cursor = skipString(chunk, cursor, chunk.length) - 1;
      continue;
    }
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === ":" && paren === 0 && bracket === 0) {
      const property = chunk.slice(0, cursor).replace(/\/\*[\s\S]*?\*\//g, "").trim().toLowerCase();
      if (!/^--[\w-]+$/.test(property) && !/^-?[a-z][a-z0-9-]*$/.test(property)) return null;
      const rawValue = chunk.slice(cursor + 1).trim();
      const important = /!important\s*$/i.test(rawValue);
      return { property, important };
    }
  }
  return null;
}

function parseDeclarations(body) {
  if (body.includes("{")) return null;
  const declarations = new Map();
  for (const chunk of splitDeclarations(body)) {
    const declaration = parseDeclaration(chunk);
    if (!declaration) continue;
    if (declarations.has(declaration.property)) return null;
    declarations.set(declaration.property, declaration);
  }
  return declarations.size ? declarations : null;
}

function isContainerAtRule(prelude) {
  return /^@(media|supports|container|layer|scope|document)\b/i.test(prelude);
}

function isKeyframes(prelude) {
  return /^@(?:-webkit-)?keyframes\b/i.test(prelude);
}

function scanRuleList(text, start, end, context, rules) {
  let cursor = start;
  while (cursor < end) {
    while (cursor < end) {
      if (/\s/.test(text[cursor])) {
        cursor += 1;
        continue;
      }
      if (text[cursor] === "/" && text[cursor + 1] === "*") {
        cursor = skipComment(text, cursor, end);
        continue;
      }
      break;
    }
    if (cursor >= end) break;

    const statementStart = cursor;
    const boundary = findStatementBoundary(text, cursor, end);
    if (!boundary) break;
    const prelude = text.slice(statementStart, boundary.index).trim();
    if (!prelude) {
      cursor = boundary.index + 1;
      continue;
    }
    if (boundary.char === ";") {
      cursor = boundary.index + 1;
      continue;
    }

    const close = findMatchingBrace(text, boundary.index, end);
    const normalized = normalizePrelude(prelude);
    const bodyStart = boundary.index + 1;
    const bodyEnd = close;

    if (normalized.startsWith("@")) {
      if (isContainerAtRule(normalized) && !isKeyframes(normalized)) {
        scanRuleList(text, bodyStart, bodyEnd, [...context, normalized], rules);
      }
    } else if (!context.some(isKeyframes)) {
      const declarations = parseDeclarations(text.slice(bodyStart, bodyEnd));
      if (declarations) {
        rules.push({
          selector: normalized,
          context: context.join("\n"),
          start: statementStart,
          end: close + 1,
          declarations
        });
      }
    }
    cursor = close + 1;
  }
}

function laterFullyShadows(earlier, later) {
  if (earlier.selector !== later.selector || earlier.context !== later.context) return false;
  for (const [property, previous] of earlier.declarations) {
    const next = later.declarations.get(property);
    if (!next) return false;
    if (previous.important && !next.important) return false;
  }
  return true;
}

function findShadowedRules(text) {
  const rules = [];
  scanRuleList(text, 0, text.length, [], rules);
  const groups = new Map();
  for (const rule of rules) {
    const key = `${rule.context}\u0000${rule.selector}`;
    const list = groups.get(key) || [];
    list.push(rule);
    groups.set(key, list);
  }

  const shadowed = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    for (let index = 0; index < list.length - 1; index += 1) {
      const earlier = list[index];
      const later = list.slice(index + 1).find((candidate) => laterFullyShadows(earlier, candidate));
      if (later) shadowed.push({ earlier, later });
    }
  }
  return shadowed;
}

function lineNumber(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) line += 1;
  return line;
}

function applyRemovals(text, shadowed) {
  const unique = new Map();
  for (const entry of shadowed) unique.set(`${entry.earlier.start}:${entry.earlier.end}`, entry.earlier);
  const rules = [...unique.values()].sort((a, b) => b.start - a.start);
  let output = text;
  for (const rule of rules) {
    let end = rule.end;
    while (end < output.length && (output[end] === " " || output[end] === "\t")) end += 1;
    if (output[end] === "\r" && output[end + 1] === "\n") end += 2;
    else if (output[end] === "\n") end += 1;
    output = output.slice(0, rule.start) + output.slice(end);
  }
  return { output, removed: rules.length };
}

const cssFiles = walkCss(srcRoot);
let total = 0;
let changedFiles = 0;
let bytesSaved = 0;

for (const file of cssFiles) {
  const source = fs.readFileSync(file, "utf8");
  const shadowed = findShadowedRules(source);
  if (!shadowed.length) continue;
  const repoPath = path.relative(root, file).split(path.sep).join("/");
  total += shadowed.length;

  if (!write) {
    for (const { earlier, later } of shadowed.slice(0, 40)) {
      console.error(
        `[css-dedup] ${repoPath}:${lineNumber(source, earlier.start)} ${earlier.selector} is fully shadowed by line ${lineNumber(source, later.start)}`
      );
    }
    if (shadowed.length > 40) console.error(`[css-dedup] ${repoPath}: ... ${shadowed.length - 40} more`);
    continue;
  }

  const { output, removed } = applyRemovals(source, shadowed);
  if (output !== source) {
    fs.writeFileSync(file, output);
    changedFiles += 1;
    bytesSaved += Buffer.byteLength(source) - Buffer.byteLength(output);
    console.log(`[css-dedup] cleaned ${repoPath}: ${removed} dead block(s)`);
  }
}

if (write) {
  console.log(`[css-dedup] removed ${total} fully shadowed block(s) from ${changedFiles} file(s); saved ${bytesSaved} bytes`);
  process.exit(0);
}

if (total > 0) {
  console.error(`[css-dedup] found ${total} fully shadowed same-selector block(s). Run: node scripts/css-shadow-dedup.mjs --write`);
  process.exit(1);
}

console.log(`[css-dedup] clean across ${cssFiles.length} CSS file(s)`);
