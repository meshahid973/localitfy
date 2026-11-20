"use strict";
const {boundedJson}=require("./extra-artwork.cjs");

// Apple supplies catalog metadata only. Do not import its promotional art or previews.
const normalize = value => String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu," ").trim();
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
    if(!title||!artist||!Number.isSafeInteger(item.trackId)||item.trackId<=0||url.protocol!=="https:"||url.username||url.password||url.port||!["music.apple.com","itunes.apple.com"].includes(url.hostname))return [];
    return [{id:"itunes:"+item.trackId,title,artist,album,subtitle:[artist,album].filter(Boolean).join(" · "),url:url.href,durationMs:Number(item.trackTimeMillis)||undefined,storeRank:0}];
  }).map((item,index)=>({...item,storeRank:index+1}));
}
function createStoreSearch(fetchImpl=globalThis.fetch, now=Date.now) {
  const cache=new Map(),pending=new Map();
  let nextSlot=0;
  return async term=>{
    const key=normalize(term),cached=cache.get(key);
    if(!key)return [];
    if(cached&&now()-cached.at<86400000){cache.delete(key);cache.set(key,cached);return cached.items;}
    if(pending.has(key))return pending.get(key);
    if(pending.size>=4)throw Error("Music catalog queue busy");
    // Cap delayed work as well as the request rate. Never pin a large search backlog.
    const slot=Math.max(now(),nextSlot);nextSlot=slot+3100;
    const task=(async()=>{
      if(slot>now())await new Promise(resolve=>setTimeout(resolve,slot-now()));
      const url=new URL("https://itunes.apple.com/search");
      url.search=new URLSearchParams({term,media:"music",entity:"song",country:"US",limit:"35"}).toString();
      const items=appleItems(await boundedJson(fetchImpl,url.href));
      cache.set(key,{at:now(),items});
      while(cache.size>128)cache.delete(cache.keys().next().value);
      return items;
    })().finally(()=>pending.delete(key));
    pending.set(key,task);
    return task;
  };
}
function rankCatalog(query, musicbrainz, store=[], popular=[]) {
  const q=normalize(query),terms=searchTerms(query).map(normalize),prefix=terms.at(-1);
  const entries=new Map();
  const merge=item=>{
    const key=keyOf(item);
    if(!normalize(item.title)||!normalize(item.artist))return;
    const matches=entries.get(key)||[];
    const duration=Number(item.durationMs)||0;
    const compatible=matches.filter(old=>!duration||!old.durationMs||Math.abs(duration-old.durationMs)<=5000);
    const old=compatible.find(candidate=>candidate.id===item.id)||(compatible.length===1?compatible[0]:undefined);
    if(!old){matches.push(item);entries.set(key,matches);return;}
    const isMb = candidate => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(candidate.id || "");
    const base=isMb(old)?old:isMb(item)?item:old.storeRank?old:item;
    matches[matches.indexOf(old)]={...base,album:base.album||old.album||item.album,storeRank:Math.min(old.storeRank||999,item.storeRank||999),listeners:Math.max(old.listeners||0,item.listeners||0),coverUrl:old.coverUrl||item.coverUrl,fallbackCoverUrl:old.fallbackCoverUrl||item.fallbackCoverUrl,coverAlternatives:[...new Set([...(old.coverAlternatives||[]),...(item.coverAlternatives||[])])].slice(0,6)};
  };
  [...musicbrainz,...store,...popular].forEach(merge);
  const words=q.split(" ").filter(Boolean);
  const ranked=[...entries.values()].flat().map(item=>{
    const title=normalize(item.title),artist=normalize(item.artist),context=normalize([item.artist,item.album,item.subtitle].join(" "));
    const exact=title===q, pref=title===prefix, starts=title.startsWith(q+" "), phrase=q.startsWith(title+" ");
    const titleHits=words.filter(word=>title.split(" ").includes(word)).length;
    const contextual=words.filter(word=>context.split(" ").includes(word)).length;
    const albumHint=words.filter(word=>!title.split(" ").includes(word)&&context.split(" ").includes(word)).length;
    const score=(exact?300:pref?245:starts?150:phrase?140:0)+titleHits*12+contextual*4+albumHint*10+
      (item.storeRank?Math.max(0,55-item.storeRank):0)+Math.min(85,Math.log10(1+Math.max(0,Number(item.listeners)||0))*12);
    return {item,score,hasTitleMatch:Boolean(exact||pref||starts||phrase||titleHits),relevant:Boolean(exact||pref||starts||phrase||titleHits||artist===q)};
  }).filter(entry=>entry.relevant).sort((a,b)=>b.score-a.score);
  const hasTitleMatches=ranked.some(entry=>entry.hasTitleMatch);
  return ranked.filter(entry=>!hasTitleMatches||entry.hasTitleMatch).slice(0,25).map(({item})=>item);
}
module.exports={createStoreSearch,appleItems,rankCatalog,searchTerms};
