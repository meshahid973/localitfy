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
  assert.match(surface, /immersive && player\.currentSong \? <Suspense/);
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

test("immersive assets load on demand and hidden desktop controls stop receiving progress writes", () => {
  const surface = read(dir + "PlayerSurfaces.tsx");
  const bar = read(dir + "PlayerBar.tsx");
  const immersive = read(dir + "ImmersivePlayer.tsx");
  assert.match(surface, /const ImmersivePlayer = lazy\(\(\) => import\("\.\/ImmersivePlayer"\)\)/);
  assert.match(surface, /restoreFocus\.current = true/);
  for (const ref of ["progressInputRefs", "progressTimeLabelRefs", "progressDurationLabelRefs"]) {
    assert.ok(bar.includes(ref + ".current[1] = props.immersiveOpen ? null : node;"));
  }
  assert.match(immersive, /const ListeningArtwork = memo\(Cover\)/);
  assert.match(immersive, /const ListeningBackdrop = memo\(ArtworkBackdrop\)/);
});

test("cover color results cannot tint a different track and Android closes its overlays", () => {
  const ambient = read("src/features/covers/cover.ambient.ts");
  const phone = read(dir + "PhonePlayer.tsx");
  const focus = read("src/shared/hooks/useModalFocus.ts");
  assert.match(ambient, /sample\?\.source === coverSource \? sample\.style : EMPTY_COVER_STYLE/);
  assert.match(ambient, /if \(controller.signal.aborted\) return/);
  assert.match(phone, /if \(queuePanelOpen\) toggleQueuePanel\(\)/);
  assert.match(phone, /progressInputRefs\.current\[MINI_SLOT\] = expanded \? null : node/);
  assert.match(focus, /element\.id === "localtify-play-queue"/);
});
