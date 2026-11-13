import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function fixture() {
  let effect;
  const doc = { activeElement: null, modals: [], buttons: [], ids: {}, listeners: {},
    addEventListener(name, listener) { this.listeners[name] = listener; }, removeEventListener(name) { delete this.listeners[name]; },
    getElementById(id) { return this.ids[id] || null; },
    querySelectorAll(selector) { return selector.includes("aria-modal") ? this.modals : this.buttons; } };
  class Element {
    isConnected = true;
    children = [];
    attributes = {};
    getAttribute(name) { return this.attributes[name] || null; }
    focus() { doc.activeElement = this; }
    contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
    getClientRects() { return this.isConnected ? [{}] : []; }
    closest() { return null; }
    querySelectorAll(selector) { return selector === '[aria-controls]' ? this.children.filter((child) => child.getAttribute('aria-controls')) : this.children; }
  }
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync("src/shared/hooks/useModalFocus.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  runInNewContext(output, { exports, document: doc, HTMLElement: Element, Node: Element,
    require: () => ({ useRef: () => ({ current: null }), useMemo: (read) => read(), useLayoutEffect: (next) => { effect = next; } }) });
  return { doc, Element, open(dialog) { const ref = exports.useModalFocus(true); ref.current = dialog; return () => effect(); } };
}

test("autofocus stays on the input while open and returns to the opener even before the dialog DOM is removed", () => {
  const f = fixture();
  const opener = new f.Element(), input = new f.Element(), dialog = new f.Element();
  dialog.children = [input];
  f.doc.modals = [dialog];
  f.doc.buttons = [opener];
  opener.focus();
  const commit = f.open(dialog);
  input.focus(); // React commits autoFocus after the opening render.
  const close = commit();
  assert.equal(f.doc.activeElement, input);
  close();
  assert.equal(f.doc.activeElement, opener);
});

test("closing a nested modal restores its opener inside the remaining modal", () => {
  const f = fixture();
  const parent = new f.Element(), opener = new f.Element(), dialog = new f.Element(), input = new f.Element();
  parent.children = [opener];
  dialog.children = [input];
  f.doc.modals = [parent, dialog];
  opener.focus();
  const commit = f.open(dialog);
  input.focus();
  commit()();
  assert.equal(f.doc.activeElement, opener);
});

test("a restore target inside the closing dialog is never focused", () => {
  const f = fixture();
  const opener = new f.Element(), dialog = new f.Element(), input = new f.Element();
  dialog.children = [input];
  f.doc.modals = [dialog];
  f.doc.buttons = [input, opener];
  input.focus();
  f.open(dialog)()();
  assert.equal(f.doc.activeElement, opener);
});

test("focus can enter an owned portaled device menu but cannot escape to unrelated controls", () => {
  const f = fixture();
  const dialog = new f.Element(), trigger = new f.Element(), menu = new f.Element(), item = new f.Element(), outside = new f.Element();
  trigger.attributes['aria-controls'] = 'devices';
  menu.attributes.role = 'menu';
  dialog.children = [trigger];
  menu.children = [item];
  f.doc.modals = [dialog];
  f.doc.ids.devices = menu;
  const close = f.open(dialog)();
  item.focus();
  f.doc.listeners.focusin({ target: item });
  assert.equal(f.doc.activeElement, item);
  let prevented = false;
  f.doc.listeners.keydown({ key: 'Tab', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(f.doc.activeElement, trigger);
  outside.focus();
  f.doc.listeners.focusin({ target: outside });
  assert.equal(f.doc.activeElement, trigger);
  close();
});
