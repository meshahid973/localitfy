import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { decodePcmChunk } = require("../../electron/analysis/pcm.cjs");

test("PCM decoder preserves values and computes RMS energy without changing samples", () => {
  const source = Buffer.alloc(16);
  for (const [index, value] of [0.5, -0.5, 1, 0].entries()) source.writeFloatLE(value, index * 4);
  const result = decodePcmChunk(source);
  assert.deepEqual(Array.from(result.samples), [0.5, -0.5, 1, 0]);
  assert.equal(result.squareSum, 1.5);
});

test("unaligned PCM buffers use safe LE decoding", () => {
  const storage = Buffer.alloc(17);
  const source = storage.subarray(1);
  source.writeFloatLE(-0.75, 0);
  source.writeFloatLE(0.25, 4);
  const result = decodePcmChunk(source);
  assert.equal(result.samples[0], -0.75);
  assert.equal(result.samples[1], 0.25);
  assert.equal(result.squareSum, 0.625);
});

test("PCM decoder rejects invalid lengths and non-finite samples", () => {
  assert.throws(() => decodePcmChunk(Buffer.alloc(3)), /Invalid decoded PCM buffer/);
  assert.throws(() => decodePcmChunk(Buffer.alloc(0)), /Invalid decoded PCM buffer/);
  const bad = Buffer.alloc(4);
  bad.writeFloatLE(NaN);
  assert.throws(() => decodePcmChunk(bad), /invalid samples/);
});
