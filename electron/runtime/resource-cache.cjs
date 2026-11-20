"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

// Only disposable lookup results belong here, never user artwork or library data.
function createResourceCache({ maxEntries = 512, maxBytes = 2 * 1024 * 1024, file = "", now = Date.now, validate = () => true } = {}) {
  const entries = new Map();
  let loaded = false, loading = null, bytes = 2, dirty = false, timer = null, writing = null, revision = 0, generation = 0;
  function remove(key) {
    const entry = entries.get(key);
    if (entry) { bytes -= entry.bytes + 1; entries.delete(key); }
  }
  function trim() {
    while (entries.size && (entries.size > maxEntries || bytes > maxBytes)) remove(entries.keys().next().value);
  }
  function insert(key, entry) {
    const size = Buffer.byteLength(JSON.stringify([key, entry]));
    if (size + 3 > maxBytes) return;
    remove(key);
    entries.set(key, { ...entry, bytes: size });
    bytes += size + 1;
    trim();
  }
  function restore(data) {
    if (loaded) return;
    loaded = true;
    try {
      const rows = JSON.parse(data);
      if (!Array.isArray(rows)) return;
      for (const row of rows.slice(-maxEntries)) {
        if (!Array.isArray(row)) continue;
        const [key, entry] = row;
        if (typeof key === "string" && key.length <= 1024 && entry && Number.isFinite(entry.expiresAt) &&
            entry.expiresAt > now() && validate(entry.value)) insert(key, {value:entry.value, expiresAt:entry.expiresAt});
      }
    } catch {}
  }
  function hydrate() {
    if (loaded) return Promise.resolve();
    if (!file) { loaded = true; return Promise.resolve(); }
    if (!loading) loading = fs.promises.stat(file).then(stat => stat.size <= maxBytes ? fs.promises.readFile(file, "utf8") : "")
      .then(restore, () => { loaded = true; }).finally(() => { loading = null; });
    return loading;
  }
  // Retain the synchronous API for memory-only callers and explicit shutdown.
  function load() {
    if (loaded) return;
    if (!file) { loaded = true; return; }
    try {
      if (fs.statSync(file).size <= maxBytes) restore(fs.readFileSync(file, "utf8"));
    } catch {}
    loaded = true;
  }
  function snapshot() {
    for (const [key, entry] of entries) if (entry.expiresAt <= now()) remove(key);
    trim();
    return JSON.stringify([...entries].map(([key, {value, expiresAt}]) => [key,{value,expiresAt}]));
  }
  function schedule() {
    if (!file || !dirty || timer !== null || writing) return;
    timer = setTimeout(() => {
      timer = null;
      const currentRevision = revision, currentGeneration = generation;
      const data = snapshot();
      const temporary = file + "." + randomUUID() + ".part";
      writing = (async () => {
        try {
          await fs.promises.mkdir(path.dirname(file), {recursive:true});
          await fs.promises.writeFile(temporary, data, {flag:"wx", mode:0o600});
          if (generation !== currentGeneration) return;
          // Atomic publication; a synchronous shutdown flush cannot interleave this step.
          fs.renameSync(temporary, file);
          if (revision === currentRevision) dirty = false;
        } catch {}
        finally { await fs.promises.rm(temporary,{force:true}).catch(() => {}); }
      })().finally(() => {
        writing = null;
        if (revision !== currentRevision) schedule();
      });
    }, 250);
    timer.unref?.();
  }
  function flush() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    generation++;
    if (!file || !dirty) return;
    let temporary;
    try {
      const data = snapshot();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      temporary = file + "." + randomUUID() + ".part";
      fs.writeFileSync(temporary, data, { flag: "wx", mode: 0o600 });
      fs.renameSync(temporary, file);
      dirty = false;
    } catch { /* Cache persistence must never prevent normal use. */ }
    finally { if (temporary) { try { fs.rmSync(temporary, { force: true }); } catch {} } }
  }
  function set(key, value, ttlMs) {
    load();
    if (typeof key !== "string" || key.length > 1024 || !validate(value) || !(ttlMs > 0) || !Number.isFinite(ttlMs)) return;
    insert(key, { value, expiresAt: now() + ttlMs });
    if (file) { dirty = true; revision++; schedule(); }
  }
  function get(key) {
    load();
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now()) { remove(key); return undefined; }
    entries.delete(key);
    entries.set(key, entry);
    return entry.value;
  }
  return { get, set, flush, hydrate, get size() { load(); return entries.size; } };
}
module.exports = { createResourceCache };
