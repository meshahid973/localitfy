import assert from "node:assert/strict";
import test from "node:test";
import { retiredPerformanceSelectors } from "../../scripts/css-retired-performance.mjs";

test("retired CSS class guard catches variants anywhere in a selector", () => {
  assert.deepEqual(retiredPerformanceSelectors("body.dark.localtifyPerfV301 .player {}"), [".localtifyPerfV301"]);
  assert.deepEqual(retiredPerformanceSelectors(".localtifyPerfV303 .player {}"), [".localtifyPerfV303"]);
  assert.deepEqual(retiredPerformanceSelectors(":is(body.localtifyPerfV319,.localtifyGpuFriendly) .x {}"), [".localtifyPerfV319", ".localtifyGpuFriendly"]);
  assert.deepEqual(retiredPerformanceSelectors(".localtifyPerfV301-next {}"), []);
  assert.deepEqual(retiredPerformanceSelectors("/* .localtifyPerfV301 {} */ .live {}"), []);
});
