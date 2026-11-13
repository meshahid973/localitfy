import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { releaseAssetNames, prepareReleaseAssets } = require("../../scripts/prepare-release-assets.cjs");
const version = "0.5.0";
const hash = file => createHash("sha512").update(fs.readFileSync(file)).digest("base64");

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "localtify-release-assets-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const name of releaseAssetNames(version)) {
    const file = path.join(directory, name);
    const header = name.endsWith(".exe") ? Buffer.from("MZ")
      : name.endsWith(".AppImage") ? Buffer.from([0x7f, 0x45, 0x4c, 0x46])
      : name.endsWith(".deb") ? Buffer.from("!<arch>\n")
      : name.endsWith(".rpm") ? Buffer.from([0xed, 0xab, 0xee, 0xdb])
      : name.endsWith(".apk") ? Buffer.from([0x50, 0x4b, 0x03, 0x04]) : Buffer.alloc(128);
    fs.writeFileSync(file, header);
    if (!name.endsWith(".yml") && !name.endsWith(".blockmap")) fs.truncateSync(file, name.endsWith(".apk") ? 1_000_001 : 10_000_001);
  }
  for (const [manifest, name] of [["latest.yml", `localtify-setup-${version}.exe`], ["latest-linux.yml", `localtify-${version}-x86_64.AppImage`]]) {
    const file = path.join(directory, name);
    const sha512 = hash(file);
    fs.writeFileSync(path.join(directory, manifest), JSON.stringify({ version, files: [{ url: name, sha512, size: fs.statSync(file).size }], path: name, sha512 }));
  }
  return directory;
}

test("complete release assets get reproducible SHA256 checksums", async t => {
  const directory = fixture(t);
  const names = await prepareReleaseAssets(directory, version);
  const checksums = fs.readFileSync(path.join(directory, "SHA256SUMS"), "utf8");
  assert.equal(checksums.trim().split("\n").length, 8);
  const name = names[0];
  assert.ok(checksums.includes(createHash("sha256").update(fs.readFileSync(path.join(directory, name))).digest("hex") + "  " + name));
  await prepareReleaseAssets(directory, version);
  assert.equal(fs.readFileSync(path.join(directory, "SHA256SUMS"), "utf8"), checksums);
});

test("missing Android packages and stale installers cannot be published", async t => {
  const directory = fixture(t);
  fs.renameSync(path.join(directory, `localtify-${version}-android.apk`), path.join(directory, "localtify-0.4.1-android.apk"));
  await assert.rejects(prepareReleaseAssets(directory, version), /exactly the current/);
});

test("incorrect updater hashes are rejected before checksum publication", async t => {
  const directory = fixture(t);
  const manifest = path.join(directory, "latest.yml");
  const data = JSON.parse(fs.readFileSync(manifest, "utf8"));
  data.files[0].sha512 = "incorrect";
  fs.writeFileSync(manifest, JSON.stringify(data));
  await assert.rejects(prepareReleaseAssets(directory, version), /Updater hash mismatch/);
  assert.equal(fs.existsSync(path.join(directory, "SHA256SUMS")), false);
});

test("a renamed non-APK file is rejected", async t => {
  const directory = fixture(t);
  const file = path.join(directory, `localtify-${version}-android.apk`);
  const descriptor = fs.openSync(file, "r+");
  fs.writeSync(descriptor, Buffer.from("FAIL"), 0, 4, 0);
  fs.closeSync(descriptor);
  await assert.rejects(prepareReleaseAssets(directory, version), /Wrong artifact format/);
});

test("prerelease and path-like versions cannot become asset filenames", () => {
  for (const value of ["0.5.0-rc1", "../0.5.0", "v0.5.0"]) assert.throws(() => releaseAssetNames(value), /Stable release version/);
});
