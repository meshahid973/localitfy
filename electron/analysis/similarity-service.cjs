const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { validateSimilarityRequest } = require("./similarity.cjs");
const { validatePromptSoundRequest } = require("./prompt-sound.cjs");

function createSimilarityService({ getDatabasePath, workerFactory = (file, options) => new Worker(file, options) }) {
  const active = new Set();
  let disposed = false;
  function run(workerFile, request, extra = {}) {
    if (disposed) throw new Error("Recommendation search is unavailable");
    if (active.size >= 2) throw new Error("Recommendations are still being calculated. Please retry shortly.");
    return new Promise((resolve, reject) => {
      const worker = workerFactory(path.join(__dirname, workerFile), {
        workerData: { ...extra, databasePath: getDatabasePath(), request }, resourceLimits: { maxOldGenerationSizeMb: 256 }
      });
      let settled = false;
      const cancel = () => finish(new Error("Recommendation search stopped"));
      const timer = setTimeout(() => finish(new Error("Recommendation search took too long. Please retry.")), 45_000);
      function finish(error, result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        active.delete(cancel);
        void worker.terminate().catch(() => undefined);
        if (error) reject(error);
        else resolve(result);
      }
      active.add(cancel);
      worker.once("message", (message) => message.error ? finish(new Error(message.error)) : finish(null, message.result));
      worker.once("error", () => finish(new Error("Recommendation search failed. Please retry.")));
      worker.once("exit", () => finish(new Error("Recommendation search stopped before completing. Please retry.")));
    });
  }
  return {
    find: (payload) => run("similarity-worker.cjs", validateSimilarityRequest(payload)),
    // `modelPath` is the installed text encoder, resolved by the caller from the model manager.
    promptSound: (payload, modelPath) => run("prompt-sound-worker.cjs", validatePromptSoundRequest(payload), { modelPath }),
    dailyMixes: (payload) => run("daily-mixes-worker.cjs", require("./daily-mixes.cjs").validateDailyMixRequest(payload)),
    dispose: () => { disposed = true; for (const cancel of [...active]) cancel(); } };
}
module.exports = { createSimilarityService };
