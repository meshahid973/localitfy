import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const Database = require("better-sqlite3");
const selections = require(path.join(root, "electron/db/lyrics-selections.cjs"));
const { createLyricsService } = require(path.join(root, "electron/lyrics/service.cjs"));

test("manual lyrics and offset persist by stable song ID, preserve each other, and cascade on delete", () => {
  const db = new Database(":memory:");
  try {
    db.pragma("foreign_keys = ON");
    db.exec("CREATE TABLE songs (id TEXT PRIMARY KEY); INSERT INTO songs(id) VALUES ('song1');");
    selections.createLyricsSelectionsTable(db);
    assert.deepEqual(selections.readLyricsSelection(db, "song1"), { lrclibId: null, result: null, offsetMs: 0 });

    assert.equal(selections.saveLyricsOffset(db, "song1", 750).offsetMs, 750);
    const lyrics = { status: "synced", source: "lrclib", lines: [{ time: 2, text: "Hello" }] };
    const saved = selections.saveLyricsSelection(db, "song1", 42, lyrics);
    assert.equal(saved.offsetMs, 750);
    assert.equal(saved.lrclibId, 42);
    assert.deepEqual(saved.result, lyrics);
    assert.throws(() => selections.saveLyricsOffset(db, "song1", 31000), /within 30 seconds/);
    assert.throws(() => selections.saveLyricsSelection(db, "song1", -3, lyrics), /Invalid LRCLIB/);
    assert.deepEqual(selections.clearLyricsSelection(db, "song1"), { lrclibId: null, result: null, offsetMs: 750 });

    selections.saveLyricsSelection(db, "song1", 42, lyrics);
    db.prepare("DELETE FROM songs WHERE id = ?").run("song1");
    assert.deepEqual(selections.readLyricsSelection(db, "song1"), { lrclibId: null, result: null, offsetMs: 0 });
  } finally { db.close(); }
});

test("LRCLIB manual search returns bounded record summaries and retrieves chosen ID", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-lyrics-choice-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const requested = [];
  const fetchImpl = async url => {
    const parsed = new URL(url);
    requested.push(parsed.pathname);
    if (parsed.pathname.endsWith("/search")) return {
      ok: true, status: 200, json: async () => [
        { id: 42, trackName: "Song", artistName: "Artist", albumName: "Album", duration: 150, syncedLyrics: "[00:01.00]A" },
        { id: 43, trackName: "Empty", artistName: "Artist" }
      ]
    };
    if (parsed.pathname.endsWith("/get/42")) return {
      ok: true, status: 200,
      json: async () => ({ id: 42, syncedLyrics: "[00:01.00]A", plainLyrics: "A" })
    };
    return { ok: false, status: 404 };
  };
  const service = createLyricsService({ cacheDir: dir, userAgent: "test", fetchImpl, requestSpacingMs: 0 });
  const results = await service.searchManual("Song Artist");
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], { id: 42, title: "Song", artist: "Artist", album: "Album", duration: 150, synced: true, instrumental: false });
  const chosen = await service.getManual(42);
  assert.equal(chosen.status, "synced");
  assert.equal(chosen.lines[0].time, 1);
  assert.deepEqual(requested, ["/api/search", "/api/get/42"]);
  await assert.rejects(service.getManual(-1), /Invalid LRCLIB/);
});
