"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const crate = path.join(root, "native", "rust-kernels");
const cargoArgs = ["build", "--manifest-path", path.join(crate, "Cargo.toml"), "--release"];
const target = process.env.CARGO_BUILD_TARGET || "";
if (target) cargoArgs.push("--target", target);
console.log("[localtify rust] cargo " + cargoArgs.join(" "));
const result = spawnSync("cargo", cargoArgs, { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const targetDir = process.env.CARGO_TARGET_DIR
  ? path.resolve(root, process.env.CARGO_TARGET_DIR)
  : path.join(crate, "target");
const libName = process.platform === "win32" ? "localtify_rust_kernels.dll" :
  process.platform === "darwin" ? "liblocaltify_rust_kernels.dylib" : "liblocaltify_rust_kernels.so";
const source = path.join(targetDir, ...(target ? [target] : []), "release", libName);
const outputDir = path.join(root, "electron", "native");
const filename = "localtify_rust_kernels." + process.platform + "." + process.arch + ".node";
fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(source, path.join(outputDir, filename));
const native = require(path.join(outputDir, filename));
const resultVector = native.dotMatrix(new Float64Array([2,3]), new Float64Array([4,5]), 2);
if (!Array.isArray(resultVector) || resultVector[0] !== 23) throw new Error("Native Node-API smoke failed");
console.log("[localtify rust] built and loaded " + filename);
