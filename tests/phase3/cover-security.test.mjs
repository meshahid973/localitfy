import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("renderer CSP permits Localtify cover images from the native media bridge", () => {
  const csp = html.match(/Content-Security-Policy[\s\S]*?content="([^"]+)"/)?.[1] || "";
  const imgSrc = csp.match(/img-src\s+([^;]+)/)?.[1] || "";

  assert.match(imgSrc, /localtify-media:/, "localtify-media cover URLs must be allowed by img-src");
  assert.match(imgSrc, /http:\/\/127\.0\.0\.1:\*/, "localhost media-server cover URLs must be allowed by img-src");
});
