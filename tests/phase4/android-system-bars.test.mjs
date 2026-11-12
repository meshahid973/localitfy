import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function fixture() {
  const styles = [];
  const observers = [];
  const listeners = new Map();
  let background = "#080712";
  let customBackground = "";
  const app = { dataset: { theme: "mint" }, style: { getPropertyValue: () => customBackground } };
  const root = { querySelector: () => app };
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() {}
  }
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("src/platform/android/systemBars.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  runInNewContext(code, { exports, MutationObserver: Observer,
    window: { addEventListener: (name, handler) => listeners.set(name, handler) },
    document: { getElementById: () => root },
    getComputedStyle: () => ({ getPropertyValue: () => background }),
    require: () => ({ SystemBarsStyle: { Dark: "DARK", Light: "LIGHT" },
      SystemBars: { setStyle: async ({ style }) => { styles.push(style); } } })
  });
  return { subject: exports, styles, observers, app,
    theme(id, color) { app.dataset.theme = id; background = color; },
    player(open) { listeners.get("localtifyplayersheet")({ detail: open }); },
    custom(color) { customBackground = color; background = color; } };
}

test("system bars use contrasting icons for normalized dark, light and custom themes", () => {
  const { subject } = fixture();
  assert.equal(subject.systemBarStyle("#080712"), "DARK");
  assert.equal(subject.systemBarStyle(" #eef1f7 "), "LIGHT");
  assert.equal(subject.systemBarStyle("#AACCFF"), "LIGHT");
  assert.equal(subject.systemBarStyle("transparent"), "DARK");
});

test("system bar updates follow theme changes and ignore playback-only style mutations", () => {
  const f = fixture();
  f.subject.installSystemBarTheme();
  const observer = f.observers.find((item) => item.target === f.app);
  assert.deepEqual(f.styles, ["DARK"]);
  observer.callback();
  observer.callback();
  assert.deepEqual(f.styles, ["DARK"]);
  f.theme("mono", "#eef1f7");
  observer.callback();
  assert.deepEqual(f.styles, ["DARK", "LIGHT"]);
  f.theme("custom", "#eef1f7");
  observer.callback();
  assert.equal(f.styles.length, 2);
  f.custom("#080712");
  observer.callback();
  assert.deepEqual(f.styles, ["DARK", "LIGHT", "DARK"]);
});

test("the dark full-screen player retains light system icons over a light app theme", () => {
  const f = fixture();
  f.theme("mono", "#eef1f7");
  f.subject.installSystemBarTheme();
  f.player(true);
  f.player(false);
  assert.deepEqual(f.styles, ["LIGHT", "DARK", "LIGHT"]);
});
