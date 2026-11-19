import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const backdrop=fs.readFileSync("src/features/covers/ArtworkBackdrop.tsx","utf8");
const raster=fs.readFileSync("src/features/covers/backdropRaster.ts","utf8");
const css=fs.readFileSync("src/features/covers/artwork-backdrop.css","utf8");
test("ambient backdrop retains its outgoing frame during preparation",()=>{
 assert.match(backdrop,/await prepareBackdropArtwork\(candidate, controller.signal\)/);
 assert.match(backdrop,/data-hold=\{src === frame.previous && Boolean\(frame.current\)\}/);
 assert.match(css,/data-hold="true"\] \{ opacity: 1; \}/);
});
test("ambient raster is bounded and skips full-screen filter",()=>{
 assert.match(raster,/BACKDROP_SIZE = 32/);
 assert.match(raster,/BACKDROP_CACHE_LIMIT = 32/);
 assert.match(css,/data-raster="true"[\s\S]*?filter: none;/);
 assert.match(css,/prefers-reduced-motion: reduce/);
});
