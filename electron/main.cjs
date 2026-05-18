const { app, BrowserWindow, dialog, ipcMain, shell, session, Menu, Tray, nativeImage, globalShortcut, screen } = require("electron");
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
  convertLocalMediaFiles,
  isSupportedMediaPath
} = require("./downloader.cjs");

const isDev = !app.isPackaged;

// Visible Windows/UI name can be localtify, but the app data folder must stay
// localitfy so old installs do not look empty after the branding rename.
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
  // app name is best-effort before app ready
}

if (process.platform === "win32") {
  try {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  } catch {
    // app user model id is only needed for Windows shell integration
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
let miniWindow = null;
let lastAssignedCoverPath = "";

let miniState = {
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.75,
  theme: "oled",
  repeatMode: "all",
  isShuffle: false
};

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

  // In development Windows otherwise registers Electron.exe with no app path.
  // In the packaged build electron-builder owns the shortcut and the default path is correct.
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
    // User project layout: localtify/build/icon.ico
    safePathJoin(process.cwd(), "build", "icon.ico"),
    safePathJoin(__dirname, "build", "icon.ico"),
    safePathJoin(__dirname, "..", "build", "icon.ico"),
    safePathJoin(appPath, "build", "icon.ico"),

    // Packaged fallbacks if electron-builder copies build into resources/app
    safePathJoin(process.resourcesPath || "", "build", "icon.ico"),
    safePathJoin(process.resourcesPath || "", "app", "build", "icon.ico"),
    safePathJoin(process.resourcesPath || "", "app.asar.unpacked", "build", "icon.ico"),

    // Older/fallback asset layouts
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
      // try the next path
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
    // ignore shutdown errors
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
      // Save the user's chosen value, not the OS readback.
      // Windows/dev Electron can report openAtLogin=false immediately after setting it,
      // which made the Settings toggle look like it turned itself back off.
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

// ====================== AUTO UPDATER ======================
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

// ====================== APP SETUP ======================
app.setName(APP_NAME);
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

function safeFileUrl(filePath) {
  if (!filePath) return "";
  return pathToFileURL(filePath).toString();
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

function getDownloadDirectory() {
  return path.join(app.getPath("downloads"), "localitfy");
}

function getFfmpegPath() {
  if (!ffmpegStatic) return null;
  if (app.isPackaged && ffmpegStatic.includes("app.asar")) {
    return ffmpegStatic.replace("app.asar", "app.asar.unpacked");
  }
  return ffmpegStatic;
}

// Exports YouTube + Google session cookies into a Netscape file yt-dlp can read
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
      lines.push(`${domain}\t${subdomains}\t${cookie.path || "/"}\t${secure}\t${expiry}\t${cookie.name}\t${cookie.value}`);
    }

    const cookiesPath = path.join(app.getPath("temp"), "localitfy-yt-cookies.txt");
    fs.writeFileSync(cookiesPath, lines.join("\n"), "utf-8");
    console.log(`[localitfy] wrote ${allCookies.length} cookies`);
    return cookiesPath;
  } catch (err) {
    console.log("[localitfy] getYouTubeCookiesFile error:", err?.message || err);
    return null;
  }
}

function getPixelArtDirectory() {
  const candidates = [
    path.join(process.resourcesPath || "", "pixelart"),
    path.join(process.cwd(), "pixelart"),
    path.join(app.getAppPath(), "pixelart"),
    path.join(path.dirname(app.getAppPath()), "pixelart")
  ];
  return candidates.find((c) => c && fs.existsSync(c)) || candidates[0];
}

function getPixelArtFiles() {
  const pixelDir = getPixelArtDirectory();
  if (!pixelDir || !fs.existsSync(pixelDir)) return [];
  return fs.readdirSync(pixelDir)
    .map((name) => path.join(pixelDir, name))
    .filter(fileExists)
    .filter(isImageFile);
}

function listPixelCoversShaped() {
  return getPixelArtFiles().map((coverPath) => ({
    name: path.basename(coverPath),
    path: coverPath,
    url: safeFileUrl(coverPath)
  }));
}

function getPixelArtPacks() {
  const root = getPixelArtDirectory();
  if (!root || !fs.existsSync(root)) {
    return [{ name: "default", path: root, count: 0, active: true }];
  }

  const rootFiles = getPixelArtFiles();
  const packs = [{ name: "default", path: root, count: rootFiles.length, active: true }];

  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
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
  if (!root) return [];

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
    url: safeFileUrl(coverPath),
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
    brokenCoverCount: brokenSongs.length,
    brokenSongs,
    packs: getPixelArtPacks(),
    covers
  };
}

function pickLeastUsedCover(availableCovers, selectedSongs = [], options = {}) {
  const covers = Array.isArray(availableCovers) ? availableCovers.filter(Boolean) : [];
  if (!covers.length) return null;

  const usage = new Map();
  for (const song of getSongs()) {
    if (song.coverPath) usage.set(song.coverPath, (usage.get(song.coverPath) || 0) + 1);
  }

  let pool = covers.filter((cover) => cover !== lastAssignedCoverPath);
  if (!pool.length) pool = covers;

  if (options.avoidSelectedCurrent) {
    const selectedCurrentCovers = new Set(selectedSongs.map((song) => song.coverPath).filter(Boolean));
    const filtered = pool.filter((cover) => !selectedCurrentCovers.has(cover));
    if (filtered.length) pool = filtered;
  }

  const lowestUsage = Math.min(...pool.map((cover) => usage.get(cover) || 0));
  const leastUsed = pool.filter((cover) => (usage.get(cover) || 0) === lowestUsage);
  const chosen = leastUsed[Math.floor(Math.random() * leastUsed.length)] || pool[0];

  lastAssignedCoverPath = chosen;
  return chosen;
}

function randomizeCoversForSongs(songIds = [], mode = "all") {
  const covers = getPixelArtFiles();
  if (!covers.length) return listSongsShaped();

  const wanted = new Set(Array.isArray(songIds) ? songIds.filter(Boolean) : []);
  const allSongs = getSongs();
  const targetSongs = allSongs.filter((song) => {
    if (wanted.size && !wanted.has(song.id)) return false;
    if (mode === "missing") return !song.coverPath || !fileExists(song.coverPath);
    return true;
  });

  for (const song of targetSongs) {
    const chosen = pickLeastUsedCover(covers, targetSongs, { avoidSelectedCurrent: true });
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

        // Aim for a gentle -18 dB mean, while never pushing peaks above about -1 dB.
        let gainDb = -18 - mean;
        if (Number.isFinite(max)) gainDb = Math.min(gainDb, -1 - max);
        gainDb = Math.max(-12, Math.min(12, gainDb));

        const volumeGain = Math.max(0.25, Math.min(2.4, Math.pow(10, gainDb / 20)));
        resolve({ ok: true, meanVolumeDb: mean, maxVolumeDb: max, gainDb, volumeGain });
      }
    );
  });
}

function pickCover(availableCovers, used = new Set()) {
  if (!availableCovers.length) return null;

  let pool = availableCovers.filter(
    (p) => p !== lastAssignedCoverPath && !used.has(p)
  );
  if (!pool.length) pool = availableCovers.filter((p) => p !== lastAssignedCoverPath);
  if (!pool.length) pool = availableCovers;

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  lastAssignedCoverPath = chosen;
  used.add(chosen);
  return chosen;
}

function makeSongFromFile(filePath, pixelArtFiles, usedCovers) {
  const parsed = path.parse(filePath);
  return {
    id: crypto.randomUUID(),
    title: parsed.name || "untitled",
    artist: "unknown artist",
    album: "local files",
    filePath,
    coverPath: pickCover(pixelArtFiles, usedCovers),
    liked: false,
    playCount: 0,
    duration: 0,
    dateAdded: new Date().toISOString(),
    lastPlayed: null,
    volumeGain: 1,
    playbackPosition: 0,
    customVolume: 1
  };
}

function shapeSong(song) {
  const songFileExists = fileExists(song.filePath);
  const coverFileExists = fileExists(song.coverPath);
  return {
    ...song,
    fileExists: songFileExists,
    url: songFileExists ? safeFileUrl(song.filePath) : "",
    coverUrl: coverFileExists ? safeFileUrl(song.coverPath) : null
  };
}

function listSongsShaped() {
  return getSongs().map(shapeSong);
}

async function loadRenderer(win, mini = false) {
  if (isDev) {
    await win.loadURL(`http://127.0.0.1:5173/${mini ? "?mini=1" : ""}`);
    return;
  }
  const indexPath = path.join(__dirname, "../dist/index.html");
  console.log("[localitfy renderer path]", indexPath, "exists:", fs.existsSync(indexPath));
  await win.loadFile(indexPath, mini ? { query: { mini: "1" } } : undefined);
}

function attachWindowDebug(win, label) {
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.log(`[localitfy ${label} failed load]`, { code, desc, url });
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    console.log(`[localitfy ${label} renderer gone]`, details);
  });
  win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    console.log(`[localitfy ${label} console]`, { level, message, line, sourceId });
  });
  if (process.env.LOCALITFY_DEBUG === "1") {
    win.webContents.openDevTools({ mode: "detach" });
  }
}


const MAIN_WINDOW_DEFAULT_WIDTH = 1380;
const MAIN_WINDOW_DEFAULT_HEIGHT = 860;
const MAIN_WINDOW_MIN_WIDTH = 980;
const MAIN_WINDOW_MIN_HEIGHT = 640;

function getSafeMainWindowSize() {
  const display = screen.getPrimaryDisplay();
  const workArea = display?.workAreaSize || { width: MAIN_WINDOW_DEFAULT_WIDTH, height: MAIN_WINDOW_DEFAULT_HEIGHT };

  const width = Math.min(
    MAIN_WINDOW_DEFAULT_WIDTH,
    Math.max(MAIN_WINDOW_MIN_WIDTH, Math.floor(workArea.width * 0.94))
  );

  const height = Math.min(
    MAIN_WINDOW_DEFAULT_HEIGHT,
    Math.max(MAIN_WINDOW_MIN_HEIGHT, Math.floor(workArea.height * 0.9))
  );

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

  const offscreen =
    x + width < workArea.x + 180 ||
    y + height < workArea.y + 120 ||
    x > workArea.x + workArea.width - 180 ||
    y > workArea.y + workArea.height - 120;

  if (options.center || offscreen) {
    x = Math.round(workArea.x + (workArea.width - width) / 2);
    y = Math.round(workArea.y + (workArea.height - height) / 2);
  } else {
    x = Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - width);
    y = Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - height);
  }

  if (
    current.x !== x ||
    current.y !== y ||
    current.width !== width ||
    current.height !== height
  ) {
    win.setBounds({ x, y, width, height }, false);
  }
}

function createWindow() {
  const safeSize = getSafeMainWindowSize();

  mainWindow = new BrowserWindow({
    width: safeSize.width,
    height: safeSize.height,
    minWidth: Math.min(MAIN_WINDOW_MIN_WIDTH, safeSize.width),
    minHeight: Math.min(MAIN_WINDOW_MIN_HEIGHT, safeSize.height),
    center: true,
    title: APP_NAME,
    icon: loadAppIcon(),
    frame: false,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  attachWindowDebug(mainWindow, "main");
  loadRenderer(mainWindow, false).catch((e) => {
    console.log("[localitfy main load error]", e?.stack || e?.message || e);
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      repairMainWindowBounds(mainWindow, { center: true });
      mainWindow.show();
      updateTaskbarButtons();
    }
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      repairMainWindowBounds(mainWindow, { center: true });
      mainWindow.show();
    }
  }, 1500);

  attachCloseToTray(mainWindow);
  mainWindow.on("show", () => {
    repairMainWindowBounds(mainWindow);
    updateTaskbarButtons();
  });
  mainWindow.on("restore", () => repairMainWindowBounds(mainWindow));
  mainWindow.on("focus", updateTaskbarButtons);
  mainWindow.webContents.on("did-finish-load", updateTaskbarButtons);
  updateTaskbarButtons();

  mainWindow.on("closed", () => {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
    mainWindow = null;
  });
}

function pushMiniState() {
  if (!miniWindow || miniWindow.isDestroyed()) return;
  miniWindow.webContents.send("mini:state", miniState);
}

function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.show();
    miniWindow.focus();
    pushMiniState();
    return miniWindow;
  }

  miniWindow = new BrowserWindow({
    width: 360,
    height: 540,
    minWidth: 300,
    minHeight: 420,
    maxWidth: 560,
    maxHeight: 780,
    title: `${APP_NAME} mini player`,
    icon: loadAppIcon(),
    frame: false,
    backgroundColor: "#050505",
    alwaysOnTop: true,
    resizable: true,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  attachWindowDebug(miniWindow, "mini");
  loadRenderer(miniWindow, true).catch((e) => {
    console.log("[localitfy mini load error]", e?.stack || e?.message || e);
  });

  miniWindow.once("ready-to-show", () => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.show();
      pushMiniState();
    }
  });

  setTimeout(() => {
    if (miniWindow && !miniWindow.isDestroyed() && !miniWindow.isVisible()) {
      miniWindow.show();
      pushMiniState();
    }
  }, 1500);

  miniWindow.on("closed", () => { miniWindow = null; });
  return miniWindow;
}

async function openImportDialog(senderWindow) {
  const options = {
    title: `import songs into ${APP_NAME}`,
    buttonLabel: "import songs",
    defaultPath: app.getPath("music"),
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "audio files", extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac"] },
      { name: "all files", extensions: ["*"] }
    ]
  };
  return senderWindow && !senderWindow.isDestroyed()
    ? dialog.showOpenDialog(senderWindow, options)
    : dialog.showOpenDialog(options);
}

// ====================== IPC HANDLERS ======================
app.whenReady().then(() => {
  initDownloader({
    userDataPath: app.getPath("userData"),
    ffmpegPath: getFfmpegPath(),
    getCookiesFile: getYouTubeCookiesFile
  });

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
    database: {
      ...getDatabaseStatus(),
      userDataPath: app.getPath("userData"),
      dataFolderName: LEGACY_APP_DATA_NAME
    },
    discord: getDiscordStatus(),
    covers: getCoverStats()
  }));

  // Pixel art
  const pixelListHandler = async () => getPixelArtFiles().map((filePath) => ({
    name: path.parse(filePath).name,
    key: path.parse(filePath).name,
    path: filePath,
    url: safeFileUrl(filePath)
  }));
  ipcMain.handle("pixel:list", pixelListHandler);
  ipcMain.handle("art:list-pixel", pixelListHandler);

  ipcMain.handle("covers:list-pixelart", async () => {
    try { return listPixelCoversDetailed(); }
    catch (e) { console.log("[localitfy list covers error]", e?.message); return []; }
  });

  ipcMain.handle("covers:stats", async () => getCoverStats());
  ipcMain.handle("covers:rescan", async () => getCoverStats());
  ipcMain.handle("covers:randomize-all", async () => randomizeCoversForSongs([], "all"));
  ipcMain.handle("covers:randomize-missing", async () => randomizeCoversForSongs([], "missing"));
  ipcMain.handle("covers:randomize-selected", async (_event, ids) => randomizeCoversForSongs(ids, "selected"));
  ipcMain.handle("covers:least-used", async () => {
    const chosen = pickLeastUsedCover(getPixelArtFiles(), [], { avoidSelectedCurrent: false });
    return chosen ? { path: chosen, url: safeFileUrl(chosen), name: path.basename(chosen) } : null;
  });
  ipcMain.handle("covers:broken", async () => getCoverStats().brokenSongs);

  // Cover setters
  const setCoverHandler = async (_event, id, coverPath) => {
    if (coverPath === null || coverPath === "") {
      const updated = patchSong(id, { coverPath: null });
      return updated ? shapeSong(updated) : null;
    }
    if (!fileExists(coverPath) || !isImageFile(coverPath)) return null;
    const updated = patchSong(id, { coverPath });
    return updated ? shapeSong(updated) : null;
  };
  ipcMain.handle("song:set-cover", setCoverHandler);
  ipcMain.handle("song:set-pixel-cover", setCoverHandler);

  // Library import
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

  // Convert local media
  ipcMain.handle("media:convert-pick", async (event, payload) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;

      const dialogOptions = {
        title: "choose videos or audio to convert",
        buttonLabel: "convert to mp3",
        defaultPath: app.getPath("downloads"),
        properties: ["openFile", "multiSelections"],
        filters: [{
          name: "media files",
          extensions: ["mp4", "webm", "mkv", "mov", "avi", "m4v", "mp3", "wav", "ogg", "flac", "m4a", "aac"]
        }]
      };

      const result = senderWindow && !senderWindow.isDestroyed()
        ? await dialog.showOpenDialog(senderWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

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

      const pixelArtFiles = getPixelArtFiles();
      const usedCovers = new Set();
      const importedSongs = successfulFiles.map((f) => makeSongFromFile(f, pixelArtFiles, usedCovers));
      const changedCount = insertSongs(importedSongs);
      const afterSongs = listSongsShaped();

      console.log(`[localitfy convert] converted=${successfulFiles.length}, changed=${changedCount}`);
      return { ...converted, changedCount, songs: afterSongs };
    } catch (error) {
      console.log("[localitfy convert error]", error?.stack || error?.message);
      return {
        downloadFolder: getDownloadDirectory(),
        conversions: [{ ok: false, error: error?.message || "conversion failed" }],
        changedCount: 0,
        songs: listSongsShaped()
      };
    }
  });

  // ✅ Download audio — full progress payload (progress + speed + size + eta) forwarded to renderer
  ipcMain.handle("download:audio", async (event, payload) => {
    try {
      const input = payload?.urls || payload?.text || "";
      const downloadDirectory = getDownloadDirectory();

      const result = await downloadAudioUrls(input, downloadDirectory, (progress) => {
        // progress now contains: { type, file, progress, speed, size, eta, message }
        // The renderer receives all fields and can display speed/eta in the UI
        event.sender.send("download:progress", progress);
      });

      const successfulFiles = result.downloads
        .filter((item) => item.ok && item.filePath && fileExists(item.filePath) && isAudioFile(item.filePath))
        .map((item) => item.filePath);

      const pixelArtFiles = getPixelArtFiles();
      const usedCovers = new Set();
      const importedSongs = successfulFiles.map((f) => makeSongFromFile(f, pixelArtFiles, usedCovers));
      const changedCount = insertSongs(importedSongs);
      const afterSongs = listSongsShaped();

      console.log(`[localitfy download] downloaded=${successfulFiles.length}, changed=${changedCount}`);
      return { ...result, changedCount, songs: afterSongs };
    } catch (error) {
      console.log("[localitfy download error]", error?.stack || error?.message);
      return {
        downloadFolder: getDownloadDirectory(),
        downloads: [{ ok: false, error: error?.message || "download failed" }],
        changedCount: 0,
        songs: listSongsShaped()
      };
    }
  });

  ipcMain.handle("download:open-folder", async () => {
    fs.mkdirSync(getDownloadDirectory(), { recursive: true });
    await shell.openPath(getDownloadDirectory());
    return true;
  });

  // Song handlers
  ipcMain.handle("song:patch", async (_event, id, patch) => {
    const updated = patchSong(id, patch);
    return updated ? shapeSong(updated) : null;
  });

  ipcMain.handle("song:random-cover", async (_event, id) => {
    const covers = getPixelArtFiles();
    const song = getSongs().find((item) => item.id === id);
    const chosen = pickLeastUsedCover(covers, song ? [song] : [], { avoidSelectedCurrent: true }) || pickCover(covers);
    if (!chosen) return null;
    const updated = patchSong(id, { coverPath: chosen });
    return updated ? shapeSong(updated) : null;
  });

  ipcMain.handle("song:analyze-volume", async (_event, id) => {
    const song = getSongs().find((item) => item.id === id);
    if (!song) return null;
    const result = await analyzeVolumeGain(song.filePath);
    if (result.ok) {
      const updated = patchSong(song.id, { volumeGain: result.volumeGain });
      return { ...result, song: updated ? shapeSong(updated) : null };
    }
    return result;
  });

  ipcMain.handle("song:pick-cover", async (event, id) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const options = {
      title: "choose album art",
      buttonLabel: "use image",
      defaultPath: app.getPath("pictures"),
      properties: ["openFile"],
      filters: [{ name: "images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
    };

    const result = senderWindow && !senderWindow.isDestroyed()
      ? await dialog.showOpenDialog(senderWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || !result.filePaths[0]) return null;
    const imagePath = result.filePaths[0];
    if (!fileExists(imagePath) || !isImageFile(imagePath)) return null;
    const updated = patchSong(id, { coverPath: imagePath });
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

  // Settings
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

  // Playlists
  ipcMain.handle("playlists:get", async () => getPlaylists());
  ipcMain.handle("playlists:save", async (_event, playlists) => {
    try {
      return savePlaylists(playlists);
    } catch (error) {
      console.log("[localitfy playlists save error]", error?.message);
      return getPlaylists();
    }
  });

  // Database diagnostics / repair
  ipcMain.handle("db:status", async () => getDatabaseStatus());
  ipcMain.handle("db:backup", async () => ({ backupPath: backupDatabase("manual") }));
  ipcMain.handle("db:repair", async () => repairDatabaseNow());

  // Discord
  ipcMain.handle("discord:status", async () => getDiscordStatus());
  ipcMain.handle("discord:reset", async () => {
    await resetDiscordActivityCache().catch(() => undefined);
    return getDiscordStatus();
  });

  ipcMain.handle("discord:update", async (_event, payload) => {
    await setDiscordActivity(payload).catch((e) => {
      console.log("[localitfy discord update error]", e?.message);
    });
    return getDiscordStatus();
  });
  ipcMain.handle("discord:clear", async () => {
    await clearDiscordActivity().catch(() => undefined);
    return getDiscordStatus();
  });

  // Mini window
  ipcMain.handle("mini:show", async () => { createMiniWindow(); return true; });
  ipcMain.handle("mini:hide", async () => {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
    miniWindow = null;
    return true;
  });
  ipcMain.handle("mini:get-state", async () => miniState);
  ipcMain.handle("mini:update-state", async (_event, payload) => {
    if (payload && typeof payload === "object") {
      miniState = { ...miniState, ...payload };
      pushMiniState();
    }
    return true;
  });

  ipcMain.handle("player:command", async (_event, command) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("player:command", command);
    }
    return true;
  });

  // Auto updater
  setupAutoUpdater();
  ipcMain.handle("localitfy:check-for-updates", async (_event, payload) => checkForUpdates(payload));
  ipcMain.handle("localitfy:download-update", async () => downloadUpdate());
  ipcMain.handle("localitfy:install-update", async () => installUpdate());

  // Window controls
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
  await shutdownDiscordActivity("app-before-quit").catch(() => undefined);
});

app.on("will-quit", () => {
  cleanupNativeWindowsMedia();
});

app.on("window-all-closed", async () => {
  await shutdownDiscordActivity("window-all-closed").catch(() => undefined);
  if (process.platform !== "darwin") app.quit();
});
