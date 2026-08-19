import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Discord renderer updates dedupe persistent state instead of timer reasons", () => {
  const source = read("src/App.tsx");
  assert.match(source, /discordLastPayloadKeyRef\s*=\s*useRef/);
  assert.doesNotMatch(source, /chosenDiscordAsset,\s*reason\s*\]/);
  assert.match(source, /discordGithubUrl:\s*LOCALITFY_SOURCE_URL/);
});

test("Discord RPC does not roll new art just for a fresh resume", () => {
  const source = read("electron/rpc.cjs");
  assert.doesNotMatch(source, /const resumedFresh\s*=/);
  assert.doesNotMatch(source, /playbackRestarted\s*\|\|\s*resumedFresh/);
});

test("Discord download and source buttons have distinct canonical URLs", () => {
  const constants = read("src/features/discord/discord.constants.ts");
  assert.match(constants, /LOCALITFY_DOWNLOAD_URL\s*=\s*"https:\/\/github\.com\/meshahid973\/localitfy\/releases\/latest"/);
  assert.match(constants, /LOCALITFY_SOURCE_URL\s*=\s*"https:\/\/github\.com\/meshahid973\/localitfy"/);
});

test("renderer root is protected by the Localitfy error boundary", () => {
  const rootSource = read("src/main.tsx");
  const boundary = read("src/app/AppErrorBoundary.tsx");
  assert.match(rootSource, /<AppErrorBoundary>[\s\S]*<App \/>[\s\S]*<\/AppErrorBoundary>/);
  assert.match(boundary, /Restart/);
  assert.match(boundary, /Copy error/);
  assert.match(boundary, /Open logs/);
});

test("error recovery bridge reuses restart IPC and exposes logs", () => {
  const preload = read("electron/preload.cjs");
  const main = read("electron/main.cjs");
  assert.match(preload, /restartApp:.*localitfy:restart-app/);
  assert.match(preload, /openLogsFolder:.*localitfy:open-logs/);
  assert.equal((main.match(/ipcRouter\.handle\("localitfy:restart-app"/g) || []).length, 1);
  assert.equal((main.match(/ipcRouter\.handle\("localitfy:open-logs"/g) || []).length, 1);
});
