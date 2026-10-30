import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const read = (file) => fs.readFileSync(file, "utf8");

function loadHistory() {
  const { outputText } = ts.transpileModule(read("src/features/shell/navigationHistory.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  const exports = {};
  runInNewContext(outputText, { exports });
  return exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("history pushes pages, drops forward entries and remembers where each page was scrolled", () => {
  const { pushHistory, stepHistory } = loadHistory();
  let state = { entries: [{ view: "home", detail: null, scrollTop: 0 }], index: 0 };
  state = pushHistory(state, "albums", null, 120);
  state = pushHistory(state, "albums", { kind: "album", id: "a1" }, 640);
  assert.deepEqual(plain(state.entries.map((entry) => entry.scrollTop)), [120, 640, 0]);
  assert.equal(pushHistory(state, "albums", { kind: "album", id: "a1" }, 0), state, "opening the page you are on adds nothing");

  state = stepHistory(state, -1, 300);
  assert.equal(state.index, 1);
  assert.equal(state.entries[1].scrollTop, 640, "back returns to the grid where it was left");
  assert.equal(state.entries[2].scrollTop, 300, "and the album page keeps its own spot for forward");
  assert.equal(stepHistory(stepHistory(state, -1, 0), -1, 0).index, 0, "back stops at the first entry");

  state = pushHistory(state, "artists", { kind: "artist", id: "brakence" }, 640);
  assert.deepEqual(plain(state.entries.map((entry) => entry.detail?.id ?? entry.view)), ["home", "albums", "brakence"], "a new page replaces forward history");
  assert.equal(stepHistory(state, 1, 0), state, "nothing to go forward to");
});

test("detail pages live inside their section and artist ids ignore case", () => {
  const { DETAIL_VIEWS, artistDetailId } = loadHistory();
  assert.deepEqual(plain(DETAIL_VIEWS), { album: "albums", artist: "artists", genre: "genres", playlist: "playlists", mix: "playlists" });
  assert.equal(artistDetailId("  Brakence "), "brakence");
});

test("back and forward work from the title bar, mouse buttons, keyboard and the macOS menu", () => {
  const hook = read("src/features/shell/useNavigationHistory.ts");
  assert.match(hook, /event\.button !== 3 && event\.button !== 4/);
  assert.match(hook, /event\.key === "\[" \|\| event\.key === "\]"/);
  assert.match(hook, /event\.key === "ArrowLeft" \|\| event\.key === "ArrowRight"/);
  assert.match(hook, /closest\("input, textarea, select, \[contenteditable='true'\]"\)/, "text fields keep their keys");
  assert.match(read("src/features/shell/TitleBar.tsx"), /aria-label="Go back"/);
  const menu = read("electron/runtime/app-menu.cjs");
  assert.match(menu, /label: "Back", accelerator: "Command\+\[", click: command\("back"\)/);
  assert.match(menu, /label: "Forward", accelerator: "Command\+\]", click: command\("forward"\)/);
});

test("collections open as pages in their section instead of drawers", () => {
  const shell = read("src/features/shell/AppShell.tsx");
  assert.match(shell, /detail\?\.kind === "album"\s*\? <AlbumPage key=\{detail\.id\}/);
  assert.match(shell, /detail\?\.kind === "artist"\s*\? <ArtistPage/);
  assert.match(shell, /detail\?\.kind === "genre"\s*\? <GenrePage/);
  assert.match(shell, /detail\?\.kind === "mix"\s*\? <MixPage/);
  assert.match(shell, /detailPlaylistId=\{detail\?\.kind === "playlist" \? detail\.id : null\}/);
  assert.match(shell, /changeView=\{nav\.go\}/, "the sidebar goes through history too");
  for (const file of ["src/features/albums/AlbumsView.tsx", "src/features/artists/ArtistsView.tsx", "src/features/genres/GenresView.tsx"]) {
    assert.doesNotMatch(read(file), /role="dialog"/, file);
  }
});

test("every collection card opens on click, plays from its button and has the shared menu", () => {
  const card = read("src/shared/ui/MediaCard.tsx");
  assert.match(card, /onClick=\{\(\) => void onOpen\(\)\}/);
  assert.match(card, /event\.stopPropagation\(\); void onPlay\(\);/, "the play button does not also open the page");
  for (const file of ["src/features/albums/AlbumsView.tsx", "src/features/artists/ArtistsView.tsx", "src/features/genres/GenresView.tsx",
    "src/features/home/HomeShelves.tsx", "src/features/home/HomeView.tsx", "src/features/playlists/PlaylistsView.tsx", "src/features/pages/AlbumShelf.tsx"]) {
    const source = read(file);
    assert.match(source, /<MediaCard/, file);
    assert.match(source, /actions\.openCollectionMenu\(event,/, file);
  }
});

test("songs play on click and open the song menu on right-click everywhere", () => {
  const shelves = read("src/features/home/HomeShelves.tsx");
  assert.match(shelves, /onOpen=\{\(\) => selectSong\(song\.id, true\)\}\s*onPlay=\{\(\) => selectSong\(song\.id, true\)\}\s*onContextMenu=\{\(event\) => void openSongMenu\(event, song\)\}/, "song cards get the same hover button as albums and playlists");
  assert.match(read("src/features/home/HomeView.tsx"), /onContextMenu=\{\(event\) => void actions\.openSongMenu\(event, song\)\}/);
  const list = read("src/features/pages/TrackList.tsx");
  assert.match(list, /onClick=\{\(\) => \{ if \(!missing\) void playFrom\(song\.id\); \}\}/);
  assert.match(list, /onContextMenu=\{\(event\) => void openSongMenu\(event, song\)\}/);
  assert.match(list, /nav\.openArtistPage\(name\)/);
  assert.match(list, /nav\.openAlbumPage\(albumId\)/);
});

test("playing a song on a page plays the rest of that page after it", () => {
  const app = read("src/App.tsx");
  assert.match(app, /const start = Math\.max\(0, order\.indexOf\(startId!\)\);/);
  assert.match(app, /setPlayQueue\(order\.slice\(start \+ 1\)\);/);
  assert.match(read("src/features/pages/AlbumPage.tsx"), /actions\.playCollection\(target, \{ startId: songId \}\)/);
});

test("a two-finger swipe steps once; vertical scrolls, pinches and sideways-scrolling shelves do not", () => {
  const { createSwipeDetector } = loadHistory();
  const steps = [];
  let shelfCanScroll = false;
  const wheel = createSwipeDetector((delta) => steps.push(delta), () => shelfCanScroll);
  const swipe = (start, deltaX, count = 8, extra = {}) => {
    for (let i = 0; i < count; i++) wheel({ deltaX, deltaY: 0, ctrlKey: false, timeStamp: start + i * 16, target: null, ...extra });
  };
  swipe(0, -30, 30); // fingers right, plus momentum: one step back
  assert.deepEqual(steps, [-1]);
  swipe(1000, 30);
  assert.deepEqual(steps, [-1, 1], "fingers left go forward");
  for (let i = 0; i < 20; i++) wheel({ deltaX: 20, deltaY: 60, ctrlKey: false, timeStamp: 2000 + i * 16, target: null });
  swipe(3000, -40, 8, { ctrlKey: true });
  swipe(4000, -6, 5);
  assert.deepEqual(steps, [-1, 1], "diagonal scrolls, pinch zoom and small nudges are ignored");
  shelfCanScroll = true;
  swipe(5000, -30, 12);
  assert.deepEqual(steps, [-1, 1], "a shelf that can still scroll takes the swipe");
});

test("OS gestures and back/forward commands reach the page history once", () => {
  const menu = read("electron/runtime/app-menu.cjs");
  assert.match(menu, /win\.on\("swipe"/);
  assert.match(menu, /name === "browser-backward" \|\| name === "browser-forward"/);
  assert.match(read("electron/main.cjs"), /appMenu\.attachNavigationGestures\(mainWindow\);/);
  const hook = read("src/features/shell/useNavigationHistory.ts");
  assert.match(hook, /if \(now - lastGestureRef\.current < GESTURE_GAP_MS\) return;/, "Windows sends a side-button press as a mouse event and an app command");
  assert.match(hook, /const onWheel = IS_MAC \? createSwipeDetector\(gesture, scrollsSideways\) : null;/, "trackpad swipes only on macOS");
  assert.match(read("src/features/shell/useAppMenuCommands.ts"), /current\.nav\.gesture\(-1\)/);
});

test("concurrent navigation retains the current page detail until its view changes", () => {
  const hook = read("src/features/shell/useNavigationHistory.ts");
  assert.match(hook, /const committedEntryRef = useRef\(entry\)/);
  assert.match(hook, /if \(entry\.view === view\) committedEntryRef\.current = entry;/);
  assert.match(hook, /committedEntryRef\.current\.view === view \? committedEntryRef\.current\.detail : null/);
});
