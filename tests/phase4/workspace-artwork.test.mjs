import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { runInNewContext } from "node:vm";
const exports = {};
runInNewContext(ts.transpileModule(fs.readFileSync("src/features/covers/workspaceArtwork.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const resolve = (track,page) => Array.from(exports.resolveWorkspaceArtwork(track,page));
test("shell artwork gives current song priority and falls back without duplicate reads",()=>{
  assert.deepEqual(resolve(["track"],["track","page"]),["track","page"]);
  assert.deepEqual(resolve([],["page"]),["page"]);
  assert.deepEqual(resolve([""],[]),[]);
  assert.deepEqual(resolve(["a","b","c","d"],["a","e","f","g","h"]),["a","b","c","e","f","g"]);
  assert.equal(resolve(["a","b","c"],["d","e","f","g"]).length,6);
});
