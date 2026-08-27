"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const { spawn } = require("node:child_process");

const YTDLP_VERSION = "2026.08.19";
const YTDLP_ASSETS = Object.freeze({
  "win32-x64": Object.freeze({
    assetName: "yt-dlp.exe",
    binaryName: "yt-dlp.exe",
    sha256: "66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a"
  }),
  "linux-x64": Object.freeze({
    assetName: "yt-dlp_linux",
    binaryName: "yt-dlp",
    sha256: "58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a"
  })
});

function getPinnedYtDlpAsset(platform = process.platform, arch = process.arch) {
  return YTDLP_ASSETS[`${platform}-${arch}`] || null;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function downloadHttpsToFile(urlString, targetPath, redirectLimit = 6) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(String(urlString || ""));
    } catch {
      reject(new Error("invalid yt-dlp download URL"));
      return;
    }

    if (parsed.protocol !== "https:") {
      reject(new Error("yt-dlp download must use HTTPS"));
      return;
    }

    const request = https.get(parsed, {
      headers: {
        "User-Agent": "localtify-yt-dlp-manager/0.4.1",
        "Accept": "application/octet-stream"
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirectLimit > 0) {
        response.resume();
        const nextUrl = new URL(response.headers.location, parsed).toString();
        downloadHttpsToFile(nextUrl, targetPath, redirectLimit - 1).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`yt-dlp download returned HTTP ${response.statusCode}`));
        return;
      }

      const output = fs.createWriteStream(targetPath, { flags: "wx", mode: 0o700 });
      output.on("error", reject);
      response.on("error", reject);
      output.on("finish", () => output.close(resolve));
      response.pipe(output);
    });

    request.on("error", reject);
    request.setTimeout(30_000, () => request.destroy(new Error("yt-dlp download timed out")));
  });
}

async function ensureYtDlpBinary({ userDataPath } = {}) {
  const override = String(process.env.LOCALTIFY_YTDLP_PATH || "").trim();
  if (override) {
    if (!path.isAbsolute(override) || !fs.existsSync(override)) {
      throw new Error("LOCALTIFY_YTDLP_PATH must point to an existing absolute file");
    }
    return { path: override, source: "override", verified: false, version: "external" };
  }

  const asset = getPinnedYtDlpAsset();
  if (!asset) {
    throw new Error(`No pinned yt-dlp binary is available for ${process.platform}-${process.arch}`);
  }

  const base = String(userDataPath || "").trim();
  if (!base) throw new Error("userDataPath is required for yt-dlp setup");

  const binDir = path.join(base, "localitfy-bin");
  fs.mkdirSync(binDir, { recursive: true });
  const binaryPath = path.join(binDir, asset.binaryName);

  if (fs.existsSync(binaryPath)) {
    const existingHash = sha256File(binaryPath);
    if (existingHash === asset.sha256) {
      if (process.platform !== "win32") fs.chmodSync(binaryPath, 0o700);
      return { path: binaryPath, source: "cache", verified: true, version: YTDLP_VERSION, sha256: existingHash };
    }
    fs.rmSync(binaryPath, { force: true });
  }

  const tempPath = `${binaryPath}.${process.pid}.${Date.now()}.tmp`;
  const releaseUrl = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/${asset.assetName}`;

  try {
    await downloadHttpsToFile(releaseUrl, tempPath);
    const downloadedHash = sha256File(tempPath);
    if (downloadedHash !== asset.sha256) {
      throw new Error("yt-dlp SHA-256 verification failed");
    }
    if (process.platform !== "win32") fs.chmodSync(tempPath, 0o700);
    fs.renameSync(tempPath, binaryPath);
    return { path: binaryPath, source: "download", verified: true, version: YTDLP_VERSION, sha256: downloadedHash };
  } catch (error) {
    try { fs.rmSync(tempPath, { force: true }); } catch {}
    throw error;
  }
}

function spawnYtDlp(binaryPath, args = []) {
  if (!binaryPath || !path.isAbsolute(binaryPath)) {
    throw new Error("yt-dlp binary path is invalid");
  }
  return spawn(binaryPath, args.map((item) => String(item)), {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

module.exports = {
  YTDLP_VERSION,
  getPinnedYtDlpAsset,
  sha256File,
  ensureYtDlpBinary,
  spawnYtDlp
};
