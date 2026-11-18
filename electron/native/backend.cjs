"use strict";

// This module runs only in trusted Electron/Node processes, never renderer IPC.
// No native binary is installed or loaded on normal Localtify launches.
const path = require("node:path");
const SUPPORTED = new Set(["similarity", "audio-decode", "duplicates", "pcm", "bridge", "ranking"]);
let phaseSetting;
let phaseSet = new Set();
let addon;
const warnings = new Set();

function enabled(phase) {
  if (!SUPPORTED.has(phase)) return false;
  const setting = process.env.LOCALTIFY_RUST_PHASES || "";
  if (phaseSetting !== setting) {
    phaseSetting = setting;
    phaseSet = new Set(setting.toLowerCase().split(/[\s,;]+/));
  }
  return phaseSet.has("all") || phaseSet.has(phase);
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
