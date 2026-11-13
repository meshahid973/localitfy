import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (f) => fs.readFileSync(f, "utf8");

test("busy-paint suppression targets valid CSS pseudo-element selectors", () => {
  const css = read("src/features/shell/effects.css");
  assert.doesNotMatch(css, /:is\([^)]*::(?:before|after)/);
  assert.match(css, /\.app\.localtifyInteractionBusy :is\(\.coverAura, \.homeAlbumArt, \.songArt, \.playerBar\)::before/);
  assert.match(css, /\.app\.localtifyInteractionBusy \.heroAmbiencePulse/);
});

test("queue and history controls use Localtify theme tokens and keyboard focus", () => {
  const queue = read("src/features/player/components/queue-panel.css");
  const history = read("src/features/shell/navigation-history.css");
  assert.match(queue, /border-radius: var\(--lt-radius-md\)/);
  assert.doesNotMatch(queue, /backdrop-filter: blur\(22px\)/);
  assert.match(queue, /\.queuePanelIconButton:focus-visible,[\s\S]*?outline: 2px solid var\(--lt-accent\)/);
  assert.match(history, /background: var\(--lt-surface-raised\)/);
  assert.match(history, /color-mix\(in srgb, var\(--lt-text\) 10%, var\(--lt-surface-raised\)\)/);
});
