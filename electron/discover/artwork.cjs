"use strict";
const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = value => typeof value === "string" && MBID.test(value);
const norm = value => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const credit = item => (Array.isArray(item?.["artist-credit"]) ? item["artist-credit"] : []).map(c => (c?.name || c?.artist?.name || "") + (c?.joinphrase || "")).join("");
const url = (kind, id) => validId(id) ? "https://coverartarchive.org/" + kind + "/" + id + "/front-250" : undefined;
function catalogArtwork(kind, item) {
  if (kind === "album") return {coverUrl:url("release-group",item.id)};
  if (kind !== "recording") return {};
  const releases = (Array.isArray(item?.releases) ? item.releases : []).filter(r => validId(r?.id) && (!r.status || r.status === "Official"));
  releases.sort((a,b) => Number(b["cover-art-archive"]?.front === true) - Number(a["cover-art-archive"]?.front === true) || String(a.date || "9999").localeCompare(String(b.date || "9999")));
  const release = releases[0];
  return {...(release ? {coverUrl:url("release",release.id),fallbackCoverUrl:url("release-group",release["release-group"]?.id)} : {}), ...(Number.isFinite(item.length) && item.length > 0 ? {durationMs:item.length} : {})};
}
function matchRecordingArtwork(items,title,artist) {
  const matches = (Array.isArray(items) ? items : []).filter(item => norm(item?.title) === norm(title) && norm(credit(item)) === norm(artist));
  return matches.length === 1 ? catalogArtwork("recording",matches[0]) : {};
}
function createArtworkLookup(client,now=Date.now) {
  const cache=new Map(), pending=new Map();
  return async (title,artist) => {
    const key=JSON.stringify([norm(title),norm(artist)]), hit=cache.get(key);
    if(hit && now()-hit.at<(hit.value.coverUrl || hit.value.fallbackCoverUrl ? 86400000 : 600000)) {
      cache.delete(key); cache.set(key,hit);
      return hit.value;
    }
    cache.delete(key);
    if(pending.has(key)) return pending.get(key);
    if(pending.size>=4 || !client?.searchRecordings) return {};
    const task=Promise.resolve().then(()=>client.searchRecordings(title,artist,{background:true})).then(items=>{
      const value=matchRecordingArtwork(items,title,artist);
      cache.set(key,{at:now(),value});
      while(cache.size>512) cache.delete(cache.keys().next().value);
      return value;
    }).finally(()=>pending.delete(key));
    pending.set(key,task);
    return task;
  };
}
module.exports={catalogArtwork,matchRecordingArtwork,createArtworkLookup};
