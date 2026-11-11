import assert from "node:assert/strict";
import test from "node:test";
import { findCssCommentErrors } from "../../scripts/css-comment-integrity.mjs";

test("CSS guard detects nested or unclosed comments", () => {
  assert.deepEqual(findCssCommentErrors(".x { color: red } /* valid */"), []);
  assert.equal(findCssCommentErrors("/* hidden /* accidental */ .x { color: red }")[0].reason, "nested comment hides CSS");
  assert.equal(findCssCommentErrors("/* dangling")[0].reason, "unterminated comment");
  assert.deepEqual(findCssCommentErrors('.x::before { content: "/*"; }'), []);
});
