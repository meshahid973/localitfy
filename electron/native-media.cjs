"use strict";

// localtify 0.2.9 native Windows media integration
// Add this file next to your Electron main.cjs, then call attachLocaltifyNativeWindowsMedia(mainWindow).

const path = require("path");
const fs = require("fs");
const {
  app,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  globalShortcut
} = require("electron");

const MEDIA_CHANNEL = "player:command";

let attachedWindow = null;
let tray = null;
let allowQuit = false;
let minimizeToTray = false;
let currentState = {
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
    name: "localtify"
  };

  if (!app.isPackaged && process.defaultApp) {
    options.path = process.execPath;
    options.args = [app.getAppPath()];
  }

  return options;
}

function getStartWithWindowsStatus() {
  if (process.platform !== "win32") return { ok: true, supported: false, openAtLogin: false };
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
    return { ok: false, supported: true, openAtLogin: false, error: error?.message || String(error || "startup setting failed") };
  }
}

function setStartWithWindows(enabled) {
  if (process.platform !== "win32") return { ok: true, supported: false, openAtLogin: false };
  try {
    app.setLoginItemSettings(getLoginItemOptions(Boolean(enabled)));
    return getStartWithWindowsStatus();
  } catch (error) {
    return { ok: false, supported: true, openAtLogin: false, error: error?.message || String(error || "startup setting failed") };
  }
}

function safeSend(command) {
  const win = attachedWindow;
  if (!win || win.isDestroyed()) return false;

  try {
    win.webContents.send(MEDIA_CHANNEL, command);
    return true;
  } catch {
    return false;
  }
}

function showMainWindow() {
  const win = attachedWindow;
  if (!win || win.isDestroyed()) return false;

  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
  return true;
}

function svgIcon(name) {
  const pathData = {
    prev: "M17 18V6h-2v5.2L7 6v12l8-5.2V18h2z",
    next: "M7 6v12l8-5.2V18h2V6h-2v5.2L7 6z",
    play: "M8 5v14l11-7L8 5z",
    pause: "M7 5h4v14H7V5zm6 0h4v14h-4V5z",
    stop: "M7 7h10v10H7V7z"
  }[name] || "M8 5v14l11-7L8 5z";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="white" d="${pathData}"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function findTrayIcon(customIconPath) {
  const candidates = [
    customIconPath,
    path.join(process.cwd(), "assets", "icon.ico"),
    path.join(process.cwd(), "assets", "logo.png"),
    path.join(__dirname, "assets", "icon.ico"),
    path.join(__dirname, "assets", "logo.png"),
    path.join(__dirname, "public", "logo.png")
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        const image = nativeImage.createFromPath(candidate);
        if (!image.isEmpty()) return image.resize({ width: 16, height: 16 });
      }
    } catch {
      // keep trying fallbacks
    }
  }

  return svgIcon(currentState.isPlaying ? "pause" : "play");
}

function updateTrayMenu() {
  if (!tray) return;

  const title = currentState.hasSong
    ? `${currentState.title || "Unknown song"}${currentState.artist ? ` â€” ${currentState.artist}` : ""}`
    : "localtify";

  tray.setToolTip(title);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open localtify", click: showMainWindow },
    { type: "separator" },
    {
      label: currentState.isPlaying ? "Pause" : "Play",
      click: () => safeSend({ type: "toggle" })
    },
    { label: "Previous", click: () => safeSend({ type: "prev" }) },
    { label: "Next", click: () => safeSend({ type: "next" }) },
    {
      label: currentState.muted || currentState.volume <= 0.01 ? "Unmute" : "Mute",
      click: () => safeSend({ type: "muteToggle" })
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
}

function ensureTray(customIconPath) {
  if (tray) return tray;

  tray = new Tray(findTrayIcon(customIconPath));
  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
  updateTrayMenu();
  return tray;
}

function updateTaskbarButtons() {
  const win = attachedWindow;
  if (!win || win.isDestroyed() || process.platform !== "win32" || typeof win.setThumbarButtons !== "function") return;

  try {
    win.setThumbnailToolTip(currentState.hasSong ? `${currentState.title || "Unknown song"} - localtify` : "localtify");
    win.setThumbarButtons([
      {
        tooltip: "Previous",
        icon: svgIcon("prev"),
        flags: currentState.hasSong ? ["enabled"] : ["disabled"],
        click: () => safeSend({ type: "prev" })
      },
      {
        tooltip: currentState.isPlaying ? "Pause" : "Play",
        icon: svgIcon(currentState.isPlaying ? "pause" : "play"),
        flags: currentState.hasSong ? ["enabled"] : ["disabled"],
        click: () => safeSend({ type: "toggle" })
      },
      {
        tooltip: "Next",
        icon: svgIcon("next"),
        flags: currentState.hasSong ? ["enabled"] : ["disabled"],
        click: () => safeSend({ type: "next" })
      }
    ]);
  } catch {
    // taskbar buttons are Windows-only and optional
  }
}

function registerMediaKeys() {
  if (!globalShortcut || typeof globalShortcut.register !== "function") return;

  const shortcuts = [
    ["MediaPlayPause", { type: "toggle" }],
    ["MediaNextTrack", { type: "next" }],
    ["MediaPreviousTrack", { type: "prev" }],
    ["MediaStop", { type: "stop" }]
  ];

  for (const [accelerator, command] of shortcuts) {
    try {
      globalShortcut.register(accelerator, () => safeSend(command));
    } catch {
      // another app may own the shortcut; Media Session still handles focused/OS controls
    }
  }
}

function attachCloseToTray(win) {
  if (!win || win.__localtifyTrayCloseAttached) return;
  win.__localtifyTrayCloseAttached = true;

  win.on("close", (event) => {
    if (!minimizeToTray || allowQuit || win.isDestroyed()) return;

    event.preventDefault();
    win.hide();
    ensureTray();
  });
}

function installIpc() {
  if (ipcMain.__localtifyNativeMediaIpcInstalled) return;
  ipcMain.__localtifyNativeMediaIpcInstalled = true;

  ipcMain.handle("localitfy:native-media-state", (_event, payload = {}) => {
    currentState = {
      ...currentState,
      isPlaying: Boolean(payload.isPlaying),
      volume: Number.isFinite(Number(payload.volume)) ? Math.max(0, Math.min(1, Number(payload.volume))) : currentState.volume,
      muted: Boolean(payload.muted),
      title: String(payload.title || ""),
      artist: String(payload.artist || ""),
      album: String(payload.album || ""),
      coverUrl: String(payload.coverUrl || ""),
      hasSong: Boolean(payload.hasSong)
    };

    updateTrayMenu();
    updateTaskbarButtons();
    return true;
  });

  ipcMain.handle("localitfy:set-minimize-to-tray", (_event, payload = {}) => {
    minimizeToTray = typeof payload === "boolean" ? payload : Boolean(payload.enabled);
    if (minimizeToTray) ensureTray();
    updateTrayMenu();
    return { ok: true, minimizeToTray };
  });

  ipcMain.handle("localitfy:set-start-with-windows", (_event, payload = {}) => {
    const enabled = typeof payload === "boolean" ? payload : Boolean(payload.enabled);
    return setStartWithWindows(enabled);
  });

  ipcMain.handle("localitfy:get-start-with-windows", () => getStartWithWindowsStatus());

  ipcMain.handle("localitfy:native-media-status", () => ({
    ok: true,
    state: currentState,
    minimizeToTray,
    trayReady: Boolean(tray),
    startWithWindows: getStartWithWindowsStatus()
  }));
}

function attachLocaltifyNativeWindowsMedia(win, options = {}) {
  attachedWindow = win;
  installIpc();
  attachCloseToTray(win);
  ensureTray(options.iconPath);
  updateTaskbarButtons();
  registerMediaKeys();

  app.on("before-quit", () => {
    allowQuit = true;
  });

  app.on("will-quit", () => {
    try {
      globalShortcut.unregister("MediaPlayPause");
      globalShortcut.unregister("MediaNextTrack");
      globalShortcut.unregister("MediaPreviousTrack");
      globalShortcut.unregister("MediaStop");
    } catch {
      // ignore unregister errors during shutdown
    }

    if (tray) {
      try { tray.destroy(); } catch {}
      tray = null;
    }
  });

  return {
    setMinimizeToTray(enabled) {
      minimizeToTray = Boolean(enabled);
      if (minimizeToTray) ensureTray(options.iconPath);
      updateTrayMenu();
    },
    send(command) {
      return safeSend(command);
    }
  };
}

module.exports = { attachLocaltifyNativeWindowsMedia };

