import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const source = fs.readFileSync("src/features/search/search.utils.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const exports = {};
runInNewContext(compiled, {
  exports,
  require(name) {
    if (name === "../../shared/storage/localStorage") return { makeLocalId: () => "id" };
    if (name === "../../shared/utils/format") return {
      collapseSpaces: (value) => String(value || "").replace(/\s+/g, " ").trim(),
      lower: (value) => String(value || "").toLowerCase(),
      normalizeUiText: (value) => String(value || ""),
      safeNumber: (value) => Number(value) || 0
    };
    throw new Error("Unexpected import: " + name);
  }
});

test("search index caches unchanged Song objects, not different copies", () => {
  const song = {
    id: "one", title: "Miku - Midnight", artist: "Artist",
    album: "Album", filePath: "/audio/miku.flac", liked: false, playCount: 1
  };
  const first = exports.buildSongSearchEntryCached(song);
  assert.equal(exports.buildSongSearchEntryCached(song), first);
  assert.equal(first.song, song);
  const edited = { ...song, liked: true };
  const next = exports.buildSongSearchEntryCached(edited);
  assert.notEqual(next, first);
  assert.equal(next.song, edited);
  assert.ok(next.haystack.includes("liked"));
  assert.equal(exports.buildSongSearchEntryCached(edited), next);
});

test("search ranking filters misses without changing stable order", () => {
  const entries = [
    { id: "1", title: "miku mix", artist: "a", album: "x", filePath: "/miku.mp3", playCount: 1 },
    { id: "2", title: "unrelated", artist: "b", album: "y", filePath: "/other.mp3", playCount: 0 },
    { id: "3", title: "miku mix", artist: "a", album: "x", filePath: "/miku-2.mp3", playCount: 1 }
  ].map((song) => exports.buildSongSearchEntryCached(song));
  assert.deepEqual(Array.from(exports.rankSongsForSearch(entries, "miku"), (song) => song.id), ["1", "3"]);
});

test("search token substring fallback retains partial-word matches", () => {
  const entries = [
    { id: "first", title: "Morning", artist: "Miku", album: "Songs", filePath: "/music/morning.mp3", playCount: 0 },
    { id: "second", title: "Evening", artist: "Rin", album: "Songs", filePath: "/music/evening.mp3", playCount: 0 }
  ].map(song => exports.buildSongSearchEntryCached(song));
  assert.deepEqual(Array.from(exports.rankSongsForSearch(entries, "orn"), song => song.id), ["first"]);
});



test("playback updates reuse normalized text while ranking the latest song state", () => {
  const song = { id: "progress", title: "night mix", artist: "A", album: "B", filePath: "/night.flac", playCount: 0 };
  const first = exports.buildSongSearchEntryCached(song);
  const updated = { ...song, playCount: 60, playbackPosition: 45, genre: "Jazz" };
  const next = exports.buildSongSearchEntryCached(updated, first);
  assert.equal(next.tokens, first.tokens);
  assert.equal(next.song, updated);
  assert.equal(first.song, song);
  assert.equal(exports.buildSongSearchEntryCached(updated), next);
  const rival = exports.buildSongSearchEntryCached({ ...song, id: "rival", playCount: 20 });
  assert.deepEqual(Array.from(exports.rankSongsForSearch([rival, next], "night"), item => item.id), ["progress", "rival"]);
});

test("every searchable metadata field invalidates reused normalized text", () => {
  const song = { id: "metadata", title: "Night", artist: "Artist", album: "Album", filePath: "", url: "/night.flac", liked: false };
  const first = exports.buildSongSearchEntryCached(song);
  for (const patch of [{ title: "Day" }, { artist: "Other" }, { album: "New" }, { filePath: "/new.flac" }, { url: "/other.flac" }, { liked: true }]) {
    const updated = { ...song, ...patch };
    const next = exports.buildSongSearchEntryCached(updated, first);
    assert.notEqual(next.tokens, first.tokens);
    assert.deepEqual(next, exports.buildSongSearchEntry(updated));
  }
  assert.equal(first.song, song);
  assert.equal(first.haystack.includes("liked"), false);
});

test("selective search prefilter agrees with complete ranking for multilingual, partial and multi-term queries", () => {
  const songs = Array.from({length: 800}, (_, i) => ({
    id: String(i), title: ["Míkú Midnight (Official Audio)", "夜明け", "Daydream", "Café mix", "Álbum remix"][i%5]+ " "+i,
    artist: ["Rin", "Hatsune Miku", "Élan", "A-B", "アーティスト"][i%5],
    album: "Album "+i%13, filePath: "/Music/Disc-"+i%9+"/track_"+i+".flac", liked: i%7===0, playCount:i%61
  }));
  const entries = songs.map(exports.buildSongSearchEntry);
  for (const query of ["miku", "mor", "mid", "cafe", "night 1", "liked album", "a-b", "夜明け", "flac", "disc 2", "unknown", "official audio", "rin 1 2", ""]) {
    const prepared = exports.prepareSearchQuery(query);
    const expected = !prepared.clean ? songs : entries.map((entry,index)=>({entry,index,score:exports.scoreSongSearch(entry,prepared)}))
      .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.entry.song);
    assert.deepEqual(Array.from(exports.rankSongsForSearch(entries,query),song=>song.id),expected.map(song=>song.id));
  }
});
test("metadata preview keeps original repair semantics without allocating unchanged rows", () => {
  const previewSource=fs.readFileSync("src/features/library/metadataCleanPreview.ts","utf8");
  const compiled=ts.transpileModule(previewSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const previewExports={};
  runInNewContext(compiled,{exports:previewExports,require(name){if(name==="../search")return exports;throw Error(name);}});
  const songs=[{id:"a",title:"Artist - Track (official audio)",artist:"unknown artist",album:"unknown album",filePath:"/Artist - Track.mp3"},
    {id:"b",title:"clean title",artist:"artist",album:"album",filePath:"/clean title.flac"},
    {id:"c",title:"Night (copy)",artist:"Élan",album:"HQ",filePath:"/Night.flac"}];
  for(const [ids,scope] of [[[],"all"],[["a"],"selected"],[[],"selected"],[["nonexistent"],"selected"]]){
    const targets=scope==="selected"&&ids.length?songs.filter(s=>ids.includes(s.id)):songs;
    const expected=targets.flatMap(song=>{
      const repair=exports.getMetadataRepairPatch(song),patch={};
      for(const field of ["title","artist","album"])if(typeof repair[field]==="string"&&repair[field]!==song[field])patch[field]=repair[field];
      return Object.keys(patch).length?[{id:song.id,patch}]:[];
    });
    const result=previewExports.createMetadataCleanPreview(songs,ids,scope);
    assert.equal(result.totalCount,targets.length);
    assert.equal(result.changedCount,expected.length);
    assert.deepEqual(JSON.parse(JSON.stringify(result.items.map(({id,patch})=>({id,patch})))),expected);
    for(const field of ["title","artist","album"])assert.equal(result[field+"FixCount"],expected.filter(x=>Object.hasOwn(x.patch,field)).length);
  }
});


test("library normalization retains Japanese tags and backend artwork identities", () => {
  const raw={id:"jp",title:"夜に駆ける",artist:"ヨアソビ",album:"群青",filePath:"/music/夜に駆ける.flac",coverThumbUrl:"localtify-media://thumb",coverFullUrl:"localtify-media://full",sourceTrackId:"original",duration:200};
  const song=exports.sanitizeSongRecord(raw,0);
  assert.equal(song.title,raw.title);
  assert.equal(song.artist,raw.artist);
  assert.equal(song.album,raw.album);
  assert.equal(song.coverThumbUrl,raw.coverThumbUrl);
  assert.equal(song.coverFullUrl,raw.coverFullUrl);
  assert.equal(song.sourceTrackId,raw.sourceTrackId);
  assert.equal(exports.normalizeSearchText("ガ"),"ガ");
  assert.equal(exports.normalizeSearchText("Café"),"cafe");
  const other={...song,id:"other",title:"別の曲",artist:"別の歌手",album:"別のアルバム",filePath:"/other.flac"};
  const result=exports.rankSongsForSearch([song,other].map(exports.buildSongSearchEntry),"夜に");
  assert.deepEqual(Array.from(result,s=>s.id),["jp"]);
});
