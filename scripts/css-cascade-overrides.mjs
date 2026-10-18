import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

function cssFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? cssFiles(full) : entry.isFile() && full.endsWith(".css") ? [full] : [];
  });
}

function skip(text, position, end) {
  if (text[position] === "/" && text[position + 1] === "*") {
    const close = text.indexOf("*/", position + 2);
    return close < 0 || close >= end ? end : close + 2;
  }
  if (text[position] === '"' || text[position] === "'") {
    const quote = text[position];
    let index = position + 1;
    while (index < end) {
      if (text[index] === "\\") index += 2;
      else if (text[index++] === quote) return index;
    }
    return end;
  }
  return position;
}

function delimiter(text, from, to, chars) {
  let paren = 0, bracket = 0;
  for (let i = from; i < to; i += 1) {
    const ahead = skip(text, i, to);
    if (ahead !== i) { i = ahead - 1; continue; }
    if (text[i] === "(") paren++;
    else if (text[i] === ")") paren--;
    else if (text[i] === "[") bracket++;
    else if (text[i] === "]") bracket--;
    else if (paren === 0 && bracket === 0 && chars.includes(text[i])) return i;
  }
  return -1;
}

function matchingBrace(text, open, end) {
  let depth = 1;
  for (let i = open + 1; i < end; i += 1) {
    const ahead = skip(text, i, end);
    if (ahead !== i) { i = ahead - 1; continue; }
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  throw new Error("Unbalanced CSS rule near offset " + open);
}

function declarations(body) {
  // Nested rules and @property blocks are not ordinary CSS declarations.
  if (delimiter(body, 0, body.length, "{") !== -1) return [];
  const found = [];
  let index = 0;
  while (index < body.length) {
    const end = delimiter(body, index, body.length, ";");
    const chunk = body.slice(index, end < 0 ? body.length : end);
    const clean = chunk.replace(/\/\*[\s\S]*?\*\//g, " ").trim();
    const colon = delimiter(clean, 0, clean.length, ":");
    if (colon >= 0) {
      const property = clean.slice(0, colon).trim().toLowerCase();
      const value = clean.slice(colon + 1).trim();
      if (/^(?:--[\w-]+|-?[a-z][\w-]*)$/.test(property) && value) {
        found.push({ property, important: /!important\s*$/i.test(value) });
      }
    }
    index = end < 0 ? body.length : end + 1;
  }
  return found;
}

export function findCascadeShadows(source) {
  const seen = new Map();
  const collisions = [];
  const atContainer = /^@(?:media|supports|container|layer|scope|document|starting-style)\b/i;
  const line = (at) => source.slice(0, at).split("\n").length;
  function scan(start, end, context) {
    let cursor = start;
    while (cursor < end) {
      while (cursor < end) {
        if (/\s/.test(source[cursor])) { cursor++; continue; }
        if (source[cursor] === "/" && source[cursor + 1] === "*") {
          cursor = skip(source, cursor, end);
          continue;
        }
        break;
      }
      if (cursor >= end) break;
      const statement = cursor;
      const brace = delimiter(source, cursor, end, "{;");
      if (brace < 0) break;
      if (source[brace] === ";") { cursor = brace + 1; continue; }
      const close = matchingBrace(source, brace, end);
      const selector = source.slice(statement, brace).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
      if (atContainer.test(selector)) {
        scan(brace + 1, close, context + "\u0000" + selector);
      } else if (!selector.startsWith("@")) {
        const props = declarations(source.slice(brace + 1, close));
        for (const entry of props) {
          const key = context + "\u0000" + selector + "\u0000" + entry.property;
          const previous = seen.get(key);
          // Deliberate same-rule fallbacks are owned by the property checker.
          // A later normal declaration cannot replace an earlier !important one.
          if (previous && previous.ruleStart !== statement && (!previous.important || entry.important)) {
            collisions.push({ selector, property: entry.property, priorLine: previous.line, line: line(statement) });
          }
          if (!previous || !previous.important || entry.important) {
            seen.set(key, { line: line(statement), important: entry.important, ruleStart: statement });
          }
        }
      }
      cursor = close + 1;
    }
  }
  scan(0, source.length, "");
  return collisions;
}

function selfTest() {
  assert.equal(findCascadeShadows(".x { color: red } .x { color: blue }").length, 1);
  assert.equal(findCascadeShadows(".x { color: red !important } .x { color: blue }").length, 0);
  assert.equal(findCascadeShadows(".x { color: red } .x { color: blue !important }").length, 1);
  assert.equal(findCascadeShadows("@media (max-width: 600px) { .x { color: red } } .x { color: blue }").length, 0);
  assert.equal(findCascadeShadows("@media (max-width: 600px) { .x { color: red } } @media (max-width: 600px) { .x { color: blue } }").length, 1);
  assert.equal(findCascadeShadows("@keyframes blink { from { opacity: 0 } to { opacity: 1 } }").length, 0);
  assert.equal(findCascadeShadows('.x { content: "a;b"; color: red } .x { color: green }').length, 1);
  assert.equal(findCascadeShadows(".x { color: red } .y { color: blue }").length, 0);
  assert.equal(findCascadeShadows(".x { color: red; color: blue }").length, 0);
  assert.equal(findCascadeShadows(".x { color: red !important } .x { color: blue } .x { color: green }").length, 0);
  console.log("[css-cascade] parser self-tests passed");
}

if (process.argv.includes("--self-test")) selfTest();
else if (process.argv[1]?.replaceAll("\\", "/").endsWith("/css-cascade-overrides.mjs")) {
  let count = 0;
  for (const file of cssFiles("src")) {
    const collisions = findCascadeShadows(fs.readFileSync(file, "utf8"));
    for (const item of collisions) {
      if (count < 45) console.error("[css-cascade] " + file + ":" + item.priorLine + " " + item.selector + " " + item.property + " shadowed at line " + item.line);
      count++;
    }
  }
  if (count) {
    console.error("[css-cascade] " + count + " shadowed same-selector declaration(s); consolidate without changing the surviving values");
    process.exitCode = 1;
  } else console.log("[css-cascade] clean: no redundant same-selector declarations in src CSS");
}
