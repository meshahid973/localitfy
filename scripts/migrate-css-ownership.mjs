import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function moveFile(fromRelative, toRelative) {
  const from = path.join(root, fromRelative);
  const to = path.join(root, toRelative);
  if (!fs.existsSync(from)) throw new Error(`[css-ownership] missing source file: ${fromRelative}`);
  if (fs.existsSync(to)) throw new Error(`[css-ownership] target already exists: ${toRelative}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  console.log(`[css-ownership] moved ${fromRelative} -> ${toRelative}`);
}

moveFile("src/motion.css", "src/features/shell/motion.css");
moveFile("src/onboarding-first-run.css", "src/features/onboarding/onboarding.css");

const appPath = path.join(root, "src/App.tsx");
let app = fs.readFileSync(appPath, "utf8");

for (const [before, after] of [
  ['import "./motion.css";', 'import "./features/shell/motion.css";'],
  ['import "./onboarding-first-run.css";', 'import "./features/onboarding/onboarding.css";']
]) {
  if (!app.includes(before)) throw new Error(`[css-ownership] missing App import: ${before}`);
  app = app.replace(before, after);
}
fs.writeFileSync(appPath, app, "utf8");

const packagePath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
packageJson.scripts["css:hygiene"] = "node scripts/css-hygiene.mjs";
const hygieneCommand = "node scripts/css-hygiene.mjs";
if (!packageJson.scripts["css:dedup:check"].includes(hygieneCommand)) {
  packageJson.scripts["css:dedup:check"] = `${packageJson.scripts["css:dedup:check"]} && ${hygieneCommand}`;
}
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

console.log("[css-ownership] feature CSS paths and hygiene gate updated");
