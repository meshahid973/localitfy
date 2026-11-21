"use strict";
const {app,BrowserWindow,session,nativeImage}=require("electron");
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
const version=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")).version;
function wav(name){
  const samples=48000*20,buf=Buffer.alloc(44+samples*2);
  buf.write("RIFF",0);buf.writeUInt32LE(buf.length-8,4);buf.write("WAVEfmt ",8);buf.writeUInt32LE(16,16);
  buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(48000,24);buf.writeUInt32LE(96000,28);
  buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write("data",36);buf.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)buf.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/48000)*1000),44+i*2);
  const target=path.join(dir,name+".wav");fs.writeFileSync(target,buf);return target;
}
function fixtureCover(index) {
  const width=32,height=32,bitmap=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const offset=(y*width+x)*4;
    bitmap[offset]=(80+index*19+y*3)%256;
    bitmap[offset+1]=(55+index*31+x*4)%256;
    bitmap[offset+2]=(120+index*13+y*2)%256;
    bitmap[offset+3]=255;
  }
  const target=path.join(dir,"qa-cover-"+index+".png");
  const image=nativeImage.createFromBitmap(bitmap,{width,height});
  if(image.isEmpty())throw Error("Could not build fixture cover");
  fs.writeFileSync(target,image.toPNG());return target;
}
const songs=Array.from({length:12},(_,i)=>({id:"qa-"+i,title:"test track "+i,artist:"test artist "+(i%8),album:"test album "+Math.floor(i/4),genre:"ambient",filePath:wav("qa-"+i),coverPath:fixtureCover(i),coverSource:"local",duration:20,dateAdded:"2026-01-01T00:00:00Z",playCount:12-i,lastPlayed:"2026-11-16T00:00:00Z",liked:i===0}));
for (const song of songs) fs.writeFileSync(song.filePath.replace(/\.wav$/, ".lrc"), "[00:00.00]<00:00.00>Local <00:01.00>lyric fixture\n[00:05.00]Second lyric line\n");
const seed=spawnSync(process.execPath,["-e",
  "const db=require(process.argv[1]);db.initDatabase(process.argv[2]);const songs=JSON.parse(process.argv[3]);db.insertSongs(songs);for(let i=0;i<180;i++){const startedAt=Date.now()-i*86400000-60000,msListened=1000+(i%7)*4000;db.recordPlayEvent({id:'qa-listen-'+i,sessionId:'qa-session',songId:songs[i%songs.length].id,startedAt,updatedAt:startedAt+msListened,endedAt:startedAt+msListened,msListened,outcome:'ended',contextType:'library',contextId:null});}db.savePlaylists([{id:'qa-playlist',name:'qa playlist',songIds:songs.map(s=>s.id),createdAt:Date.now()}]);db.saveSettings({startWithWindows:false,idleScreensaverEnabled:false,discordRpcEnabled:false,reducedMotion:false,discoverEnabled:true,lyricsEnabled:true,lyricsOnlineLookup:false,coverColorSyncMode:'strong',homeBannerType:'dynamic',showAmbientGradient:true,playerBackgroundStyle:'coverBlur',homeHiddenSections:['dailyMixes','likedSongs','rediscover','notPlayedYet']});",
  path.join(root,"electron/db.cjs"),path.join(app.getPath("userData"),"localitfy.sqlite"),JSON.stringify(songs)],{env:{...process.env,ELECTRON_RUN_AS_NODE:"1"},encoding:"utf8"});
if(seed.status!==0)throw Error("Synthetic database seed failed: "+seed.stderr);
const recoveryStore=require("../electron/download-jobs.cjs").createDownloadJobStore(app.getPath("userData"));
const recoveryJob=recoveryStore.prepare({source:"youtube",url:"https://www.youtube.com/watch?v=abcdefghijk",folder:dir,options:{autoAdd:false}});
recoveryStore.update(recoveryJob.id,{status:"downloading",progress:37,message:"Recover this interrupted download"});
const failedJob=recoveryStore.prepare({source:"youtube",url:"https://www.youtube.com/watch?v=abcdefghijl",folder:dir,options:{autoAdd:false}});
recoveryStore.update(failedJob.id,{status:"failed",progress:12,message:"Provider rejected audio",result:{error:"Provider rejected audio"}});
const cancelledJob=recoveryStore.prepare({source:"youtube",url:"https://www.youtube.com/watch?v=abcdefghijm",folder:dir,options:{autoAdd:false}});
recoveryStore.update(cancelledJob.id,{status:"cancelled",progress:9,message:"Cancelled by user"});
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
async function until(fn,label,timeout=35000,interval=200){const end=performance.now()+timeout;while(performance.now()<end){const v=await fn();if(v)return v;await sleep(interval);}throw Error("Timeout: "+label);}
async function screenshot(win,name){await win.webContents.executeJavaScript("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))");const image=await win.webContents.capturePage();assert.ok(!image.isEmpty());fs.writeFileSync(path.join(output,name+".png"),image.toPNG());}
async function metrics(label,sampleCount=5){
  // Prime Electron's interval-based CPU counters before sampling.
  app.getAppMetrics();
  const readings=[];
  for(let i=0;i<sampleCount;i++){
    await sleep(1000);
    const m=app.getAppMetrics();
    const totals={workingSetMiB:0,cpuPercent:0,processes:m.length};
    const byType={};
    for(const p of m){
      const memory=(p.memory?.workingSetSize||0)/1024, cpu=p.cpu?.percentCPUUsage||0;
      totals.workingSetMiB+=memory;totals.cpuPercent+=cpu;
      const bucket=byType[p.type]??={workingSetMiB:0,cpuPercent:0,processes:0};
      bucket.workingSetMiB+=memory;bucket.cpuPercent+=cpu;bucket.processes++;
    }
    readings.push({...totals,byType});
  }
  const median=key=>readings.map(r=>r[key]).sort((a,b)=>a-b)[Math.floor(readings.length/2)];
  return{label,readings,medianWorkingSetMiB:median("workingSetMiB"),peakWorkingSetMiB:Math.max(...readings.map(r=>r.workingSetMiB)),medianCpuPercent:median("cpuPercent")};
}
const watchdog=setTimeout(()=>{console.error("Integrated visual smoke timed out");server.close();app.exit(1);},210000);
server.listen(5173,async()=>{
  try{
    const started=performance.now();
    // Actual desktop entry, real preload and temp SQLite library. No user data.
    require(path.join(root,"electron/main.cjs"));
    await app.whenReady();
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:/i.test(details.url)&&!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/)/i.test(details.url)}));
    const win=await until(()=>BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL().includes("localhost:5173")),"desktop window");
    await until(()=>win.webContents.executeJavaScript("document.readyState === 'complete' && !!document.querySelector('#root')").catch(()=>false),"document ready");
    // A fresh profile initially shows onboarding, not the workspace. Record
    // first-render latency separately, then dismiss onboarding in the fixture.
    await until(()=>win.webContents.executeJavaScript("!document.querySelector('.appCrashBoundary') && (!!document.querySelector('.appShell') || !!document.querySelector('.onboardingLayer h2'))").catch(()=>false),"initial desktop render",35000,16);
    const startupMs=performance.now()-started;
    await win.webContents.executeJavaScript(`localStorage.setItem('localitfy.onboarding.v1','done');localStorage.setItem('localitfy.onboarding.release-showcase.' + ${JSON.stringify(version)},'done');localStorage.setItem('localitfy.whatsNewSeenVersion',${JSON.stringify(version)})`);
    const reloadStarted=performance.now();
    win.webContents.reload();
    await until(()=>win.webContents.executeJavaScript("!document.querySelector('.appCrashBoundary') && !!document.querySelector('.appShell')").catch(()=>false),"desktop shell",35000,16);
    const reloadMs=performance.now()-reloadStarted;
    win.setSize(1280,800);await sleep(700);
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('.app').dataset.sidebarBehavior"), "slim", "fresh installs use collapsed navigation");
    async function assertShellChrome() {
      const chrome=await win.webContents.executeJavaScript(`(()=>{
        const app=document.querySelector('.app'), sidebar=app.querySelector('.sidebar');
        const style=el=>getComputedStyle(el);
        const rect=el=>el.getBoundingClientRect();
        const buttons=[...sidebar.querySelectorAll('.navItem')].filter(el=>rect(el).width>0);
        const rgba=color=>{
          const canvas=document.createElement('canvas'); canvas.width=canvas.height=1;
          const ctx=canvas.getContext('2d'); ctx.fillStyle=color; ctx.fillRect(0,0,1,1);
          return [...ctx.getImageData(0,0,1,1).data];
        };
        const play=app.querySelector('.playerBar .circleButton.main');
        const playIcon=play?.querySelector('svg');
        const homePlay=app.querySelector('.homeStartButton');
        const home=sidebar.querySelector('[data-nav-id="home"]'), pinned=sidebar.querySelector('.sidebarPinnedNav [data-nav-id="settings"]');
        const scroll=sidebar.querySelector('.sidebarNavGroupsV467');
        const prev=app.querySelector('.playerBar button[aria-label="previous song"] svg');
        const panel=app.querySelector('.settingsPanelCard');
        const inside=(el,box)=>!!el&&rect(el).top>=rect(box).top-1&&rect(el).bottom<=rect(box).bottom+1;
        return {
          theme:app.dataset.theme,
          retired:!!sidebar.querySelector('[data-nav-id="liked"],[data-nav-id="albums"]'),
          pinned:inside(pinned,sidebar),
          importVisible:inside(sidebar.querySelector('.importMainAction'),sidebar),
          sidebarClearOfPlayer:rect(sidebar).bottom<=rect(app.querySelector('.playerBar')).top+1,
          homeVisible:inside(home,scroll),
          prev:prev?rgba(style(prev).color):null,
          panel:panel?rgba(style(panel).backgroundColor):null,
          rail:rgba(style(sidebar).backgroundColor),
          play:play?rgba(style(play).backgroundColor):null,
          playIcon:playIcon?rgba(style(playIcon).color):null,
          homePlay:homePlay?rgba(style(homePlay).backgroundColor):null,
          mode:app.dataset.sidebarBehavior,
          width:rect(sidebar).width,
          title:style(app.querySelector('.titleBar')).backgroundColor,
          titleImage:style(app.querySelector('.titleBar')).backgroundImage,
          titleControls:[...app.querySelectorAll('.titleBar .titleHistoryNav,.titleBar .windowButtons')].map(e=>style(e).backgroundColor),
          sameGroupGaps:[...scroll.querySelectorAll('.navGroupedV467')].flatMap(group=>{
            const rows=[...group.querySelectorAll('.navItem')];
            return rows.slice(1).map((row,i)=>rect(row).top-rect(rows[i]).bottom);
          }),
          groupGap:(()=>{const groups=[...scroll.querySelectorAll('.sidebarNavGroupV467')];return groups.length>1?rect(groups[1]).top-rect(groups[0]).bottom:0})(),
          player:style(app.querySelector('.playerBar')).backgroundColor,
          clipped:buttons.some(el=>rect(el).left<rect(sidebar).left-1||rect(el).right>rect(sidebar).right+1)
        };
      })()`);
      assert.equal(chrome.mode,"slim");
      assert.equal(chrome.retired,false,"retired sidebar destinations");
      assert.ok(chrome.pinned&&chrome.homeVisible&&chrome.importVisible,"Settings, Home and Import must remain visible: "+JSON.stringify(chrome));
      assert.ok(chrome.sidebarClearOfPlayer,"sidebar must end above the full-width playback bar: "+JSON.stringify(chrome));
      if(chrome.theme==="light"){
        if(chrome.prev)assert.ok(Math.max(...chrome.prev.slice(0,3))<170,"light-mode previous glyph must not be white");
        if(chrome.panel)assert.ok(chrome.panel[3]<72||Math.min(...chrome.panel.slice(0,3))>=180,"light-mode settings panel must use a light or softly translucent fill");
      }
      assert.ok(chrome.width>=48&&chrome.width<=88&&!chrome.clipped,"compact sidebar must contain its buttons: "+JSON.stringify(chrome));
      assert.ok(chrome.rail[3]>0&&chrome.rail[3]<=26,"sidebar must be a subtle translucent surface: "+JSON.stringify(chrome));
      const fill=chrome.theme==="light"?[24,24,27,255]:[255,255,255,255];
      const ink=chrome.theme==="light"?[255,255,255,255]:[0,0,0,255];
      assert.deepEqual(chrome.play,fill,"main playback button follows the active monochrome theme");
      assert.deepEqual(chrome.playIcon,ink,"playback glyph contrasts with its button");
      if(chrome.homePlay)assert.deepEqual(chrome.homePlay,fill,"Home primary button follows the theme");
      assert.equal(chrome.title,"rgba(0, 0, 0, 0)","title bar must be transparent");
      assert.equal(chrome.titleImage,"none","title bar must not paint a gradient");
      assert.ok(chrome.titleControls.every(color=>color==="rgba(0, 0, 0, 0)"),"title controls must not have filled containers");
      assert.ok(chrome.sameGroupGaps.every(gap=>gap>=-1&&gap<=12),"navigation rows must not stretch apart: "+JSON.stringify(chrome));
      assert.ok(chrome.groupGap>=-1&&chrome.groupGap<=12,"navigation groups must not stretch apart: "+JSON.stringify(chrome));
      assert.equal(chrome.player,"rgba(0, 0, 0, 0)","ambient player bar must be transparent");
    }
    await assertShellChrome();
    await screenshot(win,"desktop-home");
    await sleep(2000); // Let initial artwork and layout work settle before the idle sample.
    const idle=await metrics("desktop idle");
    // Exercise actual rendered library navigation and playback.
    const libraryNavigationStart=performance.now();
    const clicked=await win.webContents.executeJavaScript("(()=>{const b=document.querySelector('.sidebar [data-nav-id=library]');if(!b)return false;b.click();return true})()");
    assert.ok(clicked,"library navigation missing");
    await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.sidebar [data-nav-id=library].active') && !!document.querySelector('.songButton')").catch(()=>false),"library tracks",35000,16);
    const libraryNavigationMs=performance.now()-libraryNavigationStart;
    await screenshot(win,"desktop-library");
    const playbackStart=performance.now();
    await win.webContents.executeJavaScript("document.querySelector('.songButton').click()");
    await until(()=>win.webContents.executeJavaScript("[...document.querySelectorAll('audio')].some(a=>!a.paused&&a.currentTime>0)").catch(()=>false),"audio playing",35000,16);
    const playbackStartMs=performance.now()-playbackStart;
    // Focus changes must not reload, seek or pause a healthy audio element.
    await win.webContents.executeJavaScript(`(()=>{const audio=document.querySelector('audio');const q={start:audio.currentTime,src:audio.src,events:[]};window.qaFocusAudio=q;for(const type of ['pause','seeking','loadstart']) audio.addEventListener(type,()=>q.events.push(type),{once:true});window.dispatchEvent(new Event('blur'));})()`);
    win.blur();
    await sleep(300);
    win.focus();
    await win.webContents.executeJavaScript("window.dispatchEvent(new Event('focus'))");
    await sleep(700);
    const focusAudio=await win.webContents.executeJavaScript(`(()=>{const a=document.querySelector('audio'), q=window.qaFocusAudio;return {events:q.events,paused:a.paused,sameSource:a.src===q.src,advanced:a.currentTime-q.start}})()`);
    assert.ok(!focusAudio.paused && focusAudio.sameSource && focusAudio.advanced>0.3 && focusAudio.events.length===0,"focus interrupted playback: "+JSON.stringify(focusAudio));
    await screenshot(win,"desktop-playing");
    assert.equal(await win.webContents.executeJavaScript("typeof window.localitfy.onWatchedFoldersChange"), "function", "current preload exposes watched-folder events");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector(\".app\")?.dataset.appVersion"), version, "renderer version matches package");
    const playing=await metrics("desktop playback",3);
    const beforeHidden=await win.webContents.executeJavaScript("(()=>{const a=document.querySelector('audio');return {src:a.src,time:a.currentTime}})()");
    let hiddenPlayback, hiddenAudio;
    let syntheticBackgroundCss = false;
    let backgroundAnimationsPaused = false;
    const baselineProfile = String(process.env.LOCALTIFY_QA_OUTPUT || "").replaceAll("\\", "/").includes("/desktop-baseline");
    try {
      win.hide();
      assert.equal(win.isVisible(),false,"the Electron window is actually hidden");
      // Offscreen Xvfb does not consistently deliver Chromium's visibility/blur
      // signals after BrowserWindow.hide(). When absent, activate only the
      // production background CSS class for this controlled resource sample.
      const backgroundCss = await win.webContents.executeJavaScript(
        "document.body.classList.contains('localtifyWindowBackgrounded') || document.body.classList.contains('localtifyBackgroundMode')");
      if (!backgroundCss) {
        syntheticBackgroundCss = true;
        await win.webContents.executeJavaScript("document.body.classList.add('localtifyWindowBackgrounded')");
      }
      // A pseudo-element without generated content may report the default
      // animation-play-state even when the corresponding CSS rule is correct.
      // Test a real descendant with an inline running state instead.
      backgroundAnimationsPaused = await win.webContents.executeJavaScript(`(()=>{
        const root=document.querySelector('.app');
        const probe=document.createElement('span');
        probe.style.animationPlayState='running';
        root.appendChild(probe);
        const paused=getComputedStyle(probe).animationPlayState==='paused';
        probe.remove();
        return paused;
      })()`);
      // The same harness also benchmarks an older main-branch worktree that
      // predates the performance policy; it must not require the new rule.
      if (!baselineProfile) assert.equal(backgroundAnimationsPaused,true,
        "candidate must pause decorative animations when its window is hidden");
      hiddenPlayback=await metrics("desktop hidden playback",3);
      hiddenAudio=await win.webContents.executeJavaScript(
        "(()=>{const a=document.querySelector('audio');return {src:a.src,time:a.currentTime,paused:a.paused,documentHidden:document.hidden,backgroundCssActive:document.body.classList.contains('localtifyWindowBackgrounded')||document.body.classList.contains('localtifyBackgroundMode')}})()");
    } finally {
      if (syntheticBackgroundCss) await win.webContents.executeJavaScript(
        "document.body.classList.remove('localtifyWindowBackgrounded')").catch(()=>undefined);
      win.show(); win.focus();
    }
    const hiddenPlaybackObservation={documentHidden:hiddenAudio.documentHidden,
      backgroundCssActive:hiddenAudio.backgroundCssActive,
      backgroundCssSimulated:syntheticBackgroundCss,
      backgroundAnimationsPaused, baselineProfile,
      browserWindowHidden:true,
      sameSource:hiddenAudio.src===beforeHidden.src,
      advancedSeconds:hiddenAudio.time-beforeHidden.time,paused:hiddenAudio.paused};
    await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=home]').click()");
    await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.homeFeatureCover') && document.querySelector('.app').dataset.workspaceArtwork==='on'").catch(()=>false),"artwork-led Home");
    async function homeGeometry(width,height) {
      win.setSize(width,height);
      await until(()=>win.getSize()[0]===width && win.webContents.executeJavaScript("window.innerWidth").then(actual=>actual===width),"requested viewport "+width,5000);
      const state=await win.webContents.executeJavaScript(`(()=>{
        const page=document.querySelector('.homePage');
        const atmosphere=document.querySelector('.app');
        const artist=page.querySelector('.homeReleaseRail .mediaCardCover');
        const rail=page.querySelector('.homeReleaseRail');
        artist?.scrollIntoView({block:'center'});
        const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,right:r.right,width:r.width,height:r.height}:null};
        const shelves=[...page.querySelectorAll('.homeReleaseRail')];
        return {viewport:window.innerWidth,page:rect(page),atmosphere:rect(atmosphere),artist:rect(artist),rail:rail?{width:rail.clientWidth,scrollWidth:rail.scrollWidth}:null,hidden:shelves.every(e=>getComputedStyle(e).scrollbarWidth==='none')};
      })()`);
      assert.equal(state.viewport,width,"actual renderer viewport");
      assert.ok(state.artist&&state.artist.width>=64&&Math.abs(state.artist.width-state.artist.height)<=3,"song artwork collapsed at "+width+": "+JSON.stringify(state));
      assert.ok(state.atmosphere&&state.atmosphere.x<=state.page.x&&state.atmosphere.right>=state.page.right-3,"ambient image should reach Home boundaries: "+JSON.stringify(state));
      assert.ok(state.hidden,"artwork shelves should not expose scrollbars");
      if(state.rail&&state.rail.scrollWidth>state.rail.width+10){
        const moved=await win.webContents.executeJavaScript("(()=>{const rail=document.querySelector('.homeReleaseRail');rail.scrollTo({left:Math.min(rail.scrollWidth-rail.clientWidth,180),behavior:'instant'});return rail.scrollLeft>0})()");
        assert.ok(moved,"hidden scrollbars must not prevent horizontal scrolling");
      }
      await win.webContents.executeJavaScript("document.querySelector('.homeFeatureCover').scrollIntoView({block:'start'})");
      await screenshot(win,"home-"+width);
      return state;
    }
    const layouts=[];
    for(const [width,height] of [[1280,800],[1920,1080],[860,760]])layouts.push(await homeGeometry(width,height));
    win.setSize(1280,800);
    const listenBackground = await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.homeListenGrid')).backgroundColor");
    assert.equal(listenBackground, "rgba(0, 0, 0, 0)", "Listen Now must not paint a separate container");
    const previous=await win.webContents.executeJavaScript("document.querySelector('.homeFeatureCover').dataset.coverTitle");
    await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.workspaceArtworkBackdrop .artworkBackdropLayer[data-visible=true] img')"),"decoded shell artwork");
    const homeArtwork = await win.webContents.executeJavaScript("document.querySelector('.workspaceArtworkBackdrop .artworkBackdropLayer[data-visible=true] img').src");
    const shellArtworkGeometry = await win.webContents.executeJavaScript(`(()=>{
      const root=document.querySelector('.app'), backdrop=document.querySelector('.workspaceArtworkBackdrop');
      const cover=backdrop.querySelector('.artworkBackdropLayer[data-visible=true] .artworkBackdropCover');
      const img=cover.querySelector('img'), r=root.getBoundingClientRect(), b=backdrop.getBoundingClientRect(), css=getComputedStyle(cover);
      return {width:b.width,height:b.height,rootWidth:r.width,rootHeight:r.height,blur:css.filter,opacity:Number(getComputedStyle(backdrop.querySelector('.artworkBackdropStack')).opacity),loaded:img.complete&&img.naturalWidth>0,raster:cover.parentElement.dataset.raster==='true',naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight};
    })()`);
    assert.ok(shellArtworkGeometry.loaded&&shellArtworkGeometry.width>=shellArtworkGeometry.rootWidth-2&&shellArtworkGeometry.height>=shellArtworkGeometry.rootHeight-2&&(shellArtworkGeometry.raster?shellArtworkGeometry.naturalWidth===32&&shellArtworkGeometry.naturalHeight===32&&shellArtworkGeometry.blur==='none':shellArtworkGeometry.blur.includes('blur(64px)'))&&shellArtworkGeometry.opacity>0&&shellArtworkGeometry.opacity<=.27,"shell uses decoded bounded cover imagery: "+JSON.stringify(shellArtworkGeometry));
    await win.webContents.executeJavaScript("document.querySelector('.playerBar button[aria-label=\\\"next song\\\"]').click()");
    await until(()=>win.webContents.executeJavaScript("document.querySelector('.homeFeatureCover')?.dataset.coverTitle").then(title=>title&&title!==previous).catch(()=>false),"next track");
    const samples=[];
    for(let index=0;index<8;index++){samples.push(await win.webContents.executeJavaScript("document.querySelectorAll('.workspaceArtworkBackdrop .artworkBackdropLayer').length"));await sleep(100);}
    assert.ok(samples.every(n=>n<=2),"ambient transition must keep at most two artwork layers");
    await until(()=>win.webContents.executeJavaScript("document.querySelector('.workspaceArtworkBackdrop .artworkBackdropLayer[data-visible=true] img')?.src").catch(()=>false),"settled artwork transition",5000);
    await until(()=>win.webContents.executeJavaScript("document.querySelector('.workspaceArtworkBackdrop .artworkBackdropLayer[data-visible=true] img')?.src").then(src=>src&&src!==homeArtwork),"track cover drives shell");
    const playingArtwork = await win.webContents.executeJavaScript("document.querySelector('.workspaceArtworkBackdrop .artworkBackdropLayer[data-visible=true] img').src");
    await screenshot(win,"home-next-track");
    await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=settings]').click()");
    await until(()=>win.webContents.executeJavaScript("document.querySelectorAll('.settingsModeButton').length===2 && document.querySelector('.app').dataset.workspaceArtwork==='on'").catch(()=>false),"two appearance modes");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('.workspaceArtworkBackdrop .artworkBackdropLayer[data-visible=true] img')?.src"),playingArtwork,"navigation preserves active cover");
    for(const mode of ["light","dark"]){
      await win.webContents.executeJavaScript(`document.querySelector('.settingsModeButton:has([data-preview-mode="${mode}"])').click()`);
      // Compare the actual resolved color, not the spelling of a minified CSS token
      // (#000 and #000000 are identical). Also verify the selected control.
      await until(()=>win.webContents.executeJavaScript(`(()=>{
        const root=document.querySelector('.app');
        const mode=${JSON.stringify(mode)};
        const button=document.querySelector('.settingsModeButton:has([data-preview-mode="'+mode+'"])');
        if(!root||root.dataset.theme!==mode||button?.getAttribute('aria-pressed')!=='true')return false;
        const probe=document.createElement('span');
        probe.style.backgroundColor='var(--lt-bg)';
        root.appendChild(probe);
        const actual=getComputedStyle(probe).backgroundColor;
        probe.remove();
        return actual===(mode==='light'?'rgb(245, 245, 247)':'rgb(0, 0, 0)');
      })()`).catch(()=>false),"apply "+mode);
      await assertShellChrome();
      await screenshot(win,"settings-"+mode);
      await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=library]').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.libraryCollectionShortcuts') && document.querySelector('.app').dataset.workspaceArtwork==='on'").catch(()=>false),"library "+mode);
      await screenshot(win,"library-"+mode);
      const selectionBefore = await win.webContents.executeJavaScript("document.querySelector('.playerMeta strong')?.textContent");
      await win.webContents.executeJavaScript("[...document.querySelectorAll('.libraryAction')].find(b=>b.textContent==='Select tracks').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.librarySelectionTools') && !!document.querySelector('.songButton[aria-pressed=false]')"),"library selection "+mode);
      await win.webContents.executeJavaScript("document.querySelector('.songButton[aria-pressed=false]').click()");
      await until(()=>win.webContents.executeJavaScript("document.querySelector('.librarySelectionTools .pageHeaderCount').textContent.includes('1 selected')"),"select without playback "+mode);
      assert.equal(await win.webContents.executeJavaScript("document.querySelector('.playerMeta strong')?.textContent"),selectionBefore,"selection must not change playback");
      await win.webContents.executeJavaScript("[...document.querySelectorAll('.libraryAction')].find(b=>b.textContent==='Done').click()");
      await win.webContents.executeJavaScript("document.querySelector('.librarySort').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.arcDropdownMenu.ltOverlaySurface')").catch(()=>false),"shared menu surface "+mode);
      const menuSkin=await win.webContents.executeJavaScript(`(()=>{
        const root=document.querySelector('.app'),menu=document.querySelector('.arcDropdownMenu');
        const probe=document.createElement('span');probe.style.backgroundColor='var(--lt-glass-background)';root.appendChild(probe);
        const expected=getComputedStyle(probe).backgroundColor;probe.remove();
        return {actual:getComputedStyle(menu).backgroundColor,expected,blur:getComputedStyle(menu).backdropFilter};
      })()`);
      assert.equal(menuSkin.actual,menuSkin.expected,"portal follows the active theme's glass token");
      assert.notEqual(menuSkin.blur,"none","glass surface has its shared blur");
      await win.webContents.executeJavaScript("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'t',bubbles:true}))");
      assert.match(await win.webContents.executeJavaScript("document.activeElement.textContent"),/title/i,"typeahead moves keyboard focus");
      await win.webContents.executeJavaScript("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
      await until(()=>win.webContents.executeJavaScript("!document.querySelector('.arcDropdownMenu') && document.activeElement.classList.contains('librarySort')").catch(()=>false),"dropdown restores focus "+mode);
      await win.webContents.executeJavaScript("document.querySelector('.libraryCollectionShortcuts button:has([data-kind=liked])').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.libraryPageLiked')").catch(()=>false),"liked songs "+mode);
      await screenshot(win,"liked-"+mode);
      await win.webContents.executeJavaScript(`(()=>{const e=document.querySelector('.librarySearch');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"no matching fixture");e.dispatchEvent(new Event("input",{bubbles:true}));})()`);
      await until(()=>win.webContents.executeJavaScript("document.querySelector('.libraryPageLiked')?.textContent.includes('No songs found')"),"liked search empty "+mode);
      await win.webContents.executeJavaScript("[...document.querySelectorAll('.libraryPageLiked button')].find(b=>b.textContent==='clear search').click()");
      await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=playlists]').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('button[aria-label=\"open qa playlist\"]')").catch(()=>false),"fixture playlist "+mode);
      await win.webContents.executeJavaScript("document.querySelector('button[aria-label=\"open qa playlist\"]').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.playlistDetailPage .collectionHero') && document.querySelector('.app').dataset.workspaceArtwork==='on'").catch(()=>false),"playlist contextual shell artwork "+mode);
      await screenshot(win,"playlist-atmosphere-"+mode);
      await win.webContents.executeJavaScript(`(()=>{const e=document.querySelector('input[aria-label="Search playlist tracks"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"no matching fixture");e.dispatchEvent(new Event("input",{bubbles:true}));})()`);
      await until(()=>win.webContents.executeJavaScript("document.querySelector('.playlistTracksPanel [role=status]')?.textContent.includes('No matching tracks')"),"playlist search empty "+mode);
      await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=home]').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.homeStartButton')").catch(()=>false),"Home "+mode);
      await assertShellChrome();
      await screenshot(win,"home-"+mode);
      await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=discover]').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.discoverPage') && !document.querySelector('.appCrashBoundary') && document.querySelector('.app').dataset.workspaceArtwork==='on'").catch(()=>false),"Discover "+mode);
      await screenshot(win,"discover-"+mode);
      for (const width of [1280,860]) {
        win.setSize(width,800);
        await until(()=>win.webContents.executeJavaScript("window.innerWidth").then(actual=>actual===width),"viewport "+width,5000);
        for (const view of ["home","library","artists","genres","playlists","discover","downloads","covers","analytics","settings"]) {
          await win.webContents.executeJavaScript(`document.querySelector('.sidebar [data-nav-id="${view}"]').click()`);
          await until(()=>win.webContents.executeJavaScript(`(()=>{const page=document.querySelector('.pageTransition[data-view="${view}"]');return !!page?.firstElementChild&&!page.querySelector('.collectionLoading')&&!document.querySelector('.appCrashBoundary')&&Number(getComputedStyle(page).opacity)>=0.99})()`).catch(()=>false),view+" "+mode+" "+width);
          if(view==="downloads") {
            const saved=await win.webContents.executeJavaScript("window.localitfy.getDownloadJobs()");
            assert.equal(saved.error, "", "download journal is available through the trusted preload");
            const recovered=saved.jobs.find(job=>job.id===recoveryJob.id);
            assert.equal(recovered?.status,"interrupted","restart restores interrupted downloads");
            assert.equal(recovered?.progress,37,"restart retains recorded progress");
            assert.equal(saved.jobs.find(job=>job.id===failedJob.id)?.status,"failed","failed jobs remain visible after restart");
            assert.equal(saved.jobs.find(job=>job.id===cancelledJob.id)?.status,"cancelled","cancelled jobs remain available after restart");
            await until(()=>win.webContents.executeJavaScript("document.querySelector('.downloadsActivityTitle p')?.textContent.includes('need attention')").catch(()=>false),"interrupted count visible");
            const attentionSelectable=await win.webContents.executeJavaScript("(()=>{const button=[...document.querySelectorAll('.downloadsFilters button')].find(button=>button.textContent.trim()==='Attention');if(!button)return false;button.click();return true})()");
            assert.equal(attentionSelectable,true,"Attention filter is reachable");
            await until(()=>win.webContents.executeJavaScript("document.querySelectorAll('.downloadsActivityRow').length >= 3"),"failed/cancelled/interrupted rows visible together");
            await until(()=>win.webContents.executeJavaScript("Array.from(document.querySelectorAll('.downloadsActivityActions button')).some(button=>button.textContent.trim()==='Resume')"),"resume action is visible");
            const resumeUsable=await win.webContents.executeJavaScript("(()=>{const button=Array.from(document.querySelectorAll('.downloadsActivityActions button')).find(button=>button.textContent.trim()==='Resume');button.scrollIntoView({block:'center',behavior:'instant'});const box=button.getBoundingClientRect();return document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)===button})()");
            assert.equal(resumeUsable,true,"resume remains reachable above the player");
          }
          if(view==="analytics") {
            const history=await win.webContents.executeJavaScript("window.localitfy.getListeningSummary({days:7})");
            assert.ok(history && Number.isFinite(history.totalMs) && history.totalMs>=0,"recorded listening summary");
            assert.equal(history.byDay.length,7,"seven-day history");
            assert.equal(history.byDay.reduce((sum,day)=>sum+day.ms,0),history.totalMs,"daily totals equal recorded total");
            assert.ok(history.comparison.totalMs>0,"historical comparison uses fixture playback events");
            await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.analyticsChartInspector')"),"recorded listening chart");
            await win.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Listening history period\"]').click()");
            await until(()=>win.webContents.executeJavaScript("Array.from(document.querySelectorAll('[role=menuitemradio]')).some(item=>item.textContent.includes('Last 7 days'))"),"history periods");
            await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('[role=menuitemradio]')).find(item=>item.textContent.includes('Last 7 days')).click()");
            await until(()=>win.webContents.executeJavaScript("document.querySelector('.analyticsChartInspector')?.max==='6'"),"seven-day chart selection");
            await until(()=>win.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Listening history period\"] .arcDropdownLabel').textContent==='Last 7 days'"),"selected period label finishes its transition");
            await win.webContents.executeJavaScript("document.querySelector('.analyticsChartInspector').focus()");
            win.webContents.sendInputEvent({type:"keyDown",keyCode:"Home"});
            win.webContents.sendInputEvent({type:"keyUp",keyCode:"Home"});
            await until(()=>win.webContents.executeJavaScript("document.querySelector('.analyticsChartInspector')?.value==='0'"),"history chart Home key");
            const readable=await win.webContents.executeJavaScript("document.querySelector('.analyticsChartInspector').getAttribute('aria-valuetext')");
            assert.ok(readable.includes(history.byDay[0].day),"chart announces the selected UTC day");
            assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.analyticsHistoryChartData tbody tr').length"),7,"daily data remains available to assistive technology");
          }
          const geometry=await win.webContents.executeJavaScript(`(()=>{
            const page=document.querySelector('.pageTransition[data-view="${view}"]');
            const geometry={width:page.clientWidth,scroll:page.scrollWidth};
            if(geometry.scroll > geometry.width + 3) {
              const bound=page.getBoundingClientRect();
              geometry.offenders=[...page.querySelectorAll("*")].map(node=>{
                const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
                return {name:node.tagName.toLowerCase(),className:typeof node.className==="string"?node.className.slice(0,110):"",
                  right:Math.round(rect.right-bound.right),left:Math.round(rect.left-bound.left),
                  width:Math.round(rect.width),clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,
                  overflowX:style.overflowX,position:style.position};
              }).filter(item=>item.width>0 && item.right>3 && item.position!=="absolute" && item.position!=="fixed")
                .sort((a,b)=>b.right-a.right).slice(0,16);
            }
            return geometry;
          })()`);
          assert.ok(geometry.width>0&&geometry.scroll<=geometry.width+3,"page overflow "+view+" "+mode+" "+JSON.stringify(geometry));
          if(view==="artists") {
            await until(()=>win.webContents.executeJavaScript(`(()=>{const covers=[...document.querySelectorAll(".artistCard .coverImage")].filter(img=>{const r=img.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<window.innerHeight});return covers.length>0&&covers.every(img=>img.complete&&img.naturalWidth>0&&img.classList.contains("isLoaded"))})()`).catch(()=>false),"visible artist fixture artwork "+mode+" "+width,10000);
          }
          await screenshot(win,view+"-"+mode+"-"+width);
        }
        await win.webContents.executeJavaScript("document.querySelector('.playerLyricsButton').click()");
        await until(()=>win.webContents.executeJavaScript(`(()=>{const panel=document.querySelector(".lyricsView");if(!panel||document.querySelector(".appCrashBoundary"))return false;const rect=panel.getBoundingClientRect();return rect.width>0&&rect.height>0&&Number(getComputedStyle(panel).opacity)>=0.99})()`).catch(()=>false),"visible lyrics "+mode+" "+width);
        await screenshot(win,"lyrics-"+mode+"-"+width);
        await win.webContents.executeJavaScript("document.querySelector('.lyricsView button[aria-label=\"close lyrics\"]').click()");
        await until(()=>win.webContents.executeJavaScript("!document.querySelector('.lyricsView')").catch(()=>false),"close lyrics");
      }
      win.setSize(1280,800);
      await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=settings]').click()");
      await until(()=>win.webContents.executeJavaScript("document.querySelectorAll('.settingsModeButton').length===2").catch(()=>false),"appearance navigation");
    }
    // Exercise shared menu navigation, queue editing and both listening layouts.
    await win.webContents.executeJavaScript("document.querySelector('.playerBar [aria-label=pause]')?.click()");
    await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=home]').click()");
    await until(()=>win.webContents.executeJavaScript("document.querySelectorAll('.homeListenRow').length>=4"),"Home queue fixtures");
    for(const index of [1,2,3]) {
      await win.webContents.executeJavaScript(`(()=>{const row=document.querySelectorAll('.homeListenRow')[${index}];const r=row.getBoundingClientRect();row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:r.x+12,clientY:r.y+12}));})()`);
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.songContextMenu')"),"song context menu");
      const typed=await win.webContents.executeJavaScript(`(()=>{const menu=document.querySelector('.songContextMenu');menu.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));return document.activeElement.textContent.trim()})()`);
      assert.equal(typed,"add to queue","typeahead should focus the next matching menu action");
      await win.webContents.executeJavaScript("document.activeElement.click()");
      await until(()=>win.webContents.executeJavaScript("!document.querySelector('.songContextMenu')"),"close song menu");
    }
    await win.webContents.executeJavaScript("document.querySelector('.playerBar [data-queue-trigger]').click()");
    await until(()=>win.webContents.executeJavaScript("document.querySelectorAll('.queuePanelList [data-queue-index]').length>=3"),"editable queue");
    const oldOrder=await win.webContents.executeJavaScript("[...document.querySelectorAll('[data-queue-index] .queuePanelCopy strong')].map(e=>e.textContent)");
    await win.webContents.executeJavaScript("(()=>{const b=document.querySelector('[data-queue-index] .queuePanelRowMain');b.focus();b.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',altKey:true,bubbles:true}))})()");
    await until(()=>win.webContents.executeJavaScript("document.querySelector('.queuePanelAnnouncement').textContent.includes('position 2')"),"keyboard queue reorder");
    const reordered=await win.webContents.executeJavaScript("({titles:[...document.querySelectorAll('[data-queue-index] .queuePanelCopy strong')].map(e=>e.textContent),focus:document.activeElement.closest('[data-queue-index]')?.dataset.queueIndex})");
    assert.deepEqual(reordered.titles.slice(0,2),[oldOrder[1],oldOrder[0]],"keyboard reorder preserves queue entries");
    assert.equal(reordered.focus,"1","focus follows the moved song");
    await screenshot(win,"queue-keyboard");
    await win.webContents.executeJavaScript("document.querySelector('.queuePanel [aria-label=\"close queue\"]').click()");
    await until(()=>win.webContents.executeJavaScript("!document.querySelector('.queuePanel')"),"queue dismissed");
    await win.webContents.executeJavaScript("document.querySelector('.immersiveEntry').click()");
    await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.immersivePlayer .artworkBackdropLayer[data-visible=true]')"),"independent immersive artwork");
    await win.webContents.executeJavaScript("document.querySelector('.immersiveActions [aria-label=Lyrics]').click()");
    await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.immersiveLyrics .lyricsLine')"),"embedded local lyrics");
    assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.immersiveLyrics [data-lyric-word]').length"),2,"real enhanced LRC timestamps rendered");
    const lyricTime=await win.webContents.executeJavaScript("document.querySelector('audio').currentTime");
    await win.webContents.executeJavaScript("document.querySelector('.immersiveLyrics .lyricsScroller').dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true}))");
    await until(()=>win.webContents.executeJavaScript("[...document.querySelectorAll('.lyricsHeadActions button')].some(b=>b.textContent==='Follow lyrics')"),"manual lyric browsing");
    await win.webContents.executeJavaScript("[...document.querySelectorAll('.lyricsHeadActions button')].find(b=>b.textContent==='Follow lyrics').click()");
    await until(()=>win.webContents.executeJavaScript("![...document.querySelectorAll('.lyricsHeadActions button')].some(b=>b.textContent==='Follow lyrics')"),"resume lyric following");
    assert.ok(Math.abs(await win.webContents.executeJavaScript("document.querySelector('audio').currentTime")-lyricTime)<.1,"following lyrics must not seek paused playback");
    const split=await win.webContents.executeJavaScript("(()=>{const a=document.querySelector('.immersiveArtwork'),l=document.querySelector('.immersiveLyrics');return {shown:getComputedStyle(a).display!=='none',right:a.getBoundingClientRect().right,left:l.getBoundingClientRect().left}})()");
    assert.ok(split.shown&&split.left>=split.right,"wide listening keeps cover beside lyrics: "+JSON.stringify(split));
    await sleep(250);
    await screenshot(win,"immersive-wide-lyrics");
    await win.webContents.executeJavaScript("document.querySelector('[aria-label=\"Focus on lyrics\"]').click()");
    await until(()=>win.webContents.executeJavaScript("document.querySelector('.immersiveStage').dataset.lyricsOnly==='true' && getComputedStyle(document.querySelector('.immersiveArtwork')).display==='none'"),"lyrics-only layout");
    await win.webContents.executeJavaScript("document.querySelector('[aria-label=\"Show artwork beside lyrics\"]').click()");
    win.setMinimumSize(320,480);win.setSize(390,844);
    await until(()=>win.webContents.executeJavaScript("window.innerWidth===390"),"narrow listening viewport");
    const narrow=await win.webContents.executeJavaScript("(()=>{const a=document.querySelector('.immersiveArtwork'),s=document.querySelector('.immersivePlayer'),l=document.querySelector('.immersiveLyrics');return {hidden:getComputedStyle(a).display==='none',overflow:s.scrollWidth>s.clientWidth+2,lyrics:l.clientWidth}})()");
    assert.ok(narrow.hidden&&!narrow.overflow&&narrow.lyrics>200,"narrow listening keeps lyrics readable: "+JSON.stringify(narrow));
    await screenshot(win,"immersive-narrow-lyrics");
    await win.webContents.executeJavaScript("document.querySelector('[aria-label=\"Close immersive player\"]').click()");
    await until(()=>win.webContents.executeJavaScript("!document.querySelector('.immersivePlayer')&&document.querySelector('.playerBar').contains(document.activeElement)&&document.activeElement.getClientRects().length>0"),"immersive trigger focus restored");
    await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=artists]').click()");
    await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.artistCard .mediaCardOpen')"),"narrow artist cards");
    await win.webContents.executeJavaScript("document.querySelector('.artistCard .mediaCardOpen').click()");
    await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.collectionHero')&&!!document.querySelector('.trackRow')"),"narrow collection details");
    const collection=await win.webContents.executeJavaScript("(()=>{const h=document.querySelector('.collectionHero'),p=document.querySelector('.trackRowIndex'),r=document.querySelector('.trackRow');return {hero:h.scrollWidth<=h.clientWidth+2,row:r.scrollWidth<=r.clientWidth+2,play:p.getClientRects().length>0}})()");
    assert.ok(collection.hero&&collection.row&&collection.play,"compact collections retain keyboard playback: "+JSON.stringify(collection));
    await screenshot(win,"collection-narrow");
    win.setSize(1280,800);
    const result={startupMs,reloadMs,libraryNavigationMs,playbackStartMs,interactionDefinition:"click to observed DOM/audio readiness, polling interval 16ms plus IPC overhead",startupDefinition:"desktop entry to first rendered screen (onboarding or shell); excludes fixture creation and Electron process spawn",metrics:[idle,playing,hiddenPlayback],hiddenPlaybackObservation,gpuNote:"GPU process CPU and working set are reported by process type; these are not hardware GPU utilization",memoryDefinition:"sum of Electron process working sets; may double count shared pages",platform:process.platform,fixtureSongs:songs.length,layouts,artworkTransitionLayers:samples};
    fs.writeFileSync(path.join(output,"desktop-runtime.json"),JSON.stringify(result,null,2));console.log("[desktop-qa]",JSON.stringify(result));
    clearTimeout(watchdog);server.close();app.exit(0);
  }catch(error){
    console.error(error);
    const win=BrowserWindow.getAllWindows().find(w=>!w.isDestroyed());
    if(win) {
      try { await screenshot(win,"desktop-failure"); } catch {}
      try { console.log("[desktop-qa state]",await win.webContents.executeJavaScript("JSON.stringify({title:document.title,theme:document.querySelector('.app')?.dataset.theme,themeToken:document.querySelector('.app')?getComputedStyle(document.querySelector('.app')).getPropertyValue('--lt-bg'):null,themeButtons:[...document.querySelectorAll('.settingsModeButton')].map(b=>({label:b.textContent,pressed:b.getAttribute('aria-pressed')})),headings:[...document.querySelectorAll('h1,h2')].map(e=>e.textContent),audio:[...document.querySelectorAll('audio')].map(a=>({paused:a.paused,currentTime:a.currentTime,readyState:a.readyState,error:a.error?.message}))})")); } catch {}
    }
    clearTimeout(watchdog);server.close();app.exit(1);
  }
});
