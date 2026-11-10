import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const read = (file) => fs.readFileSync(file, "utf8");

const compiled = ts.transpileModule(read("src/shared/ui/contextMenuPosition.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const moduleShim = { exports: {} };
runInNewContext(compiled, { module: moduleShim, exports: moduleShim.exports });
const { clampContextMenuPosition } = moduleShim.exports;
const pos = (point, menu, viewport) => JSON.parse(JSON.stringify(clampContextMenuPosition(point, menu, viewport)));

test("right-click menus stay within desktop viewport margins", () => {
  assert.deepEqual(pos({ x: 640, y: 220 }, { width: 258, height: 240 }, { width: 1280, height: 720 }), { left: 640, top: 220 });
  assert.deepEqual(pos({ x: 1272, y: 710 }, { width: 258, height: 540 }, { width: 1280, height: 720 }), { left: 1010, top: 168 });
  assert.deepEqual(pos({ x: -3, y: -10 }, { width: 220, height: 190 }, { width: 1024, height: 768 }), { left: 12, top: 12 });
  assert.deepEqual(pos({ x: 1000, y: 760 }, { width: 236, height: 380 }, { width: 1024, height: 768 }), { left: 776, top: 376 });
});

test("menus use measured dimensions and handle narrow windows rather than stale height estimates", () => {
  assert.deepEqual(pos({ x: 300, y: 300 }, { width: 180, height: 150 }, { width: 360, height: 280 }), { left: 168, top: 118 });
  assert.deepEqual(pos({ x: 200, y: 200 }, { width: 250, height: 150 }, { width: 240, height: 180 }), { left: 12, top: 18 });
  const shared = read("src/shared/ui/ContextMenuLayer.tsx");
  assert.match(shared, /menu\.offsetWidth, height: menu\.offsetHeight/);
  assert.match(shared, /window\.innerWidth, height: window\.innerHeight/);
  assert.match(shared, /window\.addEventListener\("resize", placeMenu\)/);
});

test("song, collection and sidebar context menus share dismissal and keyboard navigation", () => {
  const shared = read("src/shared/ui/ContextMenuLayer.tsx");
  for (const token of [
    'event.key !== "Escape"', '"ArrowDown"', '"ArrowUp"', '"Home"', '"End"',
    'button[role="menuitem"]:not(:disabled)', 'previousFocus.focus({ preventScroll: true })',
    'window.addEventListener("scroll", onScroll, true)',
    'previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })',
    'onClick={(event) => event.stopPropagation()}',
    'document.querySelector(".app") || document.body'
  ]) assert.ok(shared.includes(token), `Shared menu must preserve: ${token}`);
  for (const file of [
    "src/features/library/components/SongContextMenu.tsx",
    "src/features/library/components/CollectionContextMenu.tsx",
    "src/features/shell/SidebarNav.tsx"
  ]) {
    const component = read(file);
    assert.match(component, /<ContextMenuLayer /, file);
    assert.doesNotMatch(component, /className="songContextMenuLayer"/, file);
  }
  assert.doesNotMatch(read("src/features/shell/useCollectionActions.ts"), /MENU_HEIGHT|MENU_WIDTH|MENU_MARGIN/);
  assert.doesNotMatch(read("src/features/shell/SidebarNav.tsx"), /MENU_HEIGHT|MENU_WIDTH/);
});
