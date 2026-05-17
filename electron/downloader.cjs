const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const sanitize = require("sanitize-filename");

const YTDlpWrapModule = require("yt-dlp-wrap");
const YTDlpWrap = YTDlpWrapModule.default ?? YTDlpWrapModule;

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

let _userDataPath = null;
let _ffmpegPath = ffmpegStatic || null;
let _ytDlpWrap = null;
let _getCookiesFile = null;

const MEDIA_EXTENSIONS = new Set([
  ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac",
  ".mp4", ".webm", ".mkv", ".mov", ".avi", ".m4v"
]);

function initDownloader({ userDataPath, ffmpegPath, getCookiesFile }) {
  _userDataPath = userDataPath;
  if (ffmpegPath) _ffmpegPath = ffmpegPath;
  if (getCookiesFile) _getCookiesFile = getCookiesFile;
}

function isSupportedMediaPath(filePath) {
  return MEDIA_EXTENSIONS.has(path.extname(filePath || "").toLowerCase());
}

function sanitizeFilename(name) {
  return sanitize(String(name || "audio"))
    .replace(/\s+/g, " ").trim().slice(0, 150) || "audio";
}

function uniquePath(directory, filename) {
  const parsed = path.parse(filename);
  let candidate = path.join(directory, filename);
  let count = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${parsed.name} (${count})${parsed.ext}`);
    count++;
  }
  return candidate;
}

function parseUrls(input) {
  if (Array.isArray(input)) return input.map(String).map(u => u.trim()).filter(Boolean);
  return String(input || "").split(/\r?\n/).map(u => u.trim()).filter(Boolean);
}

// ====================== YT-DLP SETUP ======================
async function getYtDlp() {
  if (_ytDlpWrap) return _ytDlpWrap;

  const binDir = path.join(_userDataPath || os.homedir(), "localitfy-bin");
  fs.mkdirSync(binDir, { recursive: true });

  const binaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const binaryPath = path.join(binDir, binaryName);

  if (!fs.existsSync(binaryPath)) {
    console.log("[localitfy] downloading yt-dlp binary...");
    await YTDlpWrap.downloadFromGithub(binaryPath);
    console.log("[localitfy] yt-dlp ready at", binaryPath);
  }

  _ytDlpWrap = new YTDlpWrap(binaryPath);
  return _ytDlpWrap;
}

// ====================== SPEED ARGS ======================
// These flags push yt-dlp to use every byte of available bandwidth.
function getBaseArgs(url, outputTemplate) {
  return [
    url,
    "--output", outputTemplate,

    // Best audio, prefer m4a/opus (already encoded — no re-encode cost)
    "--format", "bestaudio[ext=m4a]/bestaudio[ext=opus]/bestaudio/best",
    "--extract-audio",
    "--audio-format", "mp3",
    "--audio-quality", "192K",

    // ── MAX SPEED FLAGS ────────────────────────────────────────────────────
    // Download 16 fragments at the same time (DASH/HLS streams are split into
    // many small pieces — grabbing 16 in parallel saturates the connection)
    "--concurrent-fragments", "16",

    // 32 MB network read buffer — reduces kernel context switches
    "--buffer-size", "32M",

    // Each HTTP request fetches 10 MB at a time instead of small chunks
    "--http-chunk-size", "10M",

    // Skip writing the .part temp file — rename happens atomically at the end
    // instead of renaming every few seconds, saving disk I/O
    "--no-part",

    // Retry fast on transient errors instead of waiting
    "--retries", "5",
    "--fragment-retries", "5",
    "--retry-sleep", "linear=1::2",

    // Skip every unnecessary side-file write
    "--no-write-info-json",
    "--no-write-annotations",
    "--no-write-comments",
    "--no-mtime",
    "--no-playlist",
    "--no-warnings",
    "--no-colors",

    // Print progress to stdout in a parseable format so we can read speed/ETA
    "--newline",
  ];
}

function withFfmpeg(args) {
  if (_ffmpegPath) {
    return [...args, "--ffmpeg-location", path.dirname(_ffmpegPath)];
  }
  return args;
}

async function buildStrategies(url, outputTemplate) {
  const base = getBaseArgs(url, outputTemplate);
  const strategies = [];

  // Strategy 1 — Android + iOS mobile clients (no login, no bot detection)
  strategies.push({
    label: "mobile clients",
    args: withFfmpeg([
      ...base,
      "--extractor-args", "youtube:player_client=android,ios",
    ])
  });

  // Strategy 2 — TV embedded (good for age-restricted / region-locked)
  strategies.push({
    label: "tv_embedded client",
    args: withFfmpeg([
      ...base,
      "--extractor-args", "youtube:player_client=tv_embedded",
    ])
  });

  // Strategy 3 — Electron session cookies (if user visited YT in-app)
  if (_getCookiesFile) {
    try {
      const cookiesFile = await _getCookiesFile();
      if (cookiesFile && fs.existsSync(cookiesFile)) {
        strategies.push({
          label: "session cookies",
          args: withFfmpeg([...base, "--cookies", cookiesFile])
        });
      }
    } catch { /* non-fatal */ }
  }

  // Strategy 4 — installed browser cookies (last resort)
  const browsers = process.platform === "win32"
    ? ["chrome", "edge", "firefox"]
    : ["chrome", "firefox", "chromium"];

  for (const browser of browsers) {
    strategies.push({
      label: `${browser} cookies`,
      args: withFfmpeg([...base, "--cookies-from-browser", browser])
    });
  }

  return strategies;
}

// ====================== PROGRESS PARSING ======================
// yt-dlp prints lines like:
//   [download]  45.3% of 4.32MiB at   3.21MiB/s ETA 00:01
// yt-dlp-wrap exposes a "progress" event with { percent, totalSize, currentSpeed, eta }
// We normalise all of that into a single payload for the renderer.

function formatSpeed(raw) {
  // raw is a string like "3.21MiB/s" or a number of bytes/s — normalise to a
  // human-readable "X.XX MB/s" string.
  if (!raw) return null;

  if (typeof raw === "string") {
    // yt-dlp-wrap already formats it — just clean it up
    return raw.replace("MiB/s", " MB/s").replace("KiB/s", " KB/s").replace("GiB/s", " GB/s").trim();
  }

  // numeric bytes/s
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return null;
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB/s`;
  if (n >= 1_048_576)     return `${(n / 1_048_576).toFixed(2)} MB/s`;
  if (n >= 1_024)         return `${(n / 1_024).toFixed(1)} KB/s`;
  return `${n} B/s`;
}

function formatSize(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw.replace("MiB", " MB").replace("KiB", " KB").replace("GiB", " GB").trim();
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return null;
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  if (n >= 1_048_576)     return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1_024)         return `${(n / 1_024).toFixed(0)} KB`;
  return `${n} B`;
}

function buildProgressPayload(label, p) {
  const percent  = Math.min(100, Math.max(0, Math.floor(p?.percent ?? 0)));
  const speed    = formatSpeed(p?.currentSpeed);
  const size     = formatSize(p?.totalSize);
  const eta      = p?.eta ?? null;

  // Human-readable message shown in the UI
  let message = `Downloading... ${percent}%`;
  if (speed) message += `  •  ${speed}`;
  if (eta && eta !== "00:00") message += `  •  ETA ${eta}`;

  return {
    type: "download",
    file: label,
    progress: percent,
    speed,        // e.g. "3.21 MB/s"
    size,         // e.g. "4.32 MB"
    eta,          // e.g. "00:02"
    message
  };
}

// ====================== RUN YT-DLP ======================
function runYtDlp(ytDlp, args, onProgress, label) {
  return new Promise((resolve, reject) => {
    const proc = ytDlp.exec(args);

    proc.on("progress", (p) => {
      onProgress?.(buildProgressPayload(label, p));
    });

    proc.on("error", (err) => reject(new Error(err?.message || String(err))));
    proc.on("close", resolve);
  });
}

// ====================== YOUTUBE DOWNLOAD ======================
async function downloadYouTube(url, destinationDirectory, onProgress) {
  try {
    fs.mkdirSync(destinationDirectory, { recursive: true });

    const ytDlp = await getYtDlp();

    // %(title)s baked into the template — no separate getVideoInfo() round-trip
    const tempId = crypto.randomUUID().slice(0, 8);
    const outputTemplate = path.join(destinationDirectory, `ytdl_${tempId}_%(title)s.%(ext)s`);

    onProgress?.({
      type: "download",
      file: "track",
      progress: 0,
      speed: null,
      size: null,
      eta: null,
      message: "Starting download..."
    });

    const strategies = await buildStrategies(url, outputTemplate);
    let lastError = null;

    for (const strategy of strategies) {
      try {
        console.log(`[localitfy] trying: ${strategy.label}`);
        await runYtDlp(ytDlp, strategy.args, onProgress, "track");
        console.log(`[localitfy] success: ${strategy.label}`);
        lastError = null;
        break;
      } catch (err) {
        console.log(`[localitfy] failed "${strategy.label}":`, err?.message);
        lastError = err;
      }
    }

    if (lastError) {
      throw new Error("Download failed after trying all methods. The video may be private or unavailable.");
    }

    // Locate output file by tempId prefix
    const allFiles = fs.readdirSync(destinationDirectory);
    const downloaded =
      allFiles.find((f) => f.startsWith(`ytdl_${tempId}_`) && f.endsWith(".mp3")) ??
      allFiles.find((f) => f.startsWith(`ytdl_${tempId}_`));

    if (!downloaded) throw new Error("yt-dlp finished but output file not found");

    const rawTitle = downloaded.replace(`ytdl_${tempId}_`, "").replace(/\.[^.]+$/, "");
    const safeTitle = sanitizeFilename(rawTitle) || "youtube-audio";
    const ext = path.extname(downloaded);
    const sourcePath = path.join(destinationDirectory, downloaded);
    const finalPath = uniquePath(destinationDirectory, `${safeTitle}${ext}`);
    fs.renameSync(sourcePath, finalPath);

    onProgress?.({
      type: "download",
      file: safeTitle,
      progress: 100,
      speed: null,
      size: null,
      eta: null,
      message: "Done"
    });

    return { ok: true, filePath: finalPath, filename: path.basename(finalPath) };

  } catch (error) {
    return { ok: false, url, error: error.message || "YouTube download failed" };
  }
}

// ====================== CONVERSION ======================
function convertOneToMp3(inputPath, outputDirectory, bitrate = 192, onProgress, deleteAfter = false) {
  return new Promise((resolve) => {
    if (!fs.existsSync(inputPath)) {
      return resolve({ ok: false, error: "File not found" });
    }

    const baseName = sanitizeFilename(path.parse(inputPath).name);
    const outputPath = uniquePath(outputDirectory, `${baseName}.mp3`);

    onProgress?.({
      type: "convert",
      file: baseName,
      progress: 0,
      speed: null,
      message: "Converting to MP3..."
    });

    ffmpeg(inputPath)
      .audioBitrate(bitrate)
      .noVideo()
      .format("mp3")
      .outputOptions(["-threads", "0"])
      .on("progress", (p) => {
        const percent = Math.floor(p.percent || 0);
        const kbps = p.currentKbps ? `${Math.round(p.currentKbps)} kbps` : null;
        onProgress?.({
          type: "convert",
          file: baseName,
          progress: percent,
          speed: kbps,
          message: `Converting... ${percent}%${kbps ? `  •  ${kbps}` : ""}`
        });
      })
      .on("end", () => {
        if (deleteAfter) { try { fs.unlinkSync(inputPath); } catch { /* ignore */ } }
        onProgress?.({ type: "convert", file: baseName, progress: 100, speed: null, message: "Done" });
        resolve({ ok: true, filePath: outputPath, filename: path.basename(outputPath) });
      })
      .on("error", (err) => resolve({ ok: false, error: err.message }))
      .save(outputPath);
  });
}

// ====================== PUBLIC API ======================
async function downloadAudioUrls(input, destinationDirectory, onProgress) {
  const urls = parseUrls(input);

  // Download up to 3 URLs concurrently
  const CONCURRENCY = 3;
  const results = new Array(urls.length);

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((url) => {
        const isYouTube = /youtube\.com\/watch|youtu\.be\//.test(url);
        return isYouTube
          ? downloadYouTube(url, destinationDirectory, onProgress)
          : Promise.resolve({ ok: false, url, error: "Only YouTube URLs are supported" });
      })
    );
    batchResults.forEach((r, j) => { results[i + j] = r; });
  }

  return { downloadFolder: destinationDirectory, downloads: results };
}

async function convertLocalMediaFiles(filePaths, destinationDirectory, options = {}, onProgress) {
  const bitrate = Number(options.bitrate || 192);
  const results = [];
  for (const file of filePaths) {
    results.push(await convertOneToMp3(file, destinationDirectory, bitrate, onProgress));
  }
  return { downloadFolder: destinationDirectory, conversions: results };
}

module.exports = {
  initDownloader,
  downloadAudioUrls,
  convertLocalMediaFiles,
  convertOneToMp3,
  isSupportedMediaPath
};
