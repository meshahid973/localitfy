const path = require("node:path");
const { spawnSync } = require("node:child_process");

const script = process.argv[2];
const args = process.argv.slice(3);

if (!script) {
  console.error("Usage: node scripts/run-electron-node.cjs <script> [...args]");
  process.exit(2);
}

let electronBinary;
try {
  electronBinary = require("electron");
} catch (error) {
  console.error("[electron-node] Electron is not installed. Run npm ci first.");
  console.error(error?.message || error);
  process.exit(1);
}

if (typeof electronBinary !== "string" || !electronBinary.trim()) {
  console.error("[electron-node] Could not resolve the Electron executable.");
  process.exit(1);
}

const result = spawnSync(electronBinary, [path.resolve(script), ...args], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1"
  }
});

if (result.error) {
  console.error("[electron-node] Failed to launch Electron as Node:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
