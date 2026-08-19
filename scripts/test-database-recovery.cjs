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
    db.saveSettings({ phase3Recovery: "before-backup" });
    const backupPath = db.backupDatabase("phase3-restore-test");
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
    const settings = db.getSettings();
    if (settings.phase3Recovery !== "before-backup") throw new Error("backup restore did not restore settings");
    const status = db.getDatabaseStatus();
    if (status.schemaVersion !== status.expectedSchemaVersion) throw new Error("restored database schema is invalid");
  `, [dbPath, dbModulePath]);

  console.log(`[database-recovery] migration + verified backup restore passed (schema ${migration.schemaVersion})`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
