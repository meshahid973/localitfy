"use strict";

/**
 * Fold each removed duplicate into the copy being kept, in one transaction: likes, play counts,
 * last played, playlist positions, listening history and a lyrics choice move over before the
 * removed rows are deleted. Audio files are not touched here.
 */
function mergeDuplicateSongs(database, merges) {
  const song = database.prepare("SELECT id, liked, playCount, lastPlayed FROM songs WHERE id = ?");
  const updateKept = database.prepare("UPDATE songs SET liked = ?, playCount = ?, lastPlayed = ? WHERE id = ?");
  const dropPlaylistDuplicate = database.prepare(`DELETE FROM playlist_songs WHERE songId = @remove
    AND playlistId IN (SELECT playlistId FROM playlist_songs WHERE songId = @keep)`);
  const movePlaylistRows = database.prepare("UPDATE playlist_songs SET songId = @keep WHERE songId = @remove");
  const moveHistory = database.prepare("UPDATE play_events SET songId = @keep WHERE songId = @remove");
  const moveLyrics = database.prepare(`UPDATE lyrics_selections SET songId = @keep WHERE songId = @remove
    AND NOT EXISTS (SELECT 1 FROM lyrics_selections WHERE songId = @keep)`);
  const remove = database.prepare("DELETE FROM songs WHERE id = ?");
  return database.transaction((items) => {
    const removed = [];
    for (const { keepId, removeIds } of items) {
      const kept = song.get(keepId);
      if (!kept) throw new Error("A song to keep is no longer in the library. Scan again.");
      let liked = Number(kept.liked) ? 1 : 0; let playCount = Number(kept.playCount) || 0; let lastPlayed = kept.lastPlayed || null;
      for (const removeId of removeIds) {
        const other = song.get(removeId);
        if (!other) throw new Error("A duplicate is no longer in the library. Scan again.");
        liked = liked || (Number(other.liked) ? 1 : 0);
        playCount += Number(other.playCount) || 0;
        if (other.lastPlayed && (!lastPlayed || String(other.lastPlayed) > String(lastPlayed))) lastPlayed = other.lastPlayed;
        const ids = { keep: keepId, remove: removeId };
        dropPlaylistDuplicate.run(ids); movePlaylistRows.run(ids); moveHistory.run(ids); moveLyrics.run(ids);
        remove.run(removeId);
        removed.push(removeId);
      }
      updateKept.run(liked, playCount, lastPlayed, keepId);
    }
    return removed;
  }).immediate(merges);
}

/** Current audio profiles (vector bytes) for songs whose analysed file is still the song's file. */
function listAudioProfiles(database, modelId, analyzerVersion) {
  return database.prepare(`SELECT a.songId, a.vector FROM song_analysis a JOIN songs s ON s.id = a.songId
    WHERE a.status = 'ready' AND a.modelId = ? AND a.analyzerVersion = ? AND a.filePath = s.filePath`).all(modelId, analyzerVersion);
}

module.exports = { mergeDuplicateSongs, listAudioProfiles };
