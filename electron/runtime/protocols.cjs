const LOCALTIFY_RENDERER_PROTOCOL = "localtify-renderer";
const MEDIA_PROTOCOL = "localtify-media";

const PRIVILEGED_SCHEMES = Object.freeze([
  Object.freeze({
    scheme: LOCALTIFY_RENDERER_PROTOCOL,
    privileges: Object.freeze({
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    })
  }),
  Object.freeze({
    scheme: MEDIA_PROTOCOL,
    privileges: Object.freeze({
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    })
  })
]);

function registerPrivilegedSchemes(protocol) {
  if (!protocol || typeof protocol.registerSchemesAsPrivileged !== "function") {
    throw new TypeError("Electron protocol registrar is required");
  }

  try {
    protocol.registerSchemesAsPrivileged(PRIVILEGED_SCHEMES.map((entry) => ({
      scheme: entry.scheme,
      privileges: { ...entry.privileges }
    })));
    return true;
  } catch (error) {
    console.log("[localtify protocol scheme error]", error?.message || error);
    return false;
  }
}

/** MIME types for packaged renderer assets served by the custom Electron protocol. */
function getLocaltifyRendererMimeType(filePath) {
  const ext = require("node:path").extname(String(filePath || "")).toLowerCase();
  switch (ext) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": case ".mjs": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".ico": return "image/x-icon";
    case ".woff": return "font/woff";
    case ".woff2": return "font/woff2";
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".ogg": return "audio/ogg";
    default: return "application/octet-stream";
  }
}

module.exports = {
  getLocaltifyRendererMimeType,
  LOCALTIFY_RENDERER_PROTOCOL,
  MEDIA_PROTOCOL,
  PRIVILEGED_SCHEMES,
  registerPrivilegedSchemes
};
