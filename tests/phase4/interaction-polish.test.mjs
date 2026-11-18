import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function compile(file, dependencies = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  runInNewContext(js, { exports, require: name => name in dependencies ? dependencies[name] : require(name) });
  return exports;
}

test("menu typeahead cycles matches, refines prefixes and handles empty menus", () => {
  const { findMenuMatch } = compile("src/shared/hooks/useMenuTypeahead.ts");
  const labels = ["Play now", "Play next", "Add to queue", "Add to playlist"];
  assert.equal(findMenuMatch(labels, 0, "a"), 2);
  assert.equal(findMenuMatch(labels, 2, "a"), 3);
  assert.equal(findMenuMatch(labels, 3, "a"), 2);
  assert.equal(findMenuMatch(labels, 2, "add to p"), 3);
  assert.equal(findMenuMatch(labels, 1, "PLAY N"), 1);
  assert.equal(findMenuMatch(labels, 0, "missing"), -1);
  assert.equal(findMenuMatch([], -1, "a"), -1);
});

test("shared icon buttons retain names, form safety and disabled semantics", () => {
  const { IconButton } = compile("src/shared/ui/IconButton.tsx", { "./icon-button.css": {} });
  const html = renderToStaticMarkup(React.createElement(IconButton, { "aria-label": "Shuffle", "aria-pressed": true, disabled: true, className: "transport" }));
  assert.match(html, /type="button"/);
  assert.match(html, /aria-label="Shuffle"/);
  assert.match(html, /title="Shuffle"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /ltIconButton transport/);
});

test("import progress distinguishes picker, processing and errors without claiming rollback", () => {
  const { ImportProgress } = compile("src/features/library/ImportProgress.tsx", {
    "../covers/Cover": { Cover: () => null },
    "../../shared/ui/LocaltifyViewUi": { MascotStateArt: () => null },
    "../search": { prettyTitle: String }
  });
  const state = { active: true, phase: "picking", message: "Choose files", count: 0, preview: [] };
  const render = patch => renderToStaticMarkup(React.createElement(ImportProgress, { state: { ...state, ...patch } }));
  assert.equal(render({ active: false }), "");
  assert.match(render({}), /Choose music to import/);
  assert.match(render({ phase: "scanning" }), /Scanning your music/);
  const error = render({ phase: "error", message: "Could not read the folder" });
  assert.match(error, /Import interrupted/);
  assert.match(error, /Could not read the folder/);
  assert.doesNotMatch(error, /safe rollback/);
});
