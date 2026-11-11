"use strict";

const { spawnSync } = require("node:child_process");

const target = process.argv[2];
if (!["win", "linux"].includes(target)) {
  throw new Error("Specify the Windows or Linux Rust release target");
}
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Invoke this release helper using npm run rust:dist");

function run(script, env) {
  const result = spawnSync(process.execPath, [npmCli, "run", script], {
    stdio: "inherit",
    env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const releaseEnvironment = { ...process.env, LOCALTIFY_INCLUDE_RUST_ADDON: "1" };
run("rust:build", releaseEnvironment);
run(target === "win" ? "dist" : "dist:linux", releaseEnvironment);
