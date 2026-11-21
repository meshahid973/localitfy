import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {createDeezerArtwork,createFanartArtwork,matchDeezerArtwork,matchFanartArtwork,deezerImage,fanartImage}=require("../../electron/discover/extra-artwork.cjs");
const id="12345678-1234-1234-1234-123456789abc";
const hash="0123456789abcdef0123456789abcdef";
const cover="https://e-cdns-images.dzcdn.net/images/cover/"+hash+"/250x250-000000-80-0-0.jpg";
const portrait=cover.replace("/cover/","/artist/");
const track={id:1,title:"Bang Bang",artist:{name:"B.A. Robertson"},album:{id:2,cover_medium:cover},duration:200};
const response=body=>({ok:true,text:async()=>JSON.stringify(body)});
test("Deezer only returns matching song versions and exact artist identities",()=>{
 assert.deepEqual(matchDeezerArtwork({data:[{...track,title:"Bang Bang (Live)"},track]},"recording","Bang Bang","B.A. Robertson"),{coverUrl:cover,durationMs:200000});
 assert.deepEqual(matchDeezerArtwork({data:[track]},"recording","Bang Bang","Another artist"),{});
 assert.deepEqual(matchDeezerArtwork({data:[track,{...track,id:3,duration:300}]},"recording","Bang Bang","B.A. Robertson"),{});
 assert.deepEqual(matchDeezerArtwork({data:[track,{...track,id:4,album:{id:99,cover_medium:portrait}}]},"recording","Bang Bang","B.A. Robertson"),{}, "ambiguous release identity must not reuse unrelated album art");
 assert.deepEqual(matchDeezerArtwork({data:[{id:1,name:"Artist",picture_medium:portrait}]},"artist","Artist - Topic"),{coverUrl:portrait});
 assert.deepEqual(matchDeezerArtwork({data:[{id:1,name:"Artist",picture_medium:portrait},{id:2,name:"Artist",picture_medium:portrait}]},"artist","Artist"),{});
 assert.equal(deezerImage(cover.replace("e-cdns-images.dzcdn.net","127.0.0.1"),"recording"),undefined);
 assert.equal(deezerImage(cover+"?token=x","recording"),undefined);
 assert.equal(deezerImage(portrait,"recording"),undefined);
});
test("catalog requests coalesce and fail without caching a provider outage",async()=>{
 let now=1000,calls=0;
 const fetchImpl=async(url,options)=>{calls++;assert.equal(new URL(url).origin,"https://api.deezer.com");
  assert.equal(new URL(url).searchParams.get("q"),"B.A. Robertson Bang Bang","Deezer recording queries use plain text; advanced artist/track filters can return no rows");
  assert.equal(options.credentials,"omit");assert.equal(options.redirect,"error");return calls===1?{ok:false,status:429}:response({data:[track]});};
 const lookup=createDeezerArtwork({fetchImpl,now:()=>now});
 assert.deepEqual(await lookup("recording","Bang Bang","B.A. Robertson"),{});
 assert.deepEqual(await lookup("recording","Bang Bang","B.A. Robertson"),{});
 assert.equal(calls,1);now+=60000;
 const values=await Promise.all([lookup("recording","Bang Bang","B.A. Robertson"),lookup("recording","Bang Bang","B.A. Robertson")]);
 assert.equal(values[0].coverUrl,cover);assert.deepEqual(values[0],values[1]);assert.equal(calls,2);
 await lookup("recording","Bang Bang","B.A. Robertson");assert.equal(calls,2);
});
test("Fanart uses an owned key and the exact MusicBrainz release group",async()=>{
 const raw="http://assets.fanart.tv/fanart/music/"+id+"/albumcover/song.jpg";
 const body={albums:[{release_group_id:id,albumcover:[{url:raw,likes:"8"}]}]};
 const preview=raw.replace("http:","https:")+"/preview";
 assert.equal(fanartImage(raw,"albumcover"),preview);
 assert.equal(fanartImage(raw.replace("assets.fanart.tv","evil.test"),"albumcover"),undefined);
 assert.equal(fanartImage(raw.replace("song.jpg","%2e%2e.jpg"),"albumcover"),undefined);
 assert.deepEqual(matchFanartArtwork(body,"album",id),{coverUrl:preview});
 assert.deepEqual(matchFanartArtwork(body,"album","22345678-1234-1234-1234-123456789abc"),{});
 assert.equal(createFanartArtwork({}),undefined);
 const lookup=createFanartArtwork({apiKey:"test-key-not-a-real-secret",fetchImpl:async(url,options)=>{assert.equal(new URL(url).origin,"https://webservice.fanart.tv");assert.equal(options.headers["api-key"],"test-key-not-a-real-secret");assert.equal(new URL(url).search,"");return response(body);}});
 assert.deepEqual(await lookup("album",id),{coverUrl:preview});
});
test("Discover routes new providers through opt-in and preserves original catalog fallbacks",async()=>{
 const {registerDiscoverIpc}=require("../../electron/ipc/discover.cjs");
 const handlers=new Map(),settings={discoverEnabled:false};let calls=0;
 registerDiscoverIpc({handle:(name,handler)=>handlers.set(name,handler)},{getSongs:()=>[],getSettings:()=>settings,searchYouTubeArtwork:async()=>[],lookupDeezer:async(kind)=>{calls++;return {coverUrl:kind==="artist"?portrait:cover};}});
 const get=(artwork)=>handlers.get("discover:get")({}, {artwork});
 assert.equal((await get({title:"Artist",artist:"",kind:"artist"})).status,"off");assert.equal(calls,0);
 settings.discoverEnabled=true;
 assert.equal((await get({title:"Artist",artist:"",kind:"artist"})).coverUrl,portrait);
 assert.equal((await get({title:"Bang Bang",artist:"B.A. Robertson"})).coverUrl,cover);assert.equal(calls,2);
});


test("fallback artwork still consults verified MusicBrainz after a catalog image fails",async()=>{
 const {createArtworkLookup}=require("../../electron/discover/artwork.cjs");
 const mbCover="https://coverartarchive.org/release/"+id+"/front-250";
 const mb={searchRecordings:async()=>[{id,title:"Bang Bang","artist-credit":[{name:"B.A. Robertson"}],releases:[{id,status:"Official","release-group":{id}}]}]};
 const lookup=createArtworkLookup(mb,Date.now,undefined,undefined,undefined,async()=>({coverUrl:cover}));
 assert.equal((await lookup("Bang Bang","B.A. Robertson")).coverUrl,cover);
 const fallback=await lookup("Bang Bang","B.A. Robertson",{fallback:true});
 assert.equal(fallback.coverUrl,mbCover);assert.ok(!fallback.coverAlternatives.includes(cover),"do not offer a previously failed Deezer image again");
});

test("an upstream 403 has a five-minute cooldown without caching an empty cover", async () => {
 let time=1000,requests=0;
 const lookup=createDeezerArtwork({now:()=>time,fetchImpl:async()=>{
   requests++;
   return requests===1?{ok:false,status:403}:{ok:true,text:async()=>JSON.stringify({data:[track]})};
 }});
 assert.deepEqual(await lookup("recording","Bang Bang","B.A. Robertson"),{});
 time+=16000;
 assert.deepEqual(await lookup("recording","Bang Bang","B.A. Robertson"),{});
 assert.equal(requests,1,"do not retry a blocked provider every 15 seconds");
 time+=284001;
 assert.equal((await lookup("recording","Bang Bang","B.A. Robertson")).coverUrl,cover);
 assert.equal(requests,2,"retry after cooldown, never permanently cache the error");
});

test("keyed artwork sources resolve before a blocked Deezer service",async()=>{
 const {createArtworkLookup}=require("../../electron/discover/artwork.cjs");
 let deezer=0,mb=0;
 const lookup=createArtworkLookup({searchRecordings:async()=>{mb++;return [];}},Date.now,
  async()=>({name:"Bang Bang",artist:{name:"B.A. Robertson"},album:{image:[{"#text":"https://lastfm.freetls.fastly.net/i/u/300x300/0123456789abcdef0123456789abcdef.jpg"}]}}),
  async()=>({coverUrl:portrait}),undefined,async()=>{deezer++;return {};});
 const result=await lookup("Bang Bang","B.A. Robertson");
 assert.equal(result.coverUrl,"https://lastfm.freetls.fastly.net/i/u/300x300/0123456789abcdef0123456789abcdef.jpg");
 assert.equal(deezer,0,"never hit optional Deezer while a verified image exists");
 assert.equal(mb,0);
});
test("fallback mode skips the failed Deezer image and reaches catalog releases",async()=>{
 const {createArtworkLookup}=require("../../electron/discover/artwork.cjs");
 let deezer=0;
 const mb={searchRecordings:async()=>[{id,title:"Bang Bang","artist-credit":[{name:"B.A. Robertson"}],releases:[{id,status:"Official","release-group":{id}}]}]};
 const lookup=createArtworkLookup(mb,Date.now,undefined,undefined,undefined,async()=>{deezer++;return {coverUrl:cover};});
 assert.equal((await lookup("Bang Bang","B.A. Robertson",{fallback:true})).coverUrl,
   "https://coverartarchive.org/release/"+id+"/front-250");
 assert.equal(deezer,0);
});
