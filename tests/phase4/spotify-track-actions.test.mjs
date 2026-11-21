import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const view = fs.readFileSync("src/features/downloads/DownloadsView.tsx", "utf8");
const css = fs.readFileSync("src/features/downloads/downloads.css", "utf8");

test("Spotify selection and retry remain separate native controls without nested buttons", () => {
  const parsed = ts.createSourceFile("DownloadsView.tsx", view, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nestedButtons = [];
  function visit(node, inButton = false) {
    if (ts.isJsxElement(node)) {
      const isButton = node.openingElement.tagName.getText(parsed) === "button";
      if (isButton && inButton) nestedButtons.push(parsed.getLineAndCharacterOfPosition(node.pos).line + 1);
      for (const child of node.children) visit(child, inButton || isButton);
    } else if (ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(parsed) === "button" && inButton)
        nestedButtons.push(parsed.getLineAndCharacterOfPosition(node.pos).line + 1);
    } else ts.forEachChild(node, (child) => visit(child, inButton));
  }
  visit(parsed);
  assert.deepEqual(nestedButtons, [], "Nested buttons invalidate the DOM and interfere with keyboard focus");

  const start = view.indexOf('className="downloadsPreviewItems"');
  const end = view.indexOf("</TabsContent>", start);
  assert.ok(start > 0 && end > start, "Spotify track list must remain present");
  const rows = view.slice(start, end);
  assert.match(rows, /className="downloadsPreviewSelect"/);
  assert.match(rows, /aria-pressed=\{selected\}/);
  assert.match(rows, /disabled=\{spotifyDownloadBusy\}/);
  assert.match(rows, /retrySpotifyTrack\(track\)/);
  assert.doesNotMatch(rows, /role="button"/);
});

test("Spotify selection and retry preserve focus, narrow layout and disabled actions", () => {
  assert.match(css, /\.downloadsPreviewSelect\s*\{/);
  assert.match(css, /\.downloadsRowAction\s*\{/);
  assert.match(css, /:is\(button,input,textarea\):focus-visible/);
  assert.match(css, /\.downloadsPreviewCopy\s*\{[^}]*min-width: 0/);
  assert.match(css, /@media \(max-width: 460px\)/);
  assert.match(view, /disabled=\{spotifyDownloadBusy\}/);
});
