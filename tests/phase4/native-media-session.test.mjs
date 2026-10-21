import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("native media session lifecycle belongs to the player feature", () => {
  const app = read("src/App.tsx");
  const hook = read("src/features/player/useNativeMediaSession.ts");
  assert.match(app, /useNativeMediaSession\(\{/);
  assert.doesNotMatch(app, /navigator\.mediaSession\.setActionHandler/);
  assert.match(hook, /navigator\.mediaSession\.metadata/);
  assert.match(hook, /navigator\.mediaSession\.setPositionState/);
  for (const action of ["play", "pause", "stop", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"]) {
    assert.ok(hook.includes('setActionHandler("' + action + '"'), action);
  }
  assert.match(hook, /actionsRef\.current = \{/);
  assert.match(hook, /MediaMetadata/);
});
