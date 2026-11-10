import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) => fs.readFileSync(relative, "utf8");

test("all app-owned track dialogs share an active topmost keyboard focus trap", () => {
  const hook = read("src/shared/hooks/useModalFocus.ts");
  const editor = read("src/features/library/components/SongEditorModal.tsx");
  const confirm = read("src/features/library/components/DeleteSongModal.tsx");
  assert.match(hook, /querySelectorAll<HTMLElement>\('\[aria-modal="true"\]'\)/);
  assert.match(hook, /const isTopmost = \(\) => topmostModal\(\) === dialog/);
  assert.match(hook, /event\.key !== "Tab"/);
  assert.match(hook, /event\.shiftKey/);
  assert.match(hook, /document\.addEventListener\("focusin", onFocusIn, true\)/);
  assert.match(hook, /document\.removeEventListener\("focusin", onFocusIn, true\)/);
  assert.match(hook, /previouslyFocused\.focus\(\{ preventScroll: true \}\)/);
  for (const [name, component] of [["editor", editor], ["confirm", confirm]]) {
    assert.match(component, /useModalFocus\(Boolean\(song\)\)/, name);
    assert.match(component, /ref=\{dialogRef\} tabIndex=\{-1\}/, name);
    assert.match(component, /aria-modal="true"/, name);
  }
});

test("song menu has exactly one owner for Escape and scroll dismissal", () => {
  const app = read("src/App.tsx");
  const shared = read("src/shared/ui/ContextMenuLayer.tsx");
  assert.doesNotMatch(app, /window\.addEventListener\("scroll", closeMenu, true\)/);
  assert.doesNotMatch(app, /document\.addEventListener\("keydown", closeOnEscape\)/);
  assert.match(shared, /window\.addEventListener\("scroll", onScroll, true\)/);
  assert.match(shared, /menuRef\.current\?\.contains\(target\)/);
  assert.match(shared, /event\.key === "Tab"[\s\S]*?event\.preventDefault\(\);[\s\S]*?previousFocus\?\.isConnected/);
});
