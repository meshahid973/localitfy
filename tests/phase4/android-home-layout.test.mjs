import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function compile(file, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  runInNewContext(output, { exports, require: (name) => name in dependencies ? dependencies[name] : require(name) });
  return exports;
}

function home(android, songs, hidden = []) {
  const layout = compile("src/features/home/homeLayout.ts");
  const Home = compile("src/features/home/HomeView.tsx", {
    "./home.css": {},
    "../../app/platform": { isAndroidApp: () => android },
    "../covers/Cover": { Cover: () => null },
    "../covers/ArtworkBackdrop": { ArtworkBackdrop: () => null },
    "../../shared/ui/LocaltifyViewUi": { MascotStateArt: () => null },
    "../search/search.utils": { prettyMeta: String, prettyTitle: String },
    "./homeLayout": layout,
    "./HomeShelves": { HomeAlbumRail: () => null, HomeDailyMixRail: () => null, HomeSongRail: () => null },
    "../../shared/ui/MediaCard": { MediaCard: ({ children }) => React.createElement("div", null, children) },
    "../artists/artistCredits": { splitArtistCredits: (name) => [name] },
    "../shell/appActions": { useAppActions: () => ({}), artistTarget: (title) => ({ title }) },
    "./homeShelfPicks": compile("src/features/home/homeShelfPicks.ts")
  }).default;
  return renderToStaticMarkup(React.createElement(Home, {
    albums: [], songs, currentSong: songs[0] || null, currentId: songs[0]?.id || null,
    homeListenNowSongs: songs, homeFreshShelfSongs: [], heroDisplayTitle: "Test song",
    heroDisplayArtist: "Test artist", settings: { volume: 0.5, heroExpanded: true, homeSectionOrder: [], homeHiddenSections: hidden },
    ambientStyle: {}, playableSongCount: songs.length
  }));
}

test("fresh Android Home offers sync even if all saved sections are hidden", () => {
  const layout = compile("src/features/home/homeLayout.ts");
  const html = home(true, [], layout.homeSections.map(({ id }) => id));
  assert.match(html, /Set up phone sync/);
  assert.doesNotMatch(html, /disabled|shuffle library|use compact hero|homeListenSection|homeEmptyState/);
});

test("Android Home keeps a short song list and omits the desktop expansion control", () => {
  const songs = Array.from({ length: 8 }, (_, id) => ({ id: String(id), title: `Song ${id}`, artist: "Artist", filePath: "/test.wav" }));
  const phone = home(true, songs);
  const desktop = home(false, songs);
  assert.equal((phone.match(/class="homeListenRow/g) || []).length, 4);
  assert.equal((desktop.match(/class="homeListenRow/g) || []).length, 8);
  assert.doesNotMatch(phone, /use compact hero/);
  assert.match(desktop, /use compact hero/);
  assert.match(phone, /aria-label="Customize Home"/);
});
