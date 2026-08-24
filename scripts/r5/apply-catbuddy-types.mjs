import fs from "node:fs";

const filePath = "src/CatBuddy.tsx";
let source = fs.readFileSync(filePath, "utf8");

source = source.replace(/^\uFEFF?\/\/ @ts-nocheck\r?\n/, "");

const oldSingletonHelper = `function getCatSingletonKey() {\n  return "__localtifyCatBuddyPrimaryV405";\n}`;
const newSingletonHelper = `const CAT_BUDDY_SINGLETON_KEY = "__localtifyCatBuddyPrimaryV405" as const;\n\ntype CatBuddyWindow = Window & {\n  __localtifyCatBuddyPrimaryV405?: string;\n};\n\nfunction getCatSingletonWindow() {\n  return window as CatBuddyWindow;\n}`;
if (source.includes(oldSingletonHelper)) {
  source = source.replace(oldSingletonHelper, newSingletonHelper);
} else if (!source.includes("type CatBuddyWindow = Window")) {
  throw new Error("[r5-catbuddy] singleton helper not found");
}

const oldSingletonEffect = `    const key = getCatSingletonKey();\n    const ownId = instanceIdRef.current;\n    const existing = (window as any)[key];\n\n    if (existing && existing !== ownId) {\n      setIsPrimary(false);\n      return;\n    }\n\n    (window as any)[key] = ownId;\n    setIsPrimary(true);\n\n    return () => {\n      if ((window as any)[key] === ownId) {\n        delete (window as any)[key];\n      }\n    };`;
const newSingletonEffect = `    const catWindow = getCatSingletonWindow();\n    const ownId = instanceIdRef.current;\n    const existing = catWindow[CAT_BUDDY_SINGLETON_KEY];\n\n    if (existing && existing !== ownId) {\n      setIsPrimary(false);\n      return;\n    }\n\n    catWindow[CAT_BUDDY_SINGLETON_KEY] = ownId;\n    setIsPrimary(true);\n\n    return () => {\n      if (catWindow[CAT_BUDDY_SINGLETON_KEY] === ownId) {\n        delete catWindow[CAT_BUDDY_SINGLETON_KEY];\n      }\n    };`;
if (source.includes(oldSingletonEffect)) {
  source = source.replace(oldSingletonEffect, newSingletonEffect);
} else if (!source.includes("const catWindow = getCatSingletonWindow();")) {
  throw new Error("[r5-catbuddy] singleton effect not found");
}

if (source.includes("@ts-nocheck")) throw new Error("[r5-catbuddy] @ts-nocheck still present");
if (source.includes("window as any")) throw new Error("[r5-catbuddy] untyped window singleton still present");

fs.writeFileSync(filePath, source);

const boundaryPath = "scripts/check-phase1-boundaries.mjs";
let boundary = fs.readFileSync(boundaryPath, "utf8");
boundary = boundary.replace(
  'const knownTsNoCheck = new Set(["src/CatBuddy.tsx"]);',
  "const knownTsNoCheck = new Set();"
);
if (boundary.includes('"src/CatBuddy.tsx"')) {
  throw new Error("[r5-catbuddy] CatBuddy still exempted from ts-nocheck boundary");
}
fs.writeFileSync(boundaryPath, boundary);

console.log("[r5-catbuddy] removed the final @ts-nocheck and typed the window singleton");
