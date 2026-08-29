import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const retiredPageStyles = [
  "src/features/library/library.css",
  "src/features/albums/albums.css",
  "src/features/playlists/playlists.css",
  "src/features/covers/covers.css",
  "src/features/downloads/downloads.css",
  "src/features/analytics/analytics.css"
];

test("retired page design styles stay removed", () => {
  const main = read("src/main.tsx");
  for (const file of retiredPageStyles) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file + " should stay removed until its page is redesigned");
    assert.equal(main.includes(file.replace(/^src\//, "./")), false, file + " is still imported by the renderer");
  }
  assert.equal(fs.existsSync(path.join(root, "src/styles/page-foundation.css")), true, "structural page foundation is missing");
  assert.equal(main.includes('import "./styles/page-foundation.css";'), true, "renderer is not loading the structural page foundation");
});

test("permanent visual owners remain explicit and co-located", () => {
  const app = read("src/App.tsx");
  const main = read("src/main.tsx");
  const home = read("src/features/home/HomeView.tsx");
  const player = read("src/features/player/components/PlayerBar.tsx");
  const settingsView = read("src/features/settings/SettingsView.tsx");
  const settingsModal = read("src/features/settings/SettingsModal.tsx");
  const shell = read("src/features/shell/AppShell.tsx");

  const appCss = [...app.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
  assert.deepEqual(appCss, ["./App.css"], "App must not be a feature stylesheet manifest");
  assert.equal(home.includes('import "./home.css";'), true, "HomeView must own Home CSS");
  assert.equal(player.includes('import "../player.css";'), true, "PlayerBar must own player CSS");
  assert.equal(settingsView.includes('import "./settings.css";'), true, "SettingsView must own settings CSS");
  assert.equal(settingsModal.includes('import "./settings.css";'), true, "SettingsModal must own settings CSS");
  for (const specifier of ["./app-core.css", "./motion.css", "./effects.css", "../../styles/view-shell.css"]) {
    assert.equal(shell.includes('import "' + specifier + '";'), true, specifier + " is missing from AppShell ownership");
  }

  for (const specifier of [
    "./styles/tokens.css",
    "./styles/themes.css",
    "./shared/ui/view-ui.css",
    "./styles/page-foundation.css",
    "./features/shell/performance.css"
  ]) {
    assert.equal(main.includes('import "' + specifier + '";'), true, specifier + " is missing from the global renderer manifest");
  }

  const settingsCss = read("src/features/settings/settings.css");
  assert.equal(settingsCss.includes("Visual redesign intentionally removed"), true, "Settings should remain structure-only during redesign");
});
