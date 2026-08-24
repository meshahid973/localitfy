"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PUBLIC_SPOTIFY_CLIENT_ID = "586c22791eb74d73b1c83db88f1d4c52";

function safePath(...parts) {
  try {
    if (parts.some((part) => !part)) return "";
    return path.join(...parts);
  } catch {
    return "";
  }
}

function getLocaltifyEnvPaths(app, processRef = process) {
  const appPath = (() => {
    try {
      return typeof app?.getAppPath === "function" ? app.getAppPath() : "";
    } catch {
      return "";
    }
  })();

  const resourcePath = (() => {
    try {
      return processRef.resourcesPath || "";
    } catch {
      return "";
    }
  })();

  const executableDir = (() => {
    try {
      return processRef.execPath ? path.dirname(processRef.execPath) : "";
    } catch {
      return "";
    }
  })();

  const userDataPath = (() => {
    try {
      return typeof app?.getPath === "function" ? app.getPath("userData") : "";
    } catch {
      return "";
    }
  })();

  const cwd = (() => {
    try {
      return typeof processRef.cwd === "function" ? processRef.cwd() : "";
    } catch {
      return "";
    }
  })();

  const seen = new Set();
  return [
    safePath(cwd, ".env"),
    safePath(cwd, ".env.production"),
    safePath(appPath, ".env"),
    safePath(appPath, ".env.production"),
    safePath(resourcePath, ".env"),
    safePath(resourcePath, ".env.production"),
    safePath(executableDir, ".env"),
    safePath(executableDir, ".env.production"),
    safePath(userDataPath, ".env"),
    safePath(userDataPath, ".env.production"),
    safePath(resourcePath, "app", ".env"),
    safePath(resourcePath, "app", ".env.production")
  ].filter(Boolean).filter((item) => {
    const key = path.normalize(item).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function loadLocaltifyEnv(app, processRef = process) {
  const possibleEnvPaths = getLocaltifyEnvPaths(app, processRef);

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

        if (typeof processRef.env[key] === "undefined") {
          processRef.env[key] = value;
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

  processRef.env.SPOTIFY_CLIENT_ID =
    processRef.env.SPOTIFY_CLIENT_ID ||
    processRef.env.VITE_SPOTIFY_CLIENT_ID ||
    processRef.env.VITE_PUBLIC_SPOTIFY_CLIENT_ID ||
    PUBLIC_SPOTIFY_CLIENT_ID;

  processRef.env.VITE_PUBLIC_SPOTIFY_CLIENT_ID =
    processRef.env.VITE_PUBLIC_SPOTIFY_CLIENT_ID ||
    processRef.env.SPOTIFY_CLIENT_ID ||
    PUBLIC_SPOTIFY_CLIENT_ID;

  return { paths: possibleEnvPaths, spotifyClientId: processRef.env.SPOTIFY_CLIENT_ID };
}

module.exports = {
  PUBLIC_SPOTIFY_CLIENT_ID,
  getLocaltifyEnvPaths,
  loadLocaltifyEnv
};
