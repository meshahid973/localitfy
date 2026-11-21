"use strict";

const LOCALTIFY_LINUX_RELEASES_URL = "https://github.com/meshahid973/localtify/releases/latest";
const LOCALTIFY_GITHUB_LATEST_RELEASE_API = "https://api.github.com/repos/meshahid973/localtify/releases/latest";

function normalizeUpdateVersion(value = "") {
  return String(value || "").trim().replace(/^v/i, "");
}

function compareUpdateVersions(leftValue = "", rightValue = "") {
  const parse = value => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9a-z][0-9a-z.-]*))?$/i.exec(normalizeUpdateVersion(value));
    return match ? { parts:match.slice(1,4).map(Number), pre:match[4] || "" } : null;
  };
  const left=parse(leftValue),right=parse(rightValue);
  if(!left||!right)return 0; // Unknown tags must never be treated as newer releases.
  for(let i=0;i<3;i++)if(left.parts[i]!==right.parts[i])return left.parts[i]>right.parts[i]?1:-1;
  if(!left.pre&&!right.pre)return 0;
  if(!left.pre)return 1;
  if(!right.pre)return -1;
  const a=left.pre.split("."),b=right.pre.split(".");
  for(let i=0;i<Math.max(a.length,b.length);i++){
    if(a[i]===undefined)return -1;
    if(b[i]===undefined)return 1;
    const ai=/^\d+$/.test(a[i]),bi=/^\d+$/.test(b[i]);
    if(ai&&bi){const d=Number(a[i])-Number(b[i]);if(d)return Math.sign(d);}
    else if(ai!==bi)return ai?-1:1;
    else {const d=a[i].localeCompare(b[i]);if(d)return Math.sign(d);}
  }
  return 0;
}

function safeUpdateInfo(info) {
  if (!info || typeof info !== "object") return { version: "latest" };
  return {
    version: info.version || "latest",
    releaseName: info.releaseName || "",
    releaseDate: info.releaseDate || "",
    releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes.slice(0, 100_000) : Array.isArray(info.releaseNotes) ? info.releaseNotes.map(entry => String(entry?.note || "")).join("\n").slice(0, 100_000) : ""
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
  let lastUpdateEvent = { type: "idle", currentVersion: app.getVersion() };
  let lastSuccessfulCheckAt = 0;
  let updateDownloading = false;

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
    if (payload.type === "available" || payload.type === "not-available") lastSuccessfulCheckAt = Date.now();
    const eventPayload = {
      currentVersion: app.getVersion(),
      silent: updaterSilent,
      checkedAt: lastSuccessfulCheckAt,
      ...payload
    };
    if (payload.type !== "checking" || !updaterSilent) lastUpdateEvent = eventPayload;
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("localitfy:auto-update-event", eventPayload);
    }
    return eventPayload;
  }

  function getUpdateState() { return { ...lastUpdateEvent, checkedAt: lastSuccessfulCheckAt }; }

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
            response.on("data", (chunk) => {
              // GitHub release metadata should be small. Never let a bad or
              // unexpectedly huge response exhaust the Electron main process.
              body += chunk;
              if (body.length > 1024 * 1024) { request.destroy(); resolve(null); }
            });
            response.on("end", () => {
              try {
                if (response.statusCode !== 200) {
                  resolve(null);
                  return;
                }

                const data = JSON.parse(body || "{}");
                const tag = String(data.tag_name || data.name || "").trim();
                const version = normalizeUpdateVersion(tag);
                const assets = Array.isArray(data.assets) ? data.assets : [];
                // Accept only the nonempty AppImage that belongs to this stable
                // published version, rather than any similarly named release asset.
                const assetName = `localtify-${version}-x86_64.AppImage`;
                const expectedUrl = `https://github.com/meshahid973/localtify/releases/download/${tag}/${assetName}`;
                const appImageAsset = /^v\d+\.\d+\.\d+$/.test(tag)
                  ? assets.find(asset => asset?.name === assetName &&
                      Number.isFinite(Number(asset.size)) && Number(asset.size) > 0 &&
                      asset.browser_download_url === expectedUrl)
                  : null;

                resolve({
                  version,
                  tag,
                  releaseUrl: String(data.html_url || LOCALTIFY_LINUX_RELEASES_URL),
                  downloadUrl: String(appImageAsset?.browser_download_url || ""),
                  verifiedAsset: Boolean(appImageAsset),
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
    if (!latest?.version || !latest.verifiedAsset) {
      sendAutoUpdateEvent({ type: "error", platform:"linux", manualOnly:true, silent:Boolean(payload?.silent), message:"Unable to verify a Linux AppImage release.", error:"Release metadata is unavailable or the AppImage asset is missing." });
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
      // A successful check with no new release is not a network failure.
      // The renderer retries only false results with exponential backoff.
      return true;
    }

    lastUpdateInfo = latest;
    sendLinuxManualUpdateEvent({
      version: latest.version,
      downloadUrl: latest.downloadUrl || latest.releaseUrl || LOCALTIFY_LINUX_RELEASES_URL,
      releaseNotes: latest.releaseNotes || "",
      reason: "linux-manual-update-available"
    });
    return true;
  }

  async function openLinuxUpdateReleaseLink(reason = "manual-link") {
    const candidate = String(lastUpdateInfo?.downloadUrl || "");
    const url = /^https:\/\/github\.com\/meshahid973\/localtify\/releases\/download\//.test(candidate) ? candidate : LOCALTIFY_LINUX_RELEASES_URL;
    // Opening an external URL never changes an update's downloaded/installed state.
    void reason;
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
      if (!updaterSilent) sendAutoUpdateEvent({ type: "checking", message: "Checking for updates..." });
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
      if (updateDownloaded) return; // Preserve pending install if a check raced a download.
      lastUpdateInfo = cleanInfo;
      sendAutoUpdateEvent({
        type: "available",
        version: cleanInfo.version,
        info: cleanInfo,
        releaseNotes: cleanInfo.releaseNotes,
        message: `${appName} ${cleanInfo.version} is available`
      });
    });
    autoUpdater.on("update-not-available", (info) => {
      const cleanInfo = safeUpdateInfo(info);
      updaterChecking = false;
      if (updateDownloaded) return;
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
        downloadedBytes: Number(progress?.transferred || 0),
        totalBytes: Number(progress?.total || 0),
        speedBytesPerSecond: Number(progress?.bytesPerSecond || 0),
        message: `downloading update... ${Math.round(percent)}%`
      });
    });
    autoUpdater.on("update-downloaded", (info) => {
      const cleanInfo = safeUpdateInfo(info);
      updaterChecking = false;
      updateDownloaded = true;
      updateDownloading = false;
      lastUpdateInfo = cleanInfo;
      sendAutoUpdateEvent({
        type: "downloaded",
        version: cleanInfo.version,
        info: cleanInfo,
        releaseNotes: cleanInfo.releaseNotes,
        percent: 100,
        message: "update downloaded. restart localtify to install it."
      });
    });
    autoUpdater.on("error", (error) => {
      const failedDownload = updateDownloading;
      updaterChecking = false;
      updateDownloading = false;
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
        silent: failedDownload ? false : updaterSilent,
        message: failedDownload ? "update download failed" : "update check failed",
        error: error?.message || String(error || "unknown updater error")
      });
    });
  }

  async function checkForUpdates(payload = {}) {
    setupAutoUpdater();
    if (updaterChecking) {
      // A manual check during a background check should receive the eventual result.
      if (!payload?.silent) updaterSilent = false;
      return true;
    }
    if (updateDownloading) return true;
    updaterSilent = Boolean(payload?.silent);
    // Checking again must not invalidate a verified, already downloaded installer.
    if (updateDownloaded) {
      if (!updaterSilent) sendAutoUpdateEvent({
        type: "downloaded", version: lastUpdateInfo?.version || "latest",
        releaseNotes: lastUpdateInfo?.releaseNotes || "", percent: 100,
        message: "Update already downloaded. Restart to install it."
      });
      return true;
    }
    if (isDev) {
      sendAutoUpdateEvent({ type: "dev", message: "auto update only works in the packaged app" });
      return false;
    }

    const linuxManualResult = await checkLinuxManualReleaseUpdate(payload);
    if (linuxManualResult !== null) return linuxManualResult;
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
    if (updateDownloading || updateDownloaded) return false;
    if (!lastUpdateInfo || compareUpdateVersions(lastUpdateInfo.version, app.getVersion()) <= 0) {
      sendAutoUpdateEvent({type:"error",silent:false,error:"Check for a newer verified release before downloading."});
      return false;
    }
    updateDownloading = true;
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
      updateDownloading = false;
      sendAutoUpdateEvent({
        type: "error",
        silent: false,
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
    getUpdateState,
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
