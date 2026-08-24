import process from "node:process";
import { spawnSync } from "node:child_process";

const scripts = [
  "scripts/css-property-dedup.mjs",
  "scripts/css-shadow-dedup.mjs",
  "scripts/css-adjacent-merge.mjs",
  "scripts/css-cross-file-dedup.mjs"
];

function run(script, args = [], inherit = true) {
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: inherit ? "inherit" : "pipe",
    encoding: "utf8"
  });
  return result.status ?? 1;
}

for (let cycle = 1; cycle <= 8; cycle += 1) {
  console.log(`[css-fixpoint] cleanup cycle ${cycle}`);
  for (const script of scripts) {
    const status = run(script, ["--write"]);
    if (status !== 0) process.exit(status);
  }

  const statuses = scripts.map((script) => run(script, [], false));
  if (statuses.every((status) => status === 0)) {
    console.log(`[css-fixpoint] stable after ${cycle} cycle(s)`);
    process.exit(0);
  }
}

console.error("[css-fixpoint] CSS dedup did not converge after 8 cycles");
for (const script of scripts) run(script);
process.exit(1);
