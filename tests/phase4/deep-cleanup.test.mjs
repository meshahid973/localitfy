import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("legacy compatibility shims stay deleted", () => {
  const forbidden = [
    "src/localtifyConstants.ts", "src/localtifyUtils.ts", "src/localtifyTypes.ts", "src/localtifyAssets.ts",
    "src/SettingsCategoryContent.tsx", "src/cover.tsx", "src/ui/Surface.tsx", "src/motion/physicalDrag.ts",
    "src/player/PlayerEngine.ts", "src/player/htmlAudioEngine.ts", "src/player/playerController.ts",
    "src/types/downloads.ts", "src/types/playlists.ts", "src/types/settings.ts", "src/types/song.ts", "src/types/theme.ts"
  ];
  for (const relative of forbidden) assert.equal(fs.existsSync(path.join(root, relative)), false, `${relative} must stay deleted`);
});

test("App and Discord use canonical feature owners", () => {
  const app = read("src/App.tsx");
  const discord = read("src/features/discord/useDiscordActivityRuntime.ts");
  assert.match(app, /features\/player\/engine\/htmlAudioEngine/);
  assert.match(app, /features\/settings\/SettingsCategoryContent/);
  assert.doesNotMatch(app, /["']\.\/player\//);
  assert.doesNotMatch(discord, /localtifyTypes/);
});

test("player morph icon has one implementation and one feature owner", () => {
  assert.match(read("src/features/player/PlayerPlayPauseMorphIcon.tsx"), /function PlayerPlayPauseMorphIcon/);
  assert.match(read("src/features/player/components/PlayerBar.tsx"), /from "\.\.\/PlayerPlayPauseMorphIcon"/);
  assert.doesNotMatch(read("src/shared/ui/LocaltifyViewUi.tsx"), /function PlayerPlayPauseMorphIcon/);
});

test("unused CSS selector pruning is part of the hardening gate", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["css:dedup:check"], /css-unused-selectors\.mjs/);
  assert.match(read("scripts/css-dedup-fixpoint.mjs"), /css-unused-selectors\.mjs/);
});

test("lazy settings content stays out of the static settings barrel", () => {
  const barrel = read("src/features/settings/index.ts");
  assert.doesNotMatch(barrel, /SettingsCategoryContent/);
  assert.match(read("src/App.tsx"), /lazy\(\(\) => import\("\.\/features\/settings\/SettingsCategoryContent"\)\)/);
});
