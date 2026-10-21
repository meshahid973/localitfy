import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = fs.readFileSync(path.join(root, "src/features/player/engine/playerController.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { createPlayerController } = mod.exports;

test("transport facade forwards to one audio engine without owning a second queue", async () => {
  const calls = [];
  const engine = {
    load: source => calls.push(["load", source.id]),
    play: async () => { calls.push(["play"]); },
    pause: () => calls.push(["pause"]),
    toggle: async () => true,
    seek: time => calls.push(["seek", time]),
    setVolume: volume => calls.push(["volume", volume]),
    getState: () => ({ currentTime: 30 }),
    destroy: () => calls.push(["destroy"]),
    on: () => { throw new Error("No duplicate media event subscriptions expected"); }
  };
  const controller = createPlayerController(engine);
  controller.load({ id: "song", url: "localtify-media://file/token" });
  await controller.play();
  controller.seekBy(12);
  controller.seekTo(5);
  controller.setVolume(0.4);
  controller.pause();
  controller.destroy();
  assert.deepEqual(calls, [
    ["load", "song"], ["play"], ["seek", 42], ["seek", 5], ["volume", 0.4], ["pause"], ["destroy"]
  ]);
  assert.equal("setQueue" in controller, false);
  assert.equal("next" in controller, false);
});

test("HtmlAudioEngine does not read media state when no listeners subscribed", () => {
  const htmlEngine = fs.readFileSync(path.join(root, "src/features/player/engine/htmlAudioEngine.ts"), "utf8");
  const guarded = /const eventListeners = this\.listeners\.get\(event\);\s*if \(!eventListeners\?\.size\) return;\s*const state = this\.getState\(\)/;
  assert.match(htmlEngine, guarded);
});
