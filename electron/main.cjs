/* localtify 0.3.7 V290 — locked alpha-composition window lifecycle. */
/* localtify 0.3.7 V276 — window reload transparency fix, Spotify fallback, Linux-ready desktop behavior. */
/* localtify 0.3.7 V284 — fixed devtools shortcut and transparent window guard. */
const { app, BrowserWindow, dialog, ipcMain, shell, session, Menu, Tray, nativeImage, globalShortcut, screen, protocol, net } = require("electron");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { pathToFileURL } = require("node:url");




function loadLocaltifyEnv() {
  const publicSpotifyClientId = "586c22791eb74d73b1c83db88f1d4c52";

  const safePath = (...parts) => {
    try {
      if (parts.some((part) => !part)) return "";
      return path.join(...parts);
    } catch {
      return "";
    }
  };

  const appPath = (() => {
    try {
      return typeof app.getAppPath === "function" ? app.getAppPath() : "";
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

  const possibleEnvPaths = (() => {
    const seen = new Set();
    return [
      safePath(process.cwd(), ".env"),
      safePath(process.cwd(), ".env.production"),
      safePath(appPath, ".env"),
      safePath(appPath, ".env.production"),
      safePath(resourcePath, ".env"),
      safePath(resourcePath, ".env.production"),
      safePath(resourcePath, "app", ".env"),
      safePath(resourcePath, "app", ".env.production")
    ].filter(Boolean).filter((item) => {
      const key = path.normalize(item).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  for (const envPath of possibleEnvPaths) {
    try {
      require("dotenv").config({ path: envPath, override: false });
    } catch {
      // dotenv is optional. The manual parser below is the fallback.
    }

    try {
      if (!fs.existsSync(envPath)) continue;

      const raw = fs.readFileSync(envPath, "utf-8");
      let injected = 0;

      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eqIndex = trimmed.indexOf("=");
        if (eqIndex <= 0) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (typeof process.env[key] === "undefined") {
          process.env[key] = value;
          injected += 1;
        }
      }

      if (injected > 0) {
        console.log(`[localtify env] injected ${injected} value${injected === 1 ? "" : "s"} from ${envPath}`);
      }
    } catch (error) {
      console.log("[localtify env] failed to read env file", envPath, error?.message || error);
    }
  }

  // Spotify Client ID is public and safe to ship. Never ship a Spotify Client Secret.
  process.env.SPOTIFY_CLIENT_ID =
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.VITE_SPOTIFY_CLIENT_ID ||
    process.env.VITE_PUBLIC_SPOTIFY_CLIENT_ID ||
    publicSpotifyClientId;

  process.env.VITE_PUBLIC_SPOTIFY_CLIENT_ID =
    process.env.VITE_PUBLIC_SPOTIFY_CLIENT_ID ||
    process.env.SPOTIFY_CLIENT_ID ||
    publicSpotifyClientId;
}

loadLocaltifyEnv();

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


const DEFAULT_WINDOW_TRANSLUCENCY = Object.freeze({
  translucentWindow: true,
  windowTransparency: 82,
  windowBlur: 18,
  transparentAppBackground: true
});

function clampTranslucentNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeWindowTranslucencySettings(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  return {
    translucentWindow: Boolean(source.translucentWindow ?? DEFAULT_WINDOW_TRANSLUCENCY.translucentWindow),
    windowTransparency: clampTranslucentNumber(source.windowTransparency, DEFAULT_WINDOW_TRANSLUCENCY.windowTransparency, 12, 88),
    windowBlur: clampTranslucentNumber(source.windowBlur, DEFAULT_WINDOW_TRANSLUCENCY.windowBlur, 0, 36),
    transparentAppBackground: source.transparentAppBackground !== false
  };
}

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
  const CLEAR_WINDOW_BACKGROUND = "#00000000";

  try {
    // V290: do not reset the native background on every live slider move.
    // Electron/Windows can drop the alpha swap-chain when the clear brush is
    // repeatedly applied during renderer repaints. Lock it once, then let CSS
    // variables handle the live glass/transparency changes.
    let currentBackground = "";
    try {
      if (typeof win.getBackgroundColor === "function") {
        currentBackground = String(win.getBackgroundColor() || "").toLowerCase();
      }
    } catch {
      currentBackground = "";
    }

    if (!win.__localtifyClearBackgroundLocked || currentBackground !== CLEAR_WINDOW_BACKGROUND) {
      win.setBackgroundColor(CLEAR_WINDOW_BACKGROUND);
      win.__localtifyClearBackgroundLocked = true;
    }
  } catch (error) {
    console.log("[localtify window background error]", error?.message || error);
  }

  try {
    if (process.platform === "win32" && typeof win.setBackgroundMaterial === "function" && !win.__localtifyBackgroundMaterialLocked) {
      // Native Windows acrylic/mica adds grey fog over Localtify.
      // Keep the BrowserWindow alpha surface native-clear once, then let the
      // renderer CSS own the glass tint/blur.
      win.setBackgroundMaterial("none");
      win.__localtifyBackgroundMaterialLocked = true;
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
if (process.platform === "linux") {
  app.commandLine.appendSwitch("enable-transparent-visuals");
}

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
    throw new Error(`Spotify OAuth returned HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
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
    throw new Error(
      "Spotify Client ID is missing. Add SPOTIFY_CLIENT_ID to your .env, then register http://127.0.0.1:43877/spotify/callback in the Spotify dashboard."
    );
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
      ok: false,
      ready: false,
      loggedIn: false,
      publicOnly: true,
      mode: "oauth-pkce",
      needsClientId: true,
      redirectUri: SPOTIFY_REDIRECT_URI,
      error: "Spotify Client ID missing. Create a Spotify app, add the redirect URI, then set SPOTIFY_CLIENT_ID in .env."
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
      title: "Connect Spotify — localtify",
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
    spotifyUrl: track.external_urls?.spotify || (track.id ? `https://open.spotify.com/track/${track.id}` : "")
  };
}


function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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
        if (desc) artist = desc.split("·")[0].trim();
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
        const page = await spotifyApiGet(`/playlists/${id}/tracks?limit=100&offset=${offset}&fields=items(track(id,name,artists,album(name,images(url,width,height)),duration_ms,is_local,external_urls)),next`);
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
      /could not read this link|public profile|private|403|404|not expose|spotify api returned http/i.test(message);

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
  const baseSong = makeSongFromFile(filePath, pixelArtFiles, usedCovers);
  const matched = matchSpotifyTrackForFile(filePath, tracks);

  if (!matched) return baseSong;

  const title = String(matched?.title || matched?.name || baseSong.title || "").trim();
  const artist = String(matched?.artist || matched?.artists || baseSong.artist || "").trim();
  const album = String(matched?.albumName || matched?.album || baseSong.album || "").trim();
  const coverUrl = String(matched?.coverUrl || matched?.spotifyCoverUrl || matched?.albumCoverUrl || "").trim();
  const cachedCoverPath = await cacheSpotifyCoverImage(coverUrl, matched?.id || title || filePath);

  return {
    ...baseSong,
    title: title || baseSong.title,
    artist: artist || baseSong.artist,
    album: album || baseSong.album || "",
    coverPath: cachedCoverPath || baseSong.coverPath,
    duration: Number(matched?.duration || Math.round(Number(matched?.durationMs || 0) / 1000) || baseSong.duration || 0)
  };
}

async function makeSongFromFileWithExactSpotifyTrack(filePath, track = {}, pixelArtFiles = [], usedCovers = new Set()) {
  const baseSong = makeSongFromFile(filePath, pixelArtFiles, usedCovers);

  const title = String(track?.title || track?.name || "").trim();
  const artist = String(track?.artist || track?.artists || "").trim();
  const album = String(track?.albumName || track?.album || "").trim();
  const coverUrl = String(track?.coverUrl || track?.spotifyCoverUrl || track?.albumCoverUrl || "").trim();
  const duration = Number(track?.duration || Math.round(Number(track?.durationMs || 0) / 1000) || baseSong.duration || 0);
  const cachedCoverPath = await cacheSpotifyCoverImage(coverUrl, track?.id || title || filePath);

  return {
    ...baseSong,
    title: title || baseSong.title,
    artist: artist || baseSong.artist,
    album: album || baseSong.album || "",
    coverPath: cachedCoverPath || baseSong.coverPath,
    duration
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
  const runtimeCoverPath = getRuntimeCoverPath(song, pixelArtFiles);
  const coverExists = Boolean(runtimeCoverPath && fileExists(runtimeCoverPath));

  return {
    ...song,
    // Keep database/bootstrap rows clean. Audio URLs are resolved lazily from filePath by playback:resolve-url.
    url: "",
    // Never hand the renderer a raw file:// cover. In packaged builds Chromium blocks it.
    // If the DB has no coverPath or the old path is broken, use a stable bundled pixel-art fallback at runtime.
    coverPath: song.coverPath || runtimeCoverPath || "",
    coverUrl: coverExists ? safeMediaUrl(runtimeCoverPath) : "",
    exists,
    fileExists: exists,
    coverExists
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
    // Keep the native window transparent at creation time. The app still looks
    // opaque when the setting is off because CSS fills the shell background.
    // This avoids the Windows/Electron problem where transparency cannot be
    // reliably enabled after a BrowserWindow has already been created.
    transparent: true,
    titleBarStyle: "hidden",
    backgroundColor: "#00000000",
    ...nativeWindowOptions,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs"),
      webSecurity: true,
      backgroundThrottling: false
    }
  });
  applyWindowTranslucencyToWindow(mainWindow, windowTranslucency);
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const key = String(input.key || "").toLowerCase();
    const openDevToolsShortcut =
      input.type === "keyDown" &&
      ((input.control && input.shift && key === "i") || key === "f12");

    if (!openDevToolsShortcut) return;
    event.preventDefault();
    try {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: "detach" });
      }
    } catch (error) {
      console.log("[localtify devtools shortcut error]", error?.message || error);
    }
  });

  mainWindow.webContents.once("did-finish-load", () => {
    applyWindowTranslucencyToWindow(mainWindow, getSavedWindowTranslucencySettings());
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

  ipcMain.handle("app:bootstrap", async () => {
    await yieldToMainLoop();
    return {
      songs: listSongsShaped(),
      settings: getSettings(),
      playlists: getPlaylists(),
      windowsIntegration: getStartWithWindowsStatus(),
      windowTranslucency: getSavedWindowTranslucencySettings(),
      database: { ...getDatabaseStatus(), userDataPath: app.getPath("userData"), dataFolderName: LEGACY_APP_DATA_NAME },
      discord: getDiscordStatus()
    };
  });

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
  ipcMain.handle("covers:rescan", async () => {
    clearPixelArtCache();
    clearFileInfoCache();
    await yieldToMainLoop();
    return buildRandomizeMissingSongCovers();
  });
  ipcMain.handle("covers:randomize-all", async () => {
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
  ipcMain.handle("covers:randomize-missing", async () => {
    await yieldToMainLoop();
    return buildRandomizeMissingSongCovers();
  });
  ipcMain.handle("covers:randomize-selected", async (_event, ids) => {
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
      clearFileInfoCache();
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
        clearFileInfoCache();
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

  ipcMain.handle("library:refresh-download-folder", async (_event, payload = {}) => {
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

  ipcMain.handle("localitfy:get-window-translucency", async () => getSavedWindowTranslucencySettings());
  ipcMain.handle("localitfy:set-window-translucency", async (_event, payload = {}) => {
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
  ipcMain.handle("localitfy:restart-app", async () => {
    restartForWindowTranslucency();
    return true;
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

  // ── Spotify: fetch public track metadata through OAuth PKCE ─────────────
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

  ipcMain.handle("spotify-fetch", async (_event, payload = {}) => runSpotifyFetch(payload));
  ipcMain.handle("spotify-fetch-tracks", async (_event, url) => runSpotifyFetch({ url }));

  ipcMain.handle("spotify-check", async () => {
    const saved = readSpotifyOAuthToken();
    const hasClientId = Boolean(SPOTIFY_CLIENT_ID);
    return {
      ok: hasClientId,
      ready: hasClientId,
      loggedIn: Boolean(saved?.refreshToken),
      publicOnly: true,
      mode: "oauth-pkce",
      needsClientId: !hasClientId,
      redirectUri: SPOTIFY_REDIRECT_URI,
      error: hasClientId ? "" : "Spotify Client ID missing. Add SPOTIFY_CLIENT_ID and register the redirect URI."
    };
  });

  ipcMain.handle("spotify-login", async () => loginSpotifyOAuth());

  ipcMain.handle("spotify-import-browser", async () => ({
    ok: false,
    ready: Boolean(SPOTIFY_CLIENT_ID),
    loggedIn: Boolean(readSpotifyOAuthToken()?.refreshToken),
    publicOnly: true,
    mode: "oauth-pkce",
    error: "Browser cookie import is disabled. Use Connect Spotify instead. No sp_dc cookie paste is needed."
  }));

  ipcMain.handle("spotify-set-cookie", async () => ({
    ok: false,
    ready: Boolean(SPOTIFY_CLIENT_ID),
    loggedIn: Boolean(readSpotifyOAuthToken()?.refreshToken),
    publicOnly: true,
    mode: "oauth-pkce",
    error: "Manual Spotify cookies are disabled. Use Connect Spotify instead."
  }));

  ipcMain.handle("spotify-logout", async () => {
    clearSpotifyOAuthToken();
    console.log("[localtify spotify] oauth token cleared");
    return { ok: true, ready: Boolean(SPOTIFY_CLIENT_ID), loggedIn: false, publicOnly: true, mode: "oauth-pkce" };
  });

  ipcMain.handle("spotdl-check", async () => ({
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
      const successfulDownloads = (result.downloads || [])
        .map((item, index) => ({
          item,
          track: tracks[index] || (item?.filePath ? matchSpotifyTrackForFile(item.filePath, tracks) : null) || {}
        }))
        .filter(({ item }) => item?.ok && item.filePath && fileExists(item.filePath) && isAudioFile(item.filePath));

      let changedCount = 0;
      let afterSongs = listSongsShaped();
      const importedFilePaths = [];
      const importedSongIds = [];

      if (autoAdd && successfulDownloads.length) {
        const pixelArtFiles = getPixelArtFiles();
        const usedCovers = new Set();
        const importedSongs = [];

        for (const { item, track } of successfulDownloads) {
          const filePath = item.filePath;
          importedFilePaths.push(filePath);

          // Exact file + exact Spotify metadata. This is the important part:
          // the Spotify cover goes into coverPath, replacing the pixel fallback.
          const song = await makeSongFromFileWithExactSpotifyTrack(filePath, track, pixelArtFiles, usedCovers);
          importedSongs.push(song);
          importedSongIds.push(song.id);
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
              duration: song.duration
            });
          } catch (error) {
            console.log("[localtify spotify metadata patch error]", error?.message || error);
          }
        }

        clearFileInfoCache();
        afterSongs = listSongsShaped();
      }

      for (const item of result.downloads || []) {
        if (item?.ok) event.sender.send("spotdl-track-done", item);
      }

      return {
        ...result,
        changedCount,
        songs: afterSongs,
        downloadFolder,
        importedFilePaths: Array.from(new Set(importedFilePaths.filter(Boolean))),
        spotifyImportedSongIds: Array.from(new Set(importedSongIds.filter(Boolean))),
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
        importedFilePaths: []
      };
    }
  };

  ipcMain.handle("spotify-download-batch", runSpotifyDownloadBatch);
  ipcMain.handle("spotdl-download-batch", runSpotifyDownloadBatch);

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