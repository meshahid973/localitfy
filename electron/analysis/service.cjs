const fs = require("node:fs");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { MODEL, TEXT_MODEL, ANALYZER_VERSION } = require("./model.cjs");
const { createModelManager } = require("./model-manager.cjs");

function createAnalysisService({ root, ffmpegPath, repositories, powerMonitor, modelManager, textModelManager, workerFactory = (file, options) => new Worker(file, options), statFile = fs.promises.stat }) {
  const manager = modelManager || createModelManager(root);
  // Optional text encoder for "playlist from a prompt"; audio analysis never needs it.
  const textManager = textModelManager || createModelManager(root, { model: TEXT_MODEL });
  const managerFor = (target) => {
    if (target === undefined || target === null) return manager;
    if (target === "prompt") return textManager;
    throw new TypeError("Unknown model");
  };
  let worker = null;
  let paused = true;
  let running = false;
  let scanning = false;
  let generation = 0;
  let queue = [];
  let current = null;
  let completed = 0;
  let failed = 0;
  let error = "";
  let disposed = false;
  let jobTimer = null;
  const supported = !(process.platform === "darwin" && process.arch === "x64");

  const enabled = () => repositories.settings.get().experimentalMusicAnalysis === true;
  const allowOnBattery = () => repositories.settings.get().analysisOnBattery === true;
  const onBattery = () => powerMonitor?.isOnBatteryPower?.() === true;

  async function stop() {
    paused = true;
    clearTimeout(jobTimer);
    generation += 1;
    queue = [];
    current = null;
    running = false;
    const previous = worker;
    worker = null;
    await closeWorker(previous);
  }

  async function closeWorker(instance) {
    if (!instance) return;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 500);
      instance.once("exit", () => { clearTimeout(timer); resolve(); });
      instance.postMessage({ cancel: true });
    });
    await instance.terminate();
  }

  async function status() {
    await manager.initialized;
    await textManager.initialized;
    const records = repositories.analysis.list();
    const currentRecords = records.filter((record) => record.modelId === MODEL.id && record.analyzerVersion === ANALYZER_VERSION);
    return { supported, enabled: enabled(), historyEnabled: repositories.settings.get().listeningHistoryEnabled !== false, allowOnBattery: allowOnBattery(),
      model: manager.metadata, download: manager.status(), promptModel: { ...textManager.metadata, download: textManager.status() }, paused, running, scanning,
      queued: queue.length, currentSongId: current?.songId || null, completed, failed,
      analyzed: currentRecords.filter((record) => record.status === "ready").length,
      failures: currentRecords.filter((record) => record.status === "failed").length,
      onBattery: onBattery(), error };
  }

  function next() {
    if (paused || disposed || !enabled() || (onBattery() && !allowOnBattery()) || current || !worker) return;
    const job = queue.shift();
    if (!job) {
      running = false;
      const finished = worker;
      worker = null;
      generation += 1;
      void closeWorker(finished);
      return;
    }
    current = job;
    running = true;
    jobTimer = setTimeout(() => {
      if (!current || current.songId !== job.songId) return;
      repositories.analysis.save({ ...job, error: "Analysis timed out. Retry this track." });
      error = "A track exceeded the analysis time limit. Retry analysis to continue.";
      void stop();
    }, 120_000);
    worker.postMessage(job);
  }

  function makeWorker(token) {
    const instance = workerFactory(path.join(__dirname, "worker.cjs"), { workerData: { modelPath: manager.installedPath, ffmpegPath }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    instance.on("message", async (result) => {
      if (token !== generation || !current || current.songId !== result.songId) return;
      clearTimeout(jobTimer);
      const job = current;
      try {
        const stat = await statFile(job.filePath);
        if (token !== generation) return;
        if (stat.size === job.fileSize && stat.mtimeMs === job.fileMtime) {
          if (repositories.analysis.save({ ...job, ...result })) {
            if (result.error) failed += 1;
            else completed += 1;
          }
        }
      } catch { failed += 1; }
      if (token !== generation) return;
      current = null;
      setTimeout(next, 100);
    });
    instance.on("error", (reason) => {
      if (token !== generation) return;
      error = String(reason.message || "Analysis worker failed");
      void stop();
    });
    instance.on("exit", (code) => {
      if (token !== generation) return;
      clearTimeout(jobTimer);
      if (code !== 0) error = "Analysis worker stopped unexpectedly. Retry analysis.";
      worker = null;
      current = null;
      running = false;
      paused = true;
    });
    return instance;
  }

  async function start({ retry = false } = {}) {
    if (scanning || disposed) return status();
    scanning = true;
    const requestedGeneration = generation;
    try {
      await manager.initialized;
      if (requestedGeneration !== generation || disposed) return status();
      if (!supported) throw new Error("Music analysis currently requires Apple silicon on macOS");
      if (!enabled() || manager.status().state !== "ready") throw new Error("Enable analysis and download the model first");
      if (onBattery() && !allowOnBattery()) throw new Error("Connect to power before starting analysis");
      await stop();
      paused = false;
      completed = 0;
      failed = 0;
      error = "";
      const token = generation;
      const records = new Map(repositories.analysis.list().map((record) => [record.songId, record]));
      for (const song of repositories.songs.list()) {
        if (token !== generation || disposed) break;
        try {
          const stat = await statFile(song.filePath);
          if (!stat.isFile()) continue;
          const prior = records.get(song.id);
          const matches = prior && prior.filePath === song.filePath && prior.fileSize === stat.size && prior.fileMtime === stat.mtimeMs
            && prior.modelId === MODEL.id && prior.analyzerVersion === ANALYZER_VERSION;
          if (matches && (prior.status === "ready" || !retry)) continue;
          queue.push({ songId: song.id, filePath: song.filePath, duration: song.duration, fileSize: stat.size, fileMtime: stat.mtimeMs });
        } catch { /* Missing files are excluded, not treated as negative preference evidence. */ }
      }
      if (token === generation && !disposed && !paused && enabled() && queue.length) {
        worker = makeWorker(token);
        next();
      }
    } finally { scanning = false; }
    return status();
  }

  async function setEnabled(value) {
    if (typeof value !== "boolean") throw new TypeError("Expected a boolean");
    repositories.settings.save({ experimentalMusicAnalysis: value });
    if (!value) { await stop(); await manager.cancel(); await textManager.cancel(); }
    return status();
  }
  async function setAllowOnBattery(value) {
    if (typeof value !== "boolean") throw new TypeError("Expected a boolean");
    repositories.settings.save({ analysisOnBattery: value });
    if (!value && onBattery()) await stop();
    return status();
  }
  const suspend = () => { void stop(); };
  const batteryChanged = () => { if (!allowOnBattery()) void stop(); };
  powerMonitor?.on("suspend", suspend);
  powerMonitor?.on("on-battery", batteryChanged);

  return {
    status, start,
    pause: async () => { await stop(); return status(); },
    setEnabled, setAllowOnBattery,
    download: async (target) => { const selected = managerFor(target); if (!supported) throw new Error("Music analysis currently requires Apple silicon on macOS"); if (!enabled()) throw new Error("Enable experimental analysis first"); await selected.download(); return status(); },
    cancelDownload: async (target) => { await managerFor(target).cancel(); return status(); },
    removeModel: async (target) => { const selected = managerFor(target); if (selected === manager) await stop(); await selected.remove(); return status(); },
    /** The installed text encoder, or null when prompts can only use names, genres and listening history. */
    promptModelPath: async () => {
      await textManager.initialized;
      return supported && enabled() && textManager.status().state === "ready" ? textManager.installedPath : null;
    },
    clearAnalysis: async () => { await stop(); repositories.analysis.clear(); return status(); },
    clearHistory: async () => { repositories.listening.clear(); return status(); },
    setHistoryEnabled: async (value) => {
      if (typeof value !== "boolean") throw new TypeError("Expected a boolean");
      repositories.settings.save({ listeningHistoryEnabled: value, listeningHistoryClearedAt: Date.now() });
      return status();
    },
    dispose: async () => {
      disposed = true;
      powerMonitor?.removeListener("suspend", suspend);
      powerMonitor?.removeListener("on-battery", batteryChanged);
      await stop(); await manager.cancel(); await textManager.cancel();
    }
  };
}
module.exports = { createAnalysisService };
