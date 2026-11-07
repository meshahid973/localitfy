import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const { createSyncServer, isPrivateAddress } = require("../../electron/sync/server.cjs");

function compile(file) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(output, { exports });
  return exports;
}
const merge = compile("src/platform/android/syncMerge.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const playlist = (id, songIds, name = id) => ({ id, name, songIds, createdAt: 1 });

test("song edits: phone changes are pushed, untouched songs are not", () => {
  const base = new Map([["a", { id: "a", liked: false, title: "A", playCount: 3 }], ["b", { id: "b", liked: true, title: "B", playCount: 1 }]]);
  const phone = [{ id: "a", liked: true, title: "A", playCount: 5, lastPlayed: "2026-11-06T10:00:00Z" }, { id: "b", liked: true, title: "B", playCount: 1 }];
  assert.deepEqual(plain(merge.phoneSongChanges(base, phone)), { a: { liked: true, playCountDelta: 2, lastPlayed: "2026-11-06T10:00:00Z" } });
});

test("song edits: unliking on the phone is pushed and play counts never go down", () => {
  const base = new Map([["a", { id: "a", liked: true, playCount: 9 }]]);
  assert.deepEqual(plain(merge.phoneSongChanges(base, [{ id: "a", liked: false, playCount: 4 }])), { a: { liked: false } });
});

test("song edits: songs that are new since the last sync have nothing to push", () => {
  assert.deepEqual(plain(merge.phoneSongChanges(new Map(), [{ id: "new", liked: true, playCount: 2 }])), {});
});

test("playlists: phone additions and removals merge into the Mac's edited order", () => {
  assert.deepEqual(merge.mergeSongIds(["1", "2", "3"], ["3", "1", "2", "4"], ["1", "5", "3"]), ["3", "1", "5", "4"]);
});

test("playlists: a phone addition stays in place when its neighbour was removed on the Mac", () => {
  assert.deepEqual(merge.mergeSongIds(["1", "5", "9"], ["1", "5"], ["1", "5", "9", "12"]), ["1", "5", "12"]);
});

test("playlists: a phone-only edit replaces the Mac copy; a Mac-only edit pushes nothing", () => {
  const base = [playlist("p", ["1", "2"])];
  assert.deepEqual(plain(merge.phonePlaylistChanges(base, base, [playlist("p", ["2", "1"], "renamed")])), { put: [playlist("p", ["2", "1"], "renamed")], delete: [] });
  assert.deepEqual(plain(merge.phonePlaylistChanges(base, [playlist("p", ["1"])], base)), { put: [], delete: [] });
});

test("playlists: edits on both sides merge, with the phone's rename winning", () => {
  const result = merge.phonePlaylistChanges([playlist("p", ["1", "2"])], [playlist("p", ["1", "2", "3"], "mac name")], [playlist("p", ["2", "4"], "phone name")]);
  assert.deepEqual(plain(result), { put: [playlist("p", ["2", "4", "3"], "phone name")], delete: [] });
});

test("playlists: deletes win over unchanged copies, edits win over deletes", () => {
  const base = [playlist("gone", ["1"]), playlist("kept", ["1"]), playlist("back", ["1"])];
  const mac = [playlist("gone", ["1"]), playlist("kept", ["1", "2"])];
  const phone = [playlist("back", ["1", "3"]), playlist("fresh", ["9"])];
  assert.deepEqual(plain(merge.phonePlaylistChanges(base, mac, phone)), { put: [playlist("back", ["1", "3"]), playlist("fresh", ["9"])], delete: ["gone"] });
});

test("server: only home-network addresses are answered", () => {
  for (const ip of ["192.168.1.4", "10.0.0.2", "172.20.1.1", "::ffff:192.168.0.9", "127.0.0.1", "fe80::1"]) assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ["8.8.8.8", "172.32.0.1", "::ffff:1.2.3.4", "2001:db8::1"]) assert.equal(isPrivateAddress(ip), false, ip);
});

function fakeLibrary(dir) {
  const audio = path.join(dir, "a.mp3");
  fs.writeFileSync(audio, "audio-bytes");
  const songs = [{ id: "a", title: "A", artist: "X", album: "Y", filePath: audio, liked: false, playCount: 2, lastPlayed: null }];
  let playlists = [playlist("p", ["a"])];
  const events = [];
  return {
    songs,
    events,
    get playlists() { return playlists; },
    repositories: {
      songs: { list: () => songs, get: (id) => songs.find((song) => song.id === id) || null, patch: (id, patch) => Object.assign(songs.find((song) => song.id === id), patch) },
      playlists: { get: () => playlists, save: (next) => { playlists = next; } },
      listening: { record: (event) => { events.push(event); return true; }, counts: () => [["a", 1, 0]] }
    }
  };
}

test("server: pairing, auth, snapshot, file download and applying phone changes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-sync-test-"));
  const library = fakeLibrary(dir);
  const changes = [];
  const sync = createSyncServer({ repositories: library.repositories, coverPath: () => "", statePath: path.join(dir, "state.json"), onChanged: (change) => changes.push(change) });
  const port = await sync.start(0);
  const url = (route) => `http://127.0.0.1:${port}${route}`;
  const post = (route, body, token) => fetch(url(route), { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(url("/v1/snapshot"))).status, 401);
    assert.equal((await post("/v1/pair", { code: "000000" })).status, 403, "no pairing window open");
    const { code } = sync.newPairingCode();
    assert.equal((await post("/v1/pair", { code: code === "111111" ? "222222" : "111111" })).status, 403);
    const paired = await (await post("/v1/pair", { code, deviceName: "Pixel" })).json();
    assert.ok(paired.token);
    assert.equal((await post("/v1/pair", { code })).status, 403, "a code works once");
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf8")).devices[0].tokenHash.includes(paired.token), false, "token is stored hashed");

    const auth = { Authorization: `Bearer ${paired.token}` };
    const snapshot = await (await fetch(url("/v1/snapshot"), { headers: auth })).json();
    assert.equal(snapshot.songs.length, 1);
    assert.equal(snapshot.songs[0].filePath, undefined, "Mac file paths stay on the Mac");
    assert.equal(snapshot.songs[0].file.size, 11);
    assert.equal(await (await fetch(url("/v1/audio/a"), { headers: auth })).text(), "audio-bytes");

    const event = { id: "e1", sessionId: "s", songId: "a", startedAt: 1, updatedAt: 2, endedAt: 2, msListened: 1, outcome: "ended", contextType: "library", contextId: null };
    const applied = await (await post("/v1/changes", {
      songs: { a: { liked: true, playCountDelta: 3, title: 7, filePath: "/etc/passwd" }, missing: { liked: true } },
      playlists: { put: [playlist("p", ["a", "a"], "edited"), playlist("new", [])], delete: [] },
      playEvents: [event]
    }, paired.token)).json();
    assert.deepEqual(applied.applied, { songs: 1, playlists: 2, playEvents: 1 });
    assert.equal(library.songs[0].liked, true);
    assert.equal(library.songs[0].playCount, 5);
    assert.equal(library.songs[0].title, "A", "invalid field types are ignored");
    assert.equal(library.songs[0].filePath.endsWith("a.mp3"), true, "file paths cannot be changed from the phone");
    assert.deepEqual(library.playlists.map((item) => [item.id, item.name, item.songIds]), [["new", "new", []], ["p", "edited", ["a"]]]);
    assert.equal(library.events.length, 1);
    assert.ok(changes.some((change) => change.songs === 1));
  } finally {
    await sync.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("server: too many wrong codes lock pairing until a new code is made", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-sync-test-"));
  const sync = createSyncServer({ repositories: fakeLibrary(dir).repositories, coverPath: () => "", statePath: path.join(dir, "state.json") });
  const port = await sync.start(0);
  const post = (code) => fetch(`http://127.0.0.1:${port}/v1/pair`, { method: "POST", body: JSON.stringify({ code }) });
  try {
    const { code } = sync.newPairingCode();
    const wrong = code === "123456" ? "654321" : "123456";
    for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await post(wrong)).status, 403);
    assert.equal((await post(code)).status, 429);
  } finally {
    await sync.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
