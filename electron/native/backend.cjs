"use strict";

// This module runs only in trusted Electron/Node processes, never renderer IPC.
// No native binary is installed or loaded on normal Localtify launches.
const path = require("node:path");
const SUPPORTED = new Set(["similarity", "duplicates", "scanner"]);
let addon;
const warnings = new Set();

function enabled(phase) {
  if (!SUPPORTED.has(phase)) return false;
  const parts = String(process.env.LOCALTIFY_RUST_PHASES || "").toLowerCase().split(/[\s,;]+/);
  return parts.includes("all") || parts.includes(phase);
}
function warnOnce(phase, error) {
  if (warnings.has(phase)) return;
  warnings.add(phase);
  console.warn("[localtify rust] " + phase + " unavailable; using JavaScript:", error?.message || String(error));
}
function getAddon(phase) {
  if (!enabled(phase)) return null;
  if (addon === undefined) {
    const filename = "localtify_rust_kernels." + process.platform + "." + process.arch + ".node";
    try { addon = require(path.join(__dirname, filename)); }
    catch (error) { addon = null; warnOnce("load", error); }
  }
  return addon;
}
module.exports = { enabled, getAddon, warnOnce };
