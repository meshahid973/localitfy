import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const retiredClasses = new Set([
  "homeLibraryPanel", "homeLibraryActions", "homeLibraryExpanded", "homeLibraryCompact",
  "homeShelfStack", "homeShelfPanel", "homeShelfHeader", "homeShelfActions", "homeShelfActionButton",
  "homeListenPanel", "homeListenRail", "homeListenCard", "homeListenBackground", "homeListenBackgroundImage",
  "homeListenForeground", "homeListenMeta", "homeListenTitle", "homeListenArtist",
  "homeFreshPanel", "homeFreshRail", "homeFreshCard", "homeFreshCover", "homeShelfEmpty",
  "homeAlbumCard", "homeAlbumGrid", "homeExpandedGrid", "homeCompactGrid",
  "heroPremium", "heroLayoutMotion", "heroCoverGhost", "heroAmbiencePulse", "heroTextClean",
  "heroTitle", "heroArtistLine", "heroQuickActions", "heroTinyButton", "heroTinyButtonPrimary",
  "heroTinyButtonSecondary", "heroArtWrap", "heroArt", "heroExpandedShelf"
]);

function skipComment(text, index, end) {
  const close = text.indexOf("*/", index + 2);
  return close === -1 || close >= end ? end : close + 2;
}

function skipString(text, index, end) {
  const quote = text[index];
  let cursor = index + 1;
  while (cursor < end) {
    if (text[cursor] === "\\") { cursor += 2; continue; }
    if (text[cursor] === quote) return cursor + 1;
    cursor += 1;
  }
  return end;
}

function boundary(text, start, end) {
  let paren = 0;
  let bracket = 0;
  for (let cursor = start; cursor < end; cursor += 1) {
    const char = text[cursor];
    if (char === "/" && text[cursor + 1] === "*") { cursor = skipComment(text, cursor, end) - 1; continue; }
    if (char === '"' || char === "'") { cursor = skipString(text, cursor, end) - 1; continue; }
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (paren === 0 && bracket === 0 && (char === "{" || char === ";")) return { index: cursor, char };
  }
  return null;
}

function matchingBrace(text, open, end) {
  let depth = 1;
  for (let cursor = open + 1; cursor < end; cursor += 1) {
    const char = text[cursor];
    if (char === "/" && text[cursor + 1] === "*") { cursor = skipComment(text, cursor, end) - 1; continue; }
    if (char === '"' || char === "'") { cursor = skipString(text, cursor, end) - 1; continue; }
    if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return cursor;
  }
  throw new Error(`unbalanced CSS at ${open}`);
}

function splitSelectors(prelude) {
  const output = [];
  let start = 0;
  let paren = 0;
  let bracket = 0;
  for (let cursor = 0; cursor <= prelude.length; cursor += 1) {
    const char = prelude[cursor];
    if (char === "/" && prelude[cursor + 1] === "*") { cursor = skipComment(prelude, cursor, prelude.length) - 1; continue; }
    if (char === '"' || char === "'") { cursor = skipString(prelude, cursor, prelude.length) - 1; continue; }
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    if ((cursor === prelude.length || char === ",") && paren === 0 && bracket === 0) {
      const selector = prelude.slice(start, cursor).trim();
      if (selector) output.push(selector);
      start = cursor + 1;
    }
  }
  return output;
}

function isRetiredSelector(selector) {
  for (const name of retiredClasses) {
    if (new RegExp(`\\.${name}(?![A-Za-z0-9_-])`).test(selector)) return true;
  }
  return false;
}

function collectEdits(text, start, end, edits) {
  let cursor = start;
  while (cursor < end) {
    while (cursor < end) {
      if (/\s/.test(text[cursor])) { cursor += 1; continue; }
      if (text[cursor] === "/" && text[cursor + 1] === "*") { cursor = skipComment(text, cursor, end); continue; }
      break;
    }
    if (cursor >= end) break;
    const ruleStart = cursor;
    const next = boundary(text, cursor, end);
    if (!next) break;
    const prelude = text.slice(ruleStart, next.index).trim();
    if (!prelude || next.char === ";") { cursor = next.index + 1; continue; }
    const close = matchingBrace(text, next.index, end);
    if (prelude.startsWith("@")) {
      if (/^@(media|supports|container|layer|scope|document)\b/i.test(prelude)) collectEdits(text, next.index + 1, close, edits);
    } else {
      const selectors = splitSelectors(prelude);
      const kept = selectors.filter((selector) => !isRetiredSelector(selector));
      if (kept.length !== selectors.length) {
        if (!kept.length) edits.push({ start: ruleStart, end: close + 1, value: "" });
        else edits.push({ start: ruleStart, end: next.index, value: kept.join(",\n") + " " });
      }
    }
    cursor = close + 1;
  }
}

function cleanCss(relativePath) {
  const absolute = path.join(root, relativePath);
  const source = fs.readFileSync(absolute, "utf8");
  const edits = [];
  collectEdits(source, 0, source.length, edits);
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
  output = output.replace(/\n{4,}/g, "\n\n\n");
  if (output !== source) fs.writeFileSync(absolute, output);
  console.log(`[home-v2] ${relativePath}: ${edits.length} retired selector edit(s)`);
}

for (const css of ["src/App.css", "src/features/shell/motion.css", "src/features/shell/performance.css"]) cleanCss(css);

const homeCssPath = path.join(root, "src/features/home/home.css");
let homeCss = fs.readFileSync(homeCssPath, "utf8");
homeCss = homeCss.replace("    inset-left: 38%;", "    left: 38%;");
fs.writeFileSync(homeCssPath, homeCss);

const shellPath = path.join(root, "src/features/shell/AppShell.tsx");
let shell = fs.readFileSync(shellPath, "utf8");
shell = shell.replace('${settings.quickLibraryMoreBlur !== false ? "moreQuickLibraryBlur" : "lessQuickLibraryBlur"} ', "");
shell = shell.replace(/\n\s*data-home-expanded=\{settings\.homeExpanded \? "on" : "off"\}/, "");
if (!shell.includes("data-view={view}")) shell = shell.replace("      data-platform={platformId}", "      data-view={view}\n      data-platform={platformId}");
fs.writeFileSync(shellPath, shell);

const crossPath = path.join(root, "scripts/css-cross-file-dedup.mjs");
let cross = fs.readFileSync(crossPath, "utf8");
cross = cross.replace(
  'if (STYLE_ORDER.at(-2) !== "src/features/shell/release.css" || STYLE_ORDER.at(-1) !== "src/features/shell/performance.css") {\n  throw new Error(`[css-cross-file] renderer cascade must end in release.css -> performance.css, got ${STYLE_ORDER.slice(-2).join(" -> ") || "nothing"}`);\n}',
  'if (STYLE_ORDER.at(-1) !== "src/features/shell/performance.css") {\n  throw new Error(`[css-cross-file] renderer cascade must end in performance.css, got ${STYLE_ORDER.at(-1) || "nothing"}`);\n}'
);
fs.writeFileSync(crossPath, cross);

console.log("[home-v2] finalized Home v2 ownership, retired legacy selectors, and updated cascade validation");
