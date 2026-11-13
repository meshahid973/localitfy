import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function findCssCommentErrors(source) {
  const errors = [];
  for (let i = 0; i < source.length;) {
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i++];
      while (i < source.length) {
        if (source[i] === "\\") i += 2;
        else if (source[i++] === quote) break;
      }
      continue;
    }
    if (source[i] !== "/" || source[i + 1] !== "*") { i += 1; continue; }
    const start = i;
    const close = source.indexOf("*/", i + 2);
    if (close < 0) { errors.push({ position: start, reason: "unterminated comment" }); break; }
    const nested = source.indexOf("/*", i + 2);
    if (nested >= 0 && nested < close) {
      errors.push({ position: nested, reason: "nested comment hides CSS" });
    }
    i = close + 2;
  }
  return errors;
}

function cssFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory()
      ? cssFiles(absolute)
      : entry.isFile() && absolute.endsWith(".css") ? [absolute] : [];
  });
}

function check() {
  let failures = 0;
  for (const file of cssFiles(path.join(root, "src"))) {
    const source = fs.readFileSync(file, "utf8");
    for (const problem of findCssCommentErrors(source)) {
      const line = source.slice(0, problem.position).split("\n").length;
      console.error("[css-comments] " + path.relative(root, file) + ":" + line + " " + problem.reason);
      failures += 1;
    }
  }
  if (failures) process.exitCode = 1;
  else console.log("[css-comments] all CSS comments are balanced and non-nested");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) check();
