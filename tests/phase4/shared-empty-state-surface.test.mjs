import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("library empty view displays its actual state title and contextual help", () => {
  const shared = read("src/shared/ui/LocaltifyViewUi.tsx");
  const css = read("src/shared/ui/view-ui.css");
  assert.match(shared, /className="localtifyEmptyCopyV467"/);
  assert.match(shared, /<strong className="localtifyEmptyCaptionV467">\{title\}<\/strong>/);
  assert.match(shared, /<span>\{message\}<\/span>/);
  assert.match(shared, /\{detail \? <small>\{detail\}<\/small>/);
  assert.doesNotMatch(shared, /my team couldn't find anything here/);
  assert.doesNotMatch(shared, /badge\?: string/);
  assert.doesNotMatch(read("src/features/library/LibraryView.tsx"), /badge=\{showingMissingFiles/);
  assert.match(css, /\.localtifyEmptyCopyV467/);
});

test("shared surface components have a theme-token style owner", () => {
  const component = read("src/shared/ui/Surface.tsx");
  const css = read("src/shared/ui/surface.css");
  assert.match(component, /import "\.\/surface\.css";/);
  assert.match(css, /var\(--lt-surface\)/);
  assert.match(css, /var\(--lt-radius-md\)/);
  assert.match(css, /\.localtifySurface-success/);
  assert.match(css, /\.localtifySurface-danger/);
  assert.doesNotMatch(css, /!important/);
});
