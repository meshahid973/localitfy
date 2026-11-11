import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { isReleaseArtifact } = require("../../scripts/check-release-artifacts.cjs");

test("release artifact validator rejects old or mismatched installers", () => {
  assert.equal(isReleaseArtifact("localtify-setup-0.5.0.exe", "0.5.0", "win32"), true);
  assert.equal(isReleaseArtifact("localtify-setup-0.4.1.exe", "0.5.0", "win32"), false);
  assert.equal(isReleaseArtifact("localtify-0.5.0-x64.AppImage", "0.5.0", "linux"), true);
  assert.equal(isReleaseArtifact("localtify-0.5.0-x86_64.AppImage", "0.5.0", "linux"), true);
  assert.equal(isReleaseArtifact("localtify-0.4.1-x64.AppImage", "0.5.0", "linux"), false);
  assert.equal(isReleaseArtifact("localtify-setup-0.5.0.exe", "0.5.0", "linux"), false);
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.match(pkg.scripts.dist, /--publish never$/);
});
