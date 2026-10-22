const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
// SQLite is built against Electron. Keep the fixture in a subprocess so its DB closes before cleanup on Windows.
if (!process.argv.includes("--fixture")) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-duplicates-"));
  try {
    const result = spawnSync(process.execPath, [__filename, "--fixture", root], { encoding: "utf8", env: process.env });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    process.stdout.write(result.stdout);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
} else {
  const root = process.argv.at(-1);
  const db = require("../electron/db.cjs");
  const Database = require("better-sqlite3");
  const databasePath = path.join(root, "library.sqlite");
  db.initDatabase(databasePath);
  const inspect = new Database(databasePath);
  const add = (id, extra = {}) => db.insertSongs([{ id, filePath: path.join(root, `${id}.mp3`), title: "Song", artist: "A", ...extra }]);
  add("keep", { playCount: 3, lastPlayed: "2026-10-01T00:00:00.000Z" });
  add("copy", { liked: true, playCount: 4, lastPlayed: "2026-10-20T00:00:00.000Z" });
  add("copy-2", { playCount: 1 });
  add("other");
  db.savePlaylists([
    { id: "both", name: "Both", songIds: ["other", "copy", "keep"], createdAt: 1 },
    { id: "only-copy", name: "Only copy", songIds: ["copy-2", "other"], createdAt: 2 }]);
  const event = inspect.prepare(`INSERT INTO play_events (id, sessionId, songId, startedAt, updatedAt, endedAt, msListened, outcome)
    VALUES (?, 's', ?, 1, 2, 2, 1, 'ended')`);
  event.run("e1", "copy"); event.run("e2", "copy-2"); event.run("e3", "keep");
  inspect.prepare("INSERT INTO lyrics_selections (songId, lrclibId, lyricsResult, offsetMs) VALUES ('copy', 7, NULL, 250)").run();

  assert.deepEqual(db.mergeDuplicateSongs([{ keepId: "keep", removeIds: ["copy", "copy-2"] }]), ["copy", "copy-2"]);
  const kept = inspect.prepare("SELECT liked, playCount, lastPlayed FROM songs WHERE id = 'keep'").get();
  assert.deepEqual(kept, { liked: 1, playCount: 8, lastPlayed: "2026-10-20T00:00:00.000Z" });
  assert.deepEqual(inspect.prepare("SELECT id FROM songs ORDER BY id").all().map((row) => row.id), ["keep", "other"]);
  const playlists = Object.fromEntries(db.getPlaylists().map((item) => [item.id, item.songIds]));
  assert.deepEqual(playlists.both, ["other", "keep"], "a playlist holding both copies keeps one entry");
  assert.deepEqual(playlists["only-copy"], ["keep", "other"], "the kept song takes the removed copy's place");
  assert.equal(inspect.prepare("SELECT COUNT(*) AS n FROM play_events WHERE songId = 'keep'").get().n, 3, "history moves instead of cascading away");
  assert.equal(inspect.prepare("SELECT offsetMs FROM lyrics_selections WHERE songId = 'keep'").get().offsetMs, 250);
  assert.throws(() => db.mergeDuplicateSongs([{ keepId: "keep", removeIds: ["other"] }, { keepId: "keep", removeIds: ["gone"] }]), /no longer in the library/);
  assert.ok(inspect.prepare("SELECT 1 FROM songs WHERE id = 'other'").get(), "a failed merge changes nothing");
  inspect.close();
  console.log("[duplicate-merge] likes, plays, playlists, history, lyrics and rollback passed");
}
