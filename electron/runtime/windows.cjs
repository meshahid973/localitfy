const DEFAULT_WINDOW_TRANSLUCENCY = Object.freeze({
  translucentWindow: true,
  windowTransparency: 82,
  windowBlur: 18,
  transparentAppBackground: true
});

function clampWindowNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeWindowTranslucencySettings(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  return {
    translucentWindow: Boolean(source.translucentWindow ?? DEFAULT_WINDOW_TRANSLUCENCY.translucentWindow),
    windowTransparency: clampWindowNumber(
      source.windowTransparency,
      DEFAULT_WINDOW_TRANSLUCENCY.windowTransparency,
      12,
      88
    ),
    windowBlur: clampWindowNumber(source.windowBlur, DEFAULT_WINDOW_TRANSLUCENCY.windowBlur, 0, 36),
    transparentAppBackground: source.transparentAppBackground !== false
  };
}

function createWindowsStartupRuntime({ app, isDev = false, appName = "localtify", saveSettings = null } = {}) {
  if (!app) throw new Error("createWindowsStartupRuntime requires Electron app");

  function getLoginItemOptions(openAtLogin = false) {
    const options = {
      openAtLogin: Boolean(openAtLogin),
      openAsHidden: false,
      name: appName
    };

    if (isDev && process.defaultApp) {
      options.path = process.execPath;
      options.args = [app.getAppPath()];
    }

    return options;
  }

  function getStatus() {
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

  function setEnabled(enabled) {
    if (process.platform !== "win32") {
      return { ok: true, supported: false, openAtLogin: false };
    }

    try {
      app.setLoginItemSettings(getLoginItemOptions(Boolean(enabled)));
      return getStatus();
    } catch (error) {
      return {
        ok: false,
        supported: true,
        openAtLogin: false,
        error: error?.message || String(error || "startup setting failed")
      };
    }
  }

  function syncSettings(settings = {}, options = {}) {
    const source = settings && typeof settings === "object" ? settings : {};
    const hasSavedStartupChoice = Object.prototype.hasOwnProperty.call(source, "startWithWindows");
    const startWithWindows = hasSavedStartupChoice ? Boolean(source.startWithWindows) : true;
    const startupStatus = setEnabled(startWithWindows);

    if (!hasSavedStartupChoice && options.persistDefault && typeof saveSettings === "function") {
      try {
        saveSettings({ startWithWindows: true });
      } catch (error) {
        console.log("[localtify startup default save error]", error?.message || error);
      }
    }

    return startupStatus;
  }

  return {
    getLoginItemOptions,
    getStatus,
    setEnabled,
    syncSettings
  };
}

module.exports = {
  DEFAULT_WINDOW_TRANSLUCENCY,
  normalizeWindowTranslucencySettings,
  createWindowsStartupRuntime
};
