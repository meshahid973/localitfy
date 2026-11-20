"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { safeProviderCover, imageExtension } = require("./remote-cover.cjs");

const imageName = /^[a-f0-9]{64}\.(?:jpg|png|webp|gif)$/;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const MAX_IMAGE = 2 * 1024 * 1024;
const MAX_TTL = 7 * 86400000;
function eligible(url) {
  // Display-only providers and arbitrary URLs must never enter this cache.
  return typeof url === "string" && safeProviderCover(url) === url && url.startsWith("https://");
}
function lifetime(headers) {
  const cc = headers.get("cache-control") || "";
  if (/(?:^|,)\s*(?:no-store|no-cache|private)(?:\s*[=,]|\s*$)/i.test(cc)) return 0;
  const vary = headers.get("vary");
  if (vary && vary.trim()) return 0;
  const seconds = Number(cc.match(/(?:^|,)\s*max-age\s*=\s*(\d+)/i)?.[1] || 0);
  const age = Math.max(0, Number(headers.get("age")) || 0);
  return Math.min(MAX_TTL, Math.max(0, (seconds - age) * 1000));
}

// Dedicated disposable cache. Never points to library files or user-assigned covers.
function createRemoteArtworkCache({ dir, maxBytes = 128 * 1024 * 1024, maxEntries = 2048, fetchImpl = globalThis.fetch, now = Date.now }) {
  if (!path.isAbsolute(dir)) throw Error("Artwork cache requires an absolute directory");
  maxBytes = Math.max(1, Math.min(512 * 1024 * 1024, Number(maxBytes) || 128 * 1024 * 1024));
  maxEntries = Math.max(1, Math.min(4096, Number(maxEntries) || 2048));
  const index = path.join(dir, "index.json"), rows = new Map(), pending = new Map();
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
  async function prune() {
    const clock = now();
    for (const [url, row] of rows) if (row.expiresAt <= clock) rows.delete(url);
    // Multiple URLs can reference the same content-addressed image.
    const totals = () => {
      const files = new Map([...rows.values()].map(row => [row.file, row.bytes]));
      return [...files.values()].reduce((sum, bytes) => sum + bytes, 0);
    };
    while (rows.size > maxEntries || totals() > maxBytes) rows.delete(rows.keys().next().value);
    await save();
    const used = new Set([...rows.values()].map(row => row.file));
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (!entry.isFile() || used.has(entry.name)) continue;
      if (imageName.test(entry.name) || /^(?:index\.json|[a-f0-9]{64}\.(?:jpg|png|webp|gif))\.[a-f0-9-]{36}\.part$/.test(entry.name))
        await fs.rm(path.join(dir, entry.name), { force: true }).catch(() => {});
    }
  }
  function init() {
    if (!ready) ready = (async () => {
      await fs.mkdir(dir, { recursive: true });
      try {
        if ((await fs.stat(index)).size > 12 * 1024 * 1024) throw Error("Oversized index");
        const parsed = JSON.parse(await fs.readFile(index, "utf8"));
        for (const [url, row] of Array.isArray(parsed) ? parsed.slice(-4096) : []) {
          if (eligible(url) && imageName.test(row?.file || "") && Number.isInteger(row.bytes) && row.bytes > 0 &&
              row.bytes <= MAX_IMAGE && Number.isFinite(row.expiresAt) && row.expiresAt > now()) rows.set(url, row);
        }
      } catch { rows.clear(); }
      await prune();
    })();
    return ready;
  }
  async function cached(url) {
    const row = rows.get(url);
    if (!row) return "";
    const file = path.join(dir, row.file);
    try {
      if (row.expiresAt > now() && (await fs.stat(file)).size === row.bytes) {
        const bytes = await fs.readFile(file);
        if (hash(bytes) === row.file.split(".")[0]) {
          rows.delete(url); rows.set(url, row);
          return file;
        }
      }
    } catch {}
    rows.delete(url);
    return "";
  }
  async function fetchImage(url) {
    const response = await fetchImpl(url, {
      redirect: "error", credentials: "omit", signal: AbortSignal.timeout(4500),
      headers: { Accept: "image/png,image/jpeg,image/webp,image/gif" }
    });
    const ttl = lifetime(response.headers);
    const declared = Number(response.headers.get("content-length") || 0);
    if (!response.ok || ttl <= 0 || declared > MAX_IMAGE || !response.body) {
      await response.body?.cancel().catch(() => {});
      return "";
    }
    const reader = response.body.getReader(), chunks = [];
    let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_IMAGE || total > maxBytes) { await reader.cancel(); return ""; }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks), ext = imageExtension(bytes, response.headers.get("content-type"));
    if (!ext || closed) return "";
    return withLock(async () => {
      if (closed) return "";
      const name = hash(bytes) + ext, file = path.join(dir, name);
      const temporary = file + "." + randomUUID() + ".part";
      try {
        // Replace a damaged prior copy; identical content shares one file.
        let valid = false;
        try { valid = (await fs.stat(file)).size === bytes.length && hash(await fs.readFile(file)) === hash(bytes); } catch {}
        if (!valid) {
          await fs.writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
          await fs.rename(temporary, file);
        }
        rows.delete(url);
        rows.set(url, { file: name, bytes: bytes.length, expiresAt: now() + ttl });
        await prune();
        return rows.has(url) ? file : "";
      } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
    });
  }
  function resolve(url) {
    if (closed || !eligible(url)) return Promise.resolve("");
    if (pending.has(url)) return pending.get(url);
    if (pending.size >= 4) return Promise.resolve("");
    const task = init().then(() => withLock(() => cached(url))).then(file => file || fetchImage(url))
      .catch(() => "").finally(() => pending.delete(url));
    pending.set(url, task);
    return task;
  }
  return { resolve, close() { closed = true; }, get pendingCount() { return pending.size; } };
}
module.exports = { createRemoteArtworkCache, lifetime, eligible };
