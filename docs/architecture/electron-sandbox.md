# Electron sandbox and renderer trust boundary

## Current security boundary

Localtify runs the main renderer with `nodeIntegration: false`, `contextIsolation: true`, `webSecurity: true`, and **sandbox enabled**. The Spotify OAuth child window remains sandboxed as well.

The preload bridge uses `contextBridge` + `ipcRenderer` only; it does not depend on arbitrary Node modules in renderer scope. Privileged work stays behind named Electron IPC handlers and focused native runtime modules.

## Navigation and child-window policy

The main renderer cannot create arbitrary child windows or attach webviews. Renderer-initiated navigation is restricted to Localtify's packaged `localtify-renderer://app` renderer, the exact packaged renderer directory used by the legacy `file://` fallback, and the loopback Vite origin during development. Arbitrary local HTML files are not trusted. External URLs must go through the explicit main-process external-open IPC path.

Browser permission requests are denied by default because Localtify does not require camera, microphone, geolocation, notifications, MIDI, or other Chromium permissions for local playback.

## IPC trust boundary

Every handler registered through the centralized IPC router is protected by a **trusted sender** check. Calls are accepted only when the sender is the current main Localtify window's `webContents` **and** the IPC call originated from that webContents' main frame. Child windows, iframes, and unrelated renderer contexts cannot invoke privileged Localtify IPC channels.

The preload-to-native invoke surface is regression-tested so an exposed bridge method cannot silently lose its handler during main-process decomposition. Player commands use the same router seam and are forwarded back to the trusted renderer as `player:command` events.

## Main-process ownership

Focused native ownership currently includes:

- `electron/runtime/environment.cjs` — environment discovery and public configuration
- `electron/runtime/icons.cjs` — native icon discovery and image creation
- `electron/runtime/media-server.cjs` — local media HTTP/range serving, media tokens, and `localtify-media://`
- `electron/runtime/security.cjs` — navigation, permissions, window creation, and trusted renderer guards
- `electron/runtime/services.cjs` — native service lifecycle
- `electron/runtime/translucency.cjs` — window translucency/restart behavior
- `electron/runtime/updater.cjs` — update checks/download/install policy, including Linux manual-update behavior
- `electron/runtime/user-data.cjs` — stable user-data/recovery policy
- `electron/runtime/windows.cjs` — Windows startup integration and native window policy
- `electron/runtime/yt-dlp.cjs` — pinned and integrity-checked yt-dlp binary ownership

These boundaries keep `electron/main.cjs` focused on orchestration while preserving tray, taskbar, packaged-resource, update, media-serving, database, and window behavior.

## Non-negotiable invariants

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- `webviewTag: false`
- insecure mixed-content execution disabled
- drag/drop navigation disabled
- renderer-created windows denied
- renderer navigation restricted to Localtify-owned origins/paths
- browser permissions denied unless a future feature introduces an explicit reviewed allow-list
- privileged IPC accepted only from the active main Localtify renderer's main frame
- packaged renderer protocol is `localtify-renderer://app`
- local media protocol is `localtify-media://file/...`

The local release gate (`npm run release:check`) is the canonical automated validation path. Before a release, Windows and Linux/native smoke checks should also cover playback, imports, downloads, updater controls, tray/media integration, startup-at-login, custom protocols, and OAuth.
