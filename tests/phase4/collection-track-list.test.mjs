import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function fixture(count){
 const calls=[],options=[];
 const songs=Array.from({length:count},(_,i)=>({id:`track-${i}`,title:`Track ${i}`,artist:'Artist',album:'Album',duration:120,liked:i===0,fileExists:i!==1}));
 const output=ts.transpileModule(fs.readFileSync('src/features/pages/TrackList.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const dependencies={
  react:{...require('react'),useCallback:callback=>callback},
  '../../shared/hooks/usePageVirtualizer':{usePageVirtualizer:o=>{options.push(o);return {listRef:()=>{},scrollMargin:24,virtualizer:{getTotalSize:()=>count*64,getVirtualItems:()=>[0,Math.floor(count/2),count-1].map(index=>({key:songs[index].id,index,start:24+index*64})),measureElement:()=>{}}}}},
  '../covers/Cover':{Cover:()=>null},
  '../../shared/ui/LikeHeartAnimation':{LikeHeartAnimationV443:()=>null},
  '../../shared/ui/LocaltifyViewUi':{PlayingBarsIcon:()=>null},
  '../../shared/utils/format':{formatTime:()=> '2:00'},
  '../search/search.utils':{prettyTitle:String,prettyMeta:String},
  '../artists/artistCredits':{splitArtistCredits:()=>['Artist']},
  '../shell/appActions':{useAppActions:()=>({nav:{openArtistPage:name=>calls.push(['artist',name]),openAlbumPage:id=>calls.push(['album',id])},openSongMenu:(e,song)=>calls.push(['menu',song.id])})}
 };
 const exports={};runInNewContext(output,{exports,require:n=>dependencies[n]??require(n)});
 const tree=exports.default({songs,currentId:'track-0',isPlaying:true,albumIdOf:()=> 'album-1',playFrom:id=>calls.push(['play',id]),toggleLike:id=>calls.push(['like',id]),openPlaylistPicker:song=>calls.push(['playlist',song.id])});
 const flatten=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(flatten)];
 return {songs,calls,options,nodes:flatten(tree)};
}
test('short collections keep all rows, missing files cannot play, and actions keep their targets',()=>{
 const {nodes,calls,options}=fixture(4);
 assert.equal(options[0].count,0);
 const rows=nodes.filter(n=>n.props?.role==='listitem');assert.equal(rows.length,4);
 rows[1].props.onClick();assert.equal(calls.length,0);
 rows[2].props.onClick();assert.deepEqual(calls.pop(),['play','track-2']);
 rows[2].props.onContextMenu({});assert.deepEqual(calls.pop(),['menu','track-2']);
 const event={stopPropagation(){}};
 nodes.find(n=>n.props?.['aria-label']==='unlike song').props.onClick(event);assert.deepEqual(calls.pop(),['like','track-0']);
 nodes.find(n=>n.props?.['aria-label']==='add to playlist').props.onClick(event);assert.deepEqual(calls.pop(),['playlist','track-0']);
 const artist=nodes.find(n=>n.props?.className==='trackLink'&&n.props.children==='Artist');artist.props.onClick(event);assert.deepEqual(calls.pop(),['artist','Artist']);
 const album=nodes.find(n=>n.props?.className==='trackLink'&&n.props.children==='Album');album.props.onClick(event);assert.deepEqual(calls.pop(),['album','album-1']);
});
test('large collections render the virtual window with original positions, identities and playback targets',()=>{
 const {nodes,calls,options}=fixture(10000);assert.equal(options[0].count,10000);assert.equal(options[0].getItemKey(9999),'track-9999');
 const rows=nodes.filter(n=>n.props?.role==='listitem');assert.equal(rows.length,3);
 assert.equal(rows[2].props['aria-posinset'],10000);assert.equal(rows[2].props['aria-setsize'],10000);
 rows[2].props.onClick();assert.deepEqual(calls.pop(),['play','track-9999']);
 const slots=nodes.filter(n=>n.props?.className==='trackVirtualRow');assert.equal(slots[2].props.style.top,9999*64);
});

function mixState(state) {
 const output=ts.transpileModule(fs.readFileSync('src/features/pages/MixPage.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const loading=({label})=>React.createElement('div',{role:'status'},label);
 const card=({title,message,actions})=>React.createElement('div',null,React.createElement('h1',null,title),React.createElement('p',null,message),actions);
 const dependencies={
  './pages.css':{},
  '../../shared/ui/CollectionLoading':{CollectionLoading:loading},
  '../../shared/ui/LocaltifyViewUi':{LocaltifyStateCard:card},
  '../../shared/utils/format':{},
  '../search/search.utils':{},
  '../playlists/components/PlaylistCoverCollage':{},
  '../home/useHomeDailyMixes':{useHomeDailyMixes:()=>state},
  '../player/playbackSource':{buildAlbumIdBySongId:()=>new Map()},
  '../shell/appActions':{useAppActions:()=>({nav:{go(){}}})},
  '../covers/ArtworkBackdrop':{ArtworkBackdrop:()=>null},
  './CollectionHero':{}, './TrackList':{}
 };
 const exports={};runInNewContext(output,{exports,require:n=>dependencies[n]??require(n)});
 return renderToStaticMarkup(React.createElement(exports.default,{mixId:'mix',songs:[],albums:[]}));
}
test('pending, failed and refreshed mixes expose distinct states and recovery',()=>{
 const pending=mixState({result:null,failed:false});assert.match(pending,/aria-busy="true"/);assert.match(pending,/Loading your mix/);assert.doesNotMatch(pending,/refreshed|see today/);
 const failed=mixState({result:null,failed:true});assert.match(failed,/Could not load this mix/);assert.match(failed,/see today/);assert.doesNotMatch(failed,/has been refreshed/);
 const expired=mixState({result:{mixes:[]},failed:false});assert.match(expired,/This mix has been refreshed/);assert.match(expired,/see today/);
});

test('collection controls use the same size tokens as their grid columns',()=>{
 const css=fs.readFileSync('src/features/pages/pages.css','utf8');
 for(const line of css.split('\n').filter(line=>line.includes('--track-columns:'))) {
   assert.doesNotMatch(line,/\b42px\b/);
   assert.match(line,/var\(--lt-control-height\)/);
 }
});
test('decorative artwork uses low-resolution source without changing eager loading',()=>{
 const source=fs.readFileSync('src/features/covers/Cover.tsx','utf8');
 const backdrop=fs.readFileSync('src/features/covers/ArtworkBackdrop.tsx','utf8');
 assert.match(source,/const useFullCover = isImmediateCover && !preferThumbnail/);
 assert.match(source,/const directCover = useFullCover \? getFullCoverUrl\(song\) : getCardCoverUrl\(song\)/);
 assert.match(backdrop,/priority="high" preferThumbnail/);
 assert.match(source,/preferThumbnail \? getFullCoverUrl\(song\) : ""/);
});
