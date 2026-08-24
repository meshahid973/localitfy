/* localtify 0.4.1 V425 cover picker and cache cleanup. */
/* localtify 0.4.1 V424 â€” Windows startup white-screen recovery. */
const { app, BrowserWindow, dialog, ipcMain, shell, session, Menu, Tray, nativeImage, globalShortcut, screen, protocol, net } = require("electron");
const { createIpcRouter } = require("./ipc/router.cjs");
const { registerDiscordIpc } = require("./ipc/discord.cjs");
const { LOCALTIFY_RENDERER_PROTOCOL, MEDIA_PROTOCOL, registerPrivilegedSchemes } = require("./runtime/protocols.cjs");
const { DEFAULT_WINDOW_TRANSLUCENCY, normalizeWindowTranslucencySettings } = require("./runtime/windows.cjs");
const { createElectronServiceRuntime } = require("./runtime/services.cjs");
const { loadLocaltifyEnv } = require("./runtime/environment.cjs");
const { createUserDataRuntime } = require("./runtime/user-data.cjs");
const { createDatabaseRepositories } = require("./db/repositories.cjs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { pathToFileURL } = require("node:url");

process.env.DOTENV_CONFIG_QUIET = process.env.DOTENV_CONFIG_QUIET || "true";
process.env.DOTENVX_QUIET = process.env.DOTENVX_QUIET || "true";

loadLocaltifyEnv(app);
registerPrivilegedSchemes(protocol);

const ffmpegStatic = require("ffmpeg-static");
const { autoUpdater } = require("electron-updater");

const databaseRepositories = createDatabaseRepositories(require("./db.cjs"));
const initDatabase = databaseRepositories.database.init;
const backupDatabase = databaseRepositories.database.backup;
const repairDatabaseNow = databaseRepositories.database.repair;
const getDatabaseStatus = databaseRepositories.database.status;
const getSongs = databaseRepositories.songs.list;
const insertSongs = databaseRepositories.songs.insertMany;
const patchSong = databaseRepositories.songs.patch;
const deleteSong = databaseRepositories.songs.remove;
const clearLibrary = databaseRepositories.songs.clear;
const getSettings = databaseRepositories.settings.get;
const saveSettings = databaseRepositories.settings.save;
const getPlaylists = databaseRepositories.playlists.get;
const savePlaylists = databaseRepositories.playlists.save;

const { setDiscordActivity, clearDiscordActivity, getDiscordStatus, resetDiscordActivityCache } = require("./rpc.cjs");
const {
  downloadAudioUrls,
  cancelActiveDownloads,
  convertLocalMediaFiles,
  isSupportedMediaPath,
  downloadSpotifyBatch
} = require("./downloader.cjs");

const {
  readLocalAudioMetadata
} = require("./metadata-service.cjs");

const {
  findFolderCover,
  resolveSongCover
} = require("./cover-service.cjs");

const ipcRouter = createIpcRouter(ipcMain);

const isDev = !app.isPackaged;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  showMainWindow();
});

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

const COVER_THUMBNAIL_SIZE = 256;
const COVER_THUMBNAIL_DIR_NAME = "thumbnails";
const coverThumbnailUrlCache = new Map();
const coverThumbnailQueue = new Map();
let coverThumbnailWarmStarted = false;


const APP_NAME = "localtify";
const APP_USER_MODEL_ID = "com.meshahid973.localitfy";

const userDataRuntime = createUserDataRuntime({
  app,
  legacyAppDataName: "localitfy",
  sqliteFileName: "localitfy.sqlite"
});
userDataRuntime.configureStableUserDataPath();
const restoreDatabaseFromOldUserDataIfNeeded = userDataRuntime.restoreDatabaseFromOldUserDataIfNeeded;

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

let mainWindow = null;
let mainWindowRendererWatchdog = null;
let mainWindowRendererRecoveredOnce = false;
let startupLaunchStatus = { wasOpenedAtLogin: false, wasOpenedAsHidden: false };
let lastAssignedCoverPath = "";


function getSavedWindowTranslucencySettings() {
  try {
    return normalizeWindowTranslucencySettings(getSettings());
  } catch {
    return normalizeWindowTranslucencySettings();
  }
}

function applyWindowTranslucencyToWindow(win, settings = getSavedWindowTranslucencySettings()) {
  if (!win || win.isDestroyed()) return settings;
  const next = normalizeWindowTranslucencySettings(settings);

  try {
    // Never let the native window show Chromium's default white while Windows is
    // still starting. The renderer/CSS can still draw the glass UI on top.
    win.setBackgroundColor("#090012");
  } catch (error) {
    console.log("[localtify window background error]", error?.message || error);
  }

  try {
    if (process.platform === "win32" && typeof win.setBackgroundMaterial === "function") {
      // Keep this stable on Windows boot. DWM/acrylic can be late during login,
      // so Localtify uses CSS glass and a dark native background instead.
      win.setBackgroundMaterial('none');
    }
  } catch (error) {
    console.log("[localtify window material error]", error?.message || error);
  }

  try {
    if (process.platform === "darwin" && typeof win.setVibrancy === "function") {
      win.setVibrancy(next.translucentWindow ? "dark" : null);
    }
  } catch (error) {
    console.log("[localtify vibrancy error]", error?.message || error);
  }

  try {
    win.webContents?.send("localitfy:window-translucency-state", next);
  } catch {
  }

  return next;
}

function restartForWindowTranslucency() {
  try {
    allowQuit = true;
    app.relaunch();
  } catch (error) {
    console.log("[localtify relaunch error]", error?.message || error);
  }

  setTimeout(() => {
    try { app.exit(0); } catch { process.exit(0); }
  }, 120);
}

function reloadMainWindowForTranslucency() {
  const previousWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const previousBounds = (() => {
    try { return previousWindow ? previousWindow.getBounds() : null; } catch { return null; }
  })();
  const wasMaximized = (() => {
    try { return Boolean(previousWindow?.isMaximized?.()); } catch { return false; }
  })();
  const wasFullScreen = (() => {
    try { return Boolean(previousWindow?.isFullScreen?.()); } catch { return false; }
  })();

  try {
    if (previousWindow) {
      previousWindow.removeAllListeners("close");
      previousWindow.destroy();
    }
  } catch (error) {
    console.log("[localtify translucent window reload destroy error]", error?.message || error);
  }

  mainWindow = null;

  setTimeout(() => {
    try {
      createWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (previousBounds) {
          try { mainWindow.setBounds(previousBounds); } catch {}
        }
        if (wasMaximized) {
          try { mainWindow.maximize(); } catch {}
        }
        if (wasFullScreen) {
          try { mainWindow.setFullScreen(true); } catch {}
        }
      }
    } catch (error) {
      console.log("[localtify translucent window reload error]", error?.message || error);
    }
  }, 80);
}

const UPDATE_CHECK_STARTUP_DELAY_MS = 2200;
const PIXEL_ART_CACHE_TTL_MS = 30_000;
const FILE_INFO_CACHE_TTL_MS = 4_000;
const MAIN_TASK_YIELD_MS = 0;

let pixelArtDirectoryCache = { value: "", expiresAt: 0 };
let pixelArtFilesCache = { value: [], root: "", expiresAt: 0 };
const fileInfoCache = new Map();

function yieldToMainLoop() {
  return new Promise((resolve) => {
    if (typeof setImmediate === "function") setImmediate(resolve);
    else setTimeout(resolve, MAIN_TASK_YIELD_MS);
  });
}

function clearFileInfoCache() {
  fileInfoCache.clear();
}

function clearPixelArtCache() {
  pixelArtDirectoryCache = { value: "", expiresAt: 0 };
  pixelArtFilesCache = { value: [], root: "", expiresAt: 0 };
}

function getFileInfoCached(filePath) {
  const cleanPath = String(filePath || "");
  if (!cleanPath) return { exists: false, isFile: false, size: 0, mtimeMs: 0 };

  const now = Date.now();
  const cached = fileInfoCache.get(cleanPath);
  if (cached && cached.expiresAt > now) return cached.info;

  let info = { exists: false, isFile: false, size: 0, mtimeMs: 0 };
  try {
    const stat = fs.statSync(cleanPath);
    info = { exists: true, isFile: stat.isFile(), size: stat.size, mtimeMs: stat.mtimeMs };
  } catch {
    info = { exists: false, isFile: false, size: 0, mtimeMs: 0 };
  }

  fileInfoCache.set(cleanPath, { info, expiresAt: now + FILE_INFO_CACHE_TTL_MS });
  if (fileInfoCache.size > 4500) {
    let removed = 0;
    for (const [key, entry] of fileInfoCache) {
      if (entry.expiresAt <= now || removed < 500) {
        fileInfoCache.delete(key);
        removed += 1;
      }
      if (removed >= 750) break;
    }
  }

  return info;
}


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
  return artist ? `${title} â€” ${artist}` : title;
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
  ipcRouter.handle("localitfy:native-media-state", async (_event, payload = {}) => updateNativeMediaState(payload));
  ipcRouter.handle("localitfy:set-minimize-to-tray", async (_event, payload = {}) => {
    minimizeToTray = typeof payload === "boolean" ? payload : Boolean(payload.enabled);
    if (minimizeToTray) ensureTray();
    updateTrayMenu();
    return { ok: true, minimizeToTray };
  });
  ipcRouter.handle("localitfy:set-start-with-windows", async (_event, payload = {}) => {
    const enabled = typeof payload === "boolean" ? payload : Boolean(payload.enabled);
    const status = setStartWithWindows(enabled);
    try {
      saveSettings({ startWithWindows: Boolean(enabled) });
    } catch (error) {
      console.log("[localitfy startup setting save error]", error?.message || error);
    }
    return { ...status, openAtLogin: Boolean(enabled) };
  });
  ipcRouter.handle("localitfy:get-start-with-windows", async () => getStartWithWindowsStatus());
  ipcRouter.handle("localitfy:native-media-status", async () => ({
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
  autoUpdater.allowPrerelease = process.env.LOCALTIFY_ALLOW_PRERELEASE_UPDATES === "1";
  autoUpdater.allowDowngrade = false;

  if (linuxUpdaterIsManualOnly()) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
  }

  try { autoUpdater.logger = null; } catch {}
  autoUpdater.on("checking-for-update", () => {
    sendAutoUpdateEvent({ type: "checking", message: "checking for updates..." });
  });
  autoUpdater.on("update-available", (info) => {
    if (linuxUpdaterIsManualOnly()) {
      sendLinuxManualUpdateOnlyEvent({
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

function isLinuxUpdateMetadataMissingError(error) {
  const text = String(error?.message || error || "");
  return process.platform === "linux" && /latest-linux\.yml/i.test(text) && /404|Cannot find/i.test(text);
}

// LOCALTIFY_LINUX_MANUAL_UPDATE_LINK_FIX
// Linux AppImage updates must never auto-download or auto-install.
// The app only checks GitHub Releases, shows an update prompt, and the
// download/install buttons open GitHub instead of touching the running AppImage.
const LOCALTIFY_LINUX_RELEASES_URL = "https://github.com/meshahid973/localitfy/releases/latest";
const LOCALTIFY_GITHUB_LATEST_RELEASE_API = "https://api.github.com/repos/meshahid973/localitfy/releases/latest";

function isLinuxAppImageUpdateRuntime() {
  return Boolean(app.isPackaged && process.platform === "linux");
}

function linuxUpdaterIsManualOnly() {
  return isLinuxAppImageUpdateRuntime() && process.env.LOCALTIFY_ENABLE_LINUX_UPDATER !== "1";
}

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
  const hasNewerVersion = compareUpdateVersions(latest.version, currentVersion) > 0;

  if (!hasNewerVersion) {
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

  if (linuxUpdaterIsManualOnly()) {
    return openLinuxUpdateReleaseLink("download-button");
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

  if (linuxUpdaterIsManualOnly()) {
    return openLinuxUpdateReleaseLink("install-button");
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

function appendChromiumSwitchOnce(name, value) {
  try {
    if (!name) return false;
    if (typeof app.commandLine?.hasSwitch === "function" && app.commandLine.hasSwitch(name)) {
      return false;
    }

    if (typeof value === "undefined" || value === null || value === "") {
      app.commandLine.appendSwitch(name);
    } else {
      app.commandLine.appendSwitch(name, String(value));
    }

    return true;
  } catch (error) {
    console.log("[localtify chromium switch error]", name, error?.message || error);
    return false;
  }
}

function configureLocaltifyChromiumPerformance() {
  const switches = [];
  const add = (name, value) => {
    const applied = appendChromiumSwitchOnce(name, value);
    switches.push({
      name,
      value: typeof value === "undefined" || value === null ? "" : String(value),
      applied
    });
    return applied;
  };

  const disableGpuTuning = process.env.LOCALTIFY_DISABLE_GPU_TUNING === "1";
  const forceOpenGl = process.env.LOCALTIFY_FORCE_OPENGL === "1";
  const forceAngleGl = process.env.LOCALTIFY_FORCE_ANGLE_GL === "1";

  add("autoplay-policy", "no-user-gesture-required");

  if (!disableGpuTuning) {
    // Keep Chromium/Electron on hardware acceleration and make compositor/raster work
    // eligible for the GPU. Do not call app.disableHardwareAcceleration().
    add("ignore-gpu-blocklist");
    add("enable-gpu-rasterization");
    add("enable-zero-copy");
    add("enable-accelerated-video-decode");

    if (forceOpenGl) {
      // Optional test mode: PowerShell -> $env:LOCALTIFY_FORCE_OPENGL="1"; npm run dev
      // This is intentionally opt-in because forced desktop OpenGL can break some
      // Windows drivers even when normal ANGLE/D3D11 acceleration is fine.
      add("use-gl", "desktop");
    } else if (process.platform === "win32") {
      // Stable Windows default for most GPUs. This keeps GPU acceleration enabled
      // without forcing a risky OpenGL path.
      add("use-angle", forceAngleGl ? "gl" : "d3d11");
    }
  }

  if (process.platform === "linux") {
    // AppImage/Linux safety: Fedora/Wayland can expose Vulkan through Ozone and
    // abort the packaged renderer. For release builds, reliability matters more
    // than GPU compositing. Users can opt back into Linux GPU/Wayland testing with:
    // LOCALTIFY_LINUX_GPU=1 LOCALTIFY_ENABLE_WAYLAND=1 ./localtify.AppImage
    const linuxGpuOptIn = process.env.LOCALTIFY_LINUX_GPU === "1";
    const linuxWaylandOptIn = process.env.LOCALTIFY_ENABLE_WAYLAND === "1";

    add("disable-vulkan");
    add("disable-features", "Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,VaapiVideoDecoder,UseChromeOSDirectVideoDecoder");
    add("enable-features", "UseOzonePlatform");

    if (!linuxWaylandOptIn) {
      add("ozone-platform", "x11");
      add("ozone-platform-hint", "x11");
    }

    if (app.isPackaged && !linuxGpuOptIn) {
      // Do not disable the whole GPU on Linux. The earlier safety patch made the
      // AppImage open, but software rendering made the UI extremely laggy.
      // Vulkan/Wayland/video-decode are the risky parts, so keep those off while
      // leaving normal compositing available.
      add("disable-accelerated-video-decode");
    }
  }

  return {
    gpuTuningEnabled: !disableGpuTuning,
    forceOpenGl,
    forceAngleGl,
    platform: process.platform,
    switches
  };
}

app.setName(APP_NAME);
const LOCALTIFY_CHROMIUM_PERFORMANCE = configureLocaltifyChromiumPerformance();

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
  const info = getFileInfoCached(filePath);
  if (!info.exists || !info.isFile) return { version: "missing", sizeBytes: 0, mtimeMs: 0 };
  return { version: `${Math.floor(info.mtimeMs)}-${info.size}`, sizeBytes: info.size, mtimeMs: info.mtimeMs };
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

  const stat = getFileInfoCached(filePath);
  if (!stat.exists || !stat.isFile) {
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


function getCoverThumbnailDirectory() {
  try {
    const dir = path.join(app.getPath("userData"), COVER_THUMBNAIL_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (error) {
    console.log("[localtify thumbnails directory error]", error?.message || error);
    return "";
  }
}

function getCoverThumbnailCacheKey(filePath) {
  try {
    const info = getFileInfoCached(filePath);
    const signature = [
      path.normalize(String(filePath || "")).toLowerCase(),
      info.size || 0,
      Math.round(info.mtimeMs || 0),
      COVER_THUMBNAIL_SIZE
    ].join("|");

    return crypto.createHash("sha1").update(signature).digest("hex");
  } catch {
    return crypto.createHash("sha1").update(String(filePath || "")).digest("hex");
  }
}

function getCoverThumbnailPath(filePath) {
  if (!filePath || !path.isAbsolute(filePath) || !isImageFile(filePath) || !fileExists(filePath)) return "";

  const dir = getCoverThumbnailDirectory();
  if (!dir) return "";

  return path.join(dir, `${getCoverThumbnailCacheKey(filePath)}.png`);
}

function createCoverThumbnailSync(filePath) {
  const thumbnailPath = getCoverThumbnailPath(filePath);

  if (!thumbnailPath) {
    return { ok: false, sourcePath: filePath, thumbnailPath: "", error: "That cover image is missing or unsupported." };
  }

  if (fileExists(thumbnailPath)) {
    return { ok: true, sourcePath: filePath, thumbnailPath, cached: true, url: safeMediaUrl(thumbnailPath) };
  }

  try {
    const image = nativeImage.createFromPath(filePath);

    if (!image || image.isEmpty()) {
      return {
        ok: false,
        sourcePath: filePath,
        thumbnailPath: "",
        error: "Localtify could not read this cover image. The original cover will still be used."
      };
    }

    const sourceSize = image.getSize();
    const resized = image.resize({
      width: COVER_THUMBNAIL_SIZE,
      height: COVER_THUMBNAIL_SIZE,
      quality: "good"
    });

    if (!resized || resized.isEmpty()) {
      return {
        ok: false,
        sourcePath: filePath,
        thumbnailPath: "",
        error: "Localtify could not resize this cover image. The original cover will still be used."
      };
    }

    fs.mkdirSync(path.dirname(thumbnailPath), { recursive: true });
    fs.writeFileSync(thumbnailPath, resized.toPNG());

    return {
      ok: true,
      sourcePath: filePath,
      thumbnailPath,
      cached: false,
      url: safeMediaUrl(thumbnailPath),
      sourceWidth: sourceSize.width,
      sourceHeight: sourceSize.height,
      size: COVER_THUMBNAIL_SIZE
    };
  } catch (error) {
    console.log("[localtify thumbnail create error]", error?.message || error);
    return {
      ok: false,
      sourcePath: filePath,
      thumbnailPath: "",
      error: "Localtify could not create a small cover thumbnail yet. The full cover will still work."
    };
  }
}

function queueCoverThumbnail(filePath) {
  if (!filePath || !path.isAbsolute(filePath) || !isImageFile(filePath) || !fileExists(filePath)) return;
  const thumbnailPath = getCoverThumbnailPath(filePath);
  if (!thumbnailPath || fileExists(thumbnailPath) || coverThumbnailQueue.has(filePath)) return;

  const timer = setTimeout(() => {
    coverThumbnailQueue.delete(filePath);
    createCoverThumbnailSync(filePath);
  }, 750 + Math.min(3200, coverThumbnailQueue.size * 120));

  coverThumbnailQueue.set(filePath, timer);
}

function getCoverThumbnailUrl(filePath, options = {}) {
  const forceCreate = Boolean(options.forceCreate);

  if (!filePath || !path.isAbsolute(filePath) || !isImageFile(filePath) || !fileExists(filePath)) {
    return "";
  }

  const key = getCoverThumbnailCacheKey(filePath);
  const cached = coverThumbnailUrlCache.get(key);

  if (cached && fileExists(cached.thumbnailPath)) {
    return cached.url;
  }

  const thumbnailPath = getCoverThumbnailPath(filePath);

  if (thumbnailPath && fileExists(thumbnailPath)) {
    const url = safeMediaUrl(thumbnailPath);
    coverThumbnailUrlCache.set(key, { thumbnailPath, url, cachedAt: Date.now() });
    return url;
  }

  if (forceCreate) {
    const created = createCoverThumbnailSync(filePath);
    if (created.ok && created.url) {
      coverThumbnailUrlCache.set(key, { thumbnailPath: created.thumbnailPath, url: created.url, cachedAt: Date.now() });
      return created.url;
    }
    return "";
  }

  queueCoverThumbnail(filePath);
  return "";
}

function getCoverThumbnailStatus() {
  const dir = getCoverThumbnailDirectory();
  let count = 0;
  let sizeBytes = 0;

  try {
    if (dir && fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        const filePath = path.join(dir, name);
        if (!fileExists(filePath)) continue;
        const info = getFileInfoCached(filePath);
        if (!info.isFile) continue;
        count += 1;
        sizeBytes += info.size || 0;
      }
    }
  } catch (error) {
    return {
      ok: false,
      directory: dir,
      count,
      sizeBytes,
      queued: coverThumbnailQueue.size,
      message: "Localtify could not read the thumbnail cache. Covers will still load normally.",
      error: error?.message || "thumbnail status failed"
    };
  }

  return {
    ok: true,
    directory: dir,
    count,
    sizeBytes,
    queued: coverThumbnailQueue.size,
    size: COVER_THUMBNAIL_SIZE,
    message: count
      ? `${count} small cover thumbnail${count === 1 ? "" : "s"} cached.`
      : "No cover thumbnails cached yet. Localtify will build them quietly as covers appear."
  };
}

function cleanupCoverThumbnailCache() {
  const dir = getCoverThumbnailDirectory();
  let removed = 0;
  let sizeBytes = 0;

  try {
    for (const timer of coverThumbnailQueue.values()) {
      try { clearTimeout(timer); } catch {}
    }
    coverThumbnailQueue.clear();
    coverThumbnailUrlCache.clear();

    if (dir && fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        const filePath = path.join(dir, name);
        if (!fileExists(filePath)) continue;
        const info = getFileInfoCached(filePath);
        if (!info.isFile) continue;
        sizeBytes += info.size || 0;
        fs.rmSync(filePath, { force: true });
        removed += 1;
      }
    }

    clearFileInfoCache();

    return {
      ok: true,
      directory: dir,
      removed,
      sizeBytes,
      message: removed
        ? `Cleaned ${removed} cached cover thumbnail${removed === 1 ? "" : "s"}.`
        : "Cover cache is already clean."
    };
  } catch (error) {
    console.log("[localtify cover cache cleanup error]", error?.message || error);
    return {
      ok: false,
      directory: dir,
      removed,
      sizeBytes,
      error: error?.message || "cover cache cleanup failed",
      message: "Localtify could not clean the cover cache right now."
    };
  }
}

function warmCoverThumbnails({ limit = 80, force = false } = {}) {
  const songs = getSongs();
  const uniqueCoverPaths = [];

  for (const song of songs) {
    const coverPath = String(song?.coverPath || "").trim();
    if (!coverPath || !path.isAbsolute(coverPath) || !isImageFile(coverPath) || !fileExists(coverPath)) continue;
    if (uniqueCoverPaths.includes(coverPath)) continue;
    uniqueCoverPaths.push(coverPath);
    if (uniqueCoverPaths.length >= limit) break;
  }

  let created = 0;
  let cached = 0;
  const warnings = [];

  for (const coverPath of uniqueCoverPaths) {
    const thumbnailPath = getCoverThumbnailPath(coverPath);

    if (thumbnailPath && fileExists(thumbnailPath) && !force) {
      cached += 1;
      continue;
    }

    const result = createCoverThumbnailSync(coverPath);
    if (result.ok) {
      created += result.cached ? 0 : 1;
      if (result.cached) cached += 1;
    } else if (result.error) {
      warnings.push(result.error);
    }
  }

  return {
    ok: true,
    scanned: uniqueCoverPaths.length,
    created,
    cached,
    warnings: Array.from(new Set(warnings)).slice(0, 4),
    status: getCoverThumbnailStatus(),
    message: created
      ? `Cached ${created} cover thumbnail${created === 1 ? "" : "s"}.`
      : cached
        ? "Cover thumbnails are already ready."
        : "No custom covers needed thumbnail caching yet."
  };
}

function scheduleCoverThumbnailWarmup() {
  if (coverThumbnailWarmStarted) return;
  coverThumbnailWarmStarted = true;
  setTimeout(() => {
    try {
      warmCoverThumbnails({ limit: 120 });
    } catch (error) {
      console.log("[localtify thumbnail warmup error]", error?.message || error);
    }
  }, 4500);
}

function safeImageExtensionFromUrlOrType(rawUrl = "", contentType = "") {
  const cleanType = String(contentType || "").toLowerCase();
  const cleanUrl = String(rawUrl || "").toLowerCase();

  if (cleanType.includes("png") || cleanUrl.includes(".png")) return ".png";
  if (cleanType.includes("webp") || cleanUrl.includes(".webp")) return ".webp";
  if (cleanType.includes("gif") || cleanUrl.includes(".gif")) return ".gif";

  return ".jpg";
}

function getSpotifyCoverCacheDirectory() {
  const target = path.join(app.getPath("userData"), "spotify-covers");
  try {
    fs.mkdirSync(target, { recursive: true });
  } catch {
  }
  return target;
}

function downloadHttpsBuffer(urlString, maxBytes = 8 * 1024 * 1024, redirectLimit = 4) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(String(urlString || ""));
    } catch {
      return reject(new Error("invalid cover url"));
    }

    if (parsed.protocol !== "https:") {
      return reject(new Error("cover url must be https"));
    }

    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: "GET",
      timeout: 15000,
      headers: {
        "User-Agent": SPOTIFY_BROWSER_UA || "Mozilla/5.0",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": "https://open.spotify.com/"
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectLimit > 0) {
        res.resume();
        const nextUrl = new URL(res.headers.location, urlString).toString();
        downloadHttpsBuffer(nextUrl, maxBytes, redirectLimit - 1).then(resolve, reject);
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`cover returned HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      let total = 0;

      res.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          req.destroy(new Error("cover image too large"));
          return;
        }
        chunks.push(chunk);
      });

      res.on("end", () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: String(res.headers["content-type"] || "")
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("cover download timed out"));
    });
    req.end();
  });
}

async function cacheSpotifyCoverImage(coverUrl, stableKey = "") {
  const cleanUrl = String(coverUrl || "").trim();
  if (!cleanUrl || !/^https:\/\/i\.scdn\.co\//i.test(cleanUrl)) return "";

  try {
    const hash = crypto.createHash("sha1").update(`${stableKey}::${cleanUrl}`).digest("hex").slice(0, 22);
    const cacheDir = getSpotifyCoverCacheDirectory();

    for (const ext of [".jpg", ".png", ".webp", ".gif"]) {
      const existing = path.join(cacheDir, `${hash}${ext}`);
      if (fileExists(existing)) return existing;
    }

    const image = await downloadHttpsBuffer(cleanUrl);
    const ext = safeImageExtensionFromUrlOrType(cleanUrl, image.contentType);
    const targetPath = path.join(cacheDir, `${hash}${ext}`);

    await fs.promises.writeFile(targetPath, image.buffer);
    return targetPath;
  } catch (error) {
    console.log("[localtify spotify cover cache error]", error?.message || error);
    return "";
  }
}

function bestSpotifyImage(images = []) {
  if (!Array.isArray(images) || !images.length) return "";

  const sorted = images
    .filter((image) => image?.url)
    .slice()
    .sort((a, b) => {
      const aw = Number(a?.width || 0);
      const bw = Number(b?.width || 0);
      return bw - aw;
    });

  return String(sorted[0]?.url || "");
}


function isAudioFile(filePath) {
  return /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(filePath || "");
}

function isImageFile(filePath) {
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(filePath || "");
}

function fileExists(filePath) {
  const info = getFileInfoCached(filePath);
  return Boolean(info.exists && info.isFile);
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
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(targetPath, lines.join("\n"), "utf-8");
    return targetPath;
  } catch (error) {
    console.log("[localitfy cookies dump error]", error?.message || error);
    return null;
  }
}

// ====================== SPOTIFY OAUTH PUBLIC IMPORT ======================
// V223: no sp_dc cookie paste, no browser-cookie extraction, no internal
// open.spotify.com/get_access_token dependency.
// Uses Spotify Authorization Code with PKCE. No scopes are requested, so the
// token can only read public Spotify data normally visible in Spotify apps.
// Private playlists must be made public first.

const SPOTIFY_BROWSER_UA = process.platform === "win32"
  ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SPOTIFY_REDIRECT_PORT = Number(process.env.SPOTIFY_REDIRECT_PORT || 43877);
const SPOTIFY_REDIRECT_URI = String(
  process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${SPOTIFY_REDIRECT_PORT}/spotify/callback`
);
const SPOTIFY_CLIENT_ID = String(
  process.env.SPOTIFY_CLIENT_ID ||
  process.env.VITE_SPOTIFY_CLIENT_ID ||
  process.env.VITE_PUBLIC_SPOTIFY_CLIENT_ID ||
  "586c22791eb74d73b1c83db88f1d4c52"
).trim();

const SPOTIFY_OAUTH_FILE = () => path.join(app.getPath("userData"), "spotify-oauth.json");

let _spotifyToken = null;
let _spotifyTokenExpiry = 0;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeSpotifyCodeVerifier() {
  return base64UrlEncode(crypto.randomBytes(48));
}

function makeSpotifyCodeChallenge(verifier) {
  return base64UrlEncode(crypto.createHash("sha256").update(verifier).digest());
}

function readSpotifyOAuthToken() {
  try {
    const filePath = SPOTIFY_OAUTH_FILE();
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!parsed || typeof parsed !== "object") return null;
    return {
      accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : "",
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : "",
      expiresAt: Number(parsed.expiresAt || 0)
    };
  } catch {
    return null;
  }
}

function writeSpotifyOAuthToken(token) {
  try {
    const filePath = SPOTIFY_OAUTH_FILE();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(token, null, 2), "utf-8");
  } catch (error) {
    console.log("[localtify spotify token save error]", error?.message || error);
  }
}

function clearSpotifyOAuthToken() {
  _spotifyToken = null;
  _spotifyTokenExpiry = 0;
  try {
    fs.unlinkSync(SPOTIFY_OAUTH_FILE());
  } catch {
  }
}

function saveSpotifyOAuthResponse(data = {}, previous = {}) {
  const expiresIn = Number(data.expires_in || 3600);
  const next = {
    accessToken: String(data.access_token || previous.accessToken || ""),
    refreshToken: String(data.refresh_token || previous.refreshToken || ""),
    expiresAt: Date.now() + Math.max(60, expiresIn - 90) * 1000
  };

  if (!next.accessToken) {
    throw new Error("Spotify did not return an access token.");
  }

  writeSpotifyOAuthToken(next);
  _spotifyToken = next.accessToken;
  _spotifyTokenExpiry = next.expiresAt;
  return next;
}

function spotifyHttpGet(urlString, extraHeaders = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      return reject(new Error(`Invalid Spotify URL: ${urlString}`));
    }

    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: "GET",
      timeout: 15000,
      headers: {
        "User-Agent": SPOTIFY_BROWSER_UA,
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://open.spotify.com",
        "Referer": "https://open.spotify.com/",
        "App-Platform": "WebPlayer",
        ...extraHeaders
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        res.resume();
        return resolve(spotifyHttpGet(new URL(res.headers.location, urlString).toString(), extraHeaders, maxRedirects - 1));
      }

      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Spotify request timed out"));
    });
    req.end();
  });
}

function spotifyHttpPostForm(urlString, formData = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      return reject(new Error(`Invalid Spotify URL: ${urlString}`));
    }

    const body = new URLSearchParams(formData).toString();

    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: "POST",
      timeout: 15000,
      headers: {
        "User-Agent": SPOTIFY_BROWSER_UA,
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let responseBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { responseBody += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: responseBody }));
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Spotify request timed out"));
    });
    req.write(body);
    req.end();
  });
}

async function spotifyTokenRequest(formData) {
  const res = await spotifyHttpPostForm("https://accounts.spotify.com/api/token", formData);

  let data = {};
  try {
    data = JSON.parse(res.body || "{}");
  } catch {
    data = {};
  }

  if (res.status !== 200) {
    const detail = data?.error_description || data?.error || res.body?.slice?.(0, 160) || "";
    throw new Error(`Spotify OAuth returned HTTP ${res.status}${detail ? ` â€” ${detail}` : ""}`);
  }

  return data;
}

async function exchangeSpotifyAuthorizationCode(code, codeVerifier) {
  const data = await spotifyTokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: codeVerifier
  });

  return saveSpotifyOAuthResponse(data);
}

async function refreshSpotifyAccessToken(previous = readSpotifyOAuthToken()) {
  if (!previous?.refreshToken) {
    throw new Error("Spotify is not connected. Press Connect Spotify first.");
  }

  const data = await spotifyTokenRequest({
    grant_type: "refresh_token",
    refresh_token: previous.refreshToken,
    client_id: SPOTIFY_CLIENT_ID
  });

  return saveSpotifyOAuthResponse(data, previous);
}

async function getSpotifyAccessToken() {
  if (!SPOTIFY_CLIENT_ID) {
    throw new Error("Spotify OAuth is unavailable, but public fallback can still fetch public Spotify links.");
  }

  const now = Date.now();
  const saved = readSpotifyOAuthToken();

  if (_spotifyToken && now < _spotifyTokenExpiry - 30_000) return _spotifyToken;
  if (saved?.accessToken && saved.expiresAt && now < saved.expiresAt - 30_000) {
    _spotifyToken = saved.accessToken;
    _spotifyTokenExpiry = saved.expiresAt;
    return saved.accessToken;
  }

  if (saved?.refreshToken) {
    const refreshed = await refreshSpotifyAccessToken(saved);
    return refreshed.accessToken;
  }

  throw new Error("Spotify is not connected. Press Connect Spotify first.");
}

function createSpotifyCallbackWaiter(expectedState) {
  let server = null;
  let timer = null;
  let settled = false;
  let finish = null;

  const promise = new Promise((resolve, reject) => {
    finish = (error, value) => {
      if (settled) return;
      settled = true;

      if (timer) clearTimeout(timer);
      timer = null;

      try {
        if (server) server.close();
      } catch {
      }

      server = null;

      if (error) reject(error);
      else resolve(value);
    };

    server = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url || "/", SPOTIFY_REDIRECT_URI);

        if (requestUrl.pathname !== "/spotify/callback") {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("not found");
          return;
        }

        const error = requestUrl.searchParams.get("error");
        if (error) {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end("<html><body style='font-family:sans-serif;background:#08070f;color:white'><h2>Spotify login cancelled.</h2><p>You can close this window.</p></body></html>");
          finish(new Error(`Spotify login cancelled: ${error}`));
          return;
        }

        const state = requestUrl.searchParams.get("state") || "";
        const code = requestUrl.searchParams.get("code") || "";

        if (!code) {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
          res.end("missing spotify code");
          finish(new Error("Spotify did not return a login code."));
          return;
        }

        if (state !== expectedState) {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
          res.end("spotify state mismatch");
          finish(new Error("Spotify login state mismatch. Try again."));
          return;
        }

        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<html><body style='font-family:sans-serif;background:#08070f;color:white'><h2>Spotify connected to localtify.</h2><p>You can close this window now.</p></body></html>");
        finish(null, { code });
      } catch (error) {
        if (typeof finish === "function") finish(error);
      }
    });

    server.once("error", (error) => {
      if (typeof finish === "function") {
        finish(new Error(`Spotify callback server failed: ${error?.message || error}`));
      }
    });

    timer = setTimeout(() => {
      if (typeof finish === "function") finish(new Error("Spotify login timed out."));
    }, 5 * 60 * 1000);

    server.listen(SPOTIFY_REDIRECT_PORT, "127.0.0.1");
  });

  return {
    promise,
    cancel: (reason = "Spotify login cancelled.") => {
      if (!settled && typeof finish === "function") {
        finish(new Error(reason));
      }
    }
  };
}

async function loginSpotifyOAuth() {
  if (!SPOTIFY_CLIENT_ID) {
    return {
      ok: true,
      ready: true,
      loggedIn: false,
      publicOnly: true,
      fallbackAvailable: true,
      mode: "public-fallback",
      needsClientId: false,
      redirectUri: SPOTIFY_REDIRECT_URI,
      error: "Spotify OAuth is unavailable, but public playlist/album/track import is ready."
    };
  }

  const codeVerifier = makeSpotifyCodeVerifier();
  const codeChallenge = makeSpotifyCodeChallenge(codeVerifier);
  const state = base64UrlEncode(crypto.randomBytes(18));

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", SPOTIFY_REDIRECT_URI);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("show_dialog", "false");
  // No scope parameter on purpose: public Spotify data only.

  const waiter = createSpotifyCallbackWaiter(state);
  let loginWindow = null;

  try {
    loginWindow = new BrowserWindow({
      width: 540,
      height: 720,
      title: "Connect Spotify â€” localtify",
      parent: mainWindow || undefined,
      modal: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    loginWindow.setMenu(null);
    loginWindow.loadURL(authUrl.toString());

    loginWindow.on("closed", () => {
      waiter.cancel("Spotify login cancelled.");
    });

    const { code } = await waiter.promise;
    await exchangeSpotifyAuthorizationCode(code, codeVerifier);

    try {
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
    } catch {
    }

    return {
      ok: true,
      ready: true,
      loggedIn: true,
      publicOnly: true,
      mode: "oauth-pkce",
      redirectUri: SPOTIFY_REDIRECT_URI,
      message: "Spotify connected. Public playlists, albums, and tracks can be imported."
    };
  } catch (error) {
    const message = error?.message || "Spotify login failed.";
    return {
      ok: false,
      ready: Boolean(SPOTIFY_CLIENT_ID),
      loggedIn: false,
      cancelled: /cancel/i.test(message),
      publicOnly: true,
      mode: "oauth-pkce",
      redirectUri: SPOTIFY_REDIRECT_URI,
      error: message
    };
  } finally {
    waiter.cancel();
    try {
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
    } catch {
    }
  }
}

async function spotifyApiGet(endpoint) {
  const url = endpoint.startsWith("https://") ? endpoint : `https://api.spotify.com/v1${endpoint}`;

  const fetchOnce = async () => {
    const token = await getSpotifyAccessToken();
    return spotifyHttpGet(url, { Authorization: `Bearer ${token}`, Accept: "application/json" });
  };

  let res = await fetchOnce();

  if (res.status === 401) {
    _spotifyToken = null;
    _spotifyTokenExpiry = 0;
    await refreshSpotifyAccessToken();
    res = await fetchOnce();
  }

  if (res.status === 403 || res.status === 404) {
    throw new Error("Spotify could not read this link. Make sure the playlist is public, then copy the link again.");
  }

  if (res.status === 429) {
    throw new Error("Spotify rate-limited this request. Wait a little and try again.");
  }

  if (res.status !== 200) {
    throw new Error(`Spotify API returned HTTP ${res.status}.`);
  }

  try {
    return JSON.parse(res.body);
  } catch {
    throw new Error("Could not parse Spotify API response.");
  }
}

function parseSpotifyUrl(rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return null;

  const uriMatch = raw.match(/^spotify:(playlist|album|track):([A-Za-z0-9]+)$/i);
  if (uriMatch) return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };

  const urlMatch = raw.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(playlist|album|track)\/([A-Za-z0-9]+)/i);
  if (urlMatch) return { type: urlMatch[1].toLowerCase(), id: urlMatch[2] };

  return null;
}

function shapeSpotifyTrack(track, fallbackAlbumName = "", fallbackCoverUrl = "") {
  if (!track?.name) return null;

  const artists = Array.isArray(track.artists)
    ? track.artists.map((artist) => artist?.name).filter(Boolean).join(", ")
    : "";

  const coverUrl =
    bestSpotifyImage(track.album?.images) ||
    bestSpotifyImage(track.images) ||
    String(track.coverUrl || track.spotifyCoverUrl || track.albumCoverUrl || fallbackCoverUrl || "");

  return {
    id: String(track.id || `${track.name}-${artists}-${track.duration_ms || 0}`),
    title: String(track.name || "unknown track"),
    name: String(track.name || "unknown track"),
    artist: artists,
    artists,
    albumName: String(track.album?.name || fallbackAlbumName || ""),
    coverUrl,
    albumCoverUrl: coverUrl,
    spotifyCoverUrl: coverUrl,
    duration: Math.round(Number(track.duration_ms || 0) / 1000),
    durationMs: Number(track.duration_ms || 0),
    spotifyUrl: track.external_urls?.spotify || (track.id ? `https://open.spotify.com/track/${track.id}` : ""),
    isrc: String(track.external_ids?.isrc || track.isrc || "")
  };
}


function decodeHtmlEntities(value) {
  // Decode ampersands last so strings like &amp;quot; do not become quotes in one pass.
  // Also leave lt/gt encoded; titles do not need markup characters and this keeps
  // untrusted Spotify/search metadata from becoming HTML-shaped text later.
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function uniqSpotifyIds(ids = []) {
  const seen = new Set();
  const out = [];
  for (const rawId of ids) {
    const id = String(rawId || "").trim();
    if (!/^[A-Za-z0-9]{18,24}$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function fetchSpotifyOembed(trackUrl) {
  const res = await spotifyHttpGet(`https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`, {
    Accept: "application/json"
  });
  // localtifyOpaqueReleaseFixV453: opaque Electron fallback; React/theme CSS owns the app background.
  try {
    mainWindow.setBackgroundColor("#000000");
    if (process.platform === "win32" && typeof mainWindow.setBackgroundMaterial === "function") {
      mainWindow.setBackgroundMaterial("none");
    }
  } catch {}

  // localtifyWindowOpaqueFixV449: opaque Electron fallback only. The React app CSS controls the real app background.
  try {
    mainWindow.setBackgroundColor("#000000");
  } catch {}


  if (res.status !== 200) return null;

  try {
    return JSON.parse(res.body || "{}");
  } catch {
    return null;
  }
}

async function fetchSpotifyPublicTrackFallback(trackId) {
  const trackUrl = `https://open.spotify.com/track/${trackId}`;

  // Even when playlist access fails, individual public tracks often still work
  // through the official API. Try this first so we get real artist + album art.
  try {
    const apiTrack = await spotifyApiGet(`/tracks/${trackId}`);
    const shaped = shapeSpotifyTrack(apiTrack);
    if (shaped?.name) return shaped;
  } catch {
  }

  let title = "";
  let artist = "";
  let coverUrl = "";

  try {
    const oembed = await fetchSpotifyOembed(trackUrl);
    const rawTitle = decodeHtmlEntities(oembed?.title || "").trim();
    coverUrl = String(oembed?.thumbnail_url || oembed?.thumbnailUrl || "");

    if (rawTitle) {
      const dashIndex = rawTitle.indexOf(" - ");
      title = dashIndex >= 0 ? rawTitle.slice(0, dashIndex).trim() : rawTitle;
      artist = dashIndex >= 0 ? rawTitle.slice(dashIndex + 3).trim() : "";
    }
  } catch {
  }

  try {
    const htmlRes = await spotifyHttpGet(trackUrl, { Accept: "text/html" });

    if (htmlRes.status === 200) {
      const html = htmlRes.body || "";

      if (!title) {
        const titleMatch =
          html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<title[^>]*>([^<]+)<\/title>/i);

        if (titleMatch?.[1]) {
          const raw = decodeHtmlEntities(titleMatch[1]).replace(/\s*\|\s*Spotify\s*$/i, "").trim();
          const dashIndex = raw.indexOf(" - ");
          title = dashIndex >= 0 ? raw.slice(0, dashIndex).trim() : raw;
          if (!artist && dashIndex >= 0) artist = raw.slice(dashIndex + 3).trim();
        }
      }

      if (!coverUrl) {
        const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
        coverUrl = decodeHtmlEntities(imageMatch?.[1] || "").trim();
      }

      if (!artist) {
        const descriptionMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
        const desc = decodeHtmlEntities(descriptionMatch?.[1] || "").trim();
        if (desc) artist = desc.split("Â·")[0].trim();
      }
    }
  } catch {
  }

  title = title || `Spotify track ${trackId}`;
  return {
    id: trackId,
    title,
    name: title,
    artist,
    artists: artist,
    albumName: "",
    coverUrl,
    albumCoverUrl: coverUrl,
    spotifyCoverUrl: coverUrl,
    duration: 0,
    durationMs: 0,
    spotifyUrl: trackUrl
  };
}

async function fetchSpotifyPublicPlaylistFallback(playlistId) {
  const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
  let playlistName = "Spotify Playlist";
  const ids = [];

  try {
    const oembed = await fetchSpotifyOembed(playlistUrl);
    const rawName = decodeHtmlEntities(oembed?.title || "").trim();
    if (rawName) playlistName = rawName.replace(/\s*\|\s*Spotify\s*$/i, "").trim() || playlistName;
  } catch {
  }

  const urlsToTry = [
    playlistUrl,
    `https://open.spotify.com/embed/playlist/${playlistId}`,
    `https://open.spotify.com/playlist/${playlistId}?nd=1`
  ];

  for (const url of urlsToTry) {
    try {
      const res = await spotifyHttpGet(url, { Accept: "text/html" });
      if (res.status !== 200) continue;

      const html = res.body || "";

      const ogTitle =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<title[^>]*>([^<]+)<\/title>/i);

      if (ogTitle?.[1]) {
        const raw = decodeHtmlEntities(ogTitle[1]).replace(/\s*\|\s*Spotify\s*$/i, "").trim();
        if (raw && !/^spotify$/i.test(raw)) playlistName = raw;
      }

      for (const match of html.matchAll(/spotify:track:([A-Za-z0-9]+)/g)) ids.push(match[1]);
      for (const match of html.matchAll(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/g)) ids.push(match[1]);
      for (const match of html.matchAll(/\/track\/([A-Za-z0-9]{18,24})/g)) ids.push(match[1]);
      for (const match of html.matchAll(/"uri"\s*:\s*"spotify:track:([A-Za-z0-9]+)"/g)) ids.push(match[1]);

      if (ids.length) break;
    } catch (error) {
      console.log("[localtify spotify fallback page error]", error?.message || error);
    }
  }

  const trackIds = uniqSpotifyIds(ids);

  if (!trackIds.length) {
    throw new Error(
      "Spotify could not expose tracks for this playlist. Make sure it is public on your profile, not only shareable by link, then try again."
    );
  }

  const tracks = [];
  const limitedIds = trackIds.slice(0, 250);

  for (let index = 0; index < limitedIds.length; index += 8) {
    const batch = limitedIds.slice(index, index + 8);
    const shaped = await Promise.all(batch.map((trackId) => fetchSpotifyPublicTrackFallback(trackId).catch(() => null)));
    for (const track of shaped) {
      if (track?.name) tracks.push(track);
    }
  }

  return {
    name: playlistName,
    playlistName,
    type: "playlist",
    publicOnly: true,
    fallback: true,
    tracks
  };
}

async function fetchSpotifyPublicAlbumFallback(albumId) {
  const albumUrl = `https://open.spotify.com/album/${albumId}`;
  let albumName = "Spotify Album";
  const ids = [];

  try {
    const oembed = await fetchSpotifyOembed(albumUrl);
    const rawName = decodeHtmlEntities(oembed?.title || "").trim();
    if (rawName) albumName = rawName.replace(/\s*\|\s*Spotify\s*$/i, "").trim() || albumName;
  } catch {
  }

  try {
    const res = await spotifyHttpGet(`https://open.spotify.com/embed/album/${albumId}`, { Accept: "text/html" });
    if (res.status === 200) {
      const html = res.body || "";
      for (const match of html.matchAll(/spotify:track:([A-Za-z0-9]+)/g)) ids.push(match[1]);
      for (const match of html.matchAll(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/g)) ids.push(match[1]);
      for (const match of html.matchAll(/\/track\/([A-Za-z0-9]{18,24})/g)) ids.push(match[1]);
    }
  } catch {
  }

  const trackIds = uniqSpotifyIds(ids);
  if (!trackIds.length) throw new Error("Spotify could not expose tracks for this album. Try connecting again or use the track links directly.");

  const tracks = [];
  for (let index = 0; index < trackIds.length; index += 8) {
    const batch = trackIds.slice(index, index + 8);
    const shaped = await Promise.all(batch.map((trackId) => fetchSpotifyPublicTrackFallback(trackId).catch(() => null)));
    for (const track of shaped) {
      if (track?.name) tracks.push({ ...track, albumName });
    }
  }

  return { name: albumName, playlistName: albumName, type: "album", publicOnly: true, fallback: true, tracks };
}

async function fetchSpotifyPublicFallback(rawUrl, reason = "") {
  const parsed = parseSpotifyUrl(rawUrl);
  if (!parsed) throw new Error("Paste a valid Spotify playlist, album, or track link.");

  console.log("[localtify spotify] using public fallback", { type: parsed.type, reason });

  if (parsed.type === "track") {
    const track = await fetchSpotifyPublicTrackFallback(parsed.id);
    return { name: track.title, playlistName: track.title, type: "track", publicOnly: true, fallback: true, tracks: [track] };
  }

  if (parsed.type === "album") {
    return fetchSpotifyPublicAlbumFallback(parsed.id);
  }

  if (parsed.type === "playlist") {
    return fetchSpotifyPublicPlaylistFallback(parsed.id);
  }

  throw new Error(`Unsupported Spotify link type: ${parsed.type}`);
}


async function fetchSpotifyTracksFromUrl(rawUrl) {
  const parsed = parseSpotifyUrl(rawUrl);
  if (!parsed) {
    throw new Error("Paste a valid Spotify playlist, album, or track link.");
  }

  if (!SPOTIFY_CLIENT_ID) {
    return fetchSpotifyPublicFallback(rawUrl, "spotify client id unavailable");
  }

  const { type, id } = parsed;

  try {
    if (type === "track") {
      const track = await spotifyApiGet(`/tracks/${id}`);
      const shaped = shapeSpotifyTrack(track);
      return { name: shaped?.title || "Spotify Track", playlistName: shaped?.title || "Spotify Track", type: "track", publicOnly: true, tracks: shaped ? [shaped] : [] };
    }

    if (type === "album") {
      const album = await spotifyApiGet(`/albums/${id}`);
      const tracks = [];
      let next = `/albums/${id}/tracks?limit=50&offset=0`;

      while (next) {
        const page = await spotifyApiGet(next);
        for (const track of page.items || []) {
          const shaped = shapeSpotifyTrack(track, album.name || "", bestSpotifyImage(album.images));
          if (shaped) tracks.push(shaped);
        }
        next = page.next || null;
      }

      return { name: album.name || "Spotify Album", playlistName: album.name || "Spotify Album", type: "album", publicOnly: true, tracks };
    }

    if (type === "playlist") {
      const info = await spotifyApiGet(`/playlists/${id}?fields=name,public,owner(display_name)`);

      if (info && info.public === false) {
        throw new Error("This playlist is link-shareable but not public to the Spotify API. Add it to your public profile, or try the fallback fetch again.");
      }

      const tracks = [];
      let offset = 0;

      while (true) {
        const page = await spotifyApiGet(`/playlists/${id}/tracks?limit=100&offset=${offset}&fields=items(track(id,name,artists,album(name,images(url,width,height)),duration_ms,is_local,external_urls,external_ids(isrc))),next`);
        const items = page.items || [];

        for (const item of items) {
          const track = item?.track;
          if (!track?.name || track.is_local) continue;
          const shaped = shapeSpotifyTrack(track);
          if (shaped) tracks.push(shaped);
        }

        if (!page.next || items.length < 100) break;
        offset += 100;
      }

      return { name: info.name || "Spotify Playlist", playlistName: info.name || "Spotify Playlist", type: "playlist", publicOnly: true, tracks };
    }

    throw new Error(`Unsupported Spotify link type: ${type}`);
  } catch (error) {
    const message = error?.message || String(error || "");
    const canFallback =
      /could not read this link|public profile|private|403|404|not expose|spotify api returned http|spotify is not connected|oauth is unavailable|client id/i.test(message);

    if (!canFallback) throw error;

    return fetchSpotifyPublicFallback(rawUrl, message);
  }
}

// ====================== END SPOTIFY OAUTH PUBLIC IMPORT ======================




function getPixelArtDirectory(options = {}) {
  const force = Boolean(options.force);
  const now = Date.now();

  if (!force && pixelArtDirectoryCache.value && pixelArtDirectoryCache.expiresAt > now) {
    return pixelArtDirectoryCache.value;
  }

  try {
    const appPath = app.getAppPath();
    const resourcesPath = process.resourcesPath || "";
    const executableDir = path.dirname(process.execPath || "");
    const userDataPixelDir = path.join(app.getPath("userData"), "pixelart");

    const candidates = uniquePaths([
      // Best production location. Add this through package.json build.extraResources.
      path.join(resourcesPath, "pixelart"),
      path.join(executableDir, "resources", "pixelart"),

      // Packaged app.asar locations.
      path.join(appPath, "dist", "pixelart"),
      path.join(appPath, "public", "pixelart"),
      path.join(appPath, "pixelart"),
      path.join(resourcesPath, "app.asar", "dist", "pixelart"),
      path.join(resourcesPath, "app.asar", "public", "pixelart"),
      path.join(resourcesPath, "app.asar", "pixelart"),
      path.join(resourcesPath, "app", "dist", "pixelart"),
      path.join(resourcesPath, "app", "public", "pixelart"),
      path.join(resourcesPath, "app", "pixelart"),

      // Dev locations.
      path.join(process.cwd(), "public", "pixelart"),
      path.join(process.cwd(), "pixelart"),
      path.join(process.cwd(), "src", "assets", "pixelart"),
      userDataPixelDir
    ]);

    for (const candidatePath of candidates) {
      try {
        if (!candidatePath) continue;
        const candidateInfo = getFileInfoCached(candidatePath);
        if (!candidateInfo.exists) continue;
        const hasImages = fs.readdirSync(candidatePath).some((name) => isImageFile(name));
        if (hasImages) {
          if (pixelArtDirectoryCache.value !== candidatePath) {
            console.log(`[localitfy pixelart] using ${candidatePath}`);
          }
          pixelArtDirectoryCache = { value: candidatePath, expiresAt: now + PIXEL_ART_CACHE_TTL_MS };
          return candidatePath;
        }
      } catch {
        // keep trying candidates
      }
    }

    fs.mkdirSync(userDataPixelDir, { recursive: true });
    if (pixelArtDirectoryCache.value !== userDataPixelDir) {
      console.log(`[localitfy pixelart] no bundled pixelart found, using empty user folder ${userDataPixelDir}`);
    }
    pixelArtDirectoryCache = { value: userDataPixelDir, expiresAt: now + PIXEL_ART_CACHE_TTL_MS };
    return userDataPixelDir;
  } catch (error) {
    console.log("[localitfy pixelart directory error]", error?.message || error);
    pixelArtDirectoryCache = { value: "", expiresAt: now + 5_000 };
    return "";
  }
}

function getPixelArtFiles(options = {}) {
  const force = Boolean(options.force);
  const now = Date.now();
  const root = getPixelArtDirectory({ force });

  if (!root) return [];
  if (!force && pixelArtFilesCache.root === root && pixelArtFilesCache.expiresAt > now) {
    return pixelArtFilesCache.value;
  }

  try {
    const files = fs.readdirSync(root)
      .map((name) => path.join(root, name))
      .filter(fileExists)
      .filter(isImageFile);
    pixelArtFilesCache = { value: files, root, expiresAt: now + PIXEL_ART_CACHE_TTL_MS };
    return files;
  } catch {
    pixelArtFilesCache = { value: [], root, expiresAt: now + 5_000 };
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

async function makeSongFromFile(filePath, pixelArtFiles = [], usedCovers = new Set(), options = {}) {
  const parsed = path.parse(filePath);
  const parts = parsed.name.split(" - ").map((item) => item.trim());
  let artist = "";
  let title = parsed.name;

  if (parts.length >= 2) {
    artist = parts[0];
    title = parts.slice(1).join(" - ");
  }

  const id = crypto.createHash("sha256").update(filePath).digest("hex");
  const metadata = await readLocalAudioMetadata(filePath);

  title = String(metadata?.title || title || parsed.name || "untitled").trim();
  artist = String(metadata?.artist || artist || "unknown artist").trim();
  const album = String(metadata?.album || options.album || "").trim();

  let fallbackCover = "";
  if (pixelArtFiles.length) {
    const available = pixelArtFiles.filter((p) => !usedCovers.has(p));
    fallbackCover = pickLeastUsedCover(available.length ? available : pixelArtFiles);
  }

  const coverResult = await resolveSongCover({
    song: {
      id,
      title,
      artist,
      album,
      filePath,
      coverPath: options.coverPath || "",
      coverSource: options.coverSource || ""
    },
    metadata,
    filePath,
    folderCoverPath: options.folderCoverPath || "",
    albumEmbeddedCoverPath: options.albumEmbeddedCoverPath || options.albumCoverPath || "",
    spotifyCoverPath: options.spotifyCoverPath || "",
    fallbackCoverPath: fallbackCover
  });

  if (coverResult.coverSource === "fallback" && coverResult.coverPath) {
    usedCovers.add(coverResult.coverPath);
  }

  const durationMs = Math.max(0, Number(metadata?.durationMs || options.durationMs || 0));
  const duration = Math.max(0, Number(metadata?.duration || Math.round(durationMs / 1000) || options.duration || 0));

  return {
    id,
    title,
    artist,
    album,
    filePath,
    coverPath: coverResult.coverPath || "",
    coverSource: coverResult.coverSource || "none",
    coverUpdatedAt: coverResult.coverUpdatedAt || new Date().toISOString(),
    duration,
    durationMs: durationMs || (duration > 0 ? duration * 1000 : 0),
    track: Number(metadata?.track || 0) || 0,
    disc: Number(metadata?.disc || 0) || 0,
    year: metadata?.year || "",
    bitrate: 0,
    addedAt: Date.now()
  };
}

function normalizeForLooseMatch(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function listAudioFilesInDirectory(directory, options = {}) {
  const root = String(directory || "");
  const maxDepth = Number.isFinite(Number(options.maxDepth)) ? Number(options.maxDepth) : 2;
  const maxFiles = Number.isFinite(Number(options.maxFiles)) ? Number(options.maxFiles) : 1500;
  const out = [];

  if (!root || !path.isAbsolute(root) || !fs.existsSync(root)) return out;

  const walk = (dir, depth) => {
    if (out.length >= maxFiles || depth > maxDepth) return;

    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (out.length >= maxFiles) break;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name === "localitfy-bin" || entry.name === "spotify-covers") continue;
        walk(fullPath, depth + 1);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!isAudioFile(fullPath)) continue;
      if (/\.(part|tmp|download|crdownload)$/i.test(entry.name)) continue;
      out.push(fullPath);
    }
  };

  walk(root, 0);

  out.sort((a, b) => {
    const aInfo = getFileInfoCached(a);
    const bInfo = getFileInfoCached(b);
    return (bInfo.mtimeMs || 0) - (aInfo.mtimeMs || 0);
  });

  return out;
}

function matchSpotifyTrackForFile(filePath, tracks = []) {
  const fileKey = normalizeForLooseMatch(path.parse(String(filePath || "")).name);
  if (!fileKey || !Array.isArray(tracks) || !tracks.length) return null;

  let best = null;
  let bestScore = 0;

  for (const track of tracks) {
    const title = normalizeForLooseMatch(track?.title || track?.name || "");
    const artist = normalizeForLooseMatch(track?.artist || track?.artists || "");
    const combined = normalizeForLooseMatch(`${artist} ${title}`);

    let score = 0;
    if (title && fileKey.includes(title)) score += 5;
    if (artist && fileKey.includes(artist)) score += 3;
    if (combined && (fileKey.includes(combined) || combined.includes(fileKey))) score += 7;

    const fileWords = new Set(fileKey.split(" ").filter((word) => word.length > 2));
    const trackWords = new Set(`${artist} ${title}`.split(" ").filter((word) => word.length > 2));

    let overlap = 0;
    for (const word of trackWords) {
      if (fileWords.has(word)) overlap += 1;
    }

    score += overlap;

    if (score > bestScore) {
      best = track;
      bestScore = score;
    }
  }

  return bestScore >= 3 ? best : null;
}

async function makeSongFromFileWithMetadata(filePath, tracks = [], pixelArtFiles = [], usedCovers = new Set()) {
  const baseSong = await makeSongFromFile(filePath, pixelArtFiles, usedCovers);
  const matched = matchSpotifyTrackForFile(filePath, tracks);

  if (!matched) return baseSong;

  const title = String(matched?.title || matched?.name || baseSong.title || "").trim();
  const artist = String(matched?.artist || matched?.artists || baseSong.artist || "").trim();
  const album = String(matched?.albumName || matched?.album || baseSong.album || "").trim();
  const coverUrl = String(matched?.coverUrl || matched?.spotifyCoverUrl || matched?.albumCoverUrl || "").trim();
  const cachedCoverPath = await cacheSpotifyCoverImage(coverUrl, matched?.id || title || filePath);
  const useSpotifyCover = cachedCoverPath && (!baseSong.coverPath || baseSong.coverSource === "fallback" || baseSong.coverSource === "none");

  return {
    ...baseSong,
    title: title || baseSong.title,
    artist: artist || baseSong.artist,
    album: album || baseSong.album || "",
    coverPath: useSpotifyCover ? cachedCoverPath : baseSong.coverPath,
    coverSource: useSpotifyCover ? "spotify" : baseSong.coverSource,
    coverUpdatedAt: useSpotifyCover ? new Date().toISOString() : baseSong.coverUpdatedAt,
    duration: Number(matched?.duration || Math.round(Number(matched?.durationMs || 0) / 1000) || baseSong.duration || 0),
    durationMs: Number(matched?.durationMs || baseSong.durationMs || 0) || 0
  };
}

async function makeSongFromFileWithExactSpotifyTrack(filePath, track = {}, pixelArtFiles = [], usedCovers = new Set(), sourceInfo = {}) {
  const baseSong = await makeSongFromFile(filePath, pixelArtFiles, usedCovers);

  const title = String(track?.title || track?.name || "").trim();
  const artist = String(track?.artist || track?.artists || "").trim();
  const album = String(track?.albumName || track?.album || "").trim();
  const coverUrl = String(track?.coverUrl || track?.spotifyCoverUrl || track?.albumCoverUrl || "").trim();
  const duration = Number(track?.duration || Math.round(Number(track?.durationMs || 0) / 1000) || baseSong.duration || 0);
  const spotifyTrackId = String(sourceInfo?.sourceTrackId || track?.sourceTrackId || track?.spotifyTrackId || track?.id || "").trim();
  const spotifyUrl = String(sourceInfo?.sourceUrl || track?.sourceUrl || track?.spotifyUrl || (spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : "")).trim();
  const cachedCoverPath = await cacheSpotifyCoverImage(coverUrl, spotifyTrackId || track?.id || title || filePath);
  const useSpotifyCover = cachedCoverPath && (!baseSong.coverPath || baseSong.coverSource === "fallback" || baseSong.coverSource === "none");

  return {
    ...baseSong,
    title: title || baseSong.title,
    artist: artist || baseSong.artist,
    album: album || baseSong.album || "",
    coverPath: useSpotifyCover ? cachedCoverPath : baseSong.coverPath,
    coverSource: useSpotifyCover ? "spotify" : baseSong.coverSource,
    coverUpdatedAt: useSpotifyCover ? new Date().toISOString() : baseSong.coverUpdatedAt,
    duration,
    durationMs: Number(track?.durationMs || duration * 1000 || baseSong.durationMs || 0) || 0,
    sourceType: "spotify",
    sourceTrackId: spotifyTrackId,
    sourceUrl: spotifyUrl,
    sourceProvider: String(sourceInfo?.sourceProvider || sourceInfo?.provider || "youtube"),
    sourceProviderUrl: String(sourceInfo?.sourceProviderUrl || sourceInfo?.providerUrl || ""),
    sourceMatchScore: Number(sourceInfo?.sourceMatchScore ?? sourceInfo?.matchScore ?? 0) || 0
  };
}

async function importNewAudioFilesFromDirectory(directory, tracks = [], options = {}) {
  const audioFiles = listAudioFilesInDirectory(directory, options);
  if (!audioFiles.length) {
    return { changedCount: 0, importedCount: 0, songs: listSongsShaped(), files: [] };
  }

  const existingPaths = new Set(
    getSongs()
      .map((song) => path.normalize(String(song.filePath || "")).toLowerCase())
      .filter(Boolean)
  );

  const newFiles = audioFiles.filter((filePath) => {
    const key = path.normalize(String(filePath || "")).toLowerCase();
    return key && !existingPaths.has(key);
  });

  if (!newFiles.length) {
    return { changedCount: 0, importedCount: 0, songs: listSongsShaped(), files: [] };
  }

  const pixelArtFiles = getPixelArtFiles();
  const usedCovers = new Set();
  const importedSongs = [];

  for (const filePath of newFiles) {
    importedSongs.push(await makeSongFromFileWithMetadata(filePath, tracks, pixelArtFiles, usedCovers));
  }

  const changedCount = insertSongs(importedSongs);
  clearFileInfoCache();

  console.log("[localtify library refresh] imported new audio files from folder", {
    folder: directory,
    found: audioFiles.length,
    newFiles: newFiles.length,
    changedCount
  });

  return {
    changedCount,
    importedCount: importedSongs.length,
    songs: listSongsShaped(),
    files: newFiles
  };
}


const albumFolderScanCache = new Map();
const ALBUM_FOLDER_SCAN_TTL_MS = 20 * 60 * 1000;
const ALBUM_FOLDER_MAX_ALBUMS = 260;
const ALBUM_FOLDER_MAX_TRACKS_PER_ALBUM = 420;
const ALBUM_FOLDER_LIBRARY_SCAN_MAX_DEPTH = 4;
const ALBUM_FOLDER_SCAN_YIELD_EVERY_TRACKS = 8;
const ALBUM_FOLDER_IMPORT_YIELD_EVERY_TRACKS = 12;
const ALBUM_FOLDER_IMPORT_PROGRESS_EVERY_TRACKS = 5;
const ALBUM_FOLDER_DISC_FOLDER_RE = /^(?:cd|disc|disk|side|volume|vol)\s*[-_ ]?\d{1,2}$/i;

function cleanAlbumFolderText(value, fallback = "") {
  const text = String(value || "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (text || fallback).slice(0, 140);
}

function cleanupAlbumTrackName(value = "") {
  return cleanAlbumFolderText(value)
    .replace(/^\s*(?:cd|disc)?\s*\d{1,2}\s*[-_. ]+\s*/i, "")
    .replace(/^\s*\d{1,3}\s*[-_. ]+\s*/i, "")
    .replace(/^\s*\d{1,2}-\d{1,3}\s*[-_. ]+\s*/i, "")
    .trim();
}

function parseAlbumTrackFileName(filePath, fallbackAlbumTitle = "local album") {
  const parsed = path.parse(String(filePath || ""));
  const rawName = cleanupAlbumTrackName(parsed.name || "track");
  const parts = rawName.split(" - ").map((item) => cleanAlbumFolderText(item)).filter(Boolean);

  let artist = "unknown artist";
  let title = rawName || parsed.name || "track";

  if (parts.length >= 2) {
    artist = parts[0] || artist;
    title = parts.slice(1).join(" - ") || title;
  }

  return {
    title: cleanAlbumFolderText(title, parsed.name || "track"),
    artist: cleanAlbumFolderText(artist, "unknown artist"),
    album: cleanAlbumFolderText(fallbackAlbumTitle, "local album")
  };
}

function albumTrackNumberFromFileName(filePath, index = 0) {
  const name = path.parse(String(filePath || "")).name;
  const match = name.match(/^\s*(?:cd|disc)?\s*(\d{1,2})?\s*[-_. ]?\s*(\d{1,3})\b/i) || name.match(/^\s*(\d{1,3})\b/);
  const value = Number(match?.[2] || match?.[1] || 0);
  return Number.isFinite(value) && value > 0 ? value : index + 1;
}

function findAlbumFolderCoverPath(folderPath) {
  return findFolderCover(folderPath);
}

function folderHasAudioFiles(folderPath) {
  // Direct-only. Parent artist/library folders must not become one giant album.
  return listAudioFilesInDirectory(folderPath, { maxDepth: 0, maxFiles: 8 }).length > 0;
}

function isDiscLikeAlbumSubfolderName(name = "") {
  return ALBUM_FOLDER_DISC_FOLDER_RE.test(String(name || "").trim());
}

function folderHasDiscAudioFiles(folderPath) {
  let entries = [];
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return false;
  }

  return entries.some((entry) => {
    if (!entry.isDirectory()) return false;
    if (!isDiscLikeAlbumSubfolderName(entry.name)) return false;
    return folderHasAudioFiles(path.join(folderPath, entry.name));
  });
}

function isAlbumFolderCandidate(folderPath) {
  // A real album folder either directly contains tracks or has immediate
  // CD1/Disc 1 style subfolders. Do not scan random grandchildren here.
  return folderHasAudioFiles(folderPath) || folderHasDiscAudioFiles(folderPath);
}

function isIgnoredAlbumLibraryFolderName(name = "") {
  return String(name || "").startsWith(".") ||
    name === "localitfy-bin" ||
    name === "spotify-covers" ||
    name === "node_modules" ||
    name === "release" ||
    name === "dist";
}

function findAlbumFoldersFromRoot(rootPath, mode = "single") {
  const root = String(rootPath || "");
  if (!root || !path.isAbsolute(root) || !fs.existsSync(root)) return [];

  const folders = [];
  const queue = [{ folderPath: root, depth: 0 }];
  const seen = new Set();

  while (queue.length && folders.length < ALBUM_FOLDER_MAX_ALBUMS) {
    const current = queue.shift();
    const folderPath = current?.folderPath || "";
    const depth = Number(current?.depth || 0);
    const folderKey = path.normalize(folderPath).toLowerCase();

    if (!folderPath || seen.has(folderKey)) continue;
    seen.add(folderKey);

    const isRoot = folderKey === path.normalize(root).toLowerCase();

    if (isAlbumFolderCandidate(folderPath)) {
      folders.push(folderPath);
      // Once a folder is a valid album, never keep walking into it as separate
      // nested albums except the root fallback case below.
      continue;
    }

    if (depth >= ALBUM_FOLDER_LIBRARY_SCAN_MAX_DEPTH) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(folderPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (isIgnoredAlbumLibraryFolderName(entry.name)) continue;
      queue.push({ folderPath: path.join(folderPath, entry.name), depth: depth + 1 });
    }

    // Single import on an artist/library folder should not create one giant
    // fake album. If the chosen folder has no direct tracks, it falls through
    // to discovered child album folders instead.
    if (mode === "single" && isRoot && folders.length) break;
  }

  return folders.slice(0, ALBUM_FOLDER_MAX_ALBUMS);
}

async function buildAlbumFolderPreview(folderPath, index = 0) {
  const folderTitle = cleanAlbumFolderText(path.basename(folderPath), `album ${index + 1}`);
  const existingPaths = new Set(
    getSongs()
      .map((song) => path.normalize(String(song.filePath || "")).toLowerCase())
      .filter(Boolean)
  );

  const audioFiles = listAudioFilesInDirectory(folderPath, { maxDepth: 1, maxFiles: ALBUM_FOLDER_MAX_TRACKS_PER_ALBUM });
  const folderCoverPath = findAlbumFolderCoverPath(folderPath);

  let albumEmbeddedCoverPath = "";
  const parsedTracks = [];

  for (let trackIndex = 0; trackIndex < audioFiles.length; trackIndex += 1) {
    if (trackIndex > 0 && trackIndex % ALBUM_FOLDER_SCAN_YIELD_EVERY_TRACKS === 0) {
      await yieldToMainLoop();
    }

    const filePath = audioFiles[trackIndex];
    const filenameMetadata = parseAlbumTrackFileName(filePath, folderTitle);
    const shouldReadCover = !folderCoverPath && !albumEmbeddedCoverPath && trackIndex < 12;
    const tagMetadata = await readLocalAudioMetadata(filePath, { readCover: shouldReadCover });
    const duplicate = existingPaths.has(path.normalize(String(filePath || "")).toLowerCase());

    if (!albumEmbeddedCoverPath && tagMetadata?.embeddedCoverPath && fileExists(tagMetadata.embeddedCoverPath)) {
      albumEmbeddedCoverPath = tagMetadata.embeddedCoverPath;
    }

    const durationMs = Math.max(
      0,
      Number(tagMetadata?.durationMs || 0),
      Number(tagMetadata?.duration || 0) > 0 ? Number(tagMetadata.duration) * 1000 : 0
    );

    parsedTracks.push({
      id: crypto.createHash("sha1").update(`${filePath}:${trackIndex}`).digest("hex"),
      filePath,
      title: cleanAlbumFolderText(tagMetadata?.title, filenameMetadata.title),
      artist: cleanAlbumFolderText(tagMetadata?.artist, filenameMetadata.artist),
      album: cleanAlbumFolderText(tagMetadata?.album, filenameMetadata.album),
      duration: durationMs > 0 ? Math.round(durationMs / 1000) : Number(tagMetadata?.duration || 0) || 0,
      durationMs,
      disc: Number(tagMetadata?.disc || 1) || 1,
      track: Number(tagMetadata?.track || albumTrackNumberFromFileName(filePath, trackIndex)) || albumTrackNumberFromFileName(filePath, trackIndex),
      duplicate,
      metadataSource: tagMetadata?.source || "filename",
      durationSource: tagMetadata?.durationSource || "none",
      hasEmbeddedCover: Boolean(tagMetadata?.hasEmbeddedCover)
    });
  }

  parsedTracks.sort((a, b) => (a.disc || 1) - (b.disc || 1) || (a.track || 0) - (b.track || 0) || a.title.localeCompare(b.title));

  const artistCounts = new Map();
  const albumCounts = new Map();

  for (const track of parsedTracks) {
    const artist = cleanAlbumFolderText(track.artist, "unknown artist");
    const album = cleanAlbumFolderText(track.album, "");

    if (artist && artist !== "unknown artist") artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    if (album && album !== "local album") albumCounts.set(album, (albumCounts.get(album) || 0) + 1);
  }

  const albumArtist = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "various artists";
  const tagAlbumTitle = [...albumCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  // Folder albums should trust the folder name first. Embedded tags are often
  // generic ("localtify", "unknown album", etc.) and caused every imported
  // folder album to collapse into ugly tag-based names.
  const albumTitle = cleanAlbumFolderText(folderTitle || tagAlbumTitle, tagAlbumTitle || folderTitle);
  const duplicateCount = parsedTracks.filter((track) => track.duplicate).length;
  const coverPath = folderCoverPath || albumEmbeddedCoverPath || "";
  const coverSource = folderCoverPath ? "folder" : albumEmbeddedCoverPath ? "embedded" : "none";

  return {
    id: crypto.createHash("sha1").update(folderPath).digest("hex"),
    title: albumTitle,
    artist: albumArtist,
    sourcePath: folderPath,
    coverPath,
    coverSource,
    folderCoverPath: folderCoverPath || "",
    embeddedCoverPath: albumEmbeddedCoverPath || "",
    coverUrl: coverPath ? safeMediaUrl(coverPath) : "",
    coverThumbUrl: coverPath ? getCoverThumbnailUrl(coverPath) : "",
    coverThumbnailUrl: coverPath ? getCoverThumbnailUrl(coverPath) : "",
    thumbnailUrl: coverPath ? getCoverThumbnailUrl(coverPath) : "",
    coverFullUrl: coverPath ? safeMediaUrl(coverPath) : "",
    trackCount: parsedTracks.length,
    duplicateCount,
    warnings: duplicateCount ? [`${duplicateCount} track${duplicateCount === 1 ? "" : "s"} already in library`] : [],
    tracks: parsedTracks
  };
}

function pruneAlbumFolderScanCache() {
  const now = Date.now();
  for (const [scanId, scan] of albumFolderScanCache) {
    if (!scan?.createdAt || now - scan.createdAt > ALBUM_FOLDER_SCAN_TTL_MS) {
      albumFolderScanCache.delete(scanId);
    }
  }
}

async function handleAlbumFolderScan(event, payload = {}) {
  const mode = payload?.mode === "library" ? "library" : "single";
  const senderWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = senderWindow && !senderWindow.isDestroyed()
    ? await dialog.showOpenDialog(senderWindow, {
        title: mode === "library" ? "Choose folder containing album folders" : "Choose one album folder",
        buttonLabel: mode === "library" ? "scan album library" : "scan album folder",
        defaultPath: app.getPath("music"),
        properties: ["openDirectory"]
      })
    : await dialog.showOpenDialog({
        title: mode === "library" ? "Choose folder containing album folders" : "Choose one album folder",
        buttonLabel: mode === "library" ? "scan album library" : "scan album folder",
        defaultPath: app.getPath("music"),
        properties: ["openDirectory"]
      });

  if (result.canceled || !result.filePaths?.[0]) {
    return { ok: true, canceled: true, mode, albums: [], albumCount: 0, trackCount: 0, duplicateCount: 0, message: "album folder picker cancelled" };
  }

  const rootPath = result.filePaths[0];
  event.sender.send("album-folder-import:progress", { type: "scan-start", mode, rootPath, message: "Scanning album folders..." });

  const folderPaths = findAlbumFoldersFromRoot(rootPath, mode);
  const albums = [];

  for (let index = 0; index < folderPaths.length; index += 1) {
    const folderPath = folderPaths[index];
    event.sender.send("album-folder-import:progress", {
      type: "scan-progress",
      mode,
      index: index + 1,
      total: folderPaths.length,
      folder: folderPath,
      folderPath,
      message: `Scanning ${path.basename(folderPath)}`
    });

    const preview = await buildAlbumFolderPreview(folderPath, index);
    if (preview.trackCount > 0) albums.push(preview);
    await yieldToMainLoop();
  }

  pruneAlbumFolderScanCache();

  const scanId = crypto.randomBytes(12).toString("hex");
  const trackCount = albums.reduce((total, album) => total + album.trackCount, 0);
  const duplicateCount = albums.reduce((total, album) => total + (album.duplicateCount || 0), 0);
  const scanPayload = {
    ok: true,
    canceled: false,
    scanId,
    mode,
    rootPath,
    albumCount: albums.length,
    trackCount,
    duplicateCount,
    albums,
    message: albums.length
      ? `Found ${albums.length} album${albums.length === 1 ? "" : "s"} with ${trackCount} track${trackCount === 1 ? "" : "s"}.`
      : "No audio files were found in that folder."
  };

  albumFolderScanCache.set(scanId, { ...scanPayload, createdAt: Date.now() });
  event.sender.send("album-folder-import:progress", { type: "scan-done", mode, index: albums.length, total: albums.length, message: scanPayload.message });
  return scanPayload;
}

async function handleAlbumFolderImport(event, payload = {}) {
  pruneAlbumFolderScanCache();

  const scanId = String(payload?.scanId || "").trim();
  const scan = albumFolderScanCache.get(scanId);
  if (!scan) {
    return { ok: false, error: "Album scan expired. Please choose the album folder again.", songs: listSongsShaped(), albums: [] };
  }

  const albums = Array.isArray(scan.albums) ? scan.albums : [];
  const allTracks = albums.flatMap((album) => (Array.isArray(album.tracks) ? album.tracks : []).map((track) => ({ album, track })));

  event.sender.send("album-folder-import:progress", {
    type: "import-start",
    index: 0,
    total: allTracks.length,
    message: "Adding album tracks to Localtify..."
  });

  const existingSongsBefore = getSongs();
  const existingSongByPath = new Map(
    existingSongsBefore
      .filter((song) => song?.filePath)
      .map((song) => [path.normalize(String(song.filePath || "")).toLowerCase(), song])
  );
  const existingPaths = new Set(existingSongByPath.keys());

  const pixelArtFiles = getPixelArtFiles();
  const usedCovers = new Set();
  const importedSongs = [];
  let repairedExistingCount = 0;
  let repairedCoverCount = 0;
  let repairedDurationCount = 0;
  const importStartedAt = Date.now();

  for (let index = 0; index < allTracks.length; index += 1) {
    const { album, track } = allTracks[index];
    const filePath = String(track.filePath || "");
    const fileKey = path.normalize(filePath).toLowerCase();

    if (
      index === 0 ||
      index + 1 === allTracks.length ||
      index % ALBUM_FOLDER_IMPORT_PROGRESS_EVERY_TRACKS === 0
    ) {
      event.sender.send("album-folder-import:progress", {
        type: "import-progress",
        index: index + 1,
        total: allTracks.length,
        filePath,
        message: `Adding ${track.title || path.basename(filePath)}`
      });
    }

    if (index > 0 && index % ALBUM_FOLDER_IMPORT_YIELD_EVERY_TRACKS === 0) {
      await yieldToMainLoop();
    }

    if (!filePath || !fileExists(filePath) || !isAudioFile(filePath)) continue;

    const folderCoverPath = album.coverSource === "folder"
      ? album.coverPath || album.folderCoverPath || ""
      : album.folderCoverPath || "";
    const albumEmbeddedCoverPath = album.coverSource === "embedded"
      ? album.coverPath || album.embeddedCoverPath || ""
      : album.embeddedCoverPath || "";

    const existingSong = existingSongByPath.get(fileKey);

    if (existingSong) {
      // Important: importing an album folder again should repair existing tracks,
      // not skip them forever. This fixes old imports that got fallback/anime art or 0:00 duration.
      const metadata = await readLocalAudioMetadata(filePath, { readCover: !folderCoverPath });
      const fallbackCover = pickStablePixelCoverForSong(existingSong, pixelArtFiles);
      const coverResult = await resolveSongCover({
        song: existingSong,
        metadata,
        filePath,
        folderCoverPath,
        albumEmbeddedCoverPath,
        preferFolderCover: Boolean(folderCoverPath),
        fallbackCoverPath: fallbackCover
      });

      const durationMs = Math.max(
        0,
        Number(track.durationMs || 0),
        Number(metadata?.durationMs || 0),
        Number(track.duration || 0) > 0 ? Number(track.duration) * 1000 : 0,
        Number(metadata?.duration || 0) > 0 ? Number(metadata.duration) * 1000 : 0
      );
      const duration = durationMs > 0
        ? Math.round(durationMs / 1000)
        : Math.max(0, Number(track.duration || 0), Number(metadata?.duration || 0), Number(existingSong.duration || 0));

      const patch = {
        title: cleanAlbumFolderText(track.title || metadata?.title, existingSong.title || "track"),
        artist: cleanAlbumFolderText(track.artist || metadata?.artist, existingSong.artist || album.artist || "unknown artist"),
        album: cleanAlbumFolderText(album.title || track.album || metadata?.album, existingSong.album || "local album"),
        sourceType: "local",
        sourceProvider: "album-folder",
        sourceUrl: album.sourcePath || "",
        sourceProviderUrl: album.sourcePath || ""
      };

      if (durationMs > 0) {
        patch.duration = duration;
        patch.durationMs = durationMs;
      }

      if (coverResult?.coverPath && existingSong.coverSource !== "custom") {
        patch.coverPath = coverResult.coverPath;
        patch.coverSource = coverResult.coverSource || "none";
        patch.coverUpdatedAt = coverResult.coverUpdatedAt || new Date().toISOString();
      }

      patchSong(existingSong.id, patch);
      repairedExistingCount += 1;
      if (durationMs > 0) repairedDurationCount += 1;
      if (coverResult?.coverPath) repairedCoverCount += 1;
      continue;
    }

    const baseSong = await makeSongFromFile(filePath, pixelArtFiles, usedCovers, {
      album: album.title || track.album || "",
      folderCoverPath,
      albumEmbeddedCoverPath,
      preferFolderCover: Boolean(folderCoverPath)
    });

    const durationMs = Math.max(
      0,
      Number(track.durationMs || 0),
      Number(baseSong.durationMs || 0),
      Number(track.duration || 0) > 0 ? Number(track.duration) * 1000 : 0,
      Number(baseSong.duration || 0) > 0 ? Number(baseSong.duration) * 1000 : 0
    );
    const duration = durationMs > 0
      ? Math.round(durationMs / 1000)
      : Math.max(0, Number(track.duration || 0), Number(baseSong.duration || 0));

    importedSongs.push({
      ...baseSong,
      title: cleanAlbumFolderText(track.title, baseSong.title || "track"),
      artist: cleanAlbumFolderText(track.artist, baseSong.artist || album.artist || "unknown artist"),
      album: cleanAlbumFolderText(album.title || track.album, baseSong.album || "local album"),
      coverPath: baseSong.coverPath || "",
      coverSource: baseSong.coverSource || "none",
      coverUpdatedAt: baseSong.coverUpdatedAt || new Date().toISOString(),
      duration,
      durationMs: durationMs || (duration > 0 ? duration * 1000 : 0),
      sourceType: "local",
      sourceProvider: "album-folder",
      sourceUrl: album.sourcePath || "",
      sourceProviderUrl: album.sourcePath || ""
    });
    existingPaths.add(fileKey);
  }

  const insertedCount = importedSongs.length ? insertSongs(importedSongs) : 0;
  clearFileInfoCache();

  const rawSongs = getSongs();
  const songById = new Map(rawSongs.map((song) => [song.id, song]));
  const songByPath = new Map(rawSongs.map((song) => [path.normalize(String(song.filePath || "")).toLowerCase(), song]));
  const importedAlbums = albums.map((album) => {
    const songIds = (album.tracks || [])
      .map((track) => songByPath.get(path.normalize(String(track.filePath || "")).toLowerCase())?.id)
      .filter(Boolean);

    const albumSongs = songIds.map((id) => songById.get(id)).filter(Boolean);
    const preferredCoverSong =
      albumSongs.find((song) => String(song.coverSource || "") === "folder" && song.coverPath) ||
      albumSongs.find((song) => String(song.coverSource || "") === "embedded" && song.coverPath) ||
      albumSongs.find((song) => String(song.coverSource || "") === "custom" && song.coverPath) ||
      albumSongs.find((song) => song.coverPath) ||
      null;
    const stableCoverPath = preferredCoverSong?.coverPath || album.coverPath || "";
    const stableCoverSource = preferredCoverSong?.coverSource || album.coverSource || "none";
    const stableCoverUrl = stableCoverPath ? safeMediaUrl(stableCoverPath) : (preferredCoverSong?.coverUrl || album.coverUrl || "");

    return {
      id: album.id,
      manualAlbumId: crypto.createHash("sha1").update(String(album.sourcePath || album.id || album.title)).digest("hex"),
      title: album.title,
      artist: album.artist || "various artists",
      year: "",
      coverPath: stableCoverPath,
      coverSource: stableCoverSource,
      coverUrl: stableCoverUrl || "",
      sourceType: "folder",
      sourcePath: album.sourcePath || "",
      folderCoverPath: album.folderCoverPath || (album.coverSource === "folder" ? album.coverPath || "" : ""),
      embeddedCoverPath: album.embeddedCoverPath || (album.coverSource === "embedded" ? album.coverPath || "" : ""),
      importedAt: importStartedAt,
      createdAt: importStartedAt,
      updatedAt: Date.now(),
      songIds
    };
  }).filter((album) => album.songIds.length > 0);

  const changedCount = insertedCount + repairedExistingCount;
  const afterSongs = listSongsShaped();
  const message = `Imported ${insertedCount} new track${insertedCount === 1 ? "" : "s"} and repaired ${repairedExistingCount} existing track${repairedExistingCount === 1 ? "" : "s"} from ${importedAlbums.length} album${importedAlbums.length === 1 ? "" : "s"}.`;

  event.sender.send("album-folder-import:progress", {
    type: "import-done",
    index: allTracks.length,
    total: allTracks.length,
    changedCount,
    message
  });

  albumFolderScanCache.delete(scanId);

  return {
    ok: true,
    changedCount,
    insertedCount,
    repairedExistingCount,
    repairedCoverCount,
    repairedDurationCount,
    importedCount: importedSongs.length,
    trackCount: allTracks.length,
    mode: scan.mode,
    rootPath: scan.rootPath || "",
    songs: afterSongs,
    albums: importedAlbums,
    message
  };
}

async function repairSpotifyMetadataForFolder(directory, tracks = [], options = {}) {
  const audioFiles = listAudioFilesInDirectory(directory, options);
  if (!audioFiles.length || !Array.isArray(tracks) || !tracks.length) {
    return { changedCount: 0, songs: listSongsShaped() };
  }

  const songs = getSongs();
  const byPath = new Map(
    songs
      .filter((song) => song?.filePath)
      .map((song) => [path.normalize(String(song.filePath)).toLowerCase(), song])
  );

  let changedCount = 0;

  for (const filePath of audioFiles) {
    const key = path.normalize(String(filePath || "")).toLowerCase();
    const song = byPath.get(key);
    if (!song) continue;

    const matched = matchSpotifyTrackForFile(filePath, tracks);
    if (!matched) continue;

    const title = String(matched?.title || matched?.name || "").trim();
    const artist = String(matched?.artist || matched?.artists || "").trim();
    const album = String(matched?.albumName || matched?.album || "").trim();
    const coverUrl = String(matched?.coverUrl || matched?.spotifyCoverUrl || matched?.albumCoverUrl || "").trim();
    const cachedCoverPath = await cacheSpotifyCoverImage(coverUrl, matched?.id || title || filePath);

    const patch = {};
    const currentArtist = String(song.artist || "").trim().toLowerCase();
    const currentTitle = String(song.title || "").trim().toLowerCase();
    const currentCover = String(song.coverPath || "").trim();

    if (title && (!song.title || currentTitle === "unknown title" || currentTitle === normalizeForLooseMatch(path.parse(filePath).name))) {
      patch.title = title;
    }

    // Always allow Spotify to fix weak filename-derived artists like "slowed",
    // "unknown artist", or empty artist.
    if (
      artist &&
      (
        !song.artist ||
        currentArtist === "unknown artist" ||
        currentArtist === "unknown" ||
        currentArtist === "slowed" ||
        currentArtist === "slow" ||
        currentArtist === "reverb" ||
        currentArtist === "nightcore" ||
        currentArtist === "sped up"
      )
    ) {
      patch.artist = artist;
    }

    if (album && (!song.album || String(song.album).trim().toLowerCase() === "unknown album")) {
      patch.album = album;
    }

    if (cachedCoverPath) {
      const normalizedCover = currentCover.replace(/\\/g, "/").toLowerCase();
      const isPixelFallback = normalizedCover.includes("/pixelart/");
      const isSpotifyCover = normalizedCover.includes("/spotify-covers/");

      if (!currentCover || !fileExists(currentCover) || isPixelFallback || !isSpotifyCover) {
        patch.coverPath = cachedCoverPath;
      }
    }

    const duration = Number(matched?.duration || Math.round(Number(matched?.durationMs || 0) / 1000) || 0);
    if (duration > 0 && !Number(song.duration || 0)) {
      patch.duration = duration;
    }

    if (Object.keys(patch).length) {
      try {
        patchSong(song.id, patch);
        changedCount += 1;
      } catch (error) {
        console.log("[localtify spotify metadata repair error]", error?.message || error);
      }
    }
  }

  if (changedCount) clearFileInfoCache();

  console.log("[localtify spotify metadata repair]", {
    folder: directory,
    checked: audioFiles.length,
    repaired: changedCount
  });

  return { changedCount, songs: listSongsShaped() };
}




function pickStablePixelCoverForSong(song, pixelArtFiles = null) {
  const covers = Array.isArray(pixelArtFiles) ? pixelArtFiles : getPixelArtFiles();
  if (!covers.length) return "";

  const seed = [song?.id, song?.title, song?.artist, song?.album, song?.filePath]
    .filter(Boolean)
    .join("::");

  try {
    const digest = crypto.createHash("sha1").update(seed || "localtify-cover").digest();
    const index = digest.readUInt32BE(0) % covers.length;
    return covers[index] || "";
  } catch {
    return covers[0] || "";
  }
}

function getRuntimeCoverPath(song, pixelArtFiles = null) {
  const savedCoverPath = String(song?.coverPath || "").trim();
  if (savedCoverPath && fileExists(savedCoverPath) && isImageFile(savedCoverPath)) return savedCoverPath;
  return pickStablePixelCoverForSong(song, pixelArtFiles);
}

function shapeSong(song, pixelArtFiles = null) {
  if (!song) return null;
  const exists = fileExists(song.filePath);
  const savedCoverPath = String(song.coverPath || "").trim();
  const savedCoverExists = Boolean(savedCoverPath && fileExists(savedCoverPath) && isImageFile(savedCoverPath));
  const runtimeCoverPath = getRuntimeCoverPath(song, pixelArtFiles);
  const coverExists = Boolean(runtimeCoverPath && fileExists(runtimeCoverPath));
  const runtimeCoverSource = savedCoverExists ? String(song.coverSource || "unknown") : (runtimeCoverPath ? "fallback" : "none");

  const coverUrl = coverExists ? safeMediaUrl(runtimeCoverPath) : "";
  const coverThumbUrl = coverExists ? getCoverThumbnailUrl(runtimeCoverPath) : "";

  return {
    ...song,
    // Keep database/bootstrap rows clean. Audio URLs are resolved lazily from filePath by playback:resolve-url.
    url: "",
    // Never hand the renderer a raw file:// cover. In packaged builds Chromium blocks it.
    // If the DB has no coverPath or the old path is broken, use a stable bundled pixel-art fallback at runtime.
    coverPath: savedCoverPath || runtimeCoverPath || "",
    coverSource: runtimeCoverSource,
    coverUpdatedAt: song.coverUpdatedAt || null,
    durationMs: Number(song.durationMs || (Number(song.duration || 0) * 1000) || 0),
    savedCoverPath,
    savedCoverExists,
    usesFallbackCover: runtimeCoverSource === "fallback" || !savedCoverExists,
    missingSavedCover: !savedCoverPath || (Boolean(savedCoverPath) && !savedCoverExists),
    coverUrl,
    coverThumbUrl,
    coverThumbnailUrl: coverThumbUrl,
    thumbnailUrl: coverThumbUrl,
    coverFullUrl: coverUrl,
    exists,
    fileExists: exists,
    coverExists,
    coverThumbnailReady: Boolean(coverThumbUrl)
  };
}

function listSongsShaped() {
  const pixelArtFiles = getPixelArtFiles();
  return getSongs().map((song) => shapeSong(song, pixelArtFiles));
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


async function repairMissingSongMetadata(payload = {}) {
  const limit = Math.max(1, Math.min(1000, Number(payload?.limit || 180) || 180));
  const force = Boolean(payload?.force || payload?.forceAll);
  const coverOnly = Boolean(payload?.coverOnly);
  const durationOnly = Boolean(payload?.durationOnly);
  const allSongs = getSongs();
  const pixelArtFiles = getPixelArtFiles();

  const targets = allSongs.filter((song) => {
    if (!song?.filePath || !fileExists(song.filePath) || !isAudioFile(song.filePath)) return false;

    const durationMissing = Number(song.duration || 0) <= 0 || Number(song.durationMs || 0) <= 0;
    const coverMissing =
      !song.coverPath ||
      !fileExists(song.coverPath) ||
      !song.coverSource ||
      song.coverSource === "fallback" ||
      song.coverSource === "none" ||
      song.coverSource === "unknown";

    if (force) return true;
    if (coverOnly) return coverMissing;
    if (durationOnly) return durationMissing;
    return durationMissing || coverMissing;
  }).slice(0, limit);

  let changedCount = 0;
  let durationFixedCount = 0;
  let coverFixedCount = 0;
  const changedIds = [];

  for (const song of targets) {
    const metadata = await readLocalAudioMetadata(song.filePath);
    const fallbackCover = pickStablePixelCoverForSong(song, pixelArtFiles);

    const coverResult = await resolveSongCover({
      song,
      metadata,
      filePath: song.filePath,
      folderCoverPath: findFolderCover(song.filePath),
      fallbackCoverPath: fallbackCover
    });

    const patch = {};
    const title = String(metadata?.title || "").trim();
    const artist = String(metadata?.artist || "").trim();
    const album = String(metadata?.album || "").trim();

    if (!durationOnly) {
      if (title && (!song.title || song.title === path.parse(song.filePath).name)) patch.title = title;
      if (artist && (!song.artist || song.artist === "unknown artist")) patch.artist = artist;
      if (album && (!song.album || song.album === "local files")) patch.album = album;
    }

    const metadataDurationMs = Math.max(
      0,
      Number(metadata?.durationMs || 0),
      Number(metadata?.duration || 0) > 0 ? Number(metadata.duration) * 1000 : 0
    );

    if (!coverOnly && metadataDurationMs > 0 && (force || Number(song.duration || 0) <= 0 || Number(song.durationMs || 0) <= 0)) {
      patch.durationMs = metadataDurationMs;
      patch.duration = Math.round(metadataDurationMs / 1000);
    }

    if (!durationOnly && coverResult.coverPath && (force || !song.coverPath || !fileExists(song.coverPath) || song.coverSource !== "custom" && ["fallback", "none", "unknown", ""].includes(String(song.coverSource || "")))) {
      patch.coverPath = coverResult.coverPath;
      patch.coverSource = coverResult.coverSource;
      patch.coverUpdatedAt = coverResult.coverUpdatedAt;
    }

    if (Object.keys(patch).length) {
      patchSong(song.id, patch);
      changedCount += 1;
      if (Object.prototype.hasOwnProperty.call(patch, "duration") || Object.prototype.hasOwnProperty.call(patch, "durationMs")) durationFixedCount += 1;
      if (Object.prototype.hasOwnProperty.call(patch, "coverPath")) coverFixedCount += 1;
      changedIds.push(song.id);
    }
  }

  clearFileInfoCache();

  return {
    ok: true,
    scannedCount: targets.length,
    changedCount,
    durationFixedCount,
    coverFixedCount,
    changedIds,
    songs: listSongsShaped()
  };
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


let localtifyRendererProtocolReady = false;

function safeRendererProtocolPathname(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const rawPath = decodeURIComponent(url.pathname || "/");
    if (!rawPath || rawPath === "/" || rawPath === "/index.html") return "index.html";
    return rawPath.replace(/^\/+/, "");
  } catch {
    return "index.html";
  }
}

function getRendererProtocolEntryUrl() {
  return `${LOCALTIFY_RENDERER_PROTOCOL}://app/index.html`;
}

function isPackagedLinuxAppImageRuntime() {
  return Boolean(app.isPackaged && process.platform === "linux");
}


function getLocaltifyRendererMimeType(filePath) {
  const ext = String(path.extname(filePath || "") || "").toLowerCase();
  switch (ext) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".mjs": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".ico": return "image/x-icon";
    case ".woff": return "font/woff";
    case ".woff2": return "font/woff2";
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".ogg": return "audio/ogg";
    default: return "application/octet-stream";
  }
}

function readLocaltifyRendererFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

function registerLocaltifyRendererProtocol() {
  if (isDev || localtifyRendererProtocolReady) return;
  localtifyRendererProtocolReady = true;

  protocol.handle(LOCALTIFY_RENDERER_PROTOCOL, async (request) => {
    const indexPath = getRendererIndexPath();
    const distDir = path.dirname(indexPath);
    const requestPath = safeRendererProtocolPathname(request.url);
    const targetPath = requestPath === "index.html"
      ? indexPath
      : path.normalize(path.join(distDir, requestPath));

    const normalizedDist = path.normalize(distDir);
    const normalizedTarget = path.normalize(targetPath);
    const insideDist = normalizedTarget === normalizedDist || normalizedTarget.startsWith(normalizedDist + path.sep);

    if (!insideDist) {
      return new Response("Blocked localtify renderer path", { status: 403 });
    }

    if (!filePathExistsForRenderer(normalizedTarget)) {
      console.log("[localtify renderer protocol missing asset]", request.url, normalizedTarget);
      return new Response("Localtify renderer asset missing", { status: 404 });
    }

    try {
      const data = await readLocaltifyRendererFile(normalizedTarget);
      return new Response(data, {
        status: 200,
        headers: {
          "content-type": getLocaltifyRendererMimeType(normalizedTarget),
          "cache-control": "no-cache"
        }
      });
    } catch (error) {
      console.log("[localtify renderer protocol read failed]", request.url, normalizedTarget, error?.message || error);
      return new Response("Localtify renderer asset read failed", { status: 500 });
    }
  });
}

function loadPackagedLocaltifyRenderer(win, indexPath) {
  if (!win || win.isDestroyed()) return Promise.resolve();
  registerLocaltifyRendererProtocol();
  const protocolUrl = getRendererProtocolEntryUrl();

  return win.loadURL(protocolUrl).catch((protocolError) => {
    console.log("[localtify renderer protocol load failed]", protocolError?.message || protocolError, protocolUrl, indexPath);
    if (!win || win.isDestroyed()) return;
    if (isPackagedLinuxAppImageRuntime()) {
      throw protocolError;
    }
    return win.loadFile(indexPath);
  });
}


function getLocaltifyGpuFeatureStatus() {
  try {
    return typeof app.getGPUFeatureStatus === "function" ? app.getGPUFeatureStatus() : {};
  } catch (error) {
    return { error: error?.message || String(error || "GPU feature status unavailable") };
  }
}

async function getLocaltifyPerformanceStatus() {
  let gpuInfo = null;
  try {
    gpuInfo = typeof app.getGPUInfo === "function" ? await app.getGPUInfo("basic") : null;
  } catch (error) {
    gpuInfo = { error: error?.message || String(error || "GPU info unavailable") };
  }

  let metrics = [];
  try {
    metrics = typeof app.getAppMetrics === "function"
      ? app.getAppMetrics().map((metric) => ({
          type: metric.type,
          pid: metric.pid,
          cpu: metric.cpu,
          memory: metric.memory,
          sandboxed: metric.sandboxed
        }))
      : [];
  } catch {
    metrics = [];
  }

  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const devToolsOpened = (() => {
    try {
      return Boolean(win?.webContents?.isDevToolsOpened?.());
    } catch {
      return false;
    }
  })();

  return {
    ok: true,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    isPackaged: Boolean(app.isPackaged),
    gpuTuning: LOCALTIFY_CHROMIUM_PERFORMANCE,
    gpuFeatureStatus: getLocaltifyGpuFeatureStatus(),
    gpuInfo,
    processMetrics: metrics,
    window: {
      exists: Boolean(win),
      visible: Boolean(win?.isVisible?.()),
      focused: Boolean(win?.isFocused?.()),
      devToolsOpened
    }
  };
}

function openLocaltifyDevTools(win = mainWindow, options = {}) {
  try {
    const target = win && !win.isDestroyed() ? win : mainWindow;
    if (!target || target.isDestroyed()) {
      return { ok: false, error: "main window is not ready" };
    }

    const mode = typeof options?.mode === "string" && options.mode
      ? options.mode
      : (isDev ? "detach" : "right");

    target.webContents.openDevTools({ mode, activate: true });
    return {
      ok: true,
      opened: true,
      mode,
      gpuFeatureStatus: getLocaltifyGpuFeatureStatus()
    };
  } catch (error) {
    return { ok: false, error: error?.message || String(error || "failed to open DevTools") };
  }
}

function toggleLocaltifyDevTools(win = mainWindow) {
  try {
    const target = win && !win.isDestroyed() ? win : mainWindow;
    if (!target || target.isDestroyed()) return { ok: false, error: "main window is not ready" };

    if (target.webContents.isDevToolsOpened()) {
      target.webContents.closeDevTools();
      return { ok: true, opened: false };
    }

    return openLocaltifyDevTools(target);
  } catch (error) {
    return { ok: false, error: error?.message || String(error || "failed to toggle DevTools") };
  }
}


function localtifyStartupShellHtml(title, message, detail = "") {
  const safe = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<!doctype html><html><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html,body{margin:0;width:100%;height:100%;background:#090012;color:#f8eaff;font-family:Inter,Segoe UI,system-ui,sans-serif;}
      body{display:grid;place-items:center;overflow:hidden;}
      .box{max-width:520px;padding:28px;border:1px solid rgba(232,94,255,.28);border-radius:26px;background:linear-gradient(135deg,rgba(42,8,56,.92),rgba(8,2,16,.96));box-shadow:0 24px 80px rgba(0,0,0,.55),0 0 42px rgba(220,76,255,.18);}
      h1{margin:0 0 10px;font-size:23px;letter-spacing:-.04em;}
      p{margin:0;color:#cbb8d8;line-height:1.55;font-size:14px;}
      code{display:block;margin-top:14px;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);color:#f4d5ff;white-space:pre-wrap;word-break:break-word;font-size:12px;}
    </style></head><body><div class="box"><h1>${safe(title)}</h1><p>${safe(message)}</p>${detail ? `<code>${safe(detail)}</code>` : ""}</div></body></html>`;
}

function loadLocaltifyStartupShell(win, title, message, detail = "") {
  if (!win || win.isDestroyed()) return;
  try {
    const html = localtifyStartupShellHtml(title, message, detail);
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => {});
  } catch (error) {
    console.log("[localtify startup shell error]", error?.message || error);
  }
}

function hardenRendererBackground(win) {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.insertCSS(`
      html, body, #root {
        min-width: 100%;
        min-height: 100%;
        background: #090012 !important;
      }
      body:empty::before {
        content: "";
        position: fixed;
        inset: 0;
        background: #090012;
      }
    `).catch(() => {});
  } catch {
    // harmless best-effort guard
  }
}

function verifyRendererMounted(win, indexPath) {
  if (!win || win.isDestroyed() || isDev || isPackagedLinuxAppImageRuntime()) return;

  setTimeout(async () => {
    if (!win || win.isDestroyed()) return;

    try {
      const state = await win.webContents.executeJavaScript(`(() => {
        const root = document.getElementById('root');
        const body = document.body;
        return {
          href: location.href,
          rootChars: root ? (root.innerHTML || '').trim().length : 0,
          bodyChars: body ? (body.innerHTML || '').trim().length : 0,
          title: document.title || ''
        };
      })()`, true);

      const rendererLooksEmpty = state && state.href && state.href.startsWith("file:") && state.rootChars < 16 && state.bodyChars < 64;
      if (!rendererLooksEmpty) return;

      console.log("[localtify renderer empty after startup]", state);

      if (!mainWindowRendererRecoveredOnce) {
        mainWindowRendererRecoveredOnce = true;
        win.webContents.reloadIgnoringCache();
        return;
      }

      loadLocaltifyStartupShell(
        win,
        "localtify could not finish opening",
        "The window started, but the renderer stayed empty. Restart Localtify once; if this repeats, run npm run build before packaging.",
        `Renderer: ${indexPath}`
      );
    } catch (error) {
      console.log("[localtify renderer verify error]", error?.message || error);
    }
  }, 2500);
}

function armRendererLoadWatchdog(win, indexPath) {
  if (!win || win.isDestroyed() || isDev || isPackagedLinuxAppImageRuntime()) return;
  clearTimeout(mainWindowRendererWatchdog);

  mainWindowRendererWatchdog = setTimeout(() => {
    if (!win || win.isDestroyed()) return;

    try {
      const loading = win.webContents.isLoading();
      const url = win.webContents.getURL();
      console.log("[localtify renderer startup watchdog]", { loading, url, indexPath });

      if (loading) {
        try { win.webContents.stop(); } catch {}
      }

      if (!mainWindowRendererRecoveredOnce) {
        mainWindowRendererRecoveredOnce = true;
        loadPackagedLocaltifyRenderer(win, indexPath).catch((error) => {
          loadLocaltifyStartupShell(win, "localtify could not load", error?.message || "Renderer load failed.", indexPath);
        });
        return;
      }

      loadLocaltifyStartupShell(win, "localtify is taking too long to open", "Windows startup may have launched the app before the renderer was ready.", indexPath);
    } catch (error) {
      console.log("[localtify renderer watchdog error]", error?.message || error);
    }
  }, 14000);
}

function clearRendererLoadWatchdog() {
  clearTimeout(mainWindowRendererWatchdog);
  mainWindowRendererWatchdog = null;
}

function attachLocaltifyDevToolsShortcuts(win) {
  if (!win || win.isDestroyed() || win.__localtifyDevToolsShortcutsAttached) return;
  win.__localtifyDevToolsShortcutsAttached = true;

  win.webContents.on("before-input-event", (event, input = {}) => {
    const key = String(input.key || "").toLowerCase();
    const isCtrlOrMeta = Boolean(input.control || input.meta);
    const isDevToolsCombo = (isCtrlOrMeta && input.shift && key === "i") || key === "f12";

    if (!isDevToolsCombo) return;

    event.preventDefault();
    const result = toggleLocaltifyDevTools(win);
    if (!result?.ok) {
      console.log("[localtify devtools shortcut error]", result?.error || result);
    }
  });
}


function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return;
  }
  const size = getSafeMainWindowSize();
  const windowTranslucency = getSavedWindowTranslucencySettings();
  const isTranslucentWindow = Boolean(windowTranslucency.translucentWindow);
  const nativeWindowOptions = process.platform === "win32"
    ? {
        // Native acrylic/mica makes the whole app grey. Localtify uses pure
        // transparent BrowserWindow + CSS surface tint instead.
        backgroundMaterial: "none"
      }
    : {};

  mainWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    show: false,
    frame: false,
    // V424: do not create the main window as natively transparent. On Windows
    // login/startup, transparent windows can appear as a permanent white/blank
    // compositor surface before React paints. CSS still handles the app glass.
    transparent: false,
    titleBarStyle: "hidden",
    backgroundColor: "#090012",
    paintWhenInitiallyHidden: true,
    ...nativeWindowOptions,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs"),
      webSecurity: true,
      // Keeps playback/render timers alive when Windows opens the app in the
      // background during login or the user alt-tabs quickly.
      backgroundThrottling: false
    }
  });
  attachLocaltifyDevToolsShortcuts(mainWindow);
  applyWindowTranslucencyToWindow(mainWindow, windowTranslucency);

  const rendererIndexPath = isDev ? "" : getRendererIndexPath();

  mainWindow.webContents.on("dom-ready", () => {
    hardenRendererBackground(mainWindow);
  });

  mainWindow.webContents.once("did-finish-load", () => {
    clearRendererLoadWatchdog();
    applyWindowTranslucencyToWindow(mainWindow, getSavedWindowTranslucencySettings());
    verifyRendererMounted(mainWindow, rendererIndexPath);
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173").catch((error) => {
      console.log("[localtify main window dev load error]", error?.message || error);
    });
  } else {
    console.log("[localtify renderer index]", rendererIndexPath);
    armRendererLoadWatchdog(mainWindow, rendererIndexPath);
    loadPackagedLocaltifyRenderer(mainWindow, rendererIndexPath).catch((error) => {
      console.log("[localtify main window packaged load error]", error?.message || error, rendererIndexPath);
      loadLocaltifyStartupShell(mainWindow, "localtify could not load", error?.message || "Renderer load failed.", rendererIndexPath);
    });
  }

  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    console.log(`[localitfy main window failed load]`, { code, desc, url, isMainFrame });
    const failedUrl = String(url || "");
    const isIgnorableAbort = code === -3 && (
      failedUrl.startsWith("data:") ||
      failedUrl.startsWith(`${LOCALTIFY_RENDERER_PROTOCOL}://`) ||
      (isPackagedLinuxAppImageRuntime() && failedUrl.startsWith("file:"))
    );
    if (!isDev && isMainFrame !== false && !isIgnorableAbort) {
      loadLocaltifyStartupShell(mainWindow, "localtify failed to load", `${desc || "load failed"} (${code})`, url || rendererIndexPath);
    }
  });

  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    console.log(`[localitfy main window renderer gone]`, details);
    if (!isDev && !mainWindowRendererRecoveredOnce && mainWindow && !mainWindow.isDestroyed()) {
      mainWindowRendererRecoveredOnce = true;
      setTimeout(() => {
        try { void loadPackagedLocaltifyRenderer(mainWindow, rendererIndexPath); } catch {}
      }, 450);
    }
  });
  mainWindow.webContents.on("console-message", (_event, ...args) => {
    const details = args.length === 1 && args[0] && typeof args[0] === "object"
      ? args[0]
      : { level: args[0], message: args[1], line: args[2], sourceId: args[3] };
    console.log(`[localitfy main window console]`, {
      level: details.level,
      message: details.message,
      line: details.line,
      sourceId: details.sourceId
    });
  });
  if (process.env.LOCALITFY_DEBUG === "1") {
    openLocaltifyDevTools(mainWindow, { mode: "detach" });
  }
  mainWindow.once("ready-to-show", () => {
    repairMainWindowBounds(mainWindow, { center: true });
    mainWindow.show();
  });

  if (isPackagedLinuxAppImageRuntime()) {
    setTimeout(() => {
      try {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
          repairMainWindowBounds(mainWindow, { center: true });
          mainWindow.show();
        }
      } catch (error) {
        console.log("[localtify linux delayed show error]", error?.message || error);
      }
    }, 1600);
  }
  mainWindow.on("closed", () => {
    clearRendererLoadWatchdog();
    mainWindow = null;
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


function cleanFeedbackText(value, maxLength = 1500) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}


function getPackagedEnvCandidatePaths() {
  const safePath = (...parts) => {
    try {
      return path.join(...parts.filter(Boolean));
    } catch {
      return "";
    }
  };

  const cwd = (() => {
    try {
      return process.cwd();
    } catch {
      return "";
    }
  })();

  const resourcePath = (() => {
    try {
      return process.resourcesPath || "";
    } catch {
      return "";
    }
  })();

  const executableDir = (() => {
    try {
      return process.execPath ? path.dirname(process.execPath) : "";
    } catch {
      return "";
    }
  })();

  const userDataPath = (() => {
    try {
      return typeof app.getPath === "function" ? app.getPath("userData") : "";
    } catch {
      return "";
    }
  })();

  return [
    safePath(cwd, ".env"),
    safePath(cwd, ".env.production"),
    safePath(executableDir, ".env"),
    safePath(executableDir, ".env.production"),
    safePath(resourcePath, ".env"),
    safePath(resourcePath, ".env.production"),
    safePath(resourcePath, "app", ".env"),
    safePath(resourcePath, "app.asar.unpacked", ".env"),
    safePath(userDataPath, ".env"),
    safePath(userDataPath, ".env.production")
  ].filter(Boolean);
}


function getFeedbackWebhookInfo() {
  const keys = [
    "LOCALTIFY_FEEDBACK_WEBHOOK_URL",
    "LOCALITFY_FEEDBACK_WEBHOOK_URL",
    "VITE_LOCALTIFY_FEEDBACK_WEBHOOK_URL",
    "VITE_LOCALITFY_FEEDBACK_WEBHOOK_URL",
    "FEEDBACK_WEBHOOK_URL"
  ];

  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (!value) continue;

    const valid = /^https:\/\/(?:discord(?:app)?\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+(?:\?.*)?$/.test(value);

    return {
      configured: true,
      valid,
      envName: key,
      url: value,
      label: valid ? "Discord feedback enabled" : "Discord webhook invalid",
      message: valid
        ? "Feedback will be delivered to your Discord channel."
        : "Use a real https://discord.com/api/webhooks/... URL."
    };
  }

  return {
    configured: false,
    valid: false,
    envName: "",
    url: "",
    label: "Discord feedback not configured",
    message: "Set LOCALTIFY_FEEDBACK_WEBHOOK_URL in .env, beside the exe, resources, or userData."
  };
}

function getFeedbackStatus() {
  const info = getFeedbackWebhookInfo();

  return {
    configured: Boolean(info.configured),
    valid: Boolean(info.valid),
    envName: info.envName || "",
    label: info.label,
    message: info.message,
    isPackaged: Boolean(app.isPackaged)
  };
}

function postDiscordWebhookWithElectronNet(webhookUrl, body) {
  return new Promise((resolve) => {
    let settled = false;
    let request;

    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const payload = Buffer.from(JSON.stringify(body), "utf8");
    const timer = setTimeout(() => {
      try {
        if (request && typeof request.abort === "function") request.abort();
      } catch {
      }

      done({
        ok: false,
        code: "webhook_timeout",
        error: "Discord webhook request timed out. Check internet/firewall or regenerate the webhook URL. Check the webhook URL, internet connection, or Discord reachability, then try again."
      });
    }, 30_000);

    try {
      request = net.request({
        method: "POST",
        url: webhookUrl,
        redirect: "follow"
      });

      request.setHeader("Content-Type", "application/json");
      request.setHeader("Content-Length", String(payload.length));
      request.setHeader("User-Agent", "Localtify-Feedback/0.4.1");

      request.on("response", (response) => {
        let raw = "";

        response.on("data", (chunk) => {
          raw += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk || "");
        });

        response.on("end", () => {
          const ok = response.statusCode >= 200 && response.statusCode < 300;

          done({
            ok,
            statusCode: response.statusCode,
            code: ok ? "ok" : "webhook_failed",
            error: ok ? "" : raw.slice(0, 500) || `Discord returned HTTP ${response.statusCode}`
          });
        });
      });

      request.on("error", (error) => {
        done({
          ok: false,
          code: "webhook_failed",
          error: error?.message || "Discord webhook request failed."
        });
      });

      request.write(payload);
      request.end();
    } catch (error) {
      done({
        ok: false,
        code: "webhook_failed",
        error: error?.message || "Discord webhook request failed before sending."
      });
    }
  });
}

function postDiscordWebhookWithNodeHttps(webhookUrl, body) {
  return new Promise((resolve) => {
    let parsed;
    let settled = false;

    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      parsed = new URL(webhookUrl);
    } catch {
      done({ ok: false, code: "webhook_invalid", error: "Webhook URL could not be parsed." });
      return;
    }

    const payload = Buffer.from(JSON.stringify(body), "utf8");
    const request = https.request(
      {
        method: "POST",
        hostname: parsed.hostname,
        path: `${parsed.pathname}${parsed.search || ""}`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.length),
          "User-Agent": "Localtify-Feedback/0.4.1"
        },
        timeout: 30_000
      },
      (response) => {
        let raw = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          const ok = response.statusCode >= 200 && response.statusCode < 300;

          done({
            ok,
            statusCode: response.statusCode,
            code: ok ? "ok" : "webhook_failed",
            error: ok ? "" : raw.slice(0, 500) || `Discord returned HTTP ${response.statusCode}`
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Discord webhook request timed out. Check internet/firewall or regenerate the webhook URL."));
    });

    request.on("error", (error) => {
      done({
        ok: false,
        code: error?.message?.toLowerCase().includes("timed out") ? "webhook_timeout" : "webhook_failed",
        error: error?.message || "Discord webhook request failed."
      });
    });

    request.write(payload);
    request.end();
  });
}

async function postDiscordWebhook(webhookUrl, body) {
  if (net && typeof net.request === "function") {
    const electronResult = await postDiscordWebhookWithElectronNet(webhookUrl, body);

    if (electronResult.ok) return electronResult;

    // If Chromium networking times out, Node HTTPS usually will too. Return the clearer error fast.
    if (electronResult.code === "webhook_timeout") return electronResult;
  }

  return postDiscordWebhookWithNodeHttps(webhookUrl, body);
}

async function sendLocaltifyFeedback(payload = {}) {
  const webhook = getFeedbackWebhookInfo();

  if (!webhook.configured) {
    return { ok: false, code: "webhook_missing", error: webhook.message };
  }

  if (!webhook.valid) {
    return { ok: false, code: "webhook_invalid", error: webhook.message };
  }

  const category = cleanFeedbackText(payload.category || "other", 40) || "other";
  const message = cleanFeedbackText(payload.message, 1500);
  const appVersion = cleanFeedbackText(payload.appVersion || "", 80);
  const platform = cleanFeedbackText(payload.platform || process.platform, 80);
  const diagnostics = payload && typeof payload.diagnostics === "object" && payload.diagnostics
    ? payload.diagnostics
    : {};

  if (message.length < 4) {
    return { ok: false, code: "message_too_short", error: "Feedback message is too short." };
  }

  const fieldFrom = (name, value) => {
    const clean = cleanFeedbackText(value, 220) || "unknown";
    return { name, value: clean, inline: true };
  };

  const fields = [
    fieldFrom("category", category),
    fieldFrom("app", appVersion || "unknown"),
    fieldFrom("platform", platform || process.platform),
    fieldFrom("songs", diagnostics.songCount),
    fieldFrom("playlists", diagnostics.playlistCount),
    fieldFrom("downloads folder", diagnostics.downloadsFolder),
    fieldFrom("discord rpc", diagnostics.discordRpc),
    fieldFrom("update status", diagnostics.updateStatus)
  ].filter((field) => field.value !== "unknown" || ["category", "app", "platform"].includes(field.name));

  const result = await postDiscordWebhook(webhook.url, {
    username: "Localtify Feedback",
    avatar_url: "https://raw.githubusercontent.com/meshahid973/localitfy/main/build/icon.png",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `Localtify feedback â€” ${category}`,
        description: message,
        color: 0xd946ef,
        timestamp: new Date().toISOString(),
        fields
      }
    ]
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code || "webhook_failed",
      statusCode: result.statusCode,
      error: result.error || "Discord did not accept the feedback."
    };
  }

  return {
    ok: true,
    code: "sent",
    statusCode: result.statusCode,
    envName: webhook.envName
  };
}


let serviceRuntime = null;

app.whenReady().then(async () => {
  registerLocaltifyRendererProtocol();
  registerLocaltifyMediaProtocol();
  serviceRuntime = createElectronServiceRuntime({
    userDataPath: app.getPath("userData"),
    ffmpegPath: getFfmpegPath(),
    getCookiesFile: getYouTubeCookiesFile,
    startMediaServer: startLocaltifyMediaServer,
    stopMediaServer: stopLocaltifyMediaServer,
    cleanupNativeWindowsMedia
  });
  await serviceRuntime.start();
  const databaseRecovery = restoreDatabaseFromOldUserDataIfNeeded();
  initDatabase(databaseRecovery.dbPath || path.join(app.getPath("userData"), userDataRuntime.sqliteFileName));
  try {
    const savedSettings = getSettings();
    minimizeToTray = Boolean(savedSettings?.minimizeToTray);
    syncWindowsIntegrationSettings(savedSettings, { persistDefault: true });
    startupLaunchStatus = getStartWithWindowsStatus();
  } catch {
    minimizeToTray = false;
    setStartWithWindows(true);
    startupLaunchStatus = getStartWithWindowsStatus();
  }
  setupNativeWindowsMediaIpc();

  ipcRouter.handle("localitfy:open-devtools", async (event, payload = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    return openLocaltifyDevTools(win, payload);
  });

  ipcRouter.handle("localitfy:toggle-devtools", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    return toggleLocaltifyDevTools(win);
  });

  ipcRouter.handle("localitfy:performance-status", async () => getLocaltifyPerformanceStatus());
  ipcRouter.handle("localitfy:gpu-status", async () => getLocaltifyPerformanceStatus());
  ipcRouter.handle("feedback:status", async () => getFeedbackStatus());
  ipcRouter.handle("feedback:send", async (_event, payload = {}) => sendLocaltifyFeedback(payload));

  ipcRouter.handle("app:bootstrap", async () => {
    await yieldToMainLoop();
    scheduleCoverThumbnailWarmup();
    return {
      songs: listSongsShaped(),
      settings: getSettings(),
      playlists: getPlaylists(),
      windowsIntegration: getStartWithWindowsStatus(),
      windowTranslucency: getSavedWindowTranslucencySettings(),
      database: { ...getDatabaseStatus(), userDataPath: app.getPath("userData"), dataFolderName: userDataRuntime.dataFolderName },
      discord: getDiscordStatus()
    };
  });

  ipcRouter.handle("playback:resolve-url", async (_event, payload = {}) => {
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
  ipcRouter.handle("pixel:list", pixelListHandler);
  ipcRouter.handle("art:list-pixel", pixelListHandler);
  ipcRouter.handle("covers:list-pixelart", async () => {
    try { return listPixelCoversDetailed(); } catch (e) { console.log("[localitfy list covers error]", e?.message); return []; }
  });
  ipcRouter.handle("covers:stats", async () => {
    try { return getCoverStats(); } catch (e) { console.log("[localitfy covers stats error]", e?.message); return {}; }
  });
  ipcRouter.handle("covers:rescan", async () => {
    clearPixelArtCache();
    clearFileInfoCache();
    await yieldToMainLoop();
    return buildRandomizeMissingSongCovers();
  });
  ipcRouter.handle("covers:randomize-all", async () => {
    await yieldToMainLoop();
    const covers = getPixelArtFiles();
    if (!covers.length) return listSongsShaped();
    const songs = getSongs();
    for (const song of songs) {
      const chosen = pickLeastUsedCover(covers, songs, { avoidSelectedCurrent: true, currentPath: song.coverPath });
      if (chosen) patchSong(song.id, { coverPath: chosen });
    }
    return listSongsShaped();
  });
  ipcRouter.handle("covers:randomize-missing", async () => {
    await yieldToMainLoop();
    return buildRandomizeMissingSongCovers();
  });
  ipcRouter.handle("covers:randomize-selected", async (_event, ids) => {
    await yieldToMainLoop();
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
  ipcRouter.handle("covers:broken", async () => {
    try { return getCoverStats().brokenItems || []; } catch { return []; }
  });
  ipcRouter.handle("covers:least-used", async () => {
    try { return pickLeastUsedCover(getPixelArtFiles()); } catch { return ""; }
  });
  ipcRouter.handle("covers:thumbnail-status", async () => {
    try { return getCoverThumbnailStatus(); } catch (error) { return { ok: false, error: error?.message || "thumbnail status failed" }; }
  });
  ipcRouter.handle("covers:warm-thumbnails", async (_event, payload = {}) => {
    try {
      await yieldToMainLoop();
      return warmCoverThumbnails({
        limit: Math.max(1, Math.min(500, Number(payload?.limit || 120))),
        force: Boolean(payload?.force)
      });
    } catch (error) {
      console.log("[localtify warm thumbnails error]", error?.message || error);
      return {
        ok: false,
        created: 0,
        cached: 0,
        warnings: ["Localtify could not prepare cover thumbnails right now. Covers will still load normally."],
        error: error?.message || "thumbnail warmup failed"
      };
    }
  });
  ipcRouter.handle("covers:cleanup-cache", async () => {
    try { return cleanupCoverThumbnailCache(); } catch (error) { return { ok: false, error: error?.message || "cover cache cleanup failed" }; }
  });
  ipcRouter.handle("song:set-cover", async (_event, id, coverPath) => {
    const updated = patchSong(id, { coverPath });
    return updated ? shapeSong(updated) : null;
  });
  ipcRouter.handle("song:pick-cover", async (event, id) => {
    const song = getSongs().find((item) => item.id === id);
    if (!song) return null;

    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const result = senderWindow && !senderWindow.isDestroyed()
        ? await dialog.showOpenDialog(senderWindow, {
            title: "Choose localtify cover image",
            buttonLabel: "Use cover",
            properties: ["openFile"],
            filters: [
              { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }
            ]
          })
        : await dialog.showOpenDialog({
            title: "Choose localtify cover image",
            buttonLabel: "Use cover",
            properties: ["openFile"],
            filters: [
              { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }
            ]
          });

      if (result.canceled || !result.filePaths?.[0]) return shapeSong(song);

      const chosen = result.filePaths[0];
      if (!fileExists(chosen) || !isImageFile(chosen)) return shapeSong(song);

      const updated = patchSong(id, { coverPath: chosen });
      return updated ? shapeSong(updated) : shapeSong(song);
    } catch (error) {
      console.log("[localtify pick cover error]", error?.message || error);
      return shapeSong(song);
    }
  });
  ipcRouter.handle("song:analyze-volume", async (_event, id) => {
    const target = getSongs().find((item) => item.id === id);
    if (!target) return { ok: false, volumeGain: 1, error: "song not in library database" };
    return analyzeVolumeGain(target.filePath);
  });
  ipcRouter.handle("library:import", async (event) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const result = await openImportDialog(senderWindow);
      if (result.canceled || !result.filePaths?.length) return listSongsShaped();
      const validAudioFiles = result.filePaths.filter((f) => fileExists(f) && isAudioFile(f));
      if (!validAudioFiles.length) return listSongsShaped();
      const pixelArtFiles = getPixelArtFiles();
      const usedCovers = new Set();
      const importedSongs = await Promise.all(validAudioFiles.map((f) => makeSongFromFile(f, pixelArtFiles, usedCovers)));
      const changedCount = insertSongs(importedSongs);
      clearFileInfoCache();
      const afterSongs = listSongsShaped();
      console.log(`[localitfy import] selected=${validAudioFiles.length}, changed=${changedCount}, after=${afterSongs.length}`);
      return afterSongs;
    } catch (error) {
      console.log("[localitfy import error]", error?.stack || error?.message);
      return listSongsShaped();
    }
  });

  ipcRouter.handle("library:repair-missing-metadata", async (_event, payload = {}) => {
    try {
      return await repairMissingSongMetadata(payload);
    } catch (error) {
      console.log("[localtify metadata repair error]", error?.stack || error?.message || error);
      return { ok: false, error: error?.message || "metadata repair failed", songs: listSongsShaped() };
    }
  });


  ipcRouter.handle("album:scan-folder", async (event, payload = {}) => {
    try {
      return await handleAlbumFolderScan(event, payload);
    } catch (error) {
      console.log("[localtify album folder scan error]", error?.stack || error?.message || error);
      return { ok: false, error: error?.message || "album folder scan failed", songs: listSongsShaped(), albums: [] };
    }
  });

  ipcRouter.handle("album:import-folder", async (event, payload = {}) => {
    try {
      return await handleAlbumFolderImport(event, payload);
    } catch (error) {
      console.log("[localtify album folder import error]", error?.stack || error?.message || error);
      return { ok: false, error: error?.message || "album folder import failed", songs: listSongsShaped(), albums: [] };
    }
  });

  ipcRouter.handle("media:convert-pick", async (event, payload) => {
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
        const importedSongs = await Promise.all(successfulFiles.map((f) => makeSongFromFile(f, pixelArtFiles, usedCovers)));
        changedCount = insertSongs(importedSongs);
        clearFileInfoCache();
        afterSongs = listSongsShaped();
      }
      return { ...converted, changedCount, songs: afterSongs, downloadFolder: getDownloadDirectory() };
    } catch (error) {
      console.log("[localitfy convert pick error]", error?.message);
      return { downloadFolder: getDownloadDirectory(), conversions: [], changedCount: 0, songs: listSongsShaped() };
    }
  });

  ipcRouter.handle("download:audio", async (event, payload) => {
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
        const importedSongs = await Promise.all(successfulFiles.map((f) => makeSongFromFile(f, pixelArtFiles, usedCovers)));
        changedCount = insertSongs(importedSongs);
        clearFileInfoCache();
        afterSongs = listSongsShaped();
      }

      // Safety net: yt-dlp can finish writing audio files even when the result list
      // misses one. Scan the chosen download folder once and import any new audio.
      if (autoAdd) {
        const refresh = await importNewAudioFilesFromDirectory(downloadFolder);
        changedCount += refresh.changedCount;
        afterSongs = refresh.songs;
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

  ipcRouter.handle("download:cancel", async () => ({ cancelled: cancelActiveDownloads() }));
  ipcRouter.handle("download:choose-folder", async () => {
    const owner = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    const result = await dialog.showOpenDialog(owner, { title: "Choose localtify download folder", properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, folder: "" };
    return { canceled: false, folder: result.filePaths[0] };
  });
  ipcRouter.handle("download:open-folder", async (_event, folder) => {
    const target = getDownloadDirectory(folder);
    await shell.openPath(target);
    return true;
  });

  ipcRouter.handle("song:patch", async (_event, id, patch) => {
    const updated = patchSong(id, patch);
    return updated ? shapeSong(updated) : null;
  });
  ipcRouter.handle("song:random-cover", async (_event, id) => {
    const covers = getPixelArtFiles();
    const song = getSongs().find((item) => item.id === id);
    const chosen = pickLeastUsedCover(covers, song ? [song] : [], { avoidSelectedCurrent: true });
    const updated = patchSong(id, { coverPath: chosen });
    return updated ? shapeSong(updated) : null;
  });
  ipcRouter.handle("song:delete", async (_event, id) => {
    try {
      deleteSong(id);
      return listSongsShaped();
    } catch (error) {
      console.log("[localitfy delete song error]", error?.message);
      return listSongsShaped();
    }
  });
  ipcRouter.handle("library:clear", async () => {
    clearLibrary();
    return [];
  });

  ipcRouter.handle("library:refresh-download-folder", async (_event, payload = {}) => {
    const target = getDownloadDirectory(payload?.folder || payload?.downloadFolder || "");
    const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
    const refresh = await importNewAudioFilesFromDirectory(target, tracks);
    const repair = tracks.length ? await repairSpotifyMetadataForFolder(target, tracks) : { changedCount: 0, songs: refresh.songs };
    return {
      ok: true,
      downloadFolder: target,
      changedCount: refresh.changedCount + repair.changedCount,
      importedCount: refresh.importedCount,
      repairedCount: repair.changedCount,
      songs: repair.songs || refresh.songs
    };
  });

  ipcRouter.handle("settings:get", async () => getSettings());
  ipcRouter.handle("settings:save", async (_event, settings) => {
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

  ipcRouter.handle("localitfy:get-window-translucency", async () => getSavedWindowTranslucencySettings());
  ipcRouter.handle("localitfy:set-window-translucency", async (_event, payload = {}) => {
    try {
      const current = getSavedWindowTranslucencySettings();
      const next = normalizeWindowTranslucencySettings({ ...current, ...(payload || {}) });
      const transparentModeChanged = Boolean(current.translucentWindow) !== Boolean(next.translucentWindow);

      saveSettings({
        translucentWindow: next.translucentWindow,
        windowTransparency: next.windowTransparency,
        windowBlur: next.windowBlur,
        transparentAppBackground: next.transparentAppBackground
      });

      if (mainWindow && !mainWindow.isDestroyed()) {
        applyWindowTranslucencyToWindow(mainWindow, next);
      }

      return {
        ok: true,
        restartRequired: false,
        windowReloadRequired: false,
        changedNativeMaterial: transparentModeChanged,
        ...next
      };
    } catch (error) {
      console.log("[localitfy translucent window save error]", error?.message || error);
      return { ok: false, error: error?.message || "could not update translucent window", ...getSavedWindowTranslucencySettings() };
    }
  });
  ipcRouter.handle("localitfy:restart-app", async () => {
    restartForWindowTranslucency();
    return true;
  });
  ipcRouter.handle("localitfy:open-logs", async () => {
    try {
      const logsPath = app.getPath("logs");
      fs.mkdirSync(logsPath, { recursive: true });
      const openError = await shell.openPath(logsPath);
      return openError ? { ok: false, path: logsPath, error: openError } : { ok: true, path: logsPath };
    } catch (error) {
      return { ok: false, error: error?.message || "could not open logs folder" };
    }
  });

  ipcRouter.handle("playlists:get", async () => getPlaylists());
  ipcRouter.handle("playlists:save", async (_event, playlists) => {
    try { return savePlaylists(playlists); } catch { return getPlaylists(); }
  });
  ipcRouter.handle("database:backup-now", async () => {
    try { return { ok: backupDatabase() }; } catch (e) { return { ok: false, error: e?.message }; }
  });
  ipcRouter.handle("database:repair-now", async () => {
    try {
      repairDatabaseNow();
      mediaTokenToPath.clear();
      mediaPathKeyToToken.clear();
      return { ok: true, status: getDatabaseStatus(), songs: listSongsShaped() };
    } catch (e) {
      return { ok: false, error: e?.message };
    }
  });
  ipcRouter.handle("database:status", async () => getDatabaseStatus());

  registerDiscordIpc(ipcRouter, {
    setDiscordActivity,
    clearDiscordActivity,
    getDiscordStatus,
    resetDiscordActivityCache
  });

  // â”€â”€ Spotify: fetch public track metadata through OAuth PKCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const runSpotifyFetch = async (payload = {}) => {
    try {
      const url = typeof payload === "string" ? payload : payload?.url;
      if (!url || typeof url !== "string") return { ok: false, tracks: [], error: "No Spotify URL provided." };
      const result = await fetchSpotifyTracksFromUrl(url.trim());
      console.log(`[localtify spotify] fetched ${result.tracks.length} public track(s) from ${result.type} "${result.name}"`, {
        withArtists: result.tracks.filter((track) => track?.artist || track?.artists).length,
        withCovers: result.tracks.filter((track) => track?.coverUrl || track?.spotifyCoverUrl || track?.albumCoverUrl).length
      });
      return { ok: true, ...result };
    } catch (error) {
      console.log("[localtify spotify fetch error]", error?.message || error);
      return {
        ok: false,
        publicOnly: true,
        tracks: [],
        error: error?.message || "Failed to fetch Spotify tracks.",
        hint: "Spotify has two visibility states: shareable by link and public on profile. If fetch fails, open the playlist menu in Spotify and make it public/add it to profile."
      };
    }
  };

  ipcRouter.handle("spotify-fetch", async (_event, payload = {}) => runSpotifyFetch(payload));
  ipcRouter.handle("spotify-fetch-tracks", async (_event, url) => runSpotifyFetch({ url }));

  ipcRouter.handle("spotify-check", async () => {
    const saved = readSpotifyOAuthToken();
    const hasClientId = Boolean(SPOTIFY_CLIENT_ID);
    return {
      ok: true,
      ready: true,
      loggedIn: Boolean(saved?.refreshToken),
      publicOnly: true,
      fallbackAvailable: true,
      mode: hasClientId ? "oauth-pkce" : "public-fallback",
      needsClientId: false,
      redirectUri: SPOTIFY_REDIRECT_URI,
      error: ""
    };
  });

  ipcRouter.handle("spotify-login", async () => loginSpotifyOAuth());

  ipcRouter.handle("spotify-import-browser", async () => ({
    ok: false,
    ready: true,
    loggedIn: Boolean(readSpotifyOAuthToken()?.refreshToken),
    publicOnly: true,
    fallbackAvailable: true,
    mode: SPOTIFY_CLIENT_ID ? "oauth-pkce" : "public-fallback",
    needsClientId: false,
    redirectUri: SPOTIFY_REDIRECT_URI,
    error: "Browser-cookie Spotify import was removed. Use Connect Spotify, or paste a public Spotify link directly."
  }));

  ipcRouter.handle("spotify-set-cookie", async () => ({
    ok: false,
    ready: true,
    loggedIn: Boolean(readSpotifyOAuthToken()?.refreshToken),
    publicOnly: true,
    fallbackAvailable: true,
    mode: SPOTIFY_CLIENT_ID ? "oauth-pkce" : "public-fallback",
    needsClientId: false,
    redirectUri: SPOTIFY_REDIRECT_URI,
    error: "Cookie login was removed. Use Connect Spotify, or paste a public Spotify link directly."
  }));

  ipcRouter.handle("spotify-logout", async () => {
    clearSpotifyOAuthToken();
    console.log("[localtify spotify] oauth token cleared");
    return { ok: true, ready: true, loggedIn: false, publicOnly: true, fallbackAvailable: true, mode: SPOTIFY_CLIENT_ID ? "oauth-pkce" : "public-fallback", needsClientId: false };
  });

  ipcRouter.handle("spotdl-check", async () => ({
    ok: true,
    installed: true,
    engine: "localtify-ytdlp-bridge",
    message: "Spotify downloads use localtify's bundled yt-dlp bridge after metadata is fetched."
  }));

  const runSpotifyDownloadBatch = async (event, payload = {}) => {
    const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
    const options = payload?.options && typeof payload.options === "object" ? payload.options : payload;

    try {
      const downloadFolder = getDownloadDirectory(options?.downloadFolder || options?.outputDir || options?.folder);
      const autoAdd = typeof options?.autoAdd === "boolean" ? options.autoAdd : true;
      const progressCallback = (progress) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        event.sender.send("download:progress", progress);
        if (progress?.status === "done") {
          event.sender.send("spotdl-track-done", progress);
        }
      };

      const result = await downloadSpotifyBatch(tracks, downloadFolder, progressCallback, options);

      // Spotify imports must be strict. Do NOT scan the whole download folder here,
      // because that can pull old unrelated local files into the Spotify playlist.
      // Only files returned by this Spotify batch are allowed into the auto playlist.
      const tracksBySpotifyId = new Map(
        tracks
          .map((track) => [String(track?.spotifyTrackId || track?.id || "").trim(), track])
          .filter(([id]) => Boolean(id))
      );

      const successfulDownloads = (result.downloads || [])
        .map((item, index) => {
          const spotifyTrackId = String(item?.spotifyTrackId || "").trim();
          const track =
            tracksBySpotifyId.get(spotifyTrackId) ||
            tracks[index] ||
            (item?.filePath ? matchSpotifyTrackForFile(item.filePath, tracks) : null) ||
            {};

          return { item, track };
        })
        .filter(({ item }) =>
          item?.ok &&
          item.filePath &&
          item.matchOk !== false &&
          fileExists(item.filePath) &&
          isAudioFile(item.filePath)
        );

      let changedCount = 0;
      let afterSongs = listSongsShaped();
      const importedFilePaths = [];
      const importedSongIds = [];
      const spotifyImportMap = [];

      if (autoAdd && successfulDownloads.length) {
        const pixelArtFiles = getPixelArtFiles();
        const usedCovers = new Set();
        const importedSongs = [];

        for (const { item, track } of successfulDownloads) {
          const filePath = item.filePath;
          importedFilePaths.push(filePath);

          const spotifyTrackId = String(item.spotifyTrackId || track?.spotifyTrackId || track?.id || "").trim();
          const sourceInfo = {
            sourceTrackId: spotifyTrackId,
            sourceUrl: String(item.spotifyUrl || track?.spotifyUrl || (spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : "")).trim(),
            sourceProvider: String(item.provider || "youtube"),
            sourceProviderUrl: String(item.providerUrl || ""),
            sourceMatchScore: Number(item.matchScore || 0)
          };

          // Exact file + exact Spotify metadata. This is the important part:
          // the Spotify cover goes into coverPath, replacing the pixel fallback.
          const song = await makeSongFromFileWithExactSpotifyTrack(filePath, track, pixelArtFiles, usedCovers, sourceInfo);
          importedSongs.push(song);
          importedSongIds.push(song.id);
          spotifyImportMap.push({
            spotifyTrackId,
            songId: song.id,
            filePath
          });
        }

        changedCount = insertSongs(importedSongs);

        // insertSongs may ignore existing file paths, so always patch by stable song id.
        // This repairs re-downloads and old rows with pixel covers / weak artists.
        for (const song of importedSongs) {
          try {
            patchSong(song.id, {
              title: song.title,
              artist: song.artist,
              album: song.album,
              coverPath: song.coverPath,
              duration: song.duration,
              sourceType: song.sourceType,
              sourceTrackId: song.sourceTrackId,
              sourceUrl: song.sourceUrl,
              sourceProvider: song.sourceProvider,
              sourceProviderUrl: song.sourceProviderUrl,
              sourceMatchScore: song.sourceMatchScore
            });
          } catch (error) {
            console.log("[localtify spotify metadata patch error]", error?.message || error);
          }
        }

        clearFileInfoCache();
        afterSongs = listSongsShaped();
      }

      const importMapBySpotifyId = new Map(
        spotifyImportMap
          .map((item) => [String(item.spotifyTrackId || "").trim(), item])
          .filter(([id]) => Boolean(id))
      );
      const importMapByFilePath = new Map(
        spotifyImportMap
          .map((item) => [path.normalize(String(item.filePath || "")).toLowerCase(), item])
          .filter(([filePath]) => Boolean(filePath))
      );

      const finalDownloads = (result.downloads || []).map((item) => {
        const bySpotifyId = importMapBySpotifyId.get(String(item?.spotifyTrackId || "").trim());
        const byFilePath = item?.filePath ? importMapByFilePath.get(path.normalize(String(item.filePath)).toLowerCase()) : null;
        const imported = bySpotifyId || byFilePath || null;

        return {
          ...item,
          importedToLibrary: Boolean(imported),
          librarySongId: imported?.songId || item.librarySongId || ""
        };
      });

      for (const item of finalDownloads) {
        if (item?.ok) event.sender.send("spotdl-track-done", item);
      }

      return {
        ...result,
        downloads: finalDownloads,
        changedCount,
        songs: afterSongs,
        downloadFolder,
        importedFilePaths: Array.from(new Set(importedFilePaths.filter(Boolean))),
        spotifyImportedSongIds: Array.from(new Set(importedSongIds.filter(Boolean))),
        spotifyImportMap,
        spotifySourceName: payload?.sourceName || options?.sourceName || "",
        spotifySourceType: payload?.sourceType || options?.sourceType || ""
      };
    } catch (error) {
      console.log("[localitfy spotify batch download error]", error?.message || error);
      return {
        downloadFolder: getDownloadDirectory(options?.downloadFolder || options?.outputDir || options?.folder),
        downloads: [{ ok: false, error: error?.message || "batch download failed" }],
        changedCount: 0,
        songs: listSongsShaped(),
        spotifyImportedSongIds: [],
        spotifyImportMap: [],
        importedFilePaths: []
      };
    }
  };

  ipcRouter.handle("spotify-download-batch", runSpotifyDownloadBatch);
  ipcRouter.handle("spotdl-download-batch", runSpotifyDownloadBatch);

  ipcRouter.handle("localitfy:check-for-updates", async (_event, payload) => checkForUpdates(payload));
  ipcRouter.handle("localitfy:download-update", async () => downloadUpdate());
  ipcRouter.handle("localitfy:install-update", async () => installUpdate());
  ipcRouter.handle("localitfy:open-external", async (_event, url) => {
    const targetUrl = String(url || "").trim();
    if (!/^https?:\/\//i.test(targetUrl)) return { ok: false, reason: "invalid-url" };
    await shell.openExternal(targetUrl);
    return { ok: true };
  });

  ipcRouter.handle("window:minimize", async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
    return true;
  });
  ipcRouter.handle("window:toggle-maximize", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    win.isMaximized() ? win.unmaximize() : win.maximize();
    return true;
  });
  ipcRouter.handle("window:close", async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
    return true;
  });

  const startupCreateDelayMs = process.platform === "win32" && startupLaunchStatus?.wasOpenedAtLogin ? 1600 : 0;
  setTimeout(() => {
    createWindow();
    setupNativeWindowsMedia();
  }, startupCreateDelayMs);

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
  if (serviceRuntime) {
    await serviceRuntime.stop("app-before-quit");
  } else {
    try { cleanupNativeWindowsMedia(); } catch { }
    try { stopLocaltifyMediaServer(); } catch { }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

