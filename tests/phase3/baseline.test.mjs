import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("lockfile pins the valid asynckit tarball", () => {
  const lock = JSON.parse(read("package-lock.json"));
  const pkg = lock.packages?.["node_modules/asynckit"];
  assert.equal(pkg?.version, "0.4.0");
  assert.equal(pkg?.resolved, "https://registry.npmjs.org/asynckit/-/asynckit-0.4.0.tgz");
  assert.equal(lock.packages?.["node_modules/form-data"]?.dependencies?.asynckit, "^0.4.0");
});

test("local validation is owned by deterministic package scripts", () => {
  const pkg = JSON.parse(read("package.json"));
  const scripts = pkg.scripts || {};
  assert.match(String(scripts.check || ""), /bridge:check/);
  assert.match(String(scripts.check || ""), /boundaries:check/);
  assert.match(String(scripts.check || ""), /css:dedup:check/);
  assert.match(String(scripts.check || ""), /typecheck/);
  assert.match(String(scripts.check || ""), /build/);
  assert.match(String(scripts["hardening:check"] || ""), /performance:check/);
  assert.doesNotMatch(JSON.stringify(scripts), /package-lock=false|npm install --ignore-scripts/);
});

test("database backups checkpoint WAL and verify the copied database", () => {
  const source = read("electron/db.cjs");
  assert.match(source, /database\.pragma\("wal_checkpoint\(FULL\)"\)/);
  assert.match(source, /verificationDb\.pragma\("integrity_check", \{ simple: true \}\)/);
  const backupBody = source.slice(source.indexOf("function backupDatabase"), source.indexOf("function asText"));
  const checkpoint = backupBody.indexOf("checkpointDatabaseForBackup(database)");
  const copy = backupBody.indexOf("fs.copyFileSync(dbFilePath, backupPath)");
  const verify = backupBody.indexOf("verifyBackupDatabase(backupPath)");
  assert.ok(checkpoint >= 0, "missing backup checkpoint call");
  assert.ok(copy > checkpoint, "database must be checkpointed before the file copy");
  assert.ok(verify > copy, "backup copy must be integrity checked");
});

test("database schema metadata uses the package version", () => {
  const source = read("electron/db.cjs");
  assert.match(source, /const APP_VERSION = String\(packageMetadata\?\.version/);
  assert.match(source, /\.run\(version, now, APP_VERSION\)/);
  assert.doesNotMatch(source, /\.run\(version, now, "0\.2\.9"\)/);
});

test("renderer no longer performs the custom-theme backup twice in one save", () => {
  const source = read("src/App.tsx");
  assert.doesNotMatch(
    source,
    /writeCustomThemeBackupPatch\(nextSettings\);\s*writeCustomThemeBackupPatch\(nextSettings\);/
  );
});

test("user-facing download errors do not leak old source-file replacement instructions", () => {
  const downloads = read("src/features/downloads/useDownloadsRuntime.ts");
  assert.doesNotMatch(downloads, /Replace electron\/main\.cjs|v315 Spotify/);
});
