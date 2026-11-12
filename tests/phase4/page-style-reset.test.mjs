import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const rebuiltPageStyles = [
  "src/features/albums/albums.css",
  "src/features/covers/covers.css"
];
const resetPageRoots = [".albumsPageV318", ".playlistsPage", ".coverStudioLayout", ".downloadsLayoutV031", ".analyticsStudioV339"];

test("album and covers styles are owned by their views", () => {
  const main = read("src/main.tsx");
  for (const relativePath of rebuiltPageStyles) {
    assert.ok(fs.existsSync(path.join(root, relativePath)), relativePath + " needs its feature CSS");
    assert.equal(main.includes(relativePath.replace(/^src\//, "./")), false, "feature CSS must remain lazy");
  }
  assert.ok(read("src/features/albums/AlbumsView.tsx").includes('import "./albums.css";'));
  assert.ok(read("src/features/covers/CoversView.tsx").includes('import "./covers.css";'));
});

test("global visual owners cannot reclaim reset page roots", () => {
  for (const relativePath of ["src/App.css", "src/features/shell/app-core.css", "src/features/shell/effects.css", "src/styles/themes.css"]) {
    const source = read(relativePath);
    for (const selector of resetPageRoots) assert.equal(source.includes(selector), false, relativePath + " illegally owns " + selector);
  }
});

test("retired reset stylesheet cannot return", () => {
  assert.equal(fs.existsSync(path.join(root, "src/styles/page-foundation.css")), false);
  assert.equal(read("src/main.tsx").includes("page-foundation.css"), false);
});


test("Cover virtual rows keep fixed positions when hovered and gallery items fit their slots", () => {
  const css = read("src/features/covers/covers.css");
  const songs = read("src/features/covers/components/VirtualCoverSongList.tsx");
  const gallery = read("src/features/covers/components/VirtualCoverGalleryGrid.tsx");
  assert.match(songs, /style=\{\{ top: \`\$\{virtualRow\.start - scrollMargin\}px\` \}\}/);
  assert.match(gallery, /style=\{\{ top: \`\$\{virtualRow\.start - scrollMargin\}px\`/);
  assert.doesNotMatch(songs + gallery, /translate3d\(0, var\(--cover-/);
  assert.match(css, /height: 228px/);
  assert.match(gallery, /estimateSize: \(\) => 228/);
  assert.match(css, /coverSongPickVirtual[\s\S]*?transform: none !important/);
  assert.match(gallery, /Math\.max\(1, Math\.floor/);
  assert.match(gallery, /if \(!entries\.length\) return <div ref=\{parentRef\}/);
  assert.match(songs, /if \(!songs\.length\) return <div ref=\{parentRef\}/);
  assert.match(songs, /aria-pressed=\{selected\}/);
});
