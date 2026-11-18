import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {rankCatalog,appleItems,searchTerms}=require("../../electron/discover/catalog.cjs");
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
