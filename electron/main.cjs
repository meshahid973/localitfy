/* localtify 0.3.5 V168 — packaged renderer load + local media URL repair. */
const { app, BrowserWindow, dialog, ipcMain, shell, session, Menu, Tray, nativeImage, globalShortcut, screen, protocol, net } = require("electron");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const ffmpegStatic = require("ffmpeg-static");
const { autoUpdater } = require("electron-updater");

const {
  initDatabase,
  getSongs,
  insertSongs,
  patchSong,
  deleteSong,
  clearLibrary,
  getSettings,
  saveSettings,
  getPlaylists,
  savePlaylists,
  backupDatabase,
  repairDatabaseNow,
  getDatabaseStatus
} = require("./db.cjs");

const { setDiscordActivity, clearDiscordActivity, shutdownDiscordActivity, getDiscordStatus, resetDiscordActivityCache } = require("./rpc.cjs");
const {
  initDownloader,
  downloadAudioUrls,
  cancelActiveDownloads,
  convertLocalMediaFiles,
  isSupportedMediaPath,
  downloadSpotifyBatch
} = require("./downloader.cjs");

const isDev = !app.isPackaged;

const MEDIA_PROTOCOL = "localtify-media";
const MEDIA_PROTOCOL_HOST = "file";
const MEDIA_SERVER_HOST = "127.0.0.1";
const MEDIA_SERVER_TOKEN = crypto.randomBytes(18).toString("hex");
const MEDIA_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MEDIA_TOKEN_MAX_ENTRIES = 2500;
const mediaTokenToPath = new Map();
const mediaPathKeyToToken = new Map();
let mediaServer = null;
let mediaServerPort = 0;
let mediaServerReadyPromise = null;

try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
        bypassCSP: true
      }
    }
  ]);
} catch (error) {
  console.log("[localitfy media protocol privilege error]", error?.message || error);
}

const APP_NAME = "localtify";
const LEGACY_APP_DATA_NAME = "localitfy";
const SQLITE_FILE_NAME = "localitfy.sqlite";
const APP_USER_MODEL_ID = "com.meshahid973.localitfy";

function uniquePaths(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = path.normalize(item).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getStableUserDataPath() {
  return path.join(app.getPath("appData"), LEGACY_APP_DATA_NAME);
}

function configureStableUserDataPath() {
  try {
    const stablePath = getStableUserDataPath();
    fs.mkdirSync(stablePath, { recursive: true });
    app.setPath("userData", stablePath);
    return stablePath;
  } catch (error) {
    console.log("[localitfy userData path error]", error?.message || error);
    return app.getPath("userData");
  }
}

const STABLE_USER_DATA_PATH = configureStableUserDataPath();

try {
  app.setName(APP_NAME);
} catch {
}

if (process.platform === "win32") {
  try {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  } catch {
  }
}

function getUserDataRecoveryCandidates() {
  const appData = app.getPath("appData");
  return uniquePaths([
    STABLE_USER_DATA_PATH,
    path.join(appData, "localtify"),
    path.join(appData, "localitfy"),
    path.join(appData, "Electron")
  ]);
}

function getCandidateDatabaseInfo(dirPath) {
  const filePath = path.join(dirPath, SQLITE_FILE_NAME);
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) return null;
    return { dirPath, filePath, size: stat.size, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

function restoreDatabaseFromOldUserDataIfNeeded() {
  const stableDbPath = path.join(app.getPath("userData"), SQLITE_FILE_NAME);
  const stableInfo = getCandidateDatabaseInfo(app.getPath("userData"));
  if (stableInfo) return { restored: false, dbPath: stableDbPath, source: stableInfo.filePath };
  const candidates = getUserDataRecoveryCandidates()
    .map(getCandidateDatabaseInfo)
    .filter(Boolean)
    .filter((item) => path.normalize(item.filePath).toLowerCase() !== path.normalize(stableDbPath).toLowerCase())
    .sort((a, b) => (b.mtimeMs - a.mtimeMs) || (b.size - a.size));
  const best = candidates[0];
  if (!best) return { restored: false, dbPath: stableDbPath, source: "" };
  try {
    fs.mkdirSync(path.dirname(stableDbPath), { recursive: true });
    fs.copyFileSync(best.filePath, stableDbPath);
    console.log("[localitfy database restored]", { from: best.filePath, to: stableDbPath });
    return { restored: true, dbPath: stableDbPath, source: best.filePath };
  } catch (error) {
    console.log("[localitfy database restore error]", error?.message || error);
    return { restored: false, dbPath: stableDbPath, source: best.filePath, error: error?.message || String(error) };
  }
}

let mainWindow = null;
let lastAssignedCoverPath = "";

const UPDATE_CHECK_STARTUP_DELAY_MS = 2200;

let updaterReady = false;
let updaterChecking = false;
let updaterSilent = true;
let updateDownloaded = false;
let lastUpdateInfo = null;

let tray = null;
let allowQuit = false;
let minimizeToTray = false;
let nativeShortcutsRegistered = false;
let nativeMediaState = {
  isPlaying: false,
  volume: 0.75,
  muted: false,
  title: "",
  artist: "",
  album: "",
  coverUrl: "",
  hasSong: false
};

function getLoginItemOptions(openAtLogin = false) {
  const options = {
    openAtLogin: Boolean(openAtLogin),
    openAsHidden: false,
    name: APP_NAME
  };
  if (isDev && process.defaultApp) {
    options.path = process.execPath;
    options.args = [app.getAppPath()];
  }
  return options;
}

function getStartWithWindowsStatus() {
  if (process.platform !== "win32") {
    return { ok: true, supported: false, openAtLogin: false };
  }
  try {
    const current = app.getLoginItemSettings(getLoginItemOptions(false));
    return {
      ok: true,
      supported: true,
      openAtLogin: Boolean(current.openAtLogin),
      openAsHidden: Boolean(current.openAsHidden),
      wasOpenedAtLogin: Boolean(current.wasOpenedAtLogin),
      wasOpenedAsHidden: Boolean(current.wasOpenedAsHidden),
      restoreState: current.restoreState || ""
    };
  } catch (error) {
    return {
      ok: false,
      supported: true,
      openAtLogin: false,
      error: error?.message || String(error || "startup setting failed")
    };
  }
}

function setStartWithWindows(enabled) {
  if (process.platform !== "win32") {
    return { ok: true, supported: false, openAtLogin: false };
  }
  try {
    app.setLoginItemSettings(getLoginItemOptions(Boolean(enabled)));
    return getStartWithWindowsStatus();
  } catch (error) {
    return {
      ok: false,
      supported: true,
      openAtLogin: false,
      error: error?.message || String(error || "startup setting failed")
    };
  }
}

function syncWindowsIntegrationSettings(settings = {}, options = {}) {
  const hasSavedStartupChoice = Object.prototype.hasOwnProperty.call(settings || {}, "startWithWindows");
  const startWithWindows = hasSavedStartupChoice ? Boolean(settings.startWithWindows) : true;
  const startupStatus = setStartWithWindows(startWithWindows);
  if (!hasSavedStartupChoice && options.persistDefault) {
    try {
      saveSettings({ startWithWindows: true });
    } catch (error) {
      console.log("[localitfy startup default save error]", error?.message || error);
    }
  }
  return startupStatus;
}

function sendPlayerCommand(command) {
  if (!command || typeof command !== "object") return false;
  const payload = {
    ...command,
    source: command.source || "native"
  };
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("player:command", payload);
      return true;
    }
  } catch (error) {
    console.log("[localitfy native command error]", error?.message || error);
  }
  return false;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return true;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  return true;
}

function createSvgNativeImage(iconName) {
  const iconPaths = {
    previous: "M17 18V6h-2v5.2L7 6v12l8-5.2V18h2z",
    next: "M7 6v12l8-5.2V18h2V6h-2v5.2L7 6z",
    play: "M8 5v14l11-7L8 5z",
    pause: "M7 5h4v14H7V5zm6 0h4v14h-4V5z",
    stop: "M7 7h10v10H7V7z"
  };
  const pathData = iconPaths[iconName] || iconPaths.play;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="white" d="${pathData}"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function safePathJoin(...parts) {
  try {
    if (parts.some((part) => !part)) return "";
    return path.join(...parts);
  } catch {
    return "";
  }
}

function getAppIconPathCandidates() {
  const appPath = (() => {
    try { return app.getAppPath(); } catch { return ""; }
  })();
  return [
    safePathJoin(process.cwd(), "build", "icon.ico"),
    safePathJoin(__dirname, "build", "icon.ico"),
    safePathJoin(__dirname, "..", "build", "icon.ico"),
    safePathJoin(appPath, "build", "icon.ico"),
    safePathJoin(process.resourcesPath || "", "build", "icon.ico"),
    safePathJoin(process.resourcesPath || "", "app", "build", "icon.ico"),
    safePathJoin(process.resourcesPath || "", "app.asar.unpacked", "build", "icon.ico"),
    safePathJoin(__dirname, "assets", "icon.ico"),
    safePathJoin(__dirname, "assets", "icon.png"),
    safePathJoin(__dirname, "assets", "logo.png"),
    safePathJoin(__dirname, "..", "assets", "icon.ico"),
    safePathJoin(__dirname, "..", "assets", "icon.png"),
    safePathJoin(__dirname, "..", "assets", "logo.png"),
    safePathJoin(process.resourcesPath || "", "assets", "icon.ico"),
    safePathJoin(process.resourcesPath || "", "assets", "icon.png"),
    safePathJoin(process.resourcesPath || "", "icon.ico"),
    safePathJoin(process.cwd(), "assets", "icon.ico"),
    safePathJoin(process.cwd(), "assets", "icon.png"),
    safePathJoin(process.cwd(), "public", "logo.png")
  ].filter(Boolean);
}

function getAppIconPath() {
  for (const iconPath of getAppIconPathCandidates()) {
    try {
      if (iconPath && fs.existsSync(iconPath)) return iconPath;
    } catch {
    }
  }
  return "";
}

function loadAppIcon(size = 0) {
  const iconPath = getAppIconPath();
  if (iconPath) {
    try {
      const image = nativeImage.createFromPath(iconPath);
      if (!image.isEmpty()) {
        return size ? image.resize({ width: size, height: size }) : image;
      }
    } catch (error) {
      console.log("[localitfy icon load error]", error?.message || error);
    }
  }
  const fallback = createSvgNativeImage(nativeMediaState.isPlaying ? "pause" : "play");
  return size ? fallback.resize({ width: size, height: size }) : fallback;
}

function loadTrayIcon() {
  return loadAppIcon(16);
}

function createThumbarIcon(iconName) {
  return createSvgNativeImage(iconName).resize({ width: 20, height: 20 });
}

function getNativeMediaTitle() {
  if (!nativeMediaState.hasSong) return "localtify";
  const title = nativeMediaState.title || "unknown song";
  const artist = nativeMediaState.artist || "";
  return artist ? `${title} — ${artist}` : title;
}

function updateTrayMenu() {
  if (!tray) return;
  try {
    tray.setToolTip(getNativeMediaTitle());
    tray.setImage(loadTrayIcon());
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open localtify", click: showMainWindow },
      { type: "separator" },
      {
        label: nativeMediaState.isPlaying ? "Pause" : "Play",
        enabled: nativeMediaState.hasSong,
        click: () => sendPlayerCommand({ type: "toggle" })
      },
      {
        label: "Previous",
        enabled: nativeMediaState.hasSong,
        click: () => sendPlayerCommand({ type: "prev" })
      },
      {
        label: "Next",
        enabled: nativeMediaState.hasSong,
        click: () => sendPlayerCommand({ type: "next" })
      },
      {
        label: nativeMediaState.muted || nativeMediaState.volume <= 0.01 ? "Unmute" : "Mute",
        enabled: nativeMediaState.hasSong,
        click: () => sendPlayerCommand({ type: "muteToggle" })
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          allowQuit = true;
          app.quit();
        }
      }
    ]));
  } catch (error) {
    console.log("[localitfy tray menu error]", error?.message || error);
  }
}

function ensureTray() {
  if (tray) {
    updateTrayMenu();
    return tray;
  }
  try {
    tray = new Tray(loadTrayIcon());
    tray.on("click", showMainWindow);
    tray.on("double-click", showMainWindow);
    updateTrayMenu();
  } catch (error) {
    console.log("[localitfy tray error]", error?.message || error);
  }
  return tray;
}

function updateTaskbarButtons() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (process.platform !== "win32") return;
  if (typeof mainWindow.setThumbarButtons !== "function") return;
  try {
    mainWindow.setThumbnailToolTip(nativeMediaState.hasSong ? `${getNativeMediaTitle()} - localtify` : "localtify");
    mainWindow.setThumbarButtons([
      {
        tooltip: "Previous",
        icon: createThumbarIcon("previous"),
        flags: ["enabled"],
        click: () => sendPlayerCommand({ type: "prev" })
      },
      {
        tooltip: nativeMediaState.isPlaying ? "Pause" : "Play",
        icon: createThumbarIcon(nativeMediaState.isPlaying ? "pause" : "play"),
        flags: ["enabled"],
        click: () => sendPlayerCommand({ type: "toggle" })
      },
      {
        tooltip: "Next",
        icon: createThumbarIcon("next"),
        flags: ["enabled"],
        click: () => sendPlayerCommand({ type: "next" })
      }
    ]);
  } catch (error) {
    console.log("[localitfy thumbar error]", error?.message || error);
  }
}

function registerNativeMediaKeys() {
  if (nativeShortcutsRegistered) return;
  nativeShortcutsRegistered = true;
  const shortcuts = [
    ["MediaPlayPause", { type: "toggle" }],
    ["MediaNextTrack", { type: "next" }],
    ["MediaPreviousTrack", { type: "prev" }],
    ["MediaStop", { type: "stop" }]
  ];
  for (const [accelerator, command] of shortcuts) {
    try {
      const ok = globalShortcut.register(accelerator, () => sendPlayerCommand(command));
      if (!ok) console.log(`[localitfy media key unavailable] ${accelerator}`);
    } catch (error) {
      console.log(`[localitfy media key error] ${accelerator}`, error?.message || error);
    }
  }
}

function cleanupNativeWindowsMedia() {
  try {
    globalShortcut.unregister("MediaPlayPause");
    globalShortcut.unregister("MediaNextTrack");
    globalShortcut.unregister("MediaPreviousTrack");
    globalShortcut.unregister("MediaStop");
  } catch {
  }
  if (tray) {
    try { tray.destroy(); } catch {}
    tray = null;
  }
}

function attachCloseToTray(win) {
  if (!win || win.__localitfyCloseToTrayAttached) return;
  win.__localitfyCloseToTrayAttached = true;
  win.on("close", (event) => {
    if (!minimizeToTray || allowQuit || win.isDestroyed()) return;
    event.preventDefault();
    win.hide();
    ensureTray();
  });
}

function updateNativeMediaState(payload = {}) {
  const volume = Number(payload.volume);
  nativeMediaState = {
    ...nativeMediaState,
    isPlaying: Boolean(payload.isPlaying),
    volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : nativeMediaState.volume,
    muted: Boolean(payload.muted),
    title: String(payload.title || ""),
    artist: String(payload.artist || ""),
    album: String(payload.album || ""),
    coverUrl: String(payload.coverUrl || ""),
    hasSong: Boolean(payload.hasSong)
  };
  if (Object.prototype.hasOwnProperty.call(payload, "minimizeToTray")) {
    minimizeToTray = Boolean(payload.minimizeToTray);
  }
  updateTrayMenu();
  updateTaskbarButtons();
  return { ok: true, state: nativeMediaState, minimizeToTray };
}

function setupNativeWindowsMediaIpc() {
  ipcMain.handle("localitfy:native-media-state", async (_event, payload = {}) => updateNativeMediaState(payload));
  ipcMain.handle("localitfy:set-minimize-to-tray", async (_event, payload = {}) => {
    minimizeToTray = typeof payload === "boolean" ? payload : Boolean(payload.enabled);
    if (minimizeToTray) ensureTray();
    updateTrayMenu();
    return { ok: true, minimizeToTray };
  });
  ipcMain.handle("localitfy:set-start-with-windows", async (_event, payload = {}) => {
    const enabled = typeof payload === "boolean" ? payload : Boolean(payload.enabled);
    const status = setStartWithWindows(enabled);
    try {
      saveSettings({ startWithWindows: Boolean(enabled) });
    } catch (error) {
      console.log("[localitfy startup setting save error]", error?.message || error);
    }
    return { ...status, openAtLogin: Boolean(enabled) };
  });
  ipcMain.handle("localitfy:get-start-with-windows", async () => getStartWithWindowsStatus());
  ipcMain.handle("localitfy:native-media-status", async () => ({
    ok: true,
    state: nativeMediaState,
    minimizeToTray,
    startWithWindows: getStartWithWindowsStatus(),
    trayReady: Boolean(tray),
    mediaKeysRegistered: nativeShortcutsRegistered
  }));
}

function setupNativeWindowsMedia() {
  ensureTray();
  updateTaskbarButtons();
  registerNativeMediaKeys();
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

function sendAutoUpdateEvent(payload) {
  const eventPayload = {
    currentVersion: app.getVersion(),
    silent: updaterSilent,
    ...payload
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("localitfy:auto-update-event", eventPayload);
  }
  return eventPayload;
}

function setupAutoUpdater() {
  if (updaterReady) return;
  updaterReady = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on("checking-for-update", () => {
    sendAutoUpdateEvent({ type: "checking", message: "checking for updates..." });
  });
  autoUpdater.on("update-available", (info) => {
    const cleanInfo = safeUpdateInfo(info);
    updaterChecking = false;
    updateDownloaded = false;
    lastUpdateInfo = cleanInfo;
    sendAutoUpdateEvent({
      type: "available",
      version: cleanInfo.version,
      info: cleanInfo,
      message: `${APP_NAME} ${cleanInfo.version} is available`
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
  if (updaterChecking) return true;
  updaterChecking = true;
  try {
    await autoUpdater.checkForUpdates();
    return true;
  } catch (error) {
    updaterChecking = false;
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

app.setName(APP_NAME);
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

try {
  // Localtify uses a custom frameless titlebar, so the native menu is not needed.
  // Doing this early also avoids a little packaged-app startup work.
  Menu.setApplicationMenu(null);
} catch (error) {
  console.log("[localtify menu cleanup error]", error?.message || error);
}

function encodeMediaFilePath(filePath) {
  return Buffer.from(String(filePath || ""), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeMediaFilePath(encodedPath) {
  const raw = String(encodedPath || "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function safeTextResponse(message, status = 404) {
  return new Response(String(message || "not found"), {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

function contentTypeForFile(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();

  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".flac") return "audio/flac";
  if (ext === ".m4a" || ext === ".aac") return "audio/mp4";

  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";

  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";

  return "application/octet-stream";
}

function addMediaResponseHeaders(res, filePath) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", contentTypeForFile(filePath));
}

function getMediaFileVersion(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return { version: `${Math.floor(stats.mtimeMs)}-${stats.size}`, sizeBytes: stats.size, mtimeMs: stats.mtimeMs };
  } catch {
    return { version: "missing", sizeBytes: 0, mtimeMs: 0 };
  }
}

function pruneMediaTokens(now = Date.now()) {
  for (const [token, entry] of mediaTokenToPath) {
    if (!entry || entry.expiresAt <= now) {
      mediaTokenToPath.delete(token);
      if (entry?.pathKey) mediaPathKeyToToken.delete(entry.pathKey);
    }
  }

  if (mediaTokenToPath.size <= MEDIA_TOKEN_MAX_ENTRIES) return;

  const overflow = mediaTokenToPath.size - MEDIA_TOKEN_MAX_ENTRIES;
  let removed = 0;

  for (const [token, entry] of mediaTokenToPath) {
    mediaTokenToPath.delete(token);
    if (entry?.pathKey) mediaPathKeyToToken.delete(entry.pathKey);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function createMediaToken(filePath) {
  const cleanPath = String(filePath || "");
  if (!cleanPath || !path.isAbsolute(cleanPath)) return null;

  const now = Date.now();
  pruneMediaTokens(now);

  const versionInfo = getMediaFileVersion(cleanPath);
  const pathKey = `${cleanPath}|${versionInfo.version}`;
  const existingToken = mediaPathKeyToToken.get(pathKey);
  const existingEntry = existingToken ? mediaTokenToPath.get(existingToken) : null;

  if (existingToken && existingEntry && existingEntry.expiresAt > now) {
    existingEntry.expiresAt = now + MEDIA_TOKEN_TTL_MS;
    return { token: existingToken, ...versionInfo };
  }

  if (existingToken) {
    mediaTokenToPath.delete(existingToken);
    mediaPathKeyToToken.delete(pathKey);
  }

  const token = crypto.randomBytes(18).toString("base64url");
  mediaTokenToPath.set(token, { filePath: cleanPath, pathKey, expiresAt: now + MEDIA_TOKEN_TTL_MS, ...versionInfo });
  mediaPathKeyToToken.set(pathKey, token);

  return { token, ...versionInfo };
}

function resolveMediaToken(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return null;

  const entry = mediaTokenToPath.get(cleanToken);
  if (!entry) return null;

  const now = Date.now();
  if (entry.expiresAt <= now) {
    mediaTokenToPath.delete(cleanToken);
    if (entry.pathKey) mediaPathKeyToToken.delete(entry.pathKey);
    return null;
  }

  entry.expiresAt = now + MEDIA_TOKEN_TTL_MS;
  return entry.filePath;
}

function sendMediaFile(req, res, filePath) {
  if (!filePath || !path.isAbsolute(filePath) || !fileExists(filePath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("media file not found");
    return;
  }

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("media file not found");
    return;
  }

  addMediaResponseHeaders(res, filePath);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    res.end("method not allowed");
    return;
  }

  const total = stat.size;
  const rangeHeader = String(req.headers.range || "");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);

    if (match) {
      let start = match[1] ? Number(match[1]) : 0;
      let end = match[2] ? Number(match[2]) : total - 1;

      if (!Number.isFinite(start) || start < 0) start = 0;
      if (!Number.isFinite(end) || end >= total) end = total - 1;

      if (start > end || start >= total) {
        res.writeHead(416, { "Content-Range": `bytes */${total}` });
        res.end();
        return;
      }

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": end - start + 1
      });

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      fs.createReadStream(filePath, { start, end })
        .on("error", () => res.destroy())
        .pipe(res);
      return;
    }
  }

  res.writeHead(200, { "Content-Length": total });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(filePath)
    .on("error", () => res.destroy())
    .pipe(res);
}

function startLocaltifyMediaServer() {
  if (mediaServerReadyPromise) return mediaServerReadyPromise;

  mediaServerReadyPromise = new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url || "/", `http://${MEDIA_SERVER_HOST}`);

        if (requestUrl.searchParams.get("t") !== MEDIA_SERVER_TOKEN) {
          res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
          res.end("media access denied");
          return;
        }

        const token = decodeURIComponent(requestUrl.pathname.replace(/^\/media\/?/, "").replace(/^\/+/, "").split("/")[0] || "");
        const filePath = resolveMediaToken(token);

        if (!filePath) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("media token expired or not found");
          return;
        }

        sendMediaFile(req, res, filePath);
      } catch (error) {
        console.log("[localtify media server request error]", error?.message || error);
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end("media server failed");
      }
    });

    server.once("error", (error) => {
      console.log("[localtify media server error]", error?.message || error);
      mediaServer = null;
      mediaServerPort = 0;
      resolve(false);
    });

    server.listen(0, MEDIA_SERVER_HOST, () => {
      mediaServer = server;
      const address = server.address();
      mediaServerPort = typeof address === "object" && address ? address.port : 0;
      console.log(`[localtify media server] http://${MEDIA_SERVER_HOST}:${mediaServerPort}`);
      resolve(true);
    });
  });

  return mediaServerReadyPromise;
}

function stopLocaltifyMediaServer() {
  if (!mediaServer) return;
  const server = mediaServer;
  mediaServer = null;
  mediaServerPort = 0;
  server.close(() => undefined);
}

function registerLocaltifyMediaProtocol() {
  if (protocol.__localtifyMediaProtocolReady) return;
  protocol.__localtifyMediaProtocolReady = true;

  protocol.handle(MEDIA_PROTOCOL, async (request) => {
    try {
      const parsed = new URL(request.url);
      const encodedPath = parsed.hostname === MEDIA_PROTOCOL_HOST
        ? parsed.pathname.replace(/^\/+/, "")
        : `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, "");
      const filePath = decodeMediaFilePath(encodedPath);

      if (!filePath || !path.isAbsolute(filePath)) {
        return safeTextResponse("invalid media path", 400);
      }

      if (!fileExists(filePath)) {
        return safeTextResponse("media file not found", 404);
      }

      return net.fetch(pathToFileURL(filePath).toString());
    } catch (error) {
      console.log("[localtify media protocol error]", error?.message || error);
      return safeTextResponse("media protocol failed", 500);
    }
  });
}

function safeFileUrl(filePath) {
  if (!filePath) return "";
  try {
    return pathToFileURL(filePath).toString();
  } catch {
    return "";
  }
}

function safeProtocolMediaUrl(filePath) {
  if (!filePath) return "";
  try {
    return `${MEDIA_PROTOCOL}://${MEDIA_PROTOCOL_HOST}/${encodeMediaFilePath(filePath)}`;
  } catch {
    return "";
  }
}

function safeMediaUrl(filePath) {
  if (!filePath) return "";

  const cleanPath = String(filePath);

  if (!mediaServerPort) {
    // Never hand file:// URLs to the renderer in packaged mode. Chromium blocks
    // local resources when webSecurity is enabled, which caused the black-screen
    // packaged build / broken cover-art loads.
    return safeProtocolMediaUrl(cleanPath);
  }

  const tokenInfo = createMediaToken(cleanPath);
  if (!tokenInfo?.token) return safeProtocolMediaUrl(cleanPath);

  return `http://${MEDIA_SERVER_HOST}:${mediaServerPort}/media/${encodeURIComponent(tokenInfo.token)}?t=${MEDIA_SERVER_TOKEN}&v=${encodeURIComponent(tokenInfo.version)}`;
}

function isAudioFile(filePath) {
  return /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(filePath || "");
}

function isImageFile(filePath) {
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(filePath || "");
}

function fileExists(filePath) {
  try {
    return !!filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function getDownloadDirectory(customFolder) {
  const fallback = path.join(app.getPath("downloads"), "localitfy");
  const raw = typeof customFolder === "string" ? customFolder.trim() : "";
  const target = raw && path.isAbsolute(raw) ? raw : fallback;
  try {
    fs.mkdirSync(target, { recursive: true });
    return target;
  } catch {
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function getFfmpegPath() {
  if (!ffmpegStatic) return null;
  if (app.isPackaged && ffmpegStatic.includes("app.asar")) {
    return ffmpegStatic.replace("app.asar", "app.asar.unpacked");
  }
  return ffmpegStatic;
}

async function getYouTubeCookiesFile() {
  try {
    const sess = session.defaultSession;
    const [ytCookies, googleCookies] = await Promise.all([
      sess.cookies.get({ domain: ".youtube.com" }),
      sess.cookies.get({ domain: ".google.com" })
    ]);
    const allCookies = [...ytCookies, ...googleCookies];
    if (!allCookies.length) return null;
    const lines = [
      "# Netscape HTTP Cookie File",
      "# https://curl.haxx.se/rfc/cookie_spec.html",
      "# Generated by localitfy",
      ""
    ];
    for (const cookie of allCookies) {
      const domain = cookie.domain.startsWith(".") ? cookie.domain : `.${cookie.domain}`;
      const subdomains = cookie.domain.startsWith(".") ? "TRUE" : "FALSE";
      const secure = cookie.secure ? "TRUE" : "FALSE";
      const expiry = cookie.expirationDate ? Math.floor(cookie.expirationDate) : 0;
      lines.push(`${domain}\t${subdomains}\t${cookie.path}\t${secure}\t${expiry}\t${cookie.name}\t${cookie.value}`);
    }
    const dir = app.getPath("userData");
    const targetPath = path.join(dir, "cookies.txt");
    fs.writeFileSync(targetPath, lines.join("\n"), "utf-8");
    return targetPath;
  } catch (error) {
    console.log("[localitfy cookies dump error]", error?.message || error);
    return null;
  }
}

function getPixelArtDirectory() {
  try {
    const root = app.getAppPath();
    const candidates = [
      path.join(root, "pixelart"),
      path.join(root, "public", "pixelart"),
      path.join(root, "dist", "pixelart"),
      path.join(process.cwd(), "pixelart"),
      path.join(process.cwd(), "public", "pixelart")
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    const defaultDir = path.join(app.getPath("userData"), "pixelart");
    fs.mkdirSync(defaultDir, { recursive: true });
    return defaultDir;
  } catch {
    return "";
  }
}

function getPixelArtFiles() {
  const root = getPixelArtDirectory();
  if (!root || !fs.existsSync(root)) return [];
  try {
    return fs.readdirSync(root)
      .map((name) => path.join(root, name))
      .filter(fileExists)
      .filter(isImageFile);
  } catch {
    return [];
  }
}

function listPixelPacksDetailed() {
  const root = getPixelArtDirectory();
  if (!root || !fs.existsSync(root)) return [];
  const packs = [];
  try {
    const items = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of items) {
      if (!entry.isDirectory()) continue;
      const packPath = path.join(root, entry.name);
      const count = fs.readdirSync(packPath).map((name) => path.join(packPath, name)).filter(fileExists).filter(isImageFile).length;
      packs.push({ name: entry.name, path: packPath, count, active: false });
    }
  } catch (error) {
    console.log("[localitfy pixel packs error]", error?.message || error);
  }
  return packs;
}

function getPixelArtFilesFromPack(packName = "default") {
  const root = getPixelArtDirectory();
  if (!root || !fs.existsSync(root)) return [];
  const packPath = packName && packName !== "default" ? path.join(root, packName) : root;
  if (!fs.existsSync(packPath)) return getPixelArtFiles();
  try {
    return fs.readdirSync(packPath)
      .map((name) => path.join(packPath, name))
      .filter(fileExists)
      .filter(isImageFile);
  } catch {
    return [];
  }
}

function listPixelCoversDetailed() {
  const songs = getSongs();
  const usage = new Map();
  for (const song of songs) {
    if (!song.coverPath) continue;
    usage.set(song.coverPath, (usage.get(song.coverPath) || 0) + 1);
  }
  return getPixelArtFiles().map((coverPath) => ({
    name: path.basename(coverPath),
    key: path.parse(coverPath).name,
    path: coverPath,
    url: safeMediaUrl(coverPath),
    usageCount: usage.get(coverPath) || 0,
    exists: fileExists(coverPath),
    broken: !fileExists(coverPath)
  }));
}

function getCoverStats() {
  const songs = getSongs();
  const covers = listPixelCoversDetailed();
  const brokenSongs = songs
    .filter((song) => song.coverPath && !fileExists(song.coverPath))
    .map((song) => ({ id: song.id, title: song.title, coverPath: song.coverPath }));
  return {
    pixelDir: getPixelArtDirectory(),
    coverCount: covers.length,
    songCount: songs.length,
    songsWithCovers: songs.filter((song) => Boolean(song.coverPath)).length,
    songsMissingCovers: songs.filter((song) => !song.coverPath).length,
    songsWithBrokenCovers: brokenSongs.length,
    brokenItems: brokenSongs
  };
}

function pickLeastUsedCover(availableCovers = [], fallbackSongs = [], choices = {}) {
  if (!availableCovers.length) return "";
  const songs = fallbackSongs.length ? fallbackSongs : getSongs();
  const usage = new Map();
  for (const p of availableCovers) usage.set(p, 0);
  for (const song of songs) {
    if (song.coverPath && usage.has(song.coverPath)) {
      usage.set(song.coverPath, usage.get(song.coverPath) + 1);
    }
  }
  let candidates = [...availableCovers];
  if (choices.avoidSelectedCurrent && choices.currentPath) {
    candidates = candidates.filter((p) => p !== choices.currentPath);
  }
  if (!candidates.length) candidates = [...availableCovers];
  candidates.sort((a, b) => (usage.get(a) || 0) - (usage.get(b) || 0));
  const minCount = usage.get(candidates[0]) || 0;
  const bestPool = candidates.filter((p) => (usage.get(p) || 0) === minCount);
  const selected = bestPool[Math.floor(Math.random() * bestPool.length)];
  if (selected) lastAssignedCoverPath = selected;
  return selected || "";
}

function makeSongFromFile(filePath, pixelArtFiles = [], usedCovers = new Set()) {
  const parsed = path.parse(filePath);
  const parts = parsed.name.split(" - ").map((item) => item.trim());
  let artist = "";
  let title = parsed.name;
  if (parts.length >= 2) {
    artist = parts[0];
    title = parts.slice(1).join(" - ");
  }
  const id = crypto.createHash("sha256").update(filePath).digest("hex");
  let chosenCover = "";
  if (pixelArtFiles.length) {
    const available = pixelArtFiles.filter((p) => !usedCovers.has(p));
    chosenCover = pickLeastUsedCover(available.length ? available : pixelArtFiles);
    if (chosenCover) usedCovers.add(chosenCover);
  }
  return {
    id,
    title,
    artist,
    album: "",
    filePath,
    coverPath: chosenCover,
    duration: 0,
    bitrate: 0,
    addedAt: Date.now()
  };
}

function shapeSong(song) {
  if (!song) return null;
  const exists = fileExists(song.filePath);
  const coverExists = fileExists(song.coverPath);
  return {
    ...song,
    // Keep database/bootstrap rows clean. Audio URLs are resolved lazily from filePath by playback:resolve-url.
    url: "",
    coverUrl: safeMediaUrl(song.coverPath),
    exists,
    fileExists: exists,
    coverExists
  };
}

function listSongsShaped() {
  return getSongs().map(shapeSong);
}

function buildRandomizeMissingSongCovers() {
  const covers = getPixelArtFiles();
  if (!covers.length) return listSongsShaped();
  const songs = getSongs();
  const targetSongs = songs.filter((song) => !song.coverPath || !fileExists(song.coverPath));
  for (const song of targetSongs) {
    const chosen = pickLeastUsedCover(covers, songs, { avoidSelectedCurrent: true });
    if (!chosen) continue;
    patchSong(song.id, { coverPath: chosen });
  }
  return listSongsShaped();
}

function analyzeVolumeGain(filePath) {
  return new Promise((resolve) => {
    if (!fileExists(filePath) || !isAudioFile(filePath)) {
      resolve({ ok: false, volumeGain: 1, error: "file missing or unsupported" });
      return;
    }
    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath || !fileExists(ffmpegPath)) {
      resolve({ ok: false, volumeGain: 1, error: "ffmpeg missing" });
      return;
    }
    execFile(
      ffmpegPath,
      ["-hide_banner", "-nostats", "-i", filePath, "-af", "volumedetect", "-f", "null", "-"],
      { windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024 * 6 },
      (error, stdout, stderr) => {
        const text = `${stdout || ""}\n${stderr || ""}`;
        const mean = Number((text.match(/mean_volume:\s*(-?[0-9.]+) dB/i) || [])[1]);
        const max = Number((text.match(/max_volume:\s*(-?[0-9.]+) dB/i) || [])[1]);
        if (!Number.isFinite(mean)) {
          resolve({ ok: false, volumeGain: 1, error: error?.message || "could not read volume" });
          return;
        }
        let gainDb = -18 - mean;
        if (Number.isFinite(max)) gainDb = Math.min(gainDb, -1 - max);
        gainDb = Math.max(-12, Math.min(12, gainDb));
        const volumeGain = Math.max(0.25, Math.min(2.4, Math.pow(10, gainDb / 20)));
        resolve({ ok: true, meanVolumeDb: mean, maxVolumeDb: max, gainDb, volumeGain });
      }
    );
  });
}

function openImportDialog(senderWindow) {
  const dialogOptions = {
    title: "Import local music files to localtify library",
    buttonLabel: "Add to Library",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Audio Files", extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac"] }
    ]
  };
  return senderWindow && !senderWindow.isDestroyed()
    ? dialog.showOpenDialog(senderWindow, dialogOptions)
    : dialog.showOpenDialog(dialogOptions);
}

function filePathExistsForRenderer(filePath) {
  try {
    return Boolean(filePath) && fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function getRendererIndexPath() {
  const candidates = uniquePaths([
    // Correct packaged path when main.cjs lives inside /electron.
    path.join(app.getAppPath(), "dist", "index.html"),
    path.join(__dirname, "..", "dist", "index.html"),
    // Dev/alternate pack layouts.
    path.join(__dirname, "dist", "index.html"),
    path.join(process.resourcesPath || "", "app.asar", "dist", "index.html"),
    path.join(process.resourcesPath || "", "app", "dist", "index.html")
  ].filter(Boolean));

  const found = candidates.find(filePathExistsForRenderer);
  if (found) return found;

  console.log("[localtify renderer index missing] tried", candidates);
  return candidates[0];
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return;
  }
  const size = getSafeMainWindowSize();
  mainWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#0d0e12",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs"),
      webSecurity: true,
      backgroundThrottling: false
    }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173").catch((error) => {
      console.log("[localtify main window dev load error]", error?.message || error);
    });
  } else {
    const indexPath = getRendererIndexPath();
    console.log("[localtify renderer index]", indexPath);
    mainWindow.loadFile(indexPath).catch((error) => {
      console.log("[localtify main window packaged load error]", error?.message || error, indexPath);
    });
  }
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.log(`[localitfy main window failed load]`, { code, desc, url });
  });
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    console.log(`[localitfy main window renderer gone]`, details);
  });
  mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    console.log(`[localitfy main window console]`, { level, message, line, sourceId });
  });
  if (process.env.LOCALITFY_DEBUG === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  mainWindow.once("ready-to-show", () => {
    repairMainWindowBounds(mainWindow, { center: true });
    mainWindow.show();
  });
  attachCloseToTray(mainWindow);
}

const MAIN_WINDOW_DEFAULT_WIDTH = 1380;
const MAIN_WINDOW_DEFAULT_HEIGHT = 860;
const MAIN_WINDOW_MIN_WIDTH = 980;
const MAIN_WINDOW_MIN_HEIGHT = 640;

function getSafeMainWindowSize() {
  const display = screen.getPrimaryDisplay();
  const workArea = display?.workAreaSize || { width: MAIN_WINDOW_DEFAULT_WIDTH, height: MAIN_WINDOW_DEFAULT_HEIGHT };
  const width = Math.min(MAIN_WINDOW_DEFAULT_WIDTH, Math.max(MAIN_WINDOW_MIN_WIDTH, Math.floor(workArea.width * 0.94)));
  const height = Math.min(MAIN_WINDOW_DEFAULT_HEIGHT, Math.max(MAIN_WINDOW_MIN_HEIGHT, Math.floor(workArea.height * 0.9)));
  return { width, height };
}

function repairMainWindowBounds(win, options = {}) {
  if (!win || win.isDestroyed()) return;
  const display = screen.getDisplayMatching(win.getBounds()) || screen.getPrimaryDisplay();
  const workArea = display?.workArea;
  if (!workArea) return;
  const maxWidth = Math.max(520, workArea.width);
  const maxHeight = Math.max(420, workArea.height);
  const minWidth = Math.min(MAIN_WINDOW_MIN_WIDTH, maxWidth);
  const minHeight = Math.min(MAIN_WINDOW_MIN_HEIGHT, maxHeight);
  win.setMinimumSize(minWidth, minHeight);
  const current = win.getBounds();
  let width = Math.min(Math.max(current.width, minWidth), maxWidth);
  let height = Math.min(Math.max(current.height, minHeight), maxHeight);
  let x = current.x;
  let y = current.y;
  const offscreen = x + width < workArea.x + 180 || y + height < workArea.y + 120 || x > workArea.x + workArea.width - 180 || y > workArea.y + workArea.height - 120;
  if (options.center || offscreen) {
    x = Math.max(workArea.x, workArea.x + Math.floor((workArea.width - width) / 2));
    y = Math.max(workArea.y, workArea.y + Math.floor((workArea.height - height) / 2));
  } else {
    x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width));
    y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height));
  }
  win.setBounds({ x, y, width, height });
}

app.whenReady().then(async () => {
  registerLocaltifyMediaProtocol();
  await startLocaltifyMediaServer();
  initDownloader({ userDataPath: app.getPath("userData"), ffmpegPath: getFfmpegPath(), getCookiesFile: getYouTubeCookiesFile });
  const databaseRecovery = restoreDatabaseFromOldUserDataIfNeeded();
  initDatabase(databaseRecovery.dbPath || path.join(app.getPath("userData"), SQLITE_FILE_NAME));
  try {
    const savedSettings = getSettings();
    minimizeToTray = Boolean(savedSettings?.minimizeToTray);
    syncWindowsIntegrationSettings(savedSettings, { persistDefault: true });
  } catch {
    minimizeToTray = false;
    setStartWithWindows(true);
  }
  setupNativeWindowsMediaIpc();

  ipcMain.handle("app:bootstrap", async () => ({
    songs: listSongsShaped(),
    settings: getSettings(),
    playlists: getPlaylists(),
    windowsIntegration: getStartWithWindowsStatus(),
    database: { ...getDatabaseStatus(), userDataPath: app.getPath("userData"), dataFolderName: LEGACY_APP_DATA_NAME },
    discord: getDiscordStatus(),
    covers: getCoverStats()
  }));

  ipcMain.handle("playback:resolve-url", async (_event, payload = {}) => {
    try {
      const filePath = String(payload?.filePath || "").trim();

      if (!filePath || !path.isAbsolute(filePath)) {
        return { ok: false, fileExists: false, error: "invalid audio file path" };
      }

      if (!isAudioFile(filePath)) {
        return { ok: false, filePath, fileExists: fileExists(filePath), error: "unsupported audio file type" };
      }

      if (!fileExists(filePath)) {
        return { ok: false, filePath, fileExists: false, error: "audio file not found" };
      }

      const serverReady = await startLocaltifyMediaServer();
      if (!serverReady || !mediaServerPort) {
        return { ok: false, filePath, fileExists: true, error: "local media server unavailable" };
      }

      const versionInfo = getMediaFileVersion(filePath);
      return {
        ok: true,
        filePath,
        url: safeMediaUrl(filePath),
        fileExists: true,
        sizeBytes: versionInfo.sizeBytes,
        mtimeMs: versionInfo.mtimeMs,
        cacheTtlMs: MEDIA_TOKEN_TTL_MS
      };
    } catch (error) {
      console.log("[localtify playback resolve error]", error?.message || error);
      return { ok: false, fileExists: undefined, error: error?.message || "could not resolve playback url" };
    }
  });

  const pixelListHandler = async () => getPixelArtFiles().map((filePath) => ({ name: path.parse(filePath).name, key: path.parse(filePath).name, path: filePath, url: safeMediaUrl(filePath) }));
  ipcMain.handle("pixel:list", pixelListHandler);
  ipcMain.handle("art:list-pixel", pixelListHandler);
  ipcMain.handle("covers:list-pixelart", async () => {
    try { return listPixelCoversDetailed(); } catch (e) { console.log("[localitfy list covers error]", e?.message); return []; }
  });
  ipcMain.handle("covers:stats", async () => {
    try { return getCoverStats(); } catch (e) { console.log("[localitfy covers stats error]", e?.message); return {}; }
  });
  ipcMain.handle("covers:rescan", async () => buildRandomizeMissingSongCovers());
  ipcMain.handle("covers:randomize-all", async () => {
    const covers = getPixelArtFiles();
    if (!covers.length) return listSongsShaped();
    const songs = getSongs();
    for (const song of songs) {
      const chosen = pickLeastUsedCover(covers, songs, { avoidSelectedCurrent: true, currentPath: song.coverPath });
      if (chosen) patchSong(song.id, { coverPath: chosen });
    }
    return listSongsShaped();
  });
  ipcMain.handle("covers:randomize-missing", async () => buildRandomizeMissingSongCovers());
  ipcMain.handle("covers:randomize-selected", async (_event, ids) => {
    if (!Array.isArray(ids) || !ids.length) return listSongsShaped();
    const covers = getPixelArtFiles();
    if (!covers.length) return listSongsShaped();
    const songs = getSongs();
    for (const id of ids) {
      const song = songs.find((item) => item.id === id);
      if (!song) continue;
      const chosen = pickLeastUsedCover(covers, songs, { avoidSelectedCurrent: true, currentPath: song.coverPath });
      if (chosen) patchSong(id, { coverPath: chosen });
    }
    return listSongsShaped();
  });
  ipcMain.handle("covers:broken", async () => {
    try { return getCoverStats().brokenItems || []; } catch { return []; }
  });
  ipcMain.handle("covers:least-used", async () => {
    try { return pickLeastUsedCover(getPixelArtFiles()); } catch { return ""; }
  });
  ipcMain.handle("song:set-cover", async (_event, id, coverPath) => {
    const updated = patchSong(id, { coverPath });
    return updated ? shapeSong(updated) : null;
  });
  ipcMain.handle("song:pick-cover", async (_event, id) => {
    const covers = getPixelArtFiles();
    const song = getSongs().find((item) => item.id === id);
    const chosen = pickLeastUsedCover(covers, getSongs(), { avoidSelectedCurrent: true, currentPath: song?.coverPath });
    const updated = patchSong(id, { coverPath: chosen });
    return updated ? shapeSong(updated) : null;
  });
  ipcMain.handle("song:analyze-volume", async (_event, id) => {
    const target = getSongs().find((item) => item.id === id);
    if (!target) return { ok: false, volumeGain: 1, error: "song not in library database" };
    return analyzeVolumeGain(target.filePath);
  });
  ipcMain.handle("library:import", async (event) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const result = await openImportDialog(senderWindow);
      if (result.canceled || !result.filePaths?.length) return listSongsShaped();
      const validAudioFiles = result.filePaths.filter((f) => fileExists(f) && isAudioFile(f));
      if (!validAudioFiles.length) return listSongsShaped();
      const pixelArtFiles = getPixelArtFiles();
      const usedCovers = new Set();
      const importedSongs = validAudioFiles.map((f) => makeSongFromFile(f, pixelArtFiles, usedCovers));
      const changedCount = insertSongs(importedSongs);
      const afterSongs = listSongsShaped();
      console.log(`[localitfy import] selected=${validAudioFiles.length}, changed=${changedCount}, after=${afterSongs.length}`);
      return afterSongs;
    } catch (error) {
      console.log("[localitfy import error]", error?.stack || error?.message);
      return listSongsShaped();
    }
  });

  ipcMain.handle("media:convert-pick", async (event, payload) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const dialogOptions = {
        title: "choose videos or audio to convert",
        buttonLabel: "convert to mp3",
        defaultPath: app.getPath("downloads"),
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "media files", extensions: ["mp4", "webm", "mkv", "mov", "avi", "m4v", "mp3", "wav", "ogg", "flac", "m4a", "aac"] }]
      };
      const result = senderWindow && !senderWindow.isDestroyed() ? await dialog.showOpenDialog(senderWindow, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
      if (result.canceled || !result.filePaths.length) {
        return { downloadFolder: getDownloadDirectory(), conversions: [], changedCount: 0, songs: listSongsShaped() };
      }
      const validFiles = result.filePaths.filter((f) => fileExists(f) && isSupportedMediaPath(f));
      const converted = await convertLocalMediaFiles(
        validFiles,
        getDownloadDirectory(),
        { bitrate: payload?.bitrate || 192 },
        (progress) => { event.sender.send("download:progress", progress); }
      );
      const successfulFiles = converted.conversions
        .filter((item) => item.ok && item.filePath && fileExists(item.filePath) && isAudioFile(item.filePath))
        .map((item) => item.filePath);
      let changedCount = 0;
      let afterSongs = listSongsShaped();
      if (successfulFiles.length) {
        const pixelArtFiles = getPixelArtFiles();
        const usedCovers = new Set();
        const importedSongs = successfulFiles.map((f) => makeSongFromFile(f, pixelArtFiles, usedCovers));
        changedCount = insertSongs(importedSongs);
        afterSongs = listSongsShaped();
      }
      return { ...converted, changedCount, songs: afterSongs, downloadFolder: getDownloadDirectory() };
    } catch (error) {
      console.log("[localitfy convert pick error]", error?.message);
      return { downloadFolder: getDownloadDirectory(), conversions: [], changedCount: 0, songs: listSongsShaped() };
    }
  });

  ipcMain.handle("download:audio", async (event, payload) => {
    try {
      const urls = Array.isArray(payload?.urls) ? payload.urls : [payload?.url].filter(Boolean);
      const autoAdd = typeof payload?.autoAdd === "boolean" ? payload.autoAdd : true;
      const downloadFolder = getDownloadDirectory(payload?.folder);
      const result = await downloadAudioUrls(urls, downloadFolder, (progress) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        event.sender.send("download:progress", progress);
      }, { bitrate: payload?.bitrate || 192, proxy: payload?.proxy || "" });
      const successfulFiles = result.downloads
        .filter((item) => item.ok && item.filePath && fileExists(item.filePath) && isAudioFile(item.filePath))
        .map((item) => item.filePath);
      let changedCount = 0;
      let afterSongs = listSongsShaped();
      if (autoAdd && successfulFiles.length) {
        const pixelArtFiles = getPixelArtFiles();
        const usedCovers = new Set();
        const importedSongs = successfulFiles.map((f) => makeSongFromFile(f, pixelArtFiles, usedCovers));
        changedCount = insertSongs(importedSongs);
        afterSongs = listSongsShaped();
      }
      console.log(`[localitfy download] downloaded=${successfulFiles.length}, changed=${changedCount}, autoAdd=${autoAdd}`);
      return { ...result, changedCount, songs: afterSongs, autoAdd };
    } catch (error) {
      console.log("[localitfy download error]", error?.stack || error?.message);
      return {
        downloadFolder: getDownloadDirectory(),
        downloads: [{ ok: false, error: error?.message || "download failed" }],
        changedCount: 0,
        songs: listSongsShaped(),
        autoAdd: true
      };
    }
  });

  ipcMain.handle("download:cancel", async () => ({ cancelled: cancelActiveDownloads() }));
  ipcMain.handle("download:choose-folder", async () => {
    const owner = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    const result = await dialog.showOpenDialog(owner, { title: "Choose localtify download folder", properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, folder: "" };
    return { canceled: false, folder: result.filePaths[0] };
  });
  ipcMain.handle("download:open-folder", async (_event, folder) => {
    const target = getDownloadDirectory(folder);
    await shell.openPath(target);
    return true;
  });

  ipcMain.handle("song:patch", async (_event, id, patch) => {
    const updated = patchSong(id, patch);
    return updated ? shapeSong(updated) : null;
  });
  ipcMain.handle("song:random-cover", async (_event, id) => {
    const covers = getPixelArtFiles();
    const song = getSongs().find((item) => item.id === id);
    const chosen = pickLeastUsedCover(covers, song ? [song] : [], { avoidSelectedCurrent: true });
    const updated = patchSong(id, { coverPath: chosen });
    return updated ? shapeSong(updated) : null;
  });
  ipcMain.handle("song:delete", async (_event, id) => {
    try {
      deleteSong(id);
      return listSongsShaped();
    } catch (error) {
      console.log("[localitfy delete song error]", error?.message);
      return listSongsShaped();
    }
  });
  ipcMain.handle("library:clear", async () => {
    clearLibrary();
    return [];
  });

  ipcMain.handle("settings:get", async () => getSettings());
  ipcMain.handle("settings:save", async (_event, settings) => {
    try {
      if (!settings || typeof settings !== "object") return getSettings();
      if (Object.prototype.hasOwnProperty.call(settings, "startWithWindows")) {
        setStartWithWindows(Boolean(settings.startWithWindows));
      }
      if (Object.prototype.hasOwnProperty.call(settings, "minimizeToTray")) {
        minimizeToTray = Boolean(settings.minimizeToTray);
        if (minimizeToTray) ensureTray();
        updateTrayMenu();
      }
      return saveSettings(settings);
    } catch (error) {
      console.log("[localitfy settings save error]", error?.message);
      return getSettings();
    }
  });

  ipcMain.handle("playlists:get", async () => getPlaylists());
  ipcMain.handle("playlists:save", async (_event, playlists) => {
    try { return savePlaylists(playlists); } catch { return getPlaylists(); }
  });
  ipcMain.handle("database:backup-now", async () => {
    try { return { ok: backupDatabase() }; } catch (e) { return { ok: false, error: e?.message }; }
  });
  ipcMain.handle("database:repair-now", async () => {
    try {
      repairDatabaseNow();
      mediaTokenToPath.clear();
      mediaPathKeyToToken.clear();
      return { ok: true, status: getDatabaseStatus(), songs: listSongsShaped() };
    } catch (e) {
      return { ok: false, error: e?.message };
    }
  });
  ipcMain.handle("database:status", async () => getDatabaseStatus());

  ipcMain.handle("discord:set-activity", async (_event, payload) => {
    try { return { ok: await setDiscordActivity(payload) }; } catch { return { ok: false }; }
  });
  ipcMain.handle("discord:clear-activity", async () => {
    try { return { ok: await clearDiscordActivity() }; } catch { return { ok: false }; }
  });
  ipcMain.handle("discord:status", async () => getDiscordStatus());
  ipcMain.handle("discord:reset-cache", async () => {
    resetDiscordActivityCache();
    return true;
  });

  ipcMain.handle("spotify-fetch-tracks", async (_event, url) => {
    try {
      if (!url || typeof url !== "string") return { tracks: [] };
      const fallbackTracks = [
        { id: "mock-1", title: "Track Title One", artist: "Artist Name", duration: 180, albumName: "Mock Album" },
        { id: "mock-2", title: "Track Title Two", artist: "Artist Name", duration: 210, albumName: "Mock Album" }
      ];
      return { tracks: fallbackTracks };
    } catch (error) {
      console.log("[localitfy spotify fetch error]", error?.message);
      return { tracks: [], error: error?.message };
    }
  });

  ipcMain.handle("spotify-download-batch", async (event, { tracks, options }) => {
    try {
      const downloadFolder = getDownloadDirectory(options?.folder);
      const autoAdd = typeof options?.autoAdd === "boolean" ? options.autoAdd : true;
      const progressCallback = (progress) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        event.sender.send("download:progress", progress);
      };
      const result = await downloadSpotifyBatch(tracks, downloadFolder, progressCallback, options);
      const successfulFiles = result.downloads
        .filter((item) => item.ok && item.filePath && fileExists(item.filePath) && isAudioFile(item.filePath))
        .map((item) => item.filePath);
      let changedCount = 0;
      let afterSongs = listSongsShaped();
      if (autoAdd && successfulFiles.length) {
        const pixelArtFiles = getPixelArtFiles();
        const usedCovers = new Set();
        const importedSongs = successfulFiles.map((f) => makeSongFromFile(f, pixelArtFiles, usedCovers));
        changedCount = insertSongs(importedSongs);
        afterSongs = listSongsShaped();
      }
      return {
        ...result,
        changedCount,
        songs: afterSongs,
        downloadFolder
      };
    } catch (error) {
      console.log("[localitfy spotify batch download error]", error?.message);
      return {
        downloadFolder: getDownloadDirectory(options?.folder),
        downloads: [{ ok: false, error: error?.message || "batch download failed" }],
        changedCount: 0,
        songs: listSongsShaped()
      };
    }
  });

  ipcMain.handle("localitfy:check-for-updates", async (_event, payload) => checkForUpdates(payload));
  ipcMain.handle("localitfy:download-update", async () => downloadUpdate());
  ipcMain.handle("localitfy:install-update", async () => installUpdate());

  ipcMain.handle("window:minimize", async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
    return true;
  });
  ipcMain.handle("window:toggle-maximize", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    win.isMaximized() ? win.unmaximize() : win.maximize();
    return true;
  });
  ipcMain.handle("window:close", async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
    return true;
  });

  createWindow();
  setupNativeWindowsMedia();

  setTimeout(() => {
    checkForUpdates({ silent: true }).catch((e) => {
      console.log("[localitfy updater startup error]", e?.message);
    });
  }, UPDATE_CHECK_STARTUP_DELAY_MS);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", async () => {
  allowQuit = true;
  await shutdownDiscordActivity("app-before-quit");
  cleanupNativeWindowsMedia();
  stopLocaltifyMediaServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});