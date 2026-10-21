import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const file = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("sidebar geometry and behavior belong to view-shell, never effects", () => {
  const view = file("src/styles/view-shell.css");
  const effects = file("src/features/shell/effects.css");
  const core = file("src/features/shell/app-core.css");
  assert.match(view, /main\.app\.app\[data-sidebar-behavior="fixed"\] > \.appShell/);
  assert.match(view, /main\.app\.app\[data-sidebar-behavior="hover"\] > \.appShell > \.sidebar:hover/);
  assert.doesNotMatch(effects, /--lt-sidebar-closed:/);
  assert.doesNotMatch(effects, /main\.app\.app\[data-sidebar-behavior="fixed"\] > \.appShell/);
  assert.doesNotMatch(core, /@media \(max-width: 760px\)\s*\{\s*\.appShell\{\s*grid-template-columns: 1fr/);
});

test("mobile navigation remains a visible 64px rail regardless of desktop mode", () => {
  const view = file("src/styles/view-shell.css");
  const mobile = view.slice(view.lastIndexOf("@media (max-width: 780px)"));
  assert.match(mobile, /grid-template-columns: 64px minmax\(0, 1fr\) !important/);
  for (const behavior of ["fixed", "slim", "hover"]) {
    assert.ok(mobile.includes('data-sidebar-behavior="' + behavior + '"'));
  }
});
