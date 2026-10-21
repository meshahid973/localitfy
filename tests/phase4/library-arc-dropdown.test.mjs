import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Library sort uses the Arc-inspired keyboard-accessible menu instead of a native select", () => {
  const library = read("src/features/library/LibraryView.tsx");
  const menu = read("src/shared/ui/ArcDropdownMenu.tsx");
  assert.match(library, /<ArcDropdownMenu/);
  assert.doesNotMatch(library, /<select/);
  assert.match(library, /onValueChange=\{setLibrarySortMode\}/);
  assert.match(library, /value: "library", label: "library order"/);
  assert.match(library, /value: "artist", label: "artist A–Z"/);
  for (const detail of ["createPortal(", 'aria-haspopup="menu"', 'role="menuitemradio"', "aria-checked=", '"ArrowDown"', '"ArrowUp"', '"Escape"', '"Home"', '"End"', "window.addEventListener(\"scroll\"", "useReducedMotion"]) {
    assert.ok(menu.includes(detail), detail + " is required for an accessible anchored menu");
  }
  assert.doesNotMatch(menu, /@radix-ui/);
});

test("Library uses a neutral hover without disabling drag indicators", () => {
  const library = read("src/features/library/library.css");
  const view = read("src/features/library/LibraryView.tsx");
  assert.match(library, /\.app \.libraryPage \.songRow:hover:not\(\.songDragging\):not\(\.songDropTarget\)/);
  assert.match(library, /\.songRow:not\(\.songDropTarget\)::before/);
  assert.match(library, /color-mix\(in srgb, var\(--lt-text\) 4%, transparent\)/);
  assert.match(library, /\.libraryStatsThree\s*\{/);
  assert.match(view, /missingFileCount > 0 \?/);
  assert.doesNotMatch(view, /drag to reorder · right-click for more/);
});

test("Arc menu owns its styles and preserves Localtify theme tokens", () => {
  const css = read("src/shared/ui/ArcDropdownMenu.css");
  const component = read("src/shared/ui/ArcDropdownMenu.tsx");
  assert.match(component, /getComputedStyle\(root\)/);
  assert.match(component, /--lt-surface-raised/);
  assert.match(css, /z-index: 3000/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /arcDropdownHighlight/);
});
