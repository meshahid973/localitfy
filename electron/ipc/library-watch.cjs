"use strict";

/** Watched folders: status, a manual check, and the folder picker. The folder list itself lives in settings. */
function registerLibraryWatchIpc(router, watcher, { dialog, getWindow }) {
  router.handle("library:watch-status", async () => watcher.status());
  router.handle("library:watch-check", async () => ({ importedCount: await watcher.checkNow(), ...watcher.status() }));
  router.handle("library:watch-choose-folder", async () => {
    const owner = getWindow();
    const result = await dialog.showOpenDialog(owner || undefined, { title: "Choose a folder to watch for new music", properties: ["openDirectory"] });
    return result.canceled || !result.filePaths?.[0] ? { canceled: true, folder: "" } : { canceled: false, folder: result.filePaths[0] };
  });
}

module.exports = { registerLibraryWatchIpc };
