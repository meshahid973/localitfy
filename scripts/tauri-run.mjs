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

mkdirSync(cargoTargetDir, { recursive: true });

const env = {
  ...process.env,
  CARGO_TARGET_DIR: cargoTargetDir
};

let command;
let args;

if (mode === "check") {
  command = "cargo";
  args = ["check", "--manifest-path", path.join("src-tauri", "Cargo.toml")];
} else {
  command = process.platform === "win32" ? "npx.cmd" : "npx";
  args = ["--yes", "@tauri-apps/cli@2.11.4", mode];
}

console.log(`[localtify] Tauri mode: ${mode}`);
console.log(`[localtify] Cargo target: ${cargoTargetDir}`);

const child = spawn(command, args, {
  cwd: projectRoot,
  env,
  stdio: "inherit",
  shell: false
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
