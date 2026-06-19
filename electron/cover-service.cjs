/* localtify 0.4.2 V044 album cover fallback opt-out. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

let serviceUserDataPath = "";
const COVER_CACHE_DIR = "resolved-covers-v040";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const PREFERRED_FOLDER_COVERS = [
  "cover.jpg",
  "cover.jpeg",
  "cover.png",
  "folder.jpg",
  "folder.jpeg",
  "folder.png",
  "front.jpg",
  "front.jpeg",
  "front.png",
  "artwork.jpg",
  "artwork.jpeg",
  "artwork.png",
  "album.jpg",
  "album.jpeg",
  "album.png"
];

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

function normalizePathKey(filePath) {
  try {
    return path.normalize(String(filePath || "")).toLowerCase();
  } catch {
    return String(filePath || "").toLowerCase();
  }
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
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(folderPath, entry.name))
    .filter((item) => fileExists(item) && isImageFile(item));

  if (!files.length) return "";

  const byBase = new Map(files.map((filePath) => [path.basename(filePath).toLowerCase(), filePath]));

  for (const name of PREFERRED_FOLDER_COVERS) {
    const match = byBase.get(name);
    if (match) return match;
  }

  const named = files.find((filePath) => /(^|[\s_.-])(cover|folder|front|artwork|album)([\s_.-]|$)/i.test(path.parse(filePath).name));
  return named || files[0] || "";
}

function copyCoverToAppStorage(sourcePath, options = {}) {
  try {
    if (!sourcePath || !fileExists(sourcePath) || !isImageFile(sourcePath)) return "";

    const stat = fs.statSync(sourcePath);
    const ext = path.extname(sourcePath).toLowerCase() || ".jpg";
    const source = String(options.source || "cover");
    const sharedAlbumArt = options.shared === true || source === "folder" || source === "embedded" || source === "album";
    const seedParts = [
      source,
      sourcePath,
      String(stat.mtimeMs || ""),
      String(stat.size || "")
    ];

    // Folder/album art should be cached once per source image, not once per track.
    // The old per-track seed could create hundreds/thousands of duplicate cached covers
    // during bulk album imports, which then made startup thumbnail warmup heavier too.
    if (!sharedAlbumArt) {
      seedParts.push(String(options.filePath || ""), String(options.songId || ""));
    }

    const seed = seedParts.join("::");

    const hash = crypto.createHash("sha1").update(seed).digest("hex");
    const dir = getCoverCacheDirectory();
    fs.mkdirSync(dir, { recursive: true });

    const targetPath = path.join(dir, `${source}-${hash}${ext}`);
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
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
  const allowFallbackCover = input.allowFallbackCover !== false;
  const folderCover = input.folderCoverPath || findFolderCover(input.filePath || song.filePath || "");

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

  if (folderCover) {
    const cached = copyCoverToAppStorage(folderCover, {
      source: "folder",
      filePath: input.filePath || song.filePath || "",
      songId: song.id || ""
    }) || folderCover;

    return { coverPath: cached, coverSource: "folder", coverUpdatedAt: now };
  }

  if (metadata.embeddedCoverPath && fileExists(metadata.embeddedCoverPath) && isImageFile(metadata.embeddedCoverPath)) {
    return { coverPath: metadata.embeddedCoverPath, coverSource: "embedded", coverUpdatedAt: now };
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

  if (allowFallbackCover && input.fallbackCoverPath && fileExists(input.fallbackCoverPath) && isImageFile(input.fallbackCoverPath)) {
    return { coverPath: input.fallbackCoverPath, coverSource: "fallback", coverUpdatedAt: now };
  }

  return { coverPath: "", coverSource: "none", coverUpdatedAt: now };
}

module.exports = {
  initCoverService,
  findFolderCover,
  copyCoverToAppStorage,
  resolveSongCover,
  isImageFile
};