"use strict";

const fs = require("node:fs");
const path = require("node:path");

function createNativeMediaRuntime(options = {}) {
  const {
    app,
    Menu,
    Tray,
    nativeImage,
    globalShortcut,
    ipcRouter,
    saveSettings = () => undefined,
    getMainWindow = () => null,
    createWindow = () => undefined,
    appName = "localtify",
    isDev = false,
    baseDir = path.resolve(__dirname, ".."),
    processRef = process
  } = options;

  if (!app || !ipcRouter || typeof ipcRouter.handle !== "function") {
    throw new TypeError("Native media runtime requires Electron app and the IPC router");
  }

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
    const loginOptions = {
      openAtLogin: Boolean(openAtLogin),
      openAsHidden: false,
      name: appName
    };
    if (isDev && processRef.defaultApp) {
      loginOptions.path = processRef.execPath;
      loginOptions.args = [app.getAppPath()];
    }
    return loginOptions;
  }

  function getStartWithWindowsStatus() {
    if (processRef.platform !== "win32") {
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
    if (processRef.platform !== "win32") {
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

  function syncWindowsIntegrationSettings(settings = {}, syncOptions = {}) {
    const hasSavedStartupChoice = Object.prototype.hasOwnProperty.call(settings || {}, "startWithWindows");
    const startWithWindows = hasSavedStartupChoice ? Boolean(settings.startWithWindows) : true;
    const startupStatus = setStartWithWindows(startWithWindows);
    if (!hasSavedStartupChoice && syncOptions.persistDefault) {
      try {
        saveSettings({ startWithWindows: true });
      } catch (error) {
        console.log("[localtify startup default save error]", error?.message || error);
      }
    }
    return startupStatus;
  }

  function sendPlayerCommand(command) {
    if (!command || typeof command !== "object") return false;
    const payload = { ...command, source: command.source || "native" };
    try {
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("player:command", payload);
        return true;
      }
    } catch (error) {
      console.log("[localtify native command error]", error?.message || error);
    }
    return false;
  }

  function showMainWindow() {
    const mainWindow = getMainWindow();
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
    const resourcesPath = processRef.resourcesPath || "";
    const cwd = (() => {
      try { return typeof processRef.cwd === "function" ? processRef.cwd() : ""; } catch { return ""; }
    })();

    return [
      safePathJoin(cwd, "build", "icon.ico"),
      safePathJoin(baseDir, "build", "icon.ico"),
      safePathJoin(baseDir, "..", "build", "icon.ico"),
      safePathJoin(appPath, "build", "icon.ico"),
      safePathJoin(resourcesPath, "build", "icon.ico"),
      safePathJoin(resourcesPath, "app", "build", "icon.ico"),
      safePathJoin(resourcesPath, "app.asar.unpacked", "build", "icon.ico"),
      safePathJoin(baseDir, "assets", "icon.ico"),
      safePathJoin(baseDir, "assets", "icon.png"),
      safePathJoin(baseDir, "assets", "logo.png"),
      safePathJoin(baseDir, "..", "assets", "icon.ico"),
      safePathJoin(baseDir, "..", "assets", "icon.png"),
      safePathJoin(baseDir, "..", "assets", "logo.png"),
      safePathJoin(resourcesPath, "assets", "icon.ico"),
      safePathJoin(resourcesPath, "assets", "icon.png"),
      safePathJoin(resourcesPath, "icon.ico"),
      safePathJoin(cwd, "assets", "icon.ico"),
      safePathJoin(cwd, "assets", "icon.png"),
      safePathJoin(cwd, "public", "logo.png")
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
        if (!image.isEmpty()) return size ? image.resize({ width: size, height: size }) : image;
      } catch (error) {
        console.log("[localtify icon load error]", error?.message || error);
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
    if (!nativeMediaState.hasSong) return appName;
    const title = nativeMediaState.title || "unknown song";
    const artist = nativeMediaState.artist || "";
    return artist ? `${title} — ${artist}` : title;
  }

  function prepareQuit() {
    allowQuit = true;
  }

  function updateTrayMenu() {
    if (!tray) return;
    try {
      tray.setToolTip(getNativeMediaTitle());
      tray.setImage(loadTrayIcon());
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: `Open ${appName}`, click: showMainWindow },
        { type: "separator" },
        {
          label: nativeMediaState.isPlaying ? "Pause" : "Play",
          enabled: nativeMediaState.hasSong,
          click: () => sendPlayerCommand({ type: "toggle" })
        },
        { label: "Previous", enabled: nativeMediaState.hasSong, click: () => sendPlayerCommand({ type: "prev" }) },
        { label: "Next", enabled: nativeMediaState.hasSong, click: () => sendPlayerCommand({ type: "next" }) },
        {
          label: nativeMediaState.muted || nativeMediaState.volume <= 0.01 ? "Unmute" : "Mute",
          enabled: nativeMediaState.hasSong,
          click: () => sendPlayerCommand({ type: "muteToggle" })
        },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            prepareQuit();
            app.quit();
          }
        }
      ]));
    } catch (error) {
      console.log("[localtify tray menu error]", error?.message || error);
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
      console.log("[localtify tray error]", error?.message || error);
    }
    return tray;
  }

  function updateTaskbarButtons() {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (processRef.platform !== "win32") return;
    if (typeof mainWindow.setThumbarButtons !== "function") return;
    try {
      mainWindow.setThumbnailToolTip(nativeMediaState.hasSong ? `${getNativeMediaTitle()} - ${appName}` : appName);
      mainWindow.setThumbarButtons([
        { tooltip: "Previous", icon: createThumbarIcon("previous"), flags: ["enabled"], click: () => sendPlayerCommand({ type: "prev" }) },
        { tooltip: nativeMediaState.isPlaying ? "Pause" : "Play", icon: createThumbarIcon(nativeMediaState.isPlaying ? "pause" : "play"), flags: ["enabled"], click: () => sendPlayerCommand({ type: "toggle" }) },
        { tooltip: "Next", icon: createThumbarIcon("next"), flags: ["enabled"], click: () => sendPlayerCommand({ type: "next" }) }
      ]);
    } catch (error) {
      console.log("[localtify thumbar error]", error?.message || error);
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
        if (!ok) console.log(`[localtify media key unavailable] ${accelerator}`);
      } catch (error) {
        console.log(`[localtify media key error] ${accelerator}`, error?.message || error);
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
    nativeShortcutsRegistered = false;
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

  function setMinimizeToTray(value) {
    minimizeToTray = Boolean(value);
    return minimizeToTray;
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
      setMinimizeToTray(payload.minimizeToTray);
    }
    updateTrayMenu();
    updateTaskbarButtons();
    return { ok: true, state: nativeMediaState, minimizeToTray };
  }

  function setupNativeWindowsMediaIpc() {
    ipcRouter.handle("localitfy:native-media-state", async (_event, payload = {}) => updateNativeMediaState(payload));
    ipcRouter.handle("localitfy:set-minimize-to-tray", async (_event, payload = {}) => {
      setMinimizeToTray(typeof payload === "boolean" ? payload : Boolean(payload.enabled));
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
        console.log("[localtify startup setting save error]", error?.message || error);
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

  return Object.freeze({
    getLoginItemOptions,
    getStartWithWindowsStatus,
    setStartWithWindows,
    syncWindowsIntegrationSettings,
    sendPlayerCommand,
    showMainWindow,
    ensureTray,
    updateTaskbarButtons,
    registerNativeMediaKeys,
    cleanupNativeWindowsMedia,
    attachCloseToTray,
    setMinimizeToTray,
    updateNativeMediaState,
    setupNativeWindowsMediaIpc,
    setupNativeWindowsMedia,
    prepareQuit
  });
}

module.exports = { createNativeMediaRuntime };
