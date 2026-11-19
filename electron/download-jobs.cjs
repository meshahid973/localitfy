"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { publicationTemporaryPath } = require("./download-publication.cjs");

const STATES = new Set(["queued", "downloading", "converting", "importing", "done", "failed", "cancelled", "interrupted"]);
const UNFINISHED = new Set(["queued", "downloading", "converting", "importing"]);
const LIMIT = 500;
const MAX_BYTES = 8 * 1024 * 1024;
const clone = value => structuredClone(value);

function normalizeRequest(request) {
  if (!["youtube", "spotify"].includes(request?.source)) throw new Error("Unknown download source");
  const url = new URL(String(request.url || ""));
  const hosts = request.source === "youtube" ? ["www.youtube.com"] : ["open.spotify.com"];
  if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port) throw new Error("Invalid download URL");
  if (!path.isAbsolute(request.folder || "")) throw new Error("Download folder must be absolute");
  const options = request.options || {};
  const result = {
    source: request.source, url: url.href, folder: path.resolve(request.folder),
    options: {
      format: ["mp3", "flac", "wav", "m4a"].includes(options.format) ? options.format : "mp3",
      quality: ["best", "320", "256", "192"].includes(options.quality) ? options.quality : "best",
      keepOriginal: options.keepOriginal === true, cleanTitle: options.cleanTitle !== false, autoAdd: options.autoAdd !== false
    }
  };
  if (request.source === "spotify") {
    const track = request.track;
    if (!track || !/^[a-zA-Z0-9]{1,64}$/.test(String(track.id || ""))) throw new Error("A Spotify track identity is required");
    result.track = {};
    for (const key of ["id", "title", "artist", "albumName", "spotifyUrl", "isrc", "coverUrl", "albumCoverUrl", "spotifyCoverUrl"]) {
      if (typeof track[key] === "string") result.track[key] = track[key].slice(0, 2000);
    }
    for (const key of ["duration", "durationMs"]) if (Number.isFinite(track[key]) && track[key] >= 0) result.track[key] = track[key];
  }
  return result;
}

function requestKey(request) {
  // Filesystem identity follows the host's semantics, never a blanket lowercase.
  const folder = process.platform === "win32" ? request.folder.toLowerCase() : request.folder;
  const { autoAdd: _autoAdd, ...audioOptions } = request.options;
  return crypto.createHash("sha256").update(JSON.stringify([request.source, request.url, folder, audioOptions])).digest("hex");
}

function hashFile(filename) {
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  const descriptor = fs.openSync(filename, "r");
  try {
    let read;
    while ((read = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, read));
    return hash.digest("hex");
  } finally { fs.closeSync(descriptor); }
}

/** Main-process-owned journal. Persist state transitions before starting external work. */
function createDownloadJobStore(userDataPath, { now = Date.now } = {}) {
  const directory = path.join(userDataPath, "download-jobs");
  const filename = path.join(directory, "jobs.json");
  fs.mkdirSync(directory, { recursive: true });
  let jobs = new Map();

  function persist(next) {
    const temporary = path.join(directory, `jobs-${crypto.randomUUID()}.tmp`);
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, "wx", 0o600);
      const contents = JSON.stringify({ version: 1, jobs: [...next.values()] });
      if (Buffer.byteLength(contents) > MAX_BYTES) throw new Error("Download recovery journal exceeds its size limit");
      fs.writeFileSync(descriptor, contents);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      fs.renameSync(temporary, filename);
      jobs = next;
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      fs.rmSync(temporary, { force: true });
    }
  }

  if (fs.existsSync(filename)) {
    if (fs.statSync(filename).size > MAX_BYTES) throw new Error("Download recovery journal exceeds its size limit");
    let saved;
    try { saved = JSON.parse(fs.readFileSync(filename, "utf8")); }
    catch { throw new Error("Download recovery journal is unreadable; preserve it before repairing download storage"); }
    if (saved.version !== 1 || !Array.isArray(saved.jobs) || saved.jobs.length > LIMIT) throw new Error("Unsupported download recovery journal");
    for (const item of saved.jobs) {
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(item.id || "") || !STATES.has(item.status)) throw new Error("Invalid download recovery job");
      const request = normalizeRequest(item.request);
      if (item.key !== requestKey(request)) throw new Error("Download recovery job identity does not match its request");
      const recovered = { ...item, request };
      if (UNFINISHED.has(item.status)) {
        recovered.status = "interrupted";
        recovered.message = "Interrupted by application restart. Resume when ready.";
        recovered.updatedAt = now();
      }
      if (jobs.has(item.id)) throw new Error("Duplicate download recovery identity");
      jobs.set(item.id, recovered);
      try { fs.rmSync(publicationTemporaryPath(request.folder, item.id), { force: true }); }
      catch (error) { console.warn("[localtify stale download publication]", error.message); }
    }
    persist(new Map(jobs));
  }

  function get(id) { const job = jobs.get(id); return job ? clone(job) : null; }
  function list() { return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt).map(clone); }
  function prepare(input) {
    const request = normalizeRequest(input);
    const key = requestKey(request);
    const old = [...jobs.values()].find(job => job.key === key && job.status !== "cancelled");
    if (["done", "interrupted"].includes(old?.status) && old.result?.ok && old.result.filePath) {
      try {
        const stat = fs.statSync(old.result.filePath);
        if (stat.isFile() && stat.size === old.sizeBytes && (stat.mtimeMs === old.mtimeMs || old.sha256 && hashFile(old.result.filePath) === old.sha256)) return { ...clone(old), status: "done" };
        const pending = old.pendingOutput;
        if (pending && stat.isFile() && stat.ino === pending.ino && stat.dev === pending.dev && stat.birthtimeMs === pending.birthtimeMs && stat.size < old.sizeBytes && path.dirname(old.result.filePath) === request.folder) fs.unlinkSync(old.result.filePath);
      } catch { /* A removed or changed output must be downloaded again. */ }
    }
    const job = {
      id: old?.id || crypto.randomUUID(), key, request,
      createdAt: old?.createdAt || now(), updatedAt: now(), attempts: (old?.attempts || 0) + 1,
      status: "queued", progress: 0, message: "Queued", result: null
    };
    const next = new Map(jobs);
    next.set(job.id, job);
    if (next.size > LIMIT) {
      const removable = [...next.values()].filter(item => ["done", "cancelled"].includes(item.status)).sort((a, b) => a.updatedAt - b.updatedAt);
      while (next.size > LIMIT && removable.length) next.delete(removable.shift().id);
      if (next.size > LIMIT) throw new Error("Download recovery storage is full. Clear completed or cancelled jobs first.");
    }
    persist(next);
    return clone(job);
  }
  function update(id, patch) {
    const old = jobs.get(id);
    if (!old) throw new Error("Download recovery job not found");
    if (patch.status && !STATES.has(patch.status)) throw new Error("Invalid download state");
    const job = { ...old, updatedAt: now() };
    for (const key of ["status", "result", "sizeBytes", "mtimeMs", "pendingOutput", "sha256"]) if (patch[key] !== undefined) job[key] = clone(patch[key]);
    if (patch.progress !== undefined) job.progress = Math.max(0, Math.min(100, Number(patch.progress) || 0));
    if (patch.message !== undefined) job.message = String(patch.message).slice(0, 2000);
    const next = new Map(jobs);
    next.set(id, job);
    persist(next);
    return clone(job);
  }
  function workDirectory(id) {
    if (!jobs.has(id)) throw new Error("Download recovery job not found");
    const target = path.join(directory, id);
    if (fs.existsSync(target)) {
      const root = fs.realpathSync(directory);
      const actual = fs.realpathSync(target);
      if (path.dirname(actual) !== root || fs.lstatSync(target).isSymbolicLink()) throw new Error("Unsafe download work directory");
    }
    return target;
  }
  function cleanWorkDirectory(id) {
    const target = workDirectory(id);
    fs.rmSync(target, { recursive: true, force: true });
  }
  function remove(id) {
    const job = jobs.get(id);
    if (!job) return false;
    if (UNFINISHED.has(job.status)) throw new Error("Cancel the active download before removing it");
    cleanWorkDirectory(id);
    fs.rmSync(publicationTemporaryPath(job.request.folder, id), { force: true });
    const next = new Map(jobs);
    next.delete(id);
    persist(next);
    return true;
  }
  return Object.freeze({ get, list, prepare, update, workDirectory, cleanWorkDirectory, remove });
}

module.exports = { createDownloadJobStore, normalizeRequest, requestKey };
