import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {createAudioDbArtwork,albumImage}=require("../../electron/discover/audiodb.cjs");
test("AudioDB only uses album art linked to the exact song and artist",async()=>{
 const image="https://www.theaudiodb.com/images/media/album/thumb/abc123.jpg";
 let now=1000;
 const lookup=createAudioDbArtwork({apiKey:"123",now:()=>{now+=3000;return now;},fetchImpl:async url=>({ok:true,json:async()=>url.includes("searchtrack")?{track:[{strTrack:"Song",strArtist:"Artist",strAlbum:"Album",idAlbum:"42"}]}:{album:[{idAlbum:"42",strAlbum:"Album",strArtist:"Artist",strAlbumThumb:image}]}})});
 assert.equal((await lookup("song","artist")).coverUrl,image);
 assert.deepEqual(await lookup("other","artist"),{});
 assert.equal(albumImage("https://example.org/images/media/album/thumb/a.jpg"),"");
});
