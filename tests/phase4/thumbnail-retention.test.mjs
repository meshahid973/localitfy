import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { pruneThumbnails } = createRequire(import.meta.url)("../../electron/runtime/thumbnail-retention.cjs");
test("thumbnail retention evicts only derived files and leaves user artwork intact", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),"localtify-thumbnail-"));
  try {
    const old=path.join(dir,"a".repeat(40)+".png"), recent=path.join(dir,"b".repeat(40)+".png"), permanent=path.join(dir,"user-cover.png");
    await fs.writeFile(old,"1234"); await fs.writeFile(recent,"5678"); await fs.writeFile(permanent,"original");
    await fs.utimes(old,100,100);
    const result=await pruneThumbnails(dir,{maxBytes:4,maxFiles:1});
    assert.equal(result.removed,1);
    assert.deepEqual(new Set(await fs.readdir(dir)),new Set([path.basename(recent),path.basename(permanent)]));
    assert.equal(await fs.readFile(permanent,"utf8"),"original");
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
