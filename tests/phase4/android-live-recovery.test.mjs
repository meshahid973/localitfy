import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const hello = { ok: true, self: "phone", serverTime: 1000, peers: [{ id: "computer", name: "PC", kind: "computer" }, { id: "phone", name: "Phone", kind: "phone" }], session: { active: "", epoch: 0, online: true }, state: null };
const flush = () => new Promise(setImmediate);

function fixture(request = async () => ({ body: JSON.stringify(hello) })) {
  const callbacks = new Map();
  const events = [];
  const library = { pairing: { url: "http://computer", token: "test-token" }, save: async () => {}, adoptMacLike: () => false };
  const native = { liveConnect: async () => {}, liveDisconnect: async () => {}, request,
    addListener: async (name, callback) => { callbacks.set(name, callback); return { remove: async () => {} }; } };
  const output = ts.transpileModule(fs.readFileSync("src/platform/android/live.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  runInNewContext(output, { exports, console, setTimeout, clearTimeout,
    window: { clearTimeout, setTimeout, addEventListener() {} },
    document: { visibilityState: "visible", addEventListener() {} },
    navigator: { mediaSession: { playbackState: "none" } },
    require: (name) => {
      if (name === "./library") return { phoneLibrary: library };
      if (name === "./native") return { LocaltifyNative: native };
      throw new Error(`Unexpected dependency ${name}`);
    }
  });
  exports.onLiveEvent((event) => events.push(event));
  return { subject: exports, library, callbacks, events };
}

test("Android recovers presence when the native stream survives a WebView reload without another hello", async () => {
  const f = fixture();
  f.subject.installLiveConnection();
  await flush();
  assert.equal(f.subject.getLiveStatus(), "connected");
  const status = await f.subject.sendLive({ type: "status" });
  assert.equal(status.self, "phone");
  assert.equal(status.peers.length, 2);
  assert.ok(f.events.some((event) => event.type === "hello"));
});

test("a delayed presence response cannot reconnect an unpaired phone", async () => {
  let finish;
  const f = fixture(() => new Promise((resolve) => { finish = resolve; }));
  f.subject.installLiveConnection();
  await flush();
  assert.equal(f.subject.getLiveStatus(), "connecting");
  f.library.pairing = null;
  f.subject.restartLiveConnection();
  finish({ body: JSON.stringify(hello) });
  await flush();
  assert.equal(f.subject.getLiveStatus(), "off");
  assert.equal(f.events.some((event) => event.type === "hello"), false);
});

test("a status fallback does not replace a newer stream hello", async () => {
  let finish;
  const f = fixture(() => new Promise((resolve) => { finish = resolve; }));
  f.subject.installLiveConnection();
  await flush();
  f.callbacks.get("liveEvent")({ data: JSON.stringify({ ...hello, type: "hello", serverTime: 2000 }) });
  finish({ body: JSON.stringify(hello) });
  await flush();
  assert.equal((await f.subject.sendLive({ type: "status" })).serverTime, 2000);
  assert.equal(f.events.filter((event) => event.type === "hello").length, 1);
});
