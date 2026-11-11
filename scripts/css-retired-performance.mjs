import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const retired = /\bbody\.(?:localtifyPerfV(?:301|303|305|307|310|319)|localtifyGpuFriendly)\b/;
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() && file.endsWith(".css") ? [file] : [];
  });
}

let count = 0;
for (const file of walk(path.join(root, "src"))) {
  const source = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
  if (!retired.test(source)) continue;
  console.error("[css-retired-performance] Retired runtime class still has styles: " + path.relative(root, file));
  count += 1;
}
if (count) process.exitCode = 1;
else console.log("[css-retired-performance] no unreachable legacy body performance selectors");
