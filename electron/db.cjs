const Database = require("better-sqlite3");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = 13;
const BACKUP_KEEP_LIMIT = 8;

let db = null;
let dbFilePath = "";
let lastMigrationReport = {
  ok: true,
  version: SCHEMA_VERSION,
  previousVersion: 0,
  migrated: false,
  backupPath: "",
  repairedRows: 0,
  addedColumns: [],
  errors: []
};

const SONG_COLUMNS = {
  id: "TEXT PRIMARY KEY",
  title: "TEXT NOT NULL DEFAULT 'untitled'",
  artist: "TEXT NOT NULL DEFAULT 'unknown artist'",
  album: "TEXT NOT NULL DEFAULT 'local files'",
  filePath: "TEXT UNIQUE NOT NULL",
  coverPath: "TEXT",
  coverSource: "TEXT NOT NULL DEFAULT 'none'",
  coverUpdatedAt: "TEXT",
  liked: "INTEGER NOT NULL DEFAULT 0",
  playCount: "INTEGER NOT NULL DEFAULT 0",
  duration: "REAL NOT NULL DEFAULT 0",
  durationMs: "REAL NOT NULL DEFAULT 0",
  dateAdded: "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
  lastPlayed: "TEXT",
  volumeGain: "REAL NOT NULL DEFAULT 1",
  playbackPosition: "REAL NOT NULL DEFAULT 0",
  customVolume: "REAL NOT NULL DEFAULT 1",
  sourceType: "TEXT NOT NULL DEFAULT 'local'",
  sourceTrackId: "TEXT",
  sourceUrl: "TEXT",
  sourceProvider: "TEXT",
  sourceProviderUrl: "TEXT",
  sourceMatchScore: "REAL NOT NULL DEFAULT 0"
};

const SETTINGS_COLUMNS = {
  key: "TEXT PRIMARY KEY",
  value: "TEXT NOT NULL"
};

const PLAYLIST_COLUMNS = {
  id: "TEXT PRIMARY KEY",
  name: "TEXT NOT NULL DEFAULT 'playlist'",
  createdAt: "INTEGER NOT NULL DEFAULT 0",
  sortOrder: "INTEGER NOT NULL DEFAULT 0"
};

const PLAYLIST_SONG_COLUMNS = {
  playlistId: "TEXT NOT NULL",
  songId: "TEXT NOT NULL",
  position: "INTEGER NOT NULL DEFAULT 0",
  addedAt: "INTEGER NOT NULL DEFAULT 0"
};

function ensureDb() {
  if (!db) {
    throw new Error("database is not initialized yet");
  }
  return db;
}

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function tableExists(database, tableName) {
  try {
    return Boolean(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(tableName)
    );
  } catch {
    return false;
  }
}

function getTableColumns(database, tableName) {
  if (!tableExists(database, tableName)) return [];
  try {
    return database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => row.name);
  } catch {
    return [];
  }
}

function createMetaTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS database_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      migratedAt TEXT NOT NULL,
      appVersion TEXT
    );
  `);
}

function getStoredSchemaVersion(database) {
  try {
    if (tableExists(database, "database_version")) {
      const row = database.prepare("SELECT version FROM database_version WHERE id = 1").get();
      if (row && Number.isFinite(Number(row.version))) return Number(row.version);
    }
  } catch {
    // ignore old/corrupt version table and rebuild below
  }

  try {
    if (tableExists(database, "schema_meta")) {
      const row = database.prepare("SELECT value FROM schema_meta WHERE key = 'schemaVersion'").get();
      const version = Number(row?.value || 0);
      if (Number.isFinite(version)) return version;
    }
  } catch {
    // ignore
  }

  return 0;
}

function setStoredSchemaVersion(database, version = SCHEMA_VERSION) {
  const now = new Date().toISOString();
  database
    .prepare(`
      INSERT INTO schema_meta (key, value)
      VALUES ('schemaVersion', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(String(version));

  database
    .prepare(`
      INSERT INTO database_version (id, version, migratedAt, appVersion)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        version = excluded.version,
        migratedAt = excluded.migratedAt,
        appVersion = excluded.appVersion
    `)
    .run(version, now, "0.2.9");
}

function createSongsTable(database) {
  const columnSql = Object.entries(SONG_COLUMNS)
    .map(([name, definition]) => `${name} ${definition}`)
    .join(",\n      ");

  database.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      ${columnSql}
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_filePath ON songs(filePath);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_lastPlayed ON songs(lastPlayed);
    CREATE INDEX IF NOT EXISTS idx_songs_sourceType ON songs(sourceType);
    CREATE INDEX IF NOT EXISTS idx_songs_sourceTrackId ON songs(sourceTrackId);
    CREATE INDEX IF NOT EXISTS idx_songs_coverSource ON songs(coverSource);
  `);
}

function createSettingsTable(database) {
  const columnSql = Object.entries(SETTINGS_COLUMNS)
    .map(([name, definition]) => `${name} ${definition}`)
    .join(",\n      ");

  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      ${columnSql}
    );
  `);
}

function createPlaylistsTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'playlist',
      createdAt INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      playlistId TEXT NOT NULL,
      songId TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      addedAt INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playlistId, songId)
    );

    CREATE INDEX IF NOT EXISTS idx_playlists_sortOrder ON playlists(sortOrder);
    CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlistId ON playlist_songs(playlistId, position);
    CREATE INDEX IF NOT EXISTS idx_playlist_songs_songId ON playlist_songs(songId);
  `);
}

function pruneOldBackups(databasePath) {
  try {
    const dir = path.dirname(databasePath);
    const base = path.basename(databasePath);
    const backups = fs
      .readdirSync(dir)
      .filter((name) => name.startsWith(`${base}.backup-`) && name.endsWith(".sqlite"))
      .map((name) => ({ name, full: path.join(dir, name), time: fs.statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    for (const item of backups.slice(BACKUP_KEEP_LIMIT)) {
      fs.rmSync(item.full, { force: true });
    }
  } catch {
    // backup cleanup must never block app launch
  }
}

function backupDatabase(reason = "manual") {
  if (!dbFilePath || !fs.existsSync(dbFilePath)) return "";

  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${dbFilePath}.backup-${stamp}-${reason}.sqlite`;
    fs.copyFileSync(dbFilePath, backupPath);
    pruneOldBackups(dbFilePath);
    return backupPath;
  } catch (error) {
    lastMigrationReport.errors.push(`backup failed: ${error?.message || error}`);
    return "";
  }
}

function asText(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asClampedNumber(value, fallback, min, max) {
  return Math.max(min, Math.min(max, asNumber(value, fallback)));
}

function asBoolInt(value) {
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

function normalizeOldSong(row) {
  const filePath = asText(row?.filePath ?? row?.file_path ?? row?.path ?? row?.url, "");
  if (!filePath) return null;

  const rawDuration = Math.max(0, asNumber(row?.duration, 0));
  const rawDurationMs = Math.max(0, asNumber(row?.durationMs ?? row?.duration_ms, rawDuration > 0 ? rawDuration * 1000 : 0));
  const normalizedDuration = rawDuration > 0 ? rawDuration : rawDurationMs > 0 ? rawDurationMs / 1000 : 0;
  const normalizedDurationMs = rawDurationMs > 0 ? rawDurationMs : normalizedDuration > 0 ? normalizedDuration * 1000 : 0;
  const normalizedCoverPath = asText(row?.coverPath ?? row?.cover_path ?? row?.cover, "") || null;

  return {
    id: asText(row?.id, crypto.randomUUID()),
    title: asText(row?.title ?? row?.name, path.parse(filePath).name || "untitled"),
    artist: asText(row?.artist, "unknown artist"),
    album: asText(row?.album, "local files"),
    filePath,
    coverPath: normalizedCoverPath,
    coverSource: asText(row?.coverSource ?? row?.cover_source, normalizedCoverPath ? "unknown" : "none"),
    coverUpdatedAt: asText(row?.coverUpdatedAt ?? row?.cover_updated_at, "") || null,
    liked: asBoolInt(row?.liked),
    playCount: Math.max(0, Math.floor(asNumber(row?.playCount ?? row?.play_count, 0))),
    duration: normalizedDuration,
    durationMs: normalizedDurationMs,
    dateAdded: asText(row?.dateAdded ?? row?.date_added, new Date().toISOString()),
    lastPlayed: asText(row?.lastPlayed ?? row?.last_played, "") || null,
    volumeGain: asClampedNumber(row?.volumeGain ?? row?.volume_gain, 1, 0.2, 3),
    playbackPosition: Math.max(0, asNumber(row?.playbackPosition ?? row?.playback_position, 0)),
    customVolume: asClampedNumber(row?.customVolume ?? row?.custom_volume, 1, 0, 1),
    sourceType: asText(row?.sourceType ?? row?.source_type, "local"),
    sourceTrackId: asText(row?.sourceTrackId ?? row?.source_track_id, "") || null,
    sourceUrl: asText(row?.sourceUrl ?? row?.source_url, "") || null,
    sourceProvider: asText(row?.sourceProvider ?? row?.source_provider, "") || null,
    sourceProviderUrl: asText(row?.sourceProviderUrl ?? row?.source_provider_url, "") || null,
    sourceMatchScore: Math.max(0, asNumber(row?.sourceMatchScore ?? row?.source_match_score, 0))
  };
}

function normalizePlaylist(input, fallbackIndex = 0) {
  if (!input || typeof input !== "object") return null;

  const rawId = asText(input.id, "");
  const id = rawId || `playlist_${Date.now().toString(36)}_${fallbackIndex.toString(36)}`;
  const name = asText(input.name, `playlist ${fallbackIndex + 1}`).slice(0, 120);
  const createdAtNumber = Math.floor(asNumber(input.createdAt, Date.now()));
  const createdAt = createdAtNumber > 0 ? createdAtNumber : Date.now();
  const rawSongIds = Array.isArray(input.songIds) ? input.songIds : [];
  const seenSongIds = new Set();
  const songIds = [];

  for (const songId of rawSongIds) {
    const cleanId = asText(songId, "");
    if (!cleanId || seenSongIds.has(cleanId)) continue;

    seenSongIds.add(cleanId);
    songIds.push(cleanId);
  }

  return {
    id,
    name,
    songIds,
    createdAt,
    sortOrder: Math.max(0, Math.floor(asNumber(input.sortOrder, fallbackIndex)))
  };
}

function rowToPlaylist(row, songIds = []) {
  const playlist = normalizePlaylist(
    {
      id: row?.id,
      name: row?.name,
      createdAt: row?.createdAt,
      sortOrder: row?.sortOrder,
      songIds
    },
    Math.max(0, Math.floor(asNumber(row?.sortOrder, 0)))
  );

  if (!playlist) return null;

  return {
    id: playlist.id,
    name: playlist.name,
    songIds: playlist.songIds,
    createdAt: playlist.createdAt
  };
}

function addMissingColumns(database, tableName, columnMap) {
  const existing = new Set(getTableColumns(database, tableName));
  const added = [];

  for (const [name, definition] of Object.entries(columnMap)) {
    if (existing.has(name)) continue;

    try {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${definition}`);
      added.push(name);
    } catch (error) {
      // SQLite cannot add every PRIMARY/UNIQUE column after creation.
      // If this happens, the table-rebuild path handles it.
      lastMigrationReport.errors.push(`add ${tableName}.${name} failed: ${error?.message || error}`);
    }
  }

  return added;
}

function rebuildSongsTable(database) {
  const oldTable = `songs_old_${Date.now()}`;
  database.exec(`ALTER TABLE songs RENAME TO ${oldTable}`);
  createSongsTable(database);

  const rows = database.prepare(`SELECT * FROM ${oldTable}`).all();
  const insert = database.prepare(`
    INSERT OR IGNORE INTO songs (
      id, title, artist, album, filePath, coverPath, coverSource, coverUpdatedAt, liked, playCount,
      duration, durationMs, dateAdded, lastPlayed, volumeGain, playbackPosition, customVolume,
      sourceType, sourceTrackId, sourceUrl, sourceProvider, sourceProviderUrl, sourceMatchScore
    ) VALUES (
      @id, @title, @artist, @album, @filePath, @coverPath, @coverSource, @coverUpdatedAt, @liked, @playCount,
      @duration, @durationMs, @dateAdded, @lastPlayed, @volumeGain, @playbackPosition, @customVolume,
      @sourceType, @sourceTrackId, @sourceUrl, @sourceProvider, @sourceProviderUrl, @sourceMatchScore
    )
  `);

  let repaired = 0;
  for (const row of rows) {
    const song = normalizeOldSong(row);
    if (!song) {
      repaired += 1;
      continue;
    }

    try {
      insert.run(song);
    } catch {
      repaired += 1;
    }
  }

  database.exec(`DROP TABLE IF EXISTS ${oldTable}`);
  return repaired;
}

function repairBrokenRows(database) {
  let repaired = 0;

  try {
    const badPathRows = database
      .prepare("SELECT id FROM songs WHERE filePath IS NULL OR TRIM(filePath) = ''")
      .all();

    if (badPathRows.length) {
      database.prepare("DELETE FROM songs WHERE filePath IS NULL OR TRIM(filePath) = ''").run();
      repaired += badPathRows.length;
    }
  } catch {
    // ignore repair errors; later queries are also guarded
  }

  const rows = safeAll(database, "SELECT rowid, * FROM songs");
  const update = database.prepare(`
    UPDATE songs SET
      id = @id,
      title = @title,
      artist = @artist,
      album = @album,
      coverPath = @coverPath,
      coverSource = @coverSource,
      coverUpdatedAt = @coverUpdatedAt,
      liked = @liked,
      playCount = @playCount,
      duration = @duration,
      durationMs = @durationMs,
      dateAdded = @dateAdded,
      lastPlayed = @lastPlayed,
      volumeGain = @volumeGain,
      playbackPosition = @playbackPosition,
      customVolume = @customVolume,
      sourceType = @sourceType,
      sourceTrackId = @sourceTrackId,
      sourceUrl = @sourceUrl,
      sourceProvider = @sourceProvider,
      sourceProviderUrl = @sourceProviderUrl,
      sourceMatchScore = @sourceMatchScore
    WHERE rowid = @rowid
  `);

  for (const row of rows) {
    const song = normalizeOldSong(row);
    if (!song) continue;

    const normalized = { ...song, rowid: row.rowid };
    const changed =
      row.id !== normalized.id ||
      row.title !== normalized.title ||
      row.artist !== normalized.artist ||
      row.album !== normalized.album ||
      String(row.coverPath || "") !== String(normalized.coverPath || "") ||
      String(row.coverSource || "") !== String(normalized.coverSource || "") ||
      String(row.coverUpdatedAt || "") !== String(normalized.coverUpdatedAt || "") ||
      Number(row.liked) !== normalized.liked ||
      Number(row.playCount) !== normalized.playCount ||
      Number(row.duration) !== normalized.duration ||
      Number(row.durationMs || 0) !== Number(normalized.durationMs || 0) ||
      Number(row.volumeGain) !== normalized.volumeGain ||
      Number(row.playbackPosition) !== normalized.playbackPosition ||
      Number(row.customVolume) !== normalized.customVolume ||
      String(row.sourceType || "local") !== String(normalized.sourceType || "local") ||
      String(row.sourceTrackId || "") !== String(normalized.sourceTrackId || "") ||
      String(row.sourceUrl || "") !== String(normalized.sourceUrl || "") ||
      String(row.sourceProvider || "") !== String(normalized.sourceProvider || "") ||
      String(row.sourceProviderUrl || "") !== String(normalized.sourceProviderUrl || "") ||
      Number(row.sourceMatchScore || 0) !== Number(normalized.sourceMatchScore || 0);

    if (!changed) continue;

    try {
      update.run(normalized);
      repaired += 1;
    } catch {
      repaired += 1;
    }
  }

  return repaired;
}

function migrateSongsTable(database) {
  if (!tableExists(database, "songs")) {
    createSongsTable(database);
    return { rebuilt: false, addedColumns: [] };
  }

  const columns = getTableColumns(database, "songs");
  const mustRebuild =
    !columns.includes("id") ||
    !columns.includes("filePath") ||
    columns.includes("file_path") ||
    columns.includes("path");

  if (mustRebuild) {
    const repairedRows = rebuildSongsTable(database);
    return { rebuilt: true, repairedRows, addedColumns: [] };
  }

  const addedColumns = addMissingColumns(database, "songs", SONG_COLUMNS);

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_filePath ON songs(filePath);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_lastPlayed ON songs(lastPlayed);
    CREATE INDEX IF NOT EXISTS idx_songs_sourceType ON songs(sourceType);
    CREATE INDEX IF NOT EXISTS idx_songs_sourceTrackId ON songs(sourceTrackId);
    CREATE INDEX IF NOT EXISTS idx_songs_coverSource ON songs(coverSource);
  `);

  return { rebuilt: false, addedColumns };
}

function migrateSettingsTable(database) {
  if (!tableExists(database, "settings")) {
    createSettingsTable(database);
    return [];
  }

  const addedColumns = addMissingColumns(database, "settings", SETTINGS_COLUMNS);

  // v0.3.1 cleanup: remove an old saved setting that no longer has UI.
  try {
    database.prepare("DELETE FROM settings WHERE key = ?").run("showMiniPlayer");
  } catch {
    // non-critical cleanup only
  }

  return addedColumns;
}

function migratePlaylistsTables(database) {
  createPlaylistsTables(database);

  const playlistAdded = addMissingColumns(database, "playlists", PLAYLIST_COLUMNS).map((name) => `playlists.${name}`);
  const playlistSongAdded = addMissingColumns(database, "playlist_songs", PLAYLIST_SONG_COLUMNS).map((name) => `playlist_songs.${name}`);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_playlists_sortOrder ON playlists(sortOrder);
    CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlistId ON playlist_songs(playlistId, position);
    CREATE INDEX IF NOT EXISTS idx_playlist_songs_songId ON playlist_songs(songId);
  `);

  return [...playlistAdded, ...playlistSongAdded];
}

function runMigrations(database) {
  createMetaTables(database);

  const previousVersion = getStoredSchemaVersion(database);
  const shouldBackup = previousVersion !== SCHEMA_VERSION || !tableExists(database, "songs") || !tableExists(database, "settings") || !tableExists(database, "playlists") || !tableExists(database, "playlist_songs");
  const backupPath = shouldBackup ? backupDatabase("migration") : "";

  lastMigrationReport = {
    ok: true,
    version: SCHEMA_VERSION,
    previousVersion,
    migrated: shouldBackup || previousVersion !== SCHEMA_VERSION,
    backupPath,
    repairedRows: 0,
    addedColumns: [],
    errors: []
  };

  const tx = database.transaction(() => {
    const songMigration = migrateSongsTable(database);
    const settingsAdded = migrateSettingsTable(database);
    const playlistAdded = migratePlaylistsTables(database);
    lastMigrationReport.addedColumns = [
      ...songMigration.addedColumns,
      ...settingsAdded.map((name) => `settings.${name}`),
      ...playlistAdded
    ];
    lastMigrationReport.repairedRows += songMigration.repairedRows || 0;
    lastMigrationReport.repairedRows += repairBrokenRows(database);
    setStoredSchemaVersion(database, SCHEMA_VERSION);
  });

  try {
    tx();
  } catch (error) {
    lastMigrationReport.ok = false;
    lastMigrationReport.errors.push(error?.stack || error?.message || String(error));
    throw error;
  }
}

function initDatabase(databasePath) {
  dbFilePath = databasePath;
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  runMigrations(db);
  return db;
}

function rowToSong(row) {
  const song = normalizeOldSong(row);
  if (!song) return null;

  return {
    ...song,
    liked: Boolean(song.liked)
  };
}

function safeAll(database, sql, params = []) {
  try {
    return database.prepare(sql).all(...params);
  } catch (error) {
    lastMigrationReport.errors.push(`query failed: ${error?.message || error}`);
    return [];
  }
}

function getSongs() {
  const database = ensureDb();
  return safeAll(database, "SELECT * FROM songs ORDER BY dateAdded DESC")
    .map(rowToSong)
    .filter(Boolean);
}

function getSong(id) {
  const database = ensureDb();
  if (!id) return null;

  try {
    const row = database.prepare("SELECT * FROM songs WHERE id = ?").get(id);
    return rowToSong(row);
  } catch {
    return null;
  }
}

function insertSongs(songs) {
  const database = ensureDb();
  const list = Array.isArray(songs) ? songs : [];

  const stmt = database.prepare(`
    INSERT INTO songs (
      id, title, artist, album, filePath, coverPath, coverSource, coverUpdatedAt, liked, playCount,
      duration, durationMs, dateAdded, lastPlayed, volumeGain, playbackPosition, customVolume,
      sourceType, sourceTrackId, sourceUrl, sourceProvider, sourceProviderUrl, sourceMatchScore
    ) VALUES (
      @id, @title, @artist, @album, @filePath, @coverPath, @coverSource, @coverUpdatedAt, @liked, @playCount,
      @duration, @durationMs, @dateAdded, @lastPlayed, @volumeGain, @playbackPosition, @customVolume,
      @sourceType, @sourceTrackId, @sourceUrl, @sourceProvider, @sourceProviderUrl, @sourceMatchScore
    )
    ON CONFLICT(filePath) DO UPDATE SET
      title = CASE
        WHEN songs.title IS NULL OR TRIM(songs.title) = '' THEN excluded.title
        ELSE songs.title
      END,
      artist = CASE
        WHEN songs.artist IS NULL OR TRIM(songs.artist) = '' OR songs.artist = 'unknown artist' THEN excluded.artist
        ELSE songs.artist
      END,
      album = CASE
        WHEN songs.album IS NULL OR TRIM(songs.album) = '' OR songs.album = 'local files' THEN excluded.album
        ELSE songs.album
      END,
      coverPath = CASE
        WHEN songs.coverSource = 'custom' AND songs.coverPath IS NOT NULL AND TRIM(songs.coverPath) <> '' THEN songs.coverPath
        WHEN excluded.coverPath IS NOT NULL AND TRIM(excluded.coverPath) <> '' AND COALESCE(songs.coverSource, '') <> 'custom' THEN excluded.coverPath
        WHEN songs.coverPath IS NULL OR TRIM(songs.coverPath) = '' THEN excluded.coverPath
        ELSE songs.coverPath
      END,
      coverSource = CASE
        WHEN songs.coverSource = 'custom' THEN songs.coverSource
        WHEN excluded.coverSource IS NOT NULL AND TRIM(excluded.coverSource) <> '' THEN excluded.coverSource
        WHEN songs.coverSource IS NULL OR TRIM(songs.coverSource) = '' THEN 'none'
        ELSE songs.coverSource
      END,
      coverUpdatedAt = COALESCE(NULLIF(excluded.coverUpdatedAt, ''), songs.coverUpdatedAt),
      dateAdded = CASE
        WHEN songs.dateAdded IS NULL OR TRIM(songs.dateAdded) = '' THEN excluded.dateAdded
        ELSE songs.dateAdded
      END,
      duration = CASE
        WHEN songs.duration IS NULL OR songs.duration <= 0 THEN excluded.duration
        ELSE songs.duration
      END,
      durationMs = CASE
        WHEN songs.durationMs IS NULL OR songs.durationMs <= 0 THEN excluded.durationMs
        ELSE songs.durationMs
      END,
      volumeGain = CASE
        WHEN songs.volumeGain IS NULL OR songs.volumeGain <= 0 THEN excluded.volumeGain
        ELSE songs.volumeGain
      END,
      sourceType = CASE
        WHEN excluded.sourceType IS NOT NULL AND TRIM(excluded.sourceType) <> '' AND excluded.sourceType <> 'local' THEN excluded.sourceType
        ELSE songs.sourceType
      END,
      sourceTrackId = COALESCE(NULLIF(excluded.sourceTrackId, ''), songs.sourceTrackId),
      sourceUrl = COALESCE(NULLIF(excluded.sourceUrl, ''), songs.sourceUrl),
      sourceProvider = COALESCE(NULLIF(excluded.sourceProvider, ''), songs.sourceProvider),
      sourceProviderUrl = COALESCE(NULLIF(excluded.sourceProviderUrl, ''), songs.sourceProviderUrl),
      sourceMatchScore = CASE
        WHEN excluded.sourceMatchScore IS NOT NULL AND excluded.sourceMatchScore > 0 THEN excluded.sourceMatchScore
        ELSE songs.sourceMatchScore
      END
  `);

  const tx = database.transaction((items) => {
    let changed = 0;

    for (const input of items) {
      const song = normalizeOldSong(input);
      if (!song) continue;

      try {
        const result = stmt.run(song);
        changed += result.changes;
      } catch (error) {
        lastMigrationReport.errors.push(`skipped bad song: ${error?.message || error}`);
      }
    }

    return changed;
  });

  return tx(list);
}

function patchSong(id, patch) {
  const database = ensureDb();

  if (!id || !patch || typeof patch !== "object") {
    return getSong(id);
  }

  const allowed = [
    "title",
    "artist",
    "album",
    "coverPath",
    "coverSource",
    "coverUpdatedAt",
    "liked",
    "playCount",
    "duration",
    "durationMs",
    "lastPlayed",
    "volumeGain",
    "playbackPosition",
    "customVolume",
    "sourceType",
    "sourceTrackId",
    "sourceUrl",
    "sourceProvider",
    "sourceProviderUrl",
    "sourceMatchScore"
  ];

  const entries = Object.entries(patch).filter(([key]) => allowed.includes(key));
  if (!entries.length) return getSong(id);

  const sets = [];
  const values = [];

  for (const [key, value] of entries) {
    sets.push(`${key} = ?`);

    if (key === "liked") values.push(asBoolInt(value));
    else if (key === "playCount") values.push(Math.max(0, Math.floor(asNumber(value, 0))));
    else if (key === "duration" || key === "durationMs" || key === "playbackPosition" || key === "sourceMatchScore") values.push(Math.max(0, asNumber(value, 0)));
    else if (key === "volumeGain") values.push(asClampedNumber(value, 1, 0.2, 3));
    else if (key === "customVolume") values.push(asClampedNumber(value, 1, 0, 1));
    else values.push(value ?? null);
  }

  values.push(id);

  try {
    database.prepare(`UPDATE songs SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  } catch (error) {
    lastMigrationReport.errors.push(`patch failed: ${error?.message || error}`);
  }

  return getSong(id);
}

function deleteSong(id) {
  const database = ensureDb();
  if (!id) return false;

  try {
    const result = database.prepare("DELETE FROM songs WHERE id = ?").run(id);
    return result.changes > 0;
  } catch {
    return false;
  }
}

function clearLibrary() {
  const database = ensureDb();
  database.prepare("DELETE FROM songs").run();
}

function getSettings() {
  const database = ensureDb();
  const settings = {};

  for (const row of safeAll(database, "SELECT key, value FROM settings")) {
    settings[row.key] = safeJsonParse(row.value, row.value);
  }

  return settings;
}

function saveSettings(settings) {
  const database = ensureDb();

  if (!settings || typeof settings !== "object") return getSettings();

  const entries = Object.entries(settings).filter(([, value]) => typeof value !== "undefined");
  if (!entries.length) return getSettings();

  const stmt = database.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const tx = database.transaction((items) => {
    for (const [key, value] of items) {
      stmt.run(key, JSON.stringify(value));
    }
  });

  try {
    tx(entries);
  } catch (error) {
    lastMigrationReport.errors.push(`settings save failed: ${error?.message || error}`);
  }

  return getSettings();
}

function getPlaylists() {
  const database = ensureDb();

  const playlistRows = safeAll(database, "SELECT * FROM playlists ORDER BY sortOrder ASC, createdAt DESC, name COLLATE NOCASE ASC");
  if (!playlistRows.length) return [];

  const songRows = safeAll(database, "SELECT playlistId, songId FROM playlist_songs ORDER BY playlistId ASC, position ASC, addedAt ASC");
  const songIdsByPlaylist = new Map();

  for (const row of songRows) {
    const playlistId = asText(row.playlistId, "");
    const songId = asText(row.songId, "");
    if (!playlistId || !songId) continue;

    const list = songIdsByPlaylist.get(playlistId) || [];
    list.push(songId);
    songIdsByPlaylist.set(playlistId, list);
  }

  return playlistRows
    .map((row) => rowToPlaylist(row, songIdsByPlaylist.get(row.id) || []))
    .filter(Boolean);
}

function savePlaylists(playlists) {
  const database = ensureDb();
  const list = Array.isArray(playlists) ? playlists : [];
  const normalized = list
    .map((playlist, index) => normalizePlaylist(playlist, index))
    .filter(Boolean);

  const insertPlaylist = database.prepare(`
    INSERT INTO playlists (id, name, createdAt, sortOrder)
    VALUES (@id, @name, @createdAt, @sortOrder)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      createdAt = excluded.createdAt,
      sortOrder = excluded.sortOrder
  `);

  const insertPlaylistSong = database.prepare(`
    INSERT INTO playlist_songs (playlistId, songId, position, addedAt)
    VALUES (@playlistId, @songId, @position, @addedAt)
    ON CONFLICT(playlistId, songId) DO UPDATE SET
      position = excluded.position,
      addedAt = excluded.addedAt
  `);

  const tx = database.transaction((items) => {
    database.prepare("DELETE FROM playlist_songs").run();
    database.prepare("DELETE FROM playlists").run();

    items.forEach((playlist, playlistIndex) => {
      insertPlaylist.run({
        id: playlist.id,
        name: playlist.name,
        createdAt: playlist.createdAt,
        sortOrder: playlistIndex
      });

      playlist.songIds.forEach((songId, songIndex) => {
        insertPlaylistSong.run({
          playlistId: playlist.id,
          songId,
          position: songIndex,
          addedAt: Date.now()
        });
      });
    });
  });

  try {
    tx(normalized);
  } catch (error) {
    lastMigrationReport.errors.push(`playlist save failed: ${error?.message || error}`);
  }

  return getPlaylists();
}

function repairDatabaseNow() {
  const database = ensureDb();
  const repairedRows = repairBrokenRows(database);
  lastMigrationReport.repairedRows += repairedRows;
  return getDatabaseStatus();
}

function getDatabaseStatus() {
  const database = ensureDb();
  const songCount = safeAll(database, "SELECT COUNT(*) AS count FROM songs")[0]?.count || 0;
  const settingsCount = safeAll(database, "SELECT COUNT(*) AS count FROM settings")[0]?.count || 0;
  const playlistCount = safeAll(database, "SELECT COUNT(*) AS count FROM playlists")[0]?.count || 0;
  const playlistSongCount = safeAll(database, "SELECT COUNT(*) AS count FROM playlist_songs")[0]?.count || 0;
  const missingPathRows = safeAll(database, "SELECT COUNT(*) AS count FROM songs WHERE filePath IS NULL OR TRIM(filePath) = ''")[0]?.count || 0;
  const missingDurationRows = safeAll(database, "SELECT COUNT(*) AS count FROM songs WHERE duration IS NULL OR duration <= 0 OR durationMs IS NULL OR durationMs <= 0")[0]?.count || 0;

  return {
    path: dbFilePath,
    schemaVersion: getStoredSchemaVersion(database),
    expectedSchemaVersion: SCHEMA_VERSION,
    songCount,
    settingsCount,
    playlistCount,
    playlistSongCount,
    missingPathRows,
    missingDurationRows,
    lastMigration: lastMigrationReport
  };
}

module.exports = {
  initDatabase,
  getSongs,
  getSong,
  insertSongs,
  patchSong,
  deleteSong,
  clearLibrary,
  getSettings,
  saveSettings,
  getPlaylists,
  savePlaylists,
  backupDatabase,
  repairDatabaseNow,
  getDatabaseStatus
};
