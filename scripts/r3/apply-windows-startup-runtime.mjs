import fs from "node:fs";

function replaceBlock(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    if (source.includes(replacement.trim())) return source;
    throw new Error(`[r3-windows] could not locate ${label}`);
  }
  return source.slice(0, start) + replacement + source.slice(end + endMarker.length);
}

const mainPath = "electron/main.cjs";
let main = fs.readFileSync(mainPath, "utf8");
main = main.replace(
  'const { DEFAULT_WINDOW_TRANSLUCENCY, normalizeWindowTranslucencySettings } = require("./runtime/windows.cjs");',
  'const { DEFAULT_WINDOW_TRANSLUCENCY, normalizeWindowTranslucencySettings, createWindowsStartupRuntime } = require("./runtime/windows.cjs");'
);

main = replaceBlock(
  main,
  'function getLoginItemOptions(openAtLogin = false) {',
  'function sendPlayerCommand(command) {',
  `const windowsStartupRuntime = createWindowsStartupRuntime({\n  app,\n  isDev,\n  appName: APP_NAME,\n  saveSettings\n});\nconst getStartWithWindowsStatus = windowsStartupRuntime.getStatus;\nconst setStartWithWindows = windowsStartupRuntime.setEnabled;\nconst syncWindowsIntegrationSettings = windowsStartupRuntime.syncSettings;\n\nfunction sendPlayerCommand(command) {`,
  "main Windows startup block"
);

if (main.includes("function getLoginItemOptions(openAtLogin = false)")) {
  throw new Error("[r3-windows] main still owns login item option logic");
}
fs.writeFileSync(mainPath, main);

const nativePath = "electron/native-media.cjs";
let native = fs.readFileSync(nativePath, "utf8");
const electronImportEnd = '} = require("electron");';
const electronImportIndex = native.indexOf(electronImportEnd);
if (electronImportIndex < 0) throw new Error("[r3-windows] native Electron import not found");
const runtimeImport = '\nconst { createWindowsStartupRuntime } = require("./runtime/windows.cjs");';
if (!native.includes(runtimeImport.trim())) {
  native = native.slice(0, electronImportIndex + electronImportEnd.length) + runtimeImport + native.slice(electronImportIndex + electronImportEnd.length);
}

native = replaceBlock(
  native,
  'function getLoginItemOptions(openAtLogin = false) {',
  'function safeSend(command) {',
  `const windowsStartupRuntime = createWindowsStartupRuntime({\n  app,\n  isDev: !app.isPackaged,\n  appName: "localtify"\n});\nconst getStartWithWindowsStatus = windowsStartupRuntime.getStatus;\nconst setStartWithWindows = windowsStartupRuntime.setEnabled;\n\nfunction safeSend(command) {`,
  "native-media Windows startup block"
);

if (native.includes("function getLoginItemOptions(openAtLogin = false)")) {
  throw new Error("[r3-windows] native-media still owns login item option logic");
}
fs.writeFileSync(nativePath, native);

console.log("[r3-windows] centralized Windows startup runtime for main and native-media");
