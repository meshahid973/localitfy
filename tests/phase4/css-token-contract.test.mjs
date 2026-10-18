import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function cssFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? cssFiles(file) : entry.isFile() && file.endsWith(".css") ? [file] : [];
  });
}

test("semantic --lt-* tokens referenced in CSS have a stylesheet owner", () => {
  const css = cssFiles("src").map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));
  const definitions = new Set(css.flatMap(({ text }) =>
    [...text.matchAll(/(--lt-[a-z0-9-]+)\s*:/gi)].map((match) => match[1])
  ));
  const missing = new Map();
  for (const { file, text } of css) {
    for (const match of text.matchAll(/var\(\s*(--lt-[a-z0-9-]+)/gi)) {
      if (!definitions.has(match[1])) {
        const owners = missing.get(match[1]) || new Set();
        owners.add(file);
        missing.set(match[1], owners);
      }
    }
  }
  assert.deepEqual([...missing].map(([token, files]) => [token, [...files]]), []);
  for (const token of ["--lt-bg", "--lt-surface", "--lt-text", "--lt-muted", "--lt-border", "--lt-accent"]) {
    assert.ok(definitions.has(token), "Missing semantic token: " + token);
  }
});
