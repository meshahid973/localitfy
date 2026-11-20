function createGenreMetadataBackfill({
  getSettings,
  saveSettings,
  getSongs,
  getSong,
  patchSong,
  fileExists,
  isAudioFile,
  readLocalAudioMetadata,
  yieldToMainLoop,
  logger = console
}) {
  let backfillPromise = null;

  async function backfill() {
    const backfillVersion = Number(getSettings()?.genreMetadataBackfillVersion || 0);
    if (backfillVersion >= 1) return { scannedCount: 0, changedCount: 0 };

    const targets = getSongs().filter((song) =>
      !String(song?.genre || "").trim() &&
      song?.filePath &&
      fileExists(song.filePath) &&
      isAudioFile(song.filePath)
    );

    let cursor = 0;
    let changedCount = 0;
    const workers = Array.from({ length: Math.min(8, targets.length) }, async () => {
      while (cursor < targets.length) {
        const index = cursor;
        cursor += 1;
        const song = targets[index];
        try {
          const metadata = await readLocalAudioMetadata(song.filePath, { readCover: false, readDuration: false });
          const genre = String(metadata?.genre || "").trim();
          if (genre) {
            // Tag edits or file replacement may have occurred during parsing.
            const current = getSong ? getSong(song.id) : song;
            if (current && current.filePath === song.filePath && !String(current.genre || "").trim()) {
              patchSong(song.id, { genre });
              changedCount += 1;
            }
          }
        } catch (error) {
          logger.log("[localtify genre backfill item error]", song.filePath, error?.message || error);
        }
        if (index > 0 && index % 100 === 0) await yieldToMainLoop();
      }
    });

    await Promise.all(workers);
    saveSettings({ genreMetadataBackfillVersion: 1 });
    logger.log(`[localtify genre backfill] scanned ${targets.length}, tagged ${changedCount}`);
    return { scannedCount: targets.length, changedCount };
  }

  return {
    run() {
      if (!backfillPromise) {
        backfillPromise = backfill().catch((error) => {
          backfillPromise = null;
          logger.log("[localtify genre backfill error]", error?.stack || error?.message || error);
          return { scannedCount: 0, changedCount: 0 };
        });
      }
      return backfillPromise;
    }
  };
}

module.exports = { createGenreMetadataBackfill };
