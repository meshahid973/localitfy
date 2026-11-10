"use strict";
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { getAddon, warnOnce } = require("./backend.cjs");

// These extensions exactly mirror the existing metadata-service supported formats.
// Filtering through isAudioFile() again on the main side preserves the app callback.
const EXTENSIONS = Object.freeze(["mp3","flac","m4a","aac","ogg","opus","wav","aiff","aif"]);
const TIMEOUT_MS = 30_000;

async function tryScanAudioFiles(root, isAudioFile, limit) {
  if (!getAddon("scanner")) return null;
  // The existing callback may be customised in tests/extensions. Unknown semantics
  // must use JavaScript instead of producing an incomplete native scan.
  try {
    if (!EXTENSIONS.every((ext) => isAudioFile(path.join(root,"probe."+ext))) ||
        isAudioFile(path.join(root,"probe.notmusic"))) return null;
  } catch (error) { warnOnce("scanner", error); return null; }
  return new Promise((resolve) => {
    let worker;
    try {
      worker = new Worker(path.join(__dirname, "scanner-worker.cjs"), {
        workerData: { root, limit, extensions: EXTENSIONS }
      });
    } catch(error) { warnOnce("scanner", error); resolve(null); return; }
    let finished = false;
    const complete = (value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(value);
    };
    const timer = setTimeout(() => { warnOnce("scanner", new Error("Native scan deadline exceeded")); complete(null); }, TIMEOUT_MS);
    worker.once("message", (result) => {
      if (!result?.ok || !Array.isArray(result.files) || result.truncated === true ||
        result.files.length > limit || result.files.some((f) => typeof f !== "string")) {
        if (result?.error) warnOnce("scanner", new Error(result.error));
        return complete(null);
      }
      try { complete(result.files.filter(isAudioFile)); }
      catch(error) { warnOnce("scanner", error); complete(null); }
    });
    worker.once("error", (error) => { warnOnce("scanner", error); complete(null); });
    worker.once("exit", (code) => { if (!finished) { warnOnce("scanner",new Error("Native worker exited: "+code)); complete(null); } });
  });
}
module.exports = { tryScanAudioFiles };
