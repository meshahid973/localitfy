const OUTCOMES = new Set(["active", "ended", "replaced", "transition", "error", "interrupted"]);
const MAX_EVENT_MS = 7 * 24 * 60 * 60 * 1000;

function createPlayEventsTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS play_events (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      songId TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      startedAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      endedAt INTEGER,
      msListened INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL DEFAULT 'active',
      contextType TEXT NOT NULL DEFAULT 'library',
      contextId TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_play_events_song_time ON play_events(songId, startedAt);
    CREATE INDEX IF NOT EXISTS idx_play_events_session_time ON play_events(sessionId, startedAt);
  `);
}

function normalizePlayEvent(value, now = Date.now()) {
  if (!value || typeof value !== "object") return null;
  const identifier = (text) => typeof text === "string" && text.length > 0 && text.length <= 200;
  if (![value.id, value.sessionId, value.songId].every(identifier)) return null;
  const { startedAt, updatedAt, msListened, outcome, contextType, contextId } = value;
  if (![startedAt, updatedAt, msListened].every(Number.isSafeInteger)) return null;
  if (startedAt <= 0 || updatedAt < startedAt || updatedAt > now + 60_000) return null;
  if (updatedAt - startedAt > MAX_EVENT_MS || msListened < 0 || msListened > updatedAt - startedAt) return null;
  if (!OUTCOMES.has(outcome) || !["library", "playlist"].includes(contextType)) return null;
  if (contextType === "playlist" && !identifier(contextId)) return null;
  if (value.endedAt !== (outcome === "active" ? null : updatedAt)) return null;
  return { id: value.id, sessionId: value.sessionId, songId: value.songId, startedAt, updatedAt,
    endedAt: value.endedAt, msListened, outcome, contextType, contextId: contextType === "playlist" ? contextId : null };
}

function recordPlayEvent(database, payload) {
  const event = normalizePlayEvent(payload);
  if (!event) return false;
  // Deleted songs must not be recreated by a late renderer checkpoint.
  if (!database.prepare("SELECT 1 FROM songs WHERE id = ?").get(event.songId)) return false;
  const result = database.prepare(`
    INSERT INTO play_events (id, sessionId, songId, startedAt, updatedAt, endedAt, msListened, outcome, contextType, contextId)
    VALUES (@id, @sessionId, @songId, @startedAt, @updatedAt, @endedAt, @msListened, @outcome, @contextType, @contextId)
    ON CONFLICT(id) DO UPDATE SET updatedAt = excluded.updatedAt, endedAt = excluded.endedAt,
      msListened = excluded.msListened, outcome = excluded.outcome
    WHERE play_events.endedAt IS NULL AND excluded.updatedAt >= play_events.updatedAt
      AND excluded.msListened >= play_events.msListened AND excluded.songId = play_events.songId
      AND excluded.sessionId = play_events.sessionId AND excluded.startedAt = play_events.startedAt
  `).run(event);
  return result.changes > 0;
}

/** Plays last updated before `before` and started at or after `since`, oldest first. */
function listPlayEvents(database, { before = Date.now(), since = 0 } = {}) {
  return database.prepare("SELECT id, songId, startedAt, msListened FROM play_events WHERE updatedAt < ? AND startedAt >= ? ORDER BY startedAt")
    .all(before, since);
}

module.exports = { createPlayEventsTable, normalizePlayEvent, recordPlayEvent, listPlayEvents };
