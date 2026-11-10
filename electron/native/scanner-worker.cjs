"use strict";
const { parentPort, workerData } = require("node:worker_threads");
const { getAddon } = require("./backend.cjs");
try {
  const native = getAddon("scanner");
  if (!native || typeof native.scanAudioFiles !== "function") throw new Error("Native scanner unavailable");
  const result = native.scanAudioFiles(workerData.root, workerData.limit, workerData.extensions);
  parentPort.postMessage({ ok: true, files: result.files, truncated: result.truncated });
} catch(error) {
  parentPort.postMessage({ ok: false, error: error?.message || "Native scan failed" });
} finally {
  parentPort.close();
}
