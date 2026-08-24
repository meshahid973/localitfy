import fs from "node:fs";

const mainPath = "electron/main.cjs";
let source = fs.readFileSync(mainPath, "utf8");

function requireReplace(search, replacement, label) {
  if (!source.includes(search)) {
    if (replacement && source.includes(replacement.trim())) return;
    throw new Error(`[r3-env] could not find ${label}`);
  }
  source = source.replace(search, replacement);
}

requireReplace(
  'const { createElectronServiceRuntime } = require("./runtime/services.cjs");\n',
  'const { createElectronServiceRuntime } = require("./runtime/services.cjs");\nconst { loadLocaltifyEnv } = require("./runtime/environment.cjs");\n',
  "environment runtime import insertion"
);

const functionStart = source.indexOf("function loadLocaltifyEnv() {");
const callMarker = "\n\nloadLocaltifyEnv();\nregisterPrivilegedSchemes(protocol);";
const functionEnd = source.indexOf(callMarker, functionStart);

if (functionStart < 0 || functionEnd < 0) {
  if (!source.includes("loadLocaltifyEnv(app);")) {
    throw new Error("[r3-env] could not locate inline environment loader");
  }
} else {
  source =
    source.slice(0, functionStart) +
    "loadLocaltifyEnv(app);\nregisterPrivilegedSchemes(protocol);" +
    source.slice(functionEnd + callMarker.length);
}

if (source.includes("function loadLocaltifyEnv()")) {
  throw new Error("[r3-env] main.cjs still owns loadLocaltifyEnv");
}
if (!source.includes('require("./runtime/environment.cjs")')) {
  throw new Error("[r3-env] main.cjs is missing environment runtime import");
}
if (!source.includes("loadLocaltifyEnv(app);")) {
  throw new Error("[r3-env] main.cjs does not invoke extracted environment runtime");
}

fs.writeFileSync(mainPath, source);
console.log("[r3-env] Electron environment loading moved to runtime/environment.cjs");
