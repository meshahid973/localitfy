const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { MEDIA_PROTOCOL } = require("./protocols.cjs");

const MEDIA_PROTOCOL_HOST = "file";
const MEDIA_SERVER_HOST = "127.0.0.1";
const MEDIA_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MEDIA_TOKEN_MAX_ENTRIES = 2500;

function createMediaServerRuntime({ protocol, net, getFileInfoCached, fileExists }) {
  if (!protocol || !net) throw new Error("media server runtime requires Electron protocol and net");
  if (typeof getFileInfoCached !== "function" || typeof fileExists !== "function") {
    throw new Error("media server runtime requires file info helpers");
  }

  const mediaServerToken = crypto.randomBytes(18).toString("hex");
  const mediaTokenToPath = new Map();
  const mediaPathKeyToToken = new Map();
  let mediaServer = null;
  let mediaServerPort = 0;
  let mediaServerReadyPromise = null;

  function encodeMediaFilePath(filePath) {
    return Buffer.from(String(filePath || ""), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function decodeMediaFilePath(encodedPath) {
    const raw = String(encodedPath || "").trim();
    if (!raw) return "";
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf8");
  }

  function safeTextResponse(message, status = 404) {
    return new Response(String(message || "not found"), {
      status,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  function contentTypeForFile(filePath) {
    const ext = path.extname(String(filePath || "")).toLowerCase();
    if (ext === ".mp3") return "audio/mpeg";
    if (ext === ".wav") return "audio/wav";
    if (ext === ".ogg") return "audio/ogg";
    if (ext === ".flac") return "audio/flac";
    if (ext === ".m4a" || ext === ".aac") return "audio/mp4";
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    if (ext === ".html") return "text/html; charset=utf-8";
    if (ext === ".js") return "text/javascript; charset=utf-8";
    if (ext === ".css") return "text/css; charset=utf-8";
    if (ext === ".json") return "application/json; charset=utf-8";
    return "application/octet-stream";
  }

  function addMediaResponseHeaders(res, filePath) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", contentTypeForFile(filePath));
  }

  function getMediaFileVersion(filePath) {
    const info = getFileInfoCached(filePath);
    if (!info.exists || !info.isFile) return { version: "missing", sizeBytes: 0, mtimeMs: 0 };
    return { version: `${Math.floor(info.mtimeMs)}-${info.size}`, sizeBytes: info.size, mtimeMs: info.mtimeMs };
  }

  function clearTokens() {
    mediaTokenToPath.clear();
    mediaPathKeyToToken.clear();
  }

  function pruneMediaTokens(now = Date.now()) {
    for (const [token, entry] of mediaTokenToPath) {
      if (!entry || entry.expiresAt <= now) {
        mediaTokenToPath.delete(token);
        if (entry?.pathKey) mediaPathKeyToToken.delete(entry.pathKey);
      }
    }

    if (mediaTokenToPath.size <= MEDIA_TOKEN_MAX_ENTRIES) return;
    const overflow = mediaTokenToPath.size - MEDIA_TOKEN_MAX_ENTRIES;
    let removed = 0;
    for (const [token, entry] of mediaTokenToPath) {
      mediaTokenToPath.delete(token);
      if (entry?.pathKey) mediaPathKeyToToken.delete(entry.pathKey);
      removed += 1;
      if (removed >= overflow) break;
    }
  }

  function createMediaToken(filePath) {
    const cleanPath = String(filePath || "");
    if (!cleanPath || !path.isAbsolute(cleanPath)) return null;

    const now = Date.now();
    pruneMediaTokens(now);
    const versionInfo = getMediaFileVersion(cleanPath);
    const pathKey = `${cleanPath}|${versionInfo.version}`;
    const existingToken = mediaPathKeyToToken.get(pathKey);
    const existingEntry = existingToken ? mediaTokenToPath.get(existingToken) : null;

    if (existingToken && existingEntry && existingEntry.expiresAt > now) {
      existingEntry.expiresAt = now + MEDIA_TOKEN_TTL_MS;
      return { token: existingToken, ...versionInfo };
    }

    if (existingToken) {
      mediaTokenToPath.delete(existingToken);
      mediaPathKeyToToken.delete(pathKey);
    }

    const token = crypto.randomBytes(18).toString("base64url");
    mediaTokenToPath.set(token, { filePath: cleanPath, pathKey, expiresAt: now + MEDIA_TOKEN_TTL_MS, ...versionInfo });
    mediaPathKeyToToken.set(pathKey, token);
    return { token, ...versionInfo };
  }

  function resolveMediaToken(token) {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) return null;
    const entry = mediaTokenToPath.get(cleanToken);
    if (!entry) return null;
    const now = Date.now();
    if (entry.expiresAt <= now) {
      mediaTokenToPath.delete(cleanToken);
      if (entry.pathKey) mediaPathKeyToToken.delete(entry.pathKey);
      return null;
    }
    entry.expiresAt = now + MEDIA_TOKEN_TTL_MS;
    return entry.filePath;
  }

  function sendMediaFile(req, res, filePath) {
    if (!filePath || !path.isAbsolute(filePath) || !fileExists(filePath)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("media file not found");
      return;
    }

    const stat = getFileInfoCached(filePath);
    if (!stat.exists || !stat.isFile) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("media file not found");
      return;
    }

    addMediaResponseHeaders(res, filePath);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      res.end("method not allowed");
      return;
    }

    const total = stat.size;
    const rangeHeader = String(req.headers.range || "");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        let start = match[1] ? Number(match[1]) : 0;
        let end = match[2] ? Number(match[2]) : total - 1;
        if (!Number.isFinite(start) || start < 0) start = 0;
        if (!Number.isFinite(end) || end >= total) end = total - 1;
        if (start > end || start >= total) {
          res.writeHead(416, { "Content-Range": `bytes */${total}` });
          res.end();
          return;
        }
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": end - start + 1
        });
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        fs.createReadStream(filePath, { start, end }).on("error", () => res.destroy()).pipe(res);
        return;
      }
    }

    res.writeHead(200, { "Content-Length": total });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath).on("error", () => res.destroy()).pipe(res);
  }

  function start() {
    if (mediaServerReadyPromise) return mediaServerReadyPromise;

    mediaServerReadyPromise = new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        try {
          const requestUrl = new URL(req.url || "/", `http://${MEDIA_SERVER_HOST}`);
          if (requestUrl.searchParams.get("t") !== mediaServerToken) {
            res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
            res.end("media access denied");
            return;
          }
          const token = decodeURIComponent(requestUrl.pathname.replace(/^\/media\/?/, "").replace(/^\/+/, "").split("/")[0] || "");
          const filePath = resolveMediaToken(token);
          if (!filePath) {
            res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            res.end("media token expired or not found");
            return;
          }
          sendMediaFile(req, res, filePath);
        } catch (error) {
          console.log("[localtify media server request error]", error?.message || error);
          res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
          res.end("media server failed");
        }
      });

      server.once("error", (error) => {
        console.log("[localtify media server error]", error?.message || error);
        mediaServer = null;
        mediaServerPort = 0;
        mediaServerReadyPromise = null;
        resolve(false);
      });

      server.listen(0, MEDIA_SERVER_HOST, () => {
        mediaServer = server;
        const address = server.address();
        mediaServerPort = typeof address === "object" && address ? address.port : 0;
        console.log(`[localtify media server] http://${MEDIA_SERVER_HOST}:${mediaServerPort}`);
        resolve(true);
      });
    });

    return mediaServerReadyPromise;
  }

  function stop() {
    if (!mediaServer) {
      mediaServerReadyPromise = null;
      mediaServerPort = 0;
      return;
    }
    const server = mediaServer;
    mediaServer = null;
    mediaServerPort = 0;
    mediaServerReadyPromise = null;
    server.close(() => undefined);
  }

  function registerProtocol() {
    if (protocol.__localtifyMediaProtocolReady) return;
    protocol.__localtifyMediaProtocolReady = true;

    protocol.handle(MEDIA_PROTOCOL, async (request) => {
      try {
        const parsed = new URL(request.url);
        const encodedPath = parsed.hostname === MEDIA_PROTOCOL_HOST
          ? parsed.pathname.replace(/^\/+/, "")
          : `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, "");
        const filePath = decodeMediaFilePath(encodedPath);
        if (!filePath || !path.isAbsolute(filePath)) return safeTextResponse("invalid media path", 400);
        if (!fileExists(filePath)) return safeTextResponse("media file not found", 404);
        return net.fetch(pathToFileURL(filePath).toString());
      } catch (error) {
        console.log("[localtify media protocol error]", error?.message || error);
        return safeTextResponse("media protocol failed", 500);
      }
    });
  }

  function safeProtocolMediaUrl(filePath) {
    if (!filePath) return "";
    try {
      return `${MEDIA_PROTOCOL}://${MEDIA_PROTOCOL_HOST}/${encodeMediaFilePath(filePath)}`;
    } catch {
      return "";
    }
  }

  function safeMediaUrl(filePath) {
    if (!filePath) return "";
    const cleanPath = String(filePath);
    if (!mediaServerPort) return safeProtocolMediaUrl(cleanPath);
    const tokenInfo = createMediaToken(cleanPath);
    if (!tokenInfo?.token) return safeProtocolMediaUrl(cleanPath);
    return `http://${MEDIA_SERVER_HOST}:${mediaServerPort}/media/${encodeURIComponent(tokenInfo.token)}?t=${mediaServerToken}&v=${encodeURIComponent(tokenInfo.version)}`;
  }

  return {
    tokenTtlMs: MEDIA_TOKEN_TTL_MS,
    start,
    stop,
    registerProtocol,
    safeMediaUrl,
    getMediaFileVersion,
    clearTokens,
    getPort: () => mediaServerPort
  };
}

module.exports = {
  MEDIA_TOKEN_TTL_MS,
  createMediaServerRuntime
};
