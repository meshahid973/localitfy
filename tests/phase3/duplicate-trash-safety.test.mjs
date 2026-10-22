import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const { removableFiles } = require(path.join(root, "electron/ipc/library-duplicates.cjs"));

test("never trash the path of a kept song, even if a duplicate row is removed", () => {
  const songs = [
    { id: "keep", filePath: "/music/record.mp3" },
    { id: "duplicate", filePath: "/music/record.mp3" },
    { id: "copy", filePath: "/music/copy.mp3" },
    { id: "unrelated", filePath: "/music/unrelated.mp3" }
  ];
  assert.deepEqual(removableFiles(songs, ["duplicate", "copy"]), {
    files: ["/music/copy.mp3"], skippedShared: 1
  });
});

test("duplicate audio paths are only moved to trash once", () => {
  const songs = [
    { id: "keep", filePath: "/music/original.mp3" },
    { id: "a", filePath: "/music/extra.mp3" },
    { id: "b", filePath: "/music/extra.mp3" }
  ];
  assert.deepEqual(removableFiles(songs, ["a", "b"]), {
    files: ["/music/extra.mp3"], skippedShared: 1
  });
});

test("metadata-only duplicate groups require explicit user selection", () => {
  const source = fs.readFileSync(path.join(root, "src/features/library/duplicates/duplicatePlan.ts"), "utf8");
  const exports = {};
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function("exports", compiled)(exports);
  const make = (id, confidence) => ({
    id, kind: "track", recommendedCopy: "copy",
    groups: [{ keepId: id, confidence, songs: [{ id, copyKey: "copy" }] }]
  });
  const choices = exports.defaultChoices([make("metadata", "metadata"), make("audio", "same-audio")]);
  assert.equal(choices.has("metadata"), false);
  assert.equal(choices.has("audio"), true);
});
