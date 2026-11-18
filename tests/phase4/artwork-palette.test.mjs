import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../../src/features/covers/artworkPalette.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { extractArtworkPalette, PaletteCache, safeAtmosphere, contrastRatio, rgbHex, advanceArtworkFrame, mixArtworkPalette } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

test("palette detects distinct hues and ignores transparent pixels", () => {
  const data = new Uint8ClampedArray([...Array(100)].flatMap(() => [240, 20, 90, 255, 20, 180, 240, 255, 90, 20, 180, 255, 255, 255, 255, 0]));
  const result = extractArtworkPalette(data);
  assert.equal(new Set(result.map(rgbHex)).size, 3);
  assert.equal(extractArtworkPalette([255, 255, 255, 0]), null);
  assert.deepEqual(extractArtworkPalette([33, 33, 33, 255]), [[33,33,33],[33,33,33],[33,33,33]]);
});
test("palette cache is bounded and refreshes accessed entries", () => {
  const cache = new PaletteCache(2);
  cache.set("a", 1); cache.set("b", 2); cache.get("a"); cache.set("c", 3);
  assert.equal(cache.size, 2); assert.equal(cache.get("b"), undefined); assert.equal(cache.get("a"), 1);
  const large = new PaletteCache();
  for (let i=0;i<700;i++) large.set(String(i), i);
  assert.equal(large.size,512);
});
test("atmosphere preserves muted text contrast in both themes and selected surfaces", () => {
  const colors = [[255,0,100],[0,255,255],[255,255,255]];
  for (const light of [true,false]) {
    for (const strength of [0,.12,.32,.52]) {
      const result = safeAtmosphere(colors,light,strength);
      const base = light ? [245,245,247] : [0,0,0];
      const ink = light ? [85,85,95] : [181,181,189];
      const extreme = base.map((v,i) => light ? Math.min(v,...result.map(c=>c[i])) : Math.max(v,...result.map(c=>c[i])));
      const selected = extreme.map((v,i)=>Math.round(v*.86+(light?[24,24,27][i]:255)*.14));
      assert.ok(contrastRatio(ink,selected)>=4.5);
    }
  }
});

test("decoded frames retain only the current and preceding source; failures clear both", () => {
  let frame = {current:"",previous:""};
  for (const source of ["a","b","c","a","b"]) {
    const previous = frame.current;
    frame = advanceArtworkFrame(frame, source,true);
    assert.deepEqual(frame,{current:source,previous});
    assert.equal(advanceArtworkFrame(frame,source,true),frame);
  }
  assert.deepEqual(advanceArtworkFrame(frame,"broken",false),{current:"",previous:""});
});

test("mix artwork is deterministic, cover-derived and keeps white type readable", () => {
  const sample = [[255,200,100],[30,255,255],[255,0,180]];
  const colors = mixArtworkPalette([sample], "test");
  assert.deepEqual(colors,mixArtworkPalette([sample],"test"));
  assert.ok(colors.every(color => contrastRatio([255,255,255],color)>=4.5));
  assert.deepEqual(mixArtworkPalette([], "missing"),mixArtworkPalette([], "missing"));
  assert.notDeepEqual(mixArtworkPalette([], "missing"),mixArtworkPalette([], "another"));
});
