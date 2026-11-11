import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { prepareRelease } = require("../../scripts/prepare-release.cjs");
const { validatePackageTarget } = require("../../scripts/package-rust-release.cjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-release-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const native = path.join(root, "electron", "native");
  fs.mkdirSync(native, { recursive: true });
  fs.mkdirSync(path.join(root, "release"));
  fs.writeFileSync(path.join(root, "release", "old.txt"), "old");

  const addon = path.join(native, `localtify_rust_kernels.${process.platform}.${process.arch}.node`);
  const foreignPlatform = process.platform === "win32" ? "linux" : "win32";
  const foreignAddon = path.join(native, `localtify_rust_kernels.${foreignPlatform}.x64.node`);
  const unrelated = path.join(native, "backend.cjs");
  fs.writeFileSync(addon, "native");
  fs.writeFileSync(foreignAddon, "stale");
  fs.writeFileSync(unrelated, "keep");
  return { root, addon, foreignAddon, unrelated };
}

test("ordinary releases remove all old native binaries without touching source", t => {
  const files = fixture(t);
  prepareRelease(files.root);
  assert.equal(fs.existsSync(files.addon), false);
  assert.equal(fs.existsSync(files.foreignAddon), false);
  assert.equal(fs.existsSync(files.unrelated), true);
  assert.equal(fs.existsSync(path.join(files.root, "release")), false);
});

test("native releases keep only the built host addon", t => {
  const files = fixture(t);
  prepareRelease(files.root, true);
  assert.equal(fs.existsSync(files.addon), true);
  assert.equal(fs.existsSync(files.foreignAddon), false);
  assert.equal(fs.existsSync(files.unrelated), true);
  assert.equal(fs.existsSync(path.join(files.root, "release")), false);
});

test("missing native addon cannot destroy an existing release output", t => {
  const files = fixture(t);
  fs.unlinkSync(files.addon);
  assert.throws(() => prepareRelease(files.root, true), /built addon/);
  assert.equal(fs.existsSync(path.join(files.root, "release", "old.txt")), true);
});

test("native package helper rejects cross-OS, ARM64 and Cargo cross-target mismatches", () => {
  assert.equal(validatePackageTarget("win", "win32", "x64", ""), "dist");
  assert.equal(validatePackageTarget("linux", "linux", "x64", ""), "dist:linux");
  assert.throws(() => validatePackageTarget("linux", "win32", "x64", ""), /require/);
  assert.throws(() => validatePackageTarget("win", "linux", "x64", ""), /require/);
  assert.throws(() => validatePackageTarget("linux", "linux", "arm64", ""), /require/);
  assert.throws(() => validatePackageTarget("linux", "linux", "x64", "aarch64-unknown-linux-gnu"), /Cross-compiled/);
  assert.throws(() => validatePackageTarget("mac", "darwin", "arm64", ""), /Specify/);
});

test("normal and native package scripts retain the stable installer identity", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["clean:release"], "node scripts/prepare-release.cjs");
  assert.match(pkg.scripts["rust:dist"], /package-rust-release/);
  assert.match(pkg.scripts["rust:dist:linux"], /package-rust-release/);
  assert.equal(pkg.build.appId, "com.meshahid973.localitfy");
  assert.equal(pkg.build.productName, "localtify");
});
