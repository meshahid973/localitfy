"use strict";

// Public catalog artwork, no playback, authentication cookies or third-party scraper.
// Fanart.tv is optional and uses the operator's own API key.
const MBID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const key=value=>String(value||"").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu," ").trim();
const artistKey=value=>key(String(value||"").replace(/\s+[-–—]\s+Topic$/i,""));
const arr=value=>Array.isArray(value)?value:[];
const validId=value=>Number.isSafeInteger(value)&&value>0;
function deezerImage(raw,kind) {
  if(typeof raw!=="string"||raw.length>1000)return undefined;
  try{
    const u=new URL(raw);
    if(u.protocol!=="https:"||u.username||u.password||u.port||u.search||u.hash||!["e-cdns-images.dzcdn.net","cdns-images.dzcdn.net","cdn-images.dzcdn.net"].includes(u.hostname))return undefined;
    const pattern=kind==="artist"?/^\/images\/artist\/[a-f0-9]{32}\/(?:56|250|500|1000)x(?:56|250|500|1000)-000000-80-0-0\.jpg$/i:/^\/images\/cover\/[a-f0-9]{32}\/(?:56|250|500|1000)x(?:56|250|500|1000)-000000-80-0-0\.jpg$/i;
    if(!pattern.test(u.pathname)||/\/0{32}\//.test(u.pathname))return undefined;
    u.pathname=u.pathname.replace(/\/\d+x\d+-000000-80-0-0\.jpg$/,"/250x250-000000-80-0-0.jpg");
    return u.href;
  }catch{return undefined;}
}
function matchDeezerArtwork(body,kind,title,artist="") {
  const items=arr(body?.data).slice(0,25);
  if(kind==="artist"){
    const exact=items.filter(i=>validId(i?.id)&&artistKey(i.name)===artistKey(title)&&artistKey(title));
    const unique=[...new Map(exact.map(i=>[i.id,i])).values()];
    if(unique.length!==1)return {};
    const coverUrl=deezerImage(unique[0].picture_medium||unique[0].picture_big,"artist");
    return coverUrl?{coverUrl}:{};
  }
  if(kind!=="recording"||!key(title)||!artistKey(artist))return {};
  const exact=items.filter(i=>validId(i?.id)&&key(i.title)===key(title)&&artistKey(i.artist?.name)===artistKey(artist)&&validId(i.album?.id));
  // Search can return compilations and reissues for the same recording. An
  // arbitrary first cover would silently attach the wrong album artwork.
  if(new Set(exact.map(i=>i.album.id)).size!==1)return {};
  const durations=exact.map(i=>i.duration).filter(n=>Number.isFinite(n)&&n>0);
  if(durations.length>1&&Math.max(...durations)-Math.min(...durations)>5)return {};
  const covers=[...new Set(exact.map(i=>deezerImage(i.album.cover_medium||i.album.cover_big,"recording")).filter(Boolean))].slice(0,4);
  if(!covers.length)return {};
  return {coverUrl:covers[0],...(covers.length>1?{coverAlternatives:covers}:{}),...(durations.length?{durationMs:durations[0]*1000}:{})};
}
async function boundedJson(fetchImpl,url,headers={}) {
  const response=await fetchImpl(url,{method:"GET",credentials:"omit",redirect:"error",headers:{Accept:"application/json",...headers},signal:AbortSignal.timeout(5500)});
  if(!response.ok||response.status===429){
    await response.body?.cancel?.().catch(()=>undefined);
    const error=new Error("Artwork provider unavailable");
    error.status=response.status;
    throw error;
  }
  const max=512*1024;
  if(Number(response.headers?.get("content-length"))>max){await response.body?.cancel?.().catch(()=>undefined);throw Error("Oversized artwork response");}
  const reader=response.body?.getReader?.();
  let raw;
  if(reader){
    const chunks=[];let size=0;
    try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error("Oversized artwork response");}chunks.push(Buffer.from(value));}raw=Buffer.concat(chunks,size).toString("utf8");}
    finally{reader.releaseLock();}
  }else{raw=await response.text();if(Buffer.byteLength(raw)>max)throw Error("Oversized artwork response");}
  const body=JSON.parse(raw);
  if(body?.error||body?.status==="error")throw Error("Artwork provider error");
  return body;
}
function cachedLookup(work,now=Date.now) {
  const cached=new Map(),pending=new Map();let blockedUntil=0;
  return async(...args)=>{
    const id=JSON.stringify(args.map(v=>String(v||"").normalize("NFKC").trim().toLowerCase()));
    const hit=cached.get(id);
    if(hit&&now()-hit.at<(hit.value.coverUrl?86400000:30000)){cached.delete(id);cached.set(id,hit);return hit.value;}
    cached.delete(id);
    if(pending.has(id))return pending.get(id);
    if(pending.size>=4||now()<blockedUntil)return {};
    const promise=Promise.resolve().then(()=>work(...args)).then(value=>{
      cached.set(id,{at:now(),value});while(cached.size>256)cached.delete(cached.keys().next().value);return value;
    }).catch(error=>{
      // A forbidden or rate-limited source should not be polled on every
      // navigation. Other artwork providers remain independently available.
      const cooldown=error?.status===403?300000:error?.status===429?60000:15000;
      blockedUntil=now()+cooldown;
      return {};
    }).finally(()=>pending.delete(id));
    pending.set(id,promise);return promise;
  };
}
function createDeezerArtwork({fetchImpl=globalThis.fetch,now=Date.now}={}) {
  return cachedLookup(async(kind,title,artist="")=>{
    if(!["artist","recording"].includes(kind)||typeof title!=="string"||title.length>300||!title.trim()||(kind==="recording"&&(!artistKey(artist)||typeof artist!=="string"||artist.length>300)))return {};
    const clean=value=>String(value).replace(/["\\]/g," ").trim();
    const query=kind==="artist"?clean(title.replace(/\s+[-–—]\s+Topic$/i,"")):`${clean(artist.replace(/\s+[-–—]\s+Topic$/i,""))} ${clean(title)}`;
    const url=new URL(kind==="artist"?"https://api.deezer.com/search/artist":"https://api.deezer.com/search");
    url.search=new URLSearchParams({q:query,limit:"25"}).toString();
    return matchDeezerArtwork(await boundedJson(fetchImpl,url.href),kind,title,artist);
  },now);
}
function fanartImage(raw,kind) {
  if(typeof raw!=="string"||raw.length>1000)return undefined;
  try{
    const u=new URL(raw);
    if(!["http:","https:"].includes(u.protocol)||u.hostname!=="assets.fanart.tv"||u.username||u.password||u.port||u.search||u.hash)return undefined;
    const parts=u.pathname.split("/");
    if(parts.length!==6||parts[1]!=="fanart"||parts[2]!=="music"||!MBID.test(parts[3])||parts[4]!==kind||!/^[-a-z0-9_.%]+\.(?:jpg|jpeg|png)$/i.test(parts[5])||/%(?:2f|5c|2e|25)/i.test(parts[5]))return undefined;
    u.protocol="https:";return u.href+"/preview";
  }catch{return undefined;}
}
function matchFanartArtwork(body,kind,id) {
  if(!MBID.test(id))return {};
  let images;
  if(kind==="artist"){
    if(String(body?.mbid||body?.mb_id||"").toLowerCase()!==id.toLowerCase())return {};
    images=body.artistthumb;
  }else if(kind==="album"){
    const album=arr(body?.albums).find(i=>String(i?.release_group_id||"").toLowerCase()===id.toLowerCase());
    images=album?.albumcover;
  }else return {};
  const covers=[...new Set(arr(images).slice(0,50).slice().sort((a,b)=>(Number(b?.likes)||0)-(Number(a?.likes)||0)).map(i=>fanartImage(i?.url,kind==="artist"?"artistthumb":"albumcover")).filter(Boolean))].slice(0,4);
  return covers.length?{coverUrl:covers[0],...(covers.length>1?{coverAlternatives:covers}:{})}:{};
}
function createFanartArtwork({apiKey,fetchImpl=globalThis.fetch,now=Date.now}={}) {
  if(typeof apiKey!=="string"||!/^[-a-zA-Z0-9_]{16,128}$/.test(apiKey))return undefined;
  return cachedLookup(async(kind,id)=>{
    if(!["artist","album"].includes(kind)||typeof id!=="string"||!MBID.test(id))return {};
    const url="https://webservice.fanart.tv/v3.2/music/"+(kind==="album"?"albums/":"")+id;
    return matchFanartArtwork(await boundedJson(fetchImpl,url,{"api-key":apiKey}),kind,id);
  },now);
}
module.exports={createDeezerArtwork,createFanartArtwork,matchDeezerArtwork,matchFanartArtwork,deezerImage,fanartImage,boundedJson};
