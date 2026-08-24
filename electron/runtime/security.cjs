"use strict";

function normalizeUrl(rawUrl) {
  try {
    return new URL(String(rawUrl || ""));
  } catch {
    return null;
  }
}

function isAllowedRendererNavigation(rawUrl, options = {}) {
  const parsed = normalizeUrl(rawUrl);
  if (!parsed) return false;

  if (parsed.protocol === "localitfy:" && parsed.hostname === "app") return true;
  if (parsed.protocol === "file:") return options.allowFileRenderer !== false;

  if (options.isDev && parsed.protocol === "http:") {
    const hostname = parsed.hostname.toLowerCase();
    const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    return isLoopback && parsed.port === "5173";
  }

  return false;
}

function installRendererSecurityGuards(win, options = {}) {
  if (!win || win.isDestroyed?.()) return false;
  const webContents = win.webContents;
  if (!webContents) return false;

  if (typeof webContents.setWindowOpenHandler === "function") {
    webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  }

  if (typeof webContents.on === "function") {
    webContents.on("will-navigate", (event, targetUrl) => {
      if (!isAllowedRendererNavigation(targetUrl, options)) {
        event.preventDefault();
      }
    });

    webContents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  }

  return true;
}

function installSessionPermissionGuards(electronSession) {
  if (!electronSession) return false;

  if (typeof electronSession.setPermissionRequestHandler === "function") {
    electronSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
  }

  if (typeof electronSession.setPermissionCheckHandler === "function") {
    electronSession.setPermissionCheckHandler(() => false);
  }

  return true;
}

module.exports = {
  isAllowedRendererNavigation,
  installRendererSecurityGuards,
  installSessionPermissionGuards
};
