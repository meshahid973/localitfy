import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createAppMenuRuntime, createAppCommandSender, MENU_VIEWS } = require("../../electron/runtime/app-menu.cjs");

function buildMenu(state, overrides = {}) {
  const sent = [];
  const runtime = createAppMenuRuntime({
    Menu: { setApplicationMenu() {}, buildFromTemplate: (template) => template },
    shell: { openExternal: async () => {} },
    sendPlayerCommand: (command) => sent.push(["player", command]),
    sendAppCommand: (command) => sent.push(["app", command]),
    requestQuit: () => sent.push(["quit"]),
    ...overrides
  });
  return { template: runtime.buildTemplate(state), sent };
}

const items = (template) => template.flatMap((menu) => menu.submenu || []);
const find = (template, label) => items(template).find((item) => item.label === label);

test("menu shortcuts are unique", () => {
  const accelerators = items(buildMenu({ hasSong: true }).template).map((item) => item.accelerator).filter(Boolean);
  assert.deepEqual(accelerators, [...new Set(accelerators)]);
});

test("playback keys stay with the renderer so text fields keep Space and ⌘←/⌘→", () => {
  const { template } = buildMenu({ hasSong: true, isPlaying: true });
  for (const label of ["Pause", "Next", "Previous"]) assert.equal(find(template, label).registerAccelerator, false, label);
  assert.equal(find(buildMenu({ hasSong: true, isPlaying: false }).template, "Play").enabled, true);
  assert.equal(find(buildMenu({ hasSong: false }).template, "Play").enabled, false);
});

test("menu items forward commands to the renderer and player", () => {
  const { template, sent } = buildMenu({ hasSong: true });
  find(template, "Albums").click();
  find(template, "Find").click();
  find(template, "Play").click();
  assert.deepEqual(sent, [
    ["app", { type: "navigate", view: "albums" }],
    ["app", { type: "find" }],
    ["player", { type: "toggle", source: "menu" }]
  ]);
});

test("menu views exist in the renderer and are handled there", () => {
  const viewType = fs.readFileSync("src/features/shell/view.types.ts", "utf8");
  for (const [view] of MENU_VIEWS) assert.match(viewType, new RegExp(`"${view}"`), view);
  const hook = fs.readFileSync("src/features/shell/useAppMenuCommands.ts", "utf8");
  for (const type of ["navigate", "back", "forward", "settings", "import-music", "import-album-folder", "new-playlist", "find", "feedback", "check-updates"]) {
    assert.match(hook, new RegExp(`case "${type}"`), type);
  }
});

test("a command that reopens the window waits until the renderer is listening", async () => {
  const handlers = new Map();
  const sent = [];
  const contents = { isDestroyed: () => false, send: (channel, payload) => sent.push([channel, payload]) };
  let window = null;
  const send = createAppCommandSender({
    ipcRouter: { handle: (channel, handler) => handlers.set(channel, handler) },
    showMainWindow: () => { window = { webContents: contents }; },
    getWindow: () => window
  });
  send({ type: "navigate", view: "albums" });
  assert.deepEqual(sent, []);
  const ready = handlers.get("localitfy:app-menu-ready");
  assert.deepEqual(await ready({ sender: contents }), { type: "navigate", view: "albums" });
  assert.equal(await ready({ sender: contents }), null);
  send({ type: "find" });
  assert.deepEqual(sent, [["app-menu:command", { type: "find" }]]);
});
