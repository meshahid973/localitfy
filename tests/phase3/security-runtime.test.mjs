import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const {
  isAllowedRendererNavigation,
  isFileInsideRoot,
  isTrustedMainFrameIpcEvent,
  installRendererSecurityGuards,
  installSessionPermissionGuards
} = require(path.join(root, "electron", "runtime", "security.cjs"));
const { LOCALTIFY_RENDERER_PROTOCOL } = require(path.join(root, "electron", "runtime", "protocols.cjs"));
const { createIpcRouter } = require(path.join(root, "electron", "ipc", "router.cjs"));

test("renderer navigation stays inside Localtify-owned origins", () => {
  const rendererRoot = path.join(root, "dist");
  const insideFile = pathToFileURL(path.join(rendererRoot, "index.html")).href;
  const outsideFile = pathToFileURL(path.join(root, "package.json")).href;
  const rendererUrl = `${LOCALTIFY_RENDERER_PROTOCOL}://app/index.html`;
  const wrongHostUrl = `${LOCALTIFY_RENDERER_PROTOCOL}://evil/index.html`;

  assert.equal(LOCALTIFY_RENDERER_PROTOCOL, "localtify-renderer");
  assert.equal(isAllowedRendererNavigation(rendererUrl, { rendererFileRoot: rendererRoot }), true);
  assert.equal(isAllowedRendererNavigation(wrongHostUrl, { rendererFileRoot: rendererRoot }), false);
  assert.equal(isAllowedRendererNavigation("localitfy://app/index.html", { rendererFileRoot: rendererRoot }), false);
  assert.equal(isAllowedRendererNavigation(insideFile, { rendererFileRoot: rendererRoot }), true);
  assert.equal(isAllowedRendererNavigation(outsideFile, { rendererFileRoot: rendererRoot }), false);
  assert.equal(isAllowedRendererNavigation("file:///tmp/untrusted.html", {}), false);
  assert.equal(isAllowedRendererNavigation("http://127.0.0.1:5173/", { isDev: true }), true);
  assert.equal(isAllowedRendererNavigation("http://localhost:5173/library", { isDev: true }), true);
  assert.equal(isAllowedRendererNavigation("http://localhost:5174/", { isDev: true }), false);
  assert.equal(isAllowedRendererNavigation("https://example.com/", { isDev: true }), false);
});

test("packaged file fallback is directory scoped", () => {
  const rendererRoot = path.join(root, "dist");
  assert.equal(isFileInsideRoot(path.join(rendererRoot, "index.html"), rendererRoot), true);
  assert.equal(isFileInsideRoot(path.join(rendererRoot, "assets", "app.js"), rendererRoot), true);
  assert.equal(isFileInsideRoot(path.join(root, "dist-evil", "index.html"), rendererRoot), false);
  assert.equal(isFileInsideRoot(path.join(root, "package.json"), rendererRoot), false);
});

test("privileged IPC trusts only the main frame", () => {
  const mainFrame = { id: "main" };
  const webContents = { mainFrame };
  const win = { isDestroyed: () => false, webContents };

  assert.equal(isTrustedMainFrameIpcEvent({ sender: webContents, senderFrame: mainFrame }, win), true);
  assert.equal(isTrustedMainFrameIpcEvent({ sender: webContents, senderFrame: { id: "iframe" } }, win), false);
  assert.equal(isTrustedMainFrameIpcEvent({ sender: {}, senderFrame: mainFrame }, win), false);
  assert.equal(isTrustedMainFrameIpcEvent(null, win), false);
});

test("IPC router rejects untrusted senders before invoking handlers", async () => {
  let registeredHandler = null;
  let calls = 0;
  const ipcMain = {
    handle(_channel, handler) {
      registeredHandler = handler;
    }
  };
  const router = createIpcRouter(ipcMain, {
    isTrustedEvent: (event) => event?.trusted === true
  });
  router.handle("security:test", async (_event, value) => {
    calls += 1;
    return value;
  });

  await assert.rejects(() => registeredHandler({ trusted: false }, "nope"), /untrusted IPC sender/);
  assert.equal(calls, 0);
  assert.equal(await registeredHandler({ trusted: true }, "ok"), "ok");
  assert.equal(calls, 1);
});

test("renderer guards deny new windows, foreign navigation, webviews and browser permissions", () => {
  const listeners = new Map();
  let windowOpenHandler = null;
  const webContents = {
    setWindowOpenHandler(handler) {
      windowOpenHandler = handler;
    },
    on(name, handler) {
      listeners.set(name, handler);
    }
  };
  const win = { isDestroyed: () => false, webContents };
  assert.equal(installRendererSecurityGuards(win, { isDev: true }), true);
  assert.deepEqual(windowOpenHandler({ url: "https://example.com" }), { action: "deny" });

  let prevented = 0;
  const event = { preventDefault: () => { prevented += 1; } };
  listeners.get("will-navigate")(event, "https://example.com");
  listeners.get("will-redirect")(event, "https://example.com");
  listeners.get("will-attach-webview")(event);
  assert.equal(prevented, 3);

  let permissionRequestHandler = null;
  let permissionCheckHandler = null;
  const electronSession = {
    setPermissionRequestHandler(handler) {
      permissionRequestHandler = handler;
    },
    setPermissionCheckHandler(handler) {
      permissionCheckHandler = handler;
    }
  };
  assert.equal(installSessionPermissionGuards(electronSession), true);
  let permissionResult = true;
  permissionRequestHandler(null, "camera", (allowed) => { permissionResult = allowed; });
  assert.equal(permissionResult, false);
  assert.equal(permissionCheckHandler(null, "camera"), false);
});
