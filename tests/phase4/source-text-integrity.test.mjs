import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const roots = ["src", "electron", "discord-activity/src"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".html", ".json", ".md"]);

function collectFiles(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const stack = [absoluteRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "dist", "release", ".git"].includes(entry.name)) continue;
        stack.push(absolute);
        continue;
      }
      if (extensions.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
    }
  }
  return files;
}

test("source text contains no Unicode replacement characters", () => {
  const offenders = [];
  for (const relativeRoot of roots) {
    for (const file of collectFiles(relativeRoot)) {
      const text = fs.readFileSync(file, "utf8");
      if (text.includes("�")) offenders.push(path.relative(root, file));
    }
  }
  assert.deepEqual(offenders, [], `replacement character found in: ${offenders.join(", ")}`);
});
