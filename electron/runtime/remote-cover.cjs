"use strict";
const { safeThumbnail } = require("../discover/youtube-music.cjs");
function safeProviderCover(value) {
  if (typeof value !== "string" || value.length > 2000) return "";
  const yt = safeThumbnail(value);
  if (yt) return yt;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.search || u.hash) return "";
    if (u.hostname === "i.scdn.co" && /^\/image\/[a-f0-9]+$/i.test(u.pathname)) return u.href;
    if (["lastfm.freetls.fastly.net","lastfm-img2.akamaized.net"].includes(u.hostname) && /^\/i\/u\/(?:[0-9]+x[0-9]+|[0-9]+s)\/[a-f0-9]{32}\.(?:png|jpe?g|webp)$/i.test(u.pathname) && !/2a96cbd8b46e442fc41c2b86b821562f|4128a6eb29f94943c9d206c08e625904/i.test(u.pathname)) return u.href;
    if (["www.theaudiodb.com","r2.theaudiodb.com","theaudiodb.com"].includes(u.hostname) && /^\/images\/media\/album\/thumb\/[a-z0-9_-]+\.(?:jpg|jpeg|png)(?:\/(?:small|medium))?$/i.test(u.pathname)) return u.href;
  } catch {}
  return "";
}
function imageExtension(buffer, contentType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (type === "image/jpeg" && buffer.subarray(0,3).equals(Buffer.from("ffd8ff","hex"))) return ".jpg";
  if (type === "image/png" && buffer.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"))) return ".png";
  if (type === "image/webp" && buffer.toString("ascii",0,4)==="RIFF" && buffer.toString("ascii",8,12)==="WEBP") return ".webp";
  if (type === "image/gif" && ["GIF87a","GIF89a"].includes(buffer.toString("ascii",0,6))) return ".gif";
  return "";
}
module.exports = { safeProviderCover, imageExtension };
