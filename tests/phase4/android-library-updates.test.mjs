import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function library() {
  const writes = [];
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync("src/platform/android/library.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  runInNewContext(output, { exports, structuredClone,
    require: (name) => {
      if (name === "./native") return { LocaltifyNative: {} };
      if (name === "./store") return { writeValues: async (values) => { writes.push(values); } };
      throw new Error(`Unexpected dependency ${name}`);
    }
  });
  return { phone: new exports.PhoneLibrary(), writes };
}

test("patching one Android song reads only its cached file record, even in a large library", () => {
  const { phone, writes } = library();
  phone.paths.files = "/phone";
  phone.remoteSongs = Array.from({ length: 10000 }, (_, i) => ({ id: String(i), title: `Song ${i}`, liked: false, file: { size: 12, mtimeMs: 1, ext: "mp3" }, cover: null }));
  let fileReads = 0;
  phone.files = new Proxy({ "9999": { audio: "12-1", audioExt: "mp3", cover: "cover-v1", coverExt: "jpg" } }, {
    get(target, key) { fileReads += 1; return target[key]; }
  });
  const updated = phone.patchSong("9999", { liked: true });
  assert.equal(fileReads, 1);
  assert.equal(updated.id, "9999");
  assert.equal(updated.liked, true);
  assert.equal(updated.fileExists, true);
  assert.equal(updated.filePath, "/phone/library/9999.mp3");
  assert.equal(updated.coverUrl, "https://localhost/_localtify_media_/covers/9999.jpg?v=cover-v1");
  assert.equal(updated.fileSizeBytes, 12);
  assert.equal(writes.length, 1);
  assert.ok(writes[0].likeClock["9999"] > 0);
  assert.equal(JSON.stringify(updated), JSON.stringify(phone.songs().at(-1)));
});

test("an unknown Android song update has no persistence or revision side effects", () => {
  const { phone, writes } = library();
  assert.equal(phone.patchSong("missing", { liked: true }), null);
  assert.equal(phone.revision, 0);
  assert.equal(writes.length, 0);
});
