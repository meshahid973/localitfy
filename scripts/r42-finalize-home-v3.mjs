import fs from "node:fs";

function read(path){ return fs.readFileSync(path,"utf8"); }
function write(path, text){ fs.writeFileSync(path,text); }
function replaceOnce(text, before, after, label){
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return text.replace(before, after);
}
function removeLines(text, lines, label){
  for (const line of lines) {
    if (!text.includes(line)) throw new Error(`${label}: missing ${line.trim()}`);
    text = text.replace(line, "");
  }
  return text;
}

let app = read("src/App.tsx");
app = app.replace('/* localtify 0.4.1 V423 like system + quick library modes. */\n', "");
app = app.replace('  HOME_GRID_RENDER_LIMIT,\n', "");
app = replaceOnce(app,
`  useBodyRuntimeClasses({\n    isAppBackgrounded,\n    isAppBackgroundedRef,\n    isPlaying,\n    wantsMoreBlur: settings.quickLibraryMoreBlur !== false\n  });`,
`  useBodyRuntimeClasses({\n    isAppBackgrounded,\n    isAppBackgroundedRef,\n    isPlaying\n  });`,
"remove Quick Library blur runtime");
app = replaceOnce(app,
`  useEffect(() => {\n    if (view !== "home" && view !== "library" && view !== "liked") return;\n\n    const nextLimit = view === "home" && settings.homeExpanded ? HOME_GRID_RENDER_LIMIT : INITIAL_LIBRARY_RENDER_LIMIT;\n    if (libraryRenderLimitRef.current === nextLimit) return;\n\n    libraryRenderLimitRef.current = nextLimit;\n    setLibraryRenderLimit(nextLimit);\n  }, [view, deferredQuery, settings.homeExpanded, settings.denseList]);`,
`  useEffect(() => {\n    if (view !== "library" && view !== "liked") return;\n    if (libraryRenderLimitRef.current === INITIAL_LIBRARY_RENDER_LIMIT) return;\n\n    libraryRenderLimitRef.current = INITIAL_LIBRARY_RENDER_LIMIT;\n    setLibraryRenderLimit(INITIAL_LIBRARY_RENDER_LIMIT);\n  }, [view, deferredQuery, settings.denseList]);`,
"remove Home library render-limit ownership");
app = replaceOnce(app,
`  const showHomeSideCards = settings.showRightColumn && !settings.homeExpanded;\n  const homeDashboardClass = [\n    "dashboardGrid",\n    showHomeSideCards ? "" : "singleColumn",\n    settings.homeExpanded ? "homeExpandedGrid" : "homeCompactGrid"\n  ]\n    .filter(Boolean)\n    .join(" ");\n\n`,
"",
"remove old Home dashboard ownership");
app = removeLines(app, [
'      showRightColumn: defaultSettings.showRightColumn,\n',
'      homeExpanded: defaultSettings.homeExpanded,\n',
'      key === "quickLibraryMoreBlur" ||\n'
], "remove retired settings paths");
app = replaceOnce(app,
'      <section className={`simpleLibraryPanel ${settings.homeExpanded ? "simpleLibraryExpanded" : "simpleLibraryCompact"}`}>',
'      <section className="simpleLibraryPanel">',
"simple mode library class");
const oldToggle = /\n\s*<button\n\s*className="expandLibraryButton"[\s\S]*?\{settings\.homeExpanded \? "compact" : "expand"\}\n\s*<\/button>/;
if (!oldToggle.test(app)) throw new Error("simple mode Quick Library toggle not found");
app = app.replace(oldToggle, "");
app = replaceOnce(app,
`        {settings.homeExpanded\n          ? renderHomeSongCards(filteredSongs, "homeAlbumGrid simpleAlbumGrid")\n          : renderSongRows(filteredSongs, "songList simpleList")}`,
`        {renderSongRows(filteredSongs, "songList simpleList")}`,
"simple mode library renderer");

const homeStart = app.indexOf("    home: {");
const homeEnd = app.indexOf("\n    library:", homeStart);
if (homeStart < 0 || homeEnd < 0) throw new Error("Home props block not found");
let homeBlock = app.slice(homeStart, homeEnd);
for (const key of [
  "filteredSongs", "homeDashboardClass", "likedSongs", "mostPlayed", "now", "renderHomeSongCards",
  "renderSongRows", "showHomeSideCards", "songs", "topSongs", "totalMinutes", "totalPlays", "updateSetting"
]) {
  homeBlock = homeBlock.replace(new RegExp(`^\\s{6}${key},\\n`, "m"), "");
}
app = app.slice(0, homeStart) + homeBlock + app.slice(homeEnd);

for (const token of ["settings.homeExpanded", "settings.showRightColumn", "settings.quickLibraryMoreBlur", "showHomeSideCards", "homeDashboardClass", "HOME_GRID_RENDER_LIMIT"]) {
  if (app.includes(token)) throw new Error(`src/App.tsx still contains retired token: ${token}`);
}
write("src/App.tsx", app);

let bodyRuntime = read("src/app/runtime/useBodyRuntimeClasses.ts");
bodyRuntime = bodyRuntime.replace('  /** Compatibility input while the App shell finishes shedding the retired Quick Library option. */\n  wantsMoreBlur?: boolean;\n', "");
if (bodyRuntime.includes("wantsMoreBlur")) throw new Error("body runtime still owns Quick Library blur");
write("src/app/runtime/useBodyRuntimeClasses.ts", bodyRuntime);

let settingsTypes = read("src/features/settings/settings.types.ts");
settingsTypes = removeLines(settingsTypes, [
"  homeExpanded: boolean;\n",
"  showRightColumn: boolean;\n",
"  quickLibraryMoreBlur: boolean;\n"
], "settings types");
write("src/features/settings/settings.types.ts", settingsTypes);

let settingsConstants = read("src/features/settings/settings.constants.ts");
for (const [before, after] of [
  ["showRightColumn:false,", ""],
  ["homeExpanded:true,", ""],
  ["quickLibraryMoreBlur:false,", ""]
]) settingsConstants = settingsConstants.replaceAll(before, after);
if (/\b(homeExpanded|showRightColumn|quickLibraryMoreBlur)\s*:/.test(settingsConstants)) throw new Error("settings constants still define retired Home keys");
write("src/features/settings/settings.constants.ts", settingsConstants);

let shell = read("src/features/shell/AppShell.tsx");
const mainOpen = "      data-platform={platformId}";
if (!shell.includes('      data-view={view}\n')) shell = shell.replace(mainOpen, `      data-view={view}\n${mainOpen}`);
write("src/features/shell/AppShell.tsx", shell);

let homeCss = read("src/features/home/home.css");
homeCss = homeCss.replaceAll(".app .headerBar", '.app[data-view="home"] .headerBar');
homeCss = homeCss.replaceAll(".app .headerText", '.app[data-view="home"] .headerText');
homeCss = homeCss.replaceAll(".app .headerText h2", '.app[data-view="home"] .headerText h2');
homeCss = homeCss.replaceAll(".app .headerText > .eyebrow + h2", '.app[data-view="home"] .headerText > .eyebrow + h2');
homeCss = homeCss.replace("  min-height: 54px;\n", "  min-height: 48px;\n  margin-bottom: 10px;\n");
homeCss = homeCss.replace("  margin-top: -8px;\n", "  margin-top: -10px;\n");
homeCss = homeCss.replace("  margin-top: 0;\n}\n\n.app[data-view=\"home\"] .headerText > .eyebrow + h2", "  margin-top: 0;\n  font-size: clamp(28px, 2.7vw, 42px);\n  line-height: .92;\n}\n\n.app[data-view=\"home\"] .headerText > .eyebrow + h2");
homeCss = homeCss.replace("  gap: 22px;\n", "  gap: 20px;\n");
homeCss = homeCss.replace("  min-height: 238px;\n", "  min-height: 226px;\n");
homeCss = homeCss.replace("  border-radius: 20px;\n", "  border-radius: 16px;\n");
homeCss = homeCss.replace("  min-height: clamp(264px, 29vh, 324px);\n", "  min-height: clamp(248px, 27vh, 300px);\n");
homeCss = homeCss.replace("  min-height: 218px;\n", "  min-height: 208px;\n");
homeCss = homeCss.replace("  inset: 0 0 0 42%;\n", "  inset: 0 0 0 46%;\n");
homeCss = homeCss.replace("  width: min(64%, 820px);\n", "  width: min(60%, 760px);\n");
homeCss = homeCss.replace("  padding: clamp(28px, 3.2vw, 46px);\n", "  padding: clamp(26px, 2.8vw, 40px);\n");
homeCss = homeCss.replace("  font-size: clamp(38px, 5.3vw, 76px);\n", "  font-size: clamp(36px, 4.7vw, 68px);\n");
if (!homeCss.includes("@media (min-width: 1500px)")) {
  homeCss = homeCss.replace("@media (max-width: 1180px) {", `@media (min-width: 1500px) {\n  .homeListenGrid {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n  }\n\n  .homeListenRow {\n    min-height: 58px;\n    grid-template-columns: 44px minmax(0, 1fr) auto;\n  }\n\n  .homeListenCoverWrap {\n    width: 44px;\n    height: 44px;\n  }\n\n  .homeHeroMedia {\n    left: 48%;\n  }\n}\n\n@media (max-width: 1180px) {`);
}
if (!homeCss.includes(".homeHeroAction:focus-visible")) {
  homeCss = homeCss.replace(".homeHeroAction:disabled {", `.homeHeroAction:focus-visible,\n.homeHeroSizeToggle:focus-visible,\n.homeListenRow:focus-visible,\n.homeRotationCard:focus-visible {\n  outline: 2px solid rgba(var(--accent-rgb), .78);\n  outline-offset: 2px;\n}\n\n.homeHeroAction:disabled {`);
}
write("src/features/home/home.css", homeCss);

let releaseCheck = read("scripts/check-release-ui-ownership.mjs");
if (!releaseCheck.includes('reject("src/App.tsx", ["quickLibraryMoreBlur"')) {
  releaseCheck = releaseCheck.replace(
    'reject("src/features/home/home.css", retiredHomeTokens);\n',
    'reject("src/features/home/home.css", retiredHomeTokens);\nreject("src/App.tsx", ["quickLibraryMoreBlur", "showHomeSideCards", "homeDashboardClass", "settings.homeExpanded", "settings.showRightColumn"]);\nreject("src/features/settings/settings.types.ts", ["homeExpanded:", "showRightColumn:", "quickLibraryMoreBlur:"]);\nreject("src/features/settings/settings.constants.ts", ["homeExpanded:", "showRightColumn:", "quickLibraryMoreBlur:"]);\n'
  );
}
if (!releaseCheck.includes("HomeView.tsx: loose index signature")) {
  releaseCheck = releaseCheck.replace(
    'const homePath = path.join(root, "src/features/home/home.css");\n',
    'const homeViewSource = read("src/features/home/HomeView.tsx");\nif (homeViewSource.includes("[key: string]: any")) failures.push("src/features/home/HomeView.tsx: loose index signature returned");\n\nconst homePath = path.join(root, "src/features/home/home.css");\n'
  );
}
if (!releaseCheck.includes('data-view="home"')) {
  releaseCheck = releaseCheck.replace(
    'if (homeBytes > 24 * 1024) failures.push(`src/features/home/home.css: ${homeBytes} bytes exceeds 24 KiB Home ownership budget`);\n',
    'if (homeBytes > 24 * 1024) failures.push(`src/features/home/home.css: ${homeBytes} bytes exceeds 24 KiB Home ownership budget`);\nconst homeCss = read("src/features/home/home.css");\nif (!homeCss.includes("data-view=\\\"home\\\"")) failures.push("src/features/home/home.css: Home header rules must be scoped to data-view=home");\n'
  );
}
write("scripts/check-release-ui-ownership.mjs", releaseCheck);

console.log("[r42-finalize-home-v3] Home v3 ownership, responsive layout, and retired Quick Library cleanup applied.");
