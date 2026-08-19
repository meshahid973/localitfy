from pathlib import Path

root = Path(__file__).resolve().parents[2]


def read(relative):
    return (root / relative).read_text(encoding="utf-8-sig")


def write(relative, text):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


# --- Discord renderer dedupe + canonical source URL ---
app = read("src/App.tsx")
if "LOCALITFY_SOURCE_URL," not in app:
    app = app.replace(
        "  LOCALITFY_DOWNLOAD_URL,\n",
        "  LOCALITFY_DOWNLOAD_URL,\n  LOCALITFY_SOURCE_URL,\n",
        1,
    )

ref_anchor = '  const lastDiscordAssetKeyRef = useRef<string>("");\n'
if "discordLastPayloadKeyRef" not in app:
    if ref_anchor not in app:
        raise SystemExit("Discord ref anchor not found")
    app = app.replace(
        ref_anchor,
        ref_anchor + '  const discordLastPayloadKeyRef = useRef<string>("");\n',
        1,
    )

app = app.replace(
    '    let alive = true;\n    let lastPayloadKey = "";\n\n    const sendActivity = (reason = "tick") => {',
    '    let alive = true;\n\n    const sendActivity = () => {',
    1,
)
app = app.replace(
    '        latestSettings.discordSecondLine,\n        chosenDiscordAsset,\n        reason\n      ].join("|");\n\n      if (payloadKey === lastPayloadKey) return;\n      lastPayloadKey = payloadKey;',
    '        latestSettings.discordSecondLine,\n        chosenDiscordAsset\n      ].join("|");\n\n      if (payloadKey === discordLastPayloadKeyRef.current) return;\n      discordLastPayloadKeyRef.current = payloadKey;',
    1,
)
app = app.replace(
    "          discordGithubUrl: LOCALITFY_DOWNLOAD_URL,",
    "          discordGithubUrl: LOCALITFY_SOURCE_URL,",
    1,
)
# Replace only the Discord sender catch inside the effect.
discord_sender_anchor = '''          discordActivityType: "listening",\n          discordSmallImageMode: "player"\n        })\n        .catch(() => undefined);'''
if discord_sender_anchor in app:
    app = app.replace(
        discord_sender_anchor,
        '''          discordActivityType: "listening",\n          discordSmallImageMode: "player"\n        })\n        .catch(() => {\n          if (discordLastPayloadKeyRef.current === payloadKey) {\n            discordLastPayloadKeyRef.current = "";\n          }\n        });''',
        1,
    )
app = app.replace(
    '    sendActivity("now");\n\n    const discordRefreshEveryMs = isAppBackgrounded ? 45000 : 15000;\n    const timer = window.setInterval(() => sendActivity("tick"), discordRefreshEveryMs);',
    '    sendActivity();\n\n    const discordRefreshEveryMs = isAppBackgrounded ? 45000 : 15000;\n    const timer = window.setInterval(sendActivity, discordRefreshEveryMs);',
    1,
)
app = app.replace(
    '    if (!settings.discordEnabled) {\n      window.localitfy.clearDiscordActivity().catch(() => undefined);',
    '    if (!settings.discordEnabled) {\n      discordLastPayloadKeyRef.current = "";\n      window.localitfy.clearDiscordActivity().catch(() => undefined);',
    1,
)
write("src/App.tsx", app)

# --- Canonical Discord URLs ---
dc = read("src/features/discord/discord.constants.ts")
if "LOCALITFY_SOURCE_URL" not in dc:
    dc = dc.replace(
        'export const LOCALITFY_DOWNLOAD_URL = "https://github.com/meshahid973/localitfy/releases/latest";\n',
        'export const LOCALITFY_DOWNLOAD_URL = "https://github.com/meshahid973/localitfy/releases/latest";\nexport const LOCALITFY_SOURCE_URL = "https://github.com/meshahid973/localitfy";\n',
        1,
    )
write("src/features/discord/discord.constants.ts", dc)

barrel = read("src/localitfyConstants.ts")
barrel = barrel.replace(
    'export const LOCALITFY_DOWNLOAD_URL = "https://github.com/meshahid973/localitfy/releases/latest";\n',
    "",
)
old = 'export { DISCORD_ASSET_KEYS, DISCORD_HASH_ASSET_KEYS, DISCORD_LOGO_ASSET, DISCORD_NAMED_ASSET_KEYS, discordArtModeOptions, discordCleanupOptions, discordSecondLineOptions, discordStyleOptions } from "./features/discord/discord.constants";'
new = 'export { LOCALITFY_DOWNLOAD_URL, LOCALITFY_SOURCE_URL, DISCORD_ASSET_KEYS, DISCORD_HASH_ASSET_KEYS, DISCORD_LOGO_ASSET, DISCORD_NAMED_ASSET_KEYS, discordArtModeOptions, discordCleanupOptions, discordSecondLineOptions, discordStyleOptions } from "./features/discord/discord.constants";'
barrel = barrel.replace(old, new, 1)
write("src/localitfyConstants.ts", barrel)

# --- RPC art stability ---
rpc = read("electron/rpc.cjs")
resumed = '''  const resumedFresh =\n    songIdentity &&\n    songIdentity === dynamicDiscordAssetSongIdentity &&\n    isPlaying &&\n    !lastPayloadIsPlaying &&\n    currentTime <= 2 &&\n    now - lastDynamicAssetChangeAt > 1800;\n\n'''
rpc = rpc.replace(resumed, "", 1)
rpc = rpc.replace(
    "    playbackRestarted ||\n    resumedFresh ||\n    manuallyForced",
    "    playbackRestarted ||\n    manuallyForced",
    1,
)
write("electron/rpc.cjs", rpc)

# --- Crash recovery bridge ---
preload = read("electron/preload.cjs")
bridge_anchor = '  toggleDevTools: () => ipcRenderer.invoke("localitfy:toggle-devtools"),\n'
if "restartApp:" not in preload:
    if bridge_anchor not in preload:
        raise SystemExit("preload runtime bridge anchor missing")
    preload = preload.replace(
        bridge_anchor,
        bridge_anchor
        + '  restartApp: () => ipcRenderer.invoke("localitfy:restart-app"),\n'
        + '  openLogsFolder: () => ipcRenderer.invoke("localitfy:open-logs"),\n',
        1,
    )
write("electron/preload.cjs", preload)

main = read("electron/main.cjs")
restart_handler = '''  ipcRouter.handle("localitfy:restart-app", async () => {\n    restartForWindowTranslucency();\n    return true;\n  });\n'''
if 'ipcRouter.handle("localitfy:open-logs"' not in main:
    if restart_handler not in main:
        raise SystemExit("existing restart IPC handler missing")
    main = main.replace(
        restart_handler,
        restart_handler
        + '''  ipcRouter.handle("localitfy:open-logs", async () => {\n    try {\n      const logsPath = app.getPath("logs");\n      fs.mkdirSync(logsPath, { recursive: true });\n      const openError = await shell.openPath(logsPath);\n      return openError ? { ok: false, path: logsPath, error: openError } : { ok: true, path: logsPath };\n    } catch (error) {\n      return { ok: false, error: error?.message || "could not open logs folder" };\n    }\n  });\n''',
        1,
    )
write("electron/main.cjs", main)

dts = read("src/localitfy.d.ts")
dts_anchor = "      toggleDevTools?: () => Promise<any>;\n"
if "restartApp?:" not in dts:
    if dts_anchor not in dts:
        raise SystemExit("bridge type anchor missing")
    dts = dts.replace(
        dts_anchor,
        dts_anchor
        + "      restartApp?: () => Promise<boolean>;\n"
        + "      openLogsFolder?: () => Promise<{ ok: boolean; path?: string; error?: string }>;\n",
        1,
    )
write("src/localitfy.d.ts", dts)

# --- Error boundary ---
write(
    "src/app/AppErrorBoundary.tsx",
    '''import { Component, type ErrorInfo, type ReactNode } from "react";\nimport "./app-error-boundary.css";\n\ntype AppErrorBoundaryProps = { children: ReactNode };\ntype AppErrorBoundaryState = { error: Error | null; componentStack: string; copied: boolean };\n\nfunction makeCrashReport(error: Error | null, componentStack: string) {\n  return [\n    "Localitfy renderer crash",\n    `Time: ${new Date().toISOString()}`,\n    `User agent: ${navigator.userAgent}`,\n    "",\n    error?.stack || error?.message || "Unknown renderer error",\n    componentStack ? `\\nComponent stack:\\n${componentStack}` : ""\n  ].filter(Boolean).join("\\n");\n}\n\nasync function copyText(text: string) {\n  try {\n    await navigator.clipboard.writeText(text);\n    return true;\n  } catch {\n    const textarea = document.createElement("textarea");\n    textarea.value = text;\n    textarea.style.position = "fixed";\n    textarea.style.opacity = "0";\n    document.body.appendChild(textarea);\n    textarea.select();\n    const copied = document.execCommand("copy");\n    textarea.remove();\n    return copied;\n  }\n}\n\nexport class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {\n  state: AppErrorBoundaryState = { error: null, componentStack: "", copied: false };\n\n  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {\n    return { error };\n  }\n\n  componentDidCatch(error: Error, info: ErrorInfo) {\n    console.error("[localitfy renderer crash]", error, info.componentStack);\n    this.setState({ componentStack: info.componentStack || "" });\n  }\n\n  restart = async () => {\n    try {\n      const restarted = await window.localitfy?.restartApp?.();\n      if (restarted) return;\n    } catch {\n      // Renderer reload is the final fallback when IPC itself is unavailable.\n    }\n    window.location.reload();\n  };\n\n  copyError = async () => {\n    const copied = await copyText(makeCrashReport(this.state.error, this.state.componentStack));\n    if (!copied) return;\n    this.setState({ copied: true });\n    window.setTimeout(() => this.setState({ copied: false }), 1800);\n  };\n\n  openLogs = async () => {\n    try {\n      const result = await window.localitfy?.openLogsFolder?.();\n      if (result?.ok) return;\n    } catch {\n      // DevTools remains useful if opening the logs directory fails.\n    }\n    await window.localitfy?.openDevTools?.({ mode: "detach" }).catch(() => undefined);\n  };\n\n  render() {\n    if (!this.state.error) return this.props.children;\n\n    return (\n      <main className="appCrashBoundary" role="alert">\n        <section className="appCrashCard">\n          <span className="appCrashEyebrow">localtify recovery</span>\n          <h1>Localitfy encountered an error</h1>\n          <p>The renderer hit an unexpected error. Your library stays on disk; restart the app or copy the diagnostic details.</p>\n          <pre className="appCrashMessage">{this.state.error.message || "Unknown renderer error"}</pre>\n          <div className="appCrashActions">\n            <button type="button" className="appCrashPrimary" onClick={this.restart}>Restart</button>\n            <button type="button" onClick={this.copyError}>{this.state.copied ? "Copied" : "Copy error"}</button>\n            <button type="button" onClick={this.openLogs}>Open logs</button>\n          </div>\n        </section>\n      </main>\n    );\n  }\n}\n''',
)

write(
    "src/app/app-error-boundary.css",
    '''.appCrashBoundary { min-height: 100vh; display: grid; place-items: center; padding: 32px; background: #000; color: #f5f5f5; font-family: "Space Grotesk", system-ui, sans-serif; }\n.appCrashCard { width: min(680px, 100%); padding: 30px; border: 1px solid rgba(255,255,255,.12); border-radius: 20px; background: rgba(15,15,18,.94); box-shadow: 0 22px 70px rgba(0,0,0,.55); }\n.appCrashEyebrow { display: block; margin-bottom: 10px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; opacity: .58; }\n.appCrashCard h1 { margin: 0 0 10px; font-size: clamp(25px,4vw,38px); }\n.appCrashCard p { margin: 0; line-height: 1.6; color: rgba(245,245,245,.7); }\n.appCrashMessage { margin: 22px 0 0; padding: 14px 16px; max-height: 180px; overflow: auto; white-space: pre-wrap; word-break: break-word; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: rgba(255,255,255,.035); color: rgba(255,255,255,.78); font: 12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace; }\n.appCrashActions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }\n.appCrashActions button { min-height: 42px; padding: 0 17px; border: 1px solid rgba(255,255,255,.13); border-radius: 11px; background: rgba(255,255,255,.07); color: #fff; cursor: pointer; }\n.appCrashActions button:hover { background: rgba(255,255,255,.12); }\n.appCrashActions .appCrashPrimary { background: #f2f2f2; color: #050505; border-color: transparent; font-weight: 700; }\n.appCrashActions .appCrashPrimary:hover { background: #fff; }\n''',
)

root_render = read("src/main.tsx")
if 'from "./app/AppErrorBoundary"' not in root_render:
    root_render = root_render.replace(
        'import App from "./App";\n',
        'import App from "./App";\nimport { AppErrorBoundary } from "./app/AppErrorBoundary";\n',
        1,
    )
root_render = root_render.replace(
    'ReactDOM.createRoot(document.getElementById("root")!).render(<App />);',
    'ReactDOM.createRoot(document.getElementById("root")!).render(\n  <AppErrorBoundary>\n    <App />\n  </AppErrorBoundary>\n);',
    1,
)
write("src/main.tsx", root_render)

# --- Regression tests ---
write(
    "tests/phase4/runtime-reliability.test.mjs",
    '''import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport path from "node:path";\nimport test from "node:test";\nimport { fileURLToPath } from "node:url";\n\nconst root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");\nconst read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");\n\ntest("Discord renderer updates dedupe persistent state instead of timer reasons", () => {\n  const source = read("src/App.tsx");\n  assert.match(source, /discordLastPayloadKeyRef\\s*=\\s*useRef/);\n  assert.doesNotMatch(source, /chosenDiscordAsset,\\s*reason\\s*\\]/);\n  assert.match(source, /discordGithubUrl:\\s*LOCALITFY_SOURCE_URL/);\n});\n\ntest("Discord RPC does not roll new art just for a fresh resume", () => {\n  const source = read("electron/rpc.cjs");\n  assert.doesNotMatch(source, /const resumedFresh\\s*=/);\n  assert.doesNotMatch(source, /playbackRestarted\\s*\\|\\|\\s*resumedFresh/);\n});\n\ntest("Discord download and source buttons have distinct canonical URLs", () => {\n  const constants = read("src/features/discord/discord.constants.ts");\n  assert.match(constants, /LOCALITFY_DOWNLOAD_URL\\s*=\\s*"https:\\/\\/github\\.com\\/meshahid973\\/localitfy\\/releases\\/latest"/);\n  assert.match(constants, /LOCALITFY_SOURCE_URL\\s*=\\s*"https:\\/\\/github\\.com\\/meshahid973\\/localitfy"/);\n});\n\ntest("renderer root is protected by the Localitfy error boundary", () => {\n  const rootSource = read("src/main.tsx");\n  const boundary = read("src/app/AppErrorBoundary.tsx");\n  assert.match(rootSource, /<AppErrorBoundary>[\\s\\S]*<App \\/>[\\s\\S]*<\\/AppErrorBoundary>/);\n  assert.match(boundary, /Restart/);\n  assert.match(boundary, /Copy error/);\n  assert.match(boundary, /Open logs/);\n});\n\ntest("error recovery bridge reuses restart IPC and exposes logs", () => {\n  const preload = read("electron/preload.cjs");\n  const main = read("electron/main.cjs");\n  assert.match(preload, /restartApp:.*localitfy:restart-app/);\n  assert.match(preload, /openLogsFolder:.*localitfy:open-logs/);\n  assert.equal((main.match(/ipcRouter\\.handle\\("localitfy:restart-app"/g) || []).length, 1);\n  assert.equal((main.match(/ipcRouter\\.handle\\("localitfy:open-logs"/g) || []).length, 1);\n});\n''',
)

print("Phase 4B checkpoint 1 applied")
