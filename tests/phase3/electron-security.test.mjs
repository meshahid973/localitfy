import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createIpcRouter } = require(path.join(root, "electron", "ipc", "router.cjs"));
const {
  isAllowedRendererNavigation,
  installRendererSecurityGuards,
  installSessionPermissionGuards
} = require(path.join(root, "electron", "runtime", "security.cjs"));

test("renderer navigation policy only trusts Localtify renderer locations", () => {
  assert.equal(isAllowedRendererNavigation("localitfy://app/index.html"), true);
  assert.equal(isAllowedRendererNavigation("file:///tmp/localitfy/dist/index.html"), true);
  assert.equal(isAllowedRendererNavigation("http://localhost:5173", { isDev: true }), true);
  assert.equal(isAllowedRendererNavigation("http://127.0.0.1:5173/foo", { isDev: true }), true);
  assert.equal(isAllowedRendererNavigation("https://example.com"), false);
  assert.equal(isAllowedRendererNavigation("javascript:alert(1)"), false);
  assert.equal(isAllowedRendererNavigation("data:text/html,hello"), false);
});

test("renderer security guards deny child windows, webviews, and external navigation", () => {
  const listeners = new Map();
  let windowOpenHandler = null;
  const webContents = {
    setWindowOpenHandler(handler) { windowOpenHandler = handler; },
    on(name, handler) { listeners.set(name, handler); }
  };
  const win = { isDestroyed: () => false, webContents };

  assert.equal(installRendererSecurityGuards(win, { isDev: false }), true);
  assert.deepEqual(windowOpenHandler({ url: "https://example.com" }), { action: "deny" });

  let blocked = false;
  listeners.get("will-navigate")({ preventDefault: () => { blocked = true; } }, "https://example.com");
  assert.equal(blocked, true);

  blocked = false;
  listeners.get("will-navigate")({ preventDefault: () => { blocked = true; } }, "localitfy://app/index.html");
  assert.equal(blocked, false);

  let webviewBlocked = false;
  listeners.get("will-attach-webview")({ preventDefault: () => { webviewBlocked = true; } });
  assert.equal(webviewBlocked, true);
});

test("session permission guards deny renderer permission escalation", () => {
  let requestHandler = null;
  let checkHandler = null;
  const fakeSession = {
    setPermissionRequestHandler(handler) { requestHandler = handler; },
    setPermissionCheckHandler(handler) { checkHandler = handler; }
  };

  assert.equal(installSessionPermissionGuards(fakeSession), true);
  let allowed = true;
  requestHandler(null, "media", (value) => { allowed = value; });
  assert.equal(allowed, false);
  assert.equal(checkHandler(null, "geolocation"), false);
});

test("IPC router rejects handlers invoked by untrusted senders", async () => {
  let registeredHandler = null;
  const ipcMain = {
    handle(_channel, handler) { registeredHandler = handler; }
  };
  const trustedSender = {};
  const router = createIpcRouter(ipcMain, {
    isTrustedEvent: (event) => event?.sender === trustedSender
  });
  router.handle("security:test", async (_event, value) => `ok:${value}`);

  await assert.rejects(() => registeredHandler({ sender: {} }, "bad"), /untrusted IPC sender/);
  assert.equal(await registeredHandler({ sender: trustedSender }, "good"), "ok:good");
});
