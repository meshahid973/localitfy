"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { createThumbnailScheduler } = require("./thumbnail-scheduler.cjs");
const { pruneThumbnails } = require("./thumbnail-retention.cjs");

// Size is part of the derived-cache identity. Existing 256px entries remain valid.
const THUMBNAIL_SIZES = new Set([96, 256, 512]);
const thumbnailSize = value => THUMBNAIL_SIZES.has(value) ? value : 256;
const jobKey = (file, size) => JSON.stringify([file, thumbnailSize(size)]);

function createThumbnailRuntime({
  getUserDataPath, getFileInfoCached, filePathKey, fileExists, isImageFile,
  safeMediaUrl, invalidateFileInfo, clearFileInfoCache, getFfmpegPath, getSongs,
  getSong, getRuntimeCoverPath, publish
}) {
  const COVER_THUMBNAIL_SIZE = 256;
  const COVER_THUMBNAIL_DIR_NAME = "thumbnails";
  const coverThumbnailUrlCache = new Map();
  const COVER_THUMBNAIL_URL_CACHE_LIMIT = 2048;
  function rememberCoverThumbnail(key, thumbnailPath) {
    coverThumbnailUrlCache.delete(key);
    coverThumbnailUrlCache.set(key, thumbnailPath);
    if (coverThumbnailUrlCache.size > COVER_THUMBNAIL_URL_CACHE_LIMIT) {
      coverThumbnailUrlCache.delete(coverThumbnailUrlCache.keys().next().value);
    }
  }
  const coverThumbnailQueue = createThumbnailScheduler({
    processFile: key => {
      const [file, size] = JSON.parse(key);
      return createCoverThumbnail(file, size);
    },
    onError: (error) => console.log("[localtify thumbnail queue error]", error?.message || error)
  });
  let coverThumbnailWarmStarted = false;
  let thumbnailGeneration = 0;
  const thumbnailJobs = new Map();
  let thumbnailPrune = null;
  let thumbnailWrites = 0;
  let preparedDirectory = "";
  let warmTimer = null;
  let stopped = false;
  let runningWarm = null;
  const encoders = new Set();
  function cancelEncoders() {
    for (const encoder of encoders) encoder.abort();
    encoders.clear();
  }

  function getCoverThumbnailDirectory() {
    try {
      const dir = path.join(getUserDataPath(), COVER_THUMBNAIL_DIR_NAME);
      if (preparedDirectory !== dir) {
        fs.mkdirSync(dir, { recursive: true });
        preparedDirectory = dir;
      }
      return dir;
    } catch (error) {
      console.log("[localtify thumbnails directory error]", error?.message || error);
      return "";
    }
  }

  function getCoverThumbnailCacheKey(filePath, size = COVER_THUMBNAIL_SIZE) {
    try {
      const info = getFileInfoCached(filePath);
      const signature = [filePathKey(String(filePath || "")), info.size || 0, Math.round(info.mtimeMs || 0), thumbnailSize(size)].join("|");
      return crypto.createHash("sha1").update(signature).digest("hex");
    } catch {
      return crypto.createHash("sha1").update(String(filePath || "") + "|" + thumbnailSize(size)).digest("hex");
    }
  }

  function getCoverThumbnailPath(filePath, size = COVER_THUMBNAIL_SIZE) {
    if (!filePath || !path.isAbsolute(filePath) || !isImageFile(filePath) || !fileExists(filePath)) return "";
    const dir = getCoverThumbnailDirectory();
    if (!dir) return "";
    return path.join(dir, `${getCoverThumbnailCacheKey(filePath, size)}.png`);
  }

  function scheduleThumbnailPrune() {
    if (thumbnailPrune) return thumbnailPrune;
    const maxBytes = Math.max(16, Math.min(1024, Number(process.env.LOCALTIFY_THUMBNAIL_CACHE_MB) || 256)) * 1024 * 1024;
    thumbnailPrune = pruneThumbnails(getCoverThumbnailDirectory(), {
      maxBytes, active: file => thumbnailJobs.has(file) || [...thumbnailJobs.keys()].some(key => file.startsWith(key + ".")),
      onRemove: file => invalidateFileInfo(file)
    }).catch(() => {}).finally(() => { thumbnailPrune = null; });
    return thumbnailPrune;
  }

  async function readableThumbnail(file) {
    let handle;
    try {
      handle = await fs.promises.open(file, "r");
      const {size} = await handle.stat();
      if (size < 33) return false;
      const lead = Buffer.alloc(8), tail = Buffer.alloc(12);
      await handle.read(lead, 0, 8, 0);
      await handle.read(tail, 0, 12, size - 12);
      return lead.equals(Buffer.from("89504e470d0a1a0a","hex")) && tail.equals(Buffer.from("0000000049454e44ae426082","hex"));
    } catch { return false; }
    finally { await handle?.close().catch(() => {}); }
  }

  // Decode and resize outside Electron's main process using the bundled FFmpeg.
  function createCoverThumbnail(filePath, requestedSize = COVER_THUMBNAIL_SIZE) {
    if (stopped) return Promise.resolve({ok:false,error:"Thumbnail runtime stopped."});
    const size = thumbnailSize(requestedSize);
    const thumbnailPath = getCoverThumbnailPath(filePath, size);
    if (!thumbnailPath) return Promise.resolve({ ok: false, error: "Cover unavailable." });
    const existing = thumbnailJobs.get(thumbnailPath);
    if (existing) return existing;
    if (thumbnailJobs.size >= 2) return Promise.resolve({ ok: false, error: "Thumbnail queue busy." });
    const generation = thumbnailGeneration;
    const task = (async () => {
      try {
        if (await readableThumbnail(thumbnailPath)) {
          invalidateFileInfo(thumbnailPath);
          if (generation !== thumbnailGeneration) return { ok: false, error: "Thumbnail invalidated." };
          const url = safeMediaUrl(thumbnailPath);
          if (url) publish({ source: safeMediaUrl(filePath), url, size });
          return { ok: true, sourcePath: filePath, thumbnailPath, cached: true, url, size };
        }
        const ffmpegPath = getFfmpegPath();
        if (!ffmpegPath || !fileExists(ffmpegPath)) return { ok: false, error: "Thumbnail encoder unavailable." };
        const temporary = thumbnailPath + "." + crypto.randomUUID() + ".part.png";
        const encoder = new AbortController();
        encoders.add(encoder);
        try {
          await fs.promises.mkdir(path.dirname(thumbnailPath), { recursive: true });
          await new Promise((resolve, reject) => execFile(ffmpegPath, [
            "-hide_banner", "-loglevel", "error", "-nostdin", "-threads", "1", "-i", filePath,
            "-map", "0:v:0", "-frames:v", "1", "-filter_threads", "1", "-vf",
            `scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2`,
            "-threads", "1", "-f", "image2", "-y", temporary
          ], { windowsHide: true, timeout: 12000, maxBuffer: 256 * 1024, signal: encoder.signal }, error => error ? reject(error) : resolve()));
          invalidateFileInfo(filePath);
          if (generation !== thumbnailGeneration || getCoverThumbnailPath(filePath, size) !== thumbnailPath) return { ok: false, error: "Thumbnail invalidated." };
          // Cleanup cannot interleave this small atomic publication operation.
          fs.renameSync(temporary, thumbnailPath);
        } finally { encoders.delete(encoder); await fs.promises.rm(temporary, { force: true }).catch(() => {}); }
        if (generation !== thumbnailGeneration) return { ok: false, error: "Thumbnail invalidated." };
        invalidateFileInfo(thumbnailPath);
        const url = safeMediaUrl(thumbnailPath);
        if (url) publish({ source: safeMediaUrl(filePath), url, size });
        if (++thumbnailWrites % 32 === 0) void scheduleThumbnailPrune();
        return { ok: true, sourcePath: filePath, thumbnailPath, cached: false, url, size };
      } catch (error) {
        if (generation === thumbnailGeneration) console.log("[localtify thumbnail create error]", error?.message || error);
        return { ok: false, error: "Thumbnail unavailable; original artwork remains available." };
      }
    })().finally(() => thumbnailJobs.delete(thumbnailPath));
    thumbnailJobs.set(thumbnailPath, task);
    return task;
  }

  function queueCoverThumbnail(filePath, lowPriority = false) {
    if (!filePath || !path.isAbsolute(filePath) || !isImageFile(filePath) || !fileExists(filePath)) return;
    const thumbnailPath = getCoverThumbnailPath(filePath);
    if (!thumbnailPath || fileExists(thumbnailPath)) return;
    coverThumbnailQueue.enqueue(jobKey(filePath, COVER_THUMBNAIL_SIZE), { lowPriority });
  }

  function getCoverThumbnailUrl(filePath) {
    if (!filePath || !path.isAbsolute(filePath) || !isImageFile(filePath) || !fileExists(filePath)) return "";
    const key = getCoverThumbnailCacheKey(filePath);
    const cached = coverThumbnailUrlCache.get(key);
    if (cached) {
      const freshUrl = safeMediaUrl(cached);
      if (freshUrl) {
        rememberCoverThumbnail(key, cached);
        return freshUrl;
      }
      coverThumbnailUrlCache.delete(key);
    }
    const thumbnailPath = getCoverThumbnailPath(filePath);
    if (thumbnailPath && fileExists(thumbnailPath)) {
      const url = safeMediaUrl(thumbnailPath);
      rememberCoverThumbnail(key, thumbnailPath);
      return url;
    }
    queueCoverThumbnail(filePath, true);
    return "";
  }

  function getCoverThumbnailStatus() {
    const dir = getCoverThumbnailDirectory();
    let count = 0;
    let sizeBytes = 0;
    try {
      if (dir && fs.existsSync(dir)) {
        for (const name of fs.readdirSync(dir)) {
          if (!/^[a-f0-9]{40}\.png$/.test(name)) continue;
          const filePath = path.join(dir, name);
          if (!fileExists(filePath)) continue;
          const info = getFileInfoCached(filePath);
          if (!info.isFile) continue;
          count += 1;
          sizeBytes += info.size || 0;
        }
      }
    } catch (error) {
      return { ok: false, directory: dir, count, sizeBytes, queued: coverThumbnailQueue.size, message: "Localtify could not read the thumbnail cache. Covers will still load normally.", error: error?.message || "thumbnail status failed" };
    }
    return { ok: true, directory: dir, count, sizeBytes, queued: coverThumbnailQueue.size, size: COVER_THUMBNAIL_SIZE, message: count ? `${count} small cover thumbnail${count === 1 ? "" : "s"} cached.` : "No cover thumbnails cached yet. Localtify will build them quietly as covers appear." };
  }

  function cleanupCoverThumbnailCache() {
    const dir = getCoverThumbnailDirectory();
    let removed = 0;
    let sizeBytes = 0;
    try {
      thumbnailGeneration++;
      cancelEncoders();
      if (warmTimer !== null) clearTimeout(warmTimer);
      warmTimer = null;
      coverThumbnailQueue.clear();
      coverThumbnailUrlCache.clear();
      if (dir && fs.existsSync(dir)) {
        for (const name of fs.readdirSync(dir)) {
          if (!/^[a-f0-9]{40}\.png$/.test(name)) continue;
          const filePath = path.join(dir, name);
          if (!fileExists(filePath)) continue;
          const info = getFileInfoCached(filePath);
          if (!info.isFile) continue;
          sizeBytes += info.size || 0;
          fs.rmSync(filePath, { force: true });
          removed += 1;
        }
      }
      clearFileInfoCache();
      return { ok: true, directory: dir, removed, sizeBytes, message: removed ? `Cleaned ${removed} cached cover thumbnail${removed === 1 ? "" : "s"}.` : "Cover cache is already clean." };
    } catch (error) {
      console.log("[localtify cover cache cleanup error]", error?.message || error);
      return { ok: false, directory: dir, removed, sizeBytes, error: error?.message || "cover cache cleanup failed", message: "Localtify could not clean the cover cache right now." };
    }
  }

  function warmCoverThumbnails(options = {}) {
    if (!runningWarm) runningWarm = warmCoverThumbnailsOnce(options).finally(() => { runningWarm = null; });
    return runningWarm;
  }

  async function warmCoverThumbnailsOnce({ limit = 80, force = false } = {}) {
    const generation = thumbnailGeneration;
    const songs = getSongs();
    const uniqueCoverPaths = new Set();
    for (const song of songs) {
      const coverPath = String(song?.coverPath || "").trim();
      if (!coverPath || !path.isAbsolute(coverPath) || !isImageFile(coverPath) || !fileExists(coverPath)) continue;
      uniqueCoverPaths.add(coverPath);
      if (uniqueCoverPaths.size >= limit) break;
    }

    let created = 0;
    let cached = 0;
    const warnings = [];
    for (const coverPath of uniqueCoverPaths) {
      if (stopped || generation !== thumbnailGeneration) break;
      const thumbnailPath = getCoverThumbnailPath(coverPath);
      if (thumbnailPath && fileExists(thumbnailPath) && !force) { cached += 1; continue; }
      const result = await createCoverThumbnail(coverPath);
      if (result.ok) {
        created += result.cached ? 0 : 1;
        if (result.cached) cached += 1;
      } else if (result.error) warnings.push(result.error);
    }

    return { ok: true, scanned: uniqueCoverPaths.size, created, cached, warnings: Array.from(new Set(warnings)).slice(0, 4), status: getCoverThumbnailStatus(), message: created ? `Cached ${created} cover thumbnail${created === 1 ? "" : "s"}.` : cached ? "Cover thumbnails are already ready." : "No custom covers needed thumbnail caching yet." };
  }

  function scheduleCoverThumbnailWarmup() {
    if (coverThumbnailWarmStarted) return;
    coverThumbnailWarmStarted = true;
    void scheduleThumbnailPrune();
    warmTimer = setTimeout(() => {
      warmTimer = null;
      try {
        const seen = new Set();
        for (const song of getSongs()) {
          const coverPath = String(song?.coverPath || "").trim();
          if (!coverPath || !path.isAbsolute(coverPath) || !isImageFile(coverPath) || !fileExists(coverPath) || seen.has(coverPath)) continue;
          seen.add(coverPath);
          queueCoverThumbnail(coverPath, true);
          if (seen.size >= 120) break;
        }
      } catch (error) { console.log("[localtify thumbnail warmup error]", error?.message || error); }
    }, 4500);
  }

    // Accept a library song ID, never a renderer-provided filesystem path.
    async function requestThumbnail(payload) {
      if (stopped || !payload || typeof payload.id !== "string" || typeof payload.source !== "string") return null;
      const song = getSong(payload.id);
      if (!song) return null;
      const file = getRuntimeCoverPath(song);
      if (!file || safeMediaUrl(file) !== payload.source) return null;
      const size = thumbnailSize(payload.size);
      const thumbnail = getCoverThumbnailPath(file, size);
      if (!thumbnail) return null;
      if (await readableThumbnail(thumbnail)) {
        const url = safeMediaUrl(thumbnail);
        if (url && payload.failed !== url) return { source: payload.source, url, size };
      }
      if (!thumbnailJobs.has(thumbnail)) {
        // No await between the active check and invalidation/publication decision.
        try { fs.rmSync(thumbnail, { force: true }); } catch {}
        invalidateFileInfo(thumbnail);
        coverThumbnailUrlCache.delete(getCoverThumbnailCacheKey(file, size));
        coverThumbnailQueue.enqueue(jobKey(file, size));
      }
      return null;
    }

  return {
    getCoverThumbnailUrl, getCoverThumbnailStatus, warmCoverThumbnails,
    cleanupCoverThumbnailCache, scheduleCoverThumbnailWarmup, requestThumbnail,
    queue: coverThumbnailQueue,
    clearUrlCache: () => coverThumbnailUrlCache.clear(),
    stop: () => {
      stopped = true;
      thumbnailGeneration++;
      cancelEncoders();
      if (warmTimer !== null) clearTimeout(warmTimer);
      warmTimer = null;
      coverThumbnailQueue.clear();
    }
  };
}
module.exports = { createThumbnailRuntime };
