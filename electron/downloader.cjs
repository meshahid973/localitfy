const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ffmpegStatic = require("ffmpeg-static");
const sanitize = require("sanitize-filename");
const { ensureYtDlpBinary, spawnYtDlp } = require("./runtime/yt-dlp.cjs");
const { createDownloadJobStore } = require("./download-jobs.cjs");
const { publishDownloadedFile, isPendingPublication } = require("./download-publication.cjs");
const { filePathKey } = require("./runtime/path-identity.cjs");
const { createMediaConverter } = require("./media-converter.cjs");
const { createYouTubeMusicSearch, isJunkVideo, exactMusicCandidate } = require("./discover/youtube-music.cjs");
const searchMusicCatalog = createYouTubeMusicSearch();

let _userDataPath = null;
let _ffmpegPath = ffmpegStatic || null;
let _ytDlpBinaryPath = null;
const activeDownloadProcesses = new Set();
let activeDownloadCancelled = false;
let activeDownloadInterrupted = false;
let activeBatch = false;
let activeDownloadOperation = false;
let downloadJobs = null;
let downloadStorageError = "";
let mediaConverter = null;
const batchJobIds = new Set();
const progressSavedAt = new Map();

/** Keep the operation locked until its library import has committed as well. */
async function runDownloadOperation(work) {
  if (activeDownloadOperation) throw new Error("A download or conversion is already running");
  activeDownloadOperation = true;
  try { return await work(); } finally { activeDownloadOperation = false; }
}

async function runDownloadBatch(work) {
  if (activeBatch) throw new Error("A download or conversion is already running");
  activeBatch = true;
  activeDownloadCancelled = false;
  activeDownloadInterrupted = false;
  batchJobIds.clear();
  try { return await work(); } finally {
    for (const id of batchJobIds) {
      const job = downloadJobs?.get(id);
      if (["queued", "downloading", "converting", "importing"].includes(job?.status) && !(job.status === "importing" && job.result?.ok)) {
        try { downloadJobs.update(id, { status: activeDownloadCancelled && !activeDownloadInterrupted ? "cancelled" : "interrupted", message: activeDownloadCancelled && !activeDownloadInterrupted ? "Download cancelled" : "Download interrupted. Resume when ready." }); }
        catch (error) { console.error("[localtify download checkpoint]", error.message); }
      }
    }
    batchJobIds.clear();
    progressSavedAt.clear();
    activeBatch = false;
  }
}

const MEDIA_EXTENSIONS = new Set([
  ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".opus", ".aiff", ".aif",
  ".mp4", ".webm", ".mkv", ".mov", ".avi", ".m4v"
]);

function initDownloader({ userDataPath, ffmpegPath }) {
  _userDataPath = userDataPath;
  if (ffmpegPath) _ffmpegPath = ffmpegPath;
  try { downloadJobs = createDownloadJobStore(userDataPath); downloadStorageError = ""; }
  catch (error) { downloadStorageError = String(error?.message || error); console.error("[localtify download recovery]", downloadStorageError); }
  try { mediaConverter = createMediaConverter({ workRoot: path.join(userDataPath, "download-jobs"), getFfmpegPath: () => _ffmpegPath,
    processes: activeDownloadProcesses, isCancelled: () => activeBatch && activeDownloadCancelled, reportProgress }); }
  catch (error) { mediaConverter = null; console.error("[localtify conversion storage]", error.message); }
}

function prepareDownloadJob(request) {
  if (!downloadJobs || downloadStorageError) throw new Error(downloadStorageError || "Download recovery storage is not initialized");
  const job = downloadJobs.prepare(request);
  batchJobIds.add(job.id);
  return job;
}

function listDownloadJobs() {
  return { error: downloadStorageError, jobs: downloadJobs ? downloadJobs.list().map(job => ({
    id: job.id, recoveryId: job.id, url: job.request.url, source: job.request.source,
    spotifyTrackId: job.request.track?.id, title: job.request.track?.title || job.result?.filename || "Saved download",
    status: job.status, progress: job.progress, message: job.message,
    filePath: job.result?.filePath, filename: job.result?.filename, error: job.result?.error
  })) : [] };
}

function getDownloadRecoveryRequest(id) {
  const job = downloadJobs?.get(String(id));
  if (!job) throw new Error("Saved download not found");
  if (["queued", "downloading", "converting", "importing"].includes(job.status)) throw new Error("This download is already running");
  return job.request;
}

function clearDownloadJobs(ids) {
  if (!Array.isArray(ids) || ids.length > 500 || ids.some(id => typeof id !== "string")) throw new Error("Invalid saved download selection");
  if (ids.some(id => ["queued", "downloading", "converting", "importing"].includes(downloadJobs?.get(id)?.status))) throw new Error("Cancel the active download before removing it");
  for (const id of ids) downloadJobs?.remove(id);
  return true;
}

function recordDownloadResult(job, result) {
  if (!job?.recoveryId || !downloadJobs) return;
  const importPending = result.ok && downloadJobs.get(job.recoveryId)?.request.options.autoAdd !== false;
  const status = result.ok ? importPending ? "importing" : "done" : activeDownloadInterrupted ? "interrupted" : /cancel/i.test(result.error || "") ? "cancelled" : "failed";
  let identity = {};
  if (result.ok) { const stat = fs.statSync(result.filePath); identity = { sizeBytes: stat.size, mtimeMs: stat.mtimeMs }; }
  downloadJobs.update(job.recoveryId, { status, result, ...identity, importPending, progress: result.ok ? 100 : 0, message: result.ok ? importPending ? "Adding saved audio to library" : "Downloaded" : result.error });
  if (result.ok || status === "cancelled") downloadJobs.cleanWorkDirectory(job.recoveryId);
}

function completeDownloadImports(results, songs, error = "") {
  const byPath = new Map((songs || []).map(song => [filePathKey(song.filePath), song]));
  for (const item of results || []) {
    if (!item?.ok || !item.recoveryId) continue;
    const job = downloadJobs?.get(item.recoveryId);
    if (!job) continue;
    const song = byPath.get(filePathKey(item.filePath));
    downloadJobs.update(job.id, {
      status: error ? "interrupted" : "done", importPending: Boolean(error), progress: 100,
      pendingOutput: null,
      message: error ? "Audio saved. Resume to finish adding it to the library." : song ? "Added to library" : "Downloaded",
      result: { ...job.result, importedToLibrary: Boolean(song), librarySongId: song?.id || "", error: error || undefined }
    });
  }
}

function isDownloadFileInProgress(filename) {
  if (isPendingPublication(filename)) return true;
  if (!_userDataPath || typeof filename !== "string" || !path.isAbsolute(filename)) return false;
  const relative = path.relative(path.join(_userDataPath, "download-jobs"), filename);
  return relative === "" || !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function reportProgress(callback, payload) {
  try { callback?.(payload); }
  catch (error) { console.warn("[localtify download progress listener]", error?.message || error); }
}

function isSupportedMediaPath(filePath) {
  return MEDIA_EXTENSIONS.has(path.extname(filePath || "").toLowerCase());
}

function sanitizeFilename(name) {
  return sanitize(String(name || "audio"))
    .replace(/\s+/g, " ").trim().slice(0, 150) || "audio";
}

/** Accept only real YouTube video URLs; never forward untrusted option-like text to yt-dlp. */
function normalizeYouTubeUrl(input) {
  let parsed;
  try { parsed = new URL(String(input || "").trim()); } catch { return ""; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return "";
  const host = parsed.hostname.toLowerCase();
  let videoId = "";
  if (host === "youtu.be") {
    const match = /^\/([a-zA-Z0-9_-]{11})\/?$/.exec(parsed.pathname);
    if (!match) return "";
    videoId = match[1];
  } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(host) && parsed.pathname === "/watch") {
    videoId = parsed.searchParams.get("v") || "";
  } else {
    return "";
  }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return "";
  return "https://www.youtube.com/watch?v=" + videoId;
}

function parseUrls(input) {
  if (Array.isArray(input)) return input.map(String).map(u => u.trim()).filter(Boolean);
  return String(input || "").split(/\r?\n/).map(u => u.trim()).filter(Boolean);
}

function getOptInBrowserCookieSource() {
  if (process.env.LOCALTIFY_ALLOW_BROWSER_COOKIES !== "1") return "";
  const requested = String(process.env.LOCALTIFY_BROWSER_COOKIE_SOURCE || "").trim().toLowerCase();
  const allowed = process.platform === "win32"
    ? ["chrome", "edge", "firefox"]
    : ["chrome", "firefox", "chromium"];
  return allowed.includes(requested) ? requested : "";
}

async function getYtDlp() {
  if (_ytDlpBinaryPath && fs.existsSync(_ytDlpBinaryPath)) return _ytDlpBinaryPath;
  const resolved = await ensureYtDlpBinary({ userDataPath: _userDataPath });
  _ytDlpBinaryPath = resolved.path;
  return _ytDlpBinaryPath;
}

function safeDownloadFormat(value) {
  const next = String(value || "mp3").toLowerCase();
  return ["mp3", "flac", "wav", "m4a"].includes(next) ? next : "mp3";
}

function safeDownloadQuality(value) {
  const next = String(value || "best").toLowerCase();
  if (next === "320") return "320K";
  if (next === "256") return "256K";
  if (next === "192") return "192K";
  return "0";
}

function cleanDownloadedTitle(name) {
  return sanitizeFilename(name)
    .replace(/\s*\[(official\s+)?(music\s+)?video\]\s*/gi, " ")
    .replace(/\s*\((official\s+)?(music\s+)?video\)\s*/gi, " ")
    .replace(/\s*\[(official\s+)?audio\]\s*/gi, " ")
    .replace(/\s*\((official\s+)?audio\)\s*/gi, " ")
    .replace(/\s*lyrics?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || "audio";
}

// Opus (format 251, ~130-160k, 48 kHz) is YouTube's best free audio stream; AAC 140 is the
// fallback. Never fall back to "best": that is the muxed 360p video (format 18) whose audio
// is a low-bitrate 22 kHz AAC track.
const AUDIO_FORMAT_SELECTOR = "bestaudio[acodec=opus]/bestaudio[ext=m4a]/bestaudio";
// Preserve only codecs that can be saved unchanged as .opus or .m4a.
const ORIGINAL_AUDIO_FORMAT_SELECTOR = "bestaudio[acodec=opus]/bestaudio[ext=m4a]";

function getAudioOutputArgs(options = {}) {
  // Keep original: yt-dlp only remuxes (webm -> .opus, m4a stays .m4a), no second lossy encode.
  if (options.keepOriginal === true) return ["--extract-audio", "--audio-format", "best"];
  return [
    "--extract-audio",
    "--audio-format", safeDownloadFormat(options.format),
    "--audio-quality", safeDownloadQuality(options.quality),
  ];
}

function getBaseArgs(url, outputTemplate, options = {}) {
  return [
    url,
    "--output", outputTemplate,
    "--format", options.keepOriginal === true ? ORIGINAL_AUDIO_FORMAT_SELECTOR : AUDIO_FORMAT_SELECTOR,
    ...getAudioOutputArgs(options),
    "--concurrent-fragments", "16",
    "--buffer-size", "32M",
    "--http-chunk-size", "10M",
    "--part",
    "--continue",
    "--retries", "5",
    "--fragment-retries", "5",
    "--retry-sleep", "linear=1::2",
    "--no-write-info-json",
    "--no-write-annotations",
    "--no-write-comments",
    "--no-mtime",
    "--no-playlist",
    "--no-warnings",
    "--no-colors",
    "--newline",
  ];
}

function withFfmpeg(args) {
  if (_ffmpegPath) return [...args, "--ffmpeg-location", path.dirname(_ffmpegPath)];
  return args;
}

async function buildStrategies(url, outputTemplate, options = {}) {
  const base = getBaseArgs(url, outputTemplate, options);
  const strategies = [];

  // yt-dlp's default clients get the full audio-only format list. The android/ios clients are
  // now limited to format 18, so they come last and only as a fallback.
  strategies.push({
    label: "default clients",
    args: withFfmpeg(base)
  });

  strategies.push({
    label: "tv_embedded client",
    args: withFfmpeg([...base, "--extractor-args", "youtube:player_client=tv_embedded"])
  });

  strategies.push({
    label: "mobile clients",
    args: withFfmpeg([...base, "--extractor-args", "youtube:player_client=android,ios"])
  });

  const browserCookieSource = getOptInBrowserCookieSource();
  if (browserCookieSource) {
    strategies.push({
      label: browserCookieSource + " cookies (explicit opt-in)",
      args: withFfmpeg([...base, "--cookies-from-browser", browserCookieSource])
    });
  }

  return strategies;
}

function formatSpeed(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw.replace("MiB/s", " MB/s").replace("KiB/s", " KB/s").replace("GiB/s", " GB/s").trim();
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return null;
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB/s`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(2)} MB/s`;
  if (n >= 1_024) return `${(n / 1_024).toFixed(1)} KB/s`;
  return `${n} B/s`;
}

function formatSize(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw.replace("MiB", " MB").replace("KiB", " KB").replace("GiB", " GB").trim();
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return null;
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1_024) return `${(n / 1_024).toFixed(0)} KB`;
  return `${n} B`;
}

function buildProgressPayload(job, p) {
  const percent = Math.min(99, Math.max(0, Math.floor(p?.percent ?? 0)));
  const speed = formatSpeed(p?.currentSpeed);
  const size = formatSize(p?.totalSize);
  const eta = p?.eta ?? null;
  let message = "Downloading audio...";
  if (percent >= 99) message = job.keepOriginal ? "Saving original audio..." : `Converting to ${String(job.format || "mp3").toUpperCase()}...`;
  if (speed) message += `  •  ${speed}`;
  if (eta && eta !== "00:00") message += `  •  ETA ${eta}`;

  return {
    type: "download",
    status: percent >= 99 ? "converting" : "downloading",
    id: job.id,
    recoveryId: job.recoveryId,
    url: job.url,
    spotifyTrackId: job.spotifyTrackId,
    spotifyUrl: job.spotifyUrl,
    source: job.source,
    provider: job.provider,
    providerUrl: job.providerUrl,
    index: job.index,
    total: job.total,
    file: job.file || "track",
    progress: percent,
    speed,
    size,
    eta,
    message
  };
}

function parseYtDlpProgressLine(line) {
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
    if (activeDownloadCancelled) return reject(new Error("Download cancelled"));
    const proc = spawnYtDlp(ytDlp, args);
    activeDownloadProcesses.add(proc);
    let outputBuffer = "";

    const consume = (chunk) => {
      outputBuffer += chunk.toString();
      const lines = outputBuffer.split(/\r?\n/);
      outputBuffer = lines.pop() || "";
      for (const line of lines) {
        const progress = parseYtDlpProgressLine(line);
        if (progress) {
          const payload = buildProgressPayload(job, progress);
          if (job.recoveryId && Date.now() - (progressSavedAt.get(job.recoveryId) || 0) >= 1000) {
            try { downloadJobs.update(job.recoveryId, { status: payload.status, progress: payload.progress, message: payload.message }); progressSavedAt.set(job.recoveryId, Date.now()); }
            catch (error) { proc.kill(); return reject(error); }
          }
          reportProgress(onProgress, payload);
        }
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
      if (code !== 0) return reject(new Error(`yt-dlp exited with code ${code ?? "unknown (terminated)"}`));
      resolve();
    });
  });
}

async function downloadYouTube(url, destinationDirectory, onProgress, options = {}, job = {}) {
  let tempId;
  let workingDirectory = destinationDirectory;
  try {
    if (activeDownloadCancelled) throw new Error("Download cancelled");
    fs.mkdirSync(destinationDirectory, { recursive: true });

    const ytDlp = await getYtDlp();
    const format = safeDownloadFormat(options.format);
    tempId = job.recoveryId || crypto.randomUUID();
    if (job.recoveryId) {
      workingDirectory = downloadJobs.workDirectory(job.recoveryId);
      fs.mkdirSync(workingDirectory, { recursive: true });
      downloadJobs.update(job.recoveryId, { status: "downloading", message: "Downloading audio" });
    }
    const outputTemplate = path.join(workingDirectory, `ytdl_${tempId}_%(title)s.%(ext)s`);

    reportProgress(onProgress, {
      type: "download",
      status: "downloading",
      id: job.id,
      recoveryId: job.recoveryId,
      url,
      index: job.index,
      total: job.total,
      file: "track",
      progress: 1,
      speed: null,
      size: null,
      eta: null,
      message: "Downloading audio..."
    });

    const strategies = await buildStrategies(url, outputTemplate, { ...options, format });
    let lastError = null;

    for (const strategy of strategies) {
      try {
        console.log(`[localitfy] trying: ${strategy.label}`);
        await runYtDlp(ytDlp, strategy.args, onProgress, { ...job, url, file: "track", format, keepOriginal: options.keepOriginal === true });
        console.log(`[localitfy] success: ${strategy.label}`);
        lastError = null;
        break;
      } catch (err) {
        console.log(`[localitfy] failed "${strategy.label}":`, err?.message);
        lastError = err;
        if (String(err?.message || "").toLowerCase().includes("cancel")) throw err;
      }
    }

    if (lastError) throw new Error("Download failed after trying all methods. The video may be private or unavailable.");

    const allFiles = fs.readdirSync(workingDirectory);
    const downloaded =
      allFiles.find((f) => f.startsWith(`ytdl_${tempId}_`) && f.endsWith(`.${format}`)) ??
      allFiles.find((f) => f.startsWith(`ytdl_${tempId}_`) && isSupportedMediaPath(f) && !/\.part\b/i.test(f));

    if (!downloaded || !fs.statSync(path.join(workingDirectory, downloaded)).size) throw new Error("yt-dlp finished but usable output file not found");

    const rawTitle = downloaded.replace(`ytdl_${tempId}_`, "").replace(/\.[^.]+$/, "");
    const safeTitle = job.outputName ? sanitizeFilename(job.outputName) : options.cleanTitle === false ? sanitizeFilename(rawTitle) : cleanDownloadedTitle(rawTitle);
    const ext = path.extname(downloaded) || `.${format}`;
    const sourcePath = path.join(workingDirectory, downloaded);
    const savedFormat = ext.slice(1).toLowerCase() || format;
    const finalPath = await publishDownloadedFile(sourcePath, destinationDirectory, `${safeTitle}${ext}`, identity => {
      if (activeDownloadCancelled) throw new Error("Download cancelled");
      if (job.recoveryId) downloadJobs.update(job.recoveryId, {
        status: "importing", ...identity,
        result: { ...job.resultMetadata, ok: true, url: job.resultMetadata?.url || url, filePath: identity.filePath, filename: identity.filename, format: savedFormat, recoveryId: job.recoveryId }
      });
    }, job.recoveryId);
    try { fs.unlinkSync(sourcePath); } catch (error) { console.warn("[localtify downloaded source cleanup]", error.message); }

    reportProgress(onProgress, {
      type: "download",
      status: options.autoAdd === false ? "done" : "importing",
      id: job.id,
      url,
      index: job.index,
      total: job.total,
      file: safeTitle,
      progress: 100,
      speed: null,
      size: null,
      eta: null,
      message: "Adding to library..."
    });

    return { ok: true, url, filePath: finalPath, filename: path.basename(finalPath), format: savedFormat };
  } catch (error) {
    const message = error?.message || "YouTube download failed";
    return { ok: false, url, error: message };
  } finally {
    if (tempId && !job.recoveryId) {
      try { for (const name of fs.readdirSync(workingDirectory)) {
        if (name.startsWith(`ytdl_${tempId}_`)) fs.rmSync(path.join(workingDirectory, name), { force: true });
      } } catch (error) { console.warn("[localtify] download cleanup:", error?.message || error); }
    }
  }
}

async function convertOneToMp3(inputPath, outputDirectory, bitrate = 192, onProgress) {
  if (!mediaConverter) return { ok: false, sourcePath: inputPath, error: "Conversion storage is unavailable. Restart the application after checking storage permissions." };
  return mediaConverter.convert(inputPath, outputDirectory, bitrate, onProgress);
}

function normalizeSpotifyMatchText(value = "") {
  return String(value || "").normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’'`´]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(feat|ft|featuring)\.?\b/g, " ")
    .replace(/[()\[\]{}]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function spotifyMatchWords(value = "") {
  return normalizeSpotifyMatchText(value)
    .split(" ")
    .filter((word) => word.length > 1);
}

function spotifyWordOverlapRatio(wanted = "", candidate = "") {
  const wantedWords = new Set(spotifyMatchWords(wanted).filter((word) => word.length > 2));
  const candidateWords = new Set(spotifyMatchWords(candidate).filter((word) => word.length > 2));

  if (!wantedWords.size) return 0;

  let overlap = 0;
  for (const word of wantedWords) {
    if (candidateWords.has(word)) overlap += 1;
  }

  return overlap / wantedWords.size;
}

function hasHardSpotifyRejectWord(track = {}, candidate = {}) {
  const wantedRaw = normalizeSpotifyMatchText(`${track.title || track.name || ""} ${track.artist || track.artists || ""}`);
  const candidateRaw = normalizeSpotifyMatchText(`${candidate.title || candidate.fulltitle || ""} ${candidate.uploader || candidate.channel || candidate.creator || ""}`);

  for (const word of SPOTIFY_BAD_CANDIDATE_WORDS) {
    const badKey = normalizeSpotifyMatchText(word);
    if (badKey && candidateRaw.includes(badKey) && !wantedRaw.includes(badKey)) return true;
  }

  return false;
}

function getSpotifyTrackId(track = {}) {
  return String(track?.spotifyTrackId || track?.id || track?.trackId || "").trim();
}

function getSpotifyTrackUrl(track = {}) {
  const chosen = require("./discover/track-identity.cjs").selectedYouTubeUrl(getSpotifyTrackId(track));
  if (chosen) return chosen;
  const explicit = String(track.spotifyUrl || track.url || "").trim();
  const trackId = getSpotifyTrackId(track);
  if (/^https:\/\/open\.spotify\.com\/track\//i.test(explicit)) return explicit;
  return trackId ? `https://open.spotify.com/track/${trackId}` : explicit;
}

function buildSpotifySearchQueries(track = {}) {
  const title = String(track.title || track.name || "unknown track").trim();
  const artist = String(track.artist || track.artists || "").trim();
  const isrc = String(track.isrc || "").trim();
  const queries = [];

  const push = (query) => {
    const value = String(query || "").replace(/\s+/g, " ").trim();
    if (value && !queries.includes(value)) queries.push(value);
  };

  if (isrc) push(`${artist ? `${artist} ` : ""}${title} ${isrc} official audio`);
  if (artist) {
    push(`${artist} - ${title} official audio`);
    push(`${artist} ${title} audio`);
    push(`${artist} ${title}`);
  }

  push(`${title} official audio`);
  push(`${title} audio`);
  push(`${title} song`);
  push(`${title} music`);
  push(title);

  return queries;
}

function getCandidateUrl(candidate = {}) {
  const direct =
    candidate.webpage_url ||
    candidate.webpageUrl ||
    candidate.original_url ||
    candidate.url ||
    candidate.id;

  const value = String(direct || "").trim();
  if (/^https?:\/\//i.test(value)) return value;

  const id = String(candidate.id || "").trim();
  if (id) return `https://www.youtube.com/watch?v=${id}`;

  return value;
}

function runYtDlpJson(ytDlp, args) {
  return new Promise((resolve, reject) => {
    if (activeDownloadCancelled) return reject(new Error("Download cancelled"));
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

function parseYtDlpJsonLines(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];

  const candidates = [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.entries)) return parsed.entries.filter(Boolean);
    if (parsed && typeof parsed === "object") return [parsed];
  } catch {
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed?.entries)) candidates.push(...parsed.entries.filter(Boolean));
      else if (parsed && typeof parsed === "object") candidates.push(parsed);
    } catch {
    }
  }

  return candidates;
}

async function searchSpotifyYoutubeCandidates(track, limit = 8) {
  const ytDlp = await getYtDlp();
  const queries = buildSpotifySearchQueries(track);
  const searchLimit = Math.max(5, Math.min(12, Number(limit) || 8));
  const seen = new Set();
  const allCandidates = [];
  let lastError = null;

  for (const query of queries) {
    const searchUrl = `ytsearch${searchLimit}:${query}`;
    const baseArgs = [
      searchUrl,
      "--dump-json",
      "--flat-playlist",
      "--no-warnings",
      "--no-colors",
      "--ignore-errors"
    ];

    const attempts = [baseArgs];

    const browserCookieSource = getOptInBrowserCookieSource();
    if (browserCookieSource) {
      attempts.push([...baseArgs, "--cookies-from-browser", browserCookieSource]);
    }

    for (const args of attempts) {
      try {
        const stdout = await runYtDlpJson(ytDlp, args);
        const candidates = parseYtDlpJsonLines(stdout)
          .map((candidate) => ({
            ...candidate,
            providerUrl: getCandidateUrl(candidate),
            searchQuery: query
          }))
          .filter((candidate) => candidate.providerUrl);

        for (const candidate of candidates) {
          const key = String(candidate.providerUrl || candidate.id || "").trim();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          allCandidates.push(candidate);
        }

        if (allCandidates.length >= searchLimit) return allCandidates;
      } catch (error) {
        lastError = error;
        if (String(error?.message || "").toLowerCase().includes("cancel")) throw error;
      }
    }
  }

  if (lastError && !allCandidates.length) {
    console.log("[localtify spotify] candidate search failed:", lastError?.message || lastError);
  }

  return allCandidates;
}

const SPOTIFY_BAD_CANDIDATE_WORDS = [
  "slowed",
  "sped up",
  "speed up",
  "nightcore",
  "remix",
  "mashup",
  "live",
  "concert",
  "karaoke",
  "instrumental",
  "cover",
  "reaction",
  "shorts",
  "edit audio",
  "bass boosted",
  "8d audio"
];

function scoreSpotifyYoutubeCandidate(track = {}, candidate = {}) {
  const wantedTitle = String(track.title || track.name || "").trim();
  const wantedArtist = String(track.artist || track.artists || "").trim();
  const wantedCombined = normalizeSpotifyMatchText(`${wantedArtist} ${wantedTitle}`);
  const candidateTitle = String(candidate.title || candidate.fulltitle || "").trim();
  const candidateUploader = String(candidate.uploader || candidate.channel || candidate.creator || "").trim();
  const candidateCombined = normalizeSpotifyMatchText(`${candidateTitle} ${candidateUploader}`);

  let score = 0;
  const reasons = [];

  const titleKey = normalizeSpotifyMatchText(wantedTitle);
  const artistKey = normalizeSpotifyMatchText(wantedArtist);

  if (titleKey && candidateCombined.includes(titleKey)) {
    score += 28;
    reasons.push("title");
  }

  if (artistKey && candidateCombined.includes(artistKey)) {
    score += 24;
    reasons.push("artist");
  }

  const ratio = spotifyWordOverlapRatio(wantedCombined, candidateCombined);

  if (ratio > 0) {
    score += Math.round(ratio * 30);
    if (ratio >= 0.65) reasons.push("word-overlap");
  }

  const expectedDurationSeconds = Number(track.durationMs || 0) > 0
    ? Number(track.durationMs) / 1000
    : Number(track.duration || 0);
  const candidateDurationSeconds = Number(candidate.duration || 0);

  if (expectedDurationSeconds > 0 && candidateDurationSeconds > 0) {
    const diff = Math.abs(expectedDurationSeconds - candidateDurationSeconds);
    if (diff <= 3) {
      score += 26;
      reasons.push("duration-exact");
    } else if (diff <= 8) {
      score += 18;
      reasons.push("duration-close");
    } else if (diff <= 15) {
      score += 8;
      reasons.push("duration-ok");
    } else if (diff > 25) {
      score -= 26;
      reasons.push("duration-mismatch");
    }
  }

  if (/\bofficial\b|\baudio\b|\btopic\b/i.test(`${candidateTitle} ${candidateUploader}`)) {
    score += 8;
    reasons.push("official-audio");
  }

  const wantedRaw = normalizeSpotifyMatchText(`${wantedTitle} ${wantedArtist}`);
  const candidateRaw = normalizeSpotifyMatchText(`${candidateTitle} ${candidateUploader}`);

  for (const word of SPOTIFY_BAD_CANDIDATE_WORDS) {
    const badKey = normalizeSpotifyMatchText(word);
    if (badKey && candidateRaw.includes(badKey) && !wantedRaw.includes(badKey)) {
      score -= 18;
      reasons.push(`reject-word:${word}`);
    }
  }

  if (!titleKey || !candidateCombined.includes(titleKey)) {
    score -= 18;
    reasons.push("missing-title");
  }

  if (artistKey && !candidateCombined.includes(artistKey)) {
    score -= 10;
    reasons.push("missing-artist");
  }

  const titleOverlapRatio = spotifyWordOverlapRatio(titleKey, candidateCombined);
  const hasUsefulTitle = Boolean(titleKey && (candidateCombined.includes(titleKey) || titleOverlapRatio >= 0.75));
  const hasUsefulArtist = !artistKey || candidateCombined.includes(artistKey) || spotifyWordOverlapRatio(artistKey, candidateCombined) >= 0.7;
  const hasDurationSafety =
    expectedDurationSeconds <= 0 ||
    candidateDurationSeconds <= 0 ||
    Math.abs(expectedDurationSeconds - candidateDurationSeconds) <= 18;
  const hardReject = hasHardSpotifyRejectWord(track, candidate) || isJunkVideo(candidateTitle, `${wantedTitle} ${wantedArtist}`);

  if (hasUsefulTitle && !hardReject) {
    score += 8;
    reasons.push("safe-title");
  }

  const strictOk = score >= 48 && hasUsefulTitle && hasUsefulArtist && hasDurationSafety && !hardReject;
  const relaxedTitleOnlyOk = !artistKey && score >= 38 && hasUsefulTitle && hasDurationSafety && !hardReject;
  const relaxedMissingArtistOk = artistKey && score >= 44 && hasUsefulTitle && ratio >= 0.55 && hasDurationSafety && !hardReject;

  return {
    ...candidate,
    matchScore: score,
    matchReasons: reasons,
    matchedTitle: candidateTitle,
    matchedArtist: candidateUploader,
    matchedDurationMs: candidateDurationSeconds > 0 ? Math.round(candidateDurationSeconds * 1000) : 0,
    providerUrl: candidate.providerUrl || getCandidateUrl(candidate),
    matchOk: Boolean(strictOk || relaxedTitleOnlyOk || relaxedMissingArtistOk),
    matchMode: strictOk ? "strict" : relaxedTitleOnlyOk ? "title-only" : relaxedMissingArtistOk ? "relaxed-artist" : "rejected"
  };
}

async function findSpotifyYoutubeMatch(track = {}, onProgress, job = {}) {
  const selected = require("./discover/track-identity.cjs").selectedYouTubeUrl(getSpotifyTrackId(track));
  if (selected) return { matchOk: true, matchScore: 100, matchMode: "selected-recording", providerUrl: selected, matchedTitle: String(track.title || ""), matchedArtist: String(track.artist || ""), matchedDurationMs: Number(track.durationMs) || 0 };
  if (activeDownloadCancelled) throw new Error("Download cancelled");
  const query = [track.title || track.name, track.artist || track.artists].filter(Boolean).join(" ").trim();
  const direct = query.length >= 2 && query.length <= 160
    ? exactMusicCandidate(track, await searchMusicCatalog("recording", query).catch(() => [])) : null;
  if (activeDownloadCancelled) throw new Error("Download cancelled");
  if (direct) return { matchOk: true, matchScore: 100, matchMode: "catalog-exact", providerUrl: direct.url, matchedTitle: direct.title, matchedArtist: direct.artist, matchedDurationMs: direct.durationMs };
  const candidates = await searchSpotifyYoutubeCandidates(track, 12);
  const scored = candidates
    .map((candidate) => scoreSpotifyYoutubeCandidate(track, candidate))
    .filter(candidate => normalizeYouTubeUrl(candidate.providerUrl))
    .map(candidate => ({ ...candidate, providerUrl: normalizeYouTubeUrl(candidate.providerUrl) }))
    .sort((a, b) => b.matchScore - a.matchScore);

  const best = scored.find((candidate) => candidate.matchOk) || scored[0] || null;
  const title = String(track.title || track.name || "track").trim();

  if (!best || !best.matchOk) {
    const bestScore = Math.round(best?.matchScore || 0);
    const message = scored.length
      ? `Could not safely match "${title}" (best score ${bestScore}).`
      : `Could not find YouTube candidates for "${title}".`;

    reportProgress(onProgress, {
      type: "download",
      status: "failed",
      id: job.id,
      url: job.url,
      spotifyTrackId: job.spotifyTrackId,
      spotifyUrl: job.spotifyUrl,
      source: "spotify",
      provider: "youtube",
      index: job.index,
      total: job.total,
      file: title,
      progress: 100,
      speed: null,
      size: null,
      eta: null,
      error: message,
      message
    });

    return {
      ok: false,
      url: job.url,
      spotifyTrackId: job.spotifyTrackId,
      spotifyUrl: job.spotifyUrl,
      source: "spotify",
      provider: "youtube",
      error: message,
      matchOk: false,
      matchScore: best?.matchScore || 0,
      matchMode: best?.matchMode || "none",
      matchReasons: best?.matchReasons || [],
      matchedTitle: best?.matchedTitle || "",
      matchedArtist: best?.matchedArtist || "",
      matchedDurationMs: best?.matchedDurationMs || 0,
      providerUrl: best?.providerUrl || "",
      candidatesChecked: scored.length
    };
  }

  return best;
}

async function downloadSpotifyBatch(tracks, destinationDirectory, onProgress, options = {}) {
  if (!Array.isArray(tracks) || !tracks.length) {
    return { downloadFolder: destinationDirectory, downloads: [] };
  }

  fs.mkdirSync(destinationDirectory, { recursive: true });

  const results = [];
  const seenTracks = new Set();
  tracks = tracks.filter(track => { const id = getSpotifyTrackId(track); if (!id) return true; if (seenTracks.has(id)) return false; seenTracks.add(id); return true; });
  const total = tracks.length;
  const savedJobs = tracks.map(track => {
    const id = getSpotifyTrackId(track) || crypto.createHash("sha256").update(JSON.stringify([track.title || track.name, track.artist || track.artists])).digest("hex").slice(0, 22);
    return prepareDownloadJob({ source: "spotify", url: require("./discover/track-identity.cjs").selectedYouTubeUrl(id) || `https://open.spotify.com/track/${id}`, folder: destinationDirectory, options,
      track: { ...track, id, title: String(track.title || track.name || "unknown"), artist: String(track.artist || track.artists || "") } });
  });

  for (let index = 0; index < total; index++) {
    if (activeDownloadCancelled) break;
    const track = tracks[index] || {};
    const title = String(track.title || track.name || "unknown").trim() || "unknown";
    const artist = String(track.artist || track.artists || "").trim();
    const spotifyTrackId = getSpotifyTrackId(track);
    const spotifyUrl = getSpotifyTrackUrl(track);
    const saved = savedJobs[index];
    const id = saved.id;
    const searchUrl = spotifyUrl || `spotify:track:${spotifyTrackId || id}`;

    const basePayload = {
      type: "download",
      id,
      recoveryId: saved.id,
      url: searchUrl,
      spotifyTrackId,
      spotifyUrl,
      source: "spotify",
      provider: "youtube",
      index,
      total,
      file: title,
      speed: null,
      size: null,
      eta: null
    };

    if (saved.status === "done") {
      results.push({ ...saved.result, recoveryId: saved.id });
      reportProgress(onProgress, { ...basePayload, status: options.autoAdd === false ? "done" : "importing", progress: 100, message: "Already downloaded; checking library import" });
      continue;
    }
    downloadJobs.update(saved.id, { status: "downloading", message: "Finding a matching recording" });

    reportProgress(onProgress, {
      ...basePayload,
      status: "queued",
      progress: 0,
      message: `Queued Spotify track "${title}"`
    });

    reportProgress(onProgress, {
      ...basePayload,
      status: "downloading",
      progress: 2,
      message: `Finding safe match: "${artist ? `${artist} — ` : ""}${title}"`
    });

    let match;
    try {
      match = await findSpotifyYoutubeMatch(track, onProgress, basePayload);
    } catch (error) {
      const message = error?.message || "Could not search YouTube for this Spotify track.";
      const failed = {
        ok: false,
        url: searchUrl,
        spotifyTrackId,
        spotifyUrl,
        source: "spotify",
        provider: "youtube",
        error: message,
        matchOk: false
      };
      results.push({ ...failed, recoveryId: saved.id });
      recordDownloadResult(basePayload, failed);
      if (String(message).toLowerCase().includes("cancel")) break;
      continue;
    }

    if (!match?.matchOk || !match.providerUrl) {
      const failure = match || { ok: false, url: searchUrl, source: "spotify", spotifyTrackId, error: "No safe matching recording found" };
      results.push({ ...failure, recoveryId: saved.id });
      recordDownloadResult(basePayload, failure);
      if (String(match?.error || "").toLowerCase().includes("cancel")) break;
      continue;
    }

    reportProgress(onProgress, {
      ...basePayload,
      status: "downloading",
      progress: 6,
      providerUrl: match.providerUrl,
      message: match.matchMode === "selected-recording" ? `Selected recording: ${title}` : `Matched ${match.matchMode || "safely"} (${Math.round(match.matchScore)}): ${match.matchedTitle || title}`
    });

    const resultMetadata = {
      url: searchUrl, spotifyTrackId, spotifyUrl, source: "spotify", provider: "youtube",
      providerUrl: match.providerUrl, matchedTitle: match.matchedTitle || "",
      matchedArtist: match.matchedArtist || "", matchedDurationMs: match.matchedDurationMs || 0,
      matchScore: Math.round(match.matchScore || 0), matchOk: Boolean(match.matchOk), recoveryId: saved.id
    };
    const safeTrackId = sanitizeFilename(spotifyTrackId || saved.id);
    const outputName = artist ? `spotify_${safeTrackId} - ${artist} - ${title}` : `spotify_${safeTrackId} - ${title}`;
    const dlResult = await downloadYouTube(
      match.providerUrl, destinationDirectory, onProgress, { ...options, cleanTitle: false },
      { ...basePayload, url: match.providerUrl, file: title, outputName, resultMetadata }
    );
    const enrichedBase = { ...dlResult, ...resultMetadata };

    results.push(enrichedBase);
    recordDownloadResult(basePayload, enrichedBase);

    if (!dlResult.ok) {
      reportProgress(onProgress, {
        ...basePayload,
        status: String(dlResult.error || "").toLowerCase().includes("cancel") ? "cancelled" : "failed",
        progress: 100,
        providerUrl: match.providerUrl,
        error: dlResult.error,
        message: String(dlResult.error || "").toLowerCase().includes("cancel") ? "Download cancelled" : "Download failed — retry?"
      });
    }

    if (String(dlResult.error || "").toLowerCase().includes("cancel")) break;
  }

  return { downloadFolder: destinationDirectory, downloads: results };
}

async function downloadAudioUrls(input, destinationDirectory, onProgress, options = {}) {
  const urls = [...new Set(parseUrls(input).map(url => normalizeYouTubeUrl(url) || url))];
  const results = [];
  const planned = urls.map(url => normalizeYouTubeUrl(url) ? prepareDownloadJob({ source: "youtube", url: normalizeYouTubeUrl(url), folder: destinationDirectory, options }) : null);

  for (let index = 0; index < urls.length; index += 1) {
    if (activeDownloadCancelled) break;
    const url = urls[index];
    const saved = planned[index];
    const id = saved?.id || `${Date.now()}-${index}`;
    const job = { id, recoveryId: saved?.id, url, index, total: urls.length };

    reportProgress(onProgress, { type: "download", status: "queued", id, recoveryId: saved?.id, url, index, total: urls.length, file: "queued track", progress: 0, message: "Queued..." });

    const normalizedUrl = normalizeYouTubeUrl(url);
    const result = saved?.status === "done" ? saved.result : normalizedUrl
      ? await downloadYouTube(normalizedUrl, destinationDirectory, onProgress, options, job)
      : { ok: false, url, error: "Only HTTPS YouTube video URLs are supported" };
    recordDownloadResult(job, result);

    if (!result.ok) {
      reportProgress(onProgress, { type: "download", status: String(result.error || "").toLowerCase().includes("cancel") ? "cancelled" : "failed", id, recoveryId: saved?.id, url, index, total: urls.length, file: "track", progress: 100, error: result.error, message: String(result.error || "").toLowerCase().includes("cancel") ? "Download cancelled" : "Download failed — retry?" });
    }

    results.push({ ...result, recoveryId: job.recoveryId });
    if (String(result.error || "").toLowerCase().includes("cancel")) break;
  }

  return { downloadFolder: destinationDirectory, downloads: results };
}

function cancelActiveDownloads({ interrupted = false } = {}) {
  activeDownloadCancelled = true;
  activeDownloadInterrupted = interrupted;
  let killed = false;
  for (const proc of activeDownloadProcesses) {
    try {
      proc.kill("SIGTERM");
      killed = true;
    } catch {
      try { proc.kill(); killed = true; } catch { }
    }
  }
  for (const id of batchJobIds) {
    if (downloadJobs?.get(id)?.status === "queued") {
      downloadJobs.update(id, { status: interrupted ? "interrupted" : "cancelled", message: interrupted ? "Download interrupted. Resume when ready." : "Download cancelled" });
      if (!interrupted) downloadJobs.cleanWorkDirectory(id);
    }
  }
  return killed || activeBatch;
}

async function convertLocalMediaFiles(filePaths, destinationDirectory, options = {}, onProgress) {
  const bitrate = Number(options.bitrate || 192);
  const results = [];
  for (let index = 0; index < filePaths.length; index++) {
    const file = filePaths[index];
    if (activeDownloadCancelled) {
      results.push({ ok: false, sourcePath: file, error: "Conversion cancelled before starting" });
      continue;
    }
    results.push(await convertOneToMp3(file, destinationDirectory, bitrate, progress => {
      reportProgress(onProgress, { ...progress, index, total: filePaths.length, message: `${index + 1}/${filePaths.length}: ${progress.message}` });
    }));
  }
  return { downloadFolder: destinationDirectory, conversions: results };
}

module.exports = {
  listDownloadJobs,
  completeDownloadImports,
  runDownloadOperation,
  isDownloadFileInProgress,
  getDownloadRecoveryRequest,
  clearDownloadJobs,
  normalizeYouTubeUrl,
  initDownloader,
  downloadAudioUrls: (...args) => runDownloadBatch(() => downloadAudioUrls(...args)),
  downloadSpotifyBatch: (...args) => runDownloadBatch(() => downloadSpotifyBatch(...args)),
  convertLocalMediaFiles: (...args) => runDownloadBatch(() => convertLocalMediaFiles(...args)),
  convertOneToMp3,
  isSupportedMediaPath,
  _test: { getBaseArgs, buildStrategies, AUDIO_FORMAT_SELECTOR, ORIGINAL_AUDIO_FORMAT_SELECTOR },
  cancelActiveDownloads
};
