import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
      rules.push({
        selector: normalized,
        context: context.join("\n"),
        start: statementStart,
        bodyStart,
        bodyEnd,
        end: close + 1
      });
    }

    cursor = close + 1;
  }
}

function lineNumber(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) line += 1;
  return line;
}

function findAdjacentGroups(text) {
  const rules = [];
  scanRuleList(text, 0, text.length, [], rules);
  const groups = [];

  for (let index = 0; index < rules.length - 1; index += 1) {
    const first = rules[index];
    const group = [first];
    let cursor = index + 1;

    while (cursor < rules.length) {
      const previous = group[group.length - 1];
      const next = rules[cursor];
      if (next.context !== first.context || next.selector !== first.selector) break;
      if (!/^[\t\r\n ]*$/.test(text.slice(previous.end, next.start))) break;
      group.push(next);
      cursor += 1;
    }

    if (group.length > 1) {
      groups.push(group);
      index = cursor - 1;
    }
  }

  return groups;
}

function applyGroups(text, groups) {
  let output = text;
  const ordered = [...groups].sort((a, b) => b[0].start - a[0].start);

  for (const group of ordered) {
    const first = group[0];
    const last = group[group.length - 1];
    const bodies = group.map((rule) => text.slice(rule.bodyStart, rule.bodyEnd));
    const combinedBody = bodies.join("\n");
    const replacement = text.slice(first.start, first.bodyStart) + combinedBody + text.slice(last.bodyEnd, last.end);
    output = output.slice(0, first.start) + replacement + output.slice(last.end);
  }

  output = output.replace(/^[\t ]+$/gm, "");
  return output;
}

const cssFiles = walkCss(srcRoot);
let totalGroups = 0;
let totalMergedRules = 0;
let changedFiles = 0;
let bytesSaved = 0;

for (const file of cssFiles) {
  const source = fs.readFileSync(file, "utf8");
  const groups = findAdjacentGroups(source);
  if (!groups.length) continue;

  const repoPath = path.relative(root, file).split(path.sep).join("/");
  totalGroups += groups.length;
  totalMergedRules += groups.reduce((sum, group) => sum + group.length - 1, 0);

  if (!write) {
    for (const group of groups.slice(0, 40)) {
      console.error(`[css-adjacent] ${repoPath}:${lineNumber(source, group[0].start)} ${group[0].selector} has ${group.length} adjacent blocks`);
    }
    if (groups.length > 40) console.error(`[css-adjacent] ${repoPath}: ... ${groups.length - 40} more group(s)`);
    continue;
  }

  const output = applyGroups(source, groups);
  if (output !== source) {
    fs.writeFileSync(file, output);
    changedFiles += 1;
    bytesSaved += Buffer.byteLength(source) - Buffer.byteLength(output);
    console.log(`[css-adjacent] cleaned ${repoPath}: ${groups.length} group(s), ${groups.reduce((sum, group) => sum + group.length - 1, 0)} redundant block(s)`);
  }
}

if (write) {
  console.log(`[css-adjacent] merged ${totalMergedRules} adjacent duplicate block(s) across ${totalGroups} group(s) in ${changedFiles} file(s); saved ${bytesSaved} bytes`);
  process.exit(0);
}

if (totalGroups > 0) {
  console.error(`[css-adjacent] found ${totalMergedRules} adjacent duplicate block(s) across ${totalGroups} group(s). Run: node scripts/css-adjacent-merge.mjs --write`);
  process.exit(1);
}

console.log(`[css-adjacent] clean across ${cssFiles.length} CSS file(s)`);
