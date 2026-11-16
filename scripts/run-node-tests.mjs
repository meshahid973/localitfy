import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const testsRoot = path.join(root, "tests");

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return /\.test\.(?:c?js|mjs)$/.test(entry.name) ? [absolute] : [];
  });
}

const files = walk(testsRoot).sort();
if (!files.length) {
  console.error("[tests] No Node test files found.");
  process.exit(1);
}

// Electron 42 can download its executable lazily on first require. Resolve it
// once before starting parallel test workers, which must not race extraction.
const electronReady = spawnSync(process.execPath, ["-e", "const fs = require('node:fs'); const binary = require('electron'); if (typeof binary !== 'string' || !fs.existsSync(binary)) throw new Error('Electron executable missing');"], {
  cwd: root,
  stdio: "inherit",
  env: process.env
});
if (electronReady.status !== 0) process.exit(electronReady.status ?? 1);

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: root,
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
