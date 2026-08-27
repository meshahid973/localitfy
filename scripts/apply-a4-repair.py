from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8-sig")


def write(relative, content):
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(source, old, new, label):
    if old not in source:
        raise RuntimeError(f"missing expected source for {label}")
    return source.replace(old, new, 1)


def sub_once(source, pattern, replacement, label):
    compiled = re.compile(pattern, re.S)
    if not compiled.search(source):
        raise RuntimeError(f"missing expected source for {label}")
    return compiled.sub(lambda _match: replacement, source, count=1)


yt_runtime = r'''"use strict";

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
'''
write("electron/runtime/yt-dlp.cjs", yt_runtime)

downloader = read("electron/downloader.cjs")
downloader = replace_once(downloader, 'const os = require("node:os");\n', '', "unused os import")
downloader = replace_once(
    downloader,
    '''const crypto = require("node:crypto");

const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const sanitize = require("sanitize-filename");

const YTDlpWrapModule = require("yt-dlp-wrap");
const YTDlpWrap = YTDlpWrapModule.default ?? YTDlpWrapModule;

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);''',
    '''const crypto = require("node:crypto");
const { execFile, spawn } = require("node:child_process");

const ffmpegStatic = require("ffmpeg-static");
const sanitize = require("sanitize-filename");
const { ensureYtDlpBinary, spawnYtDlp } = require("./runtime/yt-dlp.cjs");''',
    "deprecated media wrapper imports"
)
downloader = replace_once(downloader, 'let _ytDlpWrap = null;', 'let _ytDlpBinaryPath = null;', "yt-dlp state")
downloader = replace_once(
    downloader,
    '''  if (ffmpegPath) {
    _ffmpegPath = ffmpegPath;
    try { ffmpeg.setFfmpegPath(_ffmpegPath); } catch { /* keep fallback */ }
  }''',
    '''  if (ffmpegPath) _ffmpegPath = ffmpegPath;''',
    "fluent ffmpeg initialization"
)
downloader = sub_once(
    downloader,
    r'''async function getYtDlp\(\) \{.*?\n\}\n\n// ====================== DOWNLOAD OPTIONS ======================''',
    '''async function getYtDlp() {
  if (_ytDlpBinaryPath && fs.existsSync(_ytDlpBinaryPath)) return _ytDlpBinaryPath;
  const resolved = await ensureYtDlpBinary({ userDataPath: _userDataPath });
  _ytDlpBinaryPath = resolved.path;
  return _ytDlpBinaryPath;
}

// ====================== DOWNLOAD OPTIONS ======================''',
    "yt-dlp setup"
)
downloader = sub_once(
    downloader,
    r'''function runYtDlp\(ytDlp, args, onProgress, job\) \{.*?\n\}\n\n// ====================== YOUTUBE DOWNLOAD ======================''',
    r'''function parseYtDlpProgressLine(line) {
  const text = String(line || "");
  const percentMatch = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);
  if (!percentMatch) return null;
  const speedMatch = text.match(/\bat\s+([^\s]+\/s)/i);
  const sizeMatch = text.match(/\bof\s+~?\s*([^\s]+)(?:\s+at|\s+ETA|$)/i);
  const etaMatch = text.match(/\bETA\s+([0-9:]+)/i);
  return {
    percent: Number(percentMatch[1] || 0),
    currentSpeed: speedMatch?.[1] || null,
    totalSize: sizeMatch?.[1] || null,
    eta: etaMatch?.[1] || null
  };
}

function runYtDlp(ytDlp, args, onProgress, job) {
  return new Promise((resolve, reject) => {
    activeDownloadCancelled = false;
    const proc = spawnYtDlp(ytDlp, args);
    activeDownloadProcesses.add(proc);
    let outputBuffer = "";

    const consume = (chunk) => {
      outputBuffer += chunk.toString();
      const lines = outputBuffer.split(/\r?\n/);
      outputBuffer = lines.pop() || "";
      for (const line of lines) {
        const progress = parseYtDlpProgressLine(line);
        if (progress) onProgress?.(buildProgressPayload(job, progress));
      }
    };

    proc.stdout?.on("data", consume);
    proc.stderr?.on("data", consume);
    proc.on("error", (err) => {
      activeDownloadProcesses.delete(proc);
      reject(new Error(err?.message || String(err)));
    });
    proc.on("close", (code) => {
      activeDownloadProcesses.delete(proc);
      if (activeDownloadCancelled) return reject(new Error("Download cancelled"));
      if (typeof code === "number" && code !== 0) return reject(new Error(`yt-dlp exited with code ${code}`));
      resolve();
    });
  });
}

// ====================== YOUTUBE DOWNLOAD ======================''',
    "yt-dlp process wrapper"
)
downloader = sub_once(
    downloader,
    r'''function convertOneToMp3\(inputPath, outputDirectory, bitrate = 192, onProgress, deleteAfter = false\) \{.*?\n\}\n\n// ====================== SPOTIFY DOWNLOAD ======================''',
    r'''function parseFfmpegTimestampSeconds(value = "") {
  const match = String(value || "").match(/(\d{1,3}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function probeMediaDurationSeconds(inputPath) {
  return new Promise((resolve) => {
    if (!_ffmpegPath || !fs.existsSync(_ffmpegPath)) return resolve(0);
    execFile(
      _ffmpegPath,
      ["-hide_banner", "-nostdin", "-i", inputPath],
      { windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
      (_error, stdout, stderr) => {
        const match = `${stdout || ""}\n${stderr || ""}`.match(/Duration:\s*(\d{1,3}:\d{2}:\d{2}(?:\.\d+)?)/i);
        resolve(match ? parseFfmpegTimestampSeconds(match[1]) : 0);
      }
    );
  });
}

function convertOneToMp3(inputPath, outputDirectory, bitrate = 192, onProgress, deleteAfter = false) {
  return new Promise(async (resolve) => {
    if (!fs.existsSync(inputPath)) return resolve({ ok: false, error: "File not found" });
    if (!_ffmpegPath || !fs.existsSync(_ffmpegPath)) return resolve({ ok: false, error: "FFmpeg is unavailable" });

    fs.mkdirSync(outputDirectory, { recursive: true });
    const baseName = sanitizeFilename(path.parse(inputPath).name);
    const outputPath = uniquePath(outputDirectory, `${baseName}.mp3`);
    const durationSeconds = await probeMediaDurationSeconds(inputPath);
    const safeBitrate = Math.max(64, Math.min(320, Number(bitrate) || 192));
    let lastPercent = -1;

    onProgress?.({ type: "convert", file: baseName, progress: 0, speed: null, message: "Converting to MP3..." });

    const proc = spawn(
      _ffmpegPath,
      ["-hide_banner", "-nostdin", "-y", "-i", inputPath, "-vn", "-c:a", "libmp3lame", "-b:a", `${safeBitrate}k`, "-threads", "0", outputPath],
      { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] }
    );
    activeDownloadProcesses.add(proc);

    proc.stderr?.on("data", (chunk) => {
      if (!durationSeconds) return;
      for (const match of chunk.toString().matchAll(/time=(\d{1,3}:\d{2}:\d{2}(?:\.\d+)?)/g)) {
        const elapsed = parseFfmpegTimestampSeconds(match[1]);
        const percent = Math.max(0, Math.min(99, Math.floor((elapsed / durationSeconds) * 100)));
        if (percent === lastPercent) continue;
        lastPercent = percent;
        onProgress?.({ type: "convert", file: baseName, progress: percent, speed: null, message: `Converting... ${percent}%` });
      }
    });

    proc.on("error", (error) => {
      activeDownloadProcesses.delete(proc);
      resolve({ ok: false, error: error?.message || "FFmpeg failed" });
    });
    proc.on("close", (code) => {
      activeDownloadProcesses.delete(proc);
      if (code !== 0 || !fs.existsSync(outputPath)) {
        try { fs.rmSync(outputPath, { force: true }); } catch {}
        resolve({ ok: false, error: `FFmpeg exited with code ${code}` });
        return;
      }
      if (deleteAfter) { try { fs.unlinkSync(inputPath); } catch {} }
      onProgress?.({ type: "convert", file: baseName, progress: 100, speed: null, message: "Done" });
      resolve({ ok: true, filePath: outputPath, filename: path.basename(outputPath) });
    });
  });
}

// ====================== SPOTIFY DOWNLOAD ======================''',
    "fluent ffmpeg conversion"
)
downloader = sub_once(
    downloader,
    r'''function runYtDlpJson\(ytDlp, args\) \{.*?\n\}\n\nfunction parseYtDlpJsonLines''',
    '''function runYtDlpJson(ytDlp, args) {
  return new Promise((resolve, reject) => {
    activeDownloadCancelled = false;
    const proc = spawnYtDlp(ytDlp, args);
    activeDownloadProcesses.add(proc);

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    proc.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });

    proc.on("error", (err) => {
      activeDownloadProcesses.delete(proc);
      reject(new Error(err?.message || String(err)));
    });
    proc.on("close", (code) => {
      activeDownloadProcesses.delete(proc);
      if (activeDownloadCancelled) return reject(new Error("Download cancelled"));
      if (typeof code === "number" && code !== 0) {
        return reject(new Error(stderr.trim() || `yt-dlp metadata read exited with code ${code}`));
      }
      resolve(stdout);
    });
  });
}

function parseYtDlpJsonLines''',
    "yt-dlp JSON process wrapper"
)

if "fluent-ffmpeg" in downloader or "yt-dlp-wrap" in downloader or "YTDlpWrap" in downloader:
    raise RuntimeError("deprecated media wrapper residue remains")
write("electron/downloader.cjs", downloader)

pkg = json.loads(read("package.json"))
for name in ("fluent-ffmpeg", "yt-dlp-wrap", "fs-extra", "ytdl-core"):
    pkg.get("dependencies", {}).pop(name, None)
write("package.json", json.dumps(pkg, indent=2) + "\n")

write("tests/phase3/dependency-hardening.test.mjs", r'''import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("deprecated media wrappers stay removed", () => {
  const pkg = JSON.parse(read("package.json"));
  const downloader = read("electron/downloader.cjs");
  for (const name of ["fluent-ffmpeg", "yt-dlp-wrap", "fs-extra", "ytdl-core"]) {
    assert.equal(Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]), false, `${name} must stay removed`);
  }
  assert.doesNotMatch(downloader, /fluent-ffmpeg|yt-dlp-wrap|YTDlpWrap/);
});

test("yt-dlp runtime pins official binaries and verifies SHA-256", () => {
  const runtimeSource = read("electron/runtime/yt-dlp.cjs");
  const runtime = require(path.join(root, "electron", "runtime", "yt-dlp.cjs"));
  assert.equal(runtime.YTDLP_VERSION, "2026.08.19");
  assert.equal(runtime.getPinnedYtDlpAsset("win32", "x64")?.sha256, "66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a");
  assert.equal(runtime.getPinnedYtDlpAsset("linux", "x64")?.sha256, "58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a");
  assert.match(runtimeSource, /SHA-256 verification failed/);
  assert.match(runtimeSource, /https:\/\/github\.com\/yt-dlp\/yt-dlp\/releases\/download/);
});
''')

print("A4 edits applied")
