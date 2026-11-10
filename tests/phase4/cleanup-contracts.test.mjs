import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(name, "utf8");

test("App CSS retains canonical motion rules without duplicate overlapping selector groups", () => {
  const source = read("src/App.css");
  assert.match(source, /\.hero,\s*\.editorModal,\s*\.deleteModal,\s*\.whatsNewCard\s*\{\s*transform-origin: center;\s*contain: layout paint style;/);
  assert.match(source, /\.hero,\s*\.songRow\s*\{\s*transition-timing-function: var\(--motion-smooth\);/);
  assert.doesNotMatch(source, /\.editorModal,\s*\.deleteModal,\s*\.whatsNewCard\s*\{\s*transform-origin: center;/);
  assert.doesNotMatch(source, /\.songRow\s*\{\s*transition-timing-function: var\(--motion-smooth\);/);
});

test("disabled queue preview no longer consumes a React memo hook", () => {
  assert.doesNotMatch(read("src/App.tsx"), /queuePreviewSongs/);
});

test("Downloads UI has a real typed prop boundary without runtime behavior changes", () => {
  const view = read("src/features/downloads/DownloadsView.tsx");
  const props = view.slice(view.indexOf("export type DownloadsViewProps = {"), view.indexOf("};", view.indexOf("export type DownloadsViewProps = {")) + 2);
  assert.doesNotMatch(props, /\bany\b/);
  for (const type of ["DownloadQueueItem[]", "DownloadResult[]", "SpotifyTrack[]", "Set<string>", "Settings", "SettingsCategory", "DownloadsTab"]) {
    assert.ok(props.includes(type), type);
  }
  assert.match(props, /setSpotifySelectedIds: Dispatch<SetStateAction<Set<string>>>/);
  assert.match(props, /retryDownload: \(url: string, source: "youtube" \| "spotify" \| "auto", spotifyTrackId\?: string\)/);
  assert.match(read("src/features/shell/appShell.contract.ts"), /downloads: DownloadsViewProps/);
});
