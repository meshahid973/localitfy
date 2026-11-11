import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");

test("Artists and Genres share collection primitives but own their variants", () => {
  const artist = read("src/features/artists/ArtistsView.tsx");
  const genre = read("src/features/genres/GenresView.tsx");
  const shared = read("src/shared/ui/collection-layout.css");
  const artistCss = read("src/features/artists/artists.css");
  const genreCss = read("src/features/genres/genres.css");
  for (const view of [artist, genre]) {
    assert.match(view, /import "\.\.\/\.\.\/shared\/ui\/collection-layout\.css";/);
    assert.match(view, /className="collectionPage/);
    assert.match(view, /className="collectionGrid/);
    assert.match(view, /className="collectionCard/);
  }
  assert.doesNotMatch(genre, /import "\.\.\/artists\/artists\.css"/);
  assert.match(artist, /import "\.\/artists\.css";/);
  assert.match(genre, /import "\.\/genres\.css";/);
  assert.match(shared, /background: var\(--lt-surface\)/);
  assert.match(shared, /color: var\(--lt-text\)/);
  assert.match(shared, /@media \(max-width: 520px\)/);
  assert.match(artistCss, /\.artistCardCover/);
  assert.match(genreCss, /\.genreCardCover/);
  assert.doesNotMatch(artistCss, /\.artistsGrid/);
  assert.doesNotMatch(genreCss, /\.artistsPage/);
});
