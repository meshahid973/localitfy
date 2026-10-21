"use strict";

const MAX_LYRICS_LENGTH = 250_000;
const OFFSET_LIMIT_SECONDS = 15;

function createLyricsOverridesTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lyrics_overrides (
      songId TEXT PRIMARY KEY,
      lrclibId INTEGER,
      syncedLyrics TEXT,
      plainLyrics TEXT,
      instrumental INTEGER NOT NULL DEFAULT 0,
      offsetSeconds REAL NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL
    );
  `);
}

function readLyricsOverride(db, songId) {
  if (!songId || typeof songId !== "string") return null;
  return db.prepare("SELECT * FROM lyrics_overrides WHERE songId = ?").get(songId) || null;
}

function saveLyricsOverride(db, songId, record) {
  if (!songId || typeof songId !== "string") throw new TypeError("song ID required");
  const lrclibId = Number(record?.id);
  if (!Number.isSafeInteger(lrclibId) || lrclibId <= 0) throw new TypeError("invalid LRCLIB record ID");
  const syncedLyrics = typeof record?.syncedLyrics === "string" ? record.syncedLyrics : "";
  const plainLyrics = typeof record?.plainLyrics === "string" ? record.plainLyrics : "";
  if (syncedLyrics.length > MAX_LYRICS_LENGTH || plainLyrics.length > MAX_LYRICS_LENGTH) {
    throw new TypeError("lyrics record is too large");
  }
  if (!syncedLyrics && !plainLyrics && record?.instrumental !== true) throw new TypeError("record has no lyrics");
  db.prepare(`
    INSERT INTO lyrics_overrides (songId, lrclibId, syncedLyrics, plainLyrics, instrumental, offsetSeconds, updatedAt)
    VALUES (?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(songId) DO UPDATE SET
      lrclibId = excluded.lrclibId,
      syncedLyrics = excluded.syncedLyrics,
      plainLyrics = excluded.plainLyrics,
      instrumental = excluded.instrumental,
      updatedAt = excluded.updatedAt
  `).run(songId, lrclibId, syncedLyrics, plainLyrics, record.instrumental === true ? 1 : 0, Date.now());
  return readLyricsOverride(db, songId);
}

function setLyricsOffset(db, songId, seconds) {
  if (!songId || typeof songId !== "string") throw new TypeError("song ID required");
  const value = Number(seconds);
  if (!Number.isFinite(value)) throw new TypeError("invalid lyrics offset");
  const offset = Math.max(-OFFSET_LIMIT_SECONDS, Math.min(OFFSET_LIMIT_SECONDS, Math.round(value * 10) / 10));
  db.prepare(`
    INSERT INTO lyrics_overrides (songId, offsetSeconds, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(songId) DO UPDATE SET offsetSeconds = excluded.offsetSeconds, updatedAt = excluded.updatedAt
  `).run(songId, offset, Date.now());
  return offset;
}

function clearManualLyrics(db, songId) {
  if (!songId || typeof songId !== "string") return false;
  const row = readLyricsOverride(db, songId);
  if (!row) return false;
  if (row.offsetSeconds === 0) return db.prepare("DELETE FROM lyrics_overrides WHERE songId = ?").run(songId).changes > 0;
  return db.prepare(`
    UPDATE lyrics_overrides SET lrclibId = NULL, syncedLyrics = NULL,
      plainLyrics = NULL, instrumental = 0, updatedAt = ?
    WHERE songId = ?
  `).run(Date.now(), songId).changes > 0;
}

module.exports = {
  createLyricsOverridesTable,
  readLyricsOverride,
  saveLyricsOverride,
  setLyricsOffset,
  clearManualLyrics
};
