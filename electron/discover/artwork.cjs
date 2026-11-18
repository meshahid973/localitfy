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
  const alternatives = [...new Set(releases.flatMap(r => [url("release",r.id),url("release-group",r["release-group"]?.id)]).filter(Boolean))].slice(0,6);
  return {...(release ? {coverUrl:url("release",release.id),fallbackCoverUrl:url("release-group",release["release-group"]?.id),coverAlternatives:alternatives} : {}), ...(Number.isFinite(item.length) && item.length > 0 ? {durationMs:item.length} : {})};
}
function matchRecordingArtwork(items,title,artist) {
  const matches = (Array.isArray(items) ? items : []).filter(item => norm(item?.title) === norm(title) && norm(credit(item)) === norm(artist));
  return matches.length === 1 ? catalogArtwork("recording",matches[0]) : {};
}
function lastfmArtwork(track,title,artist) {
  if (norm(track?.name)!==norm(title) || norm(track?.artist?.name)!==norm(artist)) return {};
  const images = Array.isArray(track?.album?.image) ? track.album.image : [];
  const coverUrl = images.slice().reverse().map(i=>i?.["#text"]).find(value=>typeof value==="string" && /^https:\/\/(?:lastfm\.freetls\.fastly\.net|lastfm-img2\.akamaized\.net)\/i\/u\/(?:[0-9]+x[0-9]+|[0-9]+s)\/[a-f0-9]{32}\.(?:png|jpe?g|webp)$/i.test(value) && !/2a96cbd8b46e442fc41c2b86b821562f|4128a6eb29f94943c9d206c08e625904/i.test(value));
  return coverUrl ? {coverUrl} : {};
}
function createArtworkLookup(client,now=Date.now,trackInfo,lookupAudioDb) {
  const cache=new Map(), pending=new Map();
  return async (title,artist) => {
    const key=JSON.stringify([norm(title),norm(artist)]), hit=cache.get(key);
    if(hit && now()-hit.at<(hit.value.coverUrl || hit.value.fallbackCoverUrl ? 86400000 : 600000)) {
      cache.delete(key); cache.set(key,hit);
      return hit.value;
    }
    cache.delete(key);
    if(pending.has(key)) return pending.get(key);
    if(pending.size>=4) throw new Error("Artwork queue busy");
    const task=Promise.resolve().then(async()=>{
      const track = trackInfo ? await trackInfo(title,artist).catch(()=>null) : null;
      const primary = lastfmArtwork(track,title,artist);
      const verified = norm(track?.name)===norm(title)&&norm(track?.artist?.name)===norm(artist);
      const release = verified && validId(track?.album?.mbid) ? url("release",track.album.mbid) : undefined;
      if (primary.coverUrl && !lookupAudioDb) return release ? {...primary,fallbackCoverUrl:release} : primary;
      const alternate = lookupAudioDb ? await lookupAudioDb(title,artist).catch(()=>({})) : {};
      const known = [primary.coverUrl,alternate.coverUrl,release].filter(Boolean);
      if (known.length) return {coverUrl:known[0],fallbackCoverUrl:known[1],coverAlternatives:known};
      if (!client?.searchRecordings) return {};
      const items=await client.searchRecordings(title,artist,{background:true});
      const exact=(Array.isArray(items)?items:[]).filter(item=>norm(item?.title)===norm(title)&&norm(credit(item))===norm(artist));
      const identified=validId(track?.mbid)&&norm(track?.name)===norm(title)&&norm(track?.artist?.name)===norm(artist) ? exact.find(item=>item.id===track.mbid) : null;
      return identified ? catalogArtwork("recording",identified) : matchRecordingArtwork(items,title,artist);
    }).then(value=>{
      cache.set(key,{at:now(),value});
      while(cache.size>512) cache.delete(cache.keys().next().value);
      return value;
    }).finally(()=>pending.delete(key));
    pending.set(key,task);
    return task;
  };
}
module.exports={catalogArtwork,matchRecordingArtwork,createArtworkLookup,lastfmArtwork};
