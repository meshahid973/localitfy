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
const version=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")).version;
function wav(name){
  const samples=48000*20,buf=Buffer.alloc(44+samples*2);
  buf.write("RIFF",0);buf.writeUInt32LE(buf.length-8,4);buf.write("WAVEfmt ",8);buf.writeUInt32LE(16,16);
  buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(48000,24);buf.writeUInt32LE(96000,28);
  buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write("data",36);buf.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)buf.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/48000)*1000),44+i*2);
  const target=path.join(dir,name+".wav");fs.writeFileSync(target,buf);return target;
}
const songs=Array.from({length:12},(_,i)=>({id:"qa-"+i,title:"test track "+i,artist:"test artist "+(i%8),album:"test album "+Math.floor(i/4),genre:"ambient",filePath:wav("qa-"+i),duration:20,dateAdded:"2026-01-01T00:00:00Z",playCount:12-i,lastPlayed:"2026-11-16T00:00:00Z",liked:i===0}));
for (const song of songs) fs.writeFileSync(song.filePath.replace(/\.wav$/, ".lrc"), "[00:00.00]Local lyric fixture\n[00:05.00]Second lyric line\n");
const seed=spawnSync(process.execPath,["-e",
  "const db=require(process.argv[1]);db.initDatabase(process.argv[2]);const songs=JSON.parse(process.argv[3]);db.insertSongs(songs);db.savePlaylists([{id:'qa-playlist',name:'qa playlist',songIds:songs.map(s=>s.id),createdAt:Date.now()}]);db.saveSettings({startWithWindows:false,idleScreensaverEnabled:false,discordRpcEnabled:false,reducedMotion:false,discoverEnabled:true,lyricsEnabled:true,lyricsOnlineLookup:false,coverColorSyncMode:'strong',homeBannerType:'dynamic',showAmbientGradient:true,playerBackgroundStyle:'coverBlur',homeHiddenSections:['dailyMixes','likedSongs','rediscover','notPlayedYet']});",
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
const watchdog=setTimeout(()=>{console.error("Integrated visual smoke timed out");server.close();app.exit(1);},210000);
server.listen(5173,async()=>{
  try{
    const started=Date.now();
    // Actual desktop entry, real preload and temp SQLite library. No user data.
    require(path.join(root,"electron/main.cjs"));
    await app.whenReady();
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:/i.test(details.url)&&!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/)/i.test(details.url)}));
    const win=await until(()=>BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL().includes("localhost:5173")),"desktop window");
    await until(()=>win.webContents.executeJavaScript("document.readyState === 'complete' && !!document.querySelector('#root')").catch(()=>false),"document ready");
    await win.webContents.executeJavaScript(`localStorage.setItem('localitfy.onboarding.v1','done');localStorage.setItem('localitfy.onboarding.release-showcase.' + ${JSON.stringify(version)},'done');localStorage.setItem('localitfy.whatsNewSeenVersion',${JSON.stringify(version)})`);
    win.webContents.reload();
    await until(()=>win.webContents.executeJavaScript("!document.querySelector('.appCrashBoundary') && !!document.querySelector('.appShell')").catch(()=>false),"desktop shell");
    const startupMs=Date.now()-started;
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
          player:style(app.querySelector('.playerBar')).backgroundColor,
          clipped:buttons.some(el=>rect(el).left<rect(sidebar).left-1||rect(el).right>rect(sidebar).right+1)
        };
      })()`);
      assert.equal(chrome.mode,"slim");
      assert.equal(chrome.retired,false,"retired sidebar destinations");
      assert.ok(chrome.pinned&&chrome.homeVisible,"Settings and Home must remain visible: "+JSON.stringify(chrome));
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
      assert.equal(chrome.player,"rgba(0, 0, 0, 0)","ambient player bar must be transparent");
    }
    await assertShellChrome();
    await screenshot(win,"desktop-home");
    const idle=await metrics("desktop idle");
    // Exercise actual rendered library navigation and playback.
    const clicked=await win.webContents.executeJavaScript("(()=>{const b=document.querySelector('.sidebar [data-nav-id=library]');if(!b)return false;b.click();return true})()");
    assert.ok(clicked,"library navigation missing");
    await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.sidebar [data-nav-id=library].active') && (!!document.querySelector('.songButton') || !!document.querySelector('.homeAlbumPlayZone'))").catch(()=>false),"library tracks");
    await screenshot(win,"desktop-library");
    await win.webContents.executeJavaScript("(document.querySelector('.songButton')||document.querySelector('.homeAlbumPlayZone')).click()");
    await until(()=>win.webContents.executeJavaScript("[...document.querySelectorAll('audio')].some(a=>!a.paused&&a.currentTime>0)").catch(()=>false),"audio playing");
    await screenshot(win,"desktop-playing");
    assert.equal(await win.webContents.executeJavaScript("typeof window.localitfy.onWatchedFoldersChange"), "function", "current preload exposes watched-folder events");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector(\".app\")?.dataset.appVersion"), version, "renderer version matches package");
    const playing=await metrics("desktop playback");
    await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=home]').click()");
    await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.homeFeatureCover') && !!document.querySelector('.homeAtmosphere .artworkBackdropLayer[data-visible=true]')").catch(()=>false),"artwork-led Home");
    async function homeGeometry(width,height) {
      win.setSize(width,height);
      await until(()=>win.getSize()[0]===width && win.webContents.executeJavaScript("window.innerWidth").then(actual=>actual===width),"requested viewport "+width,5000);
      const state=await win.webContents.executeJavaScript(`(()=>{
        const page=document.querySelector('.homePage');
        const atmosphere=page.querySelector('.homeAtmosphere');
        const artist=page.querySelector('.homeArtistCard .mediaCardCover');
        const rail=page.querySelector('.homeReleaseRail');
        artist?.scrollIntoView({block:'center'});
        const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,right:r.right,width:r.width,height:r.height}:null};
        const shelves=[...page.querySelectorAll('.homeArtistRail,.homeReleaseRail')];
        return {viewport:window.innerWidth,page:rect(page),atmosphere:rect(atmosphere),artist:rect(artist),rail:rail?{width:rail.clientWidth,scrollWidth:rail.scrollWidth}:null,hidden:shelves.every(e=>getComputedStyle(e).scrollbarWidth==='none')};
      })()`);
      assert.equal(state.viewport,width,"actual renderer viewport");
      assert.ok(state.artist&&state.artist.width>=64&&Math.abs(state.artist.width-state.artist.height)<=3,"artist artwork collapsed at "+width+": "+JSON.stringify(state));
      assert.ok(state.atmosphere&&Math.abs(state.page.x-state.atmosphere.x)<=3&&Math.abs(state.page.right-state.atmosphere.right)<=3,"ambient image should reach Home boundaries: "+JSON.stringify(state));
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
    const previous=await win.webContents.executeJavaScript("document.querySelector('.homeFeatureCover').dataset.coverTitle");
    await win.webContents.executeJavaScript("document.querySelector('.playerBar button[aria-label=\\\"next song\\\"]').click()");
    await until(()=>win.webContents.executeJavaScript("document.querySelector('.homeFeatureCover')?.dataset.coverTitle").then(title=>title&&title!==previous).catch(()=>false),"next track");
    const samples=[];
    for(let index=0;index<8;index++){samples.push(await win.webContents.executeJavaScript("document.querySelectorAll('.homeAtmosphere .artworkBackdropLayer').length"));await sleep(100);}
    assert.ok(samples.every(n=>n>=1&&n<=2),"ambient transition must keep at most two artwork layers");
    await until(()=>win.webContents.executeJavaScript("document.querySelectorAll('.homeAtmosphere .artworkBackdropLayer').length===1 && !!document.querySelector('.homeAtmosphere .artworkBackdropLayer[data-visible=true]')").catch(()=>false),"settled artwork transition",5000);
    await screenshot(win,"home-next-track");
    await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=settings]').click()");
    await until(()=>win.webContents.executeJavaScript("document.querySelectorAll('.settingsModeButton').length===2").catch(()=>false),"two appearance modes");
    for(const mode of ["light","dark"]){
      await win.webContents.executeJavaScript(`document.querySelector('.settingsModeButton:has([data-preview-mode="${mode}"])').click()`);
      await until(()=>win.webContents.executeJavaScript(`document.querySelector('.app')?.dataset.theme===${JSON.stringify(mode)} && getComputedStyle(document.querySelector('.app')).getPropertyValue('--lt-bg').trim()===${JSON.stringify(mode==="light"?"#f5f5f7":"#000000")}`).catch(()=>false),"apply "+mode);
      await assertShellChrome();
      await screenshot(win,"settings-"+mode);
      await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=library]').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.libraryCollectionShortcuts')").catch(()=>false),"library "+mode);
      await screenshot(win,"library-"+mode);
      await win.webContents.executeJavaScript("document.querySelector('.libraryCollectionShortcuts button:has([data-kind=liked])').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.libraryPageLiked')").catch(()=>false),"liked songs "+mode);
      await screenshot(win,"liked-"+mode);
      await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=home]').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.homeStartButton')").catch(()=>false),"Home "+mode);
      await assertShellChrome();
      await screenshot(win,"home-"+mode);
      await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=discover]').click()");
      await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.discoverPage') && !document.querySelector('.appCrashBoundary')").catch(()=>false),"Discover "+mode);
      await screenshot(win,"discover-"+mode);
      for (const width of [1280,860]) {
        win.setSize(width,800);
        await until(()=>win.webContents.executeJavaScript("window.innerWidth").then(actual=>actual===width),"viewport "+width,5000);
        for (const view of ["home","library","artists","genres","playlists","discover","downloads","covers","analytics","settings"]) {
          await win.webContents.executeJavaScript(`document.querySelector('.sidebar [data-nav-id="${view}"]').click()`);
          await until(()=>win.webContents.executeJavaScript(`(()=>{const page=document.querySelector('.pageTransition[data-view="${view}"]');return !!page?.firstElementChild&&!document.querySelector('.appCrashBoundary')})()`).catch(()=>false),view+" "+mode+" "+width);
          const geometry=await win.webContents.executeJavaScript(`(()=>{const page=document.querySelector('.pageTransition[data-view="${view}"]');return {width:page.clientWidth,scroll:page.scrollWidth}})()`);
          assert.ok(geometry.width>0&&geometry.scroll<=geometry.width+3,"page overflow "+view+" "+mode+" "+JSON.stringify(geometry));
          await screenshot(win,view+"-"+mode+"-"+width);
        }
        await win.webContents.executeJavaScript("document.querySelector('.playerLyricsButton').click()");
        await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.lyricsView')&&!document.querySelector('.appCrashBoundary')").catch(()=>false),"lyrics "+mode+" "+width);
        await screenshot(win,"lyrics-"+mode+"-"+width);
        await win.webContents.executeJavaScript("document.querySelector('.lyricsView button[aria-label=\"close lyrics\"]').click()");
        await until(()=>win.webContents.executeJavaScript("!document.querySelector('.lyricsView')").catch(()=>false),"close lyrics");
      }
      win.setSize(1280,800);
      await win.webContents.executeJavaScript("document.querySelector('.sidebar [data-nav-id=settings]').click()");
      await until(()=>win.webContents.executeJavaScript("document.querySelectorAll('.settingsModeButton').length===2").catch(()=>false),"appearance navigation");
    }
    const result={startupMs,metrics:[idle,playing],platform:process.platform,fixtureSongs:songs.length,layouts,artworkTransitionLayers:samples};
    fs.writeFileSync(path.join(output,"desktop-runtime.json"),JSON.stringify(result,null,2));console.log("[desktop-qa]",JSON.stringify(result));
    clearTimeout(watchdog);server.close();app.exit(0);
  }catch(error){
    console.error(error);
    const win=BrowserWindow.getAllWindows().find(w=>!w.isDestroyed());
    if(win) {
      try { await screenshot(win,"desktop-failure"); } catch {}
      try { console.log("[desktop-qa state]",await win.webContents.executeJavaScript("JSON.stringify({title:document.title,headings:[...document.querySelectorAll('h1,h2')].map(e=>e.textContent),audio:[...document.querySelectorAll('audio')].map(a=>({paused:a.paused,currentTime:a.currentTime,readyState:a.readyState,error:a.error?.message}))})")); } catch {}
    }
    clearTimeout(watchdog);server.close();app.exit(1);
  }
});
