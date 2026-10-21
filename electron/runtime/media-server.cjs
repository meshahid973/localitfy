const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { MEDIA_PROTOCOL } = require("./protocols.cjs");

const MEDIA_PROTOCOL_HOST = "file";
const MEDIA_SERVER_HOST = "127.0.0.1";
const MEDIA_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
// A large local library can need a full-size and thumbnail token per track.
// Keep enough live tokens for sizeable collections so early covers are not
// evicted while the initial library payload is still being shaped.
const MEDIA_TOKEN_MAX_ENTRIES = 20000;
const MEDIA_TOKEN_PRUNE_INTERVAL_MS = 60 * 1000;
const MEDIA_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".opus", ".aiff", ".aif", ".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function parseMediaByteRange(rawHeader, total) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rawHeader || "").trim());
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(total) || total <= 0) return null;

  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, total - suffix), end: total - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : total - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= total || start > requestedEnd) return null;
  return { start, end: Math.min(requestedEnd, total - 1) };
}


function createMediaServerRuntime({ protocol, net, getFileInfoCached, fileExists, now = Date.now }) {
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
  let nextTokenPruneAt = 0;

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
    if (ext === ".ogg" || ext === ".opus") return "audio/ogg";
    if (ext === ".flac") return "audio/flac";
    if (ext === ".m4a" || ext === ".aac") return "audio/mp4";
    if (ext === ".aiff" || ext === ".aif") return "audio/aiff";
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    return "application/octet-stream";
  }

  function isAllowedMediaFile(filePath) {
    return Boolean(filePath && path.isAbsolute(filePath) &&
      MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase()));
  }

  function addCorsHeaders(res) {
    // Bearer tokens protect loopback media. Allow the renderer's separate dev/
    // packaged origin to read it, including range and error responses.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
  }

  function addMediaResponseHeaders(res, filePath) {
    addCorsHeaders(res);
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
    nextTokenPruneAt = 0;
  }

  function dropToken(token, entry = mediaTokenToPath.get(token)) {
    mediaTokenToPath.delete(token);
    if (entry?.pathKey && mediaPathKeyToToken.get(entry.pathKey) === token) {
      mediaPathKeyToToken.delete(entry.pathKey);
    }
  }

  function touchToken(token, entry, timestamp) {
    entry.expiresAt = timestamp + MEDIA_TOKEN_TTL_MS;
    // Keep frequently used URLs alive when capacity-based eviction is necessary.
    mediaTokenToPath.delete(token);
    mediaTokenToPath.set(token, entry);
  }

  function pruneMediaTokens(timestamp) {
    if (timestamp >= nextTokenPruneAt) {
      for (const [token, entry] of mediaTokenToPath) {
        if (!entry || entry.expiresAt <= timestamp) dropToken(token, entry);
      }
      nextTokenPruneAt = timestamp + MEDIA_TOKEN_PRUNE_INTERVAL_MS;
    }
    // Removing the oldest entry is O(1), even for 20k+ registered URLs.
    while (mediaTokenToPath.size > MEDIA_TOKEN_MAX_ENTRIES) {
      const oldestToken = mediaTokenToPath.keys().next().value;
      if (!oldestToken) break;
      dropToken(oldestToken);
    }
  }

  function createMediaToken(filePath) {
    const cleanPath = String(filePath || "");
    if (!isAllowedMediaFile(cleanPath)) return null;

    const timestamp = now();
    // The backing resource must exist and be a regular audio/image file.
    const versionInfo = getMediaFileVersion(cleanPath);
    if (versionInfo.version === "missing") return null;
    const pathKey = cleanPath + "|" + versionInfo.version;
    const existingToken = mediaPathKeyToToken.get(pathKey);
    const existingEntry = existingToken ? mediaTokenToPath.get(existingToken) : null;

    if (existingToken && existingEntry && existingEntry.expiresAt > timestamp) {
      touchToken(existingToken, existingEntry, timestamp);
      pruneMediaTokens(timestamp);
      return { token: existingToken, ...versionInfo };
    }
    if (existingToken) dropToken(existingToken, existingEntry);

    const token = crypto.randomBytes(18).toString("base64url");
    mediaTokenToPath.set(token, { filePath: cleanPath, pathKey, expiresAt: timestamp + MEDIA_TOKEN_TTL_MS });
    mediaPathKeyToToken.set(pathKey, token);
    pruneMediaTokens(timestamp);
    return { token, ...versionInfo };
  }

  function resolveMediaToken(token) {
    const cleanToken = String(token || "").trim();
    const entry = mediaTokenToPath.get(cleanToken);
    if (!entry) return null;
    const timestamp = now();
    if (entry.expiresAt <= timestamp) {
      dropToken(cleanToken, entry);
      return null;
    }
    if (!isAllowedMediaFile(entry.filePath)) {
      dropToken(cleanToken, entry);
      return null;
    }
    touchToken(cleanToken, entry, timestamp);
    return entry.filePath;
  }

  function sendMediaFile(req, res, filePath) {
    addCorsHeaders(res);
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
      const range = parseMediaByteRange(rangeHeader, total);
      if (!range) {
        res.writeHead(416, { "Content-Range": "bytes */" + total });
        res.end();
        return;
      }
      res.writeHead(206, {
        "Content-Range": "bytes " + range.start + "-" + range.end + "/" + total,
        "Content-Length": range.end - range.start + 1
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(filePath, range).on("error", () => res.destroy()).pipe(res);
      return;
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
        addCorsHeaders(res);
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
        // The renderer may only use opaque tokens minted for a real media file.
        if (parsed.hostname !== MEDIA_PROTOCOL_HOST || !/^\/[A-Za-z0-9_-]{24}$/.test(parsed.pathname) ||
            parsed.search || parsed.hash) return safeTextResponse("invalid media token", 404);
        const filePath = resolveMediaToken(parsed.pathname.slice(1));
        if (!filePath || !fileExists(filePath)) return safeTextResponse("media token expired or not found", 404);
        const info = getFileInfoCached(filePath);
        if (!info.exists || !info.isFile) return safeTextResponse("media file not found", 404);
        return net.fetch(pathToFileURL(filePath).toString());
      } catch (error) {
        console.log("[localtify media protocol error]", error?.message || error);
        return safeTextResponse("media protocol failed", 500);
      }
    });
  }

  function safeMediaUrl(filePath) {
    const tokenInfo = createMediaToken(filePath);
    if (!tokenInfo) return "";
    if (!mediaServerPort) return MEDIA_PROTOCOL + "://" + MEDIA_PROTOCOL_HOST + "/" + tokenInfo.token;
    return "http://" + MEDIA_SERVER_HOST + ":" + mediaServerPort + "/media/" +
      encodeURIComponent(tokenInfo.token) + "?t=" + mediaServerToken + "&v=" + encodeURIComponent(tokenInfo.version);
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
  MEDIA_TOKEN_MAX_ENTRIES,
  MEDIA_TOKEN_TTL_MS,
  parseMediaByteRange,
  createMediaServerRuntime
};
