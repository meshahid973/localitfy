import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const write = process.argv.includes("--write");

function resolveRelativeImport(modulePath, specifier) {
  const moduleDir = path.posix.dirname(modulePath.replaceAll("\\", "/"));
  return path.posix.normalize(path.posix.join(moduleDir, specifier));
}

function extractModuleImports(modulePath) {
  const source = fs.readFileSync(path.join(root, modulePath), "utf8");
  const imports = [];

  // We only need renderer entrypoint imports here. CSS side-effect imports and
  // the App import are single-line statements; parsing one line at a time keeps
  // a side-effect CSS import from being swallowed by the following `from` import.
  for (const line of source.split(/\r?\n/)) {
    const sideEffect = line.match(/^\s*import\s+["']([^"']+)["'];?\s*$/);
    const fromImport = line.match(/^\s*import\s+.+?\s+from\s+["']([^"']+)["'];?\s*$/);
    const specifier = sideEffect?.[1] || fromImport?.[1] || "";
    if (!specifier.startsWith(".")) continue;
    imports.push({ specifier, repoPath: resolveRelativeImport(modulePath, specifier) });
  }

  return imports;
}

function cssImports(modulePath) {
  return extractModuleImports(modulePath)
    .filter(({ specifier }) => specifier.endsWith(".css"))
    .map(({ repoPath }) => {
      if (!fs.existsSync(path.join(root, repoPath))) throw new Error(`[css-cross-file] imported stylesheet does not exist: ${repoPath}`);
      return repoPath;
    });
}

// Follow the renderer's actual dependency order. App's CSS dependencies are
// expanded exactly where main.tsx imports App, so final owner styles imported
// after App stay final in both Chromium and this validator.
const appCss = cssImports("src/App.tsx");
const mainImports = extractModuleImports("src/main.tsx");
const ordered = [];
for (const entry of mainImports) {
  if (entry.specifier === "./App" || entry.specifier === "./App.tsx") {
    ordered.push(...appCss);
    continue;
  }
  if (!entry.specifier.endsWith(".css")) continue;
  if (!fs.existsSync(path.join(root, entry.repoPath))) throw new Error(`[css-cross-file] imported stylesheet does not exist: ${entry.repoPath}`);
  ordered.push(entry.repoPath);
}
const STYLE_ORDER = [...new Set(ordered)];

if (!STYLE_ORDER.includes("src/index.css") || !STYLE_ORDER.includes("src/App.css")) {
  throw new Error(`[css-cross-file] renderer cascade discovery is incomplete: ${STYLE_ORDER.join(" -> ")}`);
}
if (STYLE_ORDER.at(-1) !== "src/features/shell/performance.css") {
  throw new Error(`[css-cross-file] renderer cascade must end in performance.css, got ${STYLE_ORDER.at(-1) || "nothing"}`);
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
    else if (paren === 0 && bracket === 0 && (char === "{" || char === ";")) return { index: cursor, char };
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
      return { property, important: /!important\s*$/i.test(rawValue) };
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

function scanRuleList(text, start, end, context, rules, fileIndex, repoPath) {
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
      if (isContainerAtRule(normalized) && !isKeyframes(normalized)) scanRuleList(text, bodyStart, bodyEnd, [...context, normalized], rules, fileIndex, repoPath);
    } else if (!context.some(isKeyframes)) {
      const declarations = parseDeclarations(text.slice(bodyStart, bodyEnd));
      if (declarations) {
        rules.push({ selector: normalized, context: context.join("\n"), start: statementStart, end: close + 1, declarations, fileIndex, repoPath });
      }
    }
    cursor = close + 1;
  }
}

function laterFullyShadows(earlier, later) {
  if (earlier.selector !== later.selector || earlier.context !== later.context) return false;
  if (later.fileIndex <= earlier.fileIndex) return false;
  for (const [property, previous] of earlier.declarations) {
    const next = later.declarations.get(property);
    if (!next) return false;
    if (previous.important && !next.important) return false;
  }
  return true;
}

function lineNumber(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) line += 1;
  return line;
}

function applyRemovals(text, rules) {
  const unique = new Map();
  for (const rule of rules) unique.set(`${rule.start}:${rule.end}`, rule);
  const removals = [...unique.values()].sort((a, b) => b.start - a.start);
  let output = text;
  for (const rule of removals) {
    let end = rule.end;
    while (end < output.length && (output[end] === " " || output[end] === "\t")) end += 1;
    if (output[end] === "\r" && output[end + 1] === "\n") end += 2;
    else if (output[end] === "\n") end += 1;
    output = output.slice(0, rule.start) + output.slice(end);
  }
  output = output.replace(/^[\t ]+$/gm, "");
  return { output, removed: removals.length };
}

const files = STYLE_ORDER.map((repoPath, fileIndex) => {
  const absolute = path.join(root, repoPath);
  const source = fs.readFileSync(absolute, "utf8");
  const rules = [];
  scanRuleList(source, 0, source.length, [], rules, fileIndex, repoPath);
  return { repoPath, absolute, source, rules };
});

const groups = new Map();
for (const file of files) {
  for (const rule of file.rules) {
    const key = `${rule.context}\u0000${rule.selector}`;
    const list = groups.get(key) || [];
    list.push(rule);
    groups.set(key, list);
  }
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

if (!write) {
  if (!shadowed.length) {
    console.log(`[css-cross-file] clean across ${files.length} renderer-global CSS file(s): ${STYLE_ORDER.join(" -> ")}`);
    process.exit(0);
  }
  for (const { earlier, later } of shadowed.slice(0, 60)) {
    const earlierFile = files[earlier.fileIndex];
    const laterFile = files[later.fileIndex];
    console.error(`[css-cross-file] ${earlier.repoPath}:${lineNumber(earlierFile.source, earlier.start)} ${earlier.selector} is fully shadowed by ${later.repoPath}:${lineNumber(laterFile.source, later.start)}`);
  }
  if (shadowed.length > 60) console.error(`[css-cross-file] ... ${shadowed.length - 60} more`);
  console.error(`[css-cross-file] found ${shadowed.length} cross-file shadowed block(s). Run: node scripts/css-cross-file-dedup.mjs --write`);
  process.exit(1);
}

const removalsByFile = new Map();
for (const { earlier } of shadowed) {
  const list = removalsByFile.get(earlier.repoPath) || [];
  list.push(earlier);
  removalsByFile.set(earlier.repoPath, list);
}

let changedFiles = 0;
let bytesSaved = 0;
for (const file of files) {
  const removals = removalsByFile.get(file.repoPath) || [];
  if (!removals.length) continue;
  const { output, removed } = applyRemovals(file.source, removals);
  if (output === file.source) continue;
  fs.writeFileSync(file.absolute, output);
  changedFiles += 1;
  bytesSaved += Buffer.byteLength(file.source) - Buffer.byteLength(output);
  console.log(`[css-cross-file] cleaned ${file.repoPath}: ${removed} dead block(s)`);
}

console.log(`[css-cross-file] removed ${shadowed.length} cross-file shadowed block(s) from ${changedFiles} file(s); saved ${bytesSaved} bytes`);
