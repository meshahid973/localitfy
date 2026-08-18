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

// The current preload object is intentionally formatted with top-level keys at
// two spaces. Nested object properties use deeper indentation, so this gives us
// a small dependency-free contract audit without executing Electron code.
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

// Phase 1 starts by freezing known bridge debt so new drift cannot accumulate.
// Remove an entry from these sets when the corresponding declaration/preload
// mismatch is fixed. Unknown mismatches fail CI immediately.
const knownPreloadOnly = new Set([
  "resolvePlaybackUrl",
  "repairMissingMetadata",
  "cleanupCoverCache",
  "updateBackupNow",
  "repairDatabaseNow",
  "setDiscordActivity",
  "resetDiscordCache",
  "spotifyImportBrowser",
  "spotifySetCookie"
]);

const knownDeclarationOnly = new Set([
  "backupDatabase",
  "repairDatabase",
  "onAutoUpdateEvent"
]);

const preloadOnly = [...exposed].filter((key) => !declared.has(key)).sort();
const declarationOnly = [...declared].filter((key) => !exposed.has(key)).sort();

const unexpectedPreloadOnly = preloadOnly.filter((key) => !knownPreloadOnly.has(key));
const unexpectedDeclarationOnly = declarationOnly.filter(
  (key) => !knownDeclarationOnly.has(key)
);

if (unexpectedPreloadOnly.length || unexpectedDeclarationOnly.length) {
  console.error("[bridge-contract] New preload/type drift detected.");

  if (unexpectedPreloadOnly.length) {
    console.error(
      `  Exposed by preload but missing from types: ${unexpectedPreloadOnly.join(", ")}`
    );
  }

  if (unexpectedDeclarationOnly.length) {
    console.error(
      `  Declared in types but missing from preload: ${unexpectedDeclarationOnly.join(", ")}`
    );
  }

  process.exit(1);
}

const remainingKnownDebt = preloadOnly.length + declarationOnly.length;
console.log(
  `[bridge-contract] OK: ${exposed.size} preload keys, ${declared.size} declared keys.`
);

if (remainingKnownDebt > 0) {
  console.log(
    `[bridge-contract] ${remainingKnownDebt} known Phase 1 mismatch(es) remain frozen for incremental cleanup.`
  );
  if (preloadOnly.length) {
    console.log(`  preload-only: ${preloadOnly.join(", ")}`);
  }
  if (declarationOnly.length) {
    console.log(`  declaration-only: ${declarationOnly.join(", ")}`);
  }
}
