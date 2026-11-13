import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("modal focus trap preserves an existing autofocus field", () => {
  const hook = fs.readFileSync("src/shared/hooks/useModalFocus.ts", "utf8");
  assert.match(hook, /active instanceof HTMLElement && active !== dialog && contains\(active\)/);
  assert.match(hook, /const onFocusIn = \(event: FocusEvent\)/);
  assert.match(hook, /const topmostModal = \(\)/);
  const prompt = fs.readFileSync("src/features/playlists/components/PromptPlaylistDialog.tsx", "utf8");
  assert.match(prompt, /maxLength=\{300\} autoFocus/);
});
