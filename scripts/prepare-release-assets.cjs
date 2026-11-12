"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const yaml = require("js-yaml");

function releaseAssetNames(version) {
  assert.match(version, /^\d+\.\d+\.\d+$/, "Stable release version required");
  return [
    `localtify-setup-${version}.exe`, `localtify-setup-${version}.exe.blockmap`, "latest.yml",
    `localtify-${version}-x86_64.AppImage`, `localtify-${version}-amd64.deb`, `localtify-${version}-x86_64.rpm`,
    "latest-linux.yml", `localtify-${version}-android.apk`
  ].sort();
}

async function prepareReleaseAssets(directory, version) {
  const names = releaseAssetNames(version);
  assert.deepEqual(fs.readdirSync(directory).filter(name => name !== "SHA256SUMS").sort(), names,
    "Release must contain exactly the current Windows, Linux, Android and updater assets");
  const digests = new Map();
  for (const name of names) {
    const file = path.join(directory, name);
    assert.ok(fs.lstatSync(file).isFile(), `Not a regular release file: ${name}`);
    const size = fs.statSync(file).size;
    const magic = name.endsWith(".exe") ? Buffer.from("MZ")
      : name.endsWith(".AppImage") ? Buffer.from([0x7f, 0x45, 0x4c, 0x46])
      : name.endsWith(".deb") ? Buffer.from("!<arch>\n")
      : name.endsWith(".rpm") ? Buffer.from([0xed, 0xab, 0xee, 0xdb])
      : name.endsWith(".apk") ? Buffer.from([0x50, 0x4b, 0x03, 0x04]) : null;
    if (magic) {
      assert.ok(size > (name.endsWith(".apk") ? 1_000_000 : 10_000_000), `Artifact is too small: ${name}`);
      const descriptor = fs.openSync(file, "r");
      const header = Buffer.alloc(magic.length);
      try { fs.readSync(descriptor, header, 0, header.length, 0); }
      finally { fs.closeSync(descriptor); }
      assert.deepEqual(header, magic, `Wrong artifact format: ${name}`);
    } else {
      assert.ok(size > 100, `Empty release metadata: ${name}`);
    }
    const sha256 = createHash("sha256"), sha512 = createHash("sha512");
    for await (const chunk of fs.createReadStream(file)) { sha256.update(chunk); sha512.update(chunk); }
    digests.set(name, { sha256: sha256.digest("hex"), sha512: sha512.digest("base64"), size });
  }
  for (const [manifest, artifact] of [
    ["latest.yml", `localtify-setup-${version}.exe`],
    ["latest-linux.yml", `localtify-${version}-x86_64.AppImage`]
  ]) {
    const metadata = yaml.load(fs.readFileSync(path.join(directory, manifest), "utf8"));
    assert.equal(metadata?.version, version, `Wrong updater version: ${manifest}`);
    const entry = metadata.files?.find(item => item.url === artifact);
    assert.ok(entry, `Missing updater target: ${artifact}`);
    assert.equal(entry.sha512, digests.get(artifact).sha512, `Updater hash mismatch: ${artifact}`);
    assert.equal(entry.size, digests.get(artifact).size, `Updater size mismatch: ${artifact}`);
    assert.equal(metadata.path, artifact, `Wrong updater path: ${manifest}`);
    assert.equal(metadata.sha512, entry.sha512, `Wrong legacy updater hash: ${manifest}`);
  }
  fs.writeFileSync(path.join(directory, "SHA256SUMS"), names.map(name => `${digests.get(name).sha256}  ${name}\n`).join(""));
  return names;
}

if (require.main === module) {
  prepareReleaseAssets(path.resolve(process.argv[2] || "release-assets"), require("../package.json").version)
    .then(names => console.log(`[release-assets] verified ${names.length} files and wrote SHA256SUMS`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { releaseAssetNames, prepareReleaseAssets };
