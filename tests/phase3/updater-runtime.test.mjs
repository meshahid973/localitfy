import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const updater = require(path.join(root, "electron", "runtime", "updater.cjs"));
const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");

test("updater behavior is owned outside Electron main", () => {
  assert.match(main, /createUpdaterRuntime/);
  assert.doesNotMatch(main, /function setupAutoUpdater|function safeUpdateInfo|sendLinuxManualUpdateOnlyEvent/);
  assert.equal(typeof updater.createUpdaterRuntime, "function");
});

test("updater version comparison is deterministic", () => {
  assert.equal(updater.normalizeUpdateVersion("v0.4.1"), "0.4.1");
  assert.equal(updater.compareUpdateVersions("0.4.2", "0.4.1"), 1);
  assert.equal(updater.compareUpdateVersions("0.4.1", "0.4.1"), 0);
  assert.equal(updater.compareUpdateVersions("0.4.0", "0.4.1"), -1);
  assert.equal(updater.compareUpdateVersions("0.5.2-beta.1", "0.5.1"), 1);
  assert.equal(updater.compareUpdateVersions("0.5.2", "0.5.2-rc.1"), 1);
  assert.equal(updater.compareUpdateVersions("0.5.2-beta.2", "0.5.2-beta.11"), -1);
  assert.equal(updater.compareUpdateVersions("latest", "0.5.1"), 0, "unknown tags cannot trigger updates");
});

test("Linux manual update path uses the canonical event helper", () => {
  const source = fs.readFileSync(path.join(root, "electron", "runtime", "updater.cjs"), "utf8");
  assert.match(source, /sendLinuxManualUpdateEvent/);
  assert.doesNotMatch(source, /sendLinuxManualUpdateOnlyEvent/);
  assert.match(source, /linux-manual-only-update-available/);
});


test("updater and packaged publishing use the canonical repository", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const expected = "meshahid973/localtify";
  assert.equal(pkg.build.publish[0].owner + "/" + pkg.build.publish[0].repo, expected);
  assert.equal(pkg.repository.url, "git+https://github.com/" + expected + ".git");
  assert.equal(updater.LOCALTIFY_LINUX_RELEASES_URL, "https://github.com/" + expected + "/releases/latest");
});

test("Android official release discovery rejects missing/mismatched APKs and compares versions correctly",async()=>{
  const ts=await import("typescript");
  const source=fs.readFileSync(path.join(root,"src/features/updates/androidRelease.ts"),"utf8");
  const emitted=ts.default.transpileModule(source,{compilerOptions:{module:ts.default.ModuleKind.ES2022,target:ts.default.ScriptTarget.ES2022}}).outputText;
  const {compareStableVersions,fetchOfficialAndroidRelease}=await import("data:text/javascript;base64,"+Buffer.from(emitted).toString("base64"));
  assert.equal(compareStableVersions("0.5.2","0.5.1"),1);
  assert.equal(compareStableVersions("0.5.1","0.5.1"),0);
  assert.equal(compareStableVersions("v0.5.0","0.5.1"),-1);
  const valid={tag_name:"v0.5.2",draft:false,prerelease:false,body:"## Fixes\n- Correct update",
    assets:[{name:"localtify-0.5.2-android.apk",size:100000,browser_download_url:"https://github.com/meshahid973/localtify/releases/download/v0.5.2/localtify-0.5.2-android.apk"}]};
  const response=(data)=>async()=>({ok:true,json:async()=>data});
  const accepted=await fetchOfficialAndroidRelease(response(valid));
  assert.equal(accepted.version,"0.5.2");
  assert.match(accepted.downloadUrl,/^https:\/\/github\.com\/meshahid973\/localtify\/releases\/download\//);
  await assert.rejects(()=>fetchOfficialAndroidRelease(response({...valid,assets:[]})),/APK/);
  await assert.rejects(()=>fetchOfficialAndroidRelease(response({...valid,draft:true})),/Unverified/);
  await assert.rejects(()=>fetchOfficialAndroidRelease(response({...valid,assets:[{...valid.assets[0],browser_download_url:"https://evil.example/malware.apk"}]})),/APK/);
});
