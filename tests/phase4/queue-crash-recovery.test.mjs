import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("player runtime saves queue, shuffle and repeat with stable keys", () => {
  const player = read("src/features/player/usePlayerRuntime.ts");
  const keys = read("src/features/library/library.constants.ts");
  for (const name of ["QUEUE_STORAGE_KEY", "QUEUE_HISTORY_STORAGE_KEY", "SHUFFLE_STORAGE_KEY", "REPEAT_MODE_STORAGE_KEY"]) {
    assert.match(keys, new RegExp("export const " + name));
    assert.ok(player.includes(name), name);
  }
  assert.match(player, /readLocalJson<boolean>\(SHUFFLE_STORAGE_KEY, false\)/);
  assert.match(player, /writeLocalJson\(SHUFFLE_STORAGE_KEY, isShuffle\)/);
  assert.match(player, /writeLocalJson\(REPEAT_MODE_STORAGE_KEY, repeatMode\)/);
});

test("only remembered startup song uses stored playback position", () => {
  const app = read("src/App.tsx");
  assert.match(app, /nextSettings\.rememberLastSong && nextSettings\.rememberPlaybackPosition/);
  assert.match(app, /startupResumePositionRef\.current\?\.songId !== songId/);
  assert.match(app, /pending\?\.songId === currentSong\.id/);
  assert.match(app, /audio\.currentTime = seekTo/);
});

test("bounded checkpoints use persisted SQLite patch but never rerender the library", () => {
  const app = read("src/App.tsx");
  assert.match(app, /wallClock - positionSaveRef\.current >= 5000/);
  assert.match(app, /window\.localitfy\.patchSong\(currentSong\.id, \{ playbackPosition: Math\.floor\(nextTime\) \}\)/);
  assert.match(app, /settings\.rememberPlaybackPosition/);
});
