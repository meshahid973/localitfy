import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(path,"utf8");
test("ordinary buttons have no blanket hover glow or lift",()=>{
  for(const path of ["src/App.css","src/features/shell/app-core.css"]){const css=read(path);assert.doesNotMatch(css,/(?:^|\n)(?:\.app )?button:hover\s*\{[^}]*transform:/);assert.doesNotMatch(css,/(?:^|\n)button:hover,\s*\.button:hover/);assert.doesNotMatch(css,/activeRowGlow/);}
  assert.doesNotMatch(read("src/shared/ui/controls.css"),/transform: translateY\(1px\)/);
});
test("library selection and playlist editing stay separate from playback",()=>{
  assert.match(read("src/features/library/LibraryView.tsx"),/selectedSongs = useMemo\(\(\) => visibleSongs\.filter/);
  assert.match(read("src/features/library/components/SongRows.tsx"),/onToggleSelection \? onToggleSelection\(song.id\) : onSelectSong/);
  assert.match(read("src/features/playlists/PlaylistsView.tsx"),/reorderable=\{!detailPlaylist.rules && !trackQuery.trim\(\)\}/);
  assert.match(read("src/features/playlists/usePlaylistsController.ts"),/!item.songIds.includes\(songId\)/);
});
