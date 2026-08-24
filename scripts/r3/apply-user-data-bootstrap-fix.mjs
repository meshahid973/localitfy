import fs from "node:fs";

const mainPath = "electron/main.cjs";
let source = fs.readFileSync(mainPath, "utf8");

function requireReplace(search, replacement, label) {
  if (!source.includes(search)) {
    if (replacement && source.includes(replacement)) return;
    throw new Error(`[r3-user-data-fix] could not find ${label}`);
  }
  source = source.replace(search, replacement);
}

requireReplace(
  'path.join(app.getPath("userData"), SQLITE_FILE_NAME)',
  'path.join(app.getPath("userData"), userDataRuntime.sqliteFileName)',
  "database fallback path"
);
requireReplace(
  'dataFolderName: LEGACY_APP_DATA_NAME',
  'dataFolderName: userDataRuntime.dataFolderName',
  "bootstrap data folder name"
);

if (/\bLEGACY_APP_DATA_NAME\b/.test(source) || /\bSQLITE_FILE_NAME\b/.test(source)) {
  throw new Error("[r3-user-data-fix] removed user-data constants still referenced in main.cjs");
}

fs.writeFileSync(mainPath, source);
console.log("[r3-user-data-fix] Electron bootstrap now reads DB/folder policy from userDataRuntime");
