"use strict";
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { getAddon, warnOnce } = require("./backend.cjs");

const EXTENSIONS = Object.freeze(["mp3", "flac", "m4a", "aac", "ogg", "opus", "wav", "aiff", "aif"]);
const TRUSTED_FILTER = Symbol.for("localtify.nativeScanner.standardAudioFilter");
const TIMEOUT_MS = 30_000;
const MAX_PENDING = 8;
let worker = null;
let disabled = false;
let requestId = 0;
const pending = new Map();

/** Only trusted app-owned predicates can opt in; a broad callback might include other file extensions. */
function markStandardAudioFilter(predicate) {
  if (typeof predicate !== "function" ||
      !EXTENSIONS.every((ext) => predicate("probe." + ext)) ||
      predicate("probe.txt") || predicate("probe.notmusic") || predicate("probe.mp3.tmp")) {
    throw new TypeError("Not the standard Localtify audio extension predicate");
  }
  Object.defineProperty(predicate, TRUSTED_FILTER, { value: true, configurable: false });
  return predicate;
}

function stopWorker(error) {
  const previous = worker;
  worker = null;
  disabled = true; // Fail closed after a crash or timeout; future scans use JS.
  warnOnce("scanner", error);
  for (const [, job] of pending) {
    clearTimeout(job.timer);
    job.resolve(null);
  }
  pending.clear();
  if (previous) void previous.terminate().catch(() => {});
}

function ensureWorker() {
  if (disabled) return null;
  if (worker) return worker;
  try {
    const next = new Worker(path.join(__dirname, "scanner-worker.cjs"));
    next.on("message", (message) => {
      const job = pending.get(message?.id);
      if (!job) return;
      pending.delete(message.id);
      clearTimeout(job.timer);
      if (!message.ok || message.truncated === true || !Array.isArray(message.files) ||
          message.files.length > job.limit ||
          message.files.some((file) => typeof file !== "string" || !path.isAbsolute(file) ||
            !(() => {
              const relative = path.relative(job.root, file);
              return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
            })())) {
        if (message.error) warnOnce("scanner", new Error(message.error));
        job.resolve(null);
        return;
      }
      // Match Node's path.join() contract even if callers supply mixed separators,
      // dot-segments, or repeated delimiters. This must happen before filtering.
      try { job.resolve(message.files.map((file) => path.normalize(file)).filter(job.isAudioFile)); }
      catch (error) { warnOnce("scanner", error); job.resolve(null); }
    });
    next.on("error", (error) => stopWorker(error));
    next.on("exit", (code) => {
      if (worker === next) stopWorker(new Error("Native scanner worker exited: " + code));
    });
    // Attaching message listeners can re-ref the MessagePort on Node/Electron.
    // Unref LAST: an idle native worker must never prevent application exit.
    next.unref();
    worker = next;
    return next;
  } catch (error) {
    stopWorker(error);
    return null;
  }
}

/**
 * Native traversal happens in one persistent worker, not in Electron's main thread.
 * Cold worker startup is a one-time cost. All failures go back to the original
 * asynchronous JS scanner; partial results must never be returned as complete.
 */
async function tryScanAudioFiles(root, isAudioFile, limit) {
  if (!isAudioFile?.[TRUSTED_FILTER] || !getAddon("scanner") ||
      typeof root !== "string" || !root || !Number.isSafeInteger(limit) ||
      limit < 0 || limit > 50_000 || pending.size >= MAX_PENDING) return null;
  const activeWorker = ensureWorker();
  if (!activeWorker) return null;
  return new Promise((resolve) => {
    const id = ++requestId;
    const timer = setTimeout(() => stopWorker(new Error("Native scan deadline exceeded")), TIMEOUT_MS);
    pending.set(id, { resolve, timer, root: path.resolve(root), limit, isAudioFile });
    try { activeWorker.postMessage({ id, root, limit, extensions: EXTENSIONS }); }
    catch (error) { stopWorker(error); }
  });
}
module.exports = { tryScanAudioFiles, markStandardAudioFilter };
