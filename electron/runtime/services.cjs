const { initDownloader, cancelActiveDownloads } = require("../downloader.cjs");
const { initMetadataService, flushMetadataCache } = require("../metadata-service.cjs");
const { initCoverService } = require("../cover-service.cjs");
const { shutdownDiscordActivity } = require("../rpc.cjs");

function createElectronServiceRuntime(options = {}) {
  const {
    userDataPath,
    ffmpegPath,
    startMediaServer,
    stopMediaServer,
    cleanupNativeWindowsMedia
  } = options;

  let started = false;
  let stopped = false;

  async function start() {
    if (started || stopped) return false;
    started = true;

    if (typeof startMediaServer === "function") await startMediaServer();
    if (stopped) return false;
    initDownloader({ userDataPath, ffmpegPath });
    initMetadataService({ userDataPath, ffmpegPath });
    initCoverService({ userDataPath });
    return true;
  }

  async function stop(reason = "app-before-quit") {
    if (stopped) return false;
    stopped = true;

    try { cancelActiveDownloads({ interrupted: true }); } catch { }
    try { flushMetadataCache(); } catch { }
    // Electron's before-quit event does not await promises. Release synchronous resources first.
    try { cleanupNativeWindowsMedia?.(); } catch { }
    try { stopMediaServer?.(); } catch { }
    try { await shutdownDiscordActivity(reason); } catch { }
    return true;
  }

  return Object.freeze({ start, stop });
}

module.exports = { createElectronServiceRuntime };
