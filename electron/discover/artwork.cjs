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
function findRecording(items,title,artist,recordingId) {
  const matches=(Array.isArray(items)?items:[]).filter(item=>norm(item?.title)===norm(title)&&norm(credit(item))===norm(artist));
  const identified=validId(recordingId)?matches.find(item=>item.id===recordingId):undefined;
  return validId(recordingId) ? identified : (matches.length===1?matches[0]:undefined);
}
function lastfmArtwork(track,title,artist) {
  if (norm(track?.name)!==norm(title) || norm(track?.artist?.name)!==norm(artist)) return {};
  const images = Array.isArray(track?.album?.image) ? track.album.image : [];
  const coverUrl = images.slice().reverse().map(i=>i?.["#text"]).find(value=>typeof value==="string" && /^https:\/\/(?:lastfm\.freetls\.fastly\.net|lastfm-img2\.akamaized\.net)\/i\/u\/(?:[0-9]+x[0-9]+|[0-9]+s)\/[a-f0-9]{32}\.(?:png|jpe?g|webp)$/i.test(value) && !/2a96cbd8b46e442fc41c2b86b821562f|4128a6eb29f94943c9d206c08e625904/i.test(value));
  return coverUrl ? {coverUrl} : {};
}
// Reuse the catalog's actual artwork, accounting for formatting differences
// without stripping version markers (live, remix, slowed, etc.).
const musicKey = value => norm(value).replace(/[^\p{L}\p{N}\p{M}]+/gu," ").trim();
const titleKey = value => musicKey(norm(value).replace(/\s*[([]\s*(?:official\s+(?:music\s+)?video|official\s+audio|lyric\s+video|official\s+lyric\s+video)\s*[)\]]\s*$/i,""));
const artistKey = value => musicKey(norm(value).replace(/\s+[-–—]\s+topic$/i,""));
const equivalentArtist=(a,b)=>artistKey(a)===artistKey(b) && Boolean(artistKey(b));
function matchMusicArtwork(items,title,artist,identity = {}) {
  const {safeThumbnail}=require("./youtube-music.cjs");
  const wantedArtist=artistKey(artist);
  const wantedTitle=titleKey(title);
  const artistPrefix=norm(title).split(/\s+-\s+/);
  const titleKeys=new Set([wantedTitle]);
  if(artistPrefix.length>1 && artistKey(artistPrefix[0])===wantedArtist) titleKeys.add(titleKey(artistPrefix.slice(1).join(" - ")));
  const matches=(Array.isArray(items)?items:[]).filter(item=>titleKeys.has(titleKey(item?.title))&&equivalentArtist(item?.artist,artist) &&
    (!identity.providerId || item.id === identity.providerId) &&
    (!identity.album || !item.album || norm(item.album) === norm(identity.album)) &&
    (!identity.durationMs || !Number.isFinite(item.durationMs) || Math.abs(item.durationMs-identity.durationMs) <= 5000))
    .map(item=>({...item,coverUrl:safeThumbnail(item.coverUrl)})).filter(item=>item.coverUrl);
  if(!wantedArtist||!wantedTitle||!matches.length)return {};
  // Different releases of the same exact song can have valid alternate art.
  // Reject conflicting known lengths rather than attaching an unrelated version.
  const lengths=matches.map(item=>item.durationMs).filter(v=>Number.isFinite(v)&&v>0);
  if(lengths.length>1&&Math.max(...lengths)-Math.min(...lengths)>5000)return {};
  const ranked=matches.slice().sort((a,b)=>Number(b.coverUrl.includes("googleusercontent"))-Number(a.coverUrl.includes("googleusercontent")));
  const item=ranked[0];
  const covers=[...new Set(ranked.flatMap(candidate=>{
    const id=/^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/.exec(candidate.url||"")?.[1];
    return [candidate.coverUrl,id?"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg":undefined].filter(Boolean);
  }))].slice(0,6);
  return {coverUrl:item.coverUrl,...(covers.length>1?{coverAlternatives:covers}:{}),...(Number.isFinite(item.durationMs)&&item.durationMs>0?{durationMs:item.durationMs}:{})};
}
function matchArtistArtwork(items,name,providerId = "") {
  const {safeThumbnail}=require("./youtube-music.cjs");
  const exact=(Array.isArray(items)?items:[]).filter(item=>artistKey(item?.title)===artistKey(name)&&(!providerId||item.id===providerId)&&/^ytmusic:UC[A-Za-z0-9_-]{22}$/.test(item.id||"")&&safeThumbnail(item.coverUrl));
  const unique=[...new Map(exact.map(item=>[item.id,item])).values()];
  return unique.length===1?{coverUrl:safeThumbnail(unique[0].coverUrl)}:{};
}
function createArtworkLookup(client,now=Date.now,trackInfo,lookupAudioDb,lookupMusic,lookupDeezer,lookupFanart) {
  const cache=new Map(), pending=new Map();
  return async (title,artist,{fallback=false}={}) => {
    const key=JSON.stringify([norm(title),norm(artist),fallback]), hit=cache.get(key);
    if(hit && now()-hit.at<86400000) {
      cache.delete(key); cache.set(key,hit);
      return hit.value;
    }
    cache.delete(key);
    if(pending.has(key)) return pending.get(key);
    if(pending.size>=4) throw new Error("Artwork queue busy");
    const task=Promise.resolve().then(async()=>{
      if (lookupMusic && !fallback) {
        const direct = matchMusicArtwork(await lookupMusic(title,artist).catch(()=>[]),title,artist);
        if (direct.coverUrl) return direct;
      }
      const deezerJob = () => lookupDeezer ? lookupDeezer("recording",title,artist).catch(()=>({})) : Promise.resolve({});
      // The independently verified, keyed providers can be fetched together.
      // Deezer is optional: HTTP 403 at its edge must not delay available art.
      const trackJob = trackInfo ? trackInfo(title,artist).catch(()=>null) : Promise.resolve(null);
      const alternateJob = lookupAudioDb ? lookupAudioDb(title,artist).catch(()=>({})) : Promise.resolve({});
      const track = await trackJob;
      const primary = lastfmArtwork(track,title,artist);
      const verified = norm(track?.name)===norm(title)&&norm(track?.artist?.name)===norm(artist);
      const release = verified && validId(track?.album?.mbid) ? url("release",track.album.mbid) : undefined;
      if (primary.coverUrl && !fallback) return {...primary,...(release?{fallbackCoverUrl:release}:{})};
      const alternate = await alternateJob;
      if (alternate.coverUrl && !fallback) return {coverUrl:alternate.coverUrl,...(release?{fallbackCoverUrl:release}:{})};
      // A retry after a broken image prefers catalog releases; don't fall
      // back into the very same Deezer image that failed in the renderer.
      const deezer = fallback ? {} : await deezerJob();
      if (deezer.coverUrl && !fallback) return deezer;
      const known = [...new Set([primary.coverUrl,alternate.coverUrl,release,deezer.coverUrl,...(deezer.coverAlternatives||[])].filter(Boolean))];
      const knownArt=known.length?{coverUrl:known[0],fallbackCoverUrl:known[1],coverAlternatives:known.slice(0,6)}:{};
      if (known.length && !fallback) return knownArt;
      if (!client?.searchRecordings) return knownArt;
      const items=await client.searchRecordings(title,artist,{background:true}).catch(error=>{if(known.length)return [];throw error;});
      const matched=findRecording(items,title,artist,verified?track?.mbid:undefined);
      if(!matched)return knownArt;
      const result=catalogArtwork("recording",matched);
      if(lookupFanart){
        const groups=[...new Set((Array.isArray(matched.releases)?matched.releases:[]).filter(r=>!r.status||r.status==="Official").map(r=>r?.["release-group"]?.id).filter(validId))];
        if(groups.length===1){
          const supplemental=await lookupFanart("album",groups[0]).catch(()=>({}));
          if(supplemental.coverUrl){
            const covers=[...new Set([supplemental.coverUrl,...(supplemental.coverAlternatives||[]),result.coverUrl,result.fallbackCoverUrl,...(result.coverAlternatives||[]),...known].filter(Boolean))].slice(0,6);
            return {...result,coverUrl:covers[0],fallbackCoverUrl:covers[1],coverAlternatives:covers};
          }
        }
      }
      if(!known.length)return result;
      const covers=[...new Set([result.coverUrl,result.fallbackCoverUrl,...(result.coverAlternatives||[]),...known].filter(Boolean))].slice(0,6);
      return {...result,coverUrl:covers[0],fallbackCoverUrl:covers[1],coverAlternatives:covers};
    }).then(value=>{
      if(value.coverUrl||value.fallbackCoverUrl) cache.set(key,{at:now(),value});
      while(cache.size>512) cache.delete(cache.keys().next().value);
      return value;
    }).finally(()=>pending.delete(key));
    pending.set(key,task);
    return task;
  };
}
module.exports={catalogArtwork,createArtworkLookup,lastfmArtwork,matchMusicArtwork,matchArtistArtwork};
