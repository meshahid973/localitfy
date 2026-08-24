import fs from "node:fs";

const mainPath = "electron/main.cjs";
let main = fs.readFileSync(mainPath, "utf8");

const securityImport = 'const { installRendererSecurityGuards, installSessionPermissionGuards, isTrustedMainFrameIpcEvent } = require("./runtime/security.cjs");';
const iconRuntimeImport = 'const { createIconRuntime } = require("./runtime/icons.cjs");';
const translucencyRuntimeImport = 'const { createWindowTranslucencyRuntime } = require("./runtime/translucency.cjs");';
const runtimeImportAnchor = 'const { createUserDataRuntime } = require("./runtime/user-data.cjs");';

if (!main.includes(securityImport)) {
  const oldSecurityImport = 'const { installRendererSecurityGuards, installSessionPermissionGuards } = require("./runtime/security.cjs");';
  if (main.includes(oldSecurityImport)) {
    main = main.replace(oldSecurityImport, securityImport);
  } else {
    if (!main.includes(runtimeImportAnchor)) throw new Error("[r6] security import anchor missing");
    main = main.replace(runtimeImportAnchor, `${runtimeImportAnchor}\n${securityImport}`);
  }
}

if (!main.includes(iconRuntimeImport)) {
  if (!main.includes(runtimeImportAnchor)) throw new Error("[r6] icon runtime import anchor missing");
  main = main.replace(runtimeImportAnchor, `${runtimeImportAnchor}\n${iconRuntimeImport}`);
}

if (!main.includes(translucencyRuntimeImport)) {
  if (!main.includes(runtimeImportAnchor)) throw new Error("[r6] translucency runtime import anchor missing");
  main = main.replace(runtimeImportAnchor, `${runtimeImportAnchor}\n${translucencyRuntimeImport}`);
}

const oldRouter = "const ipcRouter = createIpcRouter(ipcMain);";
const previousRouter = `function isTrustedMainWindowIpcEvent(event) {\n  try {\n    return Boolean(\n      mainWindow &&\n      !mainWindow.isDestroyed() &&\n      event?.sender === mainWindow.webContents\n    );\n  } catch {\n    return false;\n  }\n}\n\nconst ipcRouter = createIpcRouter(ipcMain, {\n  isTrustedEvent: isTrustedMainWindowIpcEvent\n});`;
const wrappedRouter = `function isTrustedMainWindowIpcEvent(event) {\n  return isTrustedMainFrameIpcEvent(event, mainWindow);\n}\n\nconst ipcRouter = createIpcRouter(ipcMain, {\n  isTrustedEvent: isTrustedMainWindowIpcEvent\n});`;
const trustedRouter = `const ipcRouter = createIpcRouter(ipcMain, {\n  isTrustedEvent: (event) => isTrustedMainFrameIpcEvent(event, mainWindow)\n});`;

if (main.includes(oldRouter)) main = main.replace(oldRouter, trustedRouter);
else if (main.includes(previousRouter)) main = main.replace(previousRouter, trustedRouter);
else if (main.includes(wrappedRouter)) main = main.replace(wrappedRouter, trustedRouter);
else if (!main.includes("isTrustedMainFrameIpcEvent(event, mainWindow)")) throw new Error("[r6] IPC router anchor missing");

main = main.replace("sandbox: false,", "sandbox: true,");

const webSecurityAnchor = "      webSecurity: true,";
const hardenedPreferences = `      webSecurity: true,\n      webviewTag: false,\n      allowRunningInsecureContent: false,\n      navigateOnDragDrop: false,`;
if (main.includes(webSecurityAnchor) && !main.includes("navigateOnDragDrop: false")) {
  main = main.replace(webSecurityAnchor, hardenedPreferences);
}

const rendererPathAnchor = '  const rendererIndexPath = isDev ? "" : getRendererIndexPath();';
const guardCall = `${rendererPathAnchor}\n  installRendererSecurityGuards(mainWindow, {\n    isDev,\n    rendererFileRoot: rendererIndexPath ? path.dirname(rendererIndexPath) : ""\n  });\n  installSessionPermissionGuards(mainWindow.webContents?.session);`;
if (!main.includes("installRendererSecurityGuards(mainWindow")) {
  if (!main.includes(rendererPathAnchor)) throw new Error("[r6] renderer path guard insertion anchor missing");
  main = main.replace(rendererPathAnchor, guardCall);
} else {
  main = main.replace(
    /  installRendererSecurityGuards\(mainWindow, \{ isDev \}\);\n  installSessionPermissionGuards\(mainWindow\.webContents\?\.session\);\n/g,
    `  installRendererSecurityGuards(mainWindow, {\n    isDev,\n    rendererFileRoot: rendererIndexPath ? path.dirname(rendererIndexPath) : ""\n  });\n  installSessionPermissionGuards(mainWindow.webContents?.session);\n`
  );
}

const iconBlockStart = main.indexOf("function createSvgNativeImage(iconName) {");
const iconBlockEndMarker = `function createThumbarIcon(iconName) {\n  return createSvgNativeImage(iconName).resize({ width: 20, height: 20 });\n}\n\n`;
const iconRuntimeSetup = `const { loadAppIcon, loadTrayIcon, createThumbarIcon } = createIconRuntime({\n  app,\n  nativeImage,\n  getIsPlaying: () => nativeMediaState.isPlaying\n});\n\n`;

if (iconBlockStart >= 0) {
  const markerStart = main.indexOf(iconBlockEndMarker, iconBlockStart);
  if (markerStart < 0) throw new Error("[r6] native icon block end anchor missing");
  const iconBlockEnd = markerStart + iconBlockEndMarker.length;
  main = `${main.slice(0, iconBlockStart)}${iconRuntimeSetup}${main.slice(iconBlockEnd)}`;
} else if (!main.includes("createIconRuntime({")) {
  throw new Error("[r6] native icon runtime extraction anchor missing");
}

const translucencyBlockStart = main.indexOf("function getSavedWindowTranslucencySettings() {");
const translucencyBlockEndMarker = "const UPDATE_CHECK_STARTUP_DELAY_MS = 2200;";
const translucencyRuntimeSetup = `const {\n  getSavedWindowTranslucencySettings,\n  applyWindowTranslucencyToWindow,\n  restartForWindowTranslucency,\n  reloadMainWindowForTranslucency\n} = createWindowTranslucencyRuntime({\n  app,\n  getSettings,\n  getMainWindow: () => mainWindow,\n  setMainWindow: (win) => { mainWindow = win; },\n  createWindow,\n  setAllowQuit: (value) => { allowQuit = Boolean(value); }\n});\n\n`;

if (translucencyBlockStart >= 0) {
  const translucencyBlockEnd = main.indexOf(translucencyBlockEndMarker, translucencyBlockStart);
  if (translucencyBlockEnd < 0) throw new Error("[r6] translucency block end anchor missing");
  main = `${main.slice(0, translucencyBlockStart)}${translucencyRuntimeSetup}${main.slice(translucencyBlockEnd)}`;
} else if (!main.includes("createWindowTranslucencyRuntime({")) {
  throw new Error("[r6] window translucency extraction anchor missing");
}

if (/sandbox:\s*false/.test(main)) throw new Error("[r6] main window still unsandboxed");
if (!main.includes("createIpcRouter(ipcMain, {")) throw new Error("[r6] trusted IPC router not installed");
if (!main.includes("isTrustedMainFrameIpcEvent(event, mainWindow)")) throw new Error("[r6] IPC trust is not main-frame scoped");
if (!main.includes("rendererFileRoot: rendererIndexPath ? path.dirname(rendererIndexPath)")) throw new Error("[r6] file renderer trust is not directory scoped");
if (!main.includes("installRendererSecurityGuards(mainWindow")) throw new Error("[r6] renderer guards not installed");
if (!main.includes("createIconRuntime({")) throw new Error("[r6] native icon helpers were not extracted from main");
if (!main.includes("createWindowTranslucencyRuntime({")) throw new Error("[r6] window translucency helpers were not extracted from main");
if (Buffer.byteLength(main, "utf8") > 204 * 1024) throw new Error("[r6] electron/main.cjs still exceeds the 204 KiB architecture budget");

fs.writeFileSync(mainPath, main);

const hardeningPath = "tests/phase3/hardening.test.mjs";
let hardening = fs.readFileSync(hardeningPath, "utf8");
hardening = hardening.replace(
  'test("sandbox state is explicit and documented", () => {',
  'test("main renderer sandbox is enabled and documented", () => {'
);
hardening = hardening.replace('  assert.match(main, /sandbox:\\s*false/);\n', "");
hardening = hardening.replace(
  '  assert.match(main, /sandbox:\\s*true/);\n  assert.match(doc, /compatibility checkpoint/i);\n  assert.match(doc, /sandbox-enabled canary build/i);',
  '  assert.match(main, /sandbox:\\s*true/);\n  assert.doesNotMatch(main, /sandbox:\\s*false/);\n  assert.match(main, /webviewTag:\\s*false/);\n  assert.match(main, /allowRunningInsecureContent:\\s*false/);\n  assert.match(main, /navigateOnDragDrop:\\s*false/);\n  assert.match(main, /isTrustedMainFrameIpcEvent/);\n  assert.match(main, /rendererFileRoot/);\n  assert.match(main, /installRendererSecurityGuards/);\n  assert.match(main, /createIconRuntime/);\n  assert.match(main, /createWindowTranslucencyRuntime/);\n  assert.match(doc, /sandbox enabled/i);\n  assert.match(doc, /trusted sender/i);\n  assert.match(doc, /main frame/i);'
);
fs.writeFileSync(hardeningPath, hardening);

const docPath = "docs/architecture/electron-sandbox.md";
const doc = `# Electron sandbox and renderer trust boundary\n\n## Current security boundary\n\nLocalitfy now runs the main renderer with \`nodeIntegration: false\`, \`contextIsolation: true\`, \`webSecurity: true\`, and **sandbox enabled**. The Spotify OAuth child window remains sandboxed as well.\n\nThe preload bridge uses \`contextBridge\` + \`ipcRenderer\` only; it does not depend on arbitrary Node modules in renderer scope. Privileged work stays in the Electron main process behind named IPC handlers.\n\n## Navigation and child-window policy\n\nThe main renderer cannot create arbitrary child windows or attach webviews. Renderer-initiated navigation is restricted to Localitfy's packaged \`localitfy://app\` renderer, the exact packaged renderer directory used by the legacy \`file://\` fallback, and the loopback Vite origin during development. Arbitrary local HTML files are not trusted. External URLs must go through the explicit main-process external-open IPC path.\n\nBrowser permission requests are denied by default because Localitfy does not require camera, microphone, geolocation, notifications, MIDI, or other Chromium permissions for local playback.\n\n## IPC trust boundary\n\nEvery handler registered through the centralized IPC router is protected by a **trusted sender** check. Calls are accepted only when the sender is the current main Localitfy window's \`webContents\` **and** the IPC call originated from that webContents' main frame. Child windows, iframes, and unrelated renderer contexts cannot invoke privileged Localitfy IPC channels.\n\nThis is intentionally enforced in the router rather than copied into dozens of individual handlers so new IPC channels inherit the same security boundary automatically.\n\n## Main-process ownership\n\nNative icon discovery and image creation live in \`electron/runtime/icons.cjs\` rather than the main-process orchestrator. Window translucency state, restart, and reload behavior live in \`electron/runtime/translucency.cjs\`. These ownership boundaries keep \`electron/main.cjs\` under its architecture budget while preserving tray, taskbar, packaged-resource, and window behavior.\n\n## Non-negotiable invariants\n\n- \`nodeIntegration: false\`\n- \`contextIsolation: true\`\n- \`sandbox: true\`\n- \`webSecurity: true\`\n- \`webviewTag: false\`\n- insecure mixed-content execution disabled\n- drag/drop navigation disabled\n- renderer-created windows denied\n- renderer navigation restricted to Localitfy-owned origins/paths\n- browser permissions denied unless a future feature introduces an explicit reviewed allow-list\n- privileged IPC accepted only from the active main Localitfy renderer's main frame\n\nThe Windows and Linux/native smoke matrix is the release gate for keeping these guarantees compatible with playback, imports, downloads, updater controls, tray/media integration, startup-at-login, custom protocols, and OAuth.\n`;
fs.writeFileSync(docPath, doc);

console.log("[r6] enabled renderer sandbox, hardened navigation/IPC, and reduced main-process ownership");
