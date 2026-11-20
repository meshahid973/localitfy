"use strict";

// Opt-in live-provider verification on integrated CI. No music playback,
// credentials, private library contents or destructive actions are involved.
const {createDeezerArtwork} = require("../electron/discover/extra-artwork.cjs");
const {createAudioDbArtwork} = require("../electron/discover/audiodb.cjs");
const {createMusicBrainzClient,coverThumbUrl} = require("../electron/musicbrainz/client.cjs");
const {createYouTubeMusicSearch} = require("../electron/discover/youtube-music.cjs");

const now = () => Date.now();
const checks = [];
const expectedTitle = "One More Time", expectedArtist = "Daft Punk";
const norm = s => String(s||"").normalize("NFKC").trim().toLowerCase();
const imageHeaders = { "User-Agent":"Localtify artwork validation (https://github.com/meshahid973/localtify)" };

async function imageAvailable(url) {
  if (!/^https:\/\//.test(url||"")) return false;
  const response = await fetch(url,{
    method:"GET",redirect:"follow",headers:{...imageHeaders,Range:"bytes=0-1023"},
    signal:AbortSignal.timeout(6000)
  });
  if (!response.ok || !/^image\//i.test(response.headers.get("content-type")||"")) {
    await response.body?.cancel().catch(()=>{});
    return false;
  }
  const reader = response.body?.getReader();
  if (!reader) return false;
  try {
    const first = await reader.read();
    if (first.done || !first.value || first.value.byteLength < 4) return false;
    const bytes = Buffer.from(first.value);
    return bytes.subarray(0,3).equals(Buffer.from("ffd8ff","hex")) ||
      bytes.subarray(0,4).equals(Buffer.from("89504e47","hex")) ||
      bytes.toString("ascii",0,4)==="RIFF" ||
      bytes.toString("ascii",0,3)==="GIF";
  } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}
async function check(provider,work) {
  const start=now();
  try {
    const outcome=await work();
    checks.push({provider,status:outcome?.status||"unavailable",metadata:outcome?.metadata||false,
      image:outcome?.image||false,elapsedMs:now()-start,
      detail:String(outcome?.detail||"").slice(0,120)});
  } catch(error) {
    checks.push({provider,status:"error",metadata:false,image:false,elapsedMs:now()-start,
      detail:String(error?.message||error).slice(0,120)});
  }
}

async function main() {
  const jobs=[];
  jobs.push(check("Deezer",async()=>{
    let httpStatus=0, responseType="";
    const lookup=createDeezerArtwork({fetchImpl:async(url,options)=>{
      const response=await fetch(url,options);
      httpStatus=response.status;
      responseType=String(response.headers.get("content-type")||"").slice(0,50);
      return response;
    }});
    const result=await lookup("recording",expectedTitle,expectedArtist);
    if(!result?.coverUrl) return {status:httpStatus && httpStatus!==200?"http-"+httpStatus:"no-exact-match",
      detail:httpStatus?"HTTP "+httpStatus+"; "+responseType:"No response or network error"};
    const image=await imageAvailable(result.coverUrl).catch(()=>false);
    return {status:image?"ok":"image-unavailable",metadata:true,image};
  }));
  jobs.push(check("MusicBrainz and Cover Art Archive",async()=>{
    const client=createMusicBrainzClient({
      userAgent:"Localtify/0.5.1 (https://github.com/meshahid973/localtify)",
      timeoutMs:9000
    });
    const matches=await client.searchRecordings(expectedTitle,expectedArtist,{background:true});
    const found=matches.find(row=>norm(row?.title)===norm(expectedTitle) &&
      (row?.["artist-credit"]||[]).some(credit=>norm(credit?.artist?.name)===norm(expectedArtist)));
    if(!found)return {status:"no-exact-match",detail:"MusicBrainz identity search yielded no exact match"};
    const release=(found.releases||[]).find(row=>/^[0-9a-f-]{36}$/i.test(row?.id||""));
    if(!release)return {status:"catalog-only",metadata:true,detail:"No release URL for CAA validation"};
    const image=await imageAvailable(coverThumbUrl(release.id)).catch(()=>false);
    return {status:image?"ok":"image-unavailable",metadata:true,image};
  }));
  jobs.push(check("YouTube Music",async()=>{
    const items=await createYouTubeMusicSearch()("recording",expectedArtist+" "+expectedTitle,{artwork:true});
    const found=items.find(row=>norm(row.title)===norm(expectedTitle)&&norm(row.artist)===norm(expectedArtist));
    if(!found?.coverUrl)return {status:"no-exact-match",detail:"No unambiguous exact recording with artwork"};
    const image=await imageAvailable(found.coverUrl).catch(()=>false);
    return {status:image?"ok":"image-unavailable",metadata:true,image};
  }));
  jobs.push(check("TheAudioDB",async()=>{
    // 123 is TheAudioDB's documented public demo key. An operator-provided
    // key can override it, but is never serialized into this report.
    const key=process.env.LOCALTIFY_AUDIODB_API_KEY||"123";
    const lookup=createAudioDbArtwork({apiKey:key});
    if(!lookup)return {status:"skipped",detail:"Invalid provider key"};
    const result=await lookup(expectedTitle,expectedArtist);
    if(!result?.coverUrl)return {status:"no-exact-match",detail:"No exact track and album identity"};
    const image=await imageAvailable(result.coverUrl).catch(()=>false);
    return {status:image?"ok":"image-unavailable",metadata:true,image};
  }));
  if(!process.env.LOCALTIFY_LASTFM_API_KEY)checks.push({
    provider:"Last.fm",status:"skipped-key-required",metadata:false,image:false,detail:"Operator API key not configured"
  });
  if(!process.env.LOCALTIFY_FANART_TV_API_KEY)checks.push({
    provider:"Fanart.tv",status:"skipped-key-required",metadata:false,image:false,detail:"Operator API key not configured"
  });
  await Promise.all(jobs);
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),sample:{title:expectedTitle,artist:expectedArtist},
    checks:checks.sort((a,b)=>a.provider.localeCompare(b.provider)),note:"Advisory network observation, not a guarantee of future provider availability"},null,2));
}
main().catch(error=>{console.error("Provider audit failed:",error);process.exitCode=1});
