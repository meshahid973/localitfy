import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const preloadPath = path.join(root, "electron", "preload.cjs");
const declarationsPath = path.join(root, "src", "localitfy.d.ts");

const preload = fs.readFileSync(preloadPath, "utf8");
const declarations = fs.readFileSync(declarationsPath, "utf8");

const exposed = new Set(
  [...preload.matchAll(/^  ([A-Za-z_$][\w$]*):/gm)].map((match) => match[1])
);

const localitfyStart = declarations.indexOf("localitfy: {");
if (localitfyStart === -1) {
  console.error("[bridge-contract] Could not find Window.localitfy declaration.");
  process.exit(1);
}

const localitfyDeclarations = declarations.slice(localitfyStart);
const declared = new Set(
  [...localitfyDeclarations.matchAll(/^      ([A-Za-z_$][\w$]*)\??:/gm)].map(
    (match) => match[1]
  )
);

const preloadOnly = [...exposed].filter((key) => !declared.has(key)).sort();
const declarationOnly = [...declared].filter((key) => !exposed.has(key)).sort();

if (preloadOnly.length || declarationOnly.length) {
  console.error("[bridge-contract] Electron preload/type drift detected.");
  if (preloadOnly.length) {
    console.error(`  Exposed by preload but missing from types: ${preloadOnly.join(", ")}`);
  }
  if (declarationOnly.length) {
    console.error(`  Declared in types but missing from preload: ${declarationOnly.join(", ")}`);
  }
  process.exit(1);
}

console.log(`[bridge-contract] OK: ${exposed.size} preload keys exactly match ${declared.size} declared keys.`);
