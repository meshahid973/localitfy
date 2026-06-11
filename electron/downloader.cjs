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
const activeDownloadProcesses = new Set();
let activeDownloadCancelled = false;

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

// ====================== DOWNLOAD OPTIONS ======================
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

// ====================== SPEED ARGS ======================
function getBaseArgs(url, outputTemplate, options = {}) {
  const format = safeDownloadFormat(options.format);
  const quality = safeDownloadQuality(options.quality);

  return [
    url,
    "--output", outputTemplate,
    "--format", "bestaudio[ext=m4a]/bestaudio[ext=opus]/bestaudio/best",
    "--extract-audio",
    "--audio-format", format,
    "--audio-quality", quality,
    "--concurrent-fragments", "16",
    "--buffer-size", "32M",
    "--http-chunk-size", "10M",
    "--no-part",
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

  strategies.push({
    label: "mobile clients",
    args: withFfmpeg([...base, "--extractor-args", "youtube:player_client=android,ios"])
  });

  strategies.push({
    label: "tv_embedded client",
    args: withFfmpeg([...base, "--extractor-args", "youtube:player_client=tv_embedded"])
  });

  if (_getCookiesFile) {
    try {
      const cookiesFile = await _getCookiesFile();
      if (cookiesFile && fs.existsSync(cookiesFile)) {
        strategies.push({ label: "session cookies", args: withFfmpeg([...base, "--cookies", cookiesFile]) });
      }
    } catch { /* non-fatal */ }
  }

  const browsers = process.platform === "win32" ? ["chrome", "edge", "firefox"] : ["chrome", "firefox", "chromium"];
  for (const browser of browsers) {
    strategies.push({ label: `${browser} cookies`, args: withFfmpeg([...base, "--cookies-from-browser", browser]) });
  }

  return strategies;
}

// ====================== PROGRESS PARSING ======================
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
  const percent = Math.min(100, Math.max(0, Math.floor(p?.percent ?? 0)));
  const speed = formatSpeed(p?.currentSpeed);
  const size = formatSize(p?.totalSize);
  const eta = p?.eta ?? null;
  let message = "Downloading audio...";
  if (percent >= 88) message = `Converting to ${String(job.format || "mp3").toUpperCase()}...`;
  if (speed) message += `  •  ${speed}`;
  if (eta && eta !== "00:00") message += `  •  ETA ${eta}`;

  return {
    type: "download",
    status: percent >= 88 ? "converting" : "downloading",
    id: job.id,
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

// ====================== RUN YT-DLP ======================
function runYtDlp(ytDlp, args, onProgress, job) {
  return new Promise((resolve, reject) => {
    activeDownloadCancelled = false;
    const proc = ytDlp.exec(args);
    activeDownloadProcesses.add(proc);

    proc.on("progress", (p) => onProgress?.(buildProgressPayload(job, p)));
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

// ====================== YOUTUBE DOWNLOAD ======================
async function downloadYouTube(url, destinationDirectory, onProgress, options = {}, job = {}) {
  try {
    fs.mkdirSync(destinationDirectory, { recursive: true });

    const ytDlp = await getYtDlp();
    const format = safeDownloadFormat(options.format);
    const tempId = crypto.randomUUID().slice(0, 8);
    const outputTemplate = path.join(destinationDirectory, `ytdl_${tempId}_%(title)s.%(ext)s`);

    onProgress?.({
      type: "download",
      status: "downloading",
      id: job.id,
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
        await runYtDlp(ytDlp, strategy.args, onProgress, { ...job, url, file: "track", format });
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

    const allFiles = fs.readdirSync(destinationDirectory);
    const downloaded =
      allFiles.find((f) => f.startsWith(`ytdl_${tempId}_`) && f.endsWith(`.${format}`)) ??
      allFiles.find((f) => f.startsWith(`ytdl_${tempId}_`));

    if (!downloaded) throw new Error("yt-dlp finished but output file not found");

    const rawTitle = downloaded.replace(`ytdl_${tempId}_`, "").replace(/\.[^.]+$/, "");
    const safeTitle = options.cleanTitle === false ? sanitizeFilename(rawTitle) : cleanDownloadedTitle(rawTitle);
    const ext = path.extname(downloaded) || `.${format}`;
    const sourcePath = path.join(destinationDirectory, downloaded);
    const finalPath = uniquePath(destinationDirectory, `${safeTitle}${ext}`);
    fs.renameSync(sourcePath, finalPath);

    onProgress?.({
      type: "download",
      status: "done",
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

    return { ok: true, url, filePath: finalPath, filename: path.basename(finalPath), format };
  } catch (error) {
    const message = error?.message || "YouTube download failed";
    return { ok: false, url, error: message };
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

// ====================== SPOTIFY DOWNLOAD ======================
// Spotify downloads use Spotify metadata as identity, then choose a safe
// YouTube audio candidate. Never use ytsearch1 first-result downloading here;
// that is what caused same-name songs to import as the wrong audio.

function normalizeSpotifyMatchText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[''`´]/g, "")
    .replace(/\b(feat|ft|featuring)\.?\b/g, " ")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function spotifyMatchWords(value = "") {
  return normalizeSpotifyMatchText(value)
    .split(" ")
    .filter((word) => word.length > 1);
}

function getSpotifyTrackId(track = {}) {
  return String(track.spotifyTrackId || track.id || track.trackId || "").trim();
}

function getSpotifyTrackUrl(track = {}) {
  const explicit = String(track.spotifyUrl || track.url || "").trim();
  const trackId = getSpotifyTrackId(track);
  if (/^https:\/\/open\.spotify\.com\/track\//i.test(explicit)) return explicit;
  return trackId ? `https://open.spotify.com/track/${trackId}` : explicit;
}

function buildSpotifySearchQuery(track = {}) {
  const title = String(track.title || track.name || "unknown track").trim();
  const artist = String(track.artist || track.artists || "").trim();
  const isrc = String(track.isrc || "").trim();

  if (isrc) return `${artist ? `${artist} ` : ""}${title} ${isrc} official audio`.trim();
  if (artist) return `${artist} - ${title} official audio`;
  return `${title} official audio`;
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
    activeDownloadCancelled = false;
    const proc = ytDlp.exec(args);
    activeDownloadProcesses.add(proc);

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

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
    // yt-dlp --dump-json often writes one JSON object per line.
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed?.entries)) candidates.push(...parsed.entries.filter(Boolean));
      else if (parsed && typeof parsed === "object") candidates.push(parsed);
    } catch {
      // Ignore non-JSON logging lines.
    }
  }

  return candidates;
}

async function searchSpotifyYoutubeCandidates(track, limit = 8) {
  const ytDlp = await getYtDlp();
  const query = buildSpotifySearchQuery(track);
  const searchUrl = `ytsearch${Math.max(3, Math.min(10, Number(limit) || 8))}:${query}`;

  const baseArgs = [
    searchUrl,
    "--dump-json",
    "--flat-playlist",
    "--no-warnings",
    "--no-colors",
    "--ignore-errors"
  ];

  const attempts = [baseArgs];

  if (_getCookiesFile) {
    try {
      const cookiesFile = await _getCookiesFile();
      if (cookiesFile && fs.existsSync(cookiesFile)) {
        attempts.push([...baseArgs, "--cookies", cookiesFile]);
      }
    } catch {
      // Metadata search can still work without cookies.
    }
  }

  let lastError = null;

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

      if (candidates.length) return candidates;
    } catch (error) {
      lastError = error;
      if (String(error?.message || "").toLowerCase().includes("cancel")) throw error;
    }
  }

  if (lastError) {
    console.log("[localtify spotify] candidate search failed:", lastError?.message || lastError);
  }

  return [];
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

  const wantedWords = new Set(spotifyMatchWords(wantedCombined).filter((word) => word.length > 2));
  const candidateWords = new Set(spotifyMatchWords(candidateCombined).filter((word) => word.length > 2));
  let overlap = 0;

  for (const word of wantedWords) {
    if (candidateWords.has(word)) overlap += 1;
  }

  if (wantedWords.size) {
    const ratio = overlap / wantedWords.size;
    score += Math.round(ratio * 26);
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

  return {
    ...candidate,
    matchScore: score,
    matchReasons: reasons,
    matchedTitle: candidateTitle,
    matchedArtist: candidateUploader,
    matchedDurationMs: candidateDurationSeconds > 0 ? Math.round(candidateDurationSeconds * 1000) : 0,
    providerUrl: candidate.providerUrl || getCandidateUrl(candidate),
    matchOk: score >= 48
  };
}

async function findSpotifyYoutubeMatch(track = {}, onProgress, job = {}) {
  const candidates = await searchSpotifyYoutubeCandidates(track, 8);
  const scored = candidates
    .map((candidate) => scoreSpotifyYoutubeCandidate(track, candidate))
    .sort((a, b) => b.matchScore - a.matchScore);

  const best = scored[0] || null;
  const title = String(track.title || track.name || "track").trim();

  if (!best || !best.matchOk) {
    onProgress?.({
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
      error: "Could not safely match this Spotify track.",
      message: "Could not safely match this Spotify track."
    });

    return {
      ok: false,
      url: job.url,
      spotifyTrackId: job.spotifyTrackId,
      spotifyUrl: job.spotifyUrl,
      source: "spotify",
      provider: "youtube",
      error: "Could not safely match this Spotify track.",
      matchOk: false,
      matchScore: best?.matchScore || 0,
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
  const total = tracks.length;

  for (let index = 0; index < total; index++) {
    const track = tracks[index] || {};
    const title = String(track.title || track.name || "unknown").trim() || "unknown";
    const artist = String(track.artist || track.artists || "").trim();
    const spotifyTrackId = getSpotifyTrackId(track);
    const spotifyUrl = getSpotifyTrackUrl(track);
    const id = `spt_${spotifyTrackId || Date.now()}_${index}`;
    const searchUrl = spotifyUrl || `spotify:track:${spotifyTrackId || id}`;

    const basePayload = {
      type: "download",
      id,
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

    onProgress?.({
      ...basePayload,
      status: "queued",
      progress: 0,
      message: `Queued Spotify track "${title}"`
    });

    onProgress?.({
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
      results.push(failed);
      if (String(message).toLowerCase().includes("cancel")) break;
      continue;
    }

    if (!match?.matchOk || !match.providerUrl) {
      results.push(match);
      if (String(match?.error || "").toLowerCase().includes("cancel")) break;
      continue;
    }

    onProgress?.({
      ...basePayload,
      status: "downloading",
      progress: 6,
      providerUrl: match.providerUrl,
      message: `Matched safely (${Math.round(match.matchScore)}): ${match.matchedTitle || title}`
    });

    const dlResult = await downloadYouTube(
      match.providerUrl,
      destinationDirectory,
      onProgress,
      { ...options, cleanTitle: false },
      {
        ...basePayload,
        url: match.providerUrl,
        providerUrl: match.providerUrl,
        file: title,
        format: safeDownloadFormat(options.format)
      }
    );

    const enrichedBase = {
      ...dlResult,
      url: searchUrl,
      spotifyTrackId,
      spotifyUrl,
      source: "spotify",
      provider: "youtube",
      providerUrl: match.providerUrl,
      matchedTitle: match.matchedTitle || "",
      matchedArtist: match.matchedArtist || "",
      matchedDurationMs: match.matchedDurationMs || 0,
      matchScore: Math.round(match.matchScore || 0),
      matchOk: Boolean(match.matchOk)
    };

    if (dlResult.ok && dlResult.filePath && title) {
      try {
        const dir = path.dirname(dlResult.filePath);
        const ext = path.extname(dlResult.filePath) || `.${safeDownloadFormat(options.format)}`;
        const safeTrackId = sanitizeFilename(spotifyTrackId || crypto.createHash("sha1").update(`${artist}-${title}`).digest("hex").slice(0, 12));
        const spotifyName = artist
          ? sanitizeFilename(`spotify_${safeTrackId} - ${artist} - ${title}`)
          : sanitizeFilename(`spotify_${safeTrackId} - ${title}`);
        const newPath = uniquePath(dir, `${spotifyName}${ext}`);
        fs.renameSync(dlResult.filePath, newPath);

        const finalResult = {
          ...enrichedBase,
          filePath: newPath,
          filename: path.basename(newPath)
        };

        results.push(finalResult);

        onProgress?.({
          ...basePayload,
          status: "done",
          progress: 100,
          providerUrl: match.providerUrl,
          file: path.basename(newPath),
          message: "Adding Spotify track to library..."
        });

        continue;
      } catch {
        // Rename failed — keep the original filename but still keep identity fields.
      }
    }

    results.push(enrichedBase);

    if (!dlResult.ok) {
      onProgress?.({
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

// ====================== PUBLIC API ======================
async function downloadAudioUrls(input, destinationDirectory, onProgress, options = {}) {
  const urls = parseUrls(input);
  const results = [];

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const id = `${Date.now()}-${index}`;
    const job = { id, url, index, total: urls.length };

    onProgress?.({ type: "download", status: "queued", id, url, index, total: urls.length, file: "queued track", progress: 0, message: "Queued..." });

    const isYouTube = /youtube\.com\/watch|youtu\.be\//.test(url);
    const result = isYouTube
      ? await downloadYouTube(url, destinationDirectory, onProgress, options, job)
      : { ok: false, url, error: "Only YouTube URLs are supported" };

    if (!result.ok) {
      onProgress?.({ type: "download", status: String(result.error || "").toLowerCase().includes("cancel") ? "cancelled" : "failed", id, url, index, total: urls.length, file: "track", progress: 100, error: result.error, message: String(result.error || "").toLowerCase().includes("cancel") ? "Download cancelled" : "Download failed — retry?" });
    }

    results.push(result);
    if (String(result.error || "").toLowerCase().includes("cancel")) break;
  }

  return { downloadFolder: destinationDirectory, downloads: results };
}

function cancelActiveDownloads() {
  activeDownloadCancelled = true;
  let killed = false;
  for (const proc of activeDownloadProcesses) {
    try {
      proc.kill("SIGTERM");
      killed = true;
    } catch {
      try { proc.kill(); killed = true; } catch { /* ignore */ }
    }
  }
  return killed;
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
  downloadSpotifyBatch,
  convertLocalMediaFiles,
  convertOneToMp3,
  isSupportedMediaPath,
  cancelActiveDownloads
};
