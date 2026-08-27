import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KiB = 1024;
const MiB = 1024 * KiB;

const sourceBudgets = [
  ["src/App.tsx", 320 * KiB],
  ["src/App.css", 316 * KiB],
  ["electron/main.cjs", 192 * KiB],
  ["src/features/shell/AppShell.tsx", 32 * KiB]
];

const failures = [];

function checkFile(relativePath, maxBytes) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    failures.push(`${relativePath}: missing`);
    return;
  }
  const bytes = fs.statSync(absolute).size;
  console.log(`[performance] ${relativePath}: ${(bytes / KiB).toFixed(1)} KiB / ${(maxBytes / KiB).toFixed(1)} KiB`);
  if (bytes > maxBytes) failures.push(`${relativePath}: ${bytes} > ${maxBytes} bytes`);
}

for (const [relativePath, maxBytes] of sourceBudgets) checkFile(relativePath, maxBytes);

const assetsDir = path.join(root, "dist", "assets");
if (fs.existsSync(assetsDir)) {
  const assets = fs.readdirSync(assetsDir).map((name) => ({
    name,
    bytes: fs.statSync(path.join(assetsDir, name)).size
  }));
  const js = assets.filter((item) => /\.js$/i.test(item.name));
  const css = assets.filter((item) => /\.css$/i.test(item.name));
  const maxJs = js.reduce((max, item) => Math.max(max, item.bytes), 0);
  const totalJs = js.reduce((sum, item) => sum + item.bytes, 0);
  const totalCss = css.reduce((sum, item) => sum + item.bytes, 0);

  console.log(`[performance] largest JS chunk: ${(maxJs / KiB).toFixed(1)} KiB / ${(2 * MiB / KiB).toFixed(0)} KiB`);
  console.log(`[performance] total JS: ${(totalJs / MiB).toFixed(2)} MiB / 4.00 MiB`);
  console.log(`[performance] total CSS: ${(totalCss / MiB).toFixed(2)} MiB / 3.00 MiB`);

  if (maxJs > 2 * MiB) failures.push(`largest JS chunk: ${maxJs} > ${2 * MiB} bytes`);
  if (totalJs > 4 * MiB) failures.push(`total JS: ${totalJs} > ${4 * MiB} bytes`);
  if (totalCss > 3 * MiB) failures.push(`total CSS: ${totalCss} > ${3 * MiB} bytes`);
} else {
  console.log("[performance] dist/assets not present; source budgets only");
}

if (failures.length) {
  console.error("[performance] budget failures:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("[performance] all budgets passed");
