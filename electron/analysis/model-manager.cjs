const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { MODEL } = require("./model.cjs");

function createModelManager(root, { fetchImpl = globalThis.fetch, model = MODEL, inactivityTimeoutMs = 90_000, downloadTimeoutMs = 1_800_000 } = {}) {
  const installedPath = path.join(root, model.id);
  let state = "not-installed";
  let downloadedBytes = 0;
  let error = "";
  let controller = null;
  let pending = null;
  let removing = false;
  const totalBytes = model.files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes > 150_000_000) throw new Error("Model exceeds the 150 MB download limit");

  async function verify(directory) {
    for (const file of model.files) {
      const target = path.join(directory, file.path);
      const stat = await fs.promises.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.bytes) throw new Error("Model file is incomplete");
      const hash = crypto.createHash("sha256");
      for await (const bytes of fs.createReadStream(target)) hash.update(bytes);
      if (hash.digest("hex") !== file.sha256) throw new Error("Model checksum does not match");
    }
  }

  const initialized = (async () => {
    try {
      const entries = await fs.promises.readdir(root).catch(() => []);
      for (const name of entries) {
        if (name.startsWith(`${model.id}.partial-`)) await fs.promises.rm(path.join(root, name), { recursive: true, force: true });
      }
      await verify(installedPath);
      state = "ready";
      downloadedBytes = totalBytes;
    } catch {
      state = "not-installed";
    }
  })();

  function status() {
    return { state, downloadedBytes, totalBytes, error };
  }

  async function download() {
    await initialized;
    if (removing || pending || state === "ready") return status();
    controller = new AbortController();
    const overallTimeout = AbortSignal.timeout(downloadTimeoutMs);
    const signal = AbortSignal.any([controller.signal, overallTimeout]);
    state = "downloading";
    downloadedBytes = 0;
    error = "";
    const staging = path.join(root, `${model.id}.partial-${crypto.randomUUID()}`);
    pending = (async () => {
      let finalState = "ready";
      let finalError = "";
      try {
        await fs.promises.mkdir(staging, { recursive: true });
        for (const file of model.files) {
          signal.throwIfAborted();
          const inactivity = new AbortController();
          let idleTimer;
          const resetInactivity = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => inactivity.abort(new Error("Model download stalled")), inactivityTimeoutMs);
          };
          const fileSignal = AbortSignal.any([signal, inactivity.signal]);
          try {
            resetInactivity();
            const url = `https://huggingface.co/Xenova/clap-htsat-unfused/resolve/${model.revision}/${file.path}`;
            const response = await fetchImpl(url, { signal: fileSignal });
          if (!response.ok || !response.body) throw new Error(`Model download failed (${response.status})`);
          const length = response.headers.get("content-length");
          if (length && !response.headers.get("content-encoding") && Number(length) !== file.bytes) throw new Error("Unexpected model download size");
          const target = path.join(staging, file.path);
          await fs.promises.mkdir(path.dirname(target), { recursive: true });
          let received = 0;
          const hash = crypto.createHash("sha256");
          const check = new Transform({ transform(chunk, _encoding, callback) {
            received += chunk.length;
            downloadedBytes += chunk.length;
            if (received > file.bytes || downloadedBytes > totalBytes) return callback(new Error("Model download exceeded its size limit"));
            hash.update(chunk);
            resetInactivity();
            callback(null, chunk);
          } });
          await pipeline(Readable.fromWeb(response.body), check, fs.createWriteStream(target, { flags: "wx" }), { signal: fileSignal });
            if (received !== file.bytes || hash.digest("hex") !== file.sha256) throw new Error("Model verification failed; please retry the download");
          } catch (reason) {
            if (inactivity.signal.aborted && !controller.signal.aborted) throw new Error("Model download stalled. Please retry.");
            if (overallTimeout.aborted && !controller.signal.aborted) throw new Error("Model download timed out. Please retry.");
            throw reason;
          } finally {
            clearTimeout(idleTimer);
          }
        }
        signal.throwIfAborted();
        // A corrupt previous installation is replaced only after the entire new download verifies.
        await fs.promises.rm(installedPath, { recursive: true, force: true });
        await fs.promises.rename(staging, installedPath);
      } catch (reason) {
        finalState = controller.signal.aborted ? "not-installed" : "error";
        finalError = controller.signal.aborted ? "" : String(reason?.message || "Model download failed");
      } finally {
        await fs.promises.rm(staging, { recursive: true, force: true }).catch(() => undefined);
        state = finalState;
        error = finalError;
        controller = null;
        pending = null;
      }
    })();
    return status();
  }

  async function cancel() {
    controller?.abort();
    await pending;
    return status();
  }

  async function remove() {
    removing = true;
    try {
      await initialized;
      await cancel();
      await fs.promises.rm(installedPath, { recursive: true, force: true });
      state = "not-installed";
      downloadedBytes = 0;
      error = "";
      return status();
    } finally { removing = false; }
  }

  return { initialized, status, download, cancel, remove, installedPath, metadata: { ...model, bytes: totalBytes, files: undefined } };
}
module.exports = { createModelManager };
