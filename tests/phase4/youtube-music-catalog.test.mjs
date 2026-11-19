import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {createYouTubeMusicSearch,mapSearchResponse,safeThumbnail,isJunkVideo}=require("../../electron/discover/youtube-music.cjs");
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
