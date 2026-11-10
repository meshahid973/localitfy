"use strict";

const { performance } = require("node:perf_hooks");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { dot } = require("../electron/analysis/listening-signals.cjs");
const { generateMixes } = require("../electron/analysis/daily-mixes.cjs");
const { findDuplicates } = require("../electron/library-duplicates.cjs");
const { listAudioFiles } = require("../electron/library-watch.cjs");

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
const trackVectors = vectors.map((v)=>{
  const n=Math.sqrt(dot(v,v));
  return Float64Array.from(v,x=>x/n);
});
const tracks = trackVectors.map((vector,i)=>({
  songId: "track-"+String(i).padStart(4,"0"), artist:"artist-"+(i%37),genre:i%2?"indie; rock":"electronic; ambient",
  filePath:"/music/track-"+i+".mp3",vector,liked:i%13===0,playCount:i%9
}));
const dupSongs = Array.from({length:600},(_,i)=>({
  id:"id-"+i,title:"song "+Math.floor(i/2),artist:"artist "+(Math.floor(i/2)%17),album:"album "+(Math.floor(i/2)%8),
  duration:190,filePath:path.join(os.tmpdir(),"localtify-bench",String(i%2),"song "+Math.floor(i/2)+".mp3"),
  dateAdded:"2020-01-01T00:00:00.000Z",fileExists:true,playCount:i%10,liked:i%5===0
}));
const dupVectors = new Map(dupSongs.map((song,i)=>[song.id,trackVectors[Math.floor(i/2)%trackVectors.length]]));
const dupSizes = new Map(dupSongs.map((song)=>[song.id,5000000]));
async function run() {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"localtify-rust-baseline-"));
  try {
    for(let i=0;i<6;i++){
      const dir=path.join(tmp,"album"+i);fs.mkdirSync(dir);
      for(let j=0;j<30;j++)fs.writeFileSync(path.join(dir,"track"+j+(j%4?".mp3":".txt")),"x");
      fs.writeFileSync(path.join(dir,"partial.part"),"x");
    }
    const jobs=[
      ["similarity dot / 240x512",()=>{let score=0;for(let i=0;i<trackVectors.length;i++)score+=dot(trackVectors[i],trackVectors[(i+1)%trackVectors.length]);return score;}],
      ["daily mixes / 240 tracks",()=>generateMixes(tracks,"fixed-seed")],
      ["duplicates / 600 entries",()=>findDuplicates(dupSongs,{vectors:dupVectors,fileSizes:dupSizes})],
      ["scanner / 180 entries",()=>listAudioFiles(tmp,(file)=>file.toLowerCase().endsWith(".mp3"))]
    ];
    for(const [name,fn] of jobs) {
      process.env.LOCALTIFY_RUST_PHASES="";
      const js=await benchmark(fn);
      if(process.argv.includes("--compare")){
        process.env.LOCALTIFY_RUST_PHASES="similarity,duplicates,scanner";
        const rust=await benchmark(fn);
        console.log("[rust-phases] "+name+": JS "+js.toFixed(2)+" ms; native opt-in "+rust.toFixed(2)+" ms (includes bridge)");
      } else console.log("[rust-baseline] "+name+": JavaScript median "+js.toFixed(2)+" ms");
    }
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
