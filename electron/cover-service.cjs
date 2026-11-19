const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

let serviceUserDataPath = "";
const COVER_CACHE_DIR = "resolved-covers-v040";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const PREFERRED_FOLDER_COVERS = ["cover", "folder", "front", "artwork", "album"]
  .flatMap(name => ["jpg", "jpeg", "png", "webp", "gif", "bmp"].map(extension => `${name}.${extension}`));

function initCoverService(options = {}) {
  serviceUserDataPath = String(options.userDataPath || serviceUserDataPath || "").trim();

  if (serviceUserDataPath) {
    try {
      fs.mkdirSync(getCoverCacheDirectory(), { recursive: true });
    } catch {
    }
  }
}

function getCoverCacheDirectory() {
  const base = serviceUserDataPath || process.cwd();
  return path.join(base, COVER_CACHE_DIR);
}

function fileExists(filePath) {
  try {
    return Boolean(filePath && fs.statSync(filePath).isFile());
  } catch {
    return false;
  }
}

function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(String(filePath || "")).toLowerCase());
}

function getFolderFromInput(inputPath) {
  const clean = String(inputPath || "").trim();
  if (!clean) return "";

  try {
    if (fs.existsSync(clean) && fs.statSync(clean).isDirectory()) return clean;
    return path.dirname(clean);
  } catch {
    return path.dirname(clean);
  }
}

function findFolderCover(inputPath) {
  const folderPath = getFolderFromInput(inputPath);
  if (!folderPath || !fs.existsSync(folderPath)) return "";

  let entries = [];
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return "";
  }

  const files = entries
    .filter((entry) => entry.isFile() && isImageFile(entry.name))
    .map((entry) => path.join(folderPath, entry.name))
    .filter(fileExists);

  if (!files.length) return "";

  const byBase = new Map(files.map((filePath) => [path.basename(filePath).toLowerCase(), filePath]));

  for (const name of PREFERRED_FOLDER_COVERS) {
    const match = byBase.get(name);
    if (match) return match;
  }

  const named = files.filter((filePath) => /(^|[\s_.-])(cover|folder|front|artwork|album)([\s_.-]|$)/i.test(path.parse(filePath).name));
  return named.length === 1 ? named[0] : files.length === 1 ? files[0] : "";
}

function copyCoverToAppStorage(sourcePath, options = {}) {
  try {
    if (!sourcePath || !fileExists(sourcePath) || !isImageFile(sourcePath)) return "";

    const stat = fs.statSync(sourcePath);
    const ext = path.extname(sourcePath).toLowerCase() || ".jpg";
    const source = /^[a-z]+$/i.test(String(options.source || "")) ? String(options.source) : "cover";
    const seed = [
      source,
      sourcePath,
      String(stat.mtimeMs || ""),
      String(stat.size || "")
    ].join("::");

    const hash = crypto.createHash("sha1").update(seed).digest("hex");
    const dir = getCoverCacheDirectory();
    fs.mkdirSync(dir, { recursive: true });

    const targetPath = path.join(dir, `${source}-${hash}${ext}`);
    if (!fs.existsSync(targetPath)) {
      const temp = targetPath + "." + crypto.randomUUID() + ".tmp";
      try { fs.copyFileSync(sourcePath, temp); fs.renameSync(temp, targetPath); }
      finally { try { fs.rmSync(temp, { force: true }); } catch {} }
    }

    return targetPath;
  } catch {
    return "";
  }
}

function existingCoverIsUsable(song) {
  const coverPath = String(song?.coverPath || "").trim();
  return Boolean(coverPath && fileExists(coverPath) && isImageFile(coverPath));
}

async function resolveSongCover(input = {}) {
  const song = input.song || {};
  const metadata = input.metadata || {};
  const now = new Date().toISOString();
  if (!input.preferFolderCover && song.coverSource === "custom" && existingCoverIsUsable(song)) {
    return { coverPath: song.coverPath, coverSource: "custom", coverUpdatedAt: song.coverUpdatedAt || now };
  }
  const proposedFolder = input.folderCoverPath || findFolderCover(input.filePath || song.filePath || "");
  const folderCover = fileExists(proposedFolder) && isImageFile(proposedFolder) ? proposedFolder : "";

  if (input.preferFolderCover && folderCover) {
    const cached = copyCoverToAppStorage(folderCover, {
      source: "folder",
      filePath: input.filePath || song.filePath || "",
      songId: song.id || ""
    }) || folderCover;

    return { coverPath: cached, coverSource: "folder", coverUpdatedAt: now };
  }

  if (song.coverSource === "custom" && existingCoverIsUsable(song)) {
    return { coverPath: song.coverPath, coverSource: "custom", coverUpdatedAt: song.coverUpdatedAt || now };
  }

  if (metadata.embeddedCoverPath && fileExists(metadata.embeddedCoverPath) && isImageFile(metadata.embeddedCoverPath)) {
    return { coverPath: metadata.embeddedCoverPath, coverSource: "embedded", coverUpdatedAt: now };
  }

  if (existingCoverIsUsable(song) && !["fallback", "none", "folder"].includes(song.coverSource)) {
    return { coverPath: song.coverPath, coverSource: song.coverSource || "fallback", coverUpdatedAt: song.coverUpdatedAt || now };
  }

  if (folderCover) {
    const cached = copyCoverToAppStorage(folderCover, {
      source: "folder",
      filePath: input.filePath || song.filePath || "",
      songId: song.id || ""
    }) || folderCover;

    return { coverPath: cached, coverSource: "folder", coverUpdatedAt: now };
  }


  const albumEmbeddedCoverPath = input.albumEmbeddedCoverPath || input.albumCoverPath || "";
  if (albumEmbeddedCoverPath && fileExists(albumEmbeddedCoverPath) && isImageFile(albumEmbeddedCoverPath)) {
    const cached = copyCoverToAppStorage(albumEmbeddedCoverPath, {
      source: "embedded",
      filePath: input.filePath || song.filePath || "",
      songId: song.id || ""
    }) || albumEmbeddedCoverPath;

    return { coverPath: cached, coverSource: "embedded", coverUpdatedAt: now };
  }

  if (input.spotifyCoverPath && fileExists(input.spotifyCoverPath) && isImageFile(input.spotifyCoverPath)) {
    return { coverPath: input.spotifyCoverPath, coverSource: "spotify", coverUpdatedAt: now };
  }

  if (existingCoverIsUsable(song)) return { coverPath: song.coverPath, coverSource: song.coverSource || "fallback", coverUpdatedAt: song.coverUpdatedAt || now };

  if (input.fallbackCoverPath && fileExists(input.fallbackCoverPath) && isImageFile(input.fallbackCoverPath)) {
    return { coverPath: input.fallbackCoverPath, coverSource: "fallback", coverUpdatedAt: now };
  }

  return { coverPath: "", coverSource: "none", coverUpdatedAt: now };
}

/**
 * Keep one mutable usage snapshot across a bulk cover assignment operation.
 * The caller records each successful database update before the next choice.
 */
function createLeastUsedCoverAllocator(availableCovers = [], songs = [], random = Math.random) {
  const covers = [...new Set(availableCovers.filter(Boolean))];
  const usage = new Map(covers.map(cover => [cover, 0]));
  for (const song of songs) {
    if (usage.has(song.coverPath)) usage.set(song.coverPath, usage.get(song.coverPath) + 1);
  }

  function choose(previousPath = "") {
    let min = Infinity;
    let selected = "";
    let ties = 0;
    for (const cover of covers) {
      if (covers.length > 1 && cover === previousPath) continue;
      const count = usage.get(cover);
      if (count < min) {
        min = count;
        selected = cover;
        ties = 1;
      } else if (count === min && random() * ++ties < 1) {
        selected = cover;
      }
    }
    return selected;
  }

  function record(previousPath, nextPath) {
    if (!usage.has(nextPath) || previousPath === nextPath) return;
    if (usage.has(previousPath)) {
      usage.set(previousPath, Math.max(0, usage.get(previousPath) - 1));
    }
    usage.set(nextPath, usage.get(nextPath) + 1);
  }

  return { choose, record };
}

module.exports = {
  initCoverService,
  findFolderCover,
  copyCoverToAppStorage,
  resolveSongCover,
  createLeastUsedCoverAllocator,
  isImageFile
};
