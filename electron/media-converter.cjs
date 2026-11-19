"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, execFile } = require("node:child_process");
const sanitize = require("sanitize-filename");
const { publishDownloadedFile, publicationTemporaryPath, cleanPartialPublication } = require("./download-publication.cjs");

const CONVERSION = /^conversion-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;

function createMediaConverter({ workRoot, getFfmpegPath, processes, isCancelled, reportProgress }) {
  if (!path.isAbsolute(workRoot || "")) throw new Error("Conversion storage must be absolute");
  fs.mkdirSync(workRoot, { recursive: true });

  function removeWork(directory) {
    if (path.dirname(path.resolve(directory)) !== path.resolve(workRoot) || !CONVERSION.test(path.basename(directory)) ||
        fs.lstatSync(directory).isSymbolicLink() || path.dirname(fs.realpathSync(directory)) !== fs.realpathSync(workRoot)) throw new Error("Unsafe conversion work directory");
    fs.rmSync(directory, { recursive: true, force: true });
  }
  function writeIntent(directory, intent) {
    const temporary = path.join(directory, "intent.tmp");
    const descriptor = fs.openSync(temporary, "wx", 0o600);
    try { fs.writeFileSync(descriptor, JSON.stringify(intent)); fs.fsyncSync(descriptor); }
    finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, path.join(directory, "intent.json"));
  }
  function cleanIntent(directory, intent) {
    if (intent?.version !== 1 || `conversion-${intent.id}` !== path.basename(directory) || !path.isAbsolute(intent.directory || "")) throw new Error("Invalid conversion recovery record");
    cleanPartialPublication({ ...intent, request: { folder: intent.directory } });
    fs.rmSync(publicationTemporaryPath(intent.directory, intent.id), { force: true });
    removeWork(directory);
  }
  for (const entry of fs.readdirSync(workRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !CONVERSION.test(entry.name)) continue;
    const directory = path.join(workRoot, entry.name);
    try {
      const filename = path.join(directory, "intent.json");
      if (!fs.existsSync(filename)) { removeWork(directory); continue; }
      if (fs.statSync(filename).size > 256 * 1024) throw new Error("Conversion recovery record exceeds its size limit");
      cleanIntent(directory, JSON.parse(fs.readFileSync(filename, "utf8")));
    } catch (error) { console.warn("[localtify conversion recovery]", error.message); }
  }

  function duration(input, ffmpeg) {
    return new Promise(resolve => {
      let child;
      child = execFile(ffmpeg, ["-hide_banner", "-nostdin", "-i", input],
        { windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024 }, (_error, stdout, stderr) => {
          processes.delete(child);
          const match = `${stdout || ""}\n${stderr || ""}`.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
          resolve(match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0);
        });
      processes.add(child);
    });
  }

  async function convert(inputPath, outputDirectory, bitrate = 192, onProgress) {
    let directory, intent;
    try {
      const ffmpeg = getFfmpegPath();
      if (!ffmpeg || !fs.existsSync(ffmpeg)) throw new Error("FFmpeg is unavailable");
      if (!path.isAbsolute(inputPath || "") || !fs.statSync(inputPath).isFile()) throw new Error("Source audio or video was not found");
      if (!path.isAbsolute(outputDirectory || "")) throw new Error("Conversion output folder must be absolute");
      if (isCancelled()) throw new Error("Conversion cancelled");
      const original = fs.statSync(inputPath);
      fs.mkdirSync(outputDirectory, { recursive: true });
      const id = crypto.randomUUID();
      directory = path.join(workRoot, `conversion-${id}`);
      fs.mkdirSync(directory);
      intent = { version: 1, id, directory: outputDirectory };
      writeIntent(directory, intent);
      const output = path.join(directory, "audio.mp3");
      const title = sanitize(path.parse(inputPath).name).slice(0, 150) || "audio";
      const progress = (percent, message) => reportProgress(onProgress, { type: "convert", file: title, progress: percent, speed: null, message });
      progress(0, "Reading media...");
      const seconds = await duration(inputPath, ffmpeg);
      if (isCancelled()) throw new Error("Conversion cancelled");
      const safeBitrate = Math.max(64, Math.min(320, Math.round(Number(bitrate) || 192)));
      await new Promise((resolve, reject) => {
        let diagnostic = "", previous = -1;
        const child = spawn(ffmpeg, ["-hide_banner", "-nostdin", "-n", "-i", inputPath, "-vn", "-c:a", "libmp3lame", "-b:a", `${safeBitrate}k`, "-threads", "0", output],
          { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
        processes.add(child);
        child.stderr?.on("data", chunk => {
          diagnostic = (diagnostic + chunk.toString()).slice(-8192);
          if (!seconds) return;
          const matches = [...diagnostic.matchAll(/time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
          const match = matches.at(-1);
          if (!match) return;
          const elapsed = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
          const percent = Math.max(0, Math.min(99, Math.floor(elapsed / seconds * 100)));
          if (percent !== previous) { previous = percent; progress(percent, `Converting... ${percent}%`); }
        });
        child.once("error", error => { processes.delete(child); reject(error); });
        child.once("close", code => {
          processes.delete(child);
          if (isCancelled()) reject(new Error("Conversion cancelled"));
          else if (code !== 0) reject(new Error(`FFmpeg failed (${code}): ${diagnostic.trim().split(/\r?\n/).at(-1) || "Could not decode this file"}`));
          else resolve();
        });
      });
      const current = fs.statSync(inputPath);
      if (current.size !== original.size || current.mtimeMs !== original.mtimeMs) throw new Error("Source file changed during conversion. Choose it again when it has finished updating.");
      const filePath = await publishDownloadedFile(output, outputDirectory, `${title}.mp3`, identity => {
        if (isCancelled()) throw new Error("Conversion cancelled");
        intent = { ...intent, ...identity, result: { filePath: identity.filePath } };
        writeIntent(directory, intent);
      }, id);
      progress(100, "Conversion complete");
      return { ok: true, sourcePath: inputPath, filePath, filename: path.basename(filePath) };
    } catch (error) { return { ok: false, sourcePath: inputPath, error: error?.message || "Conversion failed" }; }
    finally {
      if (directory) {
        try { intent ? cleanIntent(directory, intent) : removeWork(directory); }
        catch (error) { console.warn("[localtify conversion cleanup]", error.message); }
      }
    }
  }
  return { convert };
}

module.exports = { createMediaConverter };
