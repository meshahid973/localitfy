import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import ts from "typescript";

const root=path.resolve(process.argv[2]||".");
const require=createRequire(import.meta.url), modules=new Map();
function load(file){
  file=path.resolve(file);
  if(modules.has(file))return modules.get(file).exports;
  const module={exports:{}};modules.set(file,module);
  const code=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("module","exports","require",code)(module,module.exports,name=>{
    if(!name.startsWith("."))return require(name);
    const p=path.resolve(path.dirname(file),name);
    const target=[p,p+".ts",path.join(p,"index.ts")].find(x=>fs.existsSync(x)&&fs.statSync(x).isFile());
    if(!target)throw Error("Missing benchmark module: "+name);
    return load(target);
  });
  return module.exports;
}
const index=load(path.join(root,"src/features/search/incrementalLibraryIndex.ts"));
const search=load(path.join(root,"src/features/search/search.utils.ts"));
const preview=load(path.join(root,"src/features/library/metadataCleanPreview.ts"));
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const mib=x=>Math.round(x/1048576*100)/100;
const trials=[];
const count=Number(process.argv[3]||10000);
if(![1000,10000,50000].includes(count))throw Error("Unsupported workload size");
function measure(label,fn,summarize){
  global.gc?.();
  const before=process.memoryUsage(),cpu=process.cpuUsage(),start=performance.now();
  const result=fn(),ms=performance.now()-start, usage=process.cpuUsage(cpu),after=process.memoryUsage();
  const entry={label,wallMs:Math.round(ms*100)/100,cpuMs:(usage.user+usage.system)/1000,heapDeltaMiB:mib(after.heapUsed-before.heapUsed),rssMiB:mib(after.rss),rssDeltaMiB:mib(after.rss-before.rss),digest:hash(summarize(result))};
  trials.push(entry);return result;
}
const songs=Array.from({length:count},(_,i)=>({id:"song-"+i,title:(i%9===0?"Míkú Midnight (Official Audio)":"Track "+i),artist:"Artist "+i%271,album:"Album "+i%419,genre:"ambient",filePath:"/music/disc-"+i%61+"/track-"+i+".flac",url:"",liked:i%13===0,playCount:i%60,duration:180,dateAdded:"2026-01-01T00:00:00Z"}));
const initial=measure("cold index",()=>index.reconcileLibraryIndex(songs),x=>[x.searchEntries.map(e=>e.haystack),x.artistCount,x.albumCount]);
const edited=songs.slice();edited[count>>1]={...edited[count>>1],playCount:60};
const changed=measure("single playback update",()=>index.reconcileLibraryIndex(edited,initial),x=>[x.artistCount,x.albumCount,x.searchEntries[count>>1].song.playCount]);
measure("selective searches",()=>["midnight artist 4","track 209","liked","not-present-xyz"].map(q=>search.rankSongsForSearch(changed.searchEntries,q)),x=>x.map(a=>a.map(s=>s.id)));
measure("metadata preview",()=>preview.createMetadataCleanPreview(songs,[],"all"),x=>[x.totalCount,x.changedCount,x.titleFixCount,x.artistFixCount,x.albumFixCount,x.items.map(i=>[i.id,i.patch])]);
const report={platform:process.platform,arch:process.arch,node:process.version,cores:os.cpus().length,count,peakRssMiB:mib(process.resourceUsage().maxRSS*1024),trials};
console.log(JSON.stringify(report));
