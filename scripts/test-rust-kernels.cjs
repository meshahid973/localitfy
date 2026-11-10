"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getAddon } = require("../electron/native/backend.cjs");
const { tryDotMatrix, tryPairDots, tryBatchPairDots } = require("../electron/native/compute.cjs");
const { markStandardAudioFilter } = require("../electron/native/scanner.cjs");
const { generateMixes } = require("../electron/analysis/daily-mixes.cjs");
const { findDuplicates } = require("../electron/library-duplicates.cjs");
const { listAudioFiles } = require("../electron/library-watch.cjs");

process.env.LOCALTIFY_RUST_PHASES = "";
assert.equal(getAddon("similarity"), null, "Rust must be disabled by default");
assert.equal(tryDotMatrix([new Float64Array([1,2])],[new Float64Array([3,4])]),null);

process.env.LOCALTIFY_RUST_PHASES = "similarity,duplicates,scanner";
const native = getAddon("similarity");
if (!native) throw new Error("Native addon is required for this explicit Rust test");
for(const name of ["dotMatrix", "pairDots", "scanAudioFiles"]) {
  assert.equal(typeof native[name], "function", "Missing native export: "+name);
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
const mixesJs = evaluate("",()=>generateMixes(songs,"2026-11-10:0"));
const mixesRust = evaluate("similarity",()=>generateMixes(songs,"2026-11-10:0"));
assert.deepEqual(mixesRust,mixesJs,"Daily Mixes outputs changed");

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
assert.ok(Math.abs(tryPairDots(dupSongs.slice(0,2),dupVectors)[0]-1) < 1e-9,"native duplicate pair not selected");

const isAudioFile=(name)=>/\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|aif)$/i.test(name);
markStandardAudioFilter(isAudioFile);
assert.throws(() => markStandardAudioFilter((file) => /\.(mp3|flac|txt)$/i.test(file)),
  /standard Localtify/, "broader callback must never opt in to native scan");

// Batch a real candidate group so the Rust comparison is exercised once rather than
// launching a separate native call for each two-song recording.
const bulkBucket = Array.from({ length: 64 }, (_, i) => ({
  ...dupSongs[i], title: "same track", artist: "same artist", album: "same album"
}));
const nativeBatch = evaluate("duplicates", () => tryBatchPairDots([bulkBucket], dupVectors));
assert.ok(Array.isArray(nativeBatch) && nativeBatch.length === 2016,
  "large duplicate bucket must use the native path");
const bulkJs = evaluate("", () => findDuplicates(bulkBucket, { vectors: dupVectors, fileSizes: sizes }));
const bulkRust = evaluate("duplicates", () => findDuplicates(bulkBucket, { vectors: dupVectors, fileSizes: sizes }));
assert.deepEqual(bulkRust, bulkJs, "large native duplicate batch changed group recommendations");
async function main(){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),"localtify-rust-parity-"));
 try {
   for (const entry of ["album","album/inner","localitfy-bin","spotify-covers",".private"]) fs.mkdirSync(path.join(folder,entry),{recursive:true});
   for (const entry of ["album/first.MP3","album/inner/second.flac","album/third.txt",
     "album/temp.part",".private/secret.mp3","localitfy-bin/private.mp3","spotify-covers/private.mp3"])
     fs.writeFileSync(path.join(folder,entry),"test");
   const pathsJs=await evaluate("",()=>listAudioFiles(folder,isAudioFile));
   const pathsRust=await evaluate("scanner",()=>listAudioFiles(folder,isAudioFile));
   assert.deepEqual(pathsRust.slice().sort(),pathsJs.slice().sort(),"scanner misses or adds files");
   assert.equal(pathsRust.length,2);
   // Repeat work on the same dedicated native worker; compare without assuming OS enumeration order.
   const again=await evaluate("scanner",()=>listAudioFiles(folder,isAudioFile));
   assert.deepEqual(again.slice().sort(),pathsJs.slice().sort(),"reused native scanner changed results");
   const pathsLimited=await evaluate("scanner",()=>listAudioFiles(folder,isAudioFile,1));
   assert.equal(pathsLimited.length,1);
   // A custom acceptance function must be sent through original JS fallback.
   const txtOnly=(name)=>name.endsWith(".txt");
   const files=await evaluate("scanner",()=>listAudioFiles(folder,txtOnly));
   assert.equal(files.length,1);
   const broad=(name)=>/\.(mp3|txt)$/i.test(name);
   const broadFiles=await evaluate("scanner",()=>listAudioFiles(folder,broad));
   assert.ok(broadFiles.some((file)=>file.endsWith("third.txt")),
     "a custom filter accepting extra extensions must never lose files");
 } finally {fs.rmSync(folder,{recursive:true,force:true});}
 process.env.LOCALTIFY_RUST_PHASES="";
 console.log("[rust-parity] Native similarity, Daily Mixes, duplicate pairs/groups and bounded scans match JS");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
