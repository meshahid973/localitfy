import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function library(options = {}) {
  const writes = [];
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync("src/platform/android/library.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  runInNewContext(output, { exports, structuredClone,
    require: (name) => {
      if (name === "./native") return { LocaltifyNative: {} };
      if (name === "./store") return {
        writeValues: async (values) => { writes.push(values); },
        readValue: options.readValue || (async (_key, fallback) => fallback)
      };
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

test("Android song lookup reuses the index and invalidates it when sync replaces the snapshot", () => {
  const { phone } = library();
  let reads = 0;
  const make = (id, title) => ({ get id() { reads++; return id; }, title, liked: false, file: { size: 12, mtimeMs: 1, ext: "mp3" }, cover: null });
  phone.remoteSongs = Array.from({ length: 2000 }, (_, i) => make(String(i), "old"));
  phone.patchSong("1999", { liked: true });
  reads = 0;
  phone.patchSong("1999", { playbackPosition: 3 });
  assert.ok(reads < 10, "second update must not scan the library");
  phone.remoteSongs = [make("1999", "new")];
  assert.equal(phone.patchSong("1999", { liked: false }).title, "new");
  assert.equal(phone.patchSong("0", { liked: true }), null);
});

test("offline Android play-event updates use indexed identities and rebuild after sync acknowledgements", () => {
  const { phone } = library();
  const make = id => ({ id, sessionId: "s", songId: "song", startedAt: 1, updatedAt: 2, msListened: 1, outcome: "active" });
  phone.pendingEvents = Array.from({ length: 3000 }, (_, i) => make(String(i)));
  phone.recordPlayEvent({ ...make("2999"), msListened: 500 });
  assert.equal(phone.pendingEvents.length, 3000);
  assert.equal(phone.pendingEvents[2999].msListened, 500);
  phone.pendingEvents = [make("2999")];
  phone.recordPlayEvent(make("new"));
  assert.equal(phone.pendingEvents.length, 2);
  assert.equal(phone.pendingEvents[1].id, "new");
  phone.recordPlayEvent({ ...make("2999"), msListened: 700 });
  assert.equal(phone.pendingEvents[0].msListened, 700);
});

test("unchanged Android song edits do not rewrite IndexedDB", () => {
  const { phone, writes } = library();
  phone.remoteSongs = [{ id: "a", title: "a", file: { size: 1, mtimeMs: 1, ext: "mp3" }, cover: null }];
  phone.patchSong("a", { playbackPosition: 12 });
  const revision = phone.revision;
  phone.patchSong("a", { playbackPosition: 12 });
  assert.equal(phone.revision, revision);
  assert.equal(writes.length, 1);
  phone.patchSong("a", { playbackPosition: 13 });
  assert.equal(writes.length, 2);
});

test("a failed Android IndexedDB bootstrap can retry without a page reload", async () => {
  let failed = false;
  const { phone } = library({ readValue: async (_key, fallback) => {
    if (!failed) { failed = true; throw new Error("temporary indexedDB outage"); }
    return fallback;
  }});
  await assert.rejects(phone.load(), /temporary indexedDB outage/);
  await phone.load();
  assert.equal(phone.remoteSongs.length, 0);
  assert.equal(phone.pairing, null);
});
