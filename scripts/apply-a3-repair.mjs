import fs from "node:fs";

function edit(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${path}: expected edit did not apply`);
  fs.writeFileSync(path, after, "utf8");
}

edit("electron/main.cjs", (source) => {
  const cookieHelper = /\nasync function getYouTubeCookiesFile\(\) \{[\s\S]*?\n\}\n\n(?=\/\/ ====================== SPOTIFY OAUTH PUBLIC IMPORT)/;
  if (!cookieHelper.test(source)) throw new Error("main.cjs: cookie helper marker missing");
  source = source.replace(cookieHelper, "\n");
  const injection = "    getCookiesFile: getYouTubeCookiesFile,\n";
  if (!source.includes(injection)) throw new Error("main.cjs: cookie injection missing");
  return source.replace(injection, "");
});

edit("electron/runtime/services.cjs", (source) => {
  if (!source.includes("    getCookiesFile,\n")) throw new Error("services: cookie option missing");
  source = source.replace("    getCookiesFile,\n", "");
  const oldInit = "    initDownloader({ userDataPath, ffmpegPath, getCookiesFile });";
  if (!source.includes(oldInit)) throw new Error("services: downloader init marker missing");
  return source.replace(oldInit, "    initDownloader({ userDataPath, ffmpegPath });");
});

edit("electron/downloader.cjs", (source) => {
  source = source.replace("let _getCookiesFile = null;\n", "");
  source = source.replace("function initDownloader({ userDataPath, ffmpegPath, getCookiesFile }) {", "function initDownloader({ userDataPath, ffmpegPath }) {");
  source = source.replace("  if (getCookiesFile) _getCookiesFile = getCookiesFile;\n", "");

  const setupMarker = "// ====================== YT-DLP SETUP ======================";
  if (!source.includes(setupMarker)) throw new Error("downloader: setup marker missing");
  source = source.replace(setupMarker, `function getOptInBrowserCookieSource() {
  if (process.env.LOCALTIFY_ALLOW_BROWSER_COOKIES !== "1") return "";
  const requested = String(process.env.LOCALTIFY_BROWSER_COOKIE_SOURCE || "").trim().toLowerCase();
  const allowed = process.platform === "win32"
    ? ["chrome", "edge", "firefox"]
    : ["chrome", "firefox", "chromium"];
  return allowed.includes(requested) ? requested : "";
}

${setupMarker}`);

  const strategyBlock = /\n  if \(_getCookiesFile\) \{[\s\S]*?\n  for \(const browser of browsers\) \{\n    strategies\.push\(\{ label: `\$\{browser\} cookies`, args: withFfmpeg\(\[\.\.\.base, "--cookies-from-browser", browser\]\) \}\);\n  \}/;
  if (!strategyBlock.test(source)) throw new Error("downloader: automatic cookie strategy block missing");
  source = source.replace(strategyBlock, `
  const browserCookieSource = getOptInBrowserCookieSource();
  if (browserCookieSource) {
    strategies.push({
      label: `${"${browserCookieSource}"} cookies (explicit opt-in)`,
      args: withFfmpeg([...base, "--cookies-from-browser", browserCookieSource])
    });
  }`);

  const searchBlock = /\n    if \(_getCookiesFile\) \{[\s\S]*?\n    \}\n\n    for \(const args of attempts\)/;
  if (!searchBlock.test(source)) throw new Error("downloader: search cookie block missing");
  source = source.replace(searchBlock, `
    const browserCookieSource = getOptInBrowserCookieSource();
    if (browserCookieSource) {
      attempts.push([...baseArgs, "--cookies-from-browser", browserCookieSource]);
    }

    for (const args of attempts)`);

  if (source.includes("_getCookiesFile") || source.includes("getCookiesFile")) throw new Error("downloader: cookie callback residue remains");
  return source;
});

fs.writeFileSync("tests/phase3/downloader-privacy.test.mjs", `import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("browser cookie access is disabled unless explicitly enabled", () => {
  const main = read("electron/main.cjs");
  const services = read("electron/runtime/services.cjs");
  const downloader = read("electron/downloader.cjs");
  assert.doesNotMatch(main, /getYouTubeCookiesFile|cookies\\.txt/);
  assert.doesNotMatch(services, /getCookiesFile/);
  assert.doesNotMatch(downloader, /_getCookiesFile|session cookies/);
  assert.match(downloader, /LOCALTIFY_ALLOW_BROWSER_COOKIES/);
  assert.match(downloader, /LOCALTIFY_BROWSER_COOKIE_SOURCE/);
});
`, "utf8");

console.log("A3 edits applied");
