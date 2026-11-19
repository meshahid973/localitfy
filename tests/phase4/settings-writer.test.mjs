import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const source = fs.readFileSync("src/features/settings/settingsWriter.ts", "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const exports = {};
runInNewContext(outputText, { exports, structuredClone });
const { createSettingsWriter } = exports;

test("settings writes are ordered and take immutable snapshots", async () => {
  const writes = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const write = createSettingsWriter(async value => {
    writes.push(value);
    if (writes.length === 1) await gate;
  });
  const first = { volume: 0.2, layout: ["home"] };
  const a = write(first);
  const b = write({ volume: 0.8, layout: ["library"] });
  first.layout.push("changed");
  await Promise.resolve();
  assert.deepEqual(writes, [{ volume: 0.2, layout: ["home"] }]);
  release();
  await Promise.all([a, b]);
  assert.deepEqual(writes, [{ volume: 0.2, layout: ["home"] }, { volume: 0.8, layout: ["library"] }]);
});

test("a failed settings write does not poison subsequent saves", async () => {
  const writes = [];
  const write = createSettingsWriter(async value => {
    writes.push(value);
    if (value === 1) throw new Error("disk unavailable");
  });
  const failed = write(1);
  const saved = write(2);
  await assert.rejects(failed, /disk unavailable/);
  await saved;
  assert.deepEqual(writes, [1, 2]);
});
