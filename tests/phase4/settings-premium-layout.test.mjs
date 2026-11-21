import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");
const view = read("src/features/settings/SettingsView.tsx");
const rail = read("src/features/settings/SettingsRail.tsx");
const skin = read("src/features/settings/settings-premium.css");
const sections = read("src/features/settings/SettingsCategoryContent.tsx");

test("Settings keeps the existing category rendering and reduced-motion support", () => {
  assert.match(view, /data-page-section="settings"/);
  assert.match(view, /<SettingsRail \{\.\.\.settingsRail\} \/>/);
  assert.match(view, /renderSettingsCategoryContent\(\)/);
  assert.doesNotMatch(view, /AnimatePresence|mode="wait"|settingsCategorySpring/);
  assert.match(view, /key=\{settingsCategory\}/);
  assert.match(view, /import "\.\/settings\.css";/);
  assert.match(view, /import "\.\/settings-premium\.css";/);
  for (const section of ["appearance", "playback", "discord", "library", "covers", "downloads", "updates", "about", "experimental", "advanced"]) {
    assert.ok(sections.includes('case "' + section + '":'), "Missing Settings category: " + section);
  }
});

test("Compact navigation keeps search, category controls, and keyboard semantics", () => {
  assert.match(rail, /aria-label="Settings navigation"/);
  assert.match(rail, /aria-label="Settings sections"/);
  assert.match(rail, /onSearchChange\(event\.currentTarget\.value\)/);
  assert.match(rail, /onSearchChange\(""\)/);
  assert.match(rail, /onCategoryChange\(tab\.id\)/);
  assert.match(rail, /aria-current=\{selected \? "page" : undefined\}/);
  assert.match(rail, /No matching section/);
});

test("Compact styles cover inputs, focus indicators, and narrower viewports without hiding functionality", () => {
  assert.match(skin, /\.settingsPage\.settingsPageV027 \.settingsLayout/);
  assert.match(skin, /\.toggleRow input\[type="checkbox"\]:checked/);
  assert.match(skin, /\.rangeRow input\[type="range"\]/);
  assert.match(skin, /:focus-visible/);
  assert.match(skin, /@media \(max-width: 950px\)/);
  assert.match(skin, /@media \(max-width: 480px\)/);
  assert.match(skin, /settingsModeGrid/);
  assert.match(skin, /settingsDisclosure/);
  assert.match(skin, /prefers-reduced-motion: reduce/);
  assert.match(skin, /rangeRow input\[type="range"\]::-webkit-slider-thumb/);
  assert.match(skin, /--range-progress/);
});

test("Appearance provides two accessible modes and sidebar tools", () => {
  const appearance = read("src/features/settings/categories/AppearanceSettings.tsx");
  assert.match(appearance, /settingsModeGrid/);
  assert.doesNotMatch(appearance, /settingsPaletteEditor|customThemeTokens/);
  assert.match(appearance, /aria-pressed/);
  assert.match(appearance, /updateSetting\("theme", mode\)/);
  assert.match(appearance, /<SidebarTabsSettings /);
  assert.match(appearance, /settingsSidebarDisclosure/);
});

test("Home, Library/Liked and shell use active theme tokens", () => {
  const home = read("src/features/home/home.css");
  const library = read("src/features/library/library.css");
  const shell = read("src/styles/view-shell.css");
  for (const source of [home, library, shell]) {
    assert.match(source, /var\(--lt-bg\)/);
    assert.match(source, /var\(--lt-accent\)/);
    assert.doesNotMatch(source, /#06131a|#79a7c4/);
  }
});

test("User feedback remains available manually without automatic nag prompts", () => {
  const app = read("src/App.tsx");
  const toast = read("src/features/shell/useAppToast.ts");
  assert.doesNotMatch(app, /FEEDBACK_PROMPT_DELAY_MS|feedbackPromptBlockersRef/);
  assert.match(app, /localtify:open-feedback/);
  assert.match(toast, /kind !== "error"/);
});

test("Settings use a readable width and grouped navigation", () => {
  const rail = read("src/features/settings/SettingsRail.tsx");
  assert.match(skin, /width: min\(100%, 1120px\)/);
  assert.match(skin, /grid-template-columns: 226px minmax\(0, 1fr\)/);
  for (const heading of ["Listening", "Your collection", "Application"]) {
    assert.ok(rail.includes(heading), "Missing settings navigation group: " + heading);
  }
  assert.match(rail, /aria-current=\{selected \? "page" : undefined\}/);
});

test("Each setting lives in its relevant category", () => {
  const appearance = read("src/features/settings/categories/AppearanceSettings.tsx");
  const playback = read("src/features/settings/categories/PlaybackSettings.tsx");
  const advanced = read("src/features/settings/categories/AdvancedSettings.tsx");
  for (const key of ["compactPlayer", "denseList", "reducedMotion", "softCorners", "animatedGlow", "catBuddyEnabled"]) {
    assert.match(appearance, new RegExp("updateSetting\\(\"" + key + "\""));
    assert.doesNotMatch(advanced, new RegExp("updateSetting\\(\"" + key + "\""));
  }
  assert.doesNotMatch(playback, /updateSetting\("compactPlayer"/);
  assert.match(playback, /updateSetting\("crossfadeEnabled"/);
  assert.match(playback, /updateSetting\("volumeNormalization"/);
});

test("Legacy appearance selectors are not kept after their controls move", () => {
  const core = read("src/features/settings/settings.css");
  for (const unused of ["settingsAppearanceInfoCopyV500", "settingsThemeSelectPanel", "cleanToggleLabel"]) {
    assert.ok(!core.includes(unused), "Unused CSS selector: " + unused);
  }
});

test("Downloads Experience keeps import, recovery and conversion controls without the retired cards", () => {
  const downloads = read("src/features/downloads/DownloadsView.tsx");
  const css = read("src/features/downloads/downloads.css");
  for (const feature of ["downloadsImporter", "downloadsActivity", "downloadsSpotifyPreview", "convertLocalMedia", "retryDownload", "retrySpotifyTrack", "clearFinishedDownloads", "clearFailedDownloads"]) {
    assert.ok(downloads.includes(feature), "Downloads lost " + feature);
  }
  assert.match(downloads, /label="Filter download activity"/);
  assert.doesNotMatch(downloads, /MascotHelperBubble|MascotStateArt|LocaltifyStateCard|downloadQueuePanel|downloadsInputCard/);
  assert.match(css, /--surface: var\(--lt-surface-raised\)/);
  assert.doesNotMatch(css, /#82b3ce|#0d1d26|mascotHelper/);
});

test("Library track canvas stays unboxed, preserving theme text and virtual positioning", () => {
  const lib = read("src/features/library/library.css");
  assert.match(lib, /\.libraryTrackSurface \{[^}]*background: transparent/);
  assert.doesNotMatch(lib, /background: rgba\(var\(--lt-accent-rgb\), \.64\)/);
  assert.match(lib, /\.virtualSongItem \{ position: absolute/);
  assert.match(lib, /\.songRow\.active/);
  assert.match(lib, /color: var\(--lt-text\) !important/);
});

test("Settings search and switches are readable with reduced-motion support", () => {
  assert.match(skin, /padding: 10px 36px 10px 39px/);
  assert.match(skin, /::-webkit-search-decoration/);
  assert.match(read("src/features/settings/settings.css"), /--settings-surface: var\(--lt-surface-soft\)/);
  assert.match(skin, /background: var\(--settings-text\); transition: transform/);
  assert.match(skin, /toggleRow input\[type="checkbox"\]::before \{ transition: none/);
});

test("Library uses an unfilled list with theme-aware hover and active rows", () => {
  const lib = read("src/features/library/library.css");
  assert.match(lib, /\.libraryTrackSurface \{[\s\S]*?background: transparent/);
  assert.match(lib, /\.songRow:hover:not\(\.songDragging\):not\(\.songDropTarget\) \{[\s\S]*?background: var\(--lt-fill-hover\)/);
  assert.match(lib, /\.songRow.active:not\(\.songDragging\):not\(\.songDropTarget\) \{[\s\S]*?background: var\(--lt-fill-selected\)/);
  assert.doesNotMatch(read("src/features/shell/app-core.css"), /\.songRow::(?:before|after)\s*\{/);
  assert.match(read("src/App.css"), /\.songDropTarget::before\s*\{/);
});

test("Covers keeps interactive tools while replacing fixed blue surfaces", () => {
  const css = read("src/features/covers/covers.css");
  const studio = read("src/features/covers/CoverStudio.tsx");
  const view = read("src/features/covers/CoversView.tsx");
  assert.match(css, /--cover-surface: var\(--lt-surface-soft\)/);
  assert.match(css, /--cover-text: var\(--lt-text\)/);
  assert.doesNotMatch(css, /#0d1d26|#112630|#dce8ed/);
  assert.match(studio, /coverMaintenanceMenu/);
  assert.match(studio, /VirtualCoverGalleryGrid/);
  assert.match(studio, /randomizeSelectedCovers/);
  assert.match(view, /coverStudioEmptyNotice/);
  assert.doesNotMatch(view, /LocaltifyStateCard/);
});


test("Library, Covers and Spotify review fixes remain in place", () => {
  const library = read("src/features/library/library.css");
  const covers = read("src/features/covers/CoverStudio.tsx");
  const downloads = read("src/features/downloads/downloads.css");
  assert.match(library, /\.songMeta small \{\s*color: var\(--lt-muted\)/);
  assert.match(library, /\.songInfo \{\s*color: var\(--lt-text\)/);
  assert.match(library, /\.songRow \{[\s\S]*?color: var\(--lt-text\)/);
  assert.match(covers, /Fix missing \{missingCoverSongs\.length/);
  assert.doesNotMatch(covers, /Fix missing \$\{/);
  assert.match(downloads, /\.downloadsInputSurface\s*\{[\s\S]*?min-width: 0/);
  assert.match(downloads, /\.downloadsSpotifyPreview\s*\{[\s\S]*?min-width: 0/);
});


test("Library and Liked use the shared content gutter and meaningful empty states", () => {
  const library = read("src/features/library/library.css");
  const view = read("src/features/library/LibraryView.tsx");
  assert.doesNotMatch(library, /\.app:has\(\.libraryPage\) \.content \{\s*padding: 0 !important/);
  assert.match(library, /\.libraryPage \{[\s\S]*?padding: 0 0 var\(--lt-space-5\)/);
  assert.match(view, /cute=\{!isLiked\}/);
  assert.match(view, /centered=\{!isLiked\}/);
});


test("Advanced reset mascot and feedback card stay contained and theme-aware", () => {
  const advanced = read("src/features/settings/categories/AdvancedSettings.tsx");
  const app = read("src/App.tsx");
  assert.match(advanced, /settingsDangerMascotV501/);
  assert.match(skin, /\.settingsPage\.settingsPageV027 \.settingsDangerMascotV501 \{/);
  assert.match(skin, /max-height: 96px/);
  assert.match(skin, /\.settingsPage\.settingsPageV027 \.settingsDangerPanelV491 \.settingsResetGrid/);
  for (const selector of ["feedbackSettingsCardV331", "feedbackSettingsHeaderV331", "feedbackWebhookStatusV337", "feedbackSettingsButtonV331"]) {
    assert.ok(app.includes(selector), "Feedback markup missing " + selector);
    assert.ok(skin.includes("." + selector), "Feedback styles missing " + selector);
  }
});
