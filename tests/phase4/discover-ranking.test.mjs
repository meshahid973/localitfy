import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {rankCatalog,appleItems,searchTerms,createStoreSearch}=require("../../electron/discover/catalog.cjs");
test("title matches beat artist-only noise and popularity breaks ties",()=>{
  const correct={id:"a",title:"KICK BACK",artist:"Kenshi Yonezu",album:"KICK BACK",storeRank:1,listeners:1200000};
  const result=rankCatalog("kick back",[{id:"b",title:"Come On",artist:"Kick Back"},{id:"c",title:"Kick Back",artist:"Other"}],[correct]);
  assert.equal(result[0].artist,"Kenshi Yonezu");
  assert.ok(!result.some(x=>x.title==="Come On"));
  assert.equal(rankCatalog("kick back chainsaw man opening",[],[correct])[0].artist,"Kenshi Yonezu");
  assert.deepEqual(searchTerms("kick back chainsaw man opening"),["kick back chainsaw man opening","kick back"]);
});
test("store metadata omits promotional artwork and rejects unsafe URLs",()=>{
  const item={trackId:42,trackName:"Song",artistName:"Artist",trackViewUrl:"https://music.apple.com/us/album/song/42",artworkUrl100:"https://example.com/cover.jpg"};
  const result=appleItems({results:[item,{...item,trackViewUrl:"https://other.example/"}]});
  assert.equal(result.length,1);assert.equal(result[0].coverUrl,undefined);
});

test("recording search does not return unrelated artist-only titles when a title matches", () => {
  assert.deepEqual(rankCatalog("kick back", [{id:"1",title:"Unrelated",artist:"Kick Back City"},{id:"2",title:"KICK BACK",artist:"Kenshi Yonezu"}]).map(x=>x.id),["2"]);
});

test("catalog keeps conflicting recording lengths separate and coalesces matching store searches",async()=>{
  const originals=[{id:"a",title:"Song",artist:"Artist",durationMs:120000,coverUrl:"https://example.test/short"},{id:"b",title:"Song",artist:"Artist",durationMs:240000,coverUrl:"https://example.test/long"}];
  const ranked=rankCatalog("song",originals);
  assert.equal(ranked.length,2);
  assert.deepEqual(ranked.map(x=>x.coverUrl).sort(),originals.map(x=>x.coverUrl).sort());
  let calls=0,resolve;
  const search=createStoreSearch(async()=>{calls++;await new Promise(r=>{resolve=r;});return new Response(JSON.stringify({results:[]}),{status:200});});
  const first=search("Song"),second=search("song");
  assert.equal(calls,1);resolve();
  assert.deepEqual(await first,[]);assert.deepEqual(await second,[]);
  await search("SONG");assert.equal(calls,1);
});
