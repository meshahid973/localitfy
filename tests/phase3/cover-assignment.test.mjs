import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createLeastUsedCoverAllocator } = require(path.join(root, "electron", "cover-service.cjs"));

test("bulk cover assignment updates usage counts after each successful write", () => {
  const allocator = createLeastUsedCoverAllocator(["a", "b"], [], () => 0);
  const first = allocator.choose();
  assert.equal(first, "b");
  allocator.record("", first);
  assert.equal(allocator.choose(), "a");
  allocator.record("", "a");
  assert.equal(allocator.choose("a"), "b");
});

test("cover reassignment releases previous usage and avoids current artwork", () => {
  const allocator = createLeastUsedCoverAllocator(["a", "b"], [
    { coverPath: "a" }, { coverPath: "a" }, { coverPath: "b" }
  ], () => 0);
  assert.equal(allocator.choose("a"), "b");
  allocator.record("a", "b");
  assert.equal(allocator.choose("b"), "a");
  assert.equal(createLeastUsedCoverAllocator(["only"], []).choose("only"), "only");
});

test("duplicate cover assets are counted only once", () => {
  const allocator = createLeastUsedCoverAllocator(["a", "a", "b"], [{ coverPath: "b" }], () => 0);
  assert.equal(allocator.choose(), "a");
});
