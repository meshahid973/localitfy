import fs from "node:fs";

const mainPath = "electron/main.cjs";
let source = fs.readFileSync(mainPath, "utf8");

function requireReplace(search, replacement, label) {
  if (!source.includes(search)) {
    if (replacement && source.includes(replacement.trim())) return;
    throw new Error(`[r3-user-data] could not find ${label}`);
  }
  source = source.replace(search, replacement);
}

requireReplace(
  'const { loadLocaltifyEnv } = require("./runtime/environment.cjs");\n',
  'const { loadLocaltifyEnv } = require("./runtime/environment.cjs");\nconst { createUserDataRuntime } = require("./runtime/user-data.cjs");\n',
  "user-data runtime import insertion"
);

const startMarker = 'const APP_NAME = "localtify";';
const endMarker = 'let mainWindow = null;';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

const replacement = `const APP_NAME = "localtify";
const APP_USER_MODEL_ID = "com.meshahid973.localitfy";

const userDataRuntime = createUserDataRuntime({
  app,
  legacyAppDataName: "localitfy",
  sqliteFileName: "localitfy.sqlite"
});
userDataRuntime.configureStableUserDataPath();
const restoreDatabaseFromOldUserDataIfNeeded = userDataRuntime.restoreDatabaseFromOldUserDataIfNeeded;

try {
  app.setName(APP_NAME);
} catch {
}

if (process.platform === "win32") {
  try {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  } catch {
  }
}

let mainWindow = null;`;

if (start < 0 || end < 0) {
  if (!source.includes("createUserDataRuntime({")) {
    throw new Error("[r3-user-data] could not locate inline user-data runtime block");
  }
} else {
  source = source.slice(0, start) + replacement + source.slice(end + endMarker.length);
}

for (const legacyName of [
  "function uniquePaths(",
  "function getStableUserDataPath(",
  "function configureStableUserDataPath(",
  "function getUserDataRecoveryCandidates(",
  "function getCandidateDatabaseInfo(",
  "function restoreDatabaseFromOldUserDataIfNeeded()"
]) {
  if (source.includes(legacyName)) {
    throw new Error(`[r3-user-data] main.cjs still owns ${legacyName}`);
  }
}

fs.writeFileSync(mainPath, source);
console.log("[r3-user-data] user-data path and database recovery moved to runtime/user-data.cjs");
