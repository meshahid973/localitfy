import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(path, "utf8");
test("elevated overlays share the same surface tokens", () => {
  const tokens = read("src/styles/tokens.css");
  assert.match(tokens, /--lt-glass-background:/);
  for (const path of ["src/shared/ui/ArcDropdownMenu.css", "src/features/library/components/song-context-menu.css", "src/features/player/components/queue-panel.css"]) {
    const css = read(path);
    assert.match(css, /background: var\(--lt-glass-background\)/);
    assert.match(css, /backdrop-filter: blur\(var\(--lt-glass-blur\)\)/);
  }
  const portal = read("src/shared/ui/ArcDropdownMenu.tsx");
  assert.match(portal, /"--lt-glass-background"/);
  assert.match(portal, /"--lt-glass-blur"/);
});
test("collections use the shared accessible icon control", () => {
  assert.match(read("src/features/pages/CollectionHero.tsx"), /<IconButton className="collectionIconButton"/);
  assert.match(read("src/shared/ui/IconButton.tsx"), /"aria-label": string/);
});
