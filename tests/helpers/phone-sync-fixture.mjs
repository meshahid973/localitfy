import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { createSyncServer } = require("../../electron/sync/server.cjs");
const receipts = require("../../electron/db/phone-sync.cjs");
const events = require("../../electron/db/play-events.cjs");

export function receiptDatabase(file = ":memory:") {
  const database = new DatabaseSync(file);
  database.transaction = (apply) => () => {
    database.exec("BEGIN IMMEDIATE");
    try { const value = apply(); database.exec("COMMIT"); return value; }
    catch (error) { database.exec("ROLLBACK"); throw error; }
  };
  receipts.createPhoneSyncTable(database);
  return database;
}

export function receiptRepository(database) {
  return { applyBatch: (...args) => receipts.applyPhoneSyncBatch(database, ...args) };
}

/**
 * A fresh connection per request, like the phone's native client. fetch's keep-alive pool (Node 22) would reuse a
 * socket to the server the test just restarted and fail instead of reconnecting.
 */
export function send({ url, method = "GET", headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, headers, agent: false }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body: text }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

/**
 * Reads the live event stream (GET /v1/live) on its own connection, like the phone's native reader.
 * `next(type)` waits for the next event of that type; `close()` destroys the socket so the server sees the phone go.
 */
export function openLiveStream(url, token) {
  return new Promise((resolve, reject) => {
    const events = [];
    const waiting = [];
    const request = http.request(`${url}/v1/live`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, agent: false }, (response) => {
      let buffer = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        buffer += chunk;
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = block.split("\n").filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n");
          if (!data) continue;
          const event = JSON.parse(data);
          const index = waiting.findIndex((item) => item.type === event.type);
          if (index >= 0) waiting.splice(index, 1)[0].resolve(event);
          else events.push(event);
        }
      });
      resolve({
        status: response.statusCode,
        events,
        next(type, timeoutMs = 2000) {
          const index = events.findIndex((event) => event.type === type);
          if (index >= 0) return Promise.resolve(events.splice(index, 1)[0]);
          return new Promise((done, fail) => {
            const item = { type, resolve: (event) => { clearTimeout(timer); done(event); } };
            const timer = setTimeout(() => { waiting.splice(waiting.indexOf(item), 1); fail(new Error(`no ${type} event`)); }, timeoutMs);
            waiting.push(item);
          });
        },
        close() { request.destroy(); }
      });
    });
    request.on("error", reject);
    request.end();
  });
}

function compile(file, dependencies = {}) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  runInNewContext(output, { exports, structuredClone, URL, console, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unmocked dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

/** Real sync HTTP server + durable SQLite receipts/events, with the real phone modules and a persisted KV transport double. */
export async function syncFixture({ liveOptions } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-sync-races-"));
  const file = path.join(dir, "song.mp3");
  fs.writeFileSync(file, "audio");
  let database = receiptDatabase(path.join(dir, "mac.sqlite"));
  database.exec("PRAGMA foreign_keys=ON; CREATE TABLE songs (id TEXT PRIMARY KEY, data TEXT); CREATE TABLE fixture_playlists (value TEXT);");
  events.createPlayEventsTable(database);
  const song = { id: "a", title: "A", artist: "Artist", album: "Album", liked: false, playCount: 2, filePath: file, lastPlayed: null };
  database.prepare("INSERT INTO songs VALUES (?, ?)").run(song.id, JSON.stringify(song));
  database.prepare("INSERT INTO fixture_playlists VALUES (?)").run(JSON.stringify([{ id: "p", name: "P", songIds: ["a"], createdAt: 1 }]));
  const repositories = {
    songs: {
      list: () => database.prepare("SELECT data FROM songs").all().map((row) => JSON.parse(row.data)),
      get: (id) => { const row = database.prepare("SELECT data FROM songs WHERE id=?").get(id); return row ? JSON.parse(row.data) : null; },
      patch: (id, patch) => { const updated = { ...repositories.songs.get(id), ...patch }; database.prepare("UPDATE songs SET data=? WHERE id=?").run(JSON.stringify(updated), id); return updated; }
    },
    playlists: {
      get: () => JSON.parse(database.prepare("SELECT value FROM fixture_playlists").get().value),
      save: (value) => database.prepare("UPDATE fixture_playlists SET value=?").run(JSON.stringify(value))
    },
    listening: { record: (event) => events.recordPlayEvent(database, event), counts: () => [] },
    sync: {
      applyBatch: (...args) => receipts.applyPhoneSyncBatch(database, ...args),
      likeClock: (id) => receipts.readLikeClock(database, id),
      setLikeClock: (id, at) => receipts.writeLikeClock(database, id, at)
    }
  };
  let server;
  let port;
  const scrobbled = [];
  const computerEvents = [];
  async function startServer() {
    server = createSyncServer({
      repositories, coverPath: () => "", statePath: path.join(dir, "state.json"), onPlayEvent: (event) => scrobbled.push(event),
      onLiveEvent: (event) => computerEvents.push(event), liveOptions
    });
    port = await server.start(port || 0);
  }
  await startServer();
  const persisted = new Map();
  const requests = [];
  const hooks = {};
  let writes = Promise.resolve();
  const store = {
    readValue: async (key, fallback) => { await writes.catch(() => {}); return structuredClone(persisted.has(key) ? persisted.get(key) : fallback); },
    writeValues: (values) => {
      const copy = structuredClone(values);
      const write = writes.catch(() => {}).then(async () => {
        await hooks.beforeSave?.(copy);
        for (const [key, value] of Object.entries(copy)) persisted.set(key, value);
      });
      writes = write;
      return write;
    }
  };
  const native = {
    getPaths: async () => ({ files: "/phone", mediaPrefix: "https://localhost/_localtify_media_/", deviceName: "Test phone" }),
    setSyncActive: async () => {}, addListener: async () => ({ remove: async () => {} }),
    downloadFile: async () => ({}), deleteFile: async () => ({}),
    request: async (request) => {
      await hooks.beforeRequest?.(request);
      const result = await send(request);
      await hooks.afterResponse?.(request, result);
      if (request.url.endsWith("/v1/changes")) {
        const body = JSON.parse(request.body);
        requests.push({ body, status: result.status });
        await hooks.afterChanges?.(body, result);
      }
      return result;
    }
  };
  let phone;
  let sync;
  async function restartPhone() {
    const library = compile("src/platform/android/library.ts", { "./native": { LocaltifyNative: native }, "./store": store });
    phone = library.phoneLibrary;
    await phone.load();
    const merge = compile("src/platform/android/syncMerge.ts");
    const exchange = compile("src/platform/android/syncExchange.ts", { "./syncMerge": merge });
    sync = compile("src/platform/android/sync.ts", {
      "./native": { LocaltifyNative: native }, "./library": library, "./syncMerge": merge, "./syncExchange": exchange,
      "./macFeatures": { markMacReachable: () => {}, fromMacOrKept: async () => null },
      "../../app/platform": { computerName: () => "Mac", setPairedComputerPlatform: () => {} }
    });
  }
  await restartPhone();
  await sync.pairWithMac(`127.0.0.1:${port}`, server.newPairingCode().code);
  await sync.syncNow();
  return {
    get phone() { return phone; }, get sync() { return sync; }, get server() { return server; }, get url() { return `http://127.0.0.1:${port}`; },
    repositories, requests, hooks, persisted, scrobbled, computerEvents,
    restartPhone,
    async restartServer() {
      await server.stop(); database.close(); database = receiptDatabase(path.join(dir, "mac.sqlite")); await startServer();
    },
    async close() { await server.stop(); database.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  };
}
