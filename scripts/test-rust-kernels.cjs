"use strict";

const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { getAddon } = require("../electron/native/backend.cjs");
const { decodePcmChunk } = require("../electron/analysis/pcm.cjs");
const { tryDotMatrix, tryClusterFromCenters, tryBatchPairDots, tryDecodeNormalizedAudio } = require("../electron/native/compute.cjs");
const { generateMixes } = require("../electron/analysis/daily-mixes.cjs");
const { findDuplicates } = require("../electron/library-duplicates.cjs");

process.env.LOCALTIFY_RUST_PHASES = "";
assert.equal(getAddon("similarity"), null, "Rust must be disabled by default");
assert.equal(tryDotMatrix([new Float64Array([1,2])],[new Float64Array([3,4])]),null);

process.env.LOCALTIFY_RUST_PHASES = "similarity,duplicates";
const native = getAddon("similarity");
if (!native) throw new Error("Native addon is required for this explicit Rust test");
for(const name of ["dotMatrix", "pairDots", "decodeNormalizedAudioInto", "clusterFromCenters", "pcmSumSquares", "pcmDecodeInto", "dotMatrixInto", "pairDotsInto"]) {
  assert.equal(typeof native[name], "function", "Missing native export: "+name);
}
// Guard against a false-positive parity test caused by a silent JS fallback.
// Count actual NAPI invocations made inside the production integration paths.
const nativeCalls = { dotMatrix: 0, pairDots: 0, decodeNormalizedAudioInto: 0, clusterFromCenters: 0, pcmSumSquares: 0, pcmDecodeInto: 0, dotMatrixInto: 0, pairDotsInto: 0 };
for (const name of Object.keys(nativeCalls)) {
  const original = native[name];
  native[name] = function (...args) {
    nativeCalls[name]++;
    return original.apply(native, args);
  };
  assert.notEqual(native[name], original, name + " export is not writable for instrumentation");
}
const left = [new Float64Array([1,2,3]), new Float64Array([4,5,6])];
const right = [new Float64Array([2,0,1]), new Float64Array([-1,3,0])];
const dotScores = tryDotMatrix(left,right);
assert.deepEqual(dotScores, [5,5,14,11]);
assert.deepEqual(native.pairDots(new Float64Array([1,2,3,4,5,6]),new Uint32Array([0,1]),new Uint32Array([1,0]),3),[32,32]);
assert.equal(tryDotMatrix([new Float64Array([1])],right),null,"mismatch safely falls back");

const vectors = Array.from({length:80},(_,i)=>{
  const array = Float64Array.from({length:512},(_,j) => Math.sin(i*.2+j*.015)+Math.cos(i*.01-j*.03));
  const size=Math.sqrt(array.reduce((sum,n)=>sum+n*n,0));
  return Float64Array.from(array,n=>n/size);
});
const songs = vectors.map((vector,i)=>({
  songId:"id"+String(i).padStart(3,"0"),vector,artist:"artist"+(i%9),
  genre:i%3===0?"rock":i%3===1?"ambient":"electronic",playCount:i%7,liked:i%17===0
}));
function evaluate(mode,fn) {
  process.env.LOCALTIFY_RUST_PHASES = mode;
  return fn();
}
const matrixIntoBefore = nativeCalls.dotMatrixInto;
assert.deepEqual(Array.from(evaluate("similarity,bridge",()=>tryDotMatrix(left,right))), [5,5,14,11]);
assert.ok(nativeCalls.dotMatrixInto > matrixIntoBefore, "typed matrix output must execute Rust");
const rejectedMatrix = new Float64Array([37, 37, 37, 37]);
assert.throws(() => native.dotMatrixInto(
  new Float64Array([1, 2, 3, 4]), new Float64Array([2, 3, 4, 5]),
  rejectedMatrix, 3
), /matrix|dimension/i);
assert.deepEqual(Array.from(rejectedMatrix), [37, 37, 37, 37],
  "invalid matrix must not partially alter the destination");
const rejectedPairs = new Float64Array([37, 37]);
assert.throws(() => native.pairDotsInto(
  new Float64Array([1, 2, 3, 4]), new Uint32Array([0, 1]),
  new Uint32Array([1, 99]), rejectedPairs, 2
), /pair|index/i);
assert.deepEqual(Array.from(rejectedPairs), [37, 37],
  "invalid duplicate indexes must not partially alter the destination");

const pcmBuffer = Buffer.alloc(40_000 * 4);
pcmBuffer.writeFloatLE(0.75, 0);
const pcmReference = evaluate("", () => decodePcmChunk(pcmBuffer));
const beforeNativePcm = nativeCalls.pcmSumSquares;
const pcmActual = evaluate("pcm", () => decodePcmChunk(pcmBuffer));
assert.ok(nativeCalls.pcmSumSquares > beforeNativePcm, "PCM phase must execute Rust");
assert.equal(pcmActual.squareSum, pcmReference.squareSum);
assert.deepEqual(pcmActual.samples, pcmReference.samples);
const unalignedPcm = Buffer.allocUnsafeSlow(pcmBuffer.length + 1).subarray(1);
pcmBuffer.copy(unalignedPcm);
const unalignedReference = evaluate("", () => decodePcmChunk(unalignedPcm));
const beforeUnaligned = nativeCalls.pcmDecodeInto;
const unalignedActual = evaluate("pcm", () => decodePcmChunk(unalignedPcm));
assert.ok(nativeCalls.pcmDecodeInto > beforeUnaligned, "unaligned PCM must execute the new Rust kernel");
assert.deepEqual(unalignedActual.samples, unalignedReference.samples);
assert.equal(unalignedActual.squareSum, unalignedReference.squareSum);
const invalidPcm = Buffer.alloc(8);
invalidPcm.writeFloatLE(NaN, 4);
const rejectedPcm = new Float32Array([37, 37]);
assert.throws(() => native.pcmDecodeInto(invalidPcm, rejectedPcm), /PCM/i);
assert.deepEqual(Array.from(rejectedPcm), [37, 37]);
const rawBuffers=Array.from({length:240},(_,i)=>{
  const buffer=Buffer.alloc(512*4);
  for(let j=0;j<512;j++) buffer.writeFloatLE(Math.sin(i*.15 + j*.045),j*4);
  return buffer;
});
const baselineDecoded=rawBuffers.map((buffer)=>{
  const output=new Float64Array(512);
  let square=0;
  for(let i=0;i<512;i++){const value=buffer.readFloatLE(i*4);output[i]=value;square+=value*value;}
  const norm=Math.sqrt(square);
  for(let i=0;i<512;i++)output[i]/=norm;
  return output;
});
assert.equal(evaluate("",()=>tryDecodeNormalizedAudio(rawBuffers,512)),null,
  "bulk CLAP decoder must be disabled when Rust is off");
const beforeNativeDecoder = nativeCalls.decodeNormalizedAudioInto;
const decoded=evaluate("similarity",()=>tryDecodeNormalizedAudio(rawBuffers,512));
assert.ok(nativeCalls.decodeNormalizedAudioInto > beforeNativeDecoder && decoded?.length === 240,
  "bulk CLAP decoder must use native Rust");
for(let i=0;i<decoded.length;i++)for(let j=0;j<512;j++)
  assert.ok(Math.abs(decoded[i][j]-baselineDecoded[i][j])<1e-12,
    "Float32 CLAP decoder parity changed at "+i+":"+j);
const badBuffers=rawBuffers.slice();badBuffers[15]=Buffer.alloc(2048);
assert.equal(evaluate("similarity",()=>tryDecodeNormalizedAudio(badBuffers,512)),null,
  "zero vector must fall back to per-record JS validation");

const mixesJs = evaluate("",()=>generateMixes(songs,"2026-11-10:0"));
const mixesRust = evaluate("similarity",()=>generateMixes(songs,"2026-11-10:0"));
assert.deepEqual(mixesRust,mixesJs,"Daily Mixes outputs changed");
const largeSongs = Array.from({ length: 600 }, (_, index) => ({
  ...songs[index % songs.length], songId: "large-" + String(index).padStart(4, "0")
}));
const largeMixesJs = evaluate("", () => generateMixes(largeSongs, "2026-11-10:large"));
const beforeLargeMixes = nativeCalls.clusterFromCenters;
const largeMixesRust = evaluate("similarity", () => generateMixes(largeSongs, "2026-11-10:large"));
assert.ok(nativeCalls.clusterFromCenters > beforeLargeMixes,
  "large-library Daily Mixes must actually invoke native full Lloyd clustering");
assert.deepEqual(largeMixesRust, largeMixesJs, "large-library native clustering changed Daily Mixes");

const dupSongs=Array.from({length:100},(_,i)=>{
  const k=Math.floor(i/2);
  return {id:"song-"+i,title:"track "+k,artist:"artist "+(k%11),
    album:"album "+(k%4),duration:150+k%30,playCount:i%6,liked:i%2===0,
    filePath:path.join(os.tmpdir(),"rust-duplicate-fixture","copy"+(i%2),"track-"+k+".mp3"),
    fileExists:true,dateAdded:"2026-01-01T00:00:00.000Z"};
});
const dupVectors=new Map(dupSongs.map((song,i)=>[song.id,vectors[Math.floor(i/2)%vectors.length]]));
const sizes=new Map(dupSongs.map(s=>[s.id,5000000]));
const a=evaluate("",()=>findDuplicates(dupSongs,{vectors:dupVectors,fileSizes:sizes}));
const b=evaluate("duplicates",()=>findDuplicates(dupSongs,{vectors:dupVectors,fileSizes:sizes}));
assert.deepEqual(b,a,"duplicate grouping/recommendation changed");

// Batch a real candidate group so the Rust comparison is exercised once rather than
// launching a separate native call for each two-song recording.
const bulkBucket = Array.from({ length: 64 }, (_, i) => ({
  ...dupSongs[i], title: "same track", artist: "same artist", album: "same album"
}));
const nativeBatch = evaluate("duplicates", () => tryBatchPairDots([bulkBucket], dupVectors));
assert.ok(Array.isArray(nativeBatch) && nativeBatch.length === 2016,
  "large duplicate bucket must use the native path");
const bulkJs = evaluate("", () => findDuplicates(bulkBucket, { vectors: dupVectors, fileSizes: sizes }));
const beforeBulkDuplicates = nativeCalls.pairDots;
const bulkRust = evaluate("duplicates", () => findDuplicates(bulkBucket, { vectors: dupVectors, fileSizes: sizes }));
assert.ok(nativeCalls.pairDots > beforeBulkDuplicates,
  "large duplicate group must actually invoke native pairDots");
assert.deepEqual(bulkRust, bulkJs, "large native duplicate batch changed group recommendations");
const beforePairInto = nativeCalls.pairDotsInto;
const bulkBridge = evaluate("duplicates,bridge", () => findDuplicates(bulkBucket, { vectors: dupVectors, fileSizes: sizes }));
assert.ok(nativeCalls.pairDotsInto > beforePairInto, "typed duplicate output must execute Rust");
assert.deepEqual(bulkBridge, bulkJs, "typed duplicate output changed grouping");
// Exercise the new opt-in fused kernel with the same row/seed limits as production.
const { tryRankSimilarity } = require("../electron/native/compute.cjs");
const rankRows = vectors.slice(0, 32), rankSeeds = vectors.slice(32, 52);
const genreAt = (i, j) => (i + j) % 5 / 4;
assert.equal(evaluate("", () => tryRankSimilarity(rankRows, rankSeeds, genreAt, .6, .4)), null);
const rankOriginal = native.rankSimilarityBatch;
let rankCalls = 0;
native.rankSimilarityBatch = (...args) => { rankCalls++; return rankOriginal.apply(native, args); };
assert.equal(evaluate("similarity", () => tryRankSimilarity(rankRows, rankSeeds, genreAt, .6, .4)), null, "ranking must not slow existing similarity opt-in");
assert.equal(evaluate("all", () => tryRankSimilarity(rankRows, rankSeeds, genreAt, .6, .4)), null, "slower ranking kernel requires explicit experiment");
const nativeRanks = evaluate("ranking", () => tryRankSimilarity(rankRows, rankSeeds, genreAt, .6, .4));
assert.ok(rankCalls > 0 && nativeRanks?.length === rankRows.length * 2);
for (let i = 0; i < rankRows.length; i++) {
  const audio = rankSeeds.map(seed => rankRows[i].reduce((sum, value, k) => sum + value * seed[k], 0));
  const average = audio.map((value, j) => .6 * value + .4 * genreAt(i, j)).sort((a,b) => b-a).slice(0,3).reduce((sum,score) => sum + score/3, 0);
  assert.ok(Math.abs(nativeRanks[i*2] - Math.max(...audio)) < 1e-12);
  assert.ok(Math.abs(nativeRanks[i*2+1] - average) < 1e-12);
}
assert.throws(() => native.rankSimilarityBatch(new Float64Array([1,2]), new Float64Array([1,2]), new Float64Array([NaN]), 2, .6, .4), /similarity/i);
process.env.LOCALTIFY_RUST_PHASES = "";
console.log("[rust-parity] Native similarity, Daily Mixes, duplicate batches, and PCM match JS");
