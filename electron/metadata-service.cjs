const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");

let serviceUserDataPath = "";
let serviceFfmpegPath = "";
let musicMetadataModulePromise = null;

const AUDIO_EXTENSIONS = new Set([".mp3", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".aiff", ".aif"]);
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
    const rawData = picture?.data || picture;
    if (!rawData?.length) return "";

    const stat = fs.statSync(filePath);
    const buffer = Buffer.from(rawData);
    const hash = crypto
      .createHash("sha1")
      .update(String(filePath))
      .update(String(stat.mtimeMs || ""))
      .update(String(stat.size || ""))
      .update(buffer.subarray(0, Math.min(buffer.length, 8192)))
      .digest("hex");

    const dir = getEmbeddedCoverCacheDirectory();
    fs.mkdirSync(dir, { recursive: true });

    const ext = extensionFromMime(picture?.format || picture?.mime || "");
    const targetPath = path.join(dir, `${hash}${ext}`);

    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, buffer);
    }

    return targetPath;
  } catch {
    return "";
  }
}

async function loadMusicMetadataModule() {
  if (!musicMetadataModulePromise) {
    musicMetadataModulePromise = import("music-metadata").catch(() => null);
  }

  return musicMetadataModulePromise;
}

function parseDurationLine(text = "") {
  const match = String(text || "").match(/Duration:\s*(\d{1,3}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  if (!match) return { duration: 0, durationMs: 0 };

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const duration = Math.max(0, hours * 3600 + minutes * 60 + seconds);

  return {
    duration: Math.round(duration),
    durationMs: Math.round(duration * 1000)
  };
}

function getDurationWithFfmpeg(filePath) {
  return new Promise((resolve) => {
    if (!serviceFfmpegPath || !fileExists(serviceFfmpegPath) || !fileExists(filePath)) {
      resolve({ duration: 0, durationMs: 0, source: "none" });
      return;
    }

    execFile(
      serviceFfmpegPath,
      ["-hide_banner", "-nostdin", "-i", filePath],
      { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 * 4 },
      (_error, stdout, stderr) => {
        const parsed = parseDurationLine(`${stdout || ""}\n${stderr || ""}`);
        resolve({ ...parsed, source: parsed.durationMs > 0 ? "ffmpeg" : "none" });
      }
    );
  });
}

function estimateDurationFromBitrate(filePath, bitrate) {
  try {
    const bitRateNumber = Number(bitrate || 0);
    if (!Number.isFinite(bitRateNumber) || bitRateNumber <= 8000) return { duration: 0, durationMs: 0 };
    const stat = fs.statSync(filePath);
    if (!stat.size || stat.size <= 0) return { duration: 0, durationMs: 0 };

    const duration = Math.max(0, (stat.size * 8) / bitRateNumber);
    if (!Number.isFinite(duration) || duration < 1) return { duration: 0, durationMs: 0 };

    return {
      duration: Math.round(duration),
      durationMs: Math.round(duration * 1000)
    };
  } catch {
    return { duration: 0, durationMs: 0 };
  }
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

function getPrimaryPicture(common) {
  const pictures = Array.isArray(common?.picture) ? common.picture : [];
  if (!pictures.length) return null;

  return (
    pictures.find((item) => /front|cover/i.test(String(item?.type || "")) && item?.data?.length) ||
    pictures.find((item) => item?.data?.length) ||
    null
  );
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
    durationSource: "none",
    coverSource: "none",
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
        skipCovers: !readCover,
        skipPostHeaders: false
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
        output.durationSource = "music-metadata";
      }

      if (readCover) {
        const picture = getPrimaryPicture(common);
        if (picture) {
          const coverPath = saveEmbeddedCover(target, picture);
          if (coverPath) {
            output.embeddedCoverPath = coverPath;
            output.hasEmbeddedCover = true;
            output.coverSource = "embedded";
          }
        }
      }

      output.ok = true;
      output.source = "music-metadata";

      if ((!output.durationMs || output.durationMs <= 0) && format.bitrate) {
        const estimated = estimateDurationFromBitrate(target, format.bitrate);
        if (estimated.durationMs > 0) {
          output.duration = estimated.duration;
          output.durationMs = estimated.durationMs;
          output.durationSource = "bitrate-estimate";
        }
      }
    } catch (error) {
      output.error = error?.message || String(error || "");
    }
  } else {
    output.error = "music-metadata dependency missing";
  }

  if (!output.durationMs || output.durationMs <= 0) {
    const fallbackDuration = await getDurationWithFfmpeg(target);
    if (fallbackDuration.durationMs > 0) {
      output.duration = fallbackDuration.duration;
      output.durationMs = fallbackDuration.durationMs;
      output.durationSource = fallbackDuration.source || "ffmpeg";
      output.ok = true;
    }
  }

  if (output.durationMs > 0 && (!output.duration || output.duration <= 0)) {
    output.duration = Math.round(output.durationMs / 1000);
  }

  return output;
}

module.exports = {
  initMetadataService,
  readLocalAudioMetadata,
  getDurationWithFfmpeg
};
