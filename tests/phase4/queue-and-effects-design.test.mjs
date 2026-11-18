import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (f) => fs.readFileSync(f, "utf8");

test("busy-paint suppression targets valid CSS pseudo-element selectors", () => {
  const css = read("src/features/shell/effects.css");
  assert.doesNotMatch(css, /:is\([^)]*::(?:before|after)/);
  assert.doesNotMatch(css, /\.localtifyInteractionBusy|\.coverTargetPanelCleanOnly/);
  assert.doesNotMatch(css, /\.heroAmbiencePulse\b/);
});

test("queue and history controls use Localtify theme tokens and keyboard focus", () => {
  const queue = read("src/features/player/components/queue-panel.css");
  const history = read("src/features/shell/navigation-history.css");
  assert.match(queue, /border-radius: var\(--lt-radius-md\)/);
  assert.doesNotMatch(queue, /backdrop-filter: blur\(22px\)/);
  assert.match(queue, /\.queuePanelIconButton:focus-visible,[\s\S]*?outline: 2px solid var\(--lt-accent\)/);
  assert.match(history, /\.titleHistoryNav \{[^}]*background: transparent/);
  assert.match(history, /\.titleHistoryNav button:focus-visible/);
  assert.match(history, /-webkit-app-region: no-drag/);
  assert.match(history, /background: var\(--lt-fill-hover\)/);
});


test("shell interactions are calm, theme-aware and retain the existing native controls", () => {
  const effects = read("src/features/shell/effects.css");
  const view = read("src/styles/view-shell.css");
  const nav = read("src/features/shell/SidebarNav.tsx");
  assert.doesNotMatch(effects, /@keyframes localtifyNav(?:StrokeDraw|Home|Library|Disc|Playlist|Heart|Covers|Analytics|Download|Settings)V468/);
  assert.match(view, /\.sidebar \.navItem\.active \{[^}]*background: var\(--lt-fill-selected\)/);
  assert.match(view, /\.navText strong \{[\s\S]*?font-size: var\(--lt-text-base\)/);
  assert.match(nav, /title=\{item\.label\}/);
  assert.match(nav, /aria-current=\{view === item\.id \? "page" : undefined\}/);
  const bar = read("src/features/player/player.css");
  assert.match(bar, /\.playerMeta strong\{[^}]*color: var\(--lt-text\)/);
  assert.match(bar, /\.playerMeta p\{[^}]*color: var\(--lt-muted\)/);
});

test("queue uses live player height and keeps desktop and Android trigger semantics aligned", () => {
  const queue = read("src/features/player/components/QueuePanel.tsx");
  const css = read("src/features/player/components/queue-panel.css");
  for (const name of ["PlayerBar", "PhonePlayer"]) {
    const source = read("src/features/player/components/" + name + ".tsx");
    assert.match(source, /data-queue-trigger/);
    assert.match(source, /aria-expanded=\{queuePanelOpen\}/);
    assert.match(source, /aria-controls=\{queuePanelOpen \? "localtify-play-queue" : undefined\}/);
  }
  assert.match(queue, /id="localtify-play-queue" className="queuePanel"/);
  assert.match(queue, /target\.closest\("\[data-queue-trigger\]/);
  assert.match(queue, /openerRef\.current\?\.isConnected/);
  assert.match(css, /bottom: calc\(var\(--player-size-live, var\(--player-size, 108px\)\) \+ 14px\)/);
});
