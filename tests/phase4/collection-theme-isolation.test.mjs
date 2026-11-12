import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");

test("collection browsing classes cannot collide with album and artist detail pages", () => {
  const browse = read("src/shared/ui/collection-layout.css");
  const detail = read("src/features/pages/pages.css");
  const artist = read("src/features/artists/ArtistsView.tsx");
  const genre = read("src/features/genres/GenresView.tsx");
  for (const klass of ["collectionBrowsePage", "collectionBrowseGrid", "collectionBrowseCard", "collectionBrowseCardCover"]) {
    assert.match(browse, new RegExp("\\." + klass + "\\b"));
    assert.match(artist + genre, new RegExp("\\b" + klass + "\\b"));
    assert.doesNotMatch(detail, new RegExp("\\." + klass + "\\b"));
  }
  assert.match(detail, /\.collectionPage\s*\{/);
  assert.match(detail, /\.collectionCard\s*\{/);
  assert.doesNotMatch(browse, /\.collectionPage\s*\{|\.collectionCard\s*\{/);
});

test("detail collection surfaces adapt to light themes and touch devices", () => {
  const css = read("src/features/pages/pages.css");
  assert.match(css, /\.collectionHero\s*\{[^}]*background: var\(--lt-surface\);/);
  assert.match(read("src/features/covers/artwork-backdrop.css"), /color-mix\(in srgb, var\(--lt-surface\)/);
  assert.match(css, /color: var\(--accent-contrast, var\(--lt-bg\)\)/);
  assert.match(css, /\.collectionIconButton:hover:not\(:disabled\)[^{}]*\{[^}]*var\(--lt-border-strong\)/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
