/**
 * One durable receipt per paired phone. Changes and their receipt commit in the same SQLite transaction.
 * phone_like_clock keeps when each song's like last changed (Mac clock), so the newest tap wins on either device.
 */
function createPhoneSyncTable(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS phone_sync_receipts (
    deviceId TEXT PRIMARY KEY, sequence INTEGER NOT NULL, digest TEXT NOT NULL, result TEXT NOT NULL
  )`);
  database.exec("CREATE TABLE IF NOT EXISTS phone_like_clock (songId TEXT PRIMARY KEY, changedAt INTEGER NOT NULL)");
}

function readLikeClock(database, songId) {
  return Number(database.prepare("SELECT changedAt FROM phone_like_clock WHERE songId = ?").get(songId)?.changedAt || 0);
}

function writeLikeClock(database, songId, changedAt) {
  database.prepare(`INSERT INTO phone_like_clock (songId, changedAt) VALUES (?, ?)
    ON CONFLICT(songId) DO UPDATE SET changedAt = excluded.changedAt`).run(songId, Math.round(changedAt));
}

function applyPhoneSyncBatch(database, deviceId, sequence, digest, apply) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("Update the Android app before syncing");
  return database.transaction(() => {
    const previous = database.prepare("SELECT sequence, digest, result FROM phone_sync_receipts WHERE deviceId = ?").get(deviceId);
    if (previous?.sequence === sequence && previous.digest === digest) {
      return { replayed: true, result: JSON.parse(previous.result) };
    }
    if (sequence !== (previous?.sequence || 0) + 1) throw new Error("Sync batch is out of order; no changes were applied");
    const result = apply();
    database.prepare(`INSERT INTO phone_sync_receipts (deviceId, sequence, digest, result) VALUES (?, ?, ?, ?)
      ON CONFLICT(deviceId) DO UPDATE SET sequence = excluded.sequence, digest = excluded.digest, result = excluded.result`)
      .run(deviceId, sequence, digest, JSON.stringify(result));
    return { replayed: false, result };
  })();
}

module.exports = { createPhoneSyncTable, applyPhoneSyncBatch, readLikeClock, writeLikeClock };
