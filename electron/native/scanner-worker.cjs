"use strict";
const { parentPort } = require("node:worker_threads");
const { getAddon } = require("./backend.cjs");

// Run bounded directory enumeration in a persistent worker. Every result is
// tagged with its request id so concurrent watch/scan requests cannot cross.
parentPort.on("message", ({ id, root, limit, extensions }) => {
  try {
    const native = getAddon("scanner");
    if (!native || typeof native.scanAudioFiles !== "function") throw new Error("Native scanner unavailable");
    const result = native.scanAudioFiles(root, limit, extensions);
    parentPort.postMessage({ id, ok: true, files: result.files, truncated: result.truncated });
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: error?.message || "Native scan failed" });
  }
});
