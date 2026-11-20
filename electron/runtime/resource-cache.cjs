"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

// Only disposable lookup results belong here, never user artwork or library data.
function createResourceCache({ maxEntries = 512, maxBytes = 2 * 1024 * 1024, file = "", now = Date.now, validate = () => true } = {}) {
  const entries = new Map();
  let loaded = false;
  let dirty = false;
  let timer = null;
  function trim() {
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  }
  function load() {
    if (loaded) return;
    loaded = true;
    if (!file) return;
    try {
      if (fs.statSync(file).size > maxBytes) return;
      const rows = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!Array.isArray(rows)) return;
      for (const row of rows.slice(-maxEntries)) {
        if (!Array.isArray(row)) continue;
        const [key, entry] = row;
        if (typeof key === "string" && key.length <= 1024 && entry && Number.isFinite(entry.expiresAt) &&
            entry.expiresAt > now() && validate(entry.value)) entries.set(key, entry);
      }
      trim();
    } catch { /* A corrupt or absent cache is a cold start. */ }
  }
  function flush() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (!file || !dirty) return;
    let temporary;
    try {
      const clock = now();
      for (const [key, entry] of entries) if (entry.expiresAt <= clock) entries.delete(key);
      let data = JSON.stringify([...entries]);
      while (Buffer.byteLength(data) > maxBytes && entries.size) {
        entries.delete(entries.keys().next().value);
        data = JSON.stringify([...entries]);
      }
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
    entries.delete(key);
    entries.set(key, { value, expiresAt: now() + ttlMs });
    trim();
    if (file) {
      dirty = true;
      if (timer === null) {
        timer = setTimeout(flush, 250);
        timer.unref?.();
      }
    }
  }
  function get(key) {
    load();
    const entry = entries.get(key);
    if (!entry) return undefined;
    entries.delete(key);
    if (entry.expiresAt <= now()) return undefined;
    entries.set(key, entry);
    return entry.value;
  }
  return { get, set, flush, get size() { load(); return entries.size; } };
}
module.exports = { createResourceCache };
