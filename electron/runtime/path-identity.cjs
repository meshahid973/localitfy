"use strict";
const path = require("node:path");

function filePathKey(value, platform = process.platform) {
  if (!value) return "";
  const normalized = (platform === "win32" ? path.win32 : path.posix).normalize(String(value));
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

module.exports = { filePathKey };
