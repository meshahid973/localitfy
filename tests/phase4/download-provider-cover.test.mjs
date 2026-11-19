import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const { safeProviderCover, imageExtension } = createRequire(import.meta.url)("../../electron/runtime/remote-cover.cjs");
test("download artwork accepts known image paths only",()=>{
  assert.equal(safeProviderCover("https://lh3.googleusercontent.com/abc=w512-h512"),"https://lh3.googleusercontent.com/abc=w256-h256-l90-rj");
  assert.equal(safeProviderCover("https://i.scdn.co/image/abc123"),"https://i.scdn.co/image/abc123");
  for(const url of ["https://127.0.0.1/private","https://i.scdn.co.evil.test/image/a","https://i.scdn.co@evil.test/image/a","https://i.scdn.co/image/a?token=x","https://i.scdn.co/anything"])assert.equal(safeProviderCover(url),"");
});
test("download artwork requires an image signature matching its type",()=>{
  const jpeg=Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9","hex");
  assert.equal(imageExtension(jpeg,"image/jpeg"),".jpg");
  assert.equal(imageExtension(jpeg,"image/png"),"");
  assert.equal(imageExtension(Buffer.from("<html>not an image</html>"),"image/jpeg"),"");
});
