import assert from "node:assert/strict";
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
  assert.doesNotMatch(main, /getYouTubeCookiesFile|cookies\.txt/);
  assert.doesNotMatch(services, /getCookiesFile/);
  assert.doesNotMatch(downloader, /_getCookiesFile|session cookies/);
  assert.match(downloader, /LOCALTIFY_ALLOW_BROWSER_COOKIES/);
  assert.match(downloader, /LOCALTIFY_BROWSER_COOKIE_SOURCE/);
});
