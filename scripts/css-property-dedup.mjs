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

function findDeclarationContentStart(body, start, end) {
  let cursor = start;
  while (cursor < end) {
    if (/\s/.test(body[cursor])) {
      cursor += 1;
      continue;
    }
    if (body[cursor] === "/" && body[cursor + 1] === "*") {
      cursor = skipComment(body, cursor, end);
      continue;
    }
    break;
  }
  return cursor;
}

function parseDeclaration(body, segmentStart, valueEnd, segmentEnd, absoluteBodyStart) {
  const contentStart = findDeclarationContentStart(body, segmentStart, valueEnd);
  if (contentStart >= valueEnd) return null;

  let paren = 0;
  let bracket = 0;
  for (let cursor = contentStart; cursor < valueEnd; cursor += 1) {
    const char = body[cursor];
    if (char === "/" && body[cursor + 1] === "*") {
      cursor = skipComment(body, cursor, valueEnd) - 1;
      continue;
    }
    if (char === '"' || char === "'") {
      cursor = skipString(body, cursor, valueEnd) - 1;
      continue;
    }
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === ":" && paren === 0 && bracket === 0) {
      const property = body
        .slice(contentStart, cursor)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim()
        .toLowerCase();
      if (!/^--[\w-]+$/.test(property) && !/^-?[a-z][a-z0-9-]*$/.test(property)) return null;

      const rawValue = body.slice(cursor + 1, valueEnd).trim();
      const important = /!important\s*$/i.test(rawValue);
      const value = rawValue.replace(/\s*!important\s*$/i, "").trim();
      if (!value) return null;

      return {
        property,
        important,
        value,
        start: absoluteBodyStart + contentStart,
        end: absoluteBodyStart + segmentEnd
      };
    }
  }
  return null;
}

function parseDeclarations(body, absoluteBodyStart) {
  if (body.includes("{")) return [];
  const declarations = [];
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
      const segmentEnd = cursor < body.length ? cursor + 1 : cursor;
      const declaration = parseDeclaration(body, start, cursor, segmentEnd, absoluteBodyStart);
      if (declaration) declarations.push(declaration);
      start = cursor + 1;
    }
  }

  return declarations;
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
      const declarations = parseDeclarations(text.slice(bodyStart, bodyEnd), bodyStart);
      if (declarations.length) {
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

function duplicateKey(declaration) {
  return `${declaration.property}\u0000${declaration.important ? "important" : "normal"}\u0000${declaration.value}`;
}

function effectiveDeclarations(rule) {
  const winners = new Map();
  for (const declaration of rule.declarations) {
    const previous = winners.get(declaration.property);
    if (!previous || declaration.important || !previous.important) {
      winners.set(declaration.property, declaration);
    }
  }
  return winners;
}

function findRedundantDeclarations(text) {
  const rules = [];
  scanRuleList(text, 0, text.length, [], rules);

  const groups = new Map();
  for (const rule of rules) {
    const key = `${rule.context}\u0000${rule.selector}`;
    const list = groups.get(key) || [];
    list.push(rule);
    groups.set(key, list);
  }

  const redundant = new Map();
  const remember = (earlier, later, kind) => {
    const key = `${earlier.start}:${earlier.end}`;
    if (!redundant.has(key)) redundant.set(key, { earlier, later, kind });
  };

  for (const list of groups.values()) {
    // Exact duplicate declarations are safe to remove even when they live in the
    // same block. This intentionally does not collapse different-value fallback
    // declarations inside one block.
    for (const rule of list) {
      const lastByValue = new Map();
      for (let index = rule.declarations.length - 1; index >= 0; index -= 1) {
        const declaration = rule.declarations[index];
        const key = duplicateKey(declaration);
        const later = lastByValue.get(key);
        if (later) remember(declaration, later, "exact");
        else lastByValue.set(key, declaration);
      }
    }

    // Historical App.css debt often repeats the same selector many blocks later.
    // In that case an earlier declaration of the same property is unreachable in
    // the final cascade. Keep custom properties and same-block fallback chains;
    // only prune declarations shadowed by a later *rule block* with the exact same
    // selector and at-rule context.
    const laterByProperty = new Map();
    for (let ruleIndex = list.length - 1; ruleIndex >= 0; ruleIndex -= 1) {
      const rule = list[ruleIndex];
      for (const declaration of rule.declarations) {
        if (declaration.property.startsWith("--")) continue;
        const later = laterByProperty.get(declaration.property);
        if (!later) continue;
        if (declaration.important && !later.important) continue;
        remember(declaration, later, "shadowed");
      }

      for (const [property, winner] of effectiveDeclarations(rule)) {
        if (property.startsWith("--")) continue;
        const existing = laterByProperty.get(property);
        if (!existing || winner.important || !existing.important) {
          laterByProperty.set(property, winner);
        }
      }
    }
  }

  return [...redundant.values()].sort((a, b) => a.earlier.start - b.earlier.start);
}

function lineNumber(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function applyRemovals(text, redundant) {
  const unique = new Map();
  for (const { earlier } of redundant) unique.set(`${earlier.start}:${earlier.end}`, earlier);

  const removals = [...unique.values()].sort((a, b) => b.start - a.start);
  let output = text;
  for (const declaration of removals) {
    output = output.slice(0, declaration.start) + output.slice(declaration.end);
  }

  output = output.replace(/^[\t ]+$/gm, "");
  return { output, removed: removals.length };
}

const cssFiles = walkCss(srcRoot);
let total = 0;
let exactTotal = 0;
let shadowedTotal = 0;
let changedFiles = 0;
let bytesSaved = 0;

for (const file of cssFiles) {
  const source = fs.readFileSync(file, "utf8");
  const redundant = findRedundantDeclarations(source);
  if (!redundant.length) continue;

  const repoPath = path.relative(root, file).split(path.sep).join("/");
  total += redundant.length;
  exactTotal += redundant.filter((entry) => entry.kind === "exact").length;
  shadowedTotal += redundant.filter((entry) => entry.kind === "shadowed").length;

  if (!write) {
    for (const { earlier, later, kind } of redundant.slice(0, 60)) {
      console.error(
        `[css-property-dedup] ${repoPath}:${lineNumber(source, earlier.start)} ${earlier.property}: ${earlier.value} ${kind === "exact" ? "duplicates" : "is shadowed by"} line ${lineNumber(source, later.start)}`
      );
    }
    if (redundant.length > 60) console.error(`[css-property-dedup] ${repoPath}: ... ${redundant.length - 60} more`);
    continue;
  }

  const { output, removed } = applyRemovals(source, redundant);
  if (output !== source) {
    fs.writeFileSync(file, output);
    changedFiles += 1;
    bytesSaved += Buffer.byteLength(source) - Buffer.byteLength(output);
    console.log(`[css-property-dedup] cleaned ${repoPath}: ${removed} redundant declaration(s)`);
  }
}

if (write) {
  console.log(
    `[css-property-dedup] removed ${total} redundant declaration(s) (${exactTotal} exact, ${shadowedTotal} shadowed) from ${changedFiles} file(s); saved ${bytesSaved} bytes`
  );
  process.exit(0);
}

if (total > 0) {
  console.error(
    `[css-property-dedup] found ${total} redundant declaration(s) (${exactTotal} exact, ${shadowedTotal} shadowed). Run: node scripts/css-property-dedup.mjs --write`
  );
  process.exit(1);
}

console.log(`[css-property-dedup] clean across ${cssFiles.length} CSS file(s)`);
