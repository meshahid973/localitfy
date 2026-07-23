import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
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
const cargoTargetDir = path.join(localAppData, "localtify", "cargo-target");
const detectedCpuCount = Math.max(1, os.cpus()?.length || 1);
const defaultCargoJobs = Math.max(2, Math.min(4, Math.ceil(detectedCpuCount / 4)));
const cargoJobs = process.env.CARGO_BUILD_JOBS?.trim() || String(defaultCargoJobs);

mkdirSync(cargoTargetDir, { recursive: true });

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
