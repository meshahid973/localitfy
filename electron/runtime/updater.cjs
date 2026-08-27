"use strict";

const LOCALTIFY_LINUX_RELEASES_URL = "https://github.com/meshahid973/localitfy/releases/latest";
const LOCALTIFY_GITHUB_LATEST_RELEASE_API = "https://api.github.com/repos/meshahid973/localitfy/releases/latest";

function normalizeUpdateVersion(value = "") {
  return String(value || "").trim().replace(/^v/i, "");
}

function compareUpdateVersions(leftValue = "", rightValue = "") {
  const left = normalizeUpdateVersion(leftValue).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = normalizeUpdateVersion(rightValue).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length, 3);

  for (let index = 0; index < length; index += 1) {
    const a = left[index] || 0;
    const b = right[index] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }

  return 0;
}

function safeUpdateInfo(info) {
  if (!info || typeof info !== "object") return { version: "latest" };
  return {
    version: info.version || "latest",
    releaseName: info.releaseName || "",
    releaseDate: info.releaseDate || "",
    releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : ""
  };
}

function createUpdaterRuntime(options = {}) {
  const {
    app,
    autoUpdater,
    shell,
    https,
    isDev = false,
    appName = "localtify",
    getMainWindow = () => null
  } = options;

  if (!app || !autoUpdater || !shell || !https) {
    throw new TypeError("updater runtime requires app, autoUpdater, shell and https");
  }

  let updaterReady = false;
  let updaterChecking = false;
  let updaterSilent = true;
  let updateDownloaded = false;
  let lastUpdateInfo = null;

  function isLinuxAppImageUpdateRuntime() {
    return Boolean(app.isPackaged && process.platform === "linux");
  }

  function linuxUpdaterIsManualOnly() {
    return isLinuxAppImageUpdateRuntime() && process.env.LOCALTIFY_ENABLE_LINUX_UPDATER !== "1";
  }

  function isLinuxUpdateMetadataMissingError(error) {
    const text = String(error?.message || error || "");
    return process.platform === "linux" && /latest-linux\.yml/i.test(text) && /404|Cannot find/i.test(text);
  }

  function sendAutoUpdateEvent(payload) {
    const eventPayload = {
      currentVersion: app.getVersion(),
      silent: updaterSilent,
      ...payload
    };
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("localitfy:auto-update-event", eventPayload);
    }
    return eventPayload;
  }

  function fetchGithubLatestReleaseInfo() {
    return new Promise((resolve) => {
      try {
        const request = https.get(
          LOCALTIFY_GITHUB_LATEST_RELEASE_API,
          {
            headers: {
              "user-agent": "localtify-updater",
              "accept": "application/vnd.github+json"
            },
            timeout: 6500
          },
          (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => { body += chunk; });
            response.on("end", () => {
              try {
                if (response.statusCode && response.statusCode >= 400) {
                  resolve(null);
                  return;
                }

                const data = JSON.parse(body || "{}");
                const tag = String(data.tag_name || data.name || "").trim();
                const version = normalizeUpdateVersion(tag);
                const assets = Array.isArray(data.assets) ? data.assets : [];
                const appImageAsset = assets.find((asset) => /\.AppImage$/i.test(String(asset?.name || "")));

                resolve({
                  version,
                  tag,
                  releaseUrl: String(data.html_url || LOCALTIFY_LINUX_RELEASES_URL),
                  downloadUrl: String(appImageAsset?.browser_download_url || data.html_url || LOCALTIFY_LINUX_RELEASES_URL),
                  releaseNotes: typeof data.body === "string" ? data.body : ""
                });
              } catch {
                resolve(null);
              }
            });
          }
        );

        request.on("timeout", () => {
          request.destroy();
          resolve(null);
        });
        request.on("error", () => resolve(null));
      } catch {
        resolve(null);
      }
    });
  }

  function sendLinuxManualUpdateEvent(extra = {}) {
    updaterChecking = false;
    updateDownloaded = false;
    return sendAutoUpdateEvent({
      type: "available",
      platform: "linux",
      manualOnly: true,
      version: extra.version || "latest",
      downloadUrl: extra.downloadUrl || LOCALTIFY_LINUX_RELEASES_URL,
      releaseNotes: extra.releaseNotes || "",
      message: extra.message || "Linux update available. Auto-update is disabled for AppImage, so download the latest AppImage from GitHub.",
      ...extra
    });
  }

  async function checkLinuxManualReleaseUpdate(payload = {}) {
    if (!linuxUpdaterIsManualOnly()) return null;
    updaterChecking = true;

    if (!payload?.silent) {
      sendAutoUpdateEvent({
        type: "checking",
        platform: "linux",
        manualOnly: true,
        message: "Checking GitHub releases..."
      });
    }

    const latest = await fetchGithubLatestReleaseInfo();
    updaterChecking = false;
    if (!latest?.version) {
      if (!payload?.silent) {
        sendLinuxManualUpdateEvent({
          version: "latest",
          downloadUrl: LOCALTIFY_LINUX_RELEASES_URL,
          reason: "linux-release-check-fallback",
          message: "Could not check Linux updates automatically. Open GitHub releases to download the latest AppImage."
        });
      }
      return false;
    }

    const currentVersion = normalizeUpdateVersion(app.getVersion());
    if (compareUpdateVersions(latest.version, currentVersion) <= 0) {
      sendAutoUpdateEvent({
        type: "not-available",
        platform: "linux",
        manualOnly: true,
        silent: Boolean(payload?.silent),
        version: latest.version,
        message: "Linux AppImage is up to date."
      });
      return false;
    }

    sendLinuxManualUpdateEvent({
      version: latest.version,
      downloadUrl: latest.downloadUrl || latest.releaseUrl || LOCALTIFY_LINUX_RELEASES_URL,
      releaseNotes: latest.releaseNotes || "",
      reason: "linux-manual-update-available"
    });
    return true;
  }

  async function openLinuxUpdateReleaseLink(reason = "manual-link") {
    const url = LOCALTIFY_LINUX_RELEASES_URL;
    sendLinuxManualUpdateEvent({
      version: lastUpdateInfo?.version || "latest",
      downloadUrl: url,
      reason,
      message: "Opening GitHub releases for Linux AppImage download..."
    });
    await shell.openExternal(url).catch((error) => {
      console.log("[localtify linux updater open link error]", error?.message || error);
    });
    return false;
  }

  function setupAutoUpdater() {
    if (updaterReady) return;
    updaterReady = true;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = process.env.LOCALTIFY_ALLOW_PRERELEASE_UPDATES === "1";
    autoUpdater.allowDowngrade = false;

    try { autoUpdater.logger = null; } catch {}
    autoUpdater.on("checking-for-update", () => {
      sendAutoUpdateEvent({ type: "checking", message: "checking for updates..." });
    });
    autoUpdater.on("update-available", (info) => {
      if (linuxUpdaterIsManualOnly()) {
        sendLinuxManualUpdateEvent({
          version: safeUpdateInfo(info).version,
          reason: "linux-manual-only-update-available"
        });
        return;
      }
      const cleanInfo = safeUpdateInfo(info);
      updaterChecking = false;
      updateDownloaded = false;
      lastUpdateInfo = cleanInfo;
      sendAutoUpdateEvent({
        type: "available",
        version: cleanInfo.version,
        info: cleanInfo,
        message: `${appName} ${cleanInfo.version} is available`
      });
    });
    autoUpdater.on("update-not-available", (info) => {
      const cleanInfo = safeUpdateInfo(info);
      updaterChecking = false;
      updateDownloaded = false;
      lastUpdateInfo = cleanInfo;
      sendAutoUpdateEvent({
        type: "not-available",
        version: cleanInfo.version,
        info: cleanInfo,
        message: "you are already on the latest build"
      });
    });
    autoUpdater.on("download-progress", (progress) => {
      const percent = Math.max(0, Math.min(100, Number(progress?.percent || 0)));
      sendAutoUpdateEvent({
        type: "downloading",
        version: lastUpdateInfo?.version || "latest",
        percent,
        message: `downloading update... ${Math.round(percent)}%`
      });
    });
    autoUpdater.on("update-downloaded", (info) => {
      const cleanInfo = safeUpdateInfo(info);
      updaterChecking = false;
      updateDownloaded = true;
      lastUpdateInfo = cleanInfo;
      sendAutoUpdateEvent({
        type: "downloaded",
        version: cleanInfo.version,
        info: cleanInfo,
        percent: 100,
        message: "update downloaded. restart localtify to install it."
      });
    });
    autoUpdater.on("error", (error) => {
      updaterChecking = false;
      if (isLinuxUpdateMetadataMissingError(error)) {
        sendAutoUpdateEvent({
          type: "not-available",
          message: "linux update metadata is not available yet",
          skipped: true,
          platform: "linux"
        });
        return;
      }
      sendAutoUpdateEvent({
        type: "error",
        message: "update check failed",
        error: error?.message || String(error || "unknown updater error")
      });
    });
  }

  async function checkForUpdates(payload = {}) {
    setupAutoUpdater();
    updaterSilent = Boolean(payload?.silent);
    if (isDev) {
      sendAutoUpdateEvent({ type: "dev", message: "auto update only works in the packaged app" });
      return false;
    }

    const linuxManualResult = await checkLinuxManualReleaseUpdate(payload);
    if (linuxManualResult !== null) return linuxManualResult;
    if (updaterChecking) return true;

    updaterChecking = true;
    try {
      await autoUpdater.checkForUpdates();
      return true;
    } catch (error) {
      updaterChecking = false;
      if (isLinuxUpdateMetadataMissingError(error)) {
        sendAutoUpdateEvent({
          type: "not-available",
          message: "linux update metadata is not available yet",
          skipped: true,
          platform: "linux"
        });
        return false;
      }
      sendAutoUpdateEvent({
        type: "error",
        message: "update check failed",
        error: error?.message || String(error || "unknown updater error")
      });
      return false;
    }
  }

  async function downloadUpdate() {
    setupAutoUpdater();
    if (isDev) {
      sendAutoUpdateEvent({ type: "dev", message: "auto update only works in the packaged app" });
      return false;
    }
    if (linuxUpdaterIsManualOnly()) return openLinuxUpdateReleaseLink("download-button");

    try {
      updateDownloaded = false;
      sendAutoUpdateEvent({
        type: "downloading",
        version: lastUpdateInfo?.version || "latest",
        percent: 0,
        message: "starting update download..."
      });
      await autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      sendAutoUpdateEvent({
        type: "error",
        message: "update download failed",
        error: error?.message || String(error || "unknown download error")
      });
      return false;
    }
  }

  async function installUpdate() {
    setupAutoUpdater();
    if (isDev) {
      sendAutoUpdateEvent({ type: "dev", message: "auto update only works in the packaged app" });
      return false;
    }
    if (linuxUpdaterIsManualOnly()) return openLinuxUpdateReleaseLink("install-button");
    if (!updateDownloaded) {
      sendAutoUpdateEvent({
        type: "error",
        message: "update is not downloaded yet",
        error: "download the update first"
      });
      return false;
    }
    setImmediate(() => { autoUpdater.quitAndInstall(false, true); });
    return true;
  }

  return Object.freeze({
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    setupAutoUpdater,
    sendAutoUpdateEvent,
    isLinuxAppImageUpdateRuntime,
    linuxUpdaterIsManualOnly
  });
}

module.exports = {
  LOCALTIFY_LINUX_RELEASES_URL,
  normalizeUpdateVersion,
  compareUpdateVersions,
  safeUpdateInfo,
  createUpdaterRuntime
};
