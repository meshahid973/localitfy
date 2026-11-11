"use strict";

const { spawnSync } = require("node:child_process");

function validatePackageTarget(target, platform = process.platform, arch = process.arch,
  cargoTarget = process.env.CARGO_BUILD_TARGET || "") {
  const hostPlatform = target === "win" ? "win32" : target === "linux" ? "linux" : null;
  if (!hostPlatform) throw new Error("Specify the Windows or Linux Rust release target");
  if (platform !== hostPlatform || arch !== "x64") {
    throw new Error(`Rust ${target} releases target x64 and require an x64 ${hostPlatform} build host; got ${platform}/${arch}`);
  }
  if (cargoTarget) throw new Error("Cross-compiled Rust addon targets are not supported by this release helper");
  return target === "win" ? "dist" : "dist:linux";
}

function runNpmScript(script, env) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run the native release helper through npm");
  const result = spawnSync(process.execPath, [npmCli, "run", script], {
    stdio: "inherit",
    env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (require.main === module) {
  const distScript = validatePackageTarget(process.argv[2]);
  const env = { ...process.env, LOCALTIFY_INCLUDE_RUST_ADDON: "1" };
  runNpmScript("rust:build", env);
  runNpmScript(distScript, env);
}

module.exports = { validatePackageTarget };
