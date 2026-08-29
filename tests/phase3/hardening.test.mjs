import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("feature styles have canonical co-located ownership", () => {
  const app = read("src/App.tsx");
  const appCss = [...app.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
  assert.deepEqual(appCss, ["./App.css"]);
  for (const [file, owned] of [
    ["src/features/home/HomeView.tsx", "./home.css"], ["src/Onboarding.tsx", "./features/onboarding/onboarding.css"],
    ["src/features/player/components/PlayerBar.tsx", "../player.css"], ["src/features/settings/SettingsView.tsx", "./settings.css"],
    ["src/features/shell/AppShell.tsx", "./app-core.css"]
  ]) assert.ok(read(file).includes(owned), file + " is missing " + owned);
  assert.equal(fs.existsSync(path.join(root, "src/features/settings/themes.css")), false);
  assert.equal(fs.existsSync(path.join(root, "src/styles/themes.css")), true);
});

test("main renderer sandbox is enabled and documented", () => {
  const main = read("electron/main.cjs"); const doc = read("docs/architecture/electron-sandbox.md");
  assert.match(main, /nodeIntegration:\s*false/); assert.match(main, /contextIsolation:\s*true/); assert.match(main, /sandbox:\s*true/);
  assert.doesNotMatch(main, /sandbox:\s*false/); assert.match(main, /webviewTag:\s*false/); assert.match(main, /allowRunningInsecureContent:\s*false/);
  assert.match(main, /navigateOnDragDrop:\s*false/); assert.match(main, /isTrustedMainFrameIpcEvent/); assert.match(main, /rendererFileRoot/);
  assert.match(main, /installRendererSecurityGuards/); assert.match(main, /createIconRuntime/); assert.match(main, /createWindowTranslucencyRuntime/);
  assert.match(doc, /sandbox enabled/i); assert.match(doc, /trusted sender/i); assert.match(doc, /main frame/i);
});

test("hardening is enforced locally and in permanent CI", () => {
  for (const file of ["scripts/check-performance-budgets.mjs", "scripts/test-database-recovery.cjs", "scripts/css-hygiene.mjs", "scripts/ci-electron-smoke.cjs", ".github/workflows/quality.yml"]) assert.ok(fs.existsSync(path.join(root, file)), file + " missing");
  const workflow = read(".github/workflows/quality.yml");
  assert.match(workflow, /ubuntu-latest/); assert.match(workflow, /windows-latest/); assert.match(workflow, /npm run release:check/); assert.match(workflow, /ci-electron-smoke\.cjs/); assert.match(workflow, /discord-activity/);
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.check, /bridge:check/); assert.match(pkg.scripts.check, /boundaries:check/); assert.match(pkg.scripts.check, /css:dedup:check/);
  assert.match(pkg.scripts.check, /typecheck/); assert.match(pkg.scripts.check, /db:recovery-test/); assert.match(pkg.scripts["hardening:check"], /performance:check/);
  assert.match(pkg.scripts["release:check"], /hardening:check/); assert.match(pkg.scripts["release:check"], /assets:compress:dry/);
});
