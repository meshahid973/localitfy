import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skip = new Set(["node_modules", "dist", ".git", "release", "out"]);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs);
    else files.push(path.relative(root, abs).replaceAll("\\", "/"));
  }
}
walk(root);
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const src = files.filter((f) => /\.(?:ts|tsx|mjs|cjs|js|jsx|css)$/.test(f));
const css = src.filter((f) => f.endsWith(".css"));
const code = src.filter((f) => /\.(?:ts|tsx|mjs|cjs|js|jsx)$/.test(f));

console.log("=== SOURCE SIZE TOP 20 ===");
for (const f of [...src].sort((a,b) => fs.statSync(path.join(root,b)).size - fs.statSync(path.join(root,a)).size).slice(0,20)) {
  console.log(String(fs.statSync(path.join(root,f)).size).padStart(8), f);
}

console.log("\n=== ANY COUNTS TOP 20 ===");
const anys = code.map((f) => [f, (read(f).match(/\bany\b/g) || []).length]).filter(([,n]) => n).sort((a,b)=>b[1]-a[1]);
for (const [f,n] of anys.slice(0,20)) console.log(String(n).padStart(5), f);
console.log("TOTAL_ANY", anys.reduce((s,[,n])=>s+n,0));

console.log("\n=== CSS FILES / IMPORTANT ===");
for (const f of css) {
  const s = read(f); const important = (s.match(/!important/g) || []).length;
  console.log(String(Buffer.byteLength(s)).padStart(8), String(important).padStart(5), f);
}

console.log("\n=== CSS IMPORT OWNERS ===");
for (const f of code) {
  const s = read(f);
  const imports = [...s.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((m)=>m[1]);
  if (imports.length) console.log(f, "=>", imports.join(", "));
}

console.log("\n=== CROSS FEATURE IMPORTS ===");
for (const f of code.filter((x)=>x.startsWith("src/features/"))) {
  const feature = f.split("/")[2];
  const s = read(f);
  const hits = [...s.matchAll(/from\s+["'](?:\.\.\/)+([^"']+)["']/g)].map((m)=>m[1]);
  const foreign = hits.filter((x)=>x.startsWith("features/") ? x.split("/")[1] !== feature : !x.startsWith("shared/") && !x.startsWith("core/") && !x.startsWith("app/") && x.includes("/"));
  if (foreign.length) console.log(f, "=>", [...new Set(foreign)].join(", "));
}

console.log("\n=== REBUILD PAGE GLOBAL LEAKS ===");
const globals = ["src/App.css","src/features/shell/app-core.css","src/features/shell/effects.css","src/features/settings/themes.css","src/styles/view-shell.css"];
const tokens = ["libraryPanel","libraryQuick","albumsPage","albumsHero","albumCard","playlistsPage","playlistHero","coverStudio","downloadsLayout","downloadPanel","spotifyTrack","analyticsStudio","analyticsHero","settingsPage","settingsHero"];
for (const f of globals.filter((x)=>fs.existsSync(path.join(root,x)))) {
  const s = read(f).replace(/\/\*[\s\S]*?\*\//g," ");
  const hits = tokens.filter((t)=>s.includes("."+t));
  console.log(f, hits.length ? hits.join(", ") : "clean");
}

console.log("\n=== RESET PRESSURE ===");
const foundation = read("src/styles/page-foundation.css");
console.log("foundation !important", (foundation.match(/!important/g)||[]).length);
console.log("foundation reset-state gated", foundation.includes('data-page-state="reset"'));

console.log("\n=== CI ===");
console.log("quality workflow", fs.existsSync(path.join(root,".github/workflows/quality.yml")));
console.log("electron smoke", fs.existsSync(path.join(root,"scripts/ci-electron-smoke.cjs")));

console.log("\n=== DEBT MARKERS ===");
for (const marker of ["@ts-nocheck","TODO","FIXME","HACK"]) {
  const hits = code.filter((f)=>read(f).includes(marker));
  console.log(marker, hits.length, hits.slice(0,20).join(", "));
}
