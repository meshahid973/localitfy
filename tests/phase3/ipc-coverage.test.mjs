import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function collectInvokeChannels(source) {
  return new Set([...source.matchAll(/ipcRenderer\.invoke\(\s*["']([^"']+)["']/g)].map((match) => match[1]));
}

function collectHandledChannels(source) {
  return new Set([
    ...[...source.matchAll(/ipcRouter\.handle\(\s*["']([^"']+)["']/g)].map((match) => match[1]),
    ...[...source.matchAll(/handle\(\s*["']([^"']+)["']/g)].map((match) => match[1]),
    ...[...source.matchAll(/ipcMain\.handle\(\s*["']([^"']+)["']/g)].map((match) => match[1])
  ]);
}

test("every preload invoke channel has a native handler owner", () => {
  const preload = read("electron/preload.cjs");
  const nativeSources = [
    read("electron/main.cjs"),
    read("electron/ipc/router.cjs"),
    read("electron/ipc/discord.cjs")
  ].join("\n");

  const invokes = collectInvokeChannels(preload);
  const handlers = collectHandledChannels(nativeSources);
  const missing = [...invokes].filter((channel) => !handlers.has(channel)).sort();

  assert.ok(invokes.size >= 50, `expected a substantial preload invoke surface, got ${invokes.size}`);
  assert.deepEqual(missing, [], `preload invoke channels without handlers: ${missing.join(", ")}`);
});
