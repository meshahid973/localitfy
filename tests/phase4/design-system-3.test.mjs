import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { runInNewContext } from "node:vm";
const read = path => fs.readFileSync(path, "utf8");
test("elevated overlays share the same surface owner and theme tokens", () => {
  const tokens = read("src/styles/tokens.css");
  assert.match(tokens, /--lt-glass-background:/);
  assert.match(read("src/styles/themes.css"), /\.app\[data-theme\]\s*\{[^}]*--lt-glass-background:/);
  const surface = read("src/shared/ui/surface.css");
  assert.match(surface, /\.ltOverlaySurface\s*\{[^}]*background: var\(--lt-glass-background\)/);
  assert.match(surface, /backdrop-filter: blur\(var\(--lt-glass-blur\)\)/);
  for (const path of ["src/shared/ui/ArcDropdownMenu.tsx", "src/shared/ui/ContextMenuLayer.tsx", "src/features/player/components/QueuePanel.tsx"]) assert.match(read(path), /ltOverlaySurface/);
  const portal = read("src/shared/ui/ArcDropdownMenu.tsx");
  assert.match(portal, /"--lt-glass-background"/);
  assert.match(portal, /"--lt-glass-blur"/);
});
test("collections use the shared accessible icon control and transparent surface", () => {
  const hero = read("src/features/pages/CollectionHero.tsx");
  assert.match(hero, /<IconButton className="collectionIconButton"/);
  assert.match(hero, /<Surface as="header" variant="transparent"/);
  assert.match(read("src/shared/ui/IconButton.tsx"), /"aria-label": string/);
});
test("menu typeahead wraps repeated keys, matches prefixes and handles empty menus", () => {
  const js = ts.transpileModule(read("src/shared/hooks/useMenuTypeahead.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; runInNewContext(js, { exports, require: () => ({}) });
  const find = exports.findMenuMatch;
  const labels = ["Play", "Playlist", "Queue", "Remove"];
  assert.equal(find(labels, 0, "p"), 1);
  assert.equal(find(labels, 1, "p"), 0);
  assert.equal(find(labels, 2, "rem"), 3);
  assert.equal(find(labels, 2, "z"), -1);
  assert.equal(find([], -1, "x"), -1);
});
