"use strict";

const fs = require("node:fs");
const path = require("node:path");

function uniquePaths(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = path.normalize(item).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createUserDataRuntime(options = {}) {
  const {
    app,
    legacyAppDataName = "localitfy",
    sqliteFileName = "localitfy.sqlite"
  } = options;

  if (!app || typeof app.getPath !== "function" || typeof app.setPath !== "function") {
    throw new TypeError("Electron app path runtime is required");
  }

  let stableUserDataPath = "";

  function getStableUserDataPath() {
    return path.join(app.getPath("appData"), legacyAppDataName);
  }

  function configureStableUserDataPath() {
    try {
      const stablePath = getStableUserDataPath();
      fs.mkdirSync(stablePath, { recursive: true });
      app.setPath("userData", stablePath);
      stableUserDataPath = stablePath;
      return stablePath;
    } catch (error) {
      console.log("[localitfy userData path error]", error?.message || error);
      stableUserDataPath = app.getPath("userData");
      return stableUserDataPath;
    }
  }

  function getUserDataRecoveryCandidates() {
    const appData = app.getPath("appData");
    const stablePath = stableUserDataPath || app.getPath("userData");
    return uniquePaths([
      stablePath,
      path.join(appData, "localtify"),
      path.join(appData, "localitfy"),
      path.join(appData, "Electron")
    ]);
  }

  function getCandidateDatabaseInfo(dirPath) {
    const filePath = path.join(dirPath, sqliteFileName);
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
    const currentUserDataPath = app.getPath("userData");
    const stableDbPath = path.join(currentUserDataPath, sqliteFileName);
    const stableInfo = getCandidateDatabaseInfo(currentUserDataPath);
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
      console.log("[localitify database restored]", { from: best.filePath, to: stableDbPath });
      return { restored: true, dbPath: stableDbPath, source: best.filePath };
    } catch (error) {
      console.log("[localitify database restore error]", error?.message || error);
      return {
        restored: false,
        dbPath: stableDbPath,
        source: best.filePath,
        error: error?.message || String(error)
      };
    }
  }

  return Object.freeze({
    getStableUserDataPath,
    configureStableUserDataPath,
    getUserDataRecoveryCandidates,
    getCandidateDatabaseInfo,
    restoreDatabaseFromOldUserDataIfNeeded
  });
}

module.exports = { uniquePaths, createUserDataRuntime };
