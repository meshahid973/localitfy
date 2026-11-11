import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

export function findVersionMismatches(expected, entries) {
  const mismatches = [];
  if (!/^\d+\.\d+\.\d+$/.test(expected)) mismatches.push("package version must be stable semver (major.minor.patch)");
  for (const [name, actual] of Object.entries(entries)) {
    if (actual !== expected) mismatches.push(name + ": expected " + expected + ", got " + String(actual ?? "missing"));
  }
  return mismatches;
}

function literalVersion(file, variable) {
  const match = read(file).match(new RegExp("\\bconst " + variable + "\\s*=\\s*[\"']([^\"']+)[\"']"));
  return match?.[1] || null;
}

function checkReleaseVersion() {
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  const mismatches = findVersionMismatches(pkg.version, {
    "package-lock.json version": lock.version,
    "package-lock.json root package version": lock.packages?.[""]?.version,
    "renderer version": literalVersion("src/features/updates/update.constants.ts", "APP_VERSION"),
    "Discord Activity version": literalVersion("discord-activity/src/main.ts", "APP_VERSION")
  });
  for (const file of [
    "src/features/updates/WhatsNewModal.tsx",
    "src/features/updates/update.constants.ts",
    "src/features/feedback/feedbackPrompt.ts",
    "src/app/platform.ts",
    "src/features/settings/settings.shared.tsx"
  ]) {
    const source = read(file);
    // User-facing copy must not keep an independently hardcoded version.
    if (file === "src/features/updates/update.constants.ts") {
      const copy = source.slice(source.indexOf("export const whatsNewItems"));
      if (/\b\d+\.\d+\.\d+\b/.test(copy)) mismatches.push(file + ": what's-new copy hardcodes a version");
    } else if (/\b\d+\.\d+\.\d+\b/.test(source)) {
      mismatches.push(file + ": UI copy hardcodes a version");
    }
  }
  assert.deepEqual(mismatches, [], "Release metadata mismatch:\n" + mismatches.join("\n"));
  console.log("[release-version] " + pkg.version + ": metadata and release UI agree");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkReleaseVersion();
