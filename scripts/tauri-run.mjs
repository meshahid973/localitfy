import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const mode = String(process.argv[2] || "dev").toLowerCase();
const supportedModes = new Set(["dev", "build", "check"]);

if (!supportedModes.has(mode)) {
  console.error(`[localtify] Unsupported Tauri mode: ${mode}`);
  process.exit(1);
}

const localAppData =
  process.env.LOCALAPPDATA?.trim() ||
  path.join(os.homedir(), "AppData", "Local");
const roamingAppData =
  process.env.APPDATA?.trim() ||
  path.join(os.homedir(), "AppData", "Roaming");
const cargoTargetDir = path.join(localAppData, "localtify", "cargo-target");
const dataSafetyRoot = path.join(localAppData, "localtify", "migration-safety");
const backupManifestPath = path.join(dataSafetyRoot, "last-electron-backup.json");
const detectedCpuCount = Math.max(1, os.cpus()?.length || 1);
const defaultCargoJobs = Math.max(2, Math.min(4, Math.ceil(detectedCpuCount / 4)));
const cargoJobs = process.env.CARGO_BUILD_JOBS?.trim() || String(defaultCargoJobs);

mkdirSync(cargoTargetDir, { recursive: true });
mkdirSync(dataSafetyRoot, { recursive: true });

function readBackupManifest() {
  try {
    return JSON.parse(readFileSync(backupManifestPath, "utf8"));
  } catch {
    return null;
  }
}

function createElectronDataSafetyBackup() {
  const candidates = ["localitfy", "localtify", "Electron"]
    .map((directoryName) => ({
      directoryName,
      databasePath: path.join(roamingAppData, directoryName, "localitfy.sqlite")
    }))
    .filter(({ databasePath }) => existsSync(databasePath));

  if (!candidates.length) {
    console.warn("[localtify] No existing Electron database was found to back up.");
    return;
  }

  const fingerprint = candidates.map(({ databasePath }) => {
    const stats = statSync(databasePath);
    const walPath = `${databasePath}-wal`;
    const walStats = existsSync(walPath) ? statSync(walPath) : null;
    return {
      databasePath,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      walSize: walStats?.size || 0,
      walMtimeMs: walStats?.mtimeMs || 0
    };
  });

  const previous = readBackupManifest();
  if (previous && JSON.stringify(previous.fingerprint) === JSON.stringify(fingerprint)) {
    console.log(`[localtify] Electron data safety backup is current: ${previous.backupDirectory}`);
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDirectory = path.join(dataSafetyRoot, `electron-${timestamp}`);
  mkdirSync(backupDirectory, { recursive: true });

  for (const { directoryName, databasePath } of candidates) {
    const targetDirectory = path.join(backupDirectory, directoryName);
    mkdirSync(targetDirectory, { recursive: true });

    for (const suffix of ["", "-wal", "-shm"]) {
      const source = `${databasePath}${suffix}`;
      if (!existsSync(source)) continue;
      copyFileSync(source, path.join(targetDirectory, `localitfy.sqlite${suffix}`));
    }
  }

  writeFileSync(
    backupManifestPath,
    JSON.stringify({ createdAt: new Date().toISOString(), backupDirectory, fingerprint }, null, 2),
    "utf8"
  );

  console.log(`[localtify] Protected existing Electron data at: ${backupDirectory}`);
}

if (mode === "dev" || mode === "build") {
  try {
    createElectronDataSafetyBackup();
  } catch (error) {
    console.error("[localtify] Refusing to start because the Electron data safety backup failed.", error);
    process.exit(1);
  }
}

const env = {
  ...process.env,
  CARGO_TARGET_DIR: cargoTargetDir,
  CARGO_BUILD_JOBS: cargoJobs,
  CARGO_INCREMENTAL: process.env.CARGO_INCREMENTAL?.trim() || "1",
  CARGO_PROFILE_DEV_DEBUG: process.env.CARGO_PROFILE_DEV_DEBUG?.trim() || "0"
};

let command;
let args;

if (mode === "check") {
  command = "cargo";
  args = ["check", "--manifest-path", path.join("src-tauri", "Cargo.toml")];
} else if (process.platform === "win32") {
  command = process.env.ComSpec?.trim() || "cmd.exe";
  args = [
    "/d",
    "/s",
    "/c",
    `npx --yes @tauri-apps/cli@2.11.4 ${mode}`
  ];
} else {
  command = "npx";
  args = ["--yes", "@tauri-apps/cli@2.11.4", mode];
}

console.log(`[localtify] Tauri mode: ${mode}`);
console.log(`[localtify] Cargo target: ${cargoTargetDir}`);
console.log(`[localtify] Cargo jobs: ${cargoJobs}/${detectedCpuCount}`);
console.log("[localtify] Dev debug info: disabled");

const child = spawn(command, args, {
  cwd: projectRoot,
  env,
  stdio: "inherit",
  shell: false,
  windowsHide: false
});

child.on("error", (error) => {
  console.error(`[localtify] Failed to start ${command}:`, error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[localtify] Tauri stopped by signal ${signal}.`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
