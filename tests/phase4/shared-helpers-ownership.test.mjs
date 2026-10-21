import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function load(file, modules = {}) {
  const exports = {};
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function("exports", "require", compiled)(exports, (name) => {
    if (!(name in modules)) throw new Error("Unexpected import: " + name);
    return modules[name];
  });
  return exports;
}

test("shared clamp keeps UI values unchanged and media values finite", () => {
  const { clamp, clampUpperFirst, clampFinite } = load("src/shared/utils/format.ts");
  for (const [value, lower, upper] of [[0.5, 0, 1], [-3, 0, 5], [14, -2, 7]]) {
    assert.equal(clampFinite(value, lower, upper), clamp(value, lower, upper));
  }
  assert.equal(clampFinite(NaN, 0, 1), 0);
  assert.equal(clampFinite(Infinity, 0, 1), 0);
  assert.equal(clampFinite(-Infinity, 0.25, 4), 0.25);
  assert.equal(clamp(NaN, 0, 1), NaN, "plain clamp retains previous non-finite behavior");
  assert.equal(clampUpperFirst(2, 4, 1), 1, "Settings retains upper-first inverted-bound behavior");
  assert.equal(clampFinite(2, 4, 1), 1, "media retains upper-first inverted-bound behavior");
  assert.equal(clamp(2, 4, 1), 4, "CatBuddy retains lower-first inverted-bound behavior");
});

test("playlist insertion and library drag reordering retain distinct edge-case behavior", () => {
  const functions = load("src/features/library/library.utils.ts", {
    "../../shared/storage/localStorage": {
      makeLocalId: () => "test",
      readLocalJson: () => [],
      writeLocalJson: () => {}
    },
    "./library.constants": { CODERPIXEL_ARTIST_CHANCE: 0, LIBRARY_ORDER_STORAGE_KEY: "order" }
  });
  const original = ["a", "b", "c"];
  assert.deepEqual(Array.from(functions.reorderIdList(original, "a", "c", "after")), ["b", "c", "a"]);
  assert.deepEqual(Array.from(functions.reorderIdList(original, "c", "a", "before")), ["c", "a", "b"]);
  assert.equal(functions.reorderIdList(original, "a", "absent", "after"), original);
  assert.equal(functions.reorderIdList(original, "a", "a", "after"), original);
  assert.deepEqual(Array.from(functions.insertIdNearTarget(original, "a", "absent", "after")), ["b", "c", "a"]);
  assert.deepEqual(Array.from(functions.insertIdNearTarget(original, "a", "a", "after")), ["b", "c", "a"]);
  assert.deepEqual(Array.from(functions.insertIdNearTarget(original, "d", "b", "before")), ["a", "d", "b", "c"]);
  assert.equal(functions.insertIdNearTarget(original, "", "b", "after"), original);
  assert.deepEqual(original, ["a", "b", "c"], "input is unchanged");
});

test("clamp implementation and library index lookup each have one owner", () => {
  for (const file of [
    "src/CatBuddy.tsx",
    "src/features/settings/settings.shared.tsx",
    "src/features/player/engine/htmlAudioEngine.ts",
    "src/features/player/audio/audioEffectRuntime.ts"
  ]) {
    assert.doesNotMatch(read(file), /function clamp\(/, file);
  }
  const index = read("src/features/search/incrementalLibraryIndex.ts");
  assert.match(index, /function resolveSongIndex\(/);
  assert.equal((index.match(/songs\.findIndex\(song => song\.id === id\)/g) || []).length, 1);
});
