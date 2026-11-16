"use strict";
const {app,BrowserWindow,session}=require("electron");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),http=require("node:http");
const {spawnSync}=require("node:child_process");
const assert=require("node:assert/strict");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"localtify-ci-visual-"));
const output=path.resolve(process.env.LOCALTIFY_QA_OUTPUT||"qa-artifacts");
fs.mkdirSync(output,{recursive:true});
app.setPath("appData",dir);
fs.mkdirSync(path.join(dir,"localitfy"),{recursive:true});
app.setPath("userData",path.join(dir,"localitfy"));
const root=path.resolve(__dirname,"..");
function wav(name){
  const samples=48000*20,buf=Buffer.alloc(44+samples*2);
  buf.write("RIFF",0);buf.writeUInt32LE(buf.length-8,4);buf.write("WAVEfmt ",8);buf.writeUInt32LE(16,16);
  buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(48000,24);buf.writeUInt32LE(96000,28);
  buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write("data",36);buf.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)buf.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/48000)*1000),44+i*2);
  const target=path.join(dir,name+".wav");fs.writeFileSync(target,buf);return target;
}
const songs=Array.from({length:12},(_,i)=>({id:"qa-"+i,title:"test track "+i,artist:"test artist",album:"test album",genre:"ambient",filePath:wav("qa-"+i),duration:20,dateAdded:"2026-01-01T00:00:00Z",playCount:0,liked:i===0}));
const seed=spawnSync(process.execPath,["-e",
  "const db=require(process.argv[1]);db.initDatabase(process.argv[2]);const songs=JSON.parse(process.argv[3]);db.insertSongs(songs);db.savePlaylists([{id:'qa-playlist',name:'qa playlist',songIds:songs.map(s=>s.id),createdAt:Date.now()}]);db.saveSettings({startWithWindows:false,idleScreensaverEnabled:false,discordRpcEnabled:false,reducedMotion:true});",
  path.join(root,"electron/db.cjs"),path.join(app.getPath("userData"),"localitfy.sqlite"),JSON.stringify(songs)],{env:{...process.env,ELECTRON_RUN_AS_NODE:"1"},encoding:"utf8"});
if(seed.status!==0)throw Error("Synthetic database seed failed: "+seed.stderr);
const dist=path.join(root,"dist"),mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".jpg":"image/jpeg",".gif":"image/gif",".webp":"image/webp",".svg":"image/svg+xml",".woff2":"font/woff2",".woff":"font/woff"};
const server=http.createServer((req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const file=path.resolve(dist,"."+ (name==="/"?"/index.html":name));
    if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(400);res.end();}
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,timeout=35000){const end=Date.now()+timeout;while(Date.now()<end){const v=await fn();if(v)return v;await sleep(200);}throw Error("Timeout: "+label);}
async function screenshot(win,name){const image=await win.webContents.capturePage();assert.ok(!image.isEmpty());fs.writeFileSync(path.join(output,name+".png"),image.toPNG());}
async function metrics(label){
  const readings=[];for(let i=0;i<5;i++){await sleep(1000);const m=app.getAppMetrics();readings.push({workingSetMiB:m.reduce((s,p)=>s+(p.memory?.workingSetSize||0),0)/1024,cpuPercent:m.reduce((s,p)=>s+(p.cpu?.percentCPUUsage||0),0),processes:m.length});}
  return{label,readings};
}
const watchdog=setTimeout(()=>{console.error("Integrated visual smoke timed out");server.close();app.exit(1);},120000);
server.listen(5173,async()=>{
  try{
    const started=Date.now();
    // Actual desktop entry, real preload and temp SQLite library. No user data.
    require(path.join(root,"electron/main.cjs"));
    await app.whenReady();
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:/i.test(details.url)&&!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/)/i.test(details.url)}));
    const win=await until(()=>BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL().includes("localhost:5173")),"desktop window");
    await until(()=>win.webContents.executeJavaScript("document.readyState === 'complete' && !!document.querySelector('#root')").catch(()=>false),"document ready");
    await win.webContents.executeJavaScript("localStorage.setItem('localitfy.onboarding.v1','done');localStorage.setItem('localitfy.onboarding.release-showcase.0.5.0','done');localStorage.setItem('localitfy.whatsNewSeenVersion','0.5.0')");
    win.webContents.reload();
    await until(()=>win.webContents.executeJavaScript("!document.querySelector('.appCrashBoundary') && !!document.querySelector('.appShell')").catch(()=>false),"desktop shell");
    const startupMs=Date.now()-started;
    win.setSize(1280,800);await sleep(700);
    await screenshot(win,"desktop-home");
    const idle=await metrics("desktop idle");
    // Exercise actual rendered library navigation and playback.
    const clicked=await win.webContents.executeJavaScript("(()=>{const b=[...document.querySelectorAll('.sidebar button')].find(x=>x.textContent.trim().toLowerCase()==='library'||x.getAttribute('aria-label')?.toLowerCase()==='library');if(!b)return false;b.click();return true})()");
    assert.ok(clicked,"library navigation missing");
    await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.songButton') || !!document.querySelector('.homeAlbumPlayZone')").catch(()=>false),"library tracks");
    await screenshot(win,"desktop-library");
    await win.webContents.executeJavaScript("(document.querySelector('.songButton')||document.querySelector('.homeAlbumPlayZone')).click()");
    await until(()=>win.webContents.executeJavaScript("[...document.querySelectorAll('audio')].some(a=>!a.paused&&a.currentTime>0)").catch(()=>false),"audio playing");
    await screenshot(win,"desktop-playing");
    const playing=await metrics("desktop playback");
    const result={startupMs,metrics:[idle,playing],platform:process.platform,fixtureSongs:songs.length};
    fs.writeFileSync(path.join(output,"desktop-runtime.json"),JSON.stringify(result,null,2));console.log("[desktop-qa]",JSON.stringify(result));
    clearTimeout(watchdog);server.close();app.exit(0);
  }catch(error){console.error(error);clearTimeout(watchdog);server.close();app.exit(1);}
});
