import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=(path)=>fs.readFileSync(path,"utf8");

test("Rust remains optional and all three integrations preserve JS fallback code",()=>{
 const backend=read("electron/native/backend.cjs");
 const sim=read("electron/analysis/similarity.cjs");
 const mix=read("electron/analysis/daily-mixes.cjs");
 const dup=read("electron/library-duplicates.cjs");
 const scan=read("electron/library-watch.cjs");
 assert.match(backend,/LOCALTIFY_RUST_PHASES/);
 assert.match(backend,/if \(!enabled\(phase\)\) return null/);
 assert.match(sim,/nativeAudio \? nativeAudio\[index \* seedProfiles\.length \+ seedIndex\] : dot/);
 assert.match(mix,/nativeScores \? nativeScores\[index \* centers\.length \+ centerIndex\] : dot/);
 assert.match(dup,/audioOverride === undefined \? cosine\(va, vb\) : audioOverride/);
 assert.match(scan,/if \(nativeFiles !== null\) return nativeFiles/);
 assert.match(scan,/const files = \[\]/);
});

test("Rust native extension is excluded from Git but included in packaged Electron app",()=>{
 const pkg=JSON.parse(read("package.json"));
 assert.ok(pkg.build.asarUnpack.includes("electron/native/*.node"));
 assert.ok(pkg.build.files.includes("electron/**/*"));
 assert.match(read(".gitignore"),/electron\/native\/\*\.node/);
});
