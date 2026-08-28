import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dbModulePath = path.join(root, "electron", "db.cjs");

function runNode(source) {
  const result = spawnSync(process.execPath, ["-e", source], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || "child process failed");
  return result.stdout.trim();
}

test("audio-effect pitch presets survive a real database reopen", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-audio-settings-"));
  const dbPath = path.join(tempDir, "localtify.sqlite");
  const serializedDbModule = JSON.stringify(dbModulePath);
  const serializedDbPath = JSON.stringify(dbPath);

  runNode(`
    const db = require(${serializedDbModule});
    db.initDatabase(${serializedDbPath});
    db.saveSettings({
      audioEffectMode: "nightcore",
      audioEffectAmount: 73,
      audioReverbAmount: 42,
      playbackSpeed: 1.18
    });
  `);

  const reopened = JSON.parse(runNode(`
    const db = require(${serializedDbModule});
    db.initDatabase(${serializedDbPath});
    const settings = db.getSettings();
    process.stdout.write(JSON.stringify({
      audioEffectMode: settings.audioEffectMode,
      audioEffectAmount: settings.audioEffectAmount,
      audioReverbAmount: settings.audioReverbAmount,
      playbackSpeed: settings.playbackSpeed
    }));
  `));

  assert.deepEqual(reopened, {
    audioEffectMode: "nightcore",
    audioEffectAmount: 73,
    audioReverbAmount: 42,
    playbackSpeed: 1.18
  });
});
