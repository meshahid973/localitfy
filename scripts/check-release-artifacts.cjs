"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { version } = require("../package.json");

function isReleaseArtifact(filename, releaseVersion, platform) {
  if (platform === "win32") return filename === "localtify-setup-" + releaseVersion + ".exe";
  if (platform === "linux") return filename.startsWith("localtify-" + releaseVersion + "-") && filename.endsWith(".AppImage");
  return false;
}

function verifyReleaseArtifact(root = path.resolve(__dirname, "..")) {
  assert.match(version, /^\d+\.\d+\.\d+$/, "Stable release version expected");
  const output = path.join(root, "release");
  assert.ok(fs.existsSync(output), "Missing release output directory");
  const files = fs.readdirSync(output).filter((name) => isReleaseArtifact(name, version, process.platform));
  assert.equal(files.length, 1, "Expected exactly one " + process.platform + " installer for " + version);
  const file = path.join(output, files[0]);
  const bytes = fs.statSync(file).size;
  assert.ok(bytes > 10_000_000, "Installer is unexpectedly small: " + bytes + " bytes");
  console.log("[release-artifact] verified " + files[0] + " (" + bytes + " bytes)");
}

if (require.main === module) verifyReleaseArtifact();

module.exports = { isReleaseArtifact, verifyReleaseArtifact };
