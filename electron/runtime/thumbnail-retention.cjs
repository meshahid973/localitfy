"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const cachedName = /^[a-f0-9]{40}\.png$/;
const partialName = /^[a-f0-9]{40}\.png\.[a-f0-9-]{36}\.part\.png$/;

// Only derived files: never traverse folders or symlinks.
async function pruneThumbnails(dir, { maxBytes = 256 * 1024 * 1024, maxFiles = 8192, active = () => false, now = Date.now, onRemove = () => {} } = {}) {
  if (!dir) return { count: 0, bytes: 0, removed: 0 };
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || (!cachedName.test(entry.name) && !partialName.test(entry.name))) continue;
    const file = path.join(dir, entry.name);
    const stat = await fs.lstat(file).catch(() => null);
    if (!stat?.isFile()) continue;
    if (partialName.test(entry.name)) {
      if (now() - stat.mtimeMs > 86400000 && !active(file)) await fs.rm(file,{force:true}).catch(()=>{});
      continue;
    }
    items.push({ file, size: stat.size, at: stat.mtimeMs });
  }
  items.sort((a,b) => a.at-b.at);
  let bytes = items.reduce((sum,item) => sum+item.size,0), count=items.length, removed=0;
  for (const item of items) {
    if (count <= maxFiles && bytes <= maxBytes && item.size > 0) continue;
    if (active(item.file)) continue;
    try {
      const current = await fs.lstat(item.file);
      if (!current.isFile() || current.size !== item.size || current.mtimeMs !== item.at || active(item.file)) continue;
      await fs.rm(item.file,{force:true});
      count--; bytes-=item.size; removed++; onRemove(item.file);
    } catch {}
  }
  return { count, bytes, removed };
}
module.exports = { pruneThumbnails };
