const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const dbModulePath = path.join(root, "electron", "db.cjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-phase3-db-"));
const dbPath = path.join(tempDir, "localtify.sqlite");

function runStage(label, source, args = []) {
  const result = spawnSync(process.execPath, ["-e", source, ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return String(result.stdout || "").trim();
}

try {
  runStage("seed legacy database", `
    const Database = require("better-sqlite3");
    const target = process.argv[1];
    const db = new Database(target);
    db.exec(\`
      CREATE TABLE songs (
        id TEXT PRIMARY KEY,
        title TEXT,
        artist TEXT,
        filePath TEXT UNIQUE NOT NULL
      );
      CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO schema_meta (key, value) VALUES ('schemaVersion', '1');
    \`);
    db.prepare("INSERT INTO songs (id, title, artist, filePath) VALUES (?, ?, ?, ?)")
      .run("legacy-song", "legacy title", "legacy artist", "C:/Music/legacy.mp3");
    db.close();
  `, [dbPath]);

  const migrationOutput = runStage("migrate and backup", `
    const db = require(process.argv[2]);
    db.initDatabase(process.argv[1]);
    const status = db.getDatabaseStatus();
    if (status.schemaVersion !== status.expectedSchemaVersion) throw new Error("schema migration did not reach current version");
    const song = db.getSongs().find((item) => item.id === "legacy-song");
    if (!song || song.title !== "legacy title") throw new Error("legacy song was not preserved");
    if (song.genre !== "") throw new Error("legacy song genre default is invalid");
    db.patchSong("legacy-song", { genre: "Synthpop" });
    if (db.getSongs().find((item) => item.id === "legacy-song")?.genre !== "Synthpop") throw new Error("genre metadata was not persisted");
    db.saveSettings({ phase3Recovery: "before-backup" });
    const now = Date.now();
    const event = { id: "listen-1", sessionId: "session-1", songId: "legacy-song", startedAt: now - 10_000,
      updatedAt: now - 5000, endedAt: null, msListened: 4000, outcome: "active", contextType: "library", contextId: null };
    if (!db.recordPlayEvent(event) || !db.recordPlayEvent(event)) throw new Error("idempotent event checkpoint failed");
    if (db.recordPlayEvent({ ...event, songId: "missing-song" })) throw new Error("missing song event accepted");
    if (db.recordPlayEvent({ ...event, sessionId: "changed-session" })) throw new Error("event identity changed");
    if (db.recordPlayEvent({ ...event, updatedAt: now - 6000, msListened: 3000 })) throw new Error("stale checkpoint accepted");
    if (!db.recordPlayEvent({ ...event, updatedAt: now, endedAt: now, outcome: "ended", msListened: 8000 })) throw new Error("final event failed");
    if (db.recordPlayEvent(event)) throw new Error("final event reopened");
    if (JSON.stringify(db.getListeningCounts()) !== JSON.stringify([["legacy-song", 1, 0]])) throw new Error("listening counts are wrong");
    const summary = db.getListeningSummary({ days: 7 });
    if (summary.totalMs !== 8000 || summary.sessions !== 1 || summary.byDay.reduce((sum, day) => sum + day.ms, 0) !== 8000) throw new Error("recorded listening aggregation changed checkpoint totals");
    if (summary.comparison.totalMs !== 0 || summary.comparison.changePercent !== null) throw new Error("empty listening comparison fabricated a baseline");
    const rules = { match: "all", rules: [{ field: "liked", op: "is", value: "" }], sort: "random", limit: 50 };
    db.savePlaylists([{ id: "smart", name: "Smart", songIds: ["legacy-song"], createdAt: now, rules },
      { id: "plain", name: "Plain", songIds: [], createdAt: now, rules: "not json" }]);
    const saved = db.getPlaylists();
    if (JSON.stringify(saved.find((item) => item.id === "smart")?.rules) !== JSON.stringify(rules)) throw new Error("smart playlist rules were not persisted");
    if ("rules" in saved.find((item) => item.id === "plain")) throw new Error("malformed playlist rules were persisted");
    const vector = new Float32Array(512); vector[0] = 1;
    const analysis = { songId: "legacy-song", filePath: "C:/Music/legacy.mp3", fileSize: 1234, fileMtime: 5678, vector, rms: 0.2 };
    if (!db.saveSongAnalysis(analysis)) throw new Error("analysis not persisted");
    if (db.saveSongAnalysis({ ...analysis, vector: new Float32Array(4) })) throw new Error("invalid embedding persisted");
    const Database = require("better-sqlite3");
    const inspect = new Database(process.argv[1]);
    inspect.prepare("UPDATE playlist_songs SET addedAt = 1234 WHERE playlistId = ? AND songId = ?").run("smart","legacy-song");
    db.savePlaylists(saved.map(item => item.id === "plain" ? {...item,name:"Renamed"} : item));
    if(inspect.prepare("SELECT addedAt FROM playlist_songs WHERE playlistId=? AND songId=?").get("smart","legacy-song")?.addedAt!==1234) throw new Error("Unchanged membership was rewritten");
    db.savePlaylists(db.getPlaylists().filter(item=>item.id!=="plain"));
    if(inspect.prepare("SELECT COUNT(*) AS n FROM playlists WHERE id=?").get("plain").n!==0) throw new Error("Removed playlist retained");
    inspect.prepare("INSERT INTO daily_mixes (day, edition, fingerprint, result, generatedAt) VALUES (?, ?, ?, ?, ?)").run("2026-10-16", 0, "fixture", "{}", now);
    const backupPath = db.backupDatabase("phase3-restore-test");
    if (inspect.prepare("SELECT COUNT(*) AS n FROM play_events").get().n !== 1) throw new Error("duplicate events persisted");
    inspect.close();
    console.log(JSON.stringify({ backupPath, schemaVersion: status.schemaVersion }));
  `, [dbPath, dbModulePath]);

  const migrationLine = migrationOutput.split(/\r?\n/).filter(Boolean).at(-1);
  const migration = JSON.parse(migrationLine);
  if (!migration.backupPath || !fs.existsSync(migration.backupPath)) {
    throw new Error("verified backup was not created");
  }

  runStage("mutate live database", `
    const db = require(process.argv[2]);
    db.initDatabase(process.argv[1]);
    db.patchSong("legacy-song", { title: "mutated after backup" });
    db.saveSettings({ phase3Recovery: "mutated" });
  `, [dbPath, dbModulePath]);

  for (const suffix of ["-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix, { force: true }); } catch { }
  }
  fs.copyFileSync(migration.backupPath, dbPath);

  runStage("verify restored backup", `
    const db = require(process.argv[2]);
    db.initDatabase(process.argv[1]);
    const song = db.getSongs().find((item) => item.id === "legacy-song");
    if (!song || song.title !== "legacy title") throw new Error("backup restore did not restore song data");
    if (song.genre !== "Synthpop") throw new Error("backup restore did not restore genre metadata");
    const settings = db.getSettings();
    if (settings.phase3Recovery !== "before-backup") throw new Error("backup restore did not restore settings");
    const status = db.getDatabaseStatus();
    if (status.schemaVersion !== status.expectedSchemaVersion) throw new Error("restored database schema is invalid");
    const Database = require("better-sqlite3");
    const inspect = new Database(process.argv[1]);
    if(inspect.prepare("SELECT addedAt FROM playlist_songs WHERE playlistId=? AND songId=?").get("smart","legacy-song")?.addedAt!==1234) throw new Error("Playlist membership not restored");
    const event = inspect.prepare("SELECT * FROM play_events WHERE id = ?").get("listen-1");
    if (event?.msListened !== 8000 || event.outcome !== "ended") throw new Error("history backup/restore failed");
    const analysis = inspect.prepare("SELECT * FROM song_analysis WHERE songId = ?").get("legacy-song");
    if (analysis?.vector?.length !== 2048 || analysis.rms !== 0.2) throw new Error("analysis backup/restore failed");
    if (inspect.prepare("SELECT fingerprint FROM daily_mixes WHERE day = ?").get("2026-10-16")?.fingerprint !== "fixture") throw new Error("daily mixes backup/restore failed");
    db.clearListeningHistory();
    if (db.recordPlayEvent(event)) throw new Error("cleared session resurrected history");
    db.saveSettings({ listeningHistoryEnabled: false });
    const future = Date.now() + 10;
    if (db.recordPlayEvent({ ...event, id: "disabled-history", startedAt: future, updatedAt: future, endedAt: null, outcome: "active", msListened: 0 })) throw new Error("history recorded while disabled");
    db.saveSettings({ listeningHistoryEnabled: true });
    if (!db.recordPlayEvent({ ...event, id: "after-clear", startedAt: future, updatedAt: future, endedAt: null, outcome: "active", msListened: 0 })) throw new Error("new session did not record after clear");
    db.deleteSong("legacy-song");
    if (inspect.prepare("SELECT COUNT(*) AS n FROM song_analysis").get().n !== 0) throw new Error("deleted song analysis retained");
    if (inspect.prepare("SELECT COUNT(*) AS n FROM play_events").get().n !== 0) throw new Error("deleted song history retained");
    db.insertSongs([{ id: "clear-song", filePath: "C:/Music/clear.mp3", title: "clear test" }]);
    const now = Date.now() + 10;
    const checkpoint = { id: "listen-clear", sessionId: "session", songId: "clear-song", startedAt: now,
      updatedAt: now, endedAt: null, msListened: 0, outcome: "active", contextType: "library", contextId: null };
    if (!db.recordPlayEvent(checkpoint)) throw new Error("clear fixture not recorded");
    db.clearLibrary();
    if (inspect.prepare("SELECT COUNT(*) AS n FROM play_events").get().n !== 0) throw new Error("cleared library history retained");
    if (inspect.prepare("SELECT COUNT(*) AS n FROM daily_mixes").get().n !== 0) throw new Error("cleared library mixes retained");
    if (db.recordPlayEvent(checkpoint)) throw new Error("late checkpoint recreated cleared history");
    inspect.close();
  `, [dbPath, dbModulePath]);

  console.log(`[database-recovery] migration + verified backup restore passed (schema ${migration.schemaVersion})`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
