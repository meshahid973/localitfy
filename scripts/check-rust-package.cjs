"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "release");
const name = `localtify_rust_kernels.${process.platform}.${process.arch}.node`;
const candidates = [];

if (process.platform === "win32" || process.platform === "linux") {
  const folder = process.platform === "win32" ? "win-unpacked" : "linux-unpacked";
  candidates.push(path.join(root, folder, "resources", "app.asar.unpacked", "electron", "native", name));
} else {
  function visit(directory, depth = 0) {
    if (depth > 4 || !fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(directory, entry.name);
      if (entry.name.endsWith(".app")) {
        candidates.push(path.join(full, "Contents", "Resources", "app.asar.unpacked", "electron", "native", name));
      } else {
        visit(full, depth + 1);
      }
    }
  }
  visit(root);
}

const present = candidates.filter(file => fs.existsSync(file) && fs.statSync(file).size > 0);
if (!present.length) {
  console.error("[rust-package] Expected unpacked native addon not found", candidates);
  process.exitCode = 1;
} else {
  const binary = present[0];
  try {
    const native = require(binary);
    if (typeof native.pcmSumSquares !== "function" ||
        native.pcmSumSquares(new Float32Array([0.5, -0.5])) !== 0.5 ||
        typeof native.dotMatrixInto !== "function") {
      throw new Error("Native package exports are missing or incompatible");
    }
    const result = new Float64Array(1);
    native.dotMatrixInto(new Float64Array([1, 2]), new Float64Array([3, 4]), result, 2);
    if (result[0] !== 11) throw new Error("Packed matrix result was incorrect");
    console.log("[rust-package] loaded and verified packaged addon:", binary);
  } catch (error) {
    console.error("[rust-package] packaged addon failed to load/execute:", error);
    process.exitCode = 1;
  }
}
