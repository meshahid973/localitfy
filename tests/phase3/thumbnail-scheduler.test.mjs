import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createThumbnailScheduler } = require(path.join(root, "electron/runtime/thumbnail-scheduler.cjs"));

function makeScheduler(processFile) {
  let id = 0;
  const timers = new Map();
  const scheduler = createThumbnailScheduler({
    processFile,
    setTimer: (callback) => { timers.set(++id, callback); return id; },
    clearTimer: (key) => timers.delete(key)
  });
  const flush = () => {
    const [key, callback] = timers.entries().next().value ?? [];
    if (!callback) return false;
    timers.delete(key);
    callback();
    return true;
  };
  return { scheduler, timers, flush };
}

test("background thumbnails dedupe and process only one file per timer turn", () => {
  const processed = [];
  const { scheduler, timers, flush } = makeScheduler(file => processed.push(file));
  assert.equal(scheduler.enqueue("artwork-a"), true);
  assert.equal(scheduler.enqueue("artwork-a"), false);
  assert.equal(scheduler.enqueue("artwork-b"), true);
  assert.equal(scheduler.enqueue("artwork-c"), true);
  assert.equal(timers.size, 1, "one timer for all pending work");
  assert.equal(scheduler.size, 3);
  assert.equal(flush(), true);
  assert.deepEqual(processed, ["artwork-a"]);
  assert.equal(timers.size, 1);
  assert.equal(flush(), true);
  assert.deepEqual(processed, ["artwork-a", "artwork-b"]);
  assert.equal(flush(), true);
  assert.deepEqual(processed, ["artwork-a", "artwork-b", "artwork-c"]);
  assert.equal(timers.size, 0);
  assert.equal(scheduler.size, 0);
});

test("clearing cache cancels pending thumbnail timer and work", () => {
  const processed = [];
  const { scheduler, timers, flush } = makeScheduler(file => processed.push(file));
  scheduler.enqueue("a");
  scheduler.enqueue("b");
  scheduler.clear();
  assert.equal(scheduler.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(flush(), false);
  assert.deepEqual(processed, []);
});

test("one thumbnail conversion error cannot permanently stop the queue", () => {
  const errors = [];
  const timers = new Map();
  let id = 0;
  const completed = [];
  const scheduler = createThumbnailScheduler({
    processFile: file => { if (file === "bad") throw new Error("decode"); completed.push(file); },
    onError: error => errors.push(error.message),
    setTimer: callback => { timers.set(++id, callback); return id; },
    clearTimer: key => timers.delete(key)
  });
  scheduler.enqueue("bad");
  scheduler.enqueue("good");
  while (timers.size) {
    const [key, callback] = timers.entries().next().value;
    timers.delete(key);
    callback();
  }
  assert.deepEqual(errors, ["decode"]);
  assert.deepEqual(completed, ["good"]);
});

test("visible artwork is processed before background warmup and existing jobs can be promoted", () => {
  const completed = [];
  const { scheduler, flush } = makeScheduler(file => completed.push(file));
  scheduler.enqueue("warm-a", { lowPriority: true });
  scheduler.enqueue("warm-b", { lowPriority: true });
  scheduler.enqueue("visible-now");
  scheduler.enqueue("warm-b");
  flush();
  flush();
  flush();
  assert.deepEqual(completed, ["visible-now", "warm-b", "warm-a"]);
});
