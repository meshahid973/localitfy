"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/** Publish complete audio without replacing an existing file, including on another drive. */
async function publishDownloadedFile(source, directory, filename, beforePublish = () => {}, publicationId = crypto.randomUUID()) {
  if (filename !== path.basename(filename) || !path.isAbsolute(directory)) throw new Error("Invalid download output path");
  const temporary = publicationTemporaryPath(directory, publicationId);
  let created = false;
  try {
    await fs.promises.copyFile(source, temporary, fs.constants.COPYFILE_EXCL);
    created = true;
    const handle = await fs.promises.open(temporary, "r+");
    try { await handle.sync(); } finally { await handle.close(); }
    const stat = await fs.promises.stat(temporary);
    if (!stat.size) throw new Error("Downloaded audio is empty");
    const parsed = path.parse(filename);
    for (let index = 0; index < 10000; index++) {
      const candidate = path.join(directory, index ? `${parsed.name} (${index})${parsed.ext}` : filename);
      await beforePublish({ filePath: candidate, filename: path.basename(candidate), sizeBytes: stat.size, mtimeMs: stat.mtimeMs });
      try {
        // The journal records this exact inode's size and mtime before the atomic link.
        // A crash on either side can safely reuse it or retry without duplicating audio.
        await fs.promises.link(temporary, candidate);
        return candidate;
      } catch (error) {
        if (error.code === "EEXIST") continue;
        if (["ENOTSUP", "EOPNOTSUPP", "EPERM", "ENOSYS"].includes(error.code)) {
          // FAT/exFAT cannot hard-link. Reserve exclusively, then checkpoint ownership
          // before copying, so restart recovery can distinguish our partial file.
          let output;
          try { output = await fs.promises.open(candidate, "wx"); }
          catch (reserveError) { if (reserveError.code === "EEXIST") continue; throw reserveError; }
          let complete = false;
          const hash = crypto.createHash("sha256");
          try {
            for await (const chunk of fs.createReadStream(temporary)) hash.update(chunk);
            const sha256 = hash.digest("hex");
            const owned = await output.stat();
            const identity = { filePath: candidate, filename: path.basename(candidate), sizeBytes: stat.size, mtimeMs: stat.mtimeMs, sha256,
              pendingOutput: { ino: owned.ino, dev: owned.dev, birthtimeMs: owned.birthtimeMs } };
            await beforePublish(identity);
            for await (const chunk of fs.createReadStream(temporary)) {
              let offset = 0;
              while (offset < chunk.length) {
                const { bytesWritten } = await output.write(chunk, offset, chunk.length - offset);
                if (!bytesWritten) throw new Error("Could not write downloaded audio");
                offset += bytesWritten;
              }
            }
            await output.sync();
            const finished = await output.stat();
            await beforePublish({ ...identity, mtimeMs: finished.mtimeMs, pendingOutput: null });
            complete = true;
            return candidate;
          } finally {
            await output.close();
            if (!complete) await fs.promises.unlink(candidate).catch(() => {});
          }
        }
        throw error;
      }
    }
    throw new Error("Too many files share this download name");
  } finally {
    if (created) await fs.promises.unlink(temporary).catch(error => { if (error.code !== "ENOENT") console.warn("[localtify download publication cleanup]", error.message); });
  }
}

function publicationTemporaryPath(directory, id) {
  if (!path.isAbsolute(directory) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw new Error("Invalid publication identity");
  return path.join(directory, `.localtify-publish-${id}.tmp`);
}

module.exports = { publishDownloadedFile, publicationTemporaryPath };
