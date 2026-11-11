import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { prepareRelease } = require("../../scripts/prepare-release.cjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-release-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const native = path.join(root, "electron", "native");
  fs.mkdirSync(native, { recursive: true });
  fs.mkdirSync(path.join(root, "release"));
  fs.writeFileSync(path.join(root, "release", "old.txt"), "old");
  const addon = path.join(native, "localtify_rust_kernels.win32.x64.node");
  const unrelated = path.join(native, "backend.cjs");
  fs.writeFileSync(addon, "native");
  fs.writeFileSync(unrelated, "keep");
  return { root, addon, unrelated };
}

test("ordinary releases omit old Rust binaries without touching source files", t => {
  const files = fixture(t);
  prepareRelease(files.root);
  assert.equal(fs.existsSync(files.addon), false);
  assert.equal(fs.existsSync(files.unrelated), true);
  assert.equal(fs.existsSync(path.join(files.root, "release")), false);
});

test("explicit native releases retain their addon but clear the old output", t => {
  const files = fixture(t);
  prepareRelease(files.root, true);
  assert.equal(fs.existsSync(files.addon), true);
  assert.equal(fs.existsSync(files.unrelated), true);
  assert.equal(fs.existsSync(path.join(files.root, "release")), false);
});

test("normal and native package scripts use the same guarded preparation", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["clean:release"], "node scripts/prepare-release.cjs");
  assert.match(pkg.scripts["rust:dist"], /package-rust-release/);
  assert.match(pkg.scripts["rust:dist:linux"], /package-rust-release/);
  assert.equal(pkg.build.appId, "com.meshahid973.localitfy");
  assert.equal(pkg.build.productName, "localtify");
});
