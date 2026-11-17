import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = file => fs.readFileSync(file, "utf8");
const dir = "src/features/player/components/";
test("immersive player is presentation-only with a separate progress slot", () => {
  const surface = read(dir + "ImmersivePlayer.tsx");
  const shell = read("src/features/shell/AppShell.tsx");
  assert.match(surface, /const IMMERSIVE_SLOT = 4/);
  assert.match(surface, /progressInputRefs\.current\[IMMERSIVE_SLOT\]/);
  assert.match(surface, /onClick=\{togglePlay\}/);
  assert.match(surface, /commitSeek\(event\.currentTarget\.value\)/);
  assert.doesNotMatch(surface, /new Audio\(|<audio\b|createPlayerController|usePlayerRuntime|recordPlayEvent/);
  assert.equal((shell.match(/<PlaybackAudioElement\b/g) || []).length, 1);
});
test("immersive and normal queue rendering are mutually exclusive", () => {
  const surface = read(dir + "PlayerSurfaces.tsx");
  assert.match(surface, /immersive && player\.currentSong \? <ImmersivePlayer/);
  assert.match(surface, /: <>\s*<QueuePanel \{\.\.\.queue\}/);
  assert.match(read(dir + "ImmersivePlayer.tsx"), /<QueuePanel \{\.\.\.queue\}/);
  assert.match(read(dir + "PlayerBar.tsx"), /inert=\{props\.immersiveOpen \|\| undefined\}/);
});
test("artwork follows background preferences and avoids backgrounded image work", () => {
  const surface = read(dir + "ImmersivePlayer.tsx");
  assert.match(surface, /effectiveAmbient && backgroundStyle === "coverBlur" && !backgrounded/);
  assert.match(read(dir + "PhonePlayer.tsx"), /phonePlayerBackdropArt" preferThumbnail/);
  assert.match(read(dir + "immersive-player.css"), /\[data-background="oledBlack"\]/);
  assert.match(read("src/features/lyrics/LyricsView.tsx"), /if \(!open \|\| embedded\) return/);
});
