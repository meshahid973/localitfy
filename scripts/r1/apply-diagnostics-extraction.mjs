import fs from "node:fs";

const appPath = "src/App.tsx";
let source = fs.readFileSync(appPath, "utf8");

const screensaverImport = 'import { useScreensaverController } from "./features/shell/useScreensaverController";';
const diagnosticsImport = 'import { useDiagnosticsInfo } from "./features/shell/useDiagnosticsInfo";';
if (!source.includes(diagnosticsImport)) {
  if (!source.includes(screensaverImport)) throw new Error("[r1] screensaver import anchor missing");
  source = source.replace(screensaverImport, `${screensaverImport}\n${diagnosticsImport}`);
}

source = source.replace('import { updateStatusLabel } from "./features/updates";\n', "");

const startMarker = "  const diagnosticsInfo = useMemo(() => {";
const endMarker = "  const selectedCoverColorSyncMode = normalizeCoverColorSyncMode(";
const start = source.indexOf(startMarker);
if (start >= 0) {
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error("[r1] diagnostics block end anchor missing");
  const hookCall = `  const { diagnosticsInfo, copyDiagnosticsInfo } = useDiagnosticsInfo({\n    currentThemeName: currentTheme.name,\n    downloadFolderLabel,\n    performanceStatus,\n    feedbackConfigStatus,\n    platformInfo,\n    playlistCount: playlists.length,\n    settings,\n    songs,\n    updatePrompt,\n    lastUpdateCheckedLabel,\n    setDiagnosticsCopied\n  });\n\n`;
  source = `${source.slice(0, start)}${hookCall}${source.slice(end)}`;
}

if (source.includes("const diagnosticsInfo = useMemo(() =>")) throw new Error("[r1] diagnostics computation still lives in App.tsx");
if (!source.includes("useDiagnosticsInfo({")) throw new Error("[r1] diagnostics hook was not installed");

fs.writeFileSync(appPath, source);
console.log(`[r1] App diagnostics ownership extracted (${(Buffer.byteLength(source, "utf8") / 1024).toFixed(1)} KiB before sandbox screensaver extraction)`);
