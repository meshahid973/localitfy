import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const write = (relative, content) => fs.writeFileSync(path.join(root, relative), content.replace(/\r\n/g, "\n"), "utf8");

let ownership = read("scripts/check-release-ui-ownership.mjs");
ownership = ownership.replace(
  'const count = (source, token) => source.split(token).length - 1;',
  `const count = (source, token) => source.split(token).length - 1;
function countLooseAny(source) {
  const patterns = [
    /:\\s*any\\b/g,
    /\\bas\\s+any\\b/g,
    /<\\s*any\\s*>/g,
    /\\bany\\s*\\[\\s*\\]/g,
    /\\b(?:Record|Array|Promise|Map|Set)<[^>]*\\bany\\b[^>]*>/g
  ];
  return patterns.reduce((total, pattern) => total + (source.match(pattern) || []).length, 0);
}`
);
ownership = ownership.replace(
  '  const hits = (read(file).match(/\\bany\\b/g) || []).length;',
  '  const hits = countLooseAny(read(file));'
);
write("scripts/check-release-ui-ownership.mjs", ownership);

write("tests/phase4/page-style-reset.test.mjs", `import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const retiredPageStyles = [
  "src/features/library/library.css",
  "src/features/albums/albums.css",
  "src/features/playlists/playlists.css",
  "src/features/covers/covers.css",
  "src/features/downloads/downloads.css",
  "src/features/analytics/analytics.css"
];
const resetPageRoots = [
  ".libraryPanelV025", ".albumsPageV318", ".playlistsPage", ".coverStudioLayout",
  ".downloadsLayoutV031", ".analyticsStudioV339"
];

test("retired page design files stay deleted until their rebuild", () => {
  const main = read("src/main.tsx");
  for (const relativePath of retiredPageStyles) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, relativePath + " returned before its redesign");
    assert.equal(main.includes(relativePath.replace(/^src\\//, "./")), false, relativePath + " returned to the renderer manifest");
  }
});

test("global visual owners cannot reclaim reset page roots", () => {
  for (const relativePath of ["src/App.css", "src/features/shell/app-core.css", "src/features/shell/effects.css", "src/styles/themes.css"]) {
    const source = read(relativePath);
    for (const selector of resetPageRoots) assert.equal(source.includes(selector), false, relativePath + " illegally owns " + selector);
  }
});

test("temporary page foundation stays reset-gated, structural, and small", () => {
  const source = read("src/styles/page-foundation.css");
  assert.ok(source.includes('[data-page-section][data-page-state="reset"]'));
  assert.doesNotMatch(source, /\\[data-page-section\\](?!\\[data-page-state="reset"\\])/);
  for (const selector of resetPageRoots) assert.equal(source.includes(selector), true, "structural foundation lost " + selector);
  for (const visualToken of ["linear-gradient(", "radial-gradient("]) assert.equal(source.includes(visualToken), false, "structural foundation gained visual styling: " + visualToken);
  assert.ok(Buffer.byteLength(source) < 8 * 1024, "page foundation exceeded its 8 KiB structural budget");
});
`);

let readiness = read("tests/phase4/redesign-readiness.test.mjs");
readiness = readiness.replace(
  '  for (const relative of ["src/features/library/LibraryView.tsx", "src/features/covers/CoversView.tsx", "src/features/player/components/PlayerBar.tsx", "src/features/analytics/AnalyticsView.tsx", "src/features/analytics/analyticsSnapshot.ts"]) assert.equal((read(relative).match(/\\bany\\b/g) || []).length, 0, relative + " regained any");',
  `  const looseAny = /:\\s*any\\b|\\bas\\s+any\\b|<\\s*any\\s*>|\\bany\\s*\\[\\s*\\]|\\b(?:Record|Array|Promise|Map|Set)<[^>]*\\bany\\b[^>]*>/;
  for (const relative of ["src/features/library/LibraryView.tsx", "src/features/covers/CoversView.tsx", "src/features/player/components/PlayerBar.tsx", "src/features/analytics/AnalyticsView.tsx", "src/features/analytics/analyticsSnapshot.ts"]) assert.doesNotMatch(read(relative), looseAny, relative + " regained loose any typing");`
);
write("tests/phase4/redesign-readiness.test.mjs", readiness);

console.log("[redesign-readiness] debt and reset assertions corrected");
