const { parentPort, workerData } = require("node:worker_threads");
const { spawn } = require("node:child_process");
const { MODEL } = require("./model.cjs");
const { decodePcmChunk } = require("./pcm.cjs");
let runtime;
let activeChild = null;

async function load() {
  const { env, AutoProcessor, ClapAudioModelWithProjection } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  env.useBrowserCache = false;
  env.useFSCache = false;
  const options = { local_files_only: true };
  const processor = await AutoProcessor.from_pretrained(workerData.modelPath, options);
  const model = await ClapAudioModelWithProjection.from_pretrained(workerData.modelPath, {
    ...options, dtype: "q8", device: "cpu", session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 }
  });
  return { processor, model };
}

function decode(filePath, offset) {
  return new Promise((resolve, reject) => {
    const child = spawn(workerData.ffmpegPath, ["-nostdin", "-v", "error", "-threads", "1", "-ss", String(offset),
      "-i", filePath, "-t", "10", "-vn", "-ac", "1", "-ar", String(MODEL.sampleRate), "-f", "f32le", "pipe:1"], { windowsHide: true });
    activeChild = child;
    const chunks = [];
    let size = 0;
    let stderr = "";
    const timeout = setTimeout(() => child.kill(), 30_000);
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > MODEL.sampleRate * 10 * 4) child.kill();
      else chunks.push(chunk);
    });
    child.stderr.on("data", (chunk) => { if (stderr.length < 1000) stderr += chunk.toString(); });
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("close", (code) => {
      activeChild = null;
      clearTimeout(timeout);
      if (code !== 0 || size < 4 || size > MODEL.sampleRate * 10 * 4) return reject(new Error(stderr || "Audio decode failed or timed out"));
      const buffer = Buffer.concat(chunks);
      try { resolve(decodePcmChunk(buffer)); }
      catch (error) { reject(error); }
    });
  });
}

parentPort.on("message", async (job) => {
  if (job.cancel) { activeChild?.kill(); parentPort.close(); return; }
  try {
    runtime ||= load();
    const { processor, model } = await runtime;
    // Three bounded windows cover the track without decoding the entire file into memory.
    const end = Math.max(0, Number(job.duration || 0) - 10);
    const offsets = [...new Set([0, Math.floor(end / 2), Math.floor(end)])];
    const vector = new Float32Array(MODEL.dimensions);
    let squareSum = 0;
    let sampleCount = 0;
    for (const offset of offsets) {
      const { samples, squareSum: windowSquares } = await decode(job.filePath, offset);
      squareSum += windowSquares;
      sampleCount += samples.length;
      const inputs = await processor(samples, { sampling_rate: MODEL.sampleRate });
      const { audio_embeds } = await model(inputs);
      if (audio_embeds.data.length !== MODEL.dimensions) throw new Error("Unexpected embedding size");
      const windowNorm = Math.hypot(...audio_embeds.data);
      if (!Number.isFinite(windowNorm) || windowNorm <= 0) throw new Error("Invalid window embedding");
      for (let i = 0; i < vector.length; i++) vector[i] += audio_embeds.data[i] / windowNorm / offsets.length;
    }
    const norm = Math.hypot(...vector);
    if (!Number.isFinite(norm) || norm <= 0) throw new Error("Invalid audio embedding");
    for (let i = 0; i < vector.length; i++) vector[i] /= norm;
    parentPort.postMessage({ songId: job.songId, vector, rms: Math.sqrt(squareSum / sampleCount) });
  } catch (error) {
    parentPort.postMessage({ songId: job.songId, error: String(error?.message || "Analysis failed") });
  }
});
