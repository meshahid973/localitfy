"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { safeProviderCover, imageExtension } = require("./remote-cover.cjs");
const imageName = /^[a-f0-9]{64}\.(?:jpg|png|webp|gif)$/;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const MAX_IMAGE = 2 * 1024 * 1024;
const MAX_TTL = 7 * 86400000;
const MAX_STALE = 24 * 3600000;
function eligible(url) {
  return typeof url === "string" && safeProviderCover(url) === url && url.startsWith("https://");
}
function policy(headers, prior) {
  const cc = headers.get("cache-control");
  const vary = headers.get("vary");
  if (vary?.trim() || /(?:^|,)\s*(?:no-store|no-cache|private)(?:\s*[=,]|\s*$)/i.test(cc || "")) return { ttl:0, stale:0 };
  const seconds = Number((cc || "").match(/(?:^|,)\s*max-age\s*=\s*(\d+)/i)?.[1] || 0);
  const age = Math.max(0, Number(headers.get("age")) || 0) * 1000;
  const ttl = Math.max(0, Math.min(MAX_TTL, cc === null && prior ? (prior.ttl || 0) : seconds * 1000) - age);
  const swr = Number((cc || "").match(/(?:^|,)\s*stale-while-revalidate\s*=\s*(\d+)/i)?.[1] || 0);
  const stale = /(?:^|,)\s*(?:must-revalidate|proxy-revalidate)\s*(?:,|$)/i.test(cc || "") ? 0 :
    Math.min(MAX_STALE, cc === null && prior ? (prior.stale || 0) : swr * 1000);
  return {ttl, stale};
}
function lifetime(headers) { return policy(headers).ttl; }
function headerValue(value) { return typeof value === "string" && value.length <= 512 && !/[\r\n]/.test(value) ? value : ""; }

function createRemoteArtworkCache({ dir, maxBytes = 128 * 1024 * 1024, maxEntries = 2048, fetchImpl = globalThis.fetch, now = Date.now }) {
  if (!path.isAbsolute(dir)) throw Error("Artwork cache requires an absolute directory");
  maxBytes = Math.max(1, Math.min(512 * 1024 * 1024, Number(maxBytes) || 128 * 1024 * 1024));
  maxEntries = Math.max(1, Math.min(4096, Number(maxEntries) || 2048));
  const index = path.join(dir, "index.json"), rows = new Map(), pending = new Map(), verified = new Map(), retryAt = new Map();
  const shutdown = new AbortController();
  let ready, serial = Promise.resolve(), closed = false;
  const withLock = work => {
    const result = serial.then(work);
    serial = result.catch(() => {});
    return result;
  };
  async function save() {
    const temporary = index + "." + randomUUID() + ".part";
    try {
      await fs.writeFile(temporary, JSON.stringify([...rows]), { flag: "wx", mode: 0o600 });
      await fs.rename(temporary, index);
    } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  }
  async function removeFile(name) {
    if (!imageName.test(name)) return;
    verified.delete(name);
    await fs.rm(path.join(dir,name),{force:true}).catch(() => {});
  }
  async function prune(orphaned = [], startup = false) {
    const refs = new Map();
    let bytes = 0;
    for (const row of rows.values()) {
      const ref = refs.get(row.file);
      if (ref) ref.count++;
      else { refs.set(row.file,{count:1,bytes:row.bytes}); bytes += row.bytes; }
    }
    function drop(url, row) {
      rows.delete(url);
      retryAt.delete(url);
      const ref = refs.get(row.file);
      if (ref && --ref.count === 0) { refs.delete(row.file); bytes -= ref.bytes; orphaned.push(row.file); }
    }
    for (const [url,row] of rows) if (row.staleUntil <= now()) drop(url,row);
    while (rows.size > maxEntries || bytes > maxBytes) {
      const [url,row] = rows.entries().next().value;
      drop(url,row);
    }
    await save();
    if (startup) {
      for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
        if (!entry.isFile()) continue;
        if (imageName.test(entry.name)) orphaned.push(entry.name);
        else if (/^(?:index\.json|[a-f0-9]{64}\.(?:jpg|png|webp|gif))\.[a-f0-9-]{36}\.part$/.test(entry.name)) await fs.rm(path.join(dir,entry.name),{force:true}).catch(()=>{});
      }
    }
    for (const name of new Set(orphaned)) if (!refs.has(name)) await removeFile(name);
  }
  function init() {
    if (!ready) ready = (async () => {
      await fs.mkdir(dir,{recursive:true});
      try {
        if ((await fs.stat(index)).size > 12 * 1024 * 1024) throw Error("Oversized index");
        const parsed = JSON.parse(await fs.readFile(index,"utf8"));
        for (const item of Array.isArray(parsed) ? parsed.slice(-4096) : []) {
          if (!Array.isArray(item)) continue;
          const [url,row] = item;
          if (!eligible(url) || !imageName.test(row?.file || "") || !Number.isInteger(row.bytes) || row.bytes <= 0 ||
              row.bytes > MAX_IMAGE || !Number.isFinite(row.expiresAt)) continue;
          const staleUntil = Math.min(row.expiresAt + MAX_STALE, Number.isFinite(row.staleUntil) ? row.staleUntil : row.expiresAt);
          if (staleUntil <= now()) continue;
          rows.set(url,{file:row.file,bytes:row.bytes,expiresAt:row.expiresAt,staleUntil,
            ttl:Math.min(MAX_TTL,Math.max(0,Number(row.ttl)||0)),stale:Math.min(MAX_STALE,Math.max(0,Number(row.stale)||0)),
            etag:headerValue(row.etag),lastModified:headerValue(row.lastModified)});
        }
      } catch { rows.clear(); }
      await prune([],true);
    })();
    return ready;
  }
  async function validateFile(row) {
    const file = path.join(dir,row.file);
    try {
      const stat = await fs.lstat(file,{bigint:true});
      if (!stat.isFile() || stat.size !== BigInt(row.bytes)) return "";
      const stamp = [stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].join(":");
      if (verified.get(row.file) !== stamp) {
        if (hash(await fs.readFile(file)) !== row.file.split(".")[0]) return "";
        verified.set(row.file,stamp);
      }
      return file;
    } catch { return ""; }
  }
  async function cached(url) {
    const row = rows.get(url);
    if (!row) return null;
    const file = await validateFile(row);
    if (!file) { rows.delete(url); verified.delete(row.file); return null; }
    rows.delete(url); rows.set(url,row);
    return { row, file };
  }
  async function fetchImage(url, prior) {
    const headers = {Accept:"image/png,image/jpeg,image/webp,image/gif"};
    if (prior?.etag) headers["If-None-Match"] = prior.etag;
    if (prior?.lastModified) headers["If-Modified-Since"] = prior.lastModified;
    const response = await fetchImpl(url,{
      redirect:"error",credentials:"omit",signal:AbortSignal.any([shutdown.signal,AbortSignal.timeout(prior ? 4500 : 1600)]),headers
    });
    const {ttl,stale} = policy(response.headers, response.status === 304 ? prior : undefined);
    if (response.status === 304 && prior) {
      return withLock(async () => {
        if (closed) return "";
        if (ttl <= 0) { rows.delete(url); await prune([prior.file]); return ""; }
        const file = await validateFile(prior);
        if (!file) { rows.delete(url); return ""; }
        rows.delete(url);
        rows.set(url,{...prior,ttl,stale,expiresAt:now()+ttl,staleUntil:now()+ttl+stale});
        await prune(); return file;
      });
    }
    const declared = Number(response.headers.get("content-length") || 0);
    if (!response.ok || ttl <= 0 || declared > MAX_IMAGE || !response.body) {
      await response.body?.cancel().catch(() => {});
      if (response.ok && ttl <= 0 && prior) await withLock(async()=>{ rows.delete(url); await prune([prior.file]); });
      return "";
    }
    const reader = response.body.getReader(), chunks = [];
    let total = 0;
    try {
      while (true) {
        const {value,done} = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_IMAGE || total > maxBytes) { await reader.cancel(); return ""; }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks), ext = imageExtension(bytes,response.headers.get("content-type"));
    if (!ext || closed) return "";
    return withLock(async () => {
      if (closed) return "";
      const name = hash(bytes)+ext, file = path.join(dir,name), temporary = file+"."+randomUUID()+".part";
      try {
        if (!await validateFile({file:name,bytes:bytes.length})) {
          await fs.writeFile(temporary,bytes,{flag:"wx",mode:0o600});
          await fs.rename(temporary,file);
          verified.delete(name);
        }
        const replaced = rows.get(url);
        rows.delete(url);
        rows.set(url,{file:name,bytes:bytes.length,ttl,stale,expiresAt:now()+ttl,staleUntil:now()+ttl+stale,
          etag:headerValue(response.headers.get("etag")),lastModified:headerValue(response.headers.get("last-modified"))});
        await prune(replaced ? [replaced.file] : []);
        return rows.has(url) ? file : "";
      } finally { await fs.rm(temporary,{force:true}).catch(()=>{}); }
    });
  }
  function refresh(url,prior) {
    if (closed) return Promise.resolve("");
    if (pending.has(url)) return pending.get(url);
    if (pending.size >= 4 || (retryAt.get(url)||0) > now()) return Promise.resolve("");
    const task = fetchImage(url,prior).catch(()=> "").then(file=>{
      if (file) retryAt.delete(url);
      else {
        retryAt.set(url,now()+30_000);
        while(retryAt.size>512) retryAt.delete(retryAt.keys().next().value);
      }
      return file;
    }).finally(()=>pending.delete(url));
    pending.set(url,task);
    return task;
  }
  async function resolve(url) {
    if (closed || !eligible(url)) return "";
    try {
      await init();
      const hit = await withLock(()=>cached(url));
      if (closed) return "";
      if (hit && hit.row.expiresAt > now()) return hit.file;
      if (hit && hit.row.staleUntil > now()) { void refresh(url,hit.row); return hit.file; }
      return await refresh(url,hit?.row);
    } catch { return ""; }
  }
  return {resolve, remainingTtl(url){return Math.max(0,(rows.get(url)?.staleUntil || 0)-now());}, close(){closed=true;shutdown.abort();},get pendingCount(){return pending.size;}};
}
module.exports = {createRemoteArtworkCache,lifetime,eligible};
