"use strict";

const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { LOCALTIFY_RENDERER_PROTOCOL } = require("./protocols.cjs");

function normalizeUrl(rawUrl) {
  try {
    return new URL(String(rawUrl || ""));
  } catch {
    return null;
  }
}

function normalizeFilePath(filePath) {
  const resolved = path.resolve(String(filePath || ""));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isFileInsideRoot(filePath, rootPath) {
  if (!filePath || !rootPath) return false;
  const candidate = normalizeFilePath(filePath);
  const root = normalizeFilePath(rootPath);
  if (candidate === root) return true;
  return candidate.startsWith(`${root}${path.sep}`);
}

function isAllowedRendererNavigation(rawUrl, options = {}) {
  const parsed = normalizeUrl(rawUrl);
  if (!parsed) return false;

  if (parsed.protocol === `${LOCALTIFY_RENDERER_PROTOCOL}:` && parsed.hostname === "app") return true;

  if (parsed.protocol === "file:") {
    if (!options.rendererFileRoot) return false;
    try {
      return isFileInsideRoot(fileURLToPath(parsed), options.rendererFileRoot);
    } catch {
      return false;
    }
  }

  if (options.isDev && parsed.protocol === "http:") {
    const hostname = parsed.hostname.toLowerCase();
    const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    return isLoopback && parsed.port === "5173";
  }

  return false;
}

function isTrustedMainFrameIpcEvent(event, win) {
  try {
    if (!event || !win || win.isDestroyed?.()) return false;
    const webContents = win.webContents;
    if (!webContents || event.sender !== webContents) return false;
    return Boolean(event.senderFrame && event.senderFrame === webContents.mainFrame);
  } catch {
    return false;
  }
}

function installRendererSecurityGuards(win, options = {}) {
  if (!win || win.isDestroyed?.()) return false;
  const webContents = win.webContents;
  if (!webContents) return false;

  if (typeof webContents.setWindowOpenHandler === "function") {
    webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  }

  const blockUntrustedNavigation = (event, targetUrl) => {
    if (!isAllowedRendererNavigation(targetUrl, options)) event.preventDefault();
  };

  if (typeof webContents.on === "function") {
    webContents.on("will-navigate", blockUntrustedNavigation);
    webContents.on("will-redirect", blockUntrustedNavigation);
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
  isFileInsideRoot,
  isTrustedMainFrameIpcEvent,
  installRendererSecurityGuards,
  installSessionPermissionGuards
};
