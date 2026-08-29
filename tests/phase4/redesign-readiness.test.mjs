import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("non-Home page modules are lazy boundaries", () => {
  const shell = read("src/features/shell/AppShell.tsx");
  for (const modulePath of ["library/LibraryView", "albums/AlbumsView", "playlists/PlaylistsView", "covers/CoversView", "analytics/AnalyticsView", "settings/SettingsView", "downloads/DownloadsView"]) assert.ok(shell.includes('lazy(() => import("../' + modulePath + '"))'), modulePath);
  assert.match(shell, /<Suspense fallback={null}>/);
});

test("typed redesign boundaries cannot regress to any", () => {
  const looseAny = /:\s*any\b|\bas\s+any\b|<\s*any\s*>|\bany\s*\[\s*\]|\b(?:Record|Array|Promise|Map|Set)<[^>]*\bany\b[^>]*>/;
  for (const relative of ["src/features/library/LibraryView.tsx", "src/features/covers/CoversView.tsx", "src/features/player/components/PlayerBar.tsx", "src/features/analytics/AnalyticsView.tsx", "src/features/analytics/analyticsSnapshot.ts"]) assert.doesNotMatch(read(relative), looseAny, relative + " regained loose any typing");
});

test("theme CSS is globally owned and feature CSS is co-located", () => {
  assert.equal(fs.existsSync(path.join(root, "src/features/settings/themes.css")), false);
  assert.equal(fs.existsSync(path.join(root, "src/styles/themes.css")), true);
  assert.deepEqual([...read("src/App.tsx").matchAll(/import\s+["']([^"']+\.css)["']/g)].map((m) => m[1]), ["./App.css"]);
});
