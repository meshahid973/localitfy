import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const spotify = require(path.join(root, "electron/runtime/spotify-normalize.cjs"));

test("App delegates library drag geometry to the Library owner", () => {
  const app = read("src/App.tsx");
  const geometry = read("src/features/library/dragGeometry.ts");
  assert.match(app, /from "\.\/features\/library\/dragGeometry"/);
  assert.doesNotMatch(app, /function getLibraryDropSideInfoForElement/);
  for (const name of ["getLibraryDropSideInfoForElement", "getLibraryDropSideForElement", "getLibraryDropSide", "getLibraryDropElement"]) {
    assert.ok(geometry.includes("export function " + name + "("), name);
  }
});

test("Spotify URL and track normalizers are runtime-owned and retain behavior", () => {
  const main = read("electron/main.cjs");
  assert.match(main, /require\("\.\/runtime\/spotify-normalize\.cjs"\)/);
  assert.doesNotMatch(main, /function parseSpotifyUrl/);
  assert.deepEqual(spotify.parseSpotifyUrl("spotify:track:ABC123"), { type: "track", id: "ABC123" });
  assert.deepEqual(spotify.parseSpotifyUrl("https://open.spotify.com/playlist/Ab123"), { type: "playlist", id: "Ab123" });
  assert.equal(spotify.parseSpotifyUrl("not spotify"), null);
  assert.equal(spotify.safeImageExtensionFromUrlOrType("https://x/image", "image/webp"), ".webp");
  assert.equal(spotify.bestSpotifyImage([{ url: "small", width: 30 }, { url: "large", width: 200 }]), "large");
  assert.equal(spotify.decodeHtmlEntities("A &amp; B &quot;C&quot;"), 'A & B "C"');
  assert.deepEqual(spotify.uniqSpotifyIds(["A".repeat(22), "A".repeat(22), "B".repeat(22), "bad"]), ["A".repeat(22), "B".repeat(22)]);
  assert.deepEqual(spotify.shapeSpotifyTrack({ id: "abc", name: "Track", artists: [{name:"Artist"}], duration_ms: 120000, album: {name:"Album", images:[{url:"art",width:300}]}}), {
    id:"abc", title:"Track", name:"Track", artist:"Artist", artists:"Artist", albumName:"Album", coverUrl:"art", albumCoverUrl:"art", spotifyCoverUrl:"art", duration:120, durationMs:120000, spotifyUrl:"https://open.spotify.com/track/abc", isrc:""
  });
});
