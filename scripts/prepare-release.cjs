"use strict";

const fs = require("node:fs");
const path = require("node:path");

const NATIVE_FILENAME = /^localtify_rust_kernels\.(?:win32|linux|darwin)\.(?:x64|arm64)\.node$/;

function prepareRelease(root, includeRust = false) {
  fs.rmSync(path.join(root, "release"), { recursive: true, force: true });
  const nativeDirectory = path.join(root, "electron", "native");
  if (includeRust || !fs.existsSync(nativeDirectory)) return;

  for (const filename of fs.readdirSync(nativeDirectory)) {
    if (!NATIVE_FILENAME.test(filename)) continue;
    fs.rmSync(path.join(nativeDirectory, filename));
  }
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const includeRust = process.env.LOCALTIFY_INCLUDE_RUST_ADDON === "1";
  prepareRelease(root, includeRust);
  console.log("[localtify release] clean output; optional Rust addon " +
    (includeRust ? "retained for explicit native package" : "excluded from standard package"));
}

module.exports = { prepareRelease };
