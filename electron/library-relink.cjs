"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const MAX_SCANNED_FILES = 30000;
const MAX_SCANNED_DIRECTORIES = 1500;

function normalizedName(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, " ").trim();
}

function normalizedPath(value) {
  const resolved = path.resolve(String(value || ""));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/**
 * Read-only, bounded scan. Only unambiguous exact-filename candidates with
 * compatible embedded metadata are considered. Truncated scans must NOT apply.
 */
async function findMovedSongCandidates(rootDirectory, songs, {
  readMetadata = async () => ({}),
  isAudioFile = () => false,
  fileExists = () => false,
  maxFiles = MAX_SCANNED_FILES,
  maxDirectories = MAX_SCANNED_DIRECTORIES
} = {}) {
  const missing = songs.filter(song => song?.filePath && !fileExists(song.filePath));
  const usedPaths = new Set(songs.filter(song => song?.filePath && fileExists(song.filePath)).map(song => normalizedPath(song.filePath)));
  const missingByName = new Map();
  for (const song of missing) {
    const key = path.basename(song.filePath).toLocaleLowerCase();
    const group = missingByName.get(key) || [];
    group.push(song);
    missingByName.set(key, group);
  }
  const discovered = new Map();
  const pending = [rootDirectory];
  let scannedFiles = 0;
  let scannedDirectories = 0;
  let truncated = false;

  while (pending.length) {
    if (scannedDirectories >= maxDirectories) { truncated = true; break; }
    const directory = pending.pop();
    scannedDirectories += 1;
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch { continue; }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(candidate);
      } else if (entry.isFile()) {
        scannedFiles += 1;
        if (scannedFiles > maxFiles) { truncated = true; break; }
        if (!isAudioFile(candidate) || usedPaths.has(normalizedPath(candidate))) continue;
        const key = entry.name.toLocaleLowerCase();
        if (!missingByName.has(key)) continue;
        const group = discovered.get(key) || [];
        group.push(candidate);
        discovered.set(key, group);
      }
    }
    if (truncated) break;
    // Yield between directories to keep Electron responsive during large scans.
    await new Promise(resolve => setImmediate(resolve));
  }

  if (truncated) return { matches: [], missingCount: missing.length, ambiguous: 0, scannedFiles, scannedDirectories, truncated: true };

  const matches = [];
  let ambiguous = 0;
  for (const [key, candidates] of discovered) {
    const oldSongs = missingByName.get(key) || [];
    if (oldSongs.length !== 1 || candidates.length !== 1) { ambiguous += Math.max(oldSongs.length, candidates.length); continue; }
    const song = oldSongs[0];
    const nextPath = candidates[0];
    try {
      const metadata = await readMetadata(nextPath);
      const oldDuration = Number(song.duration || (Number(song.durationMs || 0) / 1000) || 0);
      const newDuration = Number(metadata?.duration || (Number(metadata?.durationMs || 0) / 1000) || 0);
      if (oldDuration > 0 && newDuration > 0 && Math.abs(oldDuration - newDuration) > 3) { ambiguous++; continue; }
      const oldTitle = normalizedName(song.title);
      const newTitle = normalizedName(metadata?.title);
      if (oldTitle && newTitle && oldTitle !== newTitle) { ambiguous++; continue; }
      const oldArtist = normalizedName(song.artist);
      const newArtist = normalizedName(metadata?.artist);
      if (oldArtist && newArtist && oldArtist !== newArtist && oldArtist !== "unknown artist") { ambiguous++; continue; }
      matches.push({ id: song.id, oldPath: song.filePath, newPath: nextPath, title: song.title || path.parse(nextPath).name });
    } catch { ambiguous++; }
  }
  return { matches, missingCount: missing.length, ambiguous, scannedFiles, scannedDirectories, truncated: false };
}

module.exports = { findMovedSongCandidates };
