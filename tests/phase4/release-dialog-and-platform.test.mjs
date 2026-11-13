import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("settings platform fallback reuses the app-wide platform detection", () => {
  const source = read("src/features/settings/settings.shared.tsx");
  assert.match(source, /PlatformInfoLike = Partial<LocaltifyPlatformInfo>/);
  assert.match(source, /return getLocaltifyPlatformInfo\(\)/);
  assert.doesNotMatch(source, /const userAgent =/);
});

test("What's New dialog traps focus and closes on Escape only when topmost", () => {
  const modal = read("src/features/updates/WhatsNewModal.tsx");
  assert.match(modal, /useModalFocus<HTMLElement>\(open\)/);
  assert.match(modal, /ref=\{dialogRef\} tabIndex=\{-1\}/);
  assert.match(modal, /event\.key !== "Escape"/);
  assert.match(modal, /topmost !== dialogRef\.current/);
  assert.match(modal, /document\.removeEventListener\("keydown", onKeyDown\)/);
});
