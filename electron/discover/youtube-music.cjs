"use strict";

// Adapted with the requester-reported permission from tryliner/desktop:
// src/shared/youtube/innertube/{innertubeClient,innertubeTrackMapper,
// innertubeThumbnail,innertubeSearchRanking}.ts. Localtify adaptation:
// catalog metadata only; no accounts, tokens, playback endpoints or Liner services.
const origin = "https://music.youtube.com/youtubei/v1/";
const clientVersion = "1.20260911.08.00";
const filters = { recording: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D", artist: "EgWKAQIgAWoKEAkQBRAKEAMQBA%3D%3D" };
const videoId = /^[A-Za-z0-9_-]{11}$/;
const artistId = /^UC[A-Za-z0-9_-]{22}$/;
const clean = v => typeof v === "string" ? v.trim().slice(0,300) : "";
const norm = v => clean(v).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const arr = v => Array.isArray(v) ? v : [];
const runs = v => arr(v?.runs);
const text = v => clean(runs(v).map(r=>r?.text || "").join("") || v?.simpleText);
const browse = r => r?.navigationEndpoint?.browseEndpoint;
const kindOf = r => browse(r)?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
const duration = v => {
  if (!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(v)) return undefined;
  const parts = v.split(":").map(Number);
  if (parts.at(-1)>59 || (parts.length===3 && parts[1]>59)) return undefined;
  const ms=parts.reduce((n,p)=>n*60+p,0)*1000;
  return ms>0 ? ms : undefined;
};
const junk = ["reaction","reacts","reacting","first time hearing","tutorial","how to play","guitar lesson","piano tutorial","sheet music","guitar cover","drum cover","dance cover","dance practice","podcast","interview","unboxing","1 hour loop","10 hours","full album","album stream","greatest hits","nightcore","slowed","reverb","sped up","bass boosted","8d audio","реакция","кавер","подкаст"];
const containsPhrase=(s,p)=>(" "+s+" ").includes(" "+p+" ");
function isJunkVideo(title,query) {
  const t=norm(title),q=norm(query);
  return junk.some(p=>containsPhrase(t,p)&&!containsPhrase(q,p));
}
function matchesQuery(query,title,artist) {
  const tokens=norm(query).split(" ").filter(Boolean).filter(t=>!["the","a","an","of","in","on","to","and","or","feat","ft","official","audio","video","music","lyrics","opening","ending","ost","theme","op","ed"].includes(t));
  if(!tokens.length)return false;
  const combined=norm(title+" "+artist);
  const matched=tokens.filter(t=>combined.includes(t)).length;
  return matched >= (tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length*.75));
}
function safeThumbnail(raw) {
  try {
    const u=new URL(raw);
    if(u.protocol!=="https:"||u.username||u.password||u.port||u.search||u.hash)return undefined;
    if (/^(?:lh[0-9]+\.googleusercontent\.com|yt3\.ggpht\.com|yt3\.googleusercontent\.com)$/.test(u.hostname) && /^\/[A-Za-z0-9_-]+(?:=[A-Za-z0-9_-]+)?$/.test(u.pathname)) {
      return u.origin+u.pathname.split("=")[0]+"=w256-h256-l90-rj";
    }
    if (u.hostname==="i.ytimg.com" && /^\/vi\/[A-Za-z0-9_-]{11}\/(?:hqdefault|mqdefault|default|sddefault|maxresdefault)\.jpg$/.test(u.pathname))return u.href;
  } catch {}
  return undefined;
}
function coverFor(row,id) {
  const thumbs=arr(row?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? row?.thumbnail?.thumbnails);
  const candidates=thumbs.map(t=>({url:safeThumbnail(t?.url),width:Number(t?.width)||0,height:Number(t?.height)||0})).filter(t=>t.url);
  candidates.sort((a,b)=>Number(b.width===b.height)-Number(a.width===a.height)||b.width-a.width);
  return candidates[0]?.url || (videoId.test(id)?"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg":undefined);
}
function column(row,index) {return row?.flexColumns?.[index]?.musicResponsiveListItemFlexColumnRenderer?.text;}
function mapRow(row,kind) {
  const title=text(column(row,0));
  if(!title)return null;
  const titleRun=runs(column(row,0))[0];
  const metadata=runs(column(row,1));
  if(kind==="artist"){
    const id=browse(row)?.browseId||browse(titleRun)?.browseId;
    const page=kindOf(row)||kindOf(titleRun);
    if(page!=="MUSIC_PAGE_TYPE_ARTIST"||!artistId.test(id||""))return null;
    return {id:"ytmusic:"+id,title,artist:"",subtitle:"YouTube Music",url:"https://music.youtube.com/channel/"+id,coverUrl:coverFor(row,id)};
  }
  const id=row?.playlistItemData?.videoId||titleRun?.navigationEndpoint?.watchEndpoint?.videoId||row?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId||row?.navigationEndpoint?.watchEndpoint?.videoId;
  if(!videoId.test(id||""))return null;
  const artists=metadata.filter(r=>["MUSIC_PAGE_TYPE_ARTIST","MUSIC_PAGE_TYPE_USER_CHANNEL"].includes(kindOf(r))).map(r=>clean(r.text)).filter(Boolean);
  const segments=metadata.map(r=>r?.text||"").join("").split("•").map(clean).filter(Boolean);
  if(["song","video"].includes(segments[0]?.toLowerCase()))segments.shift();
  const artist=artists.join(", ")||segments.find(v=>!duration(v)&&!/^\d[\d,.]*\s*(?:views|plays)$/i.test(v))||"";
  if(!artist)return null;
  const album=clean(metadata.find(r=>kindOf(r)==="MUSIC_PAGE_TYPE_ALBUM")?.text);
  const fixed=arr(row.fixedColumns).flatMap(c=>runs(c?.musicResponsiveListItemFixedColumnRenderer?.text));
  const durationMs=[...metadata,...fixed].map(r=>duration(clean(r?.text))).find(Boolean);
  return {id:"ytmusic:"+id,title,artist,album,subtitle:[artist,album].filter(Boolean).join(" · "),url:"https://www.youtube.com/watch?v="+id,durationMs,coverUrl:coverFor(row,id)};
}
function mapSearchResponse(body,kind,query) {
  const tabs=arr(body?.contents?.tabbedSearchResultsRenderer?.tabs);
  const sections=tabs.flatMap(t=>arr(t?.tabRenderer?.content?.sectionListRenderer?.contents));
  const items=sections.flatMap(s=>arr(s?.musicShelfRenderer?.contents).concat(arr(s?.musicCardShelfRenderer?.contents),arr(s?.itemSectionRenderer?.contents)));
  const seen=new Set(), result=[];
  for(const item of items.slice(0,150)){
    const row=item?.musicResponsiveListItemRenderer;
    if(!row)continue;
    const mapped=mapRow(row,kind);
    if(!mapped||seen.has(mapped.id)||(kind==="recording"&&isJunkVideo(mapped.title,query)))continue;
    seen.add(mapped.id);result.push(mapped);
  }
  return result.filter(v=>matchesQuery(query,v.title,v.artist)).slice(0,25);
}
async function requestCatalog(fetchImpl,endpoint,payload) {
  const response=await fetchImpl(origin+endpoint+"?prettyPrint=false",{method:"POST",redirect:"error",credentials:"omit",headers:{"content-type":"application/json",accept:"application/json","x-youtube-client-name":"67","x-youtube-client-version":clientVersion,"x-origin":"https://music.youtube.com"},body:JSON.stringify({...payload,context:{client:{clientName:"WEB_REMIX",clientVersion,hl:"en",gl:"US"}}}),signal:AbortSignal.timeout(6500)});
  if(!response.ok)throw Error("YouTube Music catalog unavailable");
  // Bound decoded response size, even when content-length is absent.
  const max=2*1024*1024;
  if(Number(response.headers?.get("content-length"))>max){await response.body?.cancel?.();throw Error("Oversized music catalog");}
  const reader=response.body?.getReader?.();
  let raw;
  if(reader){const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error("Oversized music catalog");}chunks.push(Buffer.from(value));}raw=Buffer.concat(chunks,size).toString("utf8");}finally{reader.releaseLock();}}
  else {raw=await response.text();if(Buffer.byteLength(raw)>max)throw Error("Oversized music catalog");}
  return JSON.parse(raw);
}
function createYouTubeMusicSearch(fetchImpl=globalThis.fetch,now=Date.now,maxPending=2) {
  const cache=new Map(),pending=new Map();
  return async (kind,query)=>{
    if(!Object.hasOwn(filters,kind)||typeof query!=="string"||query.trim().length<2||query.length>160)return [];
    const key=JSON.stringify([kind,query.normalize("NFKC").trim().toLowerCase()]);
    const hit=cache.get(key);
    if(hit&&now()-hit.at<300000){cache.delete(key);cache.set(key,hit);return hit.items;}
    if(pending.has(key))return pending.get(key);
    if(pending.size>=maxPending)throw Error("Music search busy");
    const task=Promise.resolve().then(async()=>{
      const body=await requestCatalog(fetchImpl,"search",{query:query.trim(),params:filters[kind]});
      const items=mapSearchResponse(body,kind,query);
      cache.set(key,{at:now(),items});while(cache.size>128)cache.delete(cache.keys().next().value);
      return items;
    }).finally(()=>pending.delete(key));
    pending.set(key,task);return task;
  };
}
// Queue mapping adapted from Liner's innertubeQueueMapper/innertubeCatalog.
// Send only the explicitly selected video ID, not Localtify history or library paths.
function mapRadioResponse(body,seed) {
  const single=body?.contents?.singleColumnMusicWatchNextResultsRenderer;
  const tabs=arr(single?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs);
  const panels=tabs.map(t=>arr(t?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents));
  const queue=panels.find(p=>p.length)||arr(single?.playlistPanelRenderer?.contents);
  const items=queue.length?queue:arr(body?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents);
  const seen=new Set([seed]), result=[];
  for(const item of items.slice(0,150)){
    const row=item?.playlistPanelVideoRenderer;
    const id=row?.videoId, title=text(row?.title);
    if(!videoId.test(id||"")||!title||seen.has(id)||isJunkVideo(title,""))continue;
    const byline=row.longBylineText??row.shortBylineText??row.bylineText;
    const metadata=runs(byline);
    const artist=metadata.filter(r=>["MUSIC_PAGE_TYPE_ARTIST","MUSIC_PAGE_TYPE_USER_CHANNEL"].includes(kindOf(r))).map(r=>clean(r.text)).filter(Boolean).join(", ")||text(byline).split("•")[0].trim();
    if(!artist)continue;
    const album=clean(metadata.find(r=>kindOf(r)==="MUSIC_PAGE_TYPE_ALBUM")?.text);
    const durationMs=duration(text(row.lengthText??row.duration));
    seen.add(id);
    result.push({id:"ytmusic:"+id,title,artist,album,subtitle:[artist,album].filter(Boolean).join(" · "),url:"https://www.youtube.com/watch?v="+id,durationMs,coverUrl:coverFor(row,id)});
    if(result.length>=25)break;
  }
  return result;
}
function createYouTubeMusicRadio(fetchImpl=globalThis.fetch,now=Date.now) {
  const cache=new Map(),pending=new Map();
  return async seed=>{
    if(typeof seed!=="string"||!videoId.test(seed))throw Error("Invalid radio seed");
    const hit=cache.get(seed);
    if(hit&&now()-hit.at<300000){cache.delete(seed);cache.set(seed,hit);return hit.items;}
    if(pending.has(seed))return pending.get(seed);
    if(pending.size>=2)throw Error("Music discovery busy");
    const task=requestCatalog(fetchImpl,"next",{videoId:seed,playlistId:"RDAMVM"+seed})
      .then(body=>mapRadioResponse(body,seed)).then(items=>{cache.set(seed,{at:now(),items});while(cache.size>64)cache.delete(cache.keys().next().value);return items;})
      .finally(()=>pending.delete(seed));
    pending.set(seed,task);return task;
  };
}
// Only skip secondary matching if catalog title, artist and known duration agree.
function exactMusicCandidate(wanted, items) {
  const title=norm(wanted?.title || wanted?.name), artist=norm(wanted?.artist || wanted?.artists);
  const durationMs=Number(wanted?.durationMs) || Number(wanted?.duration)*1000 || 0;
  if(!title||!artist||!Number.isFinite(durationMs)||durationMs<=0)return null;
  const exact=arr(items).filter(item=>norm(item.title)===title&&norm(item.artist)===artist&&Number.isFinite(item.durationMs)&&Math.abs(item.durationMs-durationMs)<=3000&&/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(item.url||""));
  // Different video IDs may refer to different recordings; ambiguity falls back.
  const unique=[...new Map(exact.map(item=>[item.url,item])).values()];
  return unique.length===1?unique[0]:null;
}
module.exports={createYouTubeMusicSearch,createYouTubeMusicRadio,mapSearchResponse,mapRadioResponse,safeThumbnail,isJunkVideo,matchesQuery,exactMusicCandidate};
