import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const retired = /\.(?:localtifyPerfV(?:301|303|305|307|310|319)|localtifyGpuFriendly)(?![\w-])/g;

export function retiredPerformanceSelectors(css) {
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  return [...uncommented.matchAll(retired)].map((match) => match[0]);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() && file.endsWith(".css") ? [file] : [];
  });
}

function check() {
  let count = 0;
  for (const file of walk(path.join(root, "src"))) {
    const matches = retiredPerformanceSelectors(fs.readFileSync(file, "utf8"));
    if (!matches.length) continue;
    console.error("[css-retired-performance] Unreachable legacy selectors in " + path.relative(root, file) + ": " + matches.join(", "));
    count += 1;
  }
  if (count) process.exitCode = 1;
  else console.log("[css-retired-performance] no unreachable legacy performance selectors");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) check();
