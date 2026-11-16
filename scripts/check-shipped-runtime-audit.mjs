import fs from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("Pass the npm audit JSON report path");
const report = JSON.parse(fs.readFileSync(path, "utf8"));
if (report.error || !report.metadata?.vulnerabilities || !report.vulnerabilities || typeof report.vulnerabilities !== "object") {
  throw new Error("Full npm audit did not return a valid vulnerability report");
}
const blockers = new Set(["moderate", "high", "critical"]);
for (const [name, item] of Object.entries(report.vulnerabilities)) {
  console.log("[security-audit]", item.severity, name);
}
const electron = report.vulnerabilities.electron;
if (electron && blockers.has(electron.severity)) {
  console.error("[security-audit] Shipped Electron runtime has an unresolved advisory:", electron.severity);
  process.exitCode = 1;
}
