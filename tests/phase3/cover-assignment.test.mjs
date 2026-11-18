import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createLeastUsedCoverAllocator, initCoverService, findFolderCover, copyCoverToAppStorage, resolveSongCover } = require(path.join(root, "electron", "cover-service.cjs"));

test("bulk cover assignment updates usage counts after each successful write", () => {
  const allocator = createLeastUsedCoverAllocator(["a", "b"], [], () => 0);
  const first = allocator.choose();
  assert.equal(first, "b");
  allocator.record("", first);
  assert.equal(allocator.choose(), "a");
  allocator.record("", "a");
  assert.equal(allocator.choose("a"), "b");
});

test("cover reassignment releases previous usage and avoids current artwork", () => {
  const allocator = createLeastUsedCoverAllocator(["a", "b"], [
    { coverPath: "a" }, { coverPath: "a" }, { coverPath: "b" }
  ], () => 0);
  assert.equal(allocator.choose("a"), "b");
  allocator.record("a", "b");
  assert.equal(allocator.choose("b"), "a");
  assert.equal(createLeastUsedCoverAllocator(["only"], []).choose("only"), "only");
});

test("duplicate cover assets are counted only once", () => {
  const allocator = createLeastUsedCoverAllocator(["a", "a", "b"], [{ coverPath: "b" }], () => 0);
  assert.equal(allocator.choose(), "a");
});

test("cover resolution prefers embedded art, avoids ambiguous images and shares cached copies", async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"localtify-cover-refinement-"));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  initCoverService({userDataPath:dir});
  const album=path.join(dir,"album");fs.mkdirSync(album);
  const a=path.join(album,"photo-a.jpg"), b=path.join(album,"photo-b.jpg");
  fs.writeFileSync(a,"image a");fs.writeFileSync(b,"image b");
  assert.equal(findFolderCover(album),"");
  const cover=path.join(album,"cover.jpg");fs.writeFileSync(cover,"cover");
  assert.equal(findFolderCover(album),cover);
  const one=copyCoverToAppStorage(cover,{source:"folder",songId:"one"}),two=copyCoverToAppStorage(cover,{source:"folder",songId:"two"});
  assert.ok(one);assert.equal(one,two);
  assert.equal((await resolveSongCover({folderCoverPath:cover,metadata:{embeddedCoverPath:a}})).coverPath,a);
  assert.equal((await resolveSongCover({folderCoverPath:cover,metadata:{embeddedCoverPath:a},preferFolderCover:true})).coverPath,one);
  assert.equal((await resolveSongCover({song:{coverPath:b,coverSource:"spotify"},folderCoverPath:path.join(album,"missing.jpg")})).coverPath,b);
});
