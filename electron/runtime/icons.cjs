"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ICON_PATHS = {
  previous: "M17 18V6h-2v5.2L7 6v12l8-5.2V18h2z",
  next: "M7 6v12l8-5.2V18h2V6h-2v5.2L7 6z",
  play: "M8 5v14l11-7L8 5z",
  pause: "M7 5h4v14H7V5zm6 0h4v14h-4V5z",
  stop: "M7 7h10v10H7V7z"
};

function safePathJoin(...parts) {
  try {
    if (parts.some((part) => !part)) return "";
    return path.join(...parts);
  } catch {
    return "";
  }
}

function createIconRuntime({ app, nativeImage, getIsPlaying = () => false } = {}) {
  if (!app || !nativeImage) throw new Error("[icons] app and nativeImage are required");

  const electronDir = path.resolve(__dirname, "..");

  function createSvgNativeImage(iconName) {
    const pathData = ICON_PATHS[iconName] || ICON_PATHS.play;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="white" d="${pathData}"/></svg>`;
    return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  }

  function getAppIconPathCandidates() {
    const appPath = (() => {
      try { return app.getAppPath(); } catch { return ""; }
    })();
    const resourcesPath = process.resourcesPath || "";

    return [
      safePathJoin(process.cwd(), "build", "icon.ico"),
      safePathJoin(electronDir, "build", "icon.ico"),
      safePathJoin(electronDir, "..", "build", "icon.ico"),
      safePathJoin(appPath, "build", "icon.ico"),
      safePathJoin(resourcesPath, "build", "icon.ico"),
      safePathJoin(resourcesPath, "app", "build", "icon.ico"),
      safePathJoin(resourcesPath, "app.asar.unpacked", "build", "icon.ico"),
      safePathJoin(electronDir, "assets", "icon.ico"),
      safePathJoin(electronDir, "assets", "icon.png"),
      safePathJoin(electronDir, "assets", "logo.png"),
      safePathJoin(electronDir, "..", "assets", "icon.ico"),
      safePathJoin(electronDir, "..", "assets", "icon.png"),
      safePathJoin(electronDir, "..", "assets", "logo.png"),
      safePathJoin(resourcesPath, "assets", "icon.ico"),
      safePathJoin(resourcesPath, "assets", "icon.png"),
      safePathJoin(resourcesPath, "icon.ico"),
      safePathJoin(process.cwd(), "assets", "icon.ico"),
      safePathJoin(process.cwd(), "assets", "icon.png"),
      safePathJoin(process.cwd(), "public", "logo.png")
    ].filter(Boolean);
  }

  function getAppIconPath() {
    for (const iconPath of getAppIconPathCandidates()) {
      try {
        if (fs.existsSync(iconPath)) return iconPath;
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

    const fallback = createSvgNativeImage(getIsPlaying() ? "pause" : "play");
    return size ? fallback.resize({ width: size, height: size }) : fallback;
  }

  function loadTrayIcon() {
    return loadAppIcon(16);
  }

  function createThumbarIcon(iconName) {
    return createSvgNativeImage(iconName).resize({ width: 20, height: 20 });
  }

  return {
    createThumbarIcon,
    loadAppIcon,
    loadTrayIcon
  };
}

module.exports = { createIconRuntime };
