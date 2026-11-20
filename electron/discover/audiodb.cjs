"use strict";
const { boundedJson } = require("./extra-artwork.cjs");
const norm = value => String(value||"").normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();
const albumImage = value => typeof value==="string" && /^https:\/\/(?:www\.|r2\.)?theaudiodb\.com\/images\/media\/album\/thumb\/[a-z0-9_-]+\.(?:jpg|jpeg|png)(?:\/(?:small|medium))?$/i.test(value) ? value : "";
function createAudioDbArtwork({apiKey, fetchImpl=globalThis.fetch, now=Date.now}) {
  if(typeof apiKey!=="string"||!/^[a-z0-9_-]{1,128}$/i.test(apiKey))return undefined;
  let nextSlot=0, blockedUntil=0;
  const request=async(endpoint,params)=>{
    if(now()<blockedUntil)return null;
    const slot=Math.max(now(),nextSlot);
    if(slot-now()>7000)return null; // avoid accumulating unbounded delayed work
    nextSlot=slot+2100;
    if(slot>now())await new Promise(resolve=>setTimeout(resolve,slot-now()));
    if(now()<blockedUntil)return null;
    const url=new URL("https://www.theaudiodb.com/api/v1/json/"+apiKey+"/"+endpoint);
    url.search=new URLSearchParams(params).toString();
    // Reuse the bounded, redirect-free JSON reader used by other artwork
    // providers. Do not forward the operator's API key to a redirect target.
    try {
      return await boundedJson(async (address, options) => {
        const response = await fetchImpl(address, options);
        if (response.status === 429) blockedUntil = now() + 60000;
        return response;
      }, url.href);
    } catch { return null; }
  };
  return async(title,artist)=>{
    const tracks=await request("searchtrack.php",{s:artist,t:title});
    const exact=(Array.isArray(tracks?.track)?tracks.track:[]).filter(track=>track && norm(track.strTrack)===norm(title)&&(norm(track.strArtist)===norm(artist)||norm(track.strArtistAlternate)===norm(artist)));
    if(!exact.length)return {};
    const ids=[...new Set(exact.map(track=>String(track.idAlbum||"")))];
    if(ids.length!==1 || !/^\d+$/.test(ids[0]) || new Set(exact.map(track=>norm(track.strAlbum))).size!==1)return {};
    const album=await request("album.php",{m:ids[0]});
    const match=(Array.isArray(album?.album)?album.album:[]).find(item=>item && String(item.idAlbum)===ids[0]&&norm(item.strAlbum)===norm(exact[0].strAlbum)&&(norm(item.strArtist)===norm(artist)||norm(item.strArtistAlternate)===norm(artist)));
    const coverUrl=albumImage(match?.strAlbumThumb);
    return coverUrl?{coverUrl}:{};
  };
}
module.exports={createAudioDbArtwork,albumImage};
