import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (p) => fs.readFileSync(p, "utf8");

test("cover empty states explain whether the song list or artwork gallery is empty", () => {
  const component = read("src/features/covers/components/CoverCuteEmptyState.tsx");
  const songs = read("src/features/covers/components/VirtualCoverSongList.tsx");
  const gallery = read("src/features/covers/components/VirtualCoverGalleryGrid.tsx");
  const styles = read("src/features/covers/covers.css");
  assert.match(component, /title: string/);
  assert.match(component, /message: string/);
  assert.match(component, /role="status"/);
  assert.doesNotMatch(component, /my team couldn't find anything here/);
  assert.match(songs, /title="No songs found"/);
  assert.match(gallery, /title="No covers found"/);
  assert.match(styles, /\.coverStudioLayout \.coverEmptyCopyV500/);
  assert.match(styles, /\.coverStudioLayout \.coverEmptyDetailV500/);
});
