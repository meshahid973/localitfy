const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { createResourceCache } = require("./runtime/resource-cache.cjs");

let serviceUserDataPath = "";
let serviceFfmpegPath = "";
let musicMetadataModulePromise = null;
let metadataCache = createResourceCache({maxEntries: 4096, maxBytes: 8 * 1024 * 1024, validate: validMetadataSnapshot});
const metadataPending = new Map();
const incompleteCoverSnapshots = new WeakSet();
let activeParses = 0;
const waiters = [];
const MAX_ACTIVE_PARSES = 4;
const METADATA_TTL = 30 * 86400000;

function validMetadataSnapshot(value) {
  if (!value || value.ok !== true || value.source !== "music-metadata" || value.error) return false;
  const strings = ["filePath","title","artist","album","genre","year","embeddedCoverPath","durationSource","coverSource","source","error"];
  if (!strings.every(key => typeof value[key] === "string" && value[key].length <= 8192)) return false;
  if (!["duration","durationMs","track","disc"].every(key => Number.isFinite(value[key]) && value[key] >= 0)) return false;
  if (typeof value.hasEmbeddedCover !== "boolean") return false;
  if (value.embeddedCoverPath) {
    const base = path.resolve(getEmbeddedCoverCacheDirectory());
    if (path.dirname(path.resolve(value.embeddedCoverPath)) !== base || !/^[a-f0-9]{40,64}\.(?:jpg|png|gif|webp|bmp)$/.test(path.basename(value.embeddedCoverPath))) return false;
  }
  return true;
}
async function withParseSlot(work) {
  if (activeParses >= MAX_ACTIVE_PARSES) await new Promise(resolve => waiters.push(resolve));
  else activeParses++;
  try { return await work(); }
  finally {
    const next = waiters.shift();
    if (next) next();
    else activeParses--;
  }
}

const AUDIO_EXTENSIONS = new Set([".mp3", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".aiff", ".aif"]);
const COVER_CACHE_DIR = "metadata-covers-v040";

function initMetadataService(options = {}) {
  const nextPath = String(options.userDataPath || serviceUserDataPath || "").trim();
  if (nextPath !== serviceUserDataPath) {
    metadataCache.flush();
    serviceUserDataPath = nextPath;
    metadataCache = createResourceCache({
      file: nextPath ? path.join(nextPath, "disposable-local-metadata-v1.json") : "",
      maxEntries: 4096, maxBytes: 8 * 1024 * 1024, validate: validMetadataSnapshot
    });
  }
  serviceFfmpegPath = String(options.ffmpegPath || serviceFfmpegPath || "").trim();

  if (serviceUserDataPath) {
    try {
      fs.mkdirSync(getEmbeddedCoverCacheDirectory(), { recursive: true });
    } catch {
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
  if (clean.includes("bmp")) return ".bmp";
  return ".jpg";
}

async function saveEmbeddedCover(picture) {
  try {
    const rawData = picture?.data || picture;
    if (!rawData?.length) return "";

    // Full-content identity deduplicates identical album artwork across tracks.
    // Existing persisted cover paths are left intact, so library references stay valid.
    const buffer = Buffer.from(rawData);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const dir = getEmbeddedCoverCacheDirectory();
    await fs.promises.mkdir(dir, { recursive: true });

    const ext = extensionFromMime(picture?.format || picture?.mime || "");
    const targetPath = path.join(dir, `${hash}${ext}`);

    let existing = false;
    try {
      const stat = await fs.promises.lstat(targetPath);
      existing = stat.isFile() && stat.size === buffer.length &&
        crypto.createHash("sha256").update(await fs.promises.readFile(targetPath)).digest("hex") === hash;
    } catch {}
    if (!existing) {
      const temporary = `${targetPath}.${crypto.randomUUID()}.tmp`;
      try { await fs.promises.writeFile(temporary, buffer, { flag: "wx" }); await fs.promises.rename(temporary, targetPath); }
      finally { await fs.promises.rm(temporary, { force: true }).catch(() => {}); }
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

async function readLocalAudioMetadataUncached(filePath, options = {}) {
  const target = String(filePath || "").trim();
  const readCover = options.readCover !== false;
  const readDuration = options.readDuration !== false;
  const fallback = readFileNameFallback(target);

  const output = {
    ok: false,
    filePath: target,
    title: fallback.title,
    artist: fallback.artist,
    album: fallback.album,
    genre: "",
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
        duration: readDuration,
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
      output.genre = [...new Map(
        (Array.isArray(common.genre) ? common.genre : [common.genre])
          .map((value) => cleanText(value, ""))
          .filter(Boolean)
          .map((value) => [value.toLocaleLowerCase(), value])
      ).values()].join("; ");
      output.year = common.year ? String(common.year).slice(0, 12) : "";
      output.track = Number(common.track?.no || 0) || 0;
      output.disc = Number(common.disk?.no || 0) || 0;

      const durationSeconds = Number(format.duration || 0);
      if (readDuration && Number.isFinite(durationSeconds) && durationSeconds > 0) {
        output.duration = Math.round(durationSeconds);
        output.durationMs = Math.round(durationSeconds * 1000);
        output.durationSource = "music-metadata";
      }

      if (readCover) {
        const picture = getPrimaryPicture(common);
        if (picture) {
          const coverPath = await saveEmbeddedCover(picture);
          if (coverPath) {
            output.embeddedCoverPath = coverPath;
            output.hasEmbeddedCover = true;
            output.coverSource = "embedded";
          } else incompleteCoverSnapshots.add(output);
        }
      }

      output.ok = true;
      output.source = "music-metadata";

      if (readDuration && (!output.durationMs || output.durationMs <= 0) && format.bitrate) {
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

  if (readDuration && (!output.durationMs || output.durationMs <= 0)) {
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

// Cache successful source tags only, keyed by file revision and parsing options.
async function readLocalAudioMetadata(filePath, options = {}) {
  const target = String(filePath || "").trim();
  let stat;
  try { stat = await fs.promises.stat(target); } catch {}
  if (!stat?.isFile() || !isAudioFile(target)) return readLocalAudioMetadataUncached(target, options);
  const key = crypto.createHash("sha256").update(JSON.stringify([target, stat.size, stat.mtimeMs, stat.ctimeMs, options.readCover !== false, options.readDuration !== false])).digest("hex");
  const cache = metadataCache;
  await cache.hydrate();
  const cached = cache.get(key);
  if (cached?.filePath === target && (!cached.embeddedCoverPath || fileExists(cached.embeddedCoverPath))) {
    return { ...cached };
  }
  let pending = metadataPending.get(key);
  if (!pending) {
    if (metadataPending.size >= 64) return withParseSlot(() => readLocalAudioMetadataUncached(target, options));
    pending = withParseSlot(() => readLocalAudioMetadataUncached(target, options)).then(async result => {
      const current = await fs.promises.stat(target).catch(() => null);
      if (result.ok && result.source === "music-metadata" && !result.error && !incompleteCoverSnapshots.has(result) &&
          (options.readDuration === false || result.durationMs > 0) &&
          current?.size === stat.size && current.mtimeMs === stat.mtimeMs && current.ctimeMs === stat.ctimeMs) {
        cache.set(key, { ...result }, METADATA_TTL);
      }
      return result;
    }).finally(() => metadataPending.delete(key));
    metadataPending.set(key, pending);
  }
  return { ...await pending };
}

// Async repair must never overwrite a relink or a newer user edit. Related
// cover and duration fields are guarded as units to avoid inconsistent pairs.
function guardMetadataRepairPatch(original, current, patch) {
  if (!current || current.id !== original.id || current.filePath !== original.filePath) return {};
  const guarded = {};
  const groups = [["title"], ["artist"], ["album"], ["genre"], ["duration", "durationMs"], ["coverPath", "coverSource", "coverUpdatedAt"]];
  for (const fields of groups) {
    if (fields.some(field => current[field] !== original[field])) continue;
    if (!fields.some(field => Object.hasOwn(patch, field) && patch[field] !== current[field])) continue;
    for (const field of fields) if (Object.hasOwn(patch, field)) guarded[field] = patch[field];
  }
  return guarded;
}

module.exports = {
  guardMetadataRepairPatch,
  initMetadataService,
  flushMetadataCache: () => metadataCache.flush(),
  readLocalAudioMetadata
};
