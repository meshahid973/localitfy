"use strict";

const { normalizeWindowTranslucencySettings } = require("./windows.cjs");

function createWindowTranslucencyRuntime({
  app,
  getSettings,
  getMainWindow,
  setMainWindow,
  createWindow,
  setAllowQuit
} = {}) {
  if (!app) throw new Error("createWindowTranslucencyRuntime requires Electron app");
  if (typeof getSettings !== "function") throw new TypeError("getSettings is required");
  if (typeof getMainWindow !== "function") throw new TypeError("getMainWindow is required");
  if (typeof setMainWindow !== "function") throw new TypeError("setMainWindow is required");
  if (typeof createWindow !== "function") throw new TypeError("createWindow is required");
  if (typeof setAllowQuit !== "function") throw new TypeError("setAllowQuit is required");

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
      // Keep the native surface dark while Chromium and Windows compositor state settle.
      win.setBackgroundColor("#090012");
    } catch (error) {
      console.log("[localtify window background error]", error?.message || error);
    }

    try {
      if (process.platform === "win32" && typeof win.setBackgroundMaterial === "function") {
        win.setBackgroundMaterial("none");
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
      setAllowQuit(true);
      app.relaunch();
    } catch (error) {
      console.log("[localtify relaunch error]", error?.message || error);
    }

    setTimeout(() => {
      try { app.exit(0); } catch { process.exit(0); }
    }, 120);
  }

  function reloadMainWindowForTranslucency() {
    const previousWindow = (() => {
      const current = getMainWindow();
      return current && !current.isDestroyed() ? current : null;
    })();
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

    setMainWindow(null);

    setTimeout(() => {
      try {
        createWindow();
        const nextWindow = getMainWindow();
        if (nextWindow && !nextWindow.isDestroyed()) {
          if (previousBounds) {
            try { nextWindow.setBounds(previousBounds); } catch {}
          }
          if (wasMaximized) {
            try { nextWindow.maximize(); } catch {}
          }
          if (wasFullScreen) {
            try { nextWindow.setFullScreen(true); } catch {}
          }
        }
      } catch (error) {
        console.log("[localtify translucent window reload error]", error?.message || error);
      }
    }, 80);
  }

  return {
    getSavedWindowTranslucencySettings,
    applyWindowTranslucencyToWindow,
    restartForWindowTranslucency,
    reloadMainWindowForTranslucency
  };
}

module.exports = { createWindowTranslucencyRuntime };
