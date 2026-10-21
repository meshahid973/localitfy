"use strict";

// Per-song lyrics choices stay separate from app-wide settings and song metadata.
// Song IDs are stable across moved-file relinks, preserving manual matches.
function createLyricsSelectionsTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS lyrics_selections (
      songId TEXT PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
      lrclibId INTEGER,
      lyricsResult TEXT,
      offsetMs INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function readLyricsSelection(database, songId) {
  const row = database.prepare("SELECT lrclibId, lyricsResult, offsetMs FROM lyrics_selections WHERE songId = ?").get(songId);
  if (!row) return { lrclibId: null, result: null, offsetMs: 0 };
  let result = null;
  try { result = row.lyricsResult ? JSON.parse(row.lyricsResult) : null; }
  catch { result = null; }
  return { lrclibId: row.lrclibId ?? null, result, offsetMs: row.offsetMs || 0 };
}

function saveLyricsSelection(database, songId, lrclibId, result) {
  if (!Number.isSafeInteger(lrclibId) || lrclibId <= 0) throw new TypeError("Invalid LRCLIB record ID");
  if (!result || !["synced", "plain", "instrumental"].includes(result.status)) throw new TypeError("Lyrics record has no usable content");
  const encoded = JSON.stringify(result);
  if (encoded.length > 200000) throw new RangeError("Lyrics record is too large");
  database.prepare(`
    INSERT INTO lyrics_selections(songId, lrclibId, lyricsResult)
    VALUES (?, ?, ?)
    ON CONFLICT(songId) DO UPDATE SET lrclibId=excluded.lrclibId, lyricsResult=excluded.lyricsResult
  `).run(songId, lrclibId, encoded);
  return readLyricsSelection(database, songId);
}

function saveLyricsOffset(database, songId, offsetMs) {
  if (!Number.isInteger(offsetMs) || Math.abs(offsetMs) > 30000) throw new RangeError("Lyrics offset must be within 30 seconds");
  database.prepare(`
    INSERT INTO lyrics_selections(songId, offsetMs) VALUES (?, ?)
    ON CONFLICT(songId) DO UPDATE SET offsetMs=excluded.offsetMs
  `).run(songId, offsetMs);
  return readLyricsSelection(database, songId);
}

function clearLyricsSelection(database, songId) {
  database.prepare("UPDATE lyrics_selections SET lrclibId = NULL, lyricsResult = NULL WHERE songId = ?").run(songId);
  return readLyricsSelection(database, songId);
}

module.exports = { createLyricsSelectionsTable, readLyricsSelection, saveLyricsSelection, saveLyricsOffset, clearLyricsSelection };
