import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import {runInNewContext} from "node:vm";
function load(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path, "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const exports = {};
  runInNewContext(outputText, {exports, require: name => {
    if (!(name in dependencies)) throw Error("Unexpected dependency " + name);
    return dependencies[name];
  }});
  return exports;
}
const constants = {coverColorSyncOptions:["off","subtle","normal","strong"].map(id=>({id}))};
const theme = load("src/features/settings/theme.utils.ts", {"./settings.constants":constants,"./theme.constants":{THEME_ID_SET:new Set(["light","dark"]),RETIRED_ANIMATED_THEME_IDS:new Set()}});
const { migrateVisualSettings } = load("src/features/settings/visualCustomization.ts", {"./theme.utils":theme});
const defaults = {theme:"dark",coverColorSyncMode:"normal",showAmbientGradient:true,animatedBackgrounds:true,animeVisuals:true,homeBannerType:"dynamic",mediaCardBackground:"glassy",homeLayoutMode:"balanced",libraryRowStyle:"comfyRows",sidebarBehavior:"slim",playerBackgroundStyle:"coverBlur",homeHeroCoverBrightness:1,catBuddyEnabled:false,volume:.75};
test("legacy visual settings migrate once without losing active choices or rollback data",()=>{
  const old = {...defaults,theme:"mono",customThemeEnabled:true,customThemeColor:"#123456",simpleMode:true,starsIntensity:"strong",homeExpanded:true,coverColorSyncMode:undefined,showAmbientGradient:false,volume:.32,sidebarBehavior:"hover",libraryRowStyle:"coverCards"};
  const result = migrateVisualSettings(old,defaults);
  assert.equal(result.changed,true);
  assert.equal(result.settings.theme,"light");
  assert.equal(result.settings.customThemeEnabled,false);
  assert.equal(result.settings.customThemeColor,"#123456");
  assert.equal(result.settings.simpleMode,false);
  assert.equal(result.settings.starsIntensity,"off");
  assert.equal(result.settings.coverColorSyncMode,"off");
  assert.equal(result.settings.volume,.32);
  assert.equal(result.settings.sidebarBehavior,"hover");
  assert.equal(result.settings.libraryRowStyle,"coverCards");
  assert.equal(migrateVisualSettings(result.settings,defaults).changed,false);
  assert.equal(old.customThemeEnabled,true);
  assert.equal(migrateVisualSettings({...defaults,theme:"stars"},defaults).settings.theme,"dark");
});
