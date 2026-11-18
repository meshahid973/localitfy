"use strict";

// Apple supplies catalog metadata only. Do not import its promotional art or previews.
const normalize = value => String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const clean = value => typeof value === "string" ? value.trim().slice(0,300) : "";
const keyOf = item => JSON.stringify([normalize(item.title), normalize(item.artist)]);
function searchTerms(query) {
  const text=clean(query);
  const words=text.split(/\s+/);
  if(words.length < 4 || !/\b(?:opening|ending|ost|theme|op|ed)\b/i.test(text)) return [text];
  // Keep the full query and also search its initial title phrase. Do not
  // permanently discard franchise/artist hints or change ordinary song names.
  return [...new Set([text,words.slice(0,2).join(" ")])];
}
function appleItems(body) {
  return (Array.isArray(body?.results)?body.results:[]).slice(0,50).flatMap(item=>{
    const title=clean(item.trackName),artist=clean(item.artistName),album=clean(item.collectionName);
    let url; try { url=new URL(item.trackViewUrl); } catch { return []; }
    if(!title||!artist||!Number.isSafeInteger(item.trackId)||item.trackId<=0||url.protocol!=="https:"||!["music.apple.com","itunes.apple.com"].includes(url.hostname))return [];
    return [{id:"itunes:"+item.trackId,title,artist,album,subtitle:[artist,album].filter(Boolean).join(" · "),url:url.href,durationMs:Number(item.trackTimeMillis)||undefined,storeRank:0}];
  }).map((item,index)=>({...item,storeRank:index+1}));
}
function createStoreSearch(fetchImpl=globalThis.fetch, now=Date.now) {
  const cache=new Map();
  let nextSlot=0;
  return async term=>{
    const key=normalize(term),cached=cache.get(key);
    if(cached&&now()-cached.at<86400000)return cached.items;
    // Apple documents an approximate 20-request/minute limit.
    const slot=Math.max(now(),nextSlot);nextSlot=slot+3100;
    if(slot>now())await new Promise(resolve=>setTimeout(resolve,slot-now()));
    const url=new URL("https://itunes.apple.com/search");
    url.search=new URLSearchParams({term,media:"music",entity:"song",country:"US",limit:"35"}).toString();
    const response=await fetchImpl(url.href,{signal:AbortSignal.timeout(7000),headers:{Accept:"application/json"}});
    if(!response.ok)throw Error("Music catalog unavailable");
    const items=appleItems(await response.json());
    cache.set(key,{at:now(),items});
    while(cache.size>128)cache.delete(cache.keys().next().value);
    return items;
  };
}
function rankCatalog(query, musicbrainz, store=[], popular=[]) {
  const q=normalize(query),terms=searchTerms(query).map(normalize),prefix=terms.at(-1);
  const entries=new Map();
  const merge=item=>{
    const key=keyOf(item);
    if(!normalize(item.title)||!normalize(item.artist))return;
    const old=entries.get(key);
    if(!old){entries.set(key,item);return;}
    const preferMb=old.id?.match(/^[0-9a-f-]{36}$/i);
    const base=preferMb?old:item;
    entries.set(key,{...base,album:old.album||item.album,storeRank:Math.min(old.storeRank||999,item.storeRank||999),listeners:Math.max(old.listeners||0,item.listeners||0),coverUrl:old.coverUrl||item.coverUrl,fallbackCoverUrl:old.fallbackCoverUrl||item.fallbackCoverUrl,coverAlternatives:[...new Set([...(old.coverAlternatives||[]),...(item.coverAlternatives||[])])].slice(0,6)});
  };
  [...musicbrainz,...store,...popular].forEach(merge);
  const words=q.split(" ").filter(Boolean);
  const ranked=[...entries.values()].map(item=>{
    const title=normalize(item.title),artist=normalize(item.artist),context=normalize([item.artist,item.album,item.subtitle].join(" "));
    const exact=title===q, pref=title===prefix, starts=title.startsWith(q+" "), phrase=q.startsWith(title+" ");
    const titleHits=words.filter(word=>title.split(" ").includes(word)).length;
    const contextual=words.filter(word=>context.split(" ").includes(word)).length;
    const albumHint=words.filter(word=>!title.split(" ").includes(word)&&context.split(" ").includes(word)).length;
    const score=(exact?300:pref?245:starts?150:phrase?140:0)+titleHits*12+contextual*4+albumHint*10+
      (item.storeRank?Math.max(0,55-item.storeRank):0)+Math.min(65,Math.log10(1+(Number(item.listeners)||0))*10);
    return {item,score,relevant:Boolean(exact||pref||starts||phrase||titleHits||artist===q)};
  }).filter(entry=>entry.relevant).sort((a,b)=>b.score-a.score);
  return ranked.slice(0,25).map(({item})=>item);
}
module.exports={createStoreSearch,appleItems,rankCatalog,searchTerms};
