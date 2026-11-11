"use strict";

const { performance } = require("node:perf_hooks");
const path = require("node:path");
const os = require("node:os");
const { dot } = require("../electron/analysis/listening-signals.cjs");
const { tryDotMatrix, tryDecodeNormalizedAudio } = require("../electron/native/compute.cjs");
const { readNormalizedVector } = require("../electron/analysis/similarity.cjs");
const { generateMixes } = require("../electron/analysis/daily-mixes.cjs");
const { findDuplicates } = require("../electron/library-duplicates.cjs");
const { getAddon } = require("../electron/native/backend.cjs");
const { decodePcmChunk } = require("../electron/analysis/pcm.cjs");

function median(values) { return [...values].sort((a,b) => a-b)[Math.floor(values.length/2)]; }
async function benchmark(fn, rounds = 3) {
  await fn();
  const durations = [];
  for (let i=0; i<rounds; i++) {
    const start = performance.now();
    await fn();
    durations.push(performance.now()-start);
  }
  return median(durations);
}
const vectors = Array.from({length:240},(_,i) => Float64Array.from({length:512},(_,j)=>Math.sin(i * .31 + j*.07)));
const encodedVectors=Array.from({length:600},(_,i)=>{
  const buffer=Buffer.allocUnsafe(512*4);
  for(let j=0;j<512;j++)buffer.writeFloatLE(Math.sin(i*.15 + j*.045),j*4);
  return buffer;
});
const pcmBuffer = Buffer.alloc(480_000 * 4);
for (let i=0; i<480_000; i++) pcmBuffer.writeFloatLE(Math.sin(i * .01), i * 4);
const trackVectors = vectors.map((v)=>{
  const n=Math.sqrt(dot(v,v));
  return Float64Array.from(v,x=>x/n);
});
const tracks = trackVectors.map((vector,i)=>({
  songId: "track-"+String(i).padStart(4,"0"), artist:"artist-"+(i%37),genre:i%2?"indie; rock":"electronic; ambient",
  filePath:"/music/track-"+i+".mp3",vector,liked:i%13===0,playCount:i%9
}));
const bigTracks = Array.from({ length: 600 }, (_, index) => ({
  ...tracks[index % tracks.length], songId: "large-" + String(index).padStart(4,"0")
}));
const dupSongs = Array.from({length:600},(_,i)=>({
  id:"id-"+i,title:"song "+Math.floor(i/2),artist:"artist "+(Math.floor(i/2)%17),album:"album "+(Math.floor(i/2)%8),
  duration:190,filePath:path.join(os.tmpdir(),"localtify-bench",String(i%2),"song "+Math.floor(i/2)+".mp3"),
  dateAdded:"2020-01-01T00:00:00.000Z",fileExists:true,playCount:i%10,liked:i%5===0
}));
const dupVectors = new Map(dupSongs.map((song,i)=>[song.id,trackVectors[Math.floor(i/2)%trackVectors.length]]));
const dupSizes = new Map(dupSongs.map((song)=>[song.id,5000000]));
const manySameRecord = dupSongs.slice(0,64).map((song)=>({
  ...song, title:"same recording", artist:"shared artist", album:"shared album"
}));
const compare = process.argv.includes("--compare");
const nativeCalls = new Map();
if (compare) {
  process.env.LOCALTIFY_RUST_PHASES = "similarity,duplicates,pcm";
  const addon = getAddon("similarity");
  if (!addon) throw new Error("Native benchmark requires a built Rust addon");
  for (const name of ["dotMatrix", "dotMatrixInto", "clusterFromCenters", "pairDots", "pairDotsInto", "decodeNormalizedAudioInto", "pcmSumSquares"]) {
    const original = addon[name];
    if (typeof original !== "function") throw new Error("Missing Rust export: " + name);
    nativeCalls.set(name, 0);
    addon[name] = (...args) => {
      nativeCalls.set(name, nativeCalls.get(name) + 1);
      return original.apply(addon, args);
    };
    if (addon[name] === original) throw new Error("Cannot instrument Rust export " + name);
  }
}
async function run() {
  const jobs = [
      ["similarity / 240x12x512 scores",()=>{
        const seeds=trackVectors.slice(0,12);
        const nativeScores=tryDotMatrix(trackVectors,seeds);
        if(nativeScores) return nativeScores.reduce((sum,n)=>sum+n,0);
        if (process.env.LOCALTIFY_RUST_PHASES) throw new Error("Native similarity kernel unexpectedly fell back to JavaScript");
        let score=0;
        for(const row of trackVectors)for(const seed of seeds)score+=dot(row,seed);
        return score;
      },["dotMatrix"]],
      ["CLAP Float32 decoder / 600x512",()=>{
        const native = tryDecodeNormalizedAudio(encodedVectors,512);
        if (native) return native;
        if (process.env.LOCALTIFY_RUST_PHASES) {
          throw new Error("Native CLAP decoder unexpectedly used JavaScript fallback; refusing misleading timing");
        }
        return encodedVectors.map((buffer)=>readNormalizedVector(buffer));
      },["decodeNormalizedAudioInto"]],
      ["similarity typed output / 240x12x512",()=>{
        const seeds=trackVectors.slice(0,12);
        const scores=tryDotMatrix(trackVectors,seeds);
        if (scores) return scores.reduce((sum,n)=>sum+n,0);
        let score=0;
        for(const row of trackVectors)for(const seed of seeds)score+=dot(row,seed);
        return score;
      },["dotMatrixInto"]],
      ["daily mixes / 240 tracks",()=>generateMixes(tracks,"fixed-seed"),[]],
      ["daily mixes / 600 tracks",()=>generateMixes(bigTracks,"fixed-large-seed"),["clusterFromCenters"]],
      ["duplicates / 600 entries",()=>findDuplicates(dupSongs,{vectors:dupVectors,fileSizes:dupSizes}),[]],
      ["duplicates / 64-way bucket",()=>findDuplicates(manySameRecord,{vectors:dupVectors,fileSizes:dupSizes}),["pairDots"]],
      ["duplicates typed output / 64-way bucket",()=>findDuplicates(manySameRecord,{vectors:dupVectors,fileSizes:dupSizes}),["pairDotsInto"]],
      ["PCM decode + energy / 480k samples",()=>decodePcmChunk(pcmBuffer),["pcmSumSquares"]]
    ];
  for (const [name, fn, requiredNames] of jobs) {
      process.env.LOCALTIFY_RUST_PHASES="";
      const js=await benchmark(fn);
      if(compare) {
        process.env.LOCALTIFY_RUST_PHASES = name.includes("typed output")
          ? "similarity,duplicates,bridge,pcm" : "similarity,duplicates,pcm";
        const before = new Map(nativeCalls);
        const rust=await benchmark(fn);
        const invoked = requiredNames?.some(key => nativeCalls.get(key) > before.get(key));
        if (requiredNames?.length && !invoked) throw new Error("Rust did not execute in benchmark: " + name);
        const label = requiredNames?.length ? "native opt-in " : "JS fallback (native gate not reached) ";
        console.log("[rust-phases] "+name+": JS "+js.toFixed(2)+" ms; "+label+rust.toFixed(2)+" ms"+(requiredNames?.length ? " (includes bridge)" : ""));
      } else console.log("[rust-baseline] "+name+": JavaScript median "+js.toFixed(2)+" ms");
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
