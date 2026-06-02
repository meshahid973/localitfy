#!/usr/bin/env node
/* localtify v0.3.6 V188 — automatic asset compression + safe build-output cleanup.
   Place this file at: scripts/compress-localtify-assets.mjs

   What it touches:
   - pixelart/
   - src/assets/
   - public/
   - assets/

   What it never touches:
   - user music
   - download folders
   - imported library paths
   - node_modules
   - release output while compressing
*/

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run") || args.has("--dry");
const BACKUP = args.has("--backup");
const CLEAN_BUILD_OUTPUT = args.has("--clean-build-output");
const FORCE = args.has("--force");

const SOURCE_DIRS = ["pixelart", path.join("src", "assets"), "public", "assets"];
const BUILD_OUTPUT_DIRS = ["release", "release-hotfix", "dist", "dist-ssr", "out", ".vite"];

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const GIF_EXT = ".gif";

const MIN_IMAGE_BYTES = 220 * 1024;
const MIN_GIF_BYTES = 700 * 1024;
const MAX_IMAGE_WIDTH = 1600;
const MAX_GIF_WIDTH = 640;
const GIF_FPS = 12;
const MIN_SAVING_BYTES = 24 * 1024;
const MIN_SAVING_RATIO = 0.04;

const BACKUP_ROOT = path.join(ROOT, "localtify_asset_backups");
const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(BACKUP_ROOT, runStamp);

const prettyBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const exists = async (target) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

const statSize = async (target) => {
  const info = await fs.stat(target);
  return info.size;
};

const walk = async (dir) => {
  const output = [];

  if (!(await exists(dir))) return output;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", ".git", "release", "release-hotfix", "dist", "dist-ssr", "out", ".vite"].includes(entry.name)) {
        continue;
      }
      output.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile()) output.push(fullPath);
  }

  return output;
};

const backupFile = async (filePath) => {
  if (!BACKUP || DRY_RUN) return;

  const relativePath = path.relative(ROOT, filePath);
  const destination = path.join(backupDir, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(filePath, destination);
};

const replaceIfSmaller = async ({ sourcePath, tempPath, originalSize, label }) => {
  const newSize = await statSize(tempPath);
  const saved = originalSize - newSize;
  const savedRatio = saved / Math.max(originalSize, 1);

  if (!FORCE && (saved < MIN_SAVING_BYTES || savedRatio < MIN_SAVING_RATIO || newSize >= originalSize)) {
    await fs.rm(tempPath, { force: true });
    console.log(`skip ${label}: ${path.relative(ROOT, sourcePath)} (${prettyBytes(originalSize)} -> ${prettyBytes(newSize)}, not worth replacing)`);
    return { changed: false, saved: 0 };
  }

  await backupFile(sourcePath);

  if (!DRY_RUN) {
    await fs.rename(tempPath, sourcePath);
  } else {
    await fs.rm(tempPath, { force: true });
  }

  console.log(`${DRY_RUN ? "would compress" : "compressed"} ${label}: ${path.relative(ROOT, sourcePath)} (${prettyBytes(originalSize)} -> ${prettyBytes(newSize)}, saved ${prettyBytes(saved)})`);
  return { changed: true, saved };
};

const importSharp = async () => {
  try {
    const sharpModule = await import("sharp");
    return sharpModule.default || sharpModule;
  } catch {
    return null;
  }
};

const importFfmpegPath = async () => {
  try {
    const ffmpegModule = await import("ffmpeg-static");
    return ffmpegModule.default || ffmpegModule;
  } catch {
    return "";
  }
};

const runProcess = (command, processArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, processArgs, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });

const compressImage = async (filePath, sharp) => {
  const ext = path.extname(filePath).toLowerCase();
  const originalSize = await statSize(filePath);

  if (originalSize < MIN_IMAGE_BYTES && !FORCE) return { changed: false, saved: 0 };

  const tempPath = `${filePath}.localtify-compress-temp${ext}`;

  try {
    const image = sharp(filePath, { animated: false, limitInputPixels: false }).rotate();
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const shouldResize = width > MAX_IMAGE_WIDTH;

    let pipeline = image;
    if (shouldResize) {
      pipeline = pipeline.resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true });
    }

    if (ext === ".png") {
      await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, effort: 9 }).toFile(tempPath);
    } else if (ext === ".jpg" || ext === ".jpeg") {
      await pipeline.jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(tempPath);
    } else if (ext === ".webp") {
      await pipeline.webp({ quality: 82, effort: 6 }).toFile(tempPath);
    }

    return await replaceIfSmaller({ sourcePath: filePath, tempPath, originalSize, label: ext.slice(1).toUpperCase() });
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    console.warn(`warn image skipped: ${path.relative(ROOT, filePath)} (${error.message})`);
    return { changed: false, saved: 0 };
  }
};

const compressGif = async (filePath, ffmpegPath) => {
  const originalSize = await statSize(filePath);

  if (originalSize < MIN_GIF_BYTES && !FORCE) return { changed: false, saved: 0 };
  if (!ffmpegPath) {
    console.warn(`warn GIF skipped because ffmpeg-static is not installed: ${path.relative(ROOT, filePath)}`);
    return { changed: false, saved: 0 };
  }

  const tempPath = `${filePath}.localtify-compress-temp.gif`;
  const palettePath = `${filePath}.localtify-palette-temp.png`;
  const vfBase = `fps=${GIF_FPS},scale='min(${MAX_GIF_WIDTH},iw)':-1:flags=lanczos`;

  try {
    await runProcess(ffmpegPath, ["-y", "-i", filePath, "-vf", `${vfBase},palettegen=stats_mode=diff`, palettePath]);
    await runProcess(ffmpegPath, ["-y", "-i", filePath, "-i", palettePath, "-lavfi", `${vfBase} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, "-loop", "0", tempPath]);
    await fs.rm(palettePath, { force: true });

    return await replaceIfSmaller({ sourcePath: filePath, tempPath, originalSize, label: "GIF" });
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    await fs.rm(palettePath, { force: true }).catch(() => {});
    console.warn(`warn GIF skipped: ${path.relative(ROOT, filePath)} (${error.message})`);
    return { changed: false, saved: 0 };
  }
};

const cleanBuildOutput = async () => {
  let removed = 0;

  for (const dirName of BUILD_OUTPUT_DIRS) {
    const target = path.join(ROOT, dirName);
    if (!(await exists(target))) continue;

    if (DRY_RUN) {
      console.log(`would remove build output: ${dirName}/`);
    } else {
      await fs.rm(target, { recursive: true, force: true });
      console.log(`removed build output: ${dirName}/`);
    }
    removed += 1;
  }

  if (!removed) console.log("no old build output folders found");
};

const compressAssets = async () => {
  const sharp = await importSharp();
  const ffmpegPath = await importFfmpegPath();

  if (!sharp) {
    console.warn("warn sharp is not installed, PNG/JPG/WebP compression will be skipped");
  }

  if (!ffmpegPath) {
    console.warn("warn ffmpeg-static is not installed, GIF compression will be skipped");
  }

  const files = [];
  for (const sourceDir of SOURCE_DIRS) {
    files.push(...(await walk(path.join(ROOT, sourceDir))));
  }

  const assetFiles = files.filter((filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return IMAGE_EXTS.has(ext) || ext === GIF_EXT;
  });

  let changed = 0;
  let totalSaved = 0;

  console.log(`localtify asset compression ${DRY_RUN ? "dry run" : "run"}`);
  console.log(`scanning ${assetFiles.length} asset file(s)`);

  for (const filePath of assetFiles) {
    const ext = path.extname(filePath).toLowerCase();
    let result = { changed: false, saved: 0 };

    if (ext === GIF_EXT) {
      result = await compressGif(filePath, ffmpegPath);
    } else if (sharp && IMAGE_EXTS.has(ext)) {
      result = await compressImage(filePath, sharp);
    }

    if (result.changed) changed += 1;
    totalSaved += result.saved;
  }

  console.log(`done: ${changed} file(s) ${DRY_RUN ? "would change" : "changed"}, saved ${prettyBytes(totalSaved)}`);

  if (BACKUP && !DRY_RUN && changed) {
    console.log(`backup saved at: ${path.relative(ROOT, backupDir)}`);
  }
};

if (CLEAN_BUILD_OUTPUT) {
  await cleanBuildOutput();
} else {
  await compressAssets();
}