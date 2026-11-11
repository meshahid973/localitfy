import assert from "node:assert/strict";
import test from "node:test";
import { findVersionMismatches } from "../../scripts/check-release-version.mjs";

test("release metadata gate rejects mismatched versions", () => {
  assert.deepEqual(findVersionMismatches("0.5.0", {
    packageLock: "0.5.0", renderer: "0.5.0", discordActivity: "0.5.0"
  }), []);
  assert.match(findVersionMismatches("0.5.0", { renderer: "0.4.1" })[0], /renderer/);
  assert.match(findVersionMismatches("0.5.0-beta", {})[0], /stable semver/);
});
