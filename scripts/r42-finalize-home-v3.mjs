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
app = app.replace(/\n\s*<button\n\s*className="expandLibraryButton"[\s\S]*?\{settings\.homeExpanded \? "compact" : "expand"\}\n\s*<\/button>/, "");
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
for (const pair of [
  ["showRightColumn:false,", ""],
  ["homeExpanded:true,", ""],
  ["quickLibraryMoreBlur:false,", ""]
]) settingsConstants = settingsConstants.replaceAll(pair[0], pair[1]);
if (/\b(homeExpanded|showRightColumn|quickLibraryMoreBlur)\s*:/.test(settingsConstants)) throw new Error("settings constants still define retired Home keys");
write("src/features/settings/settings.constants.ts", settingsConstants);

let shell = read("src/features/shell/AppShell.tsx");
const mainOpen = "      data-platform={platformId}";
if (!shell.includes('      data-view={view}\n')) shell = shell.replace(mainOpen, `      data-view={view}\n${mainOpen}`);
write("src/features/shell/AppShell.tsx", shell);

console.log("[r42-finalize-home-v3] retired Quick Library ownership removed from App/settings/runtime.");
