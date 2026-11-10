import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const view = fs.readFileSync("src/features/downloads/DownloadsView.tsx", "utf8");
const css = fs.readFileSync("src/features/downloads/downloads.css", "utf8");

test("Spotify selection and retry are sibling native buttons, not nested interactive controls", () => {
  const parsed = ts.createSourceFile("DownloadsView.tsx", view, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nestedButtons = [];
  function visit(node, inButton = false) {
    if (ts.isJsxElement(node)) {
      const isButton = node.openingElement.tagName.getText(parsed) === "button";
      if (isButton && inButton) nestedButtons.push(parsed.getLineAndCharacterOfPosition(node.pos).line + 1);
      for (const child of node.children) visit(child, inButton || isButton);
    } else if (ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(parsed) === "button" && inButton) {
        nestedButtons.push(parsed.getLineAndCharacterOfPosition(node.pos).line + 1);
      }
    } else ts.forEachChild(node, (child) => visit(child, inButton));
  }
  visit(parsed);
  assert.deepEqual(nestedButtons, [], "Nested buttons invalidate the DOM and interfere with keyboard focus");
  const start = view.indexOf('className="spotifyTrackItems"');
  const end = view.indexOf('className="downloadActions downloadActionsV031 spotifyDownloadRow"', start);
  assert.ok(start > 0 && end > start, "Spotify track list remains present");
  const rows = view.slice(start, end);
  assert.match(rows, /className="spotifyTrackSelect"/);
  assert.match(rows, /aria-pressed=\{selected\}/);
  assert.match(rows, /className="spotifyRetryButton"/);
  assert.match(rows, /disabled=\{spotifyDownloadBusy \|\| !retrySpotifyTrack\}/);
  assert.doesNotMatch(rows, /role="button"/);
});

test("Spotify retry and selection have consistent keyboard focus and narrow-window columns", () => {
  assert.match(css, /\.spotifyTrackSelect\s*\{/);
  assert.match(css, /\.spotifyRetryButton\s*\{/);
  assert.match(css, /\.app \.downloadsLayoutV031 :is\(\.spotifyTrackSelect, \.spotifyRetryButton\):focus-visible/);
  assert.match(css, /\.spotifyTrackSelect \{ grid-template-columns: 42px minmax\(0, 1fr\) 22px/);
  assert.match(css, /\.spotifyRetryButton:disabled \{ opacity: \.55; cursor: default; \}/);
});
