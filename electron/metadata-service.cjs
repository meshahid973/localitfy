const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");

let serviceUserDataPath = "";
let serviceFfmpegPath = "";

const AUDIO_EXTENSIONS = new Set([".mp3", ".flac", ".m4a", ".aac", ".ogg", ".wav"]);
const COVER_CACHE_DIR = "metadata-covers-v040";

function initMetadataService(options = {}) {
  serviceUserDataPath = String(options.userDataPath || serviceUserDataPath || "").trim();
  serviceFfmpegPath = String(options.ffmpegPath || serviceFfmpegPath || "").trim();

  if (serviceUserDataPath) {
    try {
      fs.mkdirSync(getEmbeddedCoverCacheDirectory(), { recursive: true });
    } catch {
      // Metadata must never block startup.
    }
  }
}

function isAudioFile(filePath) {
  return AUDIO_EXTENSIONS.has(path.extname(String(filePath || "")).toLowerCase());
}

function fileExists(filePath) {
  try {
    return Boolean(filePath && fs.statSync(filePath).isFile());
  } catch {
    return false;
  }
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (text || fallback).slice(0, 180);
}

function getEmbeddedCoverCacheDirectory() {
  const base = serviceUserDataPath || process.cwd();
  return path.join(base, COVER_CACHE_DIR);
}

function extensionFromMime(mime = "") {
  const clean = String(mime || "").toLowerCase();
  if (clean.includes("png")) return ".png";
  if (clean.includes("webp")) return ".webp";
  if (clean.includes("gif")) return ".gif";
  return ".jpg";
}

function saveEmbeddedCover(filePath, picture) {
  try {
    if (!picture?.data?.length) return "";

    const stat = fs.statSync(filePath);
    const hash = crypto
      .createHash("sha1")
      .update(String(filePath))
      .update(String(stat.mtimeMs || ""))
      .update(String(stat.size || ""))
      .update(Buffer.from(picture.data).subarray(0, 4096))
      .digest("hex");

    const dir = getEmbeddedCoverCacheDirectory();
    fs.mkdirSync(dir, { recursive: true });

    const ext = extensionFromMime(picture.format || picture.mime || "");
    const targetPath = path.join(dir, `${hash}${ext}`);

    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, Buffer.from(picture.data));
    }

    return targetPath;
  } catch {
    return "";
  }
}

async function loadMusicMetadataModule() {
  try {
    return await import("music-metadata");
  } catch {
    return null;
  }
}

function getDurationWithFfmpeg(filePath) {
  return new Promise((resolve) => {
    if (!serviceFfmpegPath || !fileExists(serviceFfmpegPath) || !fileExists(filePath)) {
      resolve({ duration: 0, durationMs: 0 });
      return;
    }

    execFile(
      serviceFfmpegPath,
      ["-hide_banner", "-i", filePath],
      { windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024 * 2 },
      (_error, stdout, stderr) => {
        const text = `${stdout || ""}\n${stderr || ""}`;
        const match = text.match(/Duration:\s*(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);

        if (!match) {
          resolve({ duration: 0, durationMs: 0 });
          return;
        }

        const hours = Number(match[1] || 0);
        const minutes = Number(match[2] || 0);
        const seconds = Number(match[3] || 0);
        const duration = Math.max(0, hours * 3600 + minutes * 60 + seconds);

        resolve({
          duration: Math.round(duration),
          durationMs: Math.round(duration * 1000)
        });
      }
    );
  });
}

function readFileNameFallback(filePath) {
  const parsed = path.parse(String(filePath || ""));
  const raw = cleanText(parsed.name || "track", "track");
  const parts = raw.split(" - ").map((item) => cleanText(item)).filter(Boolean);

  if (parts.length >= 2) {
    return {
      title: cleanText(parts.slice(1).join(" - "), raw),
      artist: cleanText(parts[0], "unknown artist"),
      album: ""
    };
  }

  return {
    title: raw,
    artist: "unknown artist",
    album: ""
  };
}

async function readLocalAudioMetadata(filePath, options = {}) {
  const target = String(filePath || "").trim();
  const readCover = options.readCover !== false;
  const fallback = readFileNameFallback(target);

  const output = {
    ok: false,
    filePath: target,
    title: fallback.title,
    artist: fallback.artist,
    album: fallback.album,
    duration: 0,
    durationMs: 0,
    track: 0,
    disc: 0,
    year: "",
    embeddedCoverPath: "",
    hasEmbeddedCover: false,
    source: "filename",
    error: ""
  };

  if (!target || !fileExists(target) || !isAudioFile(target)) {
    output.error = "file missing or unsupported";
    return output;
  }

  const metadataModule = await loadMusicMetadataModule();

  if (metadataModule?.parseFile) {
    try {
      const parsed = await metadataModule.parseFile(target, {
        duration: true,
        skipCovers: !readCover
      });

      const common = parsed?.common || {};
      const format = parsed?.format || {};

      output.title = cleanText(common.title, output.title);
      output.artist = cleanText(
        common.artist || (Array.isArray(common.artists) ? common.artists.filter(Boolean).join(", ") : ""),
        output.artist
      );
      output.album = cleanText(common.album, output.album);
      output.year = common.year ? String(common.year).slice(0, 12) : "";
      output.track = Number(common.track?.no || 0) || 0;
      output.disc = Number(common.disk?.no || 0) || 0;

      const durationSeconds = Number(format.duration || 0);
      if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        output.duration = Math.round(durationSeconds);
        output.durationMs = Math.round(durationSeconds * 1000);
      }

      const picture = Array.isArray(common.picture) ? common.picture.find((item) => item?.data?.length) : null;
      if (readCover && picture) {
        const coverPath = saveEmbeddedCover(target, picture);
        if (coverPath) {
          output.embeddedCoverPath = coverPath;
          output.hasEmbeddedCover = true;
        }
      }

      output.ok = true;
      output.source = "music-metadata";
    } catch (error) {
      output.error = error?.message || String(error || "");
    }
  }

  if (!output.durationMs || output.durationMs <= 0) {
    const fallbackDuration = await getDurationWithFfmpeg(target);
    if (fallbackDuration.durationMs > 0) {
      output.duration = fallbackDuration.duration;
      output.durationMs = fallbackDuration.durationMs;
      output.ok = true;
    }
  }

  return output;
}

module.exports = {
  initMetadataService,
  readLocalAudioMetadata,
  getDurationWithFfmpeg
};
