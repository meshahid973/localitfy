import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Electron bridge has a dedicated strict TypeScript contract", () => {
  const declarations = read("src/localitfy.d.ts");
  const config = JSON.parse(read("tsconfig.bridge.json"));
  const pkg = JSON.parse(read("package.json"));

  assert.equal(config.compilerOptions.strict, true);
  assert.match(pkg.scripts["bridge:check"], /bridge:typecheck/);
  assert.match(declarations, /import type \{ Song \}/);
  assert.match(declarations, /import type \{ Settings \}/);
  assert.doesNotMatch(declarations, /songs\??: any\[\]/);
  assert.doesNotMatch(declarations, /patchSong: \(id: string, patch: any\)/);
  assert.doesNotMatch(declarations, /diagnostics\?: Record<string, any>/);
});

test("album folder preview does not redeclare cover fields", () => {
  const declarations = read("src/localitfy.d.ts");
  const block = declarations.match(/type LocalitfyAlbumFolderPreview = \{([\s\S]*?)\n  \};/)?.[1] || "";
  assert.equal((block.match(/\bcoverPath\?:/g) || []).length, 1);
  assert.equal((block.match(/\bcoverSource\?:/g) || []).length, 1);
});
