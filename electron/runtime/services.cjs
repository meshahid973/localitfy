const { initDownloader } = require("../downloader.cjs");
const { initMetadataService } = require("../metadata-service.cjs");
const { initCoverService } = require("../cover-service.cjs");
const { shutdownDiscordActivity } = require("../rpc.cjs");

function createElectronServiceRuntime(options = {}) {
  const {
    userDataPath,
    ffmpegPath,
    getCookiesFile,
    startMediaServer,
    stopMediaServer,
    cleanupNativeWindowsMedia
  } = options;

  let started = false;
  let stopped = false;

  async function start() {
    if (started) return false;
    started = true;
    stopped = false;

    if (typeof startMediaServer === "function") await startMediaServer();
    initDownloader({ userDataPath, ffmpegPath, getCookiesFile });
    initMetadataService({ userDataPath, ffmpegPath });
    initCoverService({ userDataPath });
    return true;
  }

  async function stop(reason = "app-before-quit") {
    if (stopped) return false;
    stopped = true;

    try { await shutdownDiscordActivity(reason); } catch { }
    try { cleanupNativeWindowsMedia?.(); } catch { }
    try { stopMediaServer?.(); } catch { }
    return true;
  }

  return Object.freeze({ start, stop });
}

module.exports = { createElectronServiceRuntime };
