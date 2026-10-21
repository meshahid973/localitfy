"use strict";

const { findMovedSongCandidates } = require("../library-relink.cjs");

/** Native confirmation is required; this operation never runs during bootstrap. */
function registerMovedSongRepairIpc(router, deps) {
  const { dialog, BrowserWindow, getWindow, getSongs, fileExists, isAudioFile,
    readMetadata, backupDatabase, relinkSongPaths, clearFileInfoCache, listSongsShaped } = deps;

  router.handle("library:repair-moved-songs", async (event) => {
    try {
      const songs = getSongs();
      const missingCount = songs.filter(song => song.filePath && !fileExists(song.filePath)).length;
      if (!missingCount) return { ok: true, changedCount: 0, message: "No missing songs to relink." };

      const owner = BrowserWindow.fromWebContents(event.sender) || getWindow();
      const picked = await dialog.showOpenDialog(owner, {
        title: "Select the folder containing your moved music", properties: ["openDirectory"]
      });
      if (picked.canceled || !picked.filePaths?.[0]) return { ok: true, canceled: true, changedCount: 0 };

      const scan = await findMovedSongCandidates(picked.filePaths[0], songs, {
        fileExists, isAudioFile, readMetadata
      });
      const stats = { missingCount, ambiguous: scan.ambiguous, scannedFiles: scan.scannedFiles };
      if (scan.truncated) return {
        ok: false, changedCount: 0, ...stats,
        message: "Folder is too large for safe automatic matching. Choose a smaller folder."
      };

      // Limit each confirmation to a fully visible, reviewable batch.
      const changes = scan.matches.slice(0, 12);
      if (!changes.length) return {
        ok: true, changedCount: 0, ...stats,
        message: "No unambiguous moved files found. No songs were changed."
      };
      const preview = changes.map(item => item.title + "\n  " + item.oldPath + "\n  → " + item.newPath).join("\n\n");
      const decision = await dialog.showMessageBox(owner, {
        type: "question", buttons: ["Cancel", "Relink selected songs"],
        defaultId: 0, cancelId: 0,
        title: "Review moved-file repairs",
        message: "Relink " + changes.length + " file match(es)?",
        detail: preview + (scan.matches.length > changes.length ? "\n\nMore matches can be repaired in another pass." : "")
      });
      if (decision.response !== 1) return { ok: true, canceled: true, changedCount: 0 };
      if (changes.some(item => !fileExists(item.newPath))) return {
        ok: false, changedCount: 0, message: "A candidate file disappeared. Please scan again."
      };

      // Fail closed if backup or the transaction fails. Song IDs are unchanged.
      backupDatabase("before-moved-file-relink");
      const changedCount = relinkSongPaths(changes);
      clearFileInfoCache();
      return {
        ok: true, changedCount, songs: listSongsShaped(), ...stats,
        message: "Relinked " + changedCount + " song(s) without changing likes, playlists or history."
      };
    } catch (error) {
      console.log("[localitfy moved file repair error]", error?.message || error);
      return { ok: false, changedCount: 0, message: error?.message || "Moved-file repair failed." };
    }
  });
}

module.exports = { registerMovedSongRepairIpc };
