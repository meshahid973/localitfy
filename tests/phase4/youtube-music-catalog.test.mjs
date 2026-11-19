import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {createYouTubeMusicSearch,createYouTubeMusicRadio,mapSearchResponse,mapRadioResponse,safeThumbnail,isJunkVideo,exactMusicCandidate}=require("../../electron/discover/youtube-music.cjs");
const col=runs=>({musicResponsiveListItemFlexColumnRenderer:{text:{runs}}});
const linked=(text,pageType,browseId)=>({text,navigationEndpoint:{browseEndpoint:{browseId,browseEndpointContextSupportedConfigs:{browseEndpointContextMusicConfig:{pageType}}}}});
const row=(title,id="abcdefghijk")=>({musicResponsiveListItemRenderer:{playlistItemData:{videoId:id},flexColumns:[col([{text:title}]),col([linked("Kenshi Yonezu","MUSIC_PAGE_TYPE_ARTIST","UCabcdefghijklmnopqrstuv"),{text:" • "},linked("KICK BACK","MUSIC_PAGE_TYPE_ALBUM","MPREalbum"),{text:" • "},{text:"3:13"}])],thumbnail:{musicThumbnailRenderer:{thumbnail:{thumbnails:[{url:"https://lh3.googleusercontent.com/abc=w512-h512-l90-rj",width:512,height:512}]}}}}});
const response=items=>({contents:{tabbedSearchResultsRenderer:{tabs:[{tabRenderer:{content:{sectionListRenderer:{contents:[{musicShelfRenderer:{contents:items}}]}}}}]}}});
test("YouTube Music maps structured recordings, square covers and duration, filtering unrelated videos",()=>{
 const items=mapSearchResponse(response([row("KICK BACK"),row("KICK BACK reaction","abcdefghij2"),row("KICK BACK"),row("other","abcdefghij3")]),"recording","kick back");
 assert.equal(items.length,1);assert.equal(items[0].artist,"Kenshi Yonezu");assert.equal(items[0].durationMs,193000);
 assert.equal(items[0].coverUrl,"https://lh3.googleusercontent.com/abc=w256-h256-l90-rj");
 assert.equal(items[0].url,"https://www.youtube.com/watch?v=abcdefghijk");
 assert.equal(isJunkVideo("KICK BACK slowed","kick back slowed"),false);
});
test("artwork accepts only validated direct image hosts",()=>{
 for(const url of ["http://lh3.googleusercontent.com/a","https://lh3.googleusercontent.com.evil.test/a","https://user@lh3.googleusercontent.com/a","https://lh3.googleusercontent.com/a?secret=x","https://i.ytimg.com/vi/invalid/hqdefault.jpg"])assert.equal(safeThumbnail(url),undefined);
 assert.equal(safeThumbnail("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg"),"https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
});
test("catalog requests coalesce, cache and send no account credentials",async()=>{
 let calls=0;
 const search=createYouTubeMusicSearch(async(url,options)=>{calls++;assert.equal(new URL(url).hostname,"music.youtube.com");assert.equal(options.credentials,"omit");assert.equal(options.redirect,"error"); assert.equal(options.headers.authorization,undefined);return {ok:true,text:async()=>JSON.stringify(response([row("KICK BACK")]))};});
 const [a,b]=await Promise.all([search("recording","KICK BACK"),search("recording","kick back")]);assert.deepEqual(a,b);assert.equal(a.length,1);await search("recording","kick back");assert.equal(calls,1);
});
test("catalog failure is not cached",async()=>{
 let calls=0;const search=createYouTubeMusicSearch(async()=>++calls===1?{ok:false}:{ok:true,text:async()=>JSON.stringify(response([row("KICK BACK")]))});
 await assert.rejects(search("recording","kick back"));assert.equal((await search("recording","kick back")).length,1);
});


test("automatic download matching requires exact metadata, duration and an unambiguous video ID",()=>{
 const wanted={title:"KICK BACK",artist:"Kenshi Yonezu",durationMs:193000};
 const correct={...wanted,url:"https://www.youtube.com/watch?v=abcdefghijk",durationMs:194000};
 assert.equal(exactMusicCandidate(wanted,[correct]),correct);
 assert.equal(exactMusicCandidate(wanted,[{...correct,title:"KICK BACK (live)"}]),null);
 assert.equal(exactMusicCandidate(wanted,[{...correct,durationMs:205000}]),null);
 assert.equal(exactMusicCandidate(wanted,[{...correct,artist:"Someone else"}]),null);
 assert.equal(exactMusicCandidate(wanted,[correct,{...correct,url:"https://www.youtube.com/watch?v=abcdefghij2"}]),null);
 assert.equal(exactMusicCandidate(wanted,[{...correct,url:"https://evil.test/watch?v=abcdefghijk"}]),null);
 assert.equal(exactMusicCandidate({...wanted,durationMs:0},[correct]),null);
});


test("radio maps a bounded related-song queue and omits the selected seed",async()=>{
  const track=(videoId,title)=>({playlistPanelVideoRenderer:{videoId,title:{runs:[{text:title}]},longBylineText:{runs:[{text:"Artist"}]},lengthText:{runs:[{text:"3:30"}]}}});
  const body={contents:{singleColumnMusicWatchNextResultsRenderer:{tabbedRenderer:{watchNextTabbedResultsRenderer:{tabs:[{tabRenderer:{content:{musicQueueRenderer:{content:{playlistPanelRenderer:{contents:[track("abcdefghijk","Seed"),track("abcdefghij2","Related"),track("abcdefghij2","Duplicate"),track("abcdefghij3","Guitar lesson")]}}}}}}]}}}}};
  const items=mapRadioResponse(body,"abcdefghijk");
  assert.equal(items.length,1);assert.equal(items[0].title,"Related");assert.equal(items[0].durationMs,210000);
  let count=0;
  const radio=createYouTubeMusicRadio(async(url,options)=>{count++;assert.match(url,/\/next\?/);const payload=JSON.parse(options.body);assert.equal(payload.videoId,"abcdefghijk");assert.equal(payload.playlistId,"RDAMVMabcdefghijk");assert.equal(payload.query,undefined);return {ok:true,text:async()=>JSON.stringify(body)};});
  const [a,b]=await Promise.all([radio("abcdefghijk"),radio("abcdefghijk")]);assert.deepEqual(a,b);assert.equal(count,1);
  await assert.rejects(radio("bad-seed"),/Invalid radio seed/);
});


test("top result cards and video uploads are mapped for artwork lookups",()=>{
 const thumbnail={musicThumbnailRenderer:{thumbnail:{thumbnails:[{url:"https://lh3.googleusercontent.com/abc=w512-h512",width:512,height:512}]}}};
 const card={title:{runs:[{text:"Indie Song (slowed)"}]},subtitle:{runs:[{text:"Video"},{text:" • "},{text:"Indie Artist"},{text:" • "},{text:"3:12"}]},onTap:{watchEndpoint:{videoId:"abcdefghijk"}},thumbnail};
 const build=card=>({contents:{tabbedSearchResultsRenderer:{tabs:[{tabRenderer:{content:{sectionListRenderer:{contents:[{musicCardShelfRenderer:card}]}}}}]}}});
 const tracks=mapSearchResponse(build(card),"video","Indie Song slowed Indie Artist",false);
 assert.equal(tracks.length,1);assert.equal(tracks[0].artist,"Indie Artist");assert.equal(tracks[0].durationMs,192000);assert.match(tracks[0].coverUrl,/googleusercontent/);
 const artistCard={title:{runs:[{text:"Indie Artist"}]},onTap:linked("Indie Artist","MUSIC_PAGE_TYPE_ARTIST","UCabcdefghijklmnopqrstuv").navigationEndpoint,thumbnail};
 assert.equal(mapSearchResponse(build(artistCard),"artist","Indie Artist",false)[0].id,"ytmusic:UCabcdefghijklmnopqrstuv");
});
