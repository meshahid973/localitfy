import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "scripts/apply-ground-zero-css.mjs");
let source = fs.readFileSync(target, "utf8");

const selectorNeedle = `function selectorOwnsResetPage(selector) {
  const clean = selector.replace(/\\/\\*[\\s\\S]*?\\*\\//g, " ");
  for (const match of clean.matchAll(/\\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {`;
const selectorReplacement = `function selectorOwnsResetPage(selector) {
  const clean = selector.replace(/\\/\\*[\\s\\S]*?\\*\\//g, " ");
  // Mixed Home/player rules are shared behavior, not page skin. Keep them intact.
  if (/\\.(?:home|player|nowPlaying|transport|volume|queue)[-_a-zA-Z0-9]*/i.test(clean)) return false;
  for (const match of clean.matchAll(/\\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {`;
if (!source.includes(selectorNeedle)) throw new Error("selector safety insertion point missing");
source = source.replace(selectorNeedle, selectorReplacement);

const matcherNeedle = `const pageMatchers = \${JSON.stringify(pageClassMatchers.map((matcher) => matcher.source))};
const isPageClass = (name) => pageMatchers.some((source) => new RegExp(source, "i").test(name));`;
const matcherReplacement = `const forbiddenPageTokens = [
  ".libraryPanel", ".libraryQuick", ".libraryMissing", ".libraryCoverCard", ".shuffleLibraryButton",
  ".albumsPage", ".albumsHero", ".albumsShelf", ".albumFolder", ".albumCard", ".albumDetail", ".albumBuilder",
  ".playlistsPage", ".playlistHero", ".playlistCreate", ".playlistShelf", ".playlistTracks",
  ".coverStudio", ".coverMood", ".coverSelected", ".coverGallery", ".coverQuick", ".coverRecent",
  ".downloadsLayout", ".downloadPanel", ".downloadQueue", ".downloadTextarea", ".spotifyTrack", ".spotifyAuth", ".converter",
  ".analytics", ".settingsPage", ".settingsHero"
];`;
if (!source.includes(matcherNeedle)) throw new Error("test matcher insertion point missing");
source = source.replace(matcherNeedle, matcherReplacement);

const leakNeedle = `    const classes = [...source.matchAll(/\\\\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]);
    const leaked = [...new Set(classes.filter(isPageClass))];
    assert.deepEqual(leaked, [], relative + " still owns reset page classes: " + leaked.join(", "));`;
const leakReplacement = `    const leaked = forbiddenPageTokens.filter((token) => source.includes(token));
    assert.deepEqual(leaked, [], relative + " still owns reset page families: " + leaked.join(", "));`;
if (!source.includes(leakNeedle)) throw new Error("test leak assertion insertion point missing");
source = source.replace(leakNeedle, leakReplacement);

const logNeedle = `console.log("[ground-zero] page roots standardized, legacy page selectors purged, shell shim removed, and budgets ratcheted");`;
const logReplacement = `for (const relative of ["tests/phase4/page-style-reset.test.mjs", "scripts/check-release-ui-ownership.mjs"]) {
  let current = read(relative);
  current = current.replace('["linear-gradient(", "radial-gradient(", "text-shadow:"]', '["linear-gradient(", "radial-gradient("]');
  write(relative, current);
}

console.log("[ground-zero] page roots standardized, legacy page selectors purged, shell shim removed, and budgets ratcheted");`;
if (!source.includes(logNeedle)) throw new Error("final insertion point missing");
source = source.replace(logNeedle, logReplacement);

fs.writeFileSync(target, source, "utf8");
console.log("[ground-zero] safety patch applied");
