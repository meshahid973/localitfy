"use strict";
const path = require("node:path");

// Pure parsing of local album filenames; never rewrite stored file identities.
function cleanAlbumFolderText(value, fallback = "") {
  const text = String(value || "").replace(/[\u0000-\u001f]/g, " ").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, 140);
}
function cleanupAlbumTrackName(value = "") {
  return cleanAlbumFolderText(value).replace(/^\s*(?:cd|disc)?\s*\d{1,2}\s*[-_. ]+\s*/i, "").replace(/^\s*\d{1,3}\s*[-_. ]+\s*/i, "").replace(/^\s*\d{1,2}-\d{1,3}\s*[-_. ]+\s*/i, "").trim();
}
function parseAlbumTrackFileName(filePath, fallbackAlbumTitle = "local album") {
  const parsed = path.parse(String(filePath || ""));
  const rawName = cleanupAlbumTrackName(parsed.name || "track");
  const parts = rawName.split(" - ").map((item) => cleanAlbumFolderText(item)).filter(Boolean);
  let artist = "unknown artist";
  let title = rawName || parsed.name || "track";
  if (parts.length >= 2) { artist = parts[0] || artist; title = parts.slice(1).join(" - ") || title; }
  return { title: cleanAlbumFolderText(title, parsed.name || "track"), artist: cleanAlbumFolderText(artist, "unknown artist"), album: cleanAlbumFolderText(fallbackAlbumTitle, "local album") };
}
function albumTrackNumberFromFileName(filePath, index = 0) {
  const name = path.parse(String(filePath || "")).name;
  const match = name.match(/^\s*(?:cd|disc)?\s*(\d{1,2})?\s*[-_. ]?\s*(\d{1,3})\b/i) || name.match(/^\s*(\d{1,3})\b/);
  const value = Number(match?.[2] || match?.[1] || 0);
  return Number.isFinite(value) && value > 0 ? value : index + 1;
}

module.exports = { cleanAlbumFolderText, cleanupAlbumTrackName, parseAlbumTrackFileName, albumTrackNumberFromFileName };
