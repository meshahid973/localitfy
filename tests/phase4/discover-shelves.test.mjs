import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
const source=fs.readFileSync("src/features/discover/discoverShelves.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {buildDiscoverShelves}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const track=(artist,title)=>({artist,title,url:""});
test("Discover interleaves artists and removes exact duplicates across shelves",()=>{
 const a=track("A","One"),b=track("B","Two"),c=track("A","Three"),d=track("B","Four");
 const result=buildDiscoverShelves([{topTracks:[a,c]},{topTracks:[b,d]}],[track("a"," ONE "),track("B","Two (Remix)"),track("C","Five"),track("B","Six")]);
 assert.deepEqual(result.recommended,[a,b,c,d]);
 assert.deepEqual(result.popular.map(t=>t.title),["Two (Remix)","Five","Six"]);
 assert.deepEqual(buildDiscoverShelves([],[]),{recommended:[],popular:[]});
});
