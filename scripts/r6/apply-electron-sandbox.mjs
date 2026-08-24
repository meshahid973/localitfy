import fs from "node:fs";

const mainPath = "electron/main.cjs";
let main = fs.readFileSync(mainPath, "utf8");

const securityImport = 'const { installRendererSecurityGuards, installSessionPermissionGuards } = require("./runtime/security.cjs");';
if (!main.includes(securityImport)) {
  const anchor = 'const { createUserDataRuntime } = require("./runtime/user-data.cjs");';
  if (!main.includes(anchor)) throw new Error("[r6] security import anchor missing");
  main = main.replace(anchor, `${anchor}\n${securityImport}`);
}

const oldRouter = "const ipcRouter = createIpcRouter(ipcMain);";
const newRouter = `function isTrustedMainWindowIpcEvent(event) {\n  try {\n    return Boolean(\n      mainWindow &&\n      !mainWindow.isDestroyed() &&\n      event?.sender === mainWindow.webContents\n    );\n  } catch {\n    return false;\n  }\n}\n\nconst ipcRouter = createIpcRouter(ipcMain, {\n  isTrustedEvent: isTrustedMainWindowIpcEvent\n});`;
if (main.includes(oldRouter)) main = main.replace(oldRouter, newRouter);
else if (!main.includes("isTrustedMainWindowIpcEvent")) throw new Error("[r6] IPC router anchor missing");

main = main.replace("sandbox: false,", "sandbox: true,");

const webSecurityAnchor = "      webSecurity: true,";
const hardenedPreferences = `      webSecurity: true,\n      webviewTag: false,\n      allowRunningInsecureContent: false,\n      navigateOnDragDrop: false,`;
if (main.includes(webSecurityAnchor) && !main.includes("navigateOnDragDrop: false")) {
  main = main.replace(webSecurityAnchor, hardenedPreferences);
}

const guardCall = `  installRendererSecurityGuards(mainWindow, { isDev });\n  installSessionPermissionGuards(mainWindow.webContents?.session);\n`;
if (!main.includes("installRendererSecurityGuards(mainWindow")) {
  const debugAnchor = '  if (process.env.LOCALITFY_DEBUG === "1") {';
  if (!main.includes(debugAnchor)) throw new Error("[r6] BrowserWindow guard insertion anchor missing");
  main = main.replace(debugAnchor, `${guardCall}\n${debugAnchor}`);
}

if (/sandbox:\s*false/.test(main)) throw new Error("[r6] main window still unsandboxed");
if (!main.includes("createIpcRouter(ipcMain, {")) throw new Error("[r6] trusted IPC router not installed");
if (!main.includes("installRendererSecurityGuards(mainWindow")) throw new Error("[r6] renderer guards not installed");

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
  '  assert.match(main, /sandbox:\\s*true/);\n  assert.doesNotMatch(main, /sandbox:\\s*false/);\n  assert.match(main, /webviewTag:\\s*false/);\n  assert.match(main, /allowRunningInsecureContent:\\s*false/);\n  assert.match(main, /installRendererSecurityGuards/);\n  assert.match(doc, /sandbox enabled/i);\n  assert.match(doc, /trusted sender/i);'
);
fs.writeFileSync(hardeningPath, hardening);

const docPath = "docs/architecture/electron-sandbox.md";
const doc = `# Electron sandbox and renderer trust boundary\n\n## Current security boundary\n\nLocalitfy now runs the main renderer with \`nodeIntegration: false\`, \`contextIsolation: true\`, \`webSecurity: true\`, and **sandbox enabled**. The Spotify OAuth child window remains sandboxed as well.\n\nThe preload bridge uses \`contextBridge\` + \`ipcRenderer\` only; it does not depend on arbitrary Node modules in renderer scope. Privileged work stays in the Electron main process behind named IPC handlers.\n\n## Navigation and child-window policy\n\nThe main renderer cannot create arbitrary child windows or attach webviews. Renderer-initiated navigation is restricted to Localitfy's packaged \`localitfy://app\` renderer, the packaged file fallback, and the loopback Vite origin during development. External URLs must go through the explicit main-process external-open IPC path.\n\nBrowser permission requests are denied by default because Localitfy does not require camera, microphone, geolocation, notifications, MIDI, or other Chromium permissions for local playback.\n\n## IPC trust boundary\n\nEvery handler registered through the centralized IPC router is protected by a **trusted sender** check. Calls are accepted only when the sender is the current main Localitfy window's \`webContents\`; child windows and unrelated renderer contexts cannot invoke privileged Localitfy IPC channels.\n\nThis is intentionally enforced in the router rather than copied into dozens of individual handlers so new IPC channels inherit the same security boundary automatically.\n\n## Non-negotiable invariants\n\n- \`nodeIntegration: false\`\n- \`contextIsolation: true\`\n- \`sandbox: true\`\n- \`webSecurity: true\`\n- \`webviewTag: false\`\n- insecure mixed-content execution disabled\n- renderer-created windows denied\n- browser permissions denied unless a future feature introduces an explicit reviewed allow-list\n- privileged IPC accepted only from the active main Localitfy renderer\n\nThe Windows and Linux/native smoke matrix is the release gate for keeping these guarantees compatible with playback, imports, downloads, updater controls, tray/media integration, startup-at-login, custom protocols, and OAuth.\n`;
fs.writeFileSync(docPath, doc);

console.log("[r6] enabled renderer sandbox and hardened navigation/IPC boundaries");
