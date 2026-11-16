"use strict";

const os = require("node:os");
const { getAddon, warnOnce } = require("../native/backend.cjs");
const IS_LITTLE_ENDIAN = os.endianness() === "LE";

function decodePcmChunk(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length % 4 !== 0) {
    throw new Error("Invalid decoded PCM buffer");
  }
  const count = buffer.length / 4;
  const native = getAddon("pcm");
  const aligned = IS_LITTLE_ENDIAN && buffer.byteOffset % 4 === 0;
  // Unaligned data previously required a JS readFloatLE and a JS/native energy pass.
  // Keep the aligned zero-copy fast path, and use one native call otherwise.
  if (!aligned && count >= 32_768 && count <= 1_000_000 && native && typeof native.pcmDecodeInto === "function") {
    try {
      const samples = new Float32Array(count);
      const squareSum = native.pcmDecodeInto(buffer, samples);
      if (!Number.isFinite(squareSum) || squareSum < 0) throw new Error("Invalid PCM energy");
      return { samples, squareSum };
    } catch (error) { warnOnce("pcm", error); }
  }
  // FFmpeg emits little-endian f32. Reuse its backing memory when safe.
  const samples = aligned
    ? new Float32Array(buffer.buffer, buffer.byteOffset, count)
    : Float32Array.from({ length: count }, (_, i) => buffer.readFloatLE(i * 4));

  if (count >= 32_768 && native && typeof native.pcmSumSquares === "function") {
    try {
      const squareSum = native.pcmSumSquares(samples);
      if (!Number.isFinite(squareSum) || squareSum < 0) throw new Error("Invalid PCM energy");
      return { samples, squareSum };
    } catch (error) {
      warnOnce("pcm", error);
    }
  }

  let squareSum = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) throw new Error("Decoded audio contains invalid samples");
    squareSum += sample * sample;
  }
  return { samples, squareSum };
}

module.exports = { decodePcmChunk };
