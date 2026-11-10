import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=(path)=>fs.readFileSync(path,"utf8");

test("Rust remains optional and all three integrations preserve JS fallback code",()=>{
 const backend=read("electron/native/backend.cjs");
 const sim=read("electron/analysis/similarity.cjs");
 const mix=read("electron/analysis/daily-mixes.cjs");
 const dup=read("electron/library-duplicates.cjs");
 const scan=read("electron/library-watch.cjs");
 assert.match(backend,/LOCALTIFY_RUST_PHASES/);
 assert.match(backend,/if \(!enabled\(phase\)\) return null/);
 assert.match(sim,/nativeAudio \? nativeAudio\[index \* seedProfiles\.length \+ seedIndex\] : dot/);
 assert.match(mix,/nativeScores \? nativeScores\[index \* centers\.length \+ centerIndex\] : dot/);
 assert.match(dup,/audioOverride === undefined \? cosine\(va, vb\) : audioOverride/);
 assert.match(dup,/tryBatchPairDots\(\[\.\.\.buckets\.values\(\)\], vectors\)/);
 assert.doesNotMatch(read("electron/native/compute.cjs"),/function tryPairDots\(/);
 assert.match(read("electron/native/compute.cjs"),/tryCenterAudioProfiles/);
 assert.match(read("electron/native/compute.cjs"),/tryDecodeNormalizedAudio/);
 assert.match(read("electron/analysis/similarity.cjs"),/tryDecodeNormalizedAudio\(candidateRecords\.map/);
 assert.match(read("electron/analysis/daily-mixes.cjs"),/tryDecodeNormalizedAudio\(validRecords\.map/);
 assert.match(scan,/if \(nativeFiles !== null\) return nativeFiles/);
 assert.match(scan,/const files = \[\]/);
 assert.match(read("electron/main.cjs"),/markStandardAudioFilter\(isAudioFile\)/);
 assert.match(read("electron/native/scanner.cjs"),/next\.unref\(\)/);
});

test("Rust native extension is excluded from Git but included in packaged Electron app",()=>{
 const pkg=JSON.parse(read("package.json"));
 assert.ok(pkg.build.asarUnpack.includes("electron/native/*.node"));
 assert.ok(pkg.build.files.includes("electron/**/*"));
 assert.match(read(".gitignore"),/electron\/native\/\*\.node/);
});

test("native full clustering and typed arrays are the sole new large-workload bridge",()=>{
 const native = read("native/rust-kernels/src/lib.rs");
 const mix = read("electron/analysis/daily-mixes.cjs");
 const kernel = read("electron/native/compute.cjs");
 assert.match(native,/pub fn cluster_from_centers\(points: &\[f64\], initial: &\[f64\], dimensions: u32, minimum: u32\) -> Result<ClusterResult>/);
 assert.match(native,/pub fn center_audio_vectors_in_place\(mut vectors: Float64Array, dimensions: u32\) -> Result<\(\)>/);
 assert.match(native,/pub fn decode_normalized_audio_into\(bytes: &\[u8\], mut output: Float64Array, dimensions: u32\) -> Result<\(\)>/);
 assert.match(native,/center_audio_in_place\(unsafe \{ vectors\.as_mut\(\) \}, dimension\(dimensions\)\?\)/);
 assert.match(native,/decode_normalized_audio_into_inner\(bytes, unsafe \{ output\.as_mut\(\) \}, dimension\(dimensions\)\?\)/);
 assert.match(mix,/tryClusterFromCenters\(points\.map/);
 assert.match(kernel,/function tryClusterFromCenters\(/);
 assert.doesNotMatch(kernel,/function tryPairDots\(/);
});
