import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const input = fs.readFileSync(path.join(root, "src/features/player/engine/playbackTransitionCoordinator.ts"), "utf8");
const js = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { PlaybackTransitionCoordinator } = mod.exports;

test("play/pause/seeking and generation ownership", () => {
  const m = new PlaybackTransitionCoordinator();
  const a = m.requestPlay("a");
  m.ready(); m.playing(); m.seekStarted();
  assert.equal(m.snapshot().phase, "seeking");
  m.seekFinished();
  assert.equal(m.snapshot().phase, "playing");
  m.requestPause();
  assert.equal(m.snapshot().phase, "paused");
  assert.equal(m.isCurrent(a, "a"), false, "pausing invalidates a pending play");
  m.requestPlay("b");
  assert.equal(m.isCurrent(a, "a"), false);
  m.failed();
  assert.equal(m.snapshot().phase, "error");
});

test("outgoing crossfade pause/end cannot skip or pause next track", () => {
  const m = new PlaybackTransitionCoordinator();
  m.requestPlay("a"); m.playing();
  const v = m.snapshot().generation;
  assert.equal(m.crossfadeStarted("b"), true);
  assert.equal(m.paused(), false);
  assert.equal(m.ended(), false);
  assert.equal(m.crossfadeStarted("c"), false);
  assert.equal(m.isCurrentCrossfade("b", v), true);
  assert.equal(m.crossfadeFinished("c"), false);
  assert.equal(m.crossfadeFinished("b"), true);
  assert.equal(m.crossfadeFinished("b"), false);
  assert.equal(m.snapshot().sourceId, "b");
  assert.equal(m.snapshot().phase, "playing");
});

test("cancelled handoff restores previous phase", () => {
  const m = new PlaybackTransitionCoordinator();
  m.requestPlay("a"); m.playing(); m.crossfadeStarted("b");
  m.crossfadeCancelled();
  assert.equal(m.snapshot().phase, "playing");
  assert.equal(m.ended(), true);
  m.reset();
  assert.equal(m.snapshot().phase, "idle");
});

test("pause, track change and errors invalidate outstanding play promises", () => {
  const m = new PlaybackTransitionCoordinator();
  const first = m.requestPlay("a");
  m.requestPause();
  assert.equal(m.isCurrent(first, "a"), false);
  const resumed = m.requestPlay("a");
  assert.notEqual(resumed, first);
  assert.equal(m.isCurrent(resumed, "a"), true);
  const next = m.requestPlay("b");
  assert.equal(m.isCurrent(resumed, "a"), false);
  assert.equal(m.isCurrent(next, "b"), true);
  m.failed();
  assert.equal(m.isCurrent(next, "b"), false);
  assert.equal(m.isCurrent(m.requestPlay("b"), "b"), true);
});

test("cancel crossfade before pausing so the hidden next track cannot keep playing", () => {
  const m = new PlaybackTransitionCoordinator();
  const current = m.requestPlay("a");
  m.playing();
  m.crossfadeStarted("b");
  m.crossfadeCancelled();
  m.requestPause();
  assert.equal(m.snapshot().phase, "paused");
  assert.equal(m.isCurrent(current, "a"), false);
  assert.equal(m.snapshot().targetId, "");
});
